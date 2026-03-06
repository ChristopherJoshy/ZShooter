// All plain-object types for game entities and save data.

// Body / Flow / Spirit — 10-stat upgrade tree (matches backend upgradesSchema).
export interface Upgrades {
  // Body
  vitalRoots: number;   // max 8 — +HP per level
  forestMend: number;   // max 6 — +regen per level
  ironBark:   number;   // max 5 — damage reduction
  // Flow
  petalEdge:  number;   // max 8 — +damage per level
  rapidBloom: number;   // max 6 — fire-rate (fewer frames between shots)
  deepQuiver: number;   // max 5 — +max ammo
  swiftLoad:  number;   // max 5 — shorter reload
  // Spirit
  windStep:   number;   // max 6 — +speed
  gustMaster: number;   // max 5 — ability cooldown reduction
  petalGuard: number;   // max 4 — ability duration bonus
}

export type WeaponId = 'seedShot' | 'petalSpray' | 'thornBurst' | 'lotusBeam'
  | 'pulseBlossom' | 'twinPetal' | 'mistArc' | 'rootCannon';

// ── Gacha / inventory ─────────────────────────────────────────────────────────

export type CosmeticRarity = 'common' | 'rare' | 'epic';

export interface OwnedCosmetic {
  id: string;
  type: 'avatar' | 'frame' | 'banner';
  rarity: CosmeticRarity;
}

// ── Run history ───────────────────────────────────────────────────────────────

export interface RunRecord {
  wave: number;
  score: number;
  kills: number;
  seeds: number;
  date: number;       // Unix ms
  weapon: string;
  ability: string;
}

// ── Lifetime stats ────────────────────────────────────────────────────────────

export interface LifetimeStats {
  totalKills: number;
  totalSeeds: number;
  totalWaves: number;
  highestCombo: number;
  totalPlayTime: number;  // seconds
}

export interface RankedProgress {
  tier: string;
  division: string | null;
  rp: number;
  mmr: number;
  placementMatchesPlayed: number;
  peakRp: number;
  winRate: number;
  matchesThisSeason: number;
  matchesAllTime: number;
  podiumFinishes: number;
  firstPlaceCount: number;
}

export interface StoryProgressState {
  completedChapters: StoryChapterProgress[];
  fullClearDate: number | null;
}

export interface PlayerSettings {
  audioLevel: number;
  sfxEnabled: boolean;
  screenShake: boolean;
  showHudLabels: boolean;
  touchControls: boolean;
  showOpponentNames: boolean;
  reducedMotion: boolean;
}

export interface GameSave {
  seeds: number;
  highScore: number;
  totalRuns: number;
  up: Upgrades;
  weapons: WeaponId[];
  abilities: string[];
  activeWeapon: WeaponId;
  activeAbility: string;
  profile: PlayerProfile;
  // Phase 4
  pityCount: number;           // pulls since last epic
  inventory: OwnedCosmetic[];  // gacha results
  // Phase 5
  runHistory: RunRecord[];     // last 20 runs
  // Phase 6
  stats: LifetimeStats;
  // Phase 11
  storyProgress: StoryChapterProgress[];
  ranked: RankedProgress;
  story: StoryProgressState;
}

export interface PlayerStats {
  maxHp: number;
  speed: number;
  damage: number;
  fireRate: number;
  maxAmmo: number;
  regen: number;
  damageReduction: number;
  abilityCDMult: number;
  abilityDurMult: number;
  reloadTime: number;
  weapon: string;
  ability: string;
}

export interface TrailPoint {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  inv: number;
  trail: TrailPoint[];
  angle: number;
  ammo: number;
  reloading: boolean;
  reloadTimer: number;
  fireTimer: number;
  // petalDash velocity impulse
  _dvx?: number;
  _dvy?: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  col: string;
  dmg: number;
  fromEnemy: boolean;
  pierce: boolean;
  life: number;
  maxLife: number;
  hits: number;
  homing?: boolean;   // mistArc — corrects angle toward nearest enemy each frame
  weaponId?: string;  // for weapon-specific bullet rendering
}

export type EnemyType = 'chaser' | 'shooter' | 'tank' | 'speeder' | 'splitter' | 'boss' | 'stalker';

export interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: EnemyType;
  life: number;
  trail: TrailPoint[];
  shootTimer: number;
  telegraphing: boolean;
  telTimer: number;
  col: string;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  score: number;
  seeds: number;
  phase?: number;
  // stalker-specific
  teleportTimer?: number;
  flickering?: boolean;
  flickerTimer?: number;
  label?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  col: string;
  life: number;
  maxLife: number;
  sz: number;
  isText?: boolean;
  isPetal?: boolean;
  text?: string;
  rot?: number;
  rotV?: number;
}

export interface SeedDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  pulse: number;
  sz: number;
}

export interface Powerup {
  x: number;
  y: number;
  type: 'health' | 'ammo';
  col: string;
  r: number;
  life: number;
  pulse: number;
}

export interface BgPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotV: number;
  sz: number;
  a: number;
  col: string;
  sw: number;
}

export interface ShakeState {
  x: number;
  y: number;
  m: number;
}

export interface WaveCfg {
  count: number;
  types: EnemyType[];
}

export type GameState = 'garden' | 'mode-select' | 'playing' | 'story' | 'results';

export type StoryDifficulty = 'calm' | 'balanced' | 'tempest';

export interface StoryChapterProgress {
  chapterId: number;
  difficulty: StoryDifficulty;
  completedAt: number;  // Unix ms
}

// ── Profile cosmetics ──────────────────────────────────────────────────────────

export type AvatarId =
  | 'sprout' | 'bloom' | 'thorn' | 'lotus' | 'mist' | 'root'
  | 'petal' | 'blossom' | 'storm';

export type FrameId =
  | 'none' | 'gold' | 'silver' | 'nature' | 'shadow' | 'sakura';

export type BannerId =
  | 'forest' | 'dusk' | 'frost' | 'ember' | 'void' | 'bloom';

export interface PlayerProfile {
  avatar: AvatarId;
  frame: FrameId;
  banner: BannerId;
  // which cosmetics are unlocked
  unlockedAvatars: AvatarId[];
  unlockedFrames: FrameId[];
  unlockedBanners: BannerId[];
}

// Full mutable game state passed around between update/render functions.
export interface GameRunState {
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  seedDrops: SeedDrop[];
  powerups: Powerup[];
  bgPetals: BgPetal[];

  score: number;
  kills: number;
  runSeeds: number;
  wave: number;
  combo: number;
  comboTimer: number;
  shake: ShakeState;

  waveLeft: number;
  waveSpawned: number;
  waveTotal: number;
  waveTransTimer: number;
  waveTrans: boolean;
  spawnTimer: number;
  spawnInterval: number;

  mouseX: number;
  mouseY: number;
  keys: Record<string, boolean>;
  justPressed: Record<string, boolean>;
  autoFire: boolean;

  abilityCooldown: number;
  abilityActive: boolean;
  abilityTimer: number;
  shieldActive: boolean;

  stats: PlayerStats;
  paused: boolean;

  // Story mode — set when entering a story run; used by beginWave / updEnemies
  waveCfg?: WaveCfg;
  storyChapterId?: number;
  storyDiffMult?: { hp: number; speed: number };
  opponentNames?: string[];
}
