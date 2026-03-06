// Shared TypeScript interfaces used across backend routes, plugins, and Socket.IO handlers.

// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

// ══════════════════════════════════════════════════════════
// UPGRADES — Body / Flow / Spirit (9 stats, replacing old 6)
// ══════════════════════════════════════════════════════════

export interface Upgrades {
  // Body
  vitalRoots: number;    // max 8 — +10 HP/level
  forestMend: number;    // max 6 — +0.2 HP/s regen
  ironBark: number;      // max 5 — +6% damage reduction
  // Flow
  petalEdge: number;     // max 8 — flat damage scaling
  rapidBloom: number;    // max 6 — fire rate (frames)
  deepQuiver: number;    // max 5 — ammo capacity
  swiftLoad: number;     // max 5 — reload speed (frames)
  // Spirit
  windStep: number;      // max 6 — movement speed
  gustMaster: number;    // max 5 — dash cooldown (frames)
  petalGuard: number;    // max 4 — invincibility frames on dash
}

// ══════════════════════════════════════════════════════════
// GAME SAVE — core persistent data
// ══════════════════════════════════════════════════════════

export interface GameSave {
  seeds: number;
  highScore: number;
  totalRuns: number;
  up: Upgrades;
  weapons: string[];
  abilities: string[];
  activeWeapon: string;
  activeAbility: string;
  runHistory?: RunHistoryEntry[];
}

export interface RunHistoryEntry {
  wave: number;
  score: number;
  kills: number;
  seeds: number;
  date: number;
  weapon: string;
  ability: string;
}

// ══════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════

export interface CombatStats {
  totalKills: number;
  bossKills: number;
  highestCombo: number;
  highestComboWeapon: string;
  totalDamageDealt: number;
  nearDeathSurvivals: number;
}

export interface SurvivalStats {
  highestWave: number;
  longestRunSeconds: number;
  totalWaves: number;
  totalRuns: number;
  totalRunTimeSeconds: number;
}

export interface RankedStats {
  currentRP: number;
  peakRP: number;
  currentMMR: number;
  winRate: number;            // 0–1 float
  currentStreak: number;
  bestStreak: number;
  matchesThisSeason: number;
  matchesAllTime: number;
  podiumFinishes: number;
  firstPlaceCount: number;
  placementMatchesPlayed: number;  // 0–8, placement complete at 8
  demotion_shields: number;        // 0–3 per tier entry
}

export interface EconomyStats {
  seedsEarnedAllTime: number;
  seedsSpentAllTime: number;
  pullsAllTime: number;
  rarestItemOwnedRarity: string;  // 'common' | 'refined' | 'rare' | 'legendary' | 'signature'
}

export interface WeaponStat {
  runsPlayed: number;
  bestWave: number;
  bestScore: number;
  avgKills: number;
  totalDamage: number;
}

export interface UserStats {
  combat: CombatStats;
  survival: SurvivalStats;
  ranked: RankedStats;
  economy: EconomyStats;
  weapons: Record<string, WeaponStat>;  // keyed by weapon ID
}

// ══════════════════════════════════════════════════════════
// PROFILE & COSMETICS
// ══════════════════════════════════════════════════════════

export type CosmticRarity = 'common' | 'refined' | 'rare' | 'legendary' | 'signature' | 'gm';

export interface UserProfile {
  avatarId: string;       // e.g. 'lotus', 'mandala', 'leaf-cluster'
  frameId: string;        // cosmetic frame ID
  bannerId: string;       // cosmetic banner ID
  title: string;          // e.g. 'Garden Keeper'
  badgeId: string;        // achievement badge ID
  statusMessage: string;  // max 32 chars
  favouriteWeaponId: string;
}

export interface UserLoadout {
  weaponId: string;
  abilityId: string;
  bulletSkinId: string;  // 'default' | 'cherry-blossom' | 'ink-drop' | etc.
  shipSkinId: string;
  killEffectId: string;
}

export interface InventoryItem {
  id: string;
  category: 'ship-skin' | 'bullet-skin' | 'kill-effect' | 'banner' | 'frame' | 'avatar' | 'weapon-skin';
  rarity: CosmticRarity;
  source: string;           // e.g. 'Season 1 Pull', 'Story Ch.3', 'Rank Reward'
  obtainedAt: Date;
  equipped: boolean;
}

// ══════════════════════════════════════════════════════════
// GACHA / BLOOM PULL
// ══════════════════════════════════════════════════════════

export interface PityCounters {
  pullsSinceLastRare: number;        // resets at 10 (hard pity)
  pullsSinceLastLegendary: number;   // resets at 50
  pullsSinceLastSignature: number;   // resets at 90
  softPityActive: boolean;           // true when >= 7 pulls since last rare
  totalPulls: number;                // lifetime
}

// ══════════════════════════════════════════════════════════
// RANKED / MMR
// ══════════════════════════════════════════════════════════

export type RankTier =
  | 'seedling'
  | 'sprout'
  | 'blossom'
  | 'willow'
  | 'lotus'
  | 'storm-petal'
  | 'garden-master';

export type RankDivision = 'I' | 'II' | 'III' | 'GM';  // 'GM' for Garden Master (no division)

export interface RankInfo {
  tier: RankTier;
  division: RankDivision;
  rp: number;
  mmr: number;
}

// ══════════════════════════════════════════════════════════
// SEASONS
// ══════════════════════════════════════════════════════════

export interface SeasonProgress {
  seasonId: string;      // e.g. 'season-1'
  xp: number;
  level: number;         // 1–30
  premiumUnlocked: boolean;
  claimedRewards: string[];  // array of reward node IDs
}

export interface SeasonMeta {
  id: string;
  name: string;           // e.g. 'Cherry Rain'
  startDate: Date;
  endDate: Date;
  themeColor: string;     // hex
  signatureItemId: string;
}

// ══════════════════════════════════════════════════════════
// WEEKLY CHALLENGES
// ══════════════════════════════════════════════════════════

export interface ChallengeProgress {
  challengeId: string;
  current: number;
  target: number;
  completed: boolean;
  claimedReward: boolean;
}

export interface WeeklyChallenge {
  id: string;
  category: 'combat' | 'survival' | 'weapon' | 'boss' | 'podium' | 'story' | 'friends' | 'combo' | 'speed';
  name: string;
  description: string;
  target: number;
  seedReward: number;
  xpReward: number;
  weekId: string;   // e.g. '2026-W10'
}

// ══════════════════════════════════════════════════════════
// FRIENDS & SOCIAL
// ══════════════════════════════════════════════════════════

export interface FriendEntry {
  userId: string;
  username: string;
  addedAt: Date;
}

export interface FriendRequest {
  userId: string;
  username: string;
  sentAt: Date;
}

export interface FriendsData {
  accepted: FriendEntry[];
  requestsIn: FriendRequest[];   // incoming requests
  requestsOut: FriendRequest[];  // outgoing requests
  blocked: string[];             // userId[]
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  fromUsername: string;
  message: string;
  timestamp: Date;
}

// ══════════════════════════════════════════════════════════
// PARTIES
// ══════════════════════════════════════════════════════════

export interface PartyMember {
  userId: string;
  username: string;
  avatarId: string;
  frameId: string;
  rankTier: RankTier;
  isLeader: boolean;
  isReady: boolean;
}

export interface Party {
  id: string;
  members: PartyMember[];
  mode: 'ranked' | 'story' | 'custom' | null;
  createdAt: Date;
}

// ══════════════════════════════════════════════════════════
// MATCHMAKING & LOBBIES
// ══════════════════════════════════════════════════════════

export interface LobbyPlayer {
  userId: string;
  username: string;
  mmr: number;
  rankTier: RankTier;
  avatarId: string;
  frameId: string;
  isReady: boolean;
  isBot: false;
}

export interface BotSlot {
  botId: string;
  name: string;      // e.g. 'WillowAI'
  tier: 'easy' | 'medium' | 'hard';
  mmr: number;
  isBot: true;
}

export type LobbySlot = LobbyPlayer | BotSlot;

// ══════════════════════════════════════════════════════════
// MATCH
// ══════════════════════════════════════════════════════════

export interface MatchResult {
  userId: string;
  username: string;
  isBot: boolean;
  placement: number;      // 1–10
  score: number;
  kills: number;
  bestCombo: number;
  wavesReached: number;
  seedsEarned: number;
  rpDelta: number;
  mmrDelta: number;
  podiumBonus: number;
}

export type MatchEventType =
  | 'player-downed'
  | 'player-revived'
  | 'player-respawned'
  | 'boss-spawned'
  | 'boss-killed'
  | 'combo-milestone'   // ×5, ×7, ×8+
  | 'enemies-sent'      // indirect PvP send
  | 'wave-complete'
  | 'timer-warning';    // 60s, 30s, 10s

export interface MatchEvent {
  type: MatchEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

// ══════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rp: number;
  tier: RankTier;
  weaponId: string;
  killsThisSeason: number;
  status: 'online' | 'in-match' | 'offline';
  avatarId: string;
}

// ══════════════════════════════════════════════════════════
// STORY MODE
// ══════════════════════════════════════════════════════════

export type StoryDifficulty = 'calm' | 'balanced' | 'tempest';

export interface StoryProgress {
  completedChapters: Array<{
    chapterId: number;
    difficulty: StoryDifficulty;
    completedAt: Date;
  }>;
  fullClearDate: Date | null;
}

// ══════════════════════════════════════════════════════════
// PRESTIGE
// ══════════════════════════════════════════════════════════

export interface PrestigeData {
  level: number;              // 0 = never prestiged, 1–5
  unlockedCosmetics: string[];  // IDs of prestige-exclusive items
}

// ══════════════════════════════════════════════════════════
// FULL USER DOCUMENT SHAPE (used by model + API responses)
// ══════════════════════════════════════════════════════════

export interface FullUserData extends GameSave {
  _id: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
  stats: UserStats;
  profile: UserProfile;
  loadout: UserLoadout;
  inventory: InventoryItem[];
  pity: PityCounters;
  ranked: RankInfo;
  seasonProgress: SeasonProgress | null;
  challengeProgress: ChallengeProgress[];
  friends: FriendsData;
  story: StoryProgress;
  prestige: PrestigeData;
  runHistory: RunHistoryEntry[];
}

// ══════════════════════════════════════════════════════════
// FASTIFY AUGMENTATION
// ══════════════════════════════════════════════════════════

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    username: string;
  }
}
