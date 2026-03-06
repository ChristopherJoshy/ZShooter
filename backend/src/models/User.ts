import mongoose, { Document, Schema } from 'mongoose';
import type {
  GameSave,
  Upgrades,
  UserStats,
  UserProfile,
  UserLoadout,
  InventoryItem,
  PityCounters,
  RankInfo,
  RunHistoryEntry,
  SeasonProgress,
  ChallengeProgress,
  FriendsData,
  StoryProgress,
  PrestigeData,
} from '../types/index.js';

// ══════════════════════════════════════════════════════════
// Document interface
// ══════════════════════════════════════════════════════════

export interface IUser extends Document {
  username: string;
  usernameNormalized: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;

  // Core game save
  seeds: number;
  highScore: number;
  totalRuns: number;
  up: Upgrades;
  weapons: string[];
  abilities: string[];
  activeWeapon: string;
  activeAbility: string;

  // Extended data
  runHistory: RunHistoryEntry[];
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
}

// ══════════════════════════════════════════════════════════
// Sub-schemas
// ══════════════════════════════════════════════════════════

const upgradesSchema = new Schema<Upgrades>(
  {
    // Body
    vitalRoots: { type: Number, default: 0, min: 0, max: 8 },
    forestMend: { type: Number, default: 0, min: 0, max: 6 },
    ironBark:   { type: Number, default: 0, min: 0, max: 5 },
    // Flow
    petalEdge:  { type: Number, default: 0, min: 0, max: 8 },
    rapidBloom: { type: Number, default: 0, min: 0, max: 6 },
    deepQuiver: { type: Number, default: 0, min: 0, max: 5 },
    swiftLoad:  { type: Number, default: 0, min: 0, max: 5 },
    // Spirit
    windStep:   { type: Number, default: 0, min: 0, max: 6 },
    gustMaster: { type: Number, default: 0, min: 0, max: 5 },
    petalGuard: { type: Number, default: 0, min: 0, max: 4 },
  },
  { _id: false }
);

const combatStatsSchema = new Schema(
  {
    totalKills:          { type: Number, default: 0 },
    bossKills:           { type: Number, default: 0 },
    highestCombo:        { type: Number, default: 0 },
    highestComboWeapon:  { type: String, default: 'seedShot' },
    totalDamageDealt:    { type: Number, default: 0 },
    nearDeathSurvivals:  { type: Number, default: 0 },
  },
  { _id: false }
);

const survivalStatsSchema = new Schema(
  {
    highestWave:          { type: Number, default: 0 },
    longestRunSeconds:    { type: Number, default: 0 },
    totalWaves:           { type: Number, default: 0 },
    totalRuns:            { type: Number, default: 0 },
    totalRunTimeSeconds:  { type: Number, default: 0 },
  },
  { _id: false }
);

const rankedStatsSchema = new Schema(
  {
    currentRP:                { type: Number, default: 0 },
    peakRP:                   { type: Number, default: 0 },
    currentMMR:               { type: Number, default: 1000 },
    winRate:                  { type: Number, default: 0 },
    currentStreak:            { type: Number, default: 0 },
    bestStreak:               { type: Number, default: 0 },
    matchesThisSeason:        { type: Number, default: 0 },
    matchesAllTime:           { type: Number, default: 0 },
    podiumFinishes:           { type: Number, default: 0 },
    firstPlaceCount:          { type: Number, default: 0 },
    placementMatchesPlayed:   { type: Number, default: 0 },
    demotion_shields:         { type: Number, default: 0 },
  },
  { _id: false }
);

const economyStatsSchema = new Schema(
  {
    seedsEarnedAllTime:       { type: Number, default: 0 },
    seedsSpentAllTime:        { type: Number, default: 0 },
    pullsAllTime:             { type: Number, default: 0 },
    rarestItemOwnedRarity:    { type: String, default: 'common' },
  },
  { _id: false }
);

const weaponStatSchema = new Schema(
  {
    runsPlayed:   { type: Number, default: 0 },
    bestWave:     { type: Number, default: 0 },
    bestScore:    { type: Number, default: 0 },
    avgKills:     { type: Number, default: 0 },
    totalDamage:  { type: Number, default: 0 },
  },
  { _id: false }
);

const statsSchema = new Schema(
  {
    combat:    { type: combatStatsSchema,   default: () => ({}) },
    survival:  { type: survivalStatsSchema, default: () => ({}) },
    ranked:    { type: rankedStatsSchema,   default: () => ({}) },
    economy:   { type: economyStatsSchema,  default: () => ({}) },
    weapons:   { type: Map, of: weaponStatSchema, default: () => new Map() },
  },
  { _id: false }
);

const profileSchema = new Schema(
  {
    avatarId:          { type: String, default: 'lotus' },
    frameId:           { type: String, default: 'common-thin' },
    bannerId:          { type: String, default: 'warm-sand' },
    title:             { type: String, default: 'Garden Keeper' },
    badgeId:           { type: String, default: '' },
    statusMessage:     { type: String, default: '', maxlength: 32 },
    favouriteWeaponId: { type: String, default: 'seedShot' },
  },
  { _id: false }
);

const loadoutSchema = new Schema(
  {
    weaponId:     { type: String, default: 'seedShot' },
    abilityId:    { type: String, default: 'none' },
    bulletSkinId: { type: String, default: 'default' },
    shipSkinId:   { type: String, default: 'default' },
    killEffectId: { type: String, default: 'default' },
  },
  { _id: false }
);

const inventoryItemSchema = new Schema(
  {
    id:         { type: String, required: true },
    category:   { type: String, required: true },
    rarity:     { type: String, required: true },
    source:     { type: String, default: '' },
    obtainedAt: { type: Date, default: () => new Date() },
    equipped:   { type: Boolean, default: false },
  },
  { _id: false }
);

const pitySchema = new Schema(
  {
    pullsSinceLastRare:       { type: Number, default: 0 },
    pullsSinceLastLegendary:  { type: Number, default: 0 },
    pullsSinceLastSignature:  { type: Number, default: 0 },
    softPityActive:           { type: Boolean, default: false },
    totalPulls:               { type: Number, default: 0 },
  },
  { _id: false }
);

const rankInfoSchema = new Schema(
  {
    tier:     { type: String, default: 'seedling' },
    division: { type: String, default: 'III' },
    rp:       { type: Number, default: 0 },
    mmr:      { type: Number, default: 1000 },
  },
  { _id: false }
);

const seasonProgressSchema = new Schema(
  {
    seasonId:        { type: String, required: true },
    xp:              { type: Number, default: 0 },
    level:           { type: Number, default: 1, min: 1, max: 30 },
    premiumUnlocked: { type: Boolean, default: false },
    claimedRewards:  { type: [String], default: [] },
  },
  { _id: false }
);

const challengeProgressSchema = new Schema(
  {
    challengeId:   { type: String, required: true },
    current:       { type: Number, default: 0 },
    target:        { type: Number, required: true },
    completed:     { type: Boolean, default: false },
    claimedReward: { type: Boolean, default: false },
  },
  { _id: false }
);

const friendEntrySchema = new Schema(
  {
    userId:   { type: String, required: true },
    username: { type: String, required: true },
    addedAt:  { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const friendRequestSchema = new Schema(
  {
    userId:   { type: String, required: true },
    username: { type: String, required: true },
    sentAt:   { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const friendsDataSchema = new Schema(
  {
    accepted:     { type: [friendEntrySchema],   default: [] },
    requestsIn:   { type: [friendRequestSchema], default: [] },
    requestsOut:  { type: [friendRequestSchema], default: [] },
    blocked:      { type: [String],              default: [] },
  },
  { _id: false }
);

const storyChapterSchema = new Schema(
  {
    chapterId:   { type: Number, required: true },
    difficulty:  { type: String, required: true },
    completedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const storyProgressSchema = new Schema(
  {
    completedChapters: { type: [storyChapterSchema], default: [] },
    fullClearDate:     { type: Date, default: null },
  },
  { _id: false }
);

const runHistoryEntrySchema = new Schema(
  {
    wave:    { type: Number, default: 0 },
    score:   { type: Number, default: 0 },
    kills:   { type: Number, default: 0 },
    seeds:   { type: Number, default: 0 },
    date:    { type: Number, default: 0 },
    weapon:  { type: String, default: 'seedShot' },
    ability: { type: String, default: 'none' },
  },
  { _id: false }
);

const prestigeSchema = new Schema(
  {
    level:              { type: Number, default: 0, min: 0, max: 5 },
    unlockedCosmetics:  { type: [String], default: [] },
  },
  { _id: false }
);

// ══════════════════════════════════════════════════════════
// Root user schema
// ══════════════════════════════════════════════════════════

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 24,
    },
    usernameNormalized: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },

    // Core game save
    seeds:         { type: Number, default: 0, min: 0 },
    highScore:     { type: Number, default: 0, min: 0 },
    totalRuns:     { type: Number, default: 0, min: 0 },
    up:            { type: upgradesSchema, default: () => ({}) },
    weapons:       { type: [String], default: ['seedShot'] },
    abilities:     { type: [String], default: [] },
    activeWeapon:  { type: String, default: 'seedShot' },
    activeAbility: { type: String, default: 'none' },

    // Extended data
    runHistory:        { type: [runHistoryEntrySchema], default: [] },
    stats:             { type: statsSchema,            default: () => ({}) },
    profile:           { type: profileSchema,          default: () => ({}) },
    loadout:           { type: loadoutSchema,          default: () => ({}) },
    inventory:         { type: [inventoryItemSchema],  default: [] },
    pity:              { type: pitySchema,             default: () => ({}) },
    ranked:            { type: rankInfoSchema,         default: () => ({}) },
    seasonProgress:    { type: seasonProgressSchema,   default: null },
    challengeProgress: { type: [challengeProgressSchema], default: [] },
    friends:           { type: friendsDataSchema,      default: () => ({}) },
    story:             { type: storyProgressSchema,    default: () => ({}) },
    prestige:          { type: prestigeSchema,         default: () => ({}) },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
userSchema.index({ highScore: -1 });
userSchema.index({ 'ranked.rp': -1 });
userSchema.index({ 'ranked.mmr': -1 });
userSchema.index({ 'stats.ranked.currentRP': -1 });

export const User = mongoose.model<IUser>('User', userSchema);
