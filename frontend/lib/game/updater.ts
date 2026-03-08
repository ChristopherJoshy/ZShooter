// Game logic update functions — ported 1:1 from zen-striker.html.
import { W, H, PAL, COMBO_DUR, ABIL_DUR } from './constants';
import { clamp, lerp, rnd, lerpDt, expDt } from './physics';
import { makeBullet, spawnAtEdge, makeSeedDrops, makePowerup, makeEnemy } from './entities';
import { sfx } from './audio';
import { getWaveCfg } from './waves';
import type { GameRunState, Player, Enemy, Particle, SeedDrop, WaveCfg } from './types';

// Suppress unused-import lint for types only used in function signatures
type _Particle = Particle;
type _SeedDrop = SeedDrop;

// ── Shake ─────────────────────────────────────────────────────────────────────

export function addShake(state: GameRunState, m: number): void {
  state.shake.m = Math.min(state.shake.m + m, 18);
}

export function updShake(state: GameRunState, dt: number): void {
  if (state.shake.m > 0) {
    state.shake.x = (Math.random() - 0.5) * state.shake.m;
    state.shake.y = (Math.random() - 0.5) * state.shake.m;
    state.shake.m *= Math.pow(0.88, dt);
    if (state.shake.m < 0.5) state.shake.m = 0;
  } else {
    state.shake.x = 0; state.shake.y = 0;
  }
}

// ── Particles ─────────────────────────────────────────────────────────────────

export function spawnParticles(
  state: GameRunState, x: number, y: number, n: number,
  col: string, spd = 3, life = 28, sz = 2.5
): void {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const s = spd * (0.5 + Math.random());
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life, maxLife: life, sz: sz * (0.6 + Math.random() * 0.8) });
  }
}

export function spawnPetalBurst(state: GameRunState, x: number, y: number, n: number, col: string): void {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2); const s = rnd(1, 2.8);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - rnd(0.3, 1),
      col, life: rnd(60, 100), maxLife: 100, sz: rnd(2.5, 4),
      isPetal: true, rot: rnd(0, Math.PI * 2), rotV: rnd(-0.06, 0.06),
    });
  }
}

export function spawnText(state: GameRunState, x: number, y: number, text: string, col: string = PAL.combo, sz = 11): void {
  state.particles.push({ text, x, y, vx: rnd(-0.6, 0.6), vy: -1.4, life: 60, maxLife: 60, col, isText: true, sz });
}

export function spawnSparkBurst(state: GameRunState, x: number, y: number, n: number, col: string): void {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const s = rnd(2, 6);
    const sparkColors = [PAL.spark.yellow, PAL.spark.orange, PAL.spark.white, col];
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      col: sparkColors[Math.floor(Math.random() * sparkColors.length)],
      life: rnd(12, 22),
      maxLife: 22,
      sz: rnd(1, 2.5),
    });
  }
}

export function spawnComboBurst(state: GameRunState, x: number, y: number, combo: number): void {
  const intensity = Math.min(combo, 8);
  const n = 8 + intensity * 3;
  const colors = PAL.burst.combo;
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const s = rnd(3, 5 + intensity * 0.5);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      col: colors[Math.floor(Math.random() * colors.length)],
      life: rnd(20, 35),
      maxLife: 35,
      sz: rnd(2, 3.5),
    });
  }
}

// ── Ability ───────────────────────────────────────────────────────────────────

export function useAbility(state: GameRunState): void {
  const ab = state.stats.ability;
  const cdMult = state.stats.abilityCDMult;
  const durMult = state.stats.abilityDurMult;
  if (ab === 'petalDash') {
    let mx = 0; let my = 0;
    if (state.keys['KeyW'] || state.keys['ArrowUp'])    my -= 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown'])  my += 1;
    if (state.keys['KeyA'] || state.keys['ArrowLeft'])  mx -= 1;
    if (state.keys['KeyD'] || state.keys['ArrowRight']) mx += 1;
    if (!mx && !my) { mx = Math.cos(state.player.angle); my = Math.sin(state.player.angle); }
    const ln = Math.hypot(mx, my) || 1;
    state.player._dvx = mx / ln * 15;
    state.player._dvy = my / ln * 15;
    state.abilityActive = true;
    state.abilityTimer = Math.round(ABIL_DUR.petalDash * durMult);
    state.player.inv = Math.round(ABIL_DUR.petalDash * durMult) + 5;
    sfx('dash');
  } else if (ab === 'bloomShield') {
    state.shieldActive = true;
    state.abilityActive = true;
    state.abilityTimer = Math.round(ABIL_DUR.bloomShield * durMult);
    state.player.inv = Math.round(ABIL_DUR.bloomShield * durMult);
    spawnPetalBurst(state, state.player.x, state.player.y, 20, PAL.W.lotusBeam);
    sfx('shield');
  } else if (ab === 'blossomPulse') {
    const PR = 130;
    state.enemies.forEach((e) => {
      if (Math.hypot(e.x - state.player.x, e.y - state.player.y) < PR + e.r) {
        e.hp -= state.stats.damage * 2;
      }
    });
    spawnPetalBurst(state, state.player.x, state.player.y, 30, PAL.petal);
    spawnParticles(state, state.player.x, state.player.y, 18, PAL.W.thornBurst, 4, 30, 3);
    sfx('pulse');
    addShake(state, 6);
    state.abilityActive = true;
    state.abilityTimer = Math.round(ABIL_DUR.blossomPulse * durMult);
  } else if (ab === 'thornVolley') {
    // 12-way instant burst from player position — one bullet per direction
    const col = PAL.W.thornBurst;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const b = makeBullet(
        state.player.x + Math.cos(ang) * 18,
        state.player.y + Math.sin(ang) * 18,
        ang, 11, 3.5, col, Math.round(state.stats.damage * 1.4), false, false, 'thornBurst'
      );
      b.maxLife = 40;
      state.bullets.push(b);
    }
    spawnPetalBurst(state, state.player.x, state.player.y, 20, col);
    spawnParticles(state, state.player.x, state.player.y, 14, col, 5, 22, 2.5);
    sfx('pulse');
    addShake(state, 5);
    state.abilityActive = true;
    state.abilityTimer = Math.round(ABIL_DUR.thornVolley * durMult);
  }
  // Base CDs from ABIL_CD map, scaled by abilityCDMult
  const BASE_CD: Record<string, number> = { petalDash: 150, bloomShield: 420, blossomPulse: 240, thornVolley: 200, none: 0 };
  state.abilityCooldown = Math.round((BASE_CD[ab] ?? 1) * cdMult);
}

export function updAbility(state: GameRunState, dt: number): void {
  if (state.abilityCooldown > 0) state.abilityCooldown -= dt;
  if (state.abilityActive) {
    state.abilityTimer -= dt;
    if (state.stats.ability === 'petalDash' && state.abilityTimer > 0) {
      state.player.x = clamp(state.player.x + (state.player._dvx ?? 0) * dt, state.player.r, W - state.player.r);
      state.player.y = clamp(state.player.y + (state.player._dvy ?? 0) * dt, state.player.r, H - state.player.r);
      spawnParticles(state, state.player.x, state.player.y, 1, PAL.player, 0.5, 8, 4);
    }
    if (state.abilityTimer <= 0) { state.abilityActive = false; state.shieldActive = false; }
  }
}

// ── Player ────────────────────────────────────────────────────────────────────

function fireBullets(state: GameRunState, p: Player): void {
  const a = p.angle; const { weapon, damage } = state.stats;
  const col = PAL.W[weapon as keyof typeof PAL.W] ?? PAL.player;
  if (weapon === 'seedShot') {
    state.bullets.push(makeBullet(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a + rnd(-0.5, 0.5) * 0.03, 13, 3.5, col, Math.round(damage * 1.1), false, false, weapon));
    spawnParticles(state, p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, 2, col, 1.5, 10, 1.5);
    sfx('shoot');
  } else if (weapon === 'petalSpray') {
    for (let i = -1; i <= 1; i++) state.bullets.push(makeBullet(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, a + i * 0.22 + rnd(-0.5, 0.5) * 0.04, 12, 3, col, Math.round(damage * 0.72), false, false, weapon));
    sfx('shootPetal');
  } else if (weapon === 'thornBurst') {
    for (let j = 0; j < 5; j++) {
      const sp = (j - 2) * 0.18 + rnd(-0.5, 0.5) * 0.06;
      const b = makeBullet(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, a + sp, 11, 2.5, col, Math.round(damage * 0.55), false, false, weapon);
      b.maxLife = 28; state.bullets.push(b);
    }
    sfx('shootThorn');
  } else if (weapon === 'lotusBeam') {
    state.bullets.push(makeBullet(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a + rnd(-0.5, 0.5) * 0.02, 10, 4, col, Math.round(damage * 1.9), false, true, weapon));
    sfx('shootLotus');
  } else if (weapon === 'pulseBlossom') {
    const b = makeBullet(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, a + rnd(-0.5, 0.5) * 0.04, 14, 3, col, Math.round(damage * 0.56), false, false, weapon);
    b.maxLife = 55;
    state.bullets.push(b);
    spawnParticles(state, p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, 1, col, 1.2, 8, 1.5);
    sfx('shootPulse');
  } else if (weapon === 'twinPetal') {
    const px = Math.cos(a + Math.PI / 2); const py = Math.sin(a + Math.PI / 2);
    for (const sign of [-1, 1]) {
      const ox = px * 5 * sign; const oy = py * 5 * sign;
      state.bullets.push(makeBullet(p.x + Math.cos(a) * 16 + ox, p.y + Math.sin(a) * 16 + oy, a + rnd(-0.5, 0.5) * 0.025, 12, 3.5, col, Math.round(damage * 0.78), false, false, weapon));
    }
    sfx('shootTwin');
  } else if (weapon === 'mistArc') {
    const b = makeBullet(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a + rnd(-0.5, 0.5) * 0.12, 9, 4.5, col, Math.round(damage * 1.05), false, false, weapon);
    b.homing = true; b.maxLife = 75;
    state.bullets.push(b);
    sfx('shootMist');
  } else if (weapon === 'rootCannon') {
    const b = makeBullet(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a + rnd(-0.5, 0.5) * 0.015, 6.5, 8, col, Math.round(damage * 5.0), false, false, weapon);
    b.maxLife = 70;
    state.bullets.push(b);
    spawnParticles(state, p.x, p.y, 5, col, 2, 18, 3);
    sfx('shootRoot');
  } else if (weapon === 'multiShoot') {
    // 5 bullets in a tight fan, evenly spread across ±0.32 rad
    for (let k = 0; k < 5; k++) {
      const spread = (k - 2) * 0.16 + rnd(-0.5, 0.5) * 0.03;
      const b = makeBullet(
        p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16,
        a + spread, 12.5, 3, col, Math.round(damage * 0.6), false, false, weapon
      );
      b.maxLife = 52;
      state.bullets.push(b);
    }
    spawnParticles(state, p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, 4, col, 2, 12, 2);
    sfx('shootThorn');
  }
}

// endGame callback — called when player HP reaches 0.
type EndGameFn = (state: GameRunState) => void;

export function updPlayer(state: GameRunState, dt: number, onEndGame: EndGameFn): void {
  const p = state.player;
  let mx = 0; let my = 0;
  if (state.keys['KeyW'] || state.keys['ArrowUp'])    my -= 1;
  if (state.keys['KeyS'] || state.keys['ArrowDown'])  my += 1;
  if (state.keys['KeyA'] || state.keys['ArrowLeft'])  mx -= 1;
  if (state.keys['KeyD'] || state.keys['ArrowRight']) mx += 1;
  const mv = mx || my; const ln = Math.hypot(mx, my) || 1;
  // Player speed scales +2% per wave completed (wave 1 = base, wave 2 = +2%, etc.)
  const effectiveSpeed = p.speed * (1 + (state.wave - 1) * 0.02);
  p.vx = lerpDt(p.vx, mv ? (mx / ln) * effectiveSpeed : 0, 0.22, dt);
  p.vy = lerpDt(p.vy, mv ? (my / ln) * effectiveSpeed : 0, 0.22, dt);
  p.x = clamp(p.x + p.vx * dt, p.r, W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, H - p.r);
  p.angle = Math.atan2(state.mouseY - p.y, state.mouseX - p.x);
  if (p.inv > 0) p.inv -= dt;
  if (state.stats.regen > 0) p.hp = Math.min(p.maxHp, p.hp + state.stats.regen * dt);

  if (state.justPressed['Space'] && state.stats.ability !== 'none' && state.abilityCooldown <= 0) useAbility(state);
  if (state.justPressed['KeyR'] && !p.reloading && p.ammo < state.stats.maxAmmo) {
    p.reloading = true; p.reloadTimer = state.stats.reloadTime; sfx('reload');
  }
  if (p.reloading) { p.reloadTimer -= dt; if (p.reloadTimer <= 0) { p.ammo = state.stats.maxAmmo; p.reloading = false; } }

  if (state.autoFire && !p.reloading) {
    p.fireTimer -= dt;
    if (p.fireTimer <= 0 && p.ammo > 0) {
      fireBullets(state, p);
      p.ammo--;
      p.fireTimer = state.stats.fireRate;
      if (p.ammo === 0) { p.reloading = true; p.reloadTimer = state.stats.reloadTime; sfx('reload'); }
    }
  } else if (!state.autoFire) { p.fireTimer = 0; }

  state.justPressed = {};
}

// ── Kill handling ─────────────────────────────────────────────────────────────

function onKill(state: GameRunState, e: Enemy, idx: number): void {
  state.combo = Math.min(state.combo + 1, 8);
  const pts = e.score * state.combo;
  state.score += pts;
  state.kills++;
  state.comboTimer = COMBO_DUR;
  spawnText(state, e.x, e.y - e.r - 8, '+' + pts, PAL.combo, 11);
  
  // Combo burst effect - more particles at higher combos
  if (state.combo >= 2) {
    spawnComboBurst(state, e.x, e.y, state.combo);
  }

  // Per-enemy kill particles + sfx
  if (e.type === 'chaser') {
    spawnPetalBurst(state, e.x, e.y, 20, e.col);
    spawnParticles(state, e.x, e.y, 12, e.col, 4, 28, 2);
    spawnSparkBurst(state, e.x, e.y, 8, e.col);
    sfx('dieChaser');
    addShake(state, 3);
  } else if (e.type === 'shooter') {
    spawnPetalBurst(state, e.x, e.y, 12, e.col);
    spawnParticles(state, e.x, e.y, 8, e.col, 2.5, 22, 2);
    spawnParticles(state, e.x, e.y, 8, e.col, 6, 14, 1.5); // bullet scatter
    spawnSparkBurst(state, e.x, e.y, 6, e.col);
    sfx('dieShooter');
    addShake(state, 3);
  } else if (e.type === 'tank') {
    spawnPetalBurst(state, e.x, e.y, 6, e.col);
    spawnParticles(state, e.x, e.y, 22, e.col, 1.5, 40, 4.5); // heavy armored crumble
    spawnSparkBurst(state, e.x, e.y, 12, e.col);
    sfx('dieTank');
    addShake(state, 6);
  } else if (e.type === 'speeder') {
    spawnPetalBurst(state, e.x, e.y, 28, e.col);
    spawnParticles(state, e.x, e.y, 16, e.col, 6, 20, 1.5); // firework explosion
    spawnSparkBurst(state, e.x, e.y, 14, e.col);
    sfx('dieSpeeder');
    addShake(state, 3.5);
  } else if (e.type === 'splitter') {
    spawnPetalBurst(state, e.x, e.y, 14, e.col);
    spawnParticles(state, e.x, e.y, 10, e.col, 2.5, 28, 2.5);
    spawnParticles(state, e.x, e.y, 6, e.col, 3.5, 22, 3); // tight split-pulse ring
    spawnSparkBurst(state, e.x, e.y, 8, e.col);
    sfx('dieSplitter');
    addShake(state, 4);
  } else if (e.type === 'stalker') {
    spawnPetalBurst(state, e.x, e.y, 10, e.col);
    spawnParticles(state, e.x, e.y, 8, e.col, 2.5, 30, 2);
    // 4 shadow particles drifting in cardinal directions
    const shadowCol = '#3a3a5a';
    for (let k = 0; k < 4; k++) {
      const ca = (k / 4) * Math.PI * 2;
      state.particles.push({ x: e.x, y: e.y, vx: Math.cos(ca) * 2.5, vy: Math.sin(ca) * 2.5, col: shadowCol, life: 32, maxLife: 32, sz: 2.5 });
    }
    spawnSparkBurst(state, e.x, e.y, 5, PAL.neon.enemy);
    sfx('dieStalker');
    addShake(state, 3.5);
  } else if (e.type === 'boss') {
    spawnPetalBurst(state, e.x, e.y, 60, e.col);
    spawnParticles(state, e.x, e.y, 30, e.col, 5, 50, 3);
    // 12-way radial burst
    spawnParticles(state, e.x, e.y, 12, e.col, 9, 35, 2.5);
    spawnSparkBurst(state, e.x, e.y, 25, e.col);
    spawnText(state, e.x, e.y - e.r - 20, 'DEFEATED', PAL.combo, 16);
    sfx('dieBoss');
    addShake(state, 14);
  } else {
    // fallback for unknown types
    spawnPetalBurst(state, e.x, e.y, 12, e.col);
    spawnParticles(state, e.x, e.y, 7, e.col, 3, 32, 3);
    spawnSparkBurst(state, e.x, e.y, 5, e.col);
    sfx('die');
    addShake(state, 3.5);
  }

  state.seedDrops.push(...makeSeedDrops(e.x, e.y, e.seeds));
  if (Math.random() < 0.22) state.powerups.push(makePowerup(e.x, e.y));
  if (e.type === 'splitter') {
    for (let k = 0; k < 3; k++) {
      const mini = makeEnemy('chaser', e.x + rnd(-20, 20), e.y + rnd(-20, 20), state.wave);
      mini.r = 7; mini.hp = mini.maxHp = Math.ceil(mini.maxHp * 0.45);
      mini.speed *= 1.55; mini.seeds = 1; mini.score = 30;
      state.enemies.push(mini); state.waveLeft++;
    }
  }
  state.enemies.splice(idx, 1);
  state.waveLeft--;
}

// ── Enemies ───────────────────────────────────────────────────────────────────

export function updEnemies(state: GameRunState, dt: number, onEndGame: EndGameFn): void {
  if (state.waveSpawned < state.waveTotal) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const cfg = state.waveCfg;
      if (cfg && state.waveSpawned < cfg.types.length) {
        // Edge blitz: every 3rd enemy at wave 12+ spawns close to the player instead of the edge
        let enemy;
        if (state.wave >= 12 && state.waveSpawned % 3 === 2) {
          const ta = rnd(0, Math.PI * 2);
          const tr = rnd(80, 150);
          const bx = clamp(state.player.x + Math.cos(ta) * tr, 10, W - 10);
          const by = clamp(state.player.y + Math.sin(ta) * tr, 10, H - 10);
          enemy = makeEnemy(cfg.types[state.waveSpawned], bx, by, state.wave);
        } else {
          enemy = spawnAtEdge(cfg.types[state.waveSpawned], state.wave);
        }
        if (state.opponentNames && state.opponentNames.length > 0) {
          enemy.label = state.opponentNames[state.waveSpawned % state.opponentNames.length];
        }
        state.enemies.push(enemy);
        state.waveSpawned++;
        state.spawnTimer = state.spawnInterval;
      }
    }
  }

  // Damage scaling by wave — contact and bullet damage increase with wave number
  const waveDmgMult = 1 + state.wave * 0.09;
  // Boss damage escalates +30% per boss wave (wave 5 = ×1.0, wave 10 = ×1.3, wave 15 = ×1.69, …)
  const bossWaveIndex = Math.floor(state.wave / 5); // 1 at wave 5, 2 at wave 10, …
  const bossDmgMult = Math.pow(1.3, Math.max(0, bossWaveIndex - 1));

  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.life += dt;
    const dx = p.x - e.x; const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Separation from other enemies
    let sx = 0; let sy = 0;
    for (let j2 = 0; j2 < state.enemies.length; j2++) {
      if (j2 === i) continue;
      const o = state.enemies[j2];
      const ex = e.x - o.x; const ey = e.y - o.y; const ed = Math.hypot(ex, ey) || 1;
      const mn = e.r + o.r + 6;
      if (ed < mn) { 
        const push = (mn - ed) * 0.05 * dt;
        sx += ex / ed * push; 
        sy += ey / ed * push; 
      }
    }
    // Separation from player — prevent enemies from sitting inside the player
    const playerGap = p.r + e.r + 4;
    if (dist < playerGap) {
      const pushStr = (playerGap - dist) * 0.12 * dt;
      sx -= (dx / dist) * pushStr;
      sy -= (dy / dist) * pushStr;
    }

    // AI — wave-scaled parameters
    if (e.type === 'chaser') {
      // Chasers weave aggressively, side-to-side intensity grows with wave
      const weave = Math.sin(e.life * 0.13) * (1.4 + state.wave * 0.04);
      e.vx += ((dx / dist) * e.speed * 0.22 + (0 - dy / dist) * weave * e.speed * 0.18) * dt;
      e.vy += ((dy / dist) * e.speed * 0.22 + (dx / dist) * weave * e.speed * 0.18) * dt;
    } else if (e.type === 'tank') {
      // Tanks are relentless but slow, gaining speed below 50% HP
      const sp2 = e.hp < e.maxHp * 0.5 ? e.speed * 1.4 : e.speed;
      e.vx += (dx / dist) * sp2 * 0.18 * dt; e.vy += (dy / dist) * sp2 * 0.18 * dt;
    } else if (e.type === 'splitter') {
      // Splitters lumber forward with slight erratic jitter
      const jitterX = Math.random() < 0.1 ? rnd(-0.5, 0.5) : 0;
      const jitterY = Math.random() < 0.1 ? rnd(-0.5, 0.5) : 0;
      e.vx += (dx / dist + jitterX) * e.speed * 0.18 * dt; 
      e.vy += (dy / dist + jitterY) * e.speed * 0.18 * dt;
    } else if (e.type === 'speeder') {
      // Speeders have wild erratic darting movement — high burst, sharp direction changes
      const dart = Math.max(0.2, Math.sin(e.life * 0.22) * 2.2 + 0.6);
      const sideDart = Math.cos(e.life * 0.18) * 0.5;
      e.vx += ((dx / dist) * e.speed * 0.28 * dart + (0 - dy / dist) * sideDart) * dt;
      e.vy += ((dy / dist) * e.speed * 0.28 * dart + (dx / dist) * sideDart) * dt;
    } else if (e.type === 'shooter') {
      // Shooters orbit at wave-scaled distance, retreat aggressively if player gets close
      const targetDist = Math.max(120, 180 - state.wave * 2);
      const diff = dist - targetDist;
      
      if (dist < 150) {
        // Aggressive retreat + sharp orbit
        e.vx += ((dx / dist) * diff * 0.012 + (0 - dy / dist) * 0.55) * dt;
        e.vy += ((dy / dist) * diff * 0.012 + (dx / dist) * 0.55) * dt;
      } else {
        // Tighter orbit with more speed
        e.vx += ((dx / dist) * diff * 0.006 + (0 - dy / dist) * 0.45) * dt;
        e.vy += ((dy / dist) * diff * 0.006 + (dx / dist) * 0.45) * dt;
      }
    } else if (e.type === 'boss') {
      const ph = e.hp < e.maxHp * 0.4 ? 2 : e.hp < e.maxHp * 0.7 ? 1 : 0;
      e.phase = ph;
      const bsp = e.speed * (1.3 + ph * 0.7);
      e.vx += (dx / dist) * bsp * 0.14 * dt; e.vy += (dy / dist) * bsp * 0.14 * dt;
      if (Math.sin(e.life * 0.028) > 0.25) { 
        e.vx += (0 - dy / dist) * 0.65 * dt; 
        e.vy += (dx / dist) * 0.65 * dt; 
      }
    } else if (e.type === 'stalker') {
      // Stalker: aggressively pursues, teleports with wave-scaled frequency
      e.vx += (dx / dist) * e.speed * 0.22 * dt; e.vy += (dy / dist) * e.speed * 0.22 * dt;
      if (e.flickering) {
        e.flickerTimer = (e.flickerTimer ?? 0) - dt;
        if ((e.flickerTimer ?? 0) <= 0) {
          // Shadow particles at OLD position before teleport
          sfx('stalkerTeleport');
          spawnParticles(state, e.x, e.y, 6, '#3a3a5a', 2.5, 24, 2.5);
          // Teleport very close to the player (40–110px away)
          const ta = rnd(0, Math.PI * 2);
          const tr = rnd(40, 110);
          e.x = Math.max(e.r + 5, Math.min(W - e.r - 5, p.x + Math.cos(ta) * tr));
          e.y = Math.max(e.r + 5, Math.min(H - e.r - 5, p.y + Math.sin(ta) * tr));
          e.vx = 0; e.vy = 0;
          e.flickering = false;
          // Teleport timer shrinks with wave number
          e.teleportTimer = Math.max(60, 120 - state.wave * 3) + rnd(0, 30);
        }
      } else {
        e.teleportTimer = (e.teleportTimer ?? 150) - dt;
        if ((e.teleportTimer ?? 0) <= 0) {
          e.flickering = true;
          e.flickerTimer = 22; // ~0.37s flicker before teleport
        }
      }
    }
    const ms = e.speed * 1.25; const sv = Math.hypot(e.vx, e.vy);
    if (sv > ms) { e.vx = e.vx / sv * ms; e.vy = e.vy / sv * ms; }
    e.vx = expDt(e.vx + sx, 0.9, dt); 
    e.vy = expDt(e.vy + sy, 0.9, dt);
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.type === 'speeder') { e.trail.push({ x: e.x, y: e.y }); if (e.trail.length > 8) e.trail.shift(); }

    // Shooting with telegraph — boss shoot interval tightens with wave
    if (e.type === 'shooter' || e.type === 'boss') {
      if (e.telegraphing) {
        e.telTimer -= dt;
        if (e.telTimer <= 0) {
          e.telegraphing = false;
          const ang = Math.atan2(dy, dx);
          if (e.type === 'boss') {
            const ph = e.phase ?? 0;
            const n = ph >= 2 ? 12 : ph === 1 ? 9 : 6;
            for (let k = 0; k < n; k++) state.bullets.push(makeBullet(e.x, e.y, (k / n) * Math.PI * 2, 5.5 + ph * 0.8, 4.5, e.col, Math.round((12 + ph * 4) * waveDmgMult * bossDmgMult), true, false));
            // Extra aimed shots in phase 1+
            if (ph >= 1) state.bullets.push(makeBullet(e.x, e.y, ang, 9, 4, e.col, Math.round(18 * waveDmgMult * bossDmgMult), true, false));
            if (ph >= 2) state.bullets.push(makeBullet(e.x, e.y, ang + 0.28, 8, 4, e.col, Math.round(16 * waveDmgMult * bossDmgMult), true, false));
            if (ph >= 2) state.bullets.push(makeBullet(e.x, e.y, ang - 0.28, 8, 4, e.col, Math.round(16 * waveDmgMult * bossDmgMult), true, false));
            // Boss shoot interval tightens with wave
            e.shootTimer = ph >= 2 ? Math.max(16, 28 - state.wave) : ph === 1 ? Math.max(22, 40 - state.wave) : Math.max(30, 52 - state.wave * 1.5);
          } else {
            // Shooter fires a burst of 2 bullets
            state.bullets.push(makeBullet(e.x, e.y, ang + rnd(-0.5, 0.5) * 0.18, 5.5, 3.5, e.col, Math.round(11 * waveDmgMult), true, false));
            state.bullets.push(makeBullet(e.x, e.y, ang + rnd(-0.5, 0.5) * 0.28, 4.5, 3.5, e.col, Math.round(9 * waveDmgMult), true, false));
            e.shootTimer = 55 + rnd(0, 20);
          }
        }
      } else {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) { e.telegraphing = true; e.telTimer = 20; }
      }
    }

    // Contact damage + knockback — scaled by wave
    if (dist < p.r + e.r + 2 && p.inv <= 0 && !state.shieldActive) {
      const baseContactDmg = e.type === 'boss' ? 26 : e.type === 'tank' ? 20 : 14;
      const scaledContactDmg = Math.round(baseContactDmg * waveDmgMult * (e.type === 'boss' ? bossDmgMult : 1));
      const cdmg = Math.round(scaledContactDmg * state.stats.damageReduction);
      p.hp -= cdmg; p.inv = 60;
      // Knockback: push enemy away from player
      const knockStr = e.type === 'boss' ? 4 : e.type === 'tank' ? 6 : 10;
      e.vx -= (dx / dist) * knockStr;
      e.vy -= (dy / dist) * knockStr;
      addShake(state, e.type === 'boss' ? 16 : 10);
      spawnParticles(state, p.x, p.y, 12, PAL.health, 4, 25, 3);
      spawnSparkBurst(state, p.x, p.y, 6, PAL.neon.enemy);
      sfx(e.type === 'tank' || e.type === 'boss' ? 'hurtHeavy' : 'hurt');
      if (p.hp <= 0) { p.hp = 0; onEndGame(state); return; }
    }

    // Bullet hits
    let killed = false;
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const b = state.bullets[j];
      if (b.fromEnemy) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
        e.hp -= b.dmg;
        // Hit sparks on every bullet hit
        spawnSparkBurst(state, b.x, b.y, 4, b.col);
        // Per-enemy hit particles
        if (e.type === 'chaser') {
          spawnParticles(state, b.x, b.y, 5, e.col, 2.5, 14, 2);
        } else if (e.type === 'shooter') {
          spawnParticles(state, b.x, b.y, 3, e.col, 2, 14, 2);
        } else if (e.type === 'tank') {
          spawnParticles(state, b.x, b.y, 7, e.col, 1.2, 18, 3.5); // slow heavy chunks
        } else if (e.type === 'speeder') {
          spawnParticles(state, b.x, b.y, 8, e.col, 4.5, 12, 1.5); // fast sparks
        } else if (e.type === 'splitter') {
          spawnParticles(state, b.x, b.y, 5, e.col, 2, 14, 2.5);
        } else if (e.type === 'stalker') {
          spawnParticles(state, b.x, b.y, 4, e.col, 2, 14, 2);
          spawnParticles(state, b.x, b.y, 2, '#3a3a5a', 1.5, 12, 2); // shadow chips
        } else if (e.type === 'boss') {
          spawnParticles(state, b.x, b.y, 9, e.col, 2.5, 18, 3);
        } else {
          spawnParticles(state, b.x, b.y, 4, e.col, 1.8, 14, 2);
        }
        sfx('hit'); addShake(state, 1.2);
        if (!b.pierce) state.bullets.splice(j, 1);
        else { b.hits++; if (b.hits >= 4) state.bullets.splice(j, 1); }
        if (e.hp <= 0) { onKill(state, e, i); killed = true; break; }
      }
    }
    if (killed) continue;
  }

  // Wave complete
  if (!state.waveTrans && state.waveLeft <= 0 && state.waveSpawned >= state.waveTotal && state.enemies.length === 0) {
    state.waveTrans = true; state.waveTransTimer = 120;
    spawnText(state, W / 2, H / 2, 'Harmony Restored', PAL.player, 14);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
    sfx('waveComplete');
  }
  if (state.waveTrans) {
    state.waveTransTimer -= dt;
    if (state.waveTransTimer <= 0) { state.waveTrans = false; beginWave(state, state.wave + 1); }
  }
  if (state.waveAnnTimer > 0) state.waveAnnTimer -= dt;
}

// ── Wave ──────────────────────────────────────────────────────────────────────

export function beginWave(state: GameRunState, w: number, cfgOverride?: WaveCfg): void {
  state.wave = w;
  const cfg: WaveCfg = cfgOverride ?? getWaveCfg(w);
  state.waveCfg = cfg;
  state.waveTotal = cfg.count;
  state.waveLeft = cfg.count;
  state.waveSpawned = 0;
  state.spawnTimer = 35;
  state.spawnInterval = Math.max(8, 55 - w * 4);
  state.waveAnnTimer = 180;
}

// ── Bullets ───────────────────────────────────────────────────────────────────

export function updBullets(state: GameRunState, dt: number, onEndGame: EndGameFn): void {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];

    // mistArc homing — 25% angle correction per frame toward nearest enemy
    if (b.homing && !b.fromEnemy) {
      let nearest: { dx: number; dy: number; dist: number } | null = null;
      for (const e of state.enemies) {
        const edx = e.x - b.x; const edy = e.y - b.y;
        const ed = Math.hypot(edx, edy);
        if (!nearest || ed < nearest.dist) nearest = { dx: edx, dy: edy, dist: ed };
      }
      if (nearest && nearest.dist < 280) {
        const spd = Math.hypot(b.vx, b.vy) || 9;
        const tx = nearest.dx / nearest.dist * spd;
        const ty = nearest.dy / nearest.dist * spd;
        b.vx = lerpDt(b.vx, tx, 0.25, dt);
        b.vy = lerpDt(b.vy, ty, 0.25, dt);
        // Re-normalize to original speed
        const newSpd = Math.hypot(b.vx, b.vy) || 1;
        b.vx = b.vx / newSpd * spd;
        b.vy = b.vy / newSpd * spd;
      }
    }

    b.x += b.vx * dt; b.y += b.vy * dt; b.life += dt;
    
    // Bullet trail particles (every few frames)
    if (!b.fromEnemy && Math.random() < 0.35) {
      const trailCol = PAL.trail[b.weaponId as keyof typeof PAL.trail] ?? b.col;
      state.particles.push({
        x: b.x - b.vx * 0.3 + rnd(-1, 1),
        y: b.y - b.vy * 0.3 + rnd(-1, 1),
        vx: rnd(-0.3, 0.3),
        vy: rnd(-0.3, 0.3),
        col: trailCol,
        life: rnd(8, 14),
        maxLife: 14,
        sz: rnd(1, 2),
      });
    }
    
    if (b.x < -25 || b.x > W + 25 || b.y < -25 || b.y > H + 25 || b.life > b.maxLife) { state.bullets.splice(i, 1); continue; }
    if (b.fromEnemy && p.inv <= 0 && !state.shieldActive) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r) {
        const dmg = Math.round(b.dmg * state.stats.damageReduction);
        p.hp -= dmg; p.inv = 48;
        addShake(state, 4);
        spawnParticles(state, b.x, b.y, 5, PAL.health, 2.5, 16, 2);
        sfx('hurt');
        state.bullets.splice(i, 1);
        if (p.hp <= 0) { p.hp = 0; onEndGame(state); }
      }
    }
  }
}

// ── Particles ─────────────────────────────────────────────────────────────────

export function updParticles(state: GameRunState, dt: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (!p.isText) p.vy += 0.035 * dt;
    p.vx = expDt(p.vx, 0.968, dt); 
    p.vy = expDt(p.vy, 0.968, dt);
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

// ── Seeds ─────────────────────────────────────────────────────────────────────

export function updSeeds(state: GameRunState, dt: number, onSeedCollect: () => void): void {
  const p = state.player;
  for (let i = state.seedDrops.length - 1; i >= 0; i--) {
    const s = state.seedDrops[i];
    s.life += dt; s.pulse += 0.07;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < 110) {
      const ang = Math.atan2(p.y - s.y, p.x - s.x);
      const pull = clamp((110 - d) / 110 * 4, 0, 4);
      s.vx += Math.cos(ang) * pull * dt * 0.4;
      s.vy += Math.sin(ang) * pull * dt * 0.4;
    }
    s.vx = expDt(s.vx, 0.93, dt);
    s.vy = expDt(s.vy, 0.93, dt);
    s.vy += 0.04 * dt;
    s.y = clamp(s.y + s.vy * dt, 5, H - 5); s.x += s.vx * dt;
    if (d < p.r + s.sz + 4) {
      state.runSeeds++;
      spawnParticles(state, s.x, s.y, 4, PAL.seed, 2.5, 16, 2);
      sfx('seed');
      onSeedCollect();
      state.seedDrops.splice(i, 1);
      continue;
    }
    if (s.life > s.maxLife) state.seedDrops.splice(i, 1);
  }
}

// ── Powerups ──────────────────────────────────────────────────────────────────

export function updPowerups(state: GameRunState, dt: number): void {
  const p = state.player;
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const pw = state.powerups[i];
    pw.life -= dt; pw.pulse += 0.07;
    if (pw.life <= 0) { state.powerups.splice(i, 1); continue; }
    if (Math.hypot(pw.x - p.x, pw.y - p.y) < p.r + pw.r + 4) {
      if (pw.type === 'health') p.hp = Math.min(p.maxHp, p.hp + 28);
      else { p.ammo = state.stats.maxAmmo; p.reloading = false; }
      spawnPetalBurst(state, pw.x, pw.y, 10, pw.col);
      spawnText(state, pw.x, pw.y - 22, pw.type === 'health' ? '+28 Vitality' : 'Energy Full', pw.col, 10);
      sfx('pick');
      state.powerups.splice(i, 1);
    }
  }
}

// ── Combo ─────────────────────────────────────────────────────────────────────

export function updCombo(state: GameRunState, dt: number): void {
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 1;
  }
}

// ── Main update ───────────────────────────────────────────────────────────────

export function updateGame(state: GameRunState, dt: number, onEndGame: EndGameFn, onSeedCollect: () => void): void {
  if (state.paused) return;
  updShake(state, dt);
  updPlayer(state, dt, onEndGame);
  updEnemies(state, dt, onEndGame);
  updBullets(state, dt, onEndGame);
  updParticles(state, dt);
  updPowerups(state, dt);
  updSeeds(state, dt, onSeedCollect);
  updCombo(state, dt);
  updAbility(state, dt);
}
