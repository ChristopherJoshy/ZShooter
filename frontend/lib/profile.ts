import type { UserProfile } from './api';
import type {
  AvatarId,
  BannerId,
  FrameId,
  GameSave,
  LifetimeStats,
  OwnedCosmetic,
  PlayerProfile,
  RankedProgress,
} from './game/types';
import { defaultSave } from '@/context/GameContext';

function asAvatarId(value: string | undefined): AvatarId {
  const allowed: AvatarId[] = ['sprout', 'bloom', 'thorn', 'lotus', 'mist', 'root', 'petal', 'blossom', 'storm'];
  return allowed.includes(value as AvatarId) ? (value as AvatarId) : 'sprout';
}

function asFrameId(value: string | undefined): FrameId {
  const allowed: FrameId[] = ['none', 'gold', 'silver', 'nature', 'shadow', 'sakura'];
  return allowed.includes(value as FrameId) ? (value as FrameId) : 'none';
}

function asBannerId(value: string | undefined): BannerId {
  const allowed: BannerId[] = ['forest', 'dusk', 'frost', 'ember', 'void', 'bloom'];
  return allowed.includes(value as BannerId) ? (value as BannerId) : 'forest';
}

function mapInventory(profile: UserProfile): OwnedCosmetic[] {
  return (profile.inventory ?? []).flatMap((item) => {
    if (item.category === 'avatar' || item.category === 'frame' || item.category === 'banner') {
      return [{
        id: item.id,
        type: item.category,
        rarity: item.rarity === 'legendary' || item.rarity === 'signature' || item.rarity === 'gm'
          ? 'epic'
          : item.rarity === 'refined'
          ? 'common'
          : item.rarity,
      }];
    }
    return [];
  });
}

function mapUnlockedProfile(profile: UserProfile): PlayerProfile {
  const base = defaultSave().profile;
  const inventory = mapInventory(profile);
  const unlockedAvatars = new Set<AvatarId>(base.unlockedAvatars);
  const unlockedFrames = new Set<FrameId>(base.unlockedFrames);
  const unlockedBanners = new Set<BannerId>(base.unlockedBanners);

  inventory.forEach((item) => {
    if (item.type === 'avatar' && ['sprout', 'bloom', 'thorn', 'lotus', 'mist', 'root', 'petal', 'blossom', 'storm'].includes(item.id)) {
      unlockedAvatars.add(item.id as AvatarId);
    }
    if (item.type === 'frame' && ['none', 'gold', 'silver', 'nature', 'shadow', 'sakura'].includes(item.id)) {
      unlockedFrames.add(item.id as FrameId);
    }
    if (item.type === 'banner' && ['forest', 'dusk', 'frost', 'ember', 'void', 'bloom'].includes(item.id)) {
      unlockedBanners.add(item.id as BannerId);
    }
  });

  return {
    avatar: asAvatarId(profile.profile?.avatarId),
    frame: asFrameId(profile.profile?.frameId),
    banner: asBannerId(profile.profile?.bannerId),
    unlockedAvatars: Array.from(unlockedAvatars),
    unlockedFrames: Array.from(unlockedFrames),
    unlockedBanners: Array.from(unlockedBanners),
  };
}

function mapStats(profile: UserProfile): LifetimeStats {
  const ranked = profile.stats?.ranked;
  return {
    totalKills: profile.stats?.combat?.totalKills ?? 0,
    totalSeeds: profile.stats?.economy?.seedsEarnedAllTime ?? profile.seeds ?? 0,
    totalWaves: profile.stats?.survival?.totalWaves ?? 0,
    highestCombo: profile.stats?.combat?.highestCombo ?? 0,
    totalPlayTime: profile.stats?.survival?.totalRunTimeSeconds ?? 0,
    // `ranked` is consumed separately below.
  };
}

function mapRanked(profile: UserProfile): RankedProgress {
  return {
    tier: profile.ranked?.tier ?? 'seedling',
    division: profile.ranked?.division ?? 'III',
    rp: profile.ranked?.rp ?? 0,
    mmr: profile.ranked?.mmr ?? 1000,
    placementMatchesPlayed: profile.stats?.ranked?.placementMatchesPlayed ?? 0,
    peakRp: profile.stats?.ranked?.peakRP ?? 0,
    winRate: profile.stats?.ranked?.winRate ?? 0,
    matchesThisSeason: profile.stats?.ranked?.matchesThisSeason ?? 0,
    matchesAllTime: profile.stats?.ranked?.matchesAllTime ?? 0,
    podiumFinishes: profile.stats?.ranked?.podiumFinishes ?? 0,
    firstPlaceCount: profile.stats?.ranked?.firstPlaceCount ?? 0,
  };
}

export function normalizeProfileToSave(profile: UserProfile): GameSave {
  const fallback = defaultSave();

  return {
    seeds: profile.seeds ?? fallback.seeds,
    highScore: profile.highScore ?? fallback.highScore,
    highestWave: profile.highestWave ?? fallback.highestWave,
    totalRuns: profile.totalRuns ?? fallback.totalRuns,
    up: profile.up ?? fallback.up,
    weapons: profile.weapons ?? fallback.weapons,
    abilities: profile.abilities ?? fallback.abilities,
    activeWeapon: profile.activeWeapon ?? fallback.activeWeapon,
    activeAbility: profile.activeAbility ?? fallback.activeAbility,
    profile: mapUnlockedProfile(profile),
    pityCount: profile.pity?.pullsSinceLastLegendary ?? 0,
    inventory: mapInventory(profile),
    runHistory: profile.runHistory ?? fallback.runHistory,
    stats: mapStats(profile),
    ranked: mapRanked(profile),
  };
}
