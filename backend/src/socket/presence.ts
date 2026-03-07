// ══════════════════════════════════════════════════════════
// Presence handler
// Manages online/in-match/offline state in Redis.
// Broadcasts status updates to friends via Socket.IO rooms.
// ══════════════════════════════════════════════════════════

import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './events.js';
import * as Keys from '../lib/redis-keys.js';
import type { Redis } from 'ioredis';
import { User } from '../models/User.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ──────────────────────────────────────────────────────────
// Register presence event handlers on a socket
// ──────────────────────────────────────────────────────────

export function registerPresenceHandlers(io: IO, socket: AppSocket, redis: Redis | null): void {
  // ── presence:online ───────────────────────────────────
  socket.on('presence:online', async ({ userId, username }) => {
    // Skip if Redis is unavailable
    if (!redis) return;

    // Store socket ID → userId mapping
    await redis.setex(Keys.userSocket(userId), Keys.TTL.PRESENCE * 10, socket.id);
    await redis.setex(Keys.presence(userId), Keys.TTL.PRESENCE, 'online');

    // Join a personal room so friends can send targeted events
    await socket.join(`user:${userId}`);

    // Attach identity to socket data for disconnect cleanup
    socket.data.userId = userId;
    socket.data.username = username;

    // Notify online friends
    await broadcastPresenceToFriends(io, redis, userId, 'online');
  });

  // ── presence:in-match ─────────────────────────────────
  socket.on('presence:in-match', async ({ userId, mode }) => {
    // Skip if Redis is unavailable
    if (!redis) return;

    await redis.setex(Keys.presence(userId), Keys.TTL.PRESENCE * 40, 'in-match');

    await broadcastPresenceToFriends(io, redis, userId, 'in-match', mode);
  });

  // ── presence:offline ──────────────────────────────────
  socket.on('presence:offline', async ({ userId }) => {
    // Skip if Redis is unavailable
    if (!redis) return;

    await handleOffline(io, redis, userId);
  });

  // ── disconnect ───────────────────────────────────────
  // Clean up presence when socket drops (tab close, network loss)
  socket.on('disconnect', async () => {
    const userId = socket.data.userId;
    if (!userId || !redis) return;
    await handleOffline(io, redis, userId);
  });
}

// ──────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────

async function handleOffline(io: IO, redis: Redis, userId: string): Promise<void> {
  await redis.del(Keys.presence(userId));
  await redis.del(Keys.userSocket(userId));
  await broadcastPresenceToFriends(io, redis, userId, 'offline');
}

/**
 * Fetches the user's accepted friend list from MongoDB and emits
 * a presence:update event to each friend's personal room.
 */
async function broadcastPresenceToFriends(
  io: IO,
  redis: Redis,
  userId: string,
  status: 'online' | 'in-match' | 'offline',
  mode?: 'ranked' | 'story'
): Promise<void> {
  try {
    const user = await User.findById(userId).select('friends.accepted').lean();
    if (!user || !user.friends?.accepted?.length) return;

    const payload = {
      userId,
      status,
      ...(mode ? { mode } : {}),
    };

    for (const friend of user.friends.accepted) {
      io.to(`user:${friend.userId}`).emit('presence:update', payload);
    }
  } catch {
    // Presence updates are non-fatal — never crash the server on a lookup failure
  }
}

// ──────────────────────────────────────────────────────────
// Heartbeat refresher
// Call this periodically on active connections to keep
// the Redis presence key from expiring mid-session.
// ──────────────────────────────────────────────────────────

export async function refreshPresenceHeartbeat(
  redis: Redis,
  userId: string,
  status: string
): Promise<void> {
  await redis.setex(Keys.presence(userId), Keys.TTL.PRESENCE, status).catch(() => null);
}

// ──────────────────────────────────────────────────────────
// Utility: get current presence status for a user
// ──────────────────────────────────────────────────────────

export async function getUserPresence(
  redis: Redis,
  userId: string
): Promise<'online' | 'in-match' | 'offline'> {
  const val = await redis.get(Keys.presence(userId)).catch(() => null);
  if (val === 'in-match') return 'in-match';
  if (val === 'online') return 'online';
  return 'offline';
}
