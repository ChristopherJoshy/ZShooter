import { z } from 'zod';

// ══════════════════════════════════════════════════════════
// Upgrades — Body / Flow / Spirit (9 stats)
// ══════════════════════════════════════════════════════════

const upgradesSchema = z.object({
  // Body
  vitalRoots: z.number().int().min(0).max(8),
  forestMend: z.number().int().min(0).max(6),
  ironBark:   z.number().int().min(0).max(5),
  // Flow
  petalEdge:  z.number().int().min(0).max(8),
  rapidBloom: z.number().int().min(0).max(6),
  deepQuiver: z.number().int().min(0).max(5),
  swiftLoad:  z.number().int().min(0).max(5),
  // Spirit
  windStep:   z.number().int().min(0).max(6),
  gustMaster: z.number().int().min(0).max(5),
  petalGuard: z.number().int().min(0).max(4),
});

const runHistoryEntrySchema = z.object({
  wave: z.number().int().min(0),
  score: z.number().int().min(0),
  kills: z.number().int().min(0),
  seeds: z.number().int().min(0),
  date: z.number().int().min(0),
  weapon: z.string(),
  ability: z.string(),
});

const inventoryEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['avatar', 'frame', 'banner']),
  rarity: z.enum(['common', 'rare', 'epic']),
});

const profileSchema = z.object({
  avatar: z.string(),
  frame: z.string(),
  banner: z.string(),
  unlockedAvatars: z.array(z.string()),
  unlockedFrames: z.array(z.string()),
  unlockedBanners: z.array(z.string()),
});

// ══════════════════════════════════════════════════════════
// Core game save — written by the client on game-over
// and on upgrade/weapon/ability purchases.
// ══════════════════════════════════════════════════════════

export const saveSaveSchema = z.object({
  seeds:         z.number().int().min(0),
  highScore:     z.number().int().min(0),
  totalRuns:     z.number().int().min(0),
  up:            upgradesSchema,
  weapons:       z.array(z.string()),
  abilities:     z.array(z.string()),
  activeWeapon:  z.string(),
  activeAbility: z.string(),
  runHistory:    z.array(runHistoryEntrySchema).optional(),
  inventory:     z.array(inventoryEntrySchema).optional(),
  pityCount:     z.number().int().min(0).optional(),
  profile:       profileSchema.optional(),
});

export type SaveSaveInput = z.infer<typeof saveSaveSchema>;
