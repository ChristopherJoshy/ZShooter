import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/authenticate.js';
import type { RankTier, RankDivision } from '../types/index.js';

// ══════════════════════════════════════════════════════════
// Match result routes — RP / MMR delta after a ranked match
// ══════════════════════════════════════════════════════════

// ── Anti-cheat configuration ───────────────────────────────
// Server-side validation thresholds to detect impossible scores
// These limits are intentionally conservative to catch obvious cheating
const MAX_SCORE_PER_WAVE = 50000;     // Max achievable score per wave
const MAX_KILLS_PER_WAVE = 200;       // Max kills per wave (reasonable for end-game)
const MIN_DURATION_PER_WAVE = 10;     // Minimum 10 seconds per wave
const MAX_DURATION_PER_WAVE = 300;    // Maximum 5 minutes per wave

const resultSchema = z.object({
  placement:    z.number().int().min(1).max(10),
  score:        z.number().int().min(0),
  kills:        z.number().int().min(0),
  wavesReached: z.number().int().min(1),
  durationMs:   z.number().int().min(0),
});

// ── RP delta table ─────────────────────────────────────────
const RP_DELTA: Record<number, number> = {
  1: 25,
  2: 15,
  3: 5,
  4: -10,
};
function rpDeltaForPlacement(placement: number): number {
  return RP_DELTA[placement] ?? -15;
}

// ── MMR delta ─────────────────────────────────────────────
function mmrDeltaForPlacement(placement: number): number {
  if (placement === 1) return 20;
  if (placement <= 3)  return 10;
  if (placement <= 5)  return 0;
  return -10;
}

// ── Rank tier thresholds (cumulative RP) ──────────────────
const TIER_ORDER: RankTier[] = [
  'seedling', 'sprout', 'blossom', 'willow', 'lotus', 'storm-petal', 'garden-master',
];
const TIER_DIVISION_RP = 100;  // RP per division within a tier (100 RP × 3 divisions)
const TIER_RP          = 300;  // RP to complete one tier (3 × 100)

function rpToTierDivision(totalRp: number): { tier: RankTier; division: RankDivision; rpInDivision: number } {
  const clampedRp = Math.max(0, totalRp);
  const tierIndex = Math.min(Math.floor(clampedRp / TIER_RP), TIER_ORDER.length - 1);
  const tier = TIER_ORDER[tierIndex];
  if (tier === 'garden-master') {
    return { tier, division: 'GM' as const, rpInDivision: clampedRp - tierIndex * TIER_RP };
  }
  const rpInTier = clampedRp - tierIndex * TIER_RP;
  const divIndex = Math.min(Math.floor(rpInTier / TIER_DIVISION_RP), 2); // 0=III, 1=II, 2=I
  const divisions: RankDivision[] = ['III', 'II', 'I'];
  const division = divisions[divIndex];
  const rpInDivision = rpInTier - divIndex * TIER_DIVISION_RP;
  return { tier, division, rpInDivision };
}

export default async function matchRoutes(fastify: FastifyInstance) {
  // ── POST /match/result ─────────────────────────────────────
  // Applies RP and MMR delta to the authenticated user after a ranked match.
  // Also increments ranked stats counters.
  fastify.post('/match/result', { preHandler: authenticate }, async (request, reply) => {
    const parsed = resultSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    // ── Anti-cheat validation ─────────────────────────────────
    // Server is the source of truth: validate submitted match results
    // Reject impossible scores that couldn't be achieved legitimately
    const { placement, score, kills, wavesReached, durationMs } = parsed.data;

    // Check for suspicious scores (exceeds per-wave maximum)
    if (score > wavesReached * MAX_SCORE_PER_WAVE) {
      fastify.log.warn({ userId: request.userId, score, wavesReached }, 'Suspicious score detected');
      return reply.status(400).send({ error: 'Suspicious score detected' });
    }

    // Check for suspicious kill counts (exceeds per-wave maximum)
    if (kills > wavesReached * MAX_KILLS_PER_WAVE) {
      fastify.log.warn({ userId: request.userId, kills, wavesReached }, 'Suspicious kill count detected');
      return reply.status(400).send({ error: 'Suspicious kill count detected' });
    }

    // Check duration is plausible (not too short to reach wave)
    const expectedMinDuration = wavesReached * MIN_DURATION_PER_WAVE;
    if (durationMs < expectedMinDuration * 1000) {
      fastify.log.warn({ userId: request.userId, durationMs, wavesReached }, 'Match too short');
      return reply.status(400).send({ error: 'Match too short' });
    }

    // Check duration isn't unreasonably long (could indicate manipulation)
    const expectedMaxDuration = wavesReached * MAX_DURATION_PER_WAVE;
    if (durationMs > expectedMaxDuration * 1000) {
      fastify.log.warn({ userId: request.userId, durationMs, wavesReached }, 'Match duration exceeds maximum');
      return reply.status(400).send({ error: 'Match duration exceeds reasonable limit' });
    }

    const userId = request.userId;

    const user = await User.findById(userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const isPlacement = (user.stats.ranked.placementMatchesPlayed ?? 0) < 8;
    // During placement, RP gains are doubled (losses halved)
    const rawRpDelta = rpDeltaForPlacement(placement);
    const rpDelta    = isPlacement
      ? rawRpDelta > 0 ? rawRpDelta * 2 : Math.ceil(rawRpDelta / 2)
      : rawRpDelta;
    const mmrDelta = mmrDeltaForPlacement(placement);

    const prevRp  = user.ranked.rp  ?? 0;
    const prevMmr = user.ranked.mmr ?? 1000;
    const newRp   = Math.max(0, prevRp + rpDelta);
    const newMmr  = Math.max(0, prevMmr + mmrDelta);

    const { tier, division } = rpToTierDivision(newRp);

    const rankedUp = tier !== user.ranked.tier || division !== user.ranked.division;

    user.ranked.rp       = newRp;
    user.ranked.mmr      = newMmr;
    user.ranked.tier     = tier;
    user.ranked.division = division;

    // Ranked stats
    const rs = user.stats.ranked;
    rs.currentRP              = newRp;
    rs.peakRP                 = Math.max(rs.peakRP ?? 0, newRp);
    rs.currentMMR             = newMmr;
    rs.matchesThisSeason      = (rs.matchesThisSeason ?? 0) + 1;
    rs.matchesAllTime         = (rs.matchesAllTime ?? 0) + 1;
    if (placement <= 3)  rs.podiumFinishes  = (rs.podiumFinishes ?? 0) + 1;
    if (placement === 1) rs.firstPlaceCount = (rs.firstPlaceCount ?? 0) + 1;
    if (isPlacement)     rs.placementMatchesPlayed = (rs.placementMatchesPlayed ?? 0) + 1;

    // Win-rate = (first place finishes / total matches)
    rs.winRate = rs.matchesAllTime > 0
      ? (rs.firstPlaceCount ?? 0) / rs.matchesAllTime
      : 0;

    // Survival stats
    const sv = user.stats.survival;
    sv.totalRuns            = (sv.totalRuns ?? 0) + 1;
    sv.totalWaves           = (sv.totalWaves ?? 0) + wavesReached;
    sv.highestWave          = Math.max(sv.highestWave ?? 0, wavesReached);
    sv.totalRunTimeSeconds  = (sv.totalRunTimeSeconds ?? 0) + Math.round(durationMs / 1000);
    sv.longestRunSeconds    = Math.max(sv.longestRunSeconds ?? 0, Math.round(durationMs / 1000));

    // Combat stats
    user.stats.combat.totalKills = (user.stats.combat.totalKills ?? 0) + kills;

    user.markModified('stats');
    user.markModified('ranked');
    await user.save();

    return reply.status(200).send({
      ok: true,
      rpDelta,
      mmrDelta,
      newRp,
      newMmr,
      newTier:     tier,
      newDivision: division,
      rankedUp,
      isPlacement,
    });
  });
}
