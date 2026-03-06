// Entity factory functions — return plain objects, no classes.
import { PAL, W, H } from './constants';
import { rnd } from './physics';
import type {
  Player, Bullet, Enemy, EnemyType, Powerup, SeedDrop, BgPetal, PlayerStats,
} from './types';

export function makePlayer(stats: PlayerStats): Player {
  return {
    x: W / 2,
    y: H / 2,
    vx: 0,
    vy: 0,
    r: 10, // scaled down from 14
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    speed: stats.speed,
    inv: 0,
    trail: [],
    angle: 0,
    ammo: stats.maxAmmo,
    reloading: false,
    reloadTimer: 0,
    fireTimer: 0,
  };
}

export function makeBullet(
  x: number, y: number, ang: number, spd: number,
  r: number, col: string, dmg: number, fromEnemy: boolean, pierce: boolean,
  weaponId?: string
): Bullet {
  return {
    x, y,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    r, col, dmg, fromEnemy, pierce,
    life: 0,
    maxLife: fromEnemy ? 70 : 62,
    hits: 0,
    weaponId,
  };
}

export function makeEnemy(type: EnemyType, x: number, y: number, waveN: number): Enemy {
  const sc = 1 + Math.max(0, waveN - 1) * 0.13;
  const e: Enemy = {
    x, y, vx: 0, vy: 0, type, life: 0, trail: [],
    shootTimer: 0, telegraphing: false, telTimer: 0,
    col: PAL.E[type as keyof typeof PAL.E] ?? '#888',
    r: 10, hp: 0, maxHp: 0, speed: 0, score: 0, seeds: 0,
  };
  if (type === 'chaser')   { e.r = 9;   e.hp = e.maxHp = Math.ceil(32 * sc);  e.speed = 1.95 + waveN * 0.03;  e.score = 60;  e.seeds = 1; }
  if (type === 'shooter')  { e.r = 10;  e.hp = e.maxHp = Math.ceil(48 * sc);  e.speed = 0.98 + waveN * 0.02; e.score = 100; e.seeds = 2; e.shootTimer = 90; }
  if (type === 'tank')     { e.r = 17;  e.hp = e.maxHp = Math.ceil(120 * sc); e.speed = 0.78 + waveN * 0.015; e.score = 200; e.seeds = 4; }
  if (type === 'speeder')  { e.r = 7;   e.hp = e.maxHp = Math.ceil(20 * sc);  e.speed = 3.9 + waveN * 0.04;  e.score = 80;  e.seeds = 1; }
  if (type === 'splitter') { e.r = 12;  e.hp = e.maxHp = Math.ceil(50 * sc);  e.speed = 1.43 + waveN * 0.02;  e.score = 130; e.seeds = 2; }
  if (type === 'boss')     { e.r = 26;  e.hp = e.maxHp = Math.ceil(450 * sc); e.speed = 1.17 + waveN * 0.02;  e.score = 800; e.seeds = 15; e.shootTimer = 55; e.phase = 0; }
  // Stalker: teleports every ~4 seconds with a flicker telegraph; medium HP, fast
  if (type === 'stalker')  {
    e.r = 10;
    e.hp = e.maxHp = Math.ceil(60 * sc);
    e.speed = 2.86 + waveN * 0.03;
    e.score = 150;
    e.seeds = 3;
    e.teleportTimer = 240; // 4s at 60fps
    e.flickering = false;
    e.flickerTimer = 0;
  }
  return e;
}

export function spawnAtEdge(type: EnemyType, waveN: number): Enemy {
  const s = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (s === 0) { x = rnd(0, W); y = -50; }
  else if (s === 1) { x = W + 50; y = rnd(0, H); }
  else if (s === 2) { x = rnd(0, W); y = H + 50; }
  else { x = -50; y = rnd(0, H); }
  return makeEnemy(type, x, y, waveN);
}

export function makePowerup(x: number, y: number): Powerup {
  const t = Math.random() < 0.5 ? 'health' : 'ammo';
  return { x, y, type: t, col: t === 'health' ? PAL.health : PAL.W.seedShot, r: 12, life: 280, pulse: 0 };
}

export function makeSeedDrops(x: number, y: number, count: number): SeedDrop[] {
  const drops: SeedDrop[] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd(0, Math.PI * 2);
    const sp = rnd(0.8, 2.5);
    drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rnd(0.5, 1.5), life: 0, maxLife: 500, pulse: rnd(0, Math.PI * 2), sz: 5 });
  }
  return drops;
}

export function newBgPetal(): BgPetal {
  return {
    x: rnd(0, W), y: rnd(0, H),
    vx: rnd(-0.3, 0.3), vy: rnd(0.2, 0.5),
    rot: rnd(0, Math.PI * 2), rotV: rnd(-0.02, 0.02),
    sz: rnd(2.5, 5), a: rnd(0.2, 0.45),
    col: Math.random() < 0.6 ? PAL.petal : '#f4d0a0',
    sw: rnd(0, Math.PI * 2),
  };
}
