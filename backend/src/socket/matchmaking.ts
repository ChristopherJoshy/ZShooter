// ══════════════════════════════════════════════════════════
// Matchmaking socket handler
//
// Queue flow:
//   1. Client emits matchmaking:queue  → server adds to Redis sorted set
//   2. Server polls the sorted set every 2 s looking for ≥2 players
//      within MMR range (±150 initially, ±400 after 30 s)
//   3. When match found → create lobby → emit matchmaking:found to each player
//   4. After 5-second countdown → emit lobby:start
//   5. Bots fill any empty slots if 60 s elapses without a second player
// ══════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import type { IO } from './index.js';
import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './events.js';
import { mmQueue, lobby as lobbyKey, TTL } from '../lib/redis-keys.js';
import { User } from '../models/User.js';
import type { LobbyPlayer, BotSlot } from '../types/index.js';

// ── Constants ────────────────────────────────────────────
const REGION_DEFAULT   = 'global';
const MMR_RANGE_INIT   = 150;   // initial ±MMR window
const MMR_RANGE_WIDE   = 400;   // expanded after 30 s
const EXPAND_AFTER_MS  = 30_000;
const BOT_FILL_AFTER_MS = 60_000;
const MATCH_SIZE       = 4;     // max players per lobby
const MATCH_MIN        = 2;     // minimum real players to start
const COUNTDOWN_SEC    = 5;
const POLL_INTERVAL_MS = 2_000;

// Bot name pool
const BOT_NAMES = [
  'WillowAI', 'LotusAI', 'StormAI', 'PetalAI',
  'BlossomAI', 'CedarAI', 'FernAI', 'GaleAI',
];

// Per-socket queue metadata (held in memory on this process)
interface QueueEntry {
  userId:    string;
  username:  string;
  mmr:       number;
  region:    string;
  joinedAt:  number;
  socketId:  string;
  pollTimer: ReturnType<typeof setInterval>;
}

// In-process queue registry (socket.id → entry)
const queueRegistry = new Map<string, QueueEntry>();

// ── Helpers ──────────────────────────────────────────────

function makeBotSlot(tier: BotSlot['tier']): BotSlot {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const mmrMap: Record<BotSlot['tier'], number> = { easy: 800, medium: 1000, hard: 1200 };
  return {
    botId: randomUUID(),
    name,
    tier,
    mmr:   mmrMap[tier],
    isBot: true,
  };
}

async function buildLobbyPlayer(userId: string, mmr: number): Promise<LobbyPlayer> {
  const user = await User.findById(userId, 'username ranked profile').lean();
  return {
    userId,
    username:  user?.username ?? 'Unknown',
    mmr,
    rankTier:  user?.ranked?.tier ?? 'seedling',
    avatarId:  user?.profile?.avatarId ?? 'default',
    frameId:   user?.profile?.frameId  ?? 'default',
    isReady:   false,
    isBot:     false,
  };
}

async function formLobby(
  io: IO,
  redis: Redis | null,
  entries: QueueEntry[],
  fillWithBots: boolean,
): Promise<void> {
  const lobbyId  = randomUUID();
  const matchId  = randomUUID();

  // Build real player slots
  const players: LobbyPlayer[] = await Promise.all(
    entries.map((e) => buildLobbyPlayer(e.userId, e.mmr))
  );

  // Fill remaining slots with bots if requested
  const bots: BotSlot[] = [];
  if (fillWithBots) {
    const botsNeeded = MATCH_SIZE - players.length;
    for (let i = 0; i < botsNeeded; i++) {
      const tier = players.length <= 1 ? 'easy' : 'medium';
      bots.push(makeBotSlot(tier));
    }
  }

  // Persist lobby state in Redis (if available)
  const lobbyState = { lobbyId, matchId, players, bots, countdownSeconds: null as number | null };
  if (redis) {
    redis
      .setex(lobbyKey(lobbyId), TTL.LOBBY, JSON.stringify(lobbyState))
      .catch(() => {});
  }

  // Remove players from the sorted-set queue (if Redis available)
  const queueKey = mmQueue(entries[0]?.region ?? REGION_DEFAULT);
  if (redis) {
    redis.zrem(queueKey, ...entries.map((e) => e.userId)).catch(() => {});
  }

  // Stop each player's poll timer + deregister
  for (const entry of entries) {
    clearInterval(entry.pollTimer);
    queueRegistry.delete(entry.socketId);

    // Emit matchmaking:found to each player's socket
    io.to(entry.socketId).emit('matchmaking:found', {
      lobbyId,
      players,
      bots,
    });
  }

  // Emit initial lobby:update with countdown not started yet
  const room = `lobby:${lobbyId}`;
  for (const entry of entries) {
    const socket = io.sockets.sockets.get(entry.socketId);
    if (socket) socket.join(room);
  }

  io.to(room).emit('lobby:update', {
    lobbyId,
    players,
    countdownSeconds: null,
  });

  // Run countdown then emit lobby:start
  let remaining = COUNTDOWN_SEC;
  const countdown = setInterval(() => {
    remaining--;
    io.to(room).emit('lobby:update', {
      lobbyId,
      players,
      countdownSeconds: remaining,
    });
    if (remaining <= 0) {
      clearInterval(countdown);
      io.to(room).emit('lobby:start', { matchId, lobbyId });
    }
  }, 1000);
}

// ── Per-socket poll ───────────────────────────────────────
// Runs every POLL_INTERVAL_MS for each queued player.
// Tries to match the player with others in the sorted set.

function startPoll(
  io: IO,
  redis: Redis | null,
  redisAvailable: boolean,
  entry: QueueEntry,
): void {
  const timer = setInterval(async () => {
    // Re-check the entry is still in registry (may have been matched already)
    if (!queueRegistry.has(entry.socketId)) {
      clearInterval(timer);
      return;
    }

    // If Redis became unavailable, emit error and remove from queue
    if (!redis || !redisAvailable) {
      clearInterval(timer);
      queueRegistry.delete(entry.socketId);
      io.to(entry.socketId).emit('matchmaking:error', {
        message: 'Ranked unavailable - Redis connection failed',
      });
      return;
    }

    const now       = Date.now();
    const elapsed   = now - entry.joinedAt;
    const expanded  = elapsed >= EXPAND_AFTER_MS;
    const botFill   = elapsed >= BOT_FILL_AFTER_MS;
    const range     = expanded ? MMR_RANGE_WIDE : MMR_RANGE_INIT;

    const queueKey = mmQueue(entry.region);

    // Send waiting status update to this player
    const position = await redis
      .zrank(queueKey, entry.userId)
      .catch(() => null);

    if (position === null || position === undefined) {
      // Player was removed from queue externally — clean up
      clearInterval(timer);
      queueRegistry.delete(entry.socketId);
      return;
    }

    const eta = botFill ? 0 : Math.max(0, Math.ceil((BOT_FILL_AFTER_MS - elapsed) / 1000));
    io.to(entry.socketId).emit('matchmaking:waiting', {
      position:             position + 1,
      estimatedWaitSeconds: eta,
      expandedRange:        expanded,
    });

    // Fetch candidates within MMR range from the sorted set
    const minScore = entry.mmr - range;
    const maxScore = entry.mmr + range;

    const candidates: string[] = await redis
      .zrangebyscore(queueKey, minScore, maxScore)
      .catch(() => []);

    // Filter to entries that are still registered and exclude self
    const matchable: QueueEntry[] = candidates
      .map((uid) => {
        for (const [, e] of queueRegistry) {
          if (e.userId === uid && e.socketId !== entry.socketId) return e;
        }
        return null;
      })
      .filter((e): e is QueueEntry => e !== null);

    if (matchable.length >= MATCH_MIN - 1) {
      // We have enough real players (including self)
      const group = [entry, ...matchable].slice(0, MATCH_SIZE);
      await formLobby(io, redis, group, false);
      return;
    }

    if (botFill) {
      // Fill with bots after 60 s
      await formLobby(io, redis, [entry], true);
    }
  }, POLL_INTERVAL_MS);

  entry.pollTimer = timer;
}

// ── Handler registration ─────────────────────────────────

export function registerMatchmakingHandlers(
  io: IO,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  redis: Redis | null,
  redisAvailable: boolean,
): void {
  const { userId, username } = socket.data;

  // ── matchmaking:queue ─────────────────────────────────
  socket.on('matchmaking:queue', async (payload) => {
    // Check if Redis is available for ranked matchmaking
    if (!redis || !redisAvailable) {
      socket.emit('matchmaking:error', {
        message: 'Ranked unavailable - Redis connection failed',
      });
      return;
    }

    // Guard: don't let the same user queue twice
    for (const [, e] of queueRegistry) {
      if (e.userId === userId) return;
    }

    const region = payload.region ?? REGION_DEFAULT;
    const queueKey = mmQueue(region);

    // Look up the user's MMR from the DB (never trust client-sent MMR)
    const user = await User.findById(userId, 'ranked').lean().catch(() => null);
    const mmr  = user?.ranked?.mmr ?? 1000;

    // Add to Redis sorted set (score = MMR)
    await redis.zadd(queueKey, mmr, userId).catch(() => {});

    const entry: QueueEntry = {
      userId,
      username,
      mmr,
      region,
      joinedAt: Date.now(),
      socketId: socket.id,
      pollTimer: null as unknown as ReturnType<typeof setInterval>,
    };

    queueRegistry.set(socket.id, entry);

    // Send immediate waiting ack
    socket.emit('matchmaking:waiting', {
      position:             1,
      estimatedWaitSeconds: Math.ceil(BOT_FILL_AFTER_MS / 1000),
      expandedRange:        false,
    });

    startPoll(io, redis, redisAvailable, entry);
  });

  // ── matchmaking:cancel ───────────────────────────────
  socket.on('matchmaking:cancel', async () => {
    const entry = queueRegistry.get(socket.id);
    if (!entry) return;

    clearInterval(entry.pollTimer);
    queueRegistry.delete(socket.id);

    // Remove from Redis if available
    if (redis) {
      const queueKey = mmQueue(entry.region);
      await redis.zrem(queueKey, entry.userId).catch(() => {});
    }
  });

  // ── Cleanup on disconnect ─────────────────────────────
  socket.on('disconnect', async () => {
    const entry = queueRegistry.get(socket.id);
    if (!entry) return;

    clearInterval(entry.pollTimer);
    queueRegistry.delete(socket.id);

    // Remove from Redis if available
    if (redis) {
      const queueKey = mmQueue(entry.region);
      await redis.zrem(queueKey, entry.userId).catch(() => {});
    }
  });
}
