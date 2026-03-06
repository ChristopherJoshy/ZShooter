// Game logic update functions — ported 1:1 from zen-striker.html.
import { W, H, PAL, COMBO_DUR, ABIL_DUR } from './constants';
import { clamp, lerp, rnd } from './physics';
import { makeBullet, spawnAtEdge, makeSeedDrops, makePowerup, makeEnemy } from './entities';
import { sfx } from './audio';
import { getWaveCfg, getStoryWaveCfg } from './waves';
import type { GameRunState, Player, Enemy, Particle, SeedDrop, WaveCfg } from './types';

// ── Shake ─────────────────────────────────────────────────────────────────────

export function addShake(state: GameRunState, m: number): void {
  state.shake.m = Math.max(state.shake.m, m * 0.42);
}

export function updShake(state: GameRunState): void {
  if (state.shake.m > 0.15) {
    state.shake.x = rnd(-0.5, 0.5) * state.shake.m;
    state.shake.y = rnd(-0.5, 0.5) * state.shake.m;
    state.shake.m *= 0.78;
  } else {
    state.shake.x = 0; state.shake.y = 0; state.shake.m = 0;
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
  }
  // Base CDs from ABIL_DUR map, scaled by abilityCDMult
  const BASE_CD: Record<string, number> = { petalDash: 180, bloomShield: 480, blossomPulse: 300, none: 0 };
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
    state.bullets.push(makeBullet(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a + rnd(-0.5, 0.5) * 0.03, 13, 3.5, col, damage, false, false, weapon));
    spawnParticles(state, p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, 2, col, 1.5, 10, 1.5);
    sfx('shoot');
  } else if (weapon === 'petalSpray') {
    for (let i = -1; i <= 1; i++) state.bullets.push(makeBullet(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, a + i * 0.22 + rnd(-0.5, 0.5) * 0.04, 12, 3, col, Math.round(damage * 0.65), false, false, weapon));
    sfx('shootPetal');
  } else if (weapon === 'thornBurst') {
    for (let j = 0; j < 5; j++) {
      const sp = (j - 2) * 0.18 + rnd(-0.5, 0.5) * 0.06;
      const b = makeBullet(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, a + sp, 11, 2.5, col, Math.round(damage * 0.5), false, false, weapon);
      b.maxLife = 28; state.bullets.push(b);
    }
    sfx('shootThorn');
  } else if (weapon === 'lotusBeam') {
    state.bullets.push(makeBullet(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a + rnd(-0.5, 0.5) * 0.02, 10, 4, col, Math.round(damage * 1.7), false, true, weapon));
    sfx('shootLotus');
  } else if (weapon === 'pulseBlossom') {
    // Rapid autofire; fire rate handled via WEAPON_DEFS (4fr) — here just spawn one bullet
    const b = makeBullet(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, a + rnd(-0.5, 0.5) * 0.04, 14, 3, col, Math.round(damage * 0.5), false, false, weapon);
    b.maxLife = 55;
    state.bullets.push(b);
    spawnParticles(state, p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, 1, col, 1.2, 8, 1.5);
    sfx('shootPulse');
  } else if (weapon === 'twinPetal') {
    // Two parallel bullets offset ±5px perpendicular to aim direction
    const px = Math.cos(a + Math.PI / 2); const py = Math.sin(a + Math.PI / 2);
    for (const sign of [-1, 1]) {
      const ox = px * 5 * sign; const oy = py * 5 * sign;
      state.bullets.push(makeBullet(p.x + Math.cos(a) * 16 + ox, p.y + Math.sin(a) * 16 + oy, a + rnd(-0.5, 0.5) * 0.025, 12, 3.5, col, Math.round(damage * 0.72), false, false, weapon));
    }
    sfx('shootTwin');
  } else if (weapon === 'mistArc') {
    const b = makeBullet(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a + rnd(-0.5, 0.5) * 0.12, 9, 4.5, col, Math.round(damage * 0.95), false, false, weapon);
    b.homing = true; b.maxLife = 75;
    state.bullets.push(b);
    sfx('shootMist');
  } else if (weapon === 'rootCannon') {
    // Slow heavy projectile — low speed, large radius, high damage
    const b = makeBullet(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a + rnd(-0.5, 0.5) * 0.015, 6.5, 8, col, Math.round(damage * 4.5), false, false, weapon);
    b.maxLife = 70;
    state.bullets.push(b);
    spawnParticles(state, p.x, p.y, 5, col, 2, 18, 3);
    sfx('shootRoot');
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
  p.vx = lerp(p.vx, mv ? (mx / ln) * p.speed : 0, 0.22);
  p.vy = lerp(p.vy, mv ? (my / ln) * p.speed : 0, 0.22);
  p.x = clamp(p.x + p.vx * dt, p.r, W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, H - p.r);
  p.angle = Math.atan2(state.mouseY - p.y, state.mouseX - p.x);
  p.trail.push({ x: p.x, y: p.y });
  if (p.trail.length > 10) p.trail.shift();
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
  const pts = e.score * state.combo;
  state.score += pts;
  state.kills++;
  state.combo = Math.min(state.combo + 1, 8);
  state.comboTimer = COMBO_DUR;
  spawnPetalBurst(state, e.x, e.y, e.type === 'boss' ? 50 : 12, e.col);
  spawnParticles(state, e.x, e.y, e.type === 'boss' ? 18 : 7, e.col, e.type === 'boss' ? 5 : 3, 32, 3);
  spawnText(state, e.x, e.y - e.r - 8, '+' + pts, PAL.combo, 11);
  addShake(state, e.type === 'boss' ? 14 : 3.5);
  sfx('die');
  state.seedDrops.push(...makeSeedDrops(e.x, e.y, e.seeds));
  if (Math.random() < 0.22) state.powerups.push(makePowerup(e.x, e.y));
  if (e.type === 'splitter') {
    for (let k = 0; k < 2; k++) {
      const mini = makeEnemy('chaser', e.x + rnd(-16, 16), e.y + rnd(-16, 16), state.wave);
      mini.r = 7; mini.hp = mini.maxHp = Math.ceil(mini.maxHp * 0.4);
      mini.speed *= 1.3; mini.seeds = 1; mini.score = 30;
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
        const enemy = spawnAtEdge(cfg.types[state.waveSpawned], state.wave);
        if (state.opponentNames && state.opponentNames.length > 0) {
          enemy.label = state.opponentNames[state.waveSpawned % state.opponentNames.length];
        }
        // Apply story difficulty multipliers if set
        const dm = state.storyDiffMult;
        if (dm) {
          enemy.hp       = Math.ceil(enemy.hp * dm.hp);
          enemy.maxHp    = enemy.hp;
          enemy.speed    = enemy.speed * dm.speed;
        }
        state.enemies.push(enemy);
        state.waveSpawned++;
        state.spawnTimer = state.spawnInterval;
      }
    }
  }

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
      if (ed < mn) { sx += ex / ed * (mn - ed) * 0.05; sy += ey / ed * (mn - ed) * 0.05; }
    }
    // Separation from player — prevent enemies from sitting inside the player
    const playerGap = p.r + e.r + 4;
    if (dist < playerGap) {
      const pushStr = (playerGap - dist) * 0.12;
      sx -= (dx / dist) * pushStr;
      sy -= (dy / dist) * pushStr;
    }

    // AI
    if (e.type === 'chaser') {
      // Chasers weave side to side while approaching
      const weave = Math.sin(e.life * 0.1) * 0.6;
      e.vx += (dx / dist) * e.speed * 0.18 + (0 - dy / dist) * weave * e.speed * 0.1;
      e.vy += (dy / dist) * e.speed * 0.18 + (dx / dist) * weave * e.speed * 0.1;
    } else if (e.type === 'tank') {
      // Tanks are relentless but slow, gaining speed below 50% HP
      const sp2 = e.hp < e.maxHp * 0.5 ? e.speed * 1.4 : e.speed;
      e.vx += (dx / dist) * sp2 * 0.18; e.vy += (dy / dist) * sp2 * 0.18;
    } else if (e.type === 'splitter') {
      // Splitters lumber forward with slight erratic jitter
      const jitterX = Math.random() < 0.1 ? rnd(-0.5, 0.5) : 0;
      const jitterY = Math.random() < 0.1 ? rnd(-0.5, 0.5) : 0;
      e.vx += (dx / dist + jitterX) * e.speed * 0.18; 
      e.vy += (dy / dist + jitterY) * e.speed * 0.18;
    } else if (e.type === 'speeder') {
      // Speeders have erratic darting movement (charge, pause, charge)
      const dart = Math.max(0.1, Math.sin(e.life * 0.15) * 1.5 + 0.3);
      e.vx += (dx / dist) * e.speed * 0.2 * dart; 
      e.vy += (dy / dist) * e.speed * 0.2 * dart;
    } else if (e.type === 'shooter') {
      // Shooters orbit at ~210px, and retreat if player gets too close (< 180px)
      const targetDist = 210; 
      const diff = dist - targetDist;
      
      if (dist < 180) {
        // Retreat away from player while still orbiting
        e.vx += (dx / dist) * diff * 0.008 + (0 - dy / dist) * 0.35;
        e.vy += (dy / dist) * diff * 0.008 + (dx / dist) * 0.35;
      } else {
        // Normal orbit
        e.vx += (dx / dist) * diff * 0.004 + (0 - dy / dist) * 0.3;
        e.vy += (dy / dist) * diff * 0.004 + (dx / dist) * 0.3;
      }
    } else if (e.type === 'boss') {
      const ph = e.hp < e.maxHp * 0.4 ? 2 : e.hp < e.maxHp * 0.7 ? 1 : 0;
      e.phase = ph;
      const bsp = e.speed * (1 + ph * 0.5);
      e.vx += (dx / dist) * bsp * 0.1; e.vy += (dy / dist) * bsp * 0.1;
      if (Math.sin(e.life * 0.025) > 0.35) { e.vx += (0 - dy / dist) * 0.45; e.vy += (dx / dist) * 0.45; }
    } else if (e.type === 'stalker') {
      // Stalker: moves toward player, teleports every ~4 seconds with flicker telegraph
      e.vx += (dx / dist) * e.speed * 0.16; e.vy += (dy / dist) * e.speed * 0.16;
      if (e.flickering) {
        e.flickerTimer = (e.flickerTimer ?? 0) - dt;
        if ((e.flickerTimer ?? 0) <= 0) {
          // Teleport to a random position near the player (80–180px away)
          const ta = rnd(0, Math.PI * 2);
          const tr = rnd(80, 180);
          e.x = Math.max(e.r + 5, Math.min(W - e.r - 5, p.x + Math.cos(ta) * tr));
          e.y = Math.max(e.r + 5, Math.min(H - e.r - 5, p.y + Math.sin(ta) * tr));
          e.vx = 0; e.vy = 0;
          e.flickering = false;
          e.teleportTimer = 200 + rnd(0, 80);
        }
      } else {
        e.teleportTimer = (e.teleportTimer ?? 240) - dt;
        if ((e.teleportTimer ?? 0) <= 0) {
          e.flickering = true;
          e.flickerTimer = 30; // 0.5s flicker before teleport
        }
      }
    }
    const ms = e.speed * 1.25; const sv = Math.hypot(e.vx, e.vy);
    if (sv > ms) { e.vx = e.vx / sv * ms; e.vy = e.vy / sv * ms; }
    e.vx = (e.vx + sx) * 0.9; e.vy = (e.vy + sy) * 0.9;
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.type === 'speeder') { e.trail.push({ x: e.x, y: e.y }); if (e.trail.length > 8) e.trail.shift(); }

    // Shooting with telegraph
    if (e.type === 'shooter' || e.type === 'boss') {
      if (e.telegraphing) {
        e.telTimer -= dt;
        if (e.telTimer <= 0) {
          e.telegraphing = false;
          const ang = Math.atan2(dy, dx);
          if (e.type === 'boss') {
            const ph = e.phase ?? 0;
            const n = ph >= 2 ? 9 : ph === 1 ? 7 : 5;
            for (let k = 0; k < n; k++) state.bullets.push(makeBullet(e.x, e.y, (k / n) * Math.PI * 2, 4.5 + ph * 0.5, 4.5, e.col, 10 + ph * 3, true, false));
            if (ph >= 1) state.bullets.push(makeBullet(e.x, e.y, ang, 7, 4, e.col, 14, true, false));
            e.shootTimer = ph >= 2 ? 42 : ph === 1 ? 55 : 68;
          } else {
            state.bullets.push(makeBullet(e.x, e.y, ang + rnd(-0.5, 0.5) * 0.15, 4.5, 3.5, e.col, 9, true, false));
            e.shootTimer = 80 + rnd(0, 30);
          }
        }
      } else {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) { e.telegraphing = true; e.telTimer = 20; }
      }
    }

    // Contact damage + knockback
    if (dist < p.r + e.r + 2 && p.inv <= 0 && !state.shieldActive) {
      const baseDmg = e.type === 'boss' ? 18 : e.type === 'tank' ? 13 : 9;
      const cdmg = Math.round(baseDmg * state.stats.damageReduction);
      p.hp -= cdmg; p.inv = 60;
      // Knockback: push enemy away from player
      const knockStr = e.type === 'boss' ? 3 : e.type === 'tank' ? 5 : 8;
      e.vx -= (dx / dist) * knockStr;
      e.vy -= (dy / dist) * knockStr;
      addShake(state, e.type === 'boss' ? 10 : 6);
      spawnParticles(state, p.x, p.y, 8, PAL.health, 3, 22, 2.5);
      sfx('hurt');
      if (p.hp <= 0) { p.hp = 0; onEndGame(state); return; }
    }

    // Bullet hits
    let killed = false;
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const b = state.bullets[j];
      if (b.fromEnemy) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
        e.hp -= b.dmg;
        spawnParticles(state, b.x, b.y, 4, e.col, 1.8, 14, 2);
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
    state.waveTrans = true; state.waveTransTimer = 100;
    spawnText(state, W / 2, H / 2, 'Harmony Restored', PAL.player, 14);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
    sfx('waveComplete');
  }
  if (state.waveTrans) {
    state.waveTransTimer -= dt;
    if (state.waveTransTimer <= 0) { state.waveTrans = false; beginWave(state, state.wave + 1); }
  }
}

// ── Wave ──────────────────────────────────────────────────────────────────────

export function beginWave(state: GameRunState, w: number, cfgOverride?: WaveCfg): void {
  state.wave = w;
  // Use provided cfg, or auto-select story cfg if chapter is set, or fall back to arcade cfg
  let cfg: WaveCfg;
  if (cfgOverride) {
    cfg = cfgOverride;
  } else if (state.storyChapterId != null) {
    cfg = getStoryWaveCfg(state.storyChapterId, w);
  } else {
    cfg = getWaveCfg(w);
  }
  state.waveCfg = cfg;
  state.waveTotal = cfg.count;
  state.waveLeft = cfg.count;
  state.waveSpawned = 0;
  state.spawnTimer = 50;
  state.spawnInterval = Math.max(16, 75 - w * 5);
  // Use wave label from story config if available
  const label = (cfg as { label?: string }).label;
  spawnText(state, W / 2, H / 2 - 20, label ?? (w % 5 === 0 ? 'Boss Wave!' : 'Wave ' + w), PAL.muted, 13);
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
        b.vx = b.vx * 0.75 + tx * 0.25;
        b.vy = b.vy * 0.75 + ty * 0.25;
        // Re-normalize to original speed
        const newSpd = Math.hypot(b.vx, b.vy) || 1;
        b.vx = b.vx / newSpd * spd;
        b.vy = b.vy / newSpd * spd;
      }
    }

    b.x += b.vx * dt; b.y += b.vy * dt; b.life += dt;
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
    p.vx *= Math.pow(0.968, dt); p.vy *= Math.pow(0.968, dt);
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
    s.vx *= Math.pow(0.93, dt); s.vy *= Math.pow(0.93, dt);
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
  updShake(state);
  updPlayer(state, dt, onEndGame);
  updEnemies(state, dt, onEndGame);
  updBullets(state, dt, onEndGame);
  updParticles(state, dt);
  updPowerups(state, dt);
  updSeeds(state, dt, onSeedCollect);
  updCombo(state, dt);
  updAbility(state, dt);
}
