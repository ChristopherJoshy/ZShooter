import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/authenticate.js';

// ══════════════════════════════════════════════════════════
// Leaderboard routes
// ══════════════════════════════════════════════════════════

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX     = 100;

// Cache key for full snapshot (no pagination — invalidated on submit)
const CACHE_KEY = 'leaderboard:top10';
const CACHE_TTL = 60; // seconds

// Anti-cheat: max score = wavesReached × this constant
const MAX_SCORE_PER_WAVE = 1500;

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  highScore: number;
  highestWave?: number;
  totalRuns: number;
  rp?: number;
  mmr?: number;
  tier?: string;
  division?: string | null;
}

const querySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).optional().default(PAGE_SIZE_DEFAULT),
  offset: z.coerce.number().int().min(0).optional().default(0),
  scope:  z.enum(['ranked', 'score', 'wave']).optional().default('ranked'),
});

const submitSchema = z.object({
  score:        z.number().int().min(0),
  wavesReached: z.number().int().min(1),
  kills:        z.number().int().min(0),
  durationMs:   z.number().int().min(0),
});

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  // ── GET /leaderboard ──────────────────────────────────────
  // Paginated leaderboard sorted by highScore descending.
  // First page (offset=0, limit≤20) is Redis-cached for 60 s.
  fastify.get('/leaderboard', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }
    const { limit, offset, scope } = parsed.data;

    // Only cache the first default-size page
    const useCache = offset === 0 && limit === PAGE_SIZE_DEFAULT && scope === 'score';

    if (useCache && fastify.redis) {
      const cached = await fastify.redis.get(CACHE_KEY).catch(() => null);
      if (cached) {
        return reply
          .header('X-Cache', 'HIT')
          .send(JSON.parse(cached) as LeaderboardEntry[]);
      }
    }

    const sort: Record<string, 1 | -1> = scope === 'ranked'
      ? { 'ranked.rp': -1, 'ranked.mmr': -1, highScore: -1 }
      : scope === 'wave'
      ? { 'stats.survival.highestWave': -1, highScore: -1 }
      : { highScore: -1 };

    const users = await User.find({}, 'username highScore stats.survival.highestWave totalRuns ranked')
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    const entries: LeaderboardEntry[] = users.map((u, i) => ({
      rank:        offset + i + 1,
      userId:      String(u._id),
      username:    u.username,
      highScore:   u.highScore,
      highestWave: scope === 'wave' ? ((u.stats?.survival?.highestWave) ?? 0) : undefined,
      totalRuns:   u.totalRuns,
      rp:          scope === 'ranked' ? (u.ranked?.rp ?? 0) : undefined,
      mmr:         scope === 'ranked' ? (u.ranked?.mmr ?? 1000) : undefined,
      tier:        scope === 'ranked' ? (u.ranked?.tier ?? 'seedling') : undefined,
      division:    scope === 'ranked' ? (u.ranked?.division ?? 'III') : undefined,
    }));

    if (useCache && fastify.redis) {
      fastify.redis
        .setex(CACHE_KEY, CACHE_TTL, JSON.stringify(entries))
        .catch(() => {});
    }

    return reply
      .header('X-Cache', 'MISS')
      .send(entries);
  });

  // ── GET /leaderboard/me ───────────────────────────────────
  // Returns the authenticated user's rank and score.
  fastify.get('/leaderboard/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.userId;

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }
    const { scope } = parsed.data;

    const user = await User.findById(userId, 'username highScore stats.survival.highestWave totalRuns ranked').lean();
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const rank = scope === 'ranked'
      ? await User.countDocuments({
          $or: [
            { 'ranked.rp': { $gt: user.ranked?.rp ?? 0 } },
            {
              'ranked.rp': user.ranked?.rp ?? 0,
              'ranked.mmr': { $gt: user.ranked?.mmr ?? 1000 },
            },
          ],
        }) + 1
      : scope === 'wave'
      ? await User.countDocuments({ 'stats.survival.highestWave': { $gt: (user.stats?.survival?.highestWave) ?? 0 } }) + 1
      : await User.countDocuments({ highScore: { $gt: user.highScore } }) + 1;

    return reply.send({
      rank,
      userId: String(user._id),
      username: user.username,
      highScore: user.highScore,
      highestWave: scope === 'wave' ? ((user.stats?.survival?.highestWave) ?? 0) : undefined,
      totalRuns: user.totalRuns,
      rp:       scope === 'ranked' ? (user.ranked?.rp ?? 0) : undefined,
      mmr:      scope === 'ranked' ? (user.ranked?.mmr ?? 1000) : undefined,
      tier:     scope === 'ranked' ? (user.ranked?.tier ?? 'seedling') : undefined,
      division: scope === 'ranked' ? (user.ranked?.division ?? 'III') : undefined,
    } satisfies LeaderboardEntry);
  });

  // ── POST /leaderboard/submit ──────────────────────────────
  // Updates the authenticated user's highScore if the submitted score
  // is higher AND passes basic anti-cheat validation.
  fastify.post('/leaderboard/submit', { preHandler: authenticate }, async (request, reply) => {
    const parsed = submitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const { score, wavesReached, kills, durationMs } = parsed.data;
    const userId = request.userId;

    // Anti-cheat 1: score cap per wave
    const maxAllowed = wavesReached * MAX_SCORE_PER_WAVE;
    if (score > maxAllowed) {
      return reply.status(400).send({
        error: `Score ${score} exceeds maximum allowed for ${wavesReached} waves (${maxAllowed})`,
      });
    }

    // Anti-cheat 2: minimum duration — at least 2 s per wave
    const minDurationMs = wavesReached * 2000;
    if (durationMs < minDurationMs) {
      return reply.status(400).send({
        error: 'Duration too short for reported wave count',
      });
    }

    // Anti-cheat 3: kill sanity — max 200 kills per wave
    const maxKills = wavesReached * 200;
    if (kills > maxKills) {
      return reply.status(400).send({
        error: 'Kill count exceeds maximum for reported wave count',
      });
    }

    const user = await User.findById(userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const isNewHigh = score > user.highScore;

    if (isNewHigh) {
      user.highScore = score;
      await user.save();

      // Invalidate leaderboard cache so next GET reflects the new score
      if (fastify.redis) {
        fastify.redis.del(CACHE_KEY).catch(() => {});
      }
    }

    return reply.send({
      ok:       true,
      isNewHigh,
      highScore: user.highScore,
    });
  });
}
