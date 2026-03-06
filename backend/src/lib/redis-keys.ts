// ══════════════════════════════════════════════════════════
// Redis key architecture — all Redis key patterns in one place.
// Never hardcode key strings outside this module.
// ══════════════════════════════════════════════════════════

// TTL constants (seconds)
export const TTL = {
  PRESENCE:          30,     // presence heartbeat TTL
  SESSION:           86400,  // 24h
  LB_SNAPSHOT:       60,     // leaderboard API cache
  SEASON_META:       3600,   // 1h
  CHALLENGES:        604800, // 1 week (until Sunday reset)
  LOBBY:             300,    // 5 min lobby state
  MATCH_STATE:       360,    // 6 min match state
  CHAT_MESSAGE:      604800, // 7 days (DM message TTL)
} as const;

// ──────────────────────────────────────────────────────────
// Matchmaking
// ──────────────────────────────────────────────────────────

/** Sorted set: score = MMR, member = userId */
export const mmQueue = (region: string): string =>
  `zf:queue:${region}`;

/** Hash: lobby state (players, bots, countdown) */
export const lobby = (lobbyId: string): string =>
  `zf:lobby:${lobbyId}`;

/** Hash: live match state during a 5-minute match */
export const matchState = (matchId: string): string =>
  `zf:match:${matchId}:state`;

/** Set: bot IDs participating in this match */
export const matchBots = (matchId: string): string =>
  `zf:match:${matchId}:bots`;

// ──────────────────────────────────────────────────────────
// Presence / Sessions
// ──────────────────────────────────────────────────────────

/** String: 'online' | 'in-match' | 'in-garden' — TTL 30s, heartbeat refreshes it */
export const presence = (userId: string): string =>
  `zf:presence:${userId}`;

/** String: socketId for a user's active socket connection */
export const userSocket = (userId: string): string =>
  `zf:socket:${userId}`;

/** String: session token cache, TTL 24h */
export const session = (userId: string): string =>
  `zf:session:${userId}`;

// ──────────────────────────────────────────────────────────
// Leaderboards
// ──────────────────────────────────────────────────────────

/** Sorted set: score = RP, member = userId — global all-time */
export const lbGlobal = (): string => `zf:lb:global`;

/** Sorted set: score = RP, member = userId — current season */
export const lbSeason = (seasonId: string): string =>
  `zf:lb:season:${seasonId}`;

/** Sorted set: score = RP, member = userId — current week */
export const lbWeekly = (weekId: string): string =>
  `zf:lb:weekly:${weekId}`;

/** Sorted set: score = RP, member = userId — per-user friend leaderboard */
export const lbFriends = (userId: string): string =>
  `zf:lb:friends:${userId}`;

/** String: JSON snapshot of top-N leaderboard, TTL 60s */
export const lbSnapshot = (type: 'global' | 'season' | 'weekly'): string =>
  `zf:lb:snapshot:${type}`;

// ──────────────────────────────────────────────────────────
// Season / Challenges
// ──────────────────────────────────────────────────────────

/** String: JSON of current season metadata, TTL 1h */
export const seasonCurrent = (): string => `zf:season:current`;

/** String: JSON of active weekly challenge pool, TTL until Sunday */
export const challengesCurrent = (): string => `zf:challenges:current`;

// ──────────────────────────────────────────────────────────
// Social / Chat
// ──────────────────────────────────────────────────────────

/** List: last 50 DM messages between two users (sorted by user IDs to avoid duplicates) */
export const dmHistory = (userA: string, userB: string): string => {
  const sorted = [userA, userB].sort();
  return `zf:dm:${sorted[0]}:${sorted[1]}`;
};

/** List: party chat messages for a party */
export const partyChat = (partyId: string): string =>
  `zf:party:${partyId}:chat`;

/** String: current party for a user */
export const userParty = (userId: string): string =>
  `zf:party:user:${userId}`;

// ──────────────────────────────────────────────────────────
// Rate limiting helpers
// ──────────────────────────────────────────────────────────

/** String: friend request cooldown (prevent spam) */
export const friendRequestCooldown = (fromUserId: string, toUserId: string): string =>
  `zf:friend-req-cd:${fromUserId}:${toUserId}`;

/** String: pull rate limit (1 pull batch per 500ms) */
export const pullRateLimit = (userId: string): string =>
  `zf:pull-rl:${userId}`;

// ──────────────────────────────────────────────────────────
// Activity feed
// ──────────────────────────────────────────────────────────

/** List: global activity feed events (capped at 100 items) */
export const activityFeed = (): string => `zf:feed:global`;

// ──────────────────────────────────────────────────────────
// Utility: generate a week ID string for a given Date
// ──────────────────────────────────────────────────────────

export function weekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
