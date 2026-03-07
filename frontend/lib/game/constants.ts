import type { AvatarId, FrameId, BannerId, CosmeticRarity } from './types.js';

// ── Gacha pull items ───────────────────────────────────────────────────────────

export interface GachaItem {
  id: string;
  type: 'avatar' | 'frame' | 'banner';
  rarity: CosmeticRarity;
  name: string;
  /** weight out of 1000 for weighted random draw */
  weight: number;
}

export const GACHA_ITEMS: GachaItem[] = [
  // Common avatars (weight 120 each)
  { id: 'bloom',   type: 'avatar', rarity: 'common', name: 'Bloom',   weight: 120 },
  { id: 'thorn',   type: 'avatar', rarity: 'common', name: 'Thorn',   weight: 120 },
  // Rare avatars (weight 50 each)
  { id: 'lotus',   type: 'avatar', rarity: 'rare',   name: 'Lotus',   weight: 50 },
  { id: 'mist',    type: 'avatar', rarity: 'rare',   name: 'Mist',    weight: 50 },
  { id: 'root',    type: 'avatar', rarity: 'rare',   name: 'Root',    weight: 50 },
  // Epic avatars (weight 15 each)
  { id: 'petal',   type: 'avatar', rarity: 'epic',   name: 'Petal',   weight: 15 },
  { id: 'blossom', type: 'avatar', rarity: 'epic',   name: 'Blossom', weight: 15 },
  { id: 'storm',   type: 'avatar', rarity: 'epic',   name: 'Storm',   weight: 15 },
  // Common frames (weight 90 each)
  { id: 'silver',  type: 'frame',  rarity: 'common', name: 'Silver',  weight: 90 },
  { id: 'nature',  type: 'frame',  rarity: 'common', name: 'Nature',  weight: 90 },
  // Rare frames (weight 45 each)
  { id: 'gold',    type: 'frame',  rarity: 'rare',   name: 'Gold',    weight: 45 },
  { id: 'shadow',  type: 'frame',  rarity: 'rare',   name: 'Shadow',  weight: 45 },
  // Epic frame (weight 15)
  { id: 'sakura',  type: 'frame',  rarity: 'epic',   name: 'Sakura',  weight: 15 },
  // Common banners (weight 90 each)
  { id: 'dusk',    type: 'banner', rarity: 'common', name: 'Dusk',    weight: 90 },
  { id: 'frost',   type: 'banner', rarity: 'common', name: 'Frost',   weight: 90 },
  // Rare banners (weight 45 each)
  { id: 'ember',   type: 'banner', rarity: 'rare',   name: 'Ember',   weight: 45 },
  { id: 'void',    type: 'banner', rarity: 'rare',   name: 'Void',    weight: 45 },
  // Epic banner (weight 15)
  { id: 'bloom_b', type: 'banner', rarity: 'epic',   name: 'Bloom Banner', weight: 15 },
];

// Total weight = 120+120+50+50+50+15+15+15+90+90+45+45+15+90+90+45+45+15 = 960

/** Draw N items from the gacha pool with pity handling.
 *  pityCount — consecutive non-epic pulls (before this draw).
 *  Returns { items, newPityCount }.
 */
export function gachaDraw(n: number, pityCount: number): { items: GachaItem[]; newPityCount: number } {
  const results: GachaItem[] = [];
  let pity = pityCount;

  for (let i = 0; i < n; i++) {
    pity++;
    let pool = GACHA_ITEMS;
    // Pity guarantee: epic at 50 pulls
    if (pity >= 50) {
      pool = GACHA_ITEMS.filter((x) => x.rarity === 'epic');
      pity = 0;
    }
    const totalWeight = pool.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen = pool[pool.length - 1];
    for (const item of pool) {
      r -= item.weight;
      if (r <= 0) { chosen = item; break; }
    }
    // If we drew an epic, reset pity
    if (chosen.rarity === 'epic') pity = 0;
    results.push(chosen);
  }
  return { items: results, newPityCount: pity };
}

// Canvas dimensions — 1050×700 is the original 900×600 scaled up ~16%.
export const W = 1050;
export const H = 700;

// Color palette — the authoritative source for all game colors.
export const PAL = {
  bg: '#f7f2ea',
  bgDeep: '#ede5d5',
  grid: 'rgba(180,155,130,0.065)',
  border: 'rgba(196,149,106,0.25)',
  player: '#7aab8a',
  seed: '#d4a030',
  petal: '#f0b8c0',
  combo: '#c4956a',
  health: '#e8a598',
  muted: '#b0a090',
  E: {
    chaser:  '#d4826a',
    shooter: '#a07ab4',
    tank:    '#c49060',
    speeder: '#6aabb4',
    splitter:'#b4906a',
    boss:    '#c46a6a',
    stalker: '#7a7aaa',
  },
  W: {
    seedShot:     '#7aab8a',
    petalSpray:   '#e89090',
    thornBurst:   '#b49060',
    lotusBeam:    '#9070c4',
    pulseBlossom: '#6090d4',
    twinPetal:    '#d490b4',
    mistArc:      '#70b4aa',
    rootCannon:   '#8a7060',
    multiShoot:   '#c4a030',
  },
} as const;

export const SAVE_KEY = 'zenflow_v4';
export const COMBO_DUR = 140;
export const RELOAD_TIME = 130; // was 88 — longer reload adds more tension

export const ABIL_CD: Record<string, number> = {
  petalDash:    150,  // was 180 — slightly snappier
  bloomShield:  420,  // was 480 — more usable
  blossomPulse: 240,  // was 300 — pulse is more fun when available more often
  thornVolley:  200,  // new ability
  none: 0,
};

export const ABIL_DUR: Record<string, number> = {
  petalDash:    18,   // was 14 — dash covers more distance
  bloomShield:  150,  // was 120 — shield lasts long enough to feel safe
  blossomPulse: 22,   // was 18
  thornVolley:  0,    // instant
};

// ── Stat definitions — Body / Flow / Spirit ───────────────────────────────────
// val() is the display value for the upgrade screen; game logic uses getStats().

export const STAT_DEFS = [
  // Body
  { id: 'vitalRoots', group: 'Body',   icon: 'statVitalRoots',  name: 'Vital Roots',  unit: '+15 HP',     max: 8, costs: [12, 24, 42, 68, 105, 155, 220, 300], val: (lvl: number) => 80 + lvl * 15 },
  { id: 'forestMend', group: 'Body',   icon: 'statForestMend',  name: 'Forest Mend',  unit: '+regen',     max: 6, costs: [30, 65, 110, 170, 250, 360],          val: (lvl: number) => lvl === 0 ? 'Off' : '+' + (lvl * 0.006).toFixed(3) + '/f' },
  { id: 'ironBark',   group: 'Body',   icon: 'statIronBark',    name: 'Iron Bark',    unit: '-dmg taken', max: 5, costs: [40, 90, 160, 250, 375],               val: (lvl: number) => lvl === 0 ? 'Off' : '-' + (lvl * 8) + '%' },
  // Flow
  { id: 'petalEdge',  group: 'Flow',   icon: 'statPetalEdge',   name: 'Petal Edge',   unit: '+6 dmg',     max: 8, costs: [15, 30, 55, 90, 135, 195, 270, 370],  val: (lvl: number) => 18 + lvl * 6 },
  { id: 'rapidBloom', group: 'Flow',   icon: 'statRapidBloom',  name: 'Rapid Bloom',  unit: 'faster',     max: 6, costs: [20, 45, 85, 140, 210, 310],            val: (lvl: number) => Math.max(6, 14 - lvl * 1.3).toFixed(1) + 'fr' },
  { id: 'deepQuiver', group: 'Flow',   icon: 'statDeepQuiver',  name: 'Deep Quiver',  unit: '+3 ammo',    max: 5, costs: [25, 60, 110, 175, 265],               val: (lvl: number) => 10 + lvl * 3 },
  { id: 'swiftLoad',  group: 'Flow',   icon: 'statSwiftLoad',   name: 'Swift Load',   unit: '-reload',    max: 5, costs: [25, 60, 110, 175, 265],               val: (lvl: number) => Math.max(60, 130 - lvl * 14) + 'fr' },
  // Spirit
  { id: 'windStep',   group: 'Spirit', icon: 'statWindStep',    name: 'Wind Step',    unit: '+0.25 spd',  max: 6, costs: [20, 45, 85, 140, 210, 310],            val: (lvl: number) => (3.64 + lvl * 0.25).toFixed(2) },
  { id: 'gustMaster', group: 'Spirit', icon: 'statGustMaster',  name: 'Gust Master',  unit: '-CD',        max: 5, costs: [45, 100, 175, 275, 410],              val: (lvl: number) => lvl === 0 ? 'Off' : '-' + (lvl * 8) + '% CD' },
  { id: 'petalGuard', group: 'Spirit', icon: 'statPetalGuard',  name: 'Petal Guard',  unit: '+abil dur',  max: 4, costs: [60, 140, 250, 400],                   val: (lvl: number) => lvl === 0 ? 'Off' : '+' + (lvl * 12) + '% dur' },
] as const;

export const WEAPON_DEFS = [
  { id: 'seedShot',     icon: 'weaponSeedShot',     name: 'Seed Shot',      desc: 'Accurate single shots. Consistent in all situations.',                      stats: '22 dmg · 14fr · single',      cost: 0 },
  { id: 'petalSpray',   icon: 'weaponPetalSpray',   name: 'Petal Spray',    desc: 'Three petals fan in a spread. Great wide coverage.',                        stats: '13 dmg×3 · 10fr · spread',    cost: 80 },
  { id: 'thornBurst',   icon: 'weaponThornBurst',   name: 'Thorn Burst',    desc: 'Shotgun burst of thorns. Lethal up close.',                                 stats: '8 dmg×5 · 22fr · scatter',    cost: 220 },
  { id: 'lotusBeam',    icon: 'weaponLotusBeam',    name: 'Lotus Beam',     desc: 'Slow piercing beam that passes through all enemies.',                        stats: '38 dmg · 20fr · pierce',      cost: 480 },
  { id: 'pulseBlossom', icon: 'weaponPulseBlossom', name: 'Pulse Blossom',  desc: 'Rapid autofire blossom rounds. High DPS, low per-shot.',                    stats: '10 dmg · 4fr · auto',         cost: 360 },
  { id: 'twinPetal',    icon: 'weaponTwinPetal',    name: 'Twin Petal',     desc: 'Fires two parallel petals side by side.',                                   stats: '16 dmg×2 · 11fr · dual',      cost: 560 },
  { id: 'mistArc',      icon: 'weaponMistArc',      name: 'Mist Arc',       desc: 'Homing mist orbs that curve toward the nearest enemy.',                     stats: '20 dmg · 14fr · homing',      cost: 680 },
  { id: 'rootCannon',   icon: 'weaponRootCannon',   name: 'Root Cannon',    desc: 'Slow heavy root shells. Massive damage, slow fire rate.',                   stats: '95 dmg · 34fr · heavy',       cost: 900 },
  { id: 'multiShoot',   icon: 'weaponMultiShoot',   name: 'Multi Shoot',    desc: 'Fires 5 bullets in a tight fan simultaneously. Overwhelming suppression.',  stats: '11 dmg×5 · 18fr · fan',       cost: 760 },
] as const;

export const ABILITY_DEFS = [
  { id: 'none',          icon: 'abilityNone',         name: 'None',           desc: 'Pure fundamentals. No active skill.',                                          stats: '',                           cost: 0 },
  { id: 'petalDash',     icon: 'abilityPetalDash',    name: 'Petal Dash',     desc: 'Dash in move direction, invincible during dash. 2.5s cooldown.',               stats: 'Invincible · 2.5s CD',        cost: 110 },
  { id: 'bloomShield',   icon: 'abilityBloomShield',  name: 'Bloom Shield',   desc: 'Aura absorbs all damage for 2.5 seconds and reflects bullets. 7s cooldown.',   stats: '2.5s shield · 7s CD',         cost: 320 },
  { id: 'blossomPulse',  icon: 'abilityBlossomPulse', name: 'Blossom Pulse',  desc: 'Energy burst damages all nearby foes and knocks them back. 4s cooldown.',      stats: 'AoE+knockback · 4s CD',       cost: 420 },
  { id: 'thornVolley',   icon: 'abilityThornVolley',  name: 'Thorn Volley',   desc: 'Unleash 12 thorns in all directions instantly. 3.3s cooldown.',               stats: '12-way burst · 3.3s CD',      cost: 560 },
] as const;

// ── Profile cosmetics ──────────────────────────────────────────────────────────

export interface AvatarDef {
  id: AvatarId;
  name: string;
  /** CSS canvas draw key — used by the avatar renderer */
  shape: 'sprout' | 'bloom' | 'thorn' | 'lotus' | 'mist' | 'root' | 'petal' | 'blossom' | 'storm';
  color: string;
  accent: string;
  unlockScore: number; // highScore required to unlock (0 = default)
}

export interface FrameDef {
  id: FrameId;
  name: string;
  borderColor: string;
  glowColor: string;
  unlockScore: number;
}

export interface BannerDef {
  id: BannerId;
  name: string;
  bg: string;       // CSS gradient or color string
  accent: string;
  unlockScore: number;
}

export const AVATAR_DEFS: AvatarDef[] = [
  { id: 'sprout',   name: 'Sprout',   shape: 'sprout',   color: '#7aab8a', accent: '#5a9a6a', unlockScore: 0 },
  { id: 'bloom',    name: 'Bloom',    shape: 'bloom',    color: '#e89090', accent: '#d07070', unlockScore: 500 },
  { id: 'thorn',    name: 'Thorn',    shape: 'thorn',    color: '#b49060', accent: '#907040', unlockScore: 1500 },
  { id: 'lotus',    name: 'Lotus',    shape: 'lotus',    color: '#9070c4', accent: '#7050aa', unlockScore: 3000 },
  { id: 'mist',     name: 'Mist',     shape: 'mist',     color: '#70b4aa', accent: '#50948a', unlockScore: 5000 },
  { id: 'root',     name: 'Root',     shape: 'root',     color: '#8a7060', accent: '#6a5040', unlockScore: 8000 },
  { id: 'petal',    name: 'Petal',    shape: 'petal',    color: '#d490b4', accent: '#b47094', unlockScore: 12000 },
  { id: 'blossom',  name: 'Blossom',  shape: 'blossom',  color: '#c4956a', accent: '#a47550', unlockScore: 18000 },
  { id: 'storm',    name: 'Storm',    shape: 'storm',    color: '#7a7aaa', accent: '#5a5a8a', unlockScore: 25000 },
];

export const FRAME_DEFS: FrameDef[] = [
  { id: 'none',   name: 'None',   borderColor: 'rgba(196,149,106,.25)', glowColor: 'transparent',        unlockScore: 0 },
  { id: 'silver', name: 'Silver', borderColor: '#b8b8c8',               glowColor: 'rgba(184,184,200,.4)', unlockScore: 1000 },
  { id: 'gold',   name: 'Gold',   borderColor: '#c4956a',               glowColor: 'rgba(196,149,106,.5)', unlockScore: 3000 },
  { id: 'nature', name: 'Nature', borderColor: '#7aab8a',               glowColor: 'rgba(122,171,138,.4)', unlockScore: 5000 },
  { id: 'shadow', name: 'Shadow', borderColor: '#5a5a7a',               glowColor: 'rgba(90,90,122,.5)',   unlockScore: 10000 },
  { id: 'sakura', name: 'Sakura', borderColor: '#e890b0',               glowColor: 'rgba(232,144,176,.5)', unlockScore: 20000 },
];

export const BANNER_DEFS: BannerDef[] = [
  { id: 'forest', name: 'Forest', bg: 'linear-gradient(135deg,#2a4a2a,#3a6a4a)',  accent: '#7aab8a', unlockScore: 0 },
  { id: 'dusk',   name: 'Dusk',   bg: 'linear-gradient(135deg,#3a2a1a,#5a3a2a)',  accent: '#c4956a', unlockScore: 500 },
  { id: 'frost',  name: 'Frost',  bg: 'linear-gradient(135deg,#1a2a3a,#2a4a5a)',  accent: '#7ab4c4', unlockScore: 2000 },
  { id: 'ember',  name: 'Ember',  bg: 'linear-gradient(135deg,#3a1a1a,#6a2a2a)',  accent: '#e87070', unlockScore: 5000 },
  { id: 'void',   name: 'Void',   bg: 'linear-gradient(135deg,#0a0a1a,#1a1a2a)',  accent: '#7070aa', unlockScore: 10000 },
  { id: 'bloom',  name: 'Bloom',  bg: 'linear-gradient(135deg,#3a1a2a,#5a2a4a)',  accent: '#d490b4', unlockScore: 18000 },
];

// ── Rank tiers (based on highScore) ───────────────────────────────────────────

export interface RankTier {
  label: string;
  minScore: number;
  color: string;
}

export const RANK_TIERS: RankTier[] = [
  { label: 'Seedling',    minScore: 0,     color: '#9a8a7a' },
  { label: 'Sprout',      minScore: 500,   color: '#7aab8a' },
  { label: 'Bloom',       minScore: 2000,  color: '#e89090' },
  { label: 'Thorn',       minScore: 5000,  color: '#b49060' },
  { label: 'Lotus',       minScore: 10000, color: '#9070c4' },
  { label: 'Storm',       minScore: 20000, color: '#7a7aaa' },
  { label: 'Blossom',     minScore: 35000, color: '#c4956a' },
];

export function getRankTier(highScore: number): RankTier {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (highScore >= t.minScore) tier = t;
  }
  return tier;
}
