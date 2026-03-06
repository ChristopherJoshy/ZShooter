// All Canvas 2D draw functions — pixel-perfect port from zen-striker.html.
import { PAL, W, H, ABIL_CD } from './constants';
import { h2r, glow, rnd, clamp } from './physics';
import type { GameRunState, Particle, Enemy, Bullet, SeedDrop, Powerup, BgPetal } from './types';

function drawNameplate(ctx: CanvasRenderingContext2D, e: Enemy): void {
  if (!e.label) return;
  ctx.save();
  ctx.font = '600 11px Quicksand, sans-serif';
  ctx.textAlign = 'center';
  const y = e.y - e.r - (e.hp < e.maxHp ? 20 : 12);
  const width = Math.max(46, ctx.measureText(e.label).width + 14);
  ctx.fillStyle = 'rgba(26,20,16,.78)';
  (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
    .roundRect(e.x - width / 2, y - 12, width, 18, 7);
  ctx.fill();
  ctx.fillStyle = '#f5ede0';
  ctx.fillText(e.label, e.x, y + 1);
  ctx.restore();
}

export function drawBg(ctx: CanvasRenderingContext2D): void {
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.82);
  bg.addColorStop(0, '#f7f2ea');
  bg.addColorStop(1, '#ede5d5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = PAL.grid;
  ctx.lineWidth = 1;
  const TILE = 40;
  for (let x = 0; x <= W; x += TILE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += TILE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(165,140,115,.12)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = PAL.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
    .roundRect(4, 4, W - 8, H - 8, 12);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(196,149,106,.04)';
  ctx.lineWidth = 1;
  for (let r = 60; r < 430; r += 68) { ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke(); }
}

export function drawBgPetals(ctx: CanvasRenderingContext2D, petals: BgPetal[]): void {
  petals.forEach((p) => {
    p.sw += 0.016;
    p.x += p.vx + Math.sin(p.sw) * 0.25;
    p.y += p.vy;
    p.rot += p.rotV;
    if (p.y > H + 15) { p.y = -10; p.x = rnd(0, W); }
    if (p.x < -10) p.x = W + 10;
    if (p.x > W + 10) p.x = -10;
    ctx.save();
    ctx.globalAlpha = p.a * 0.65;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.sz, p.sz * 1.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

export function drawArrows(ctx: CanvasRenderingContext2D, state: GameRunState): void {
  const mg = 26;
  state.enemies.forEach((e) => {
    if (e.x > -5 && e.x < W + 5 && e.y > -5 && e.y < H + 5) return;
    const ang = Math.atan2(e.y - H / 2, e.x - W / 2);
    const ax = clamp(W / 2 + Math.cos(ang) * W * 0.44, mg, W - mg);
    const ay = clamp(H / 2 + Math.sin(ang) * H * 0.42, mg, H - mg);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = e.col;
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, state: GameRunState): void {
  const { player, stats, abilityActive, shieldActive } = state;
  if (!player) return;
  const ang = player.angle;
  const col = PAL.W[stats.weapon as keyof typeof PAL.W] ?? PAL.player;
  const tck = Date.now() * 0.001;

  if (player.trail.length > 0) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < player.trail.length - 1; i++) {
      const t1 = player.trail[i];
      const t2 = player.trail[i + 1];
      const pct = i / player.trail.length;
      const alpha = pct * (abilityActive && stats.ability === 'petalDash' ? 0.6 : 0.25);
      const width = player.r * (0.8 + pct * 0.4);
      
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.strokeStyle = col;
      ctx.lineWidth = width;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = width * 0.3;
      ctx.globalAlpha = alpha * 0.7;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }

  const flash = player.inv > 0 && !shieldActive && Math.floor(player.inv / 5) % 2 === 0;
  if (flash && !abilityActive) return;

  if (shieldActive) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + tck;
      const sr = player.r + 14 + Math.sin(tck * 4) * 2;
      const sx = player.x + Math.cos(a) * sr;
      const sy = player.y + Math.sin(a) * sr;
      if (k === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.strokeStyle = h2r('#9070c4', 0.8);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = h2r('#9070c4', 0.15);
    ctx.fill();
    glow(ctx, player.x, player.y, player.r + 28, '#9070c4', 0.18);
  }

  glow(ctx, player.x, player.y, player.r * 3.5, col, 0.25);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(ang);
  
  const w = stats.weapon;
  ctx.beginPath();
  if (w === 'seedShot') {
    ctx.moveTo(player.r * 1.2, 0);
    ctx.lineTo(-player.r * 0.4, -player.r * 0.85);
    ctx.lineTo(-player.r * 0.2, -player.r * 0.3);
    ctx.lineTo(-player.r * 0.7, -player.r * 0.4);
    ctx.lineTo(-player.r * 0.5, 0);
    ctx.lineTo(-player.r * 0.7, player.r * 0.4);
    ctx.lineTo(-player.r * 0.2, player.r * 0.3);
  if (w === 'seedShot') {
    ctx.moveTo(player.r * 1.3, 0);
    ctx.lineTo(-player.r * 0.4, -player.r * 0.9);
    ctx.lineTo(0, -player.r * 0.3);
    ctx.lineTo(-player.r * 0.9, -player.r * 0.6);
    ctx.lineTo(-player.r * 0.6, 0);
    ctx.lineTo(-player.r * 0.9, player.r * 0.6);
    ctx.lineTo(0, player.r * 0.3);
    ctx.lineTo(-player.r * 0.4, player.r * 0.9);
  } else if (w === 'petalSpray') {
    ctx.moveTo(player.r * 1.25, 0); 
    ctx.lineTo(-player.r * 0.2, -player.r * 0.5);
    ctx.lineTo(-player.r * 0.7, -player.r * 1.0);
    ctx.lineTo(-player.r * 0.4, -player.r * 0.3);
    ctx.lineTo(-player.r * 1.0, 0);
    ctx.lineTo(-player.r * 0.4, player.r * 0.3);
    ctx.lineTo(-player.r * 0.7, player.r * 1.0);
    ctx.lineTo(-player.r * 0.2, player.r * 0.5);
  } else if (w === 'thornBurst') {
    ctx.moveTo(player.r * 1.4, 0);
    ctx.lineTo(player.r * 0.4, -player.r * 0.5);
    ctx.lineTo(-player.r * 0.2, -player.r * 1.1);
    ctx.lineTo(-player.r * 0.5, -player.r * 0.3);
    ctx.lineTo(-player.r * 1.0, -player.r * 0.5);
    ctx.lineTo(-player.r * 0.7, 0);
    ctx.lineTo(-player.r * 1.0, player.r * 0.5);
    ctx.lineTo(-player.r * 0.5, player.r * 0.3);
    ctx.lineTo(-player.r * 0.2, player.r * 1.1);
    ctx.lineTo(player.r * 0.4, player.r * 0.5);
  } else if (w === 'lotusBeam') {
    ctx.moveTo(player.r * 1.5, 0);
    ctx.lineTo(player.r * 0.5, -player.r * 0.6);
    ctx.lineTo(-player.r * 0.1, -player.r * 1.0);
    ctx.lineTo(-player.r * 0.7, -player.r * 0.4);
    ctx.lineTo(-player.r * 0.4, 0);
    ctx.lineTo(-player.r * 0.7, player.r * 0.4);
    ctx.lineTo(-player.r * 0.1, player.r * 1.0);
    ctx.lineTo(player.r * 0.5, player.r * 0.6);
  } else if (w === 'pulseBlossom') {
    ctx.arc(0, 0, player.r * 0.85, 0, Math.PI * 2);
    ctx.moveTo(player.r * 1.2, -player.r * 0.2);
    ctx.lineTo(player.r * 1.2, player.r * 0.2);
    ctx.lineTo(player.r * 0.6, player.r * 0.5);
    ctx.lineTo(-player.r * 0.6, player.r * 0.9);
    ctx.lineTo(-player.r * 0.9, player.r * 0.5);
    ctx.lineTo(-player.r * 0.9, -player.r * 0.5);
    ctx.lineTo(-player.r * 0.6, -player.r * 0.9);
    ctx.lineTo(player.r * 0.6, -player.r * 0.5);
  } else if (w === 'twinPetal') {
    ctx.moveTo(player.r * 1.2, -player.r * 0.4);
    ctx.lineTo(player.r * 0.5, -player.r * 0.7);
    ctx.lineTo(-player.r * 0.7, -player.r * 0.7);
    ctx.lineTo(-player.r * 1.0, -player.r * 0.3);
    ctx.lineTo(-player.r * 0.3, -player.r * 0.3);
    ctx.lineTo(0, 0);
    ctx.lineTo(-player.r * 0.3, player.r * 0.3);
    ctx.lineTo(-player.r * 1.0, player.r * 0.3);
    ctx.lineTo(-player.r * 0.7, player.r * 0.7);
    ctx.lineTo(player.r * 0.5, player.r * 0.7);
    ctx.lineTo(player.r * 1.2, player.r * 0.4);
    ctx.lineTo(player.r * 0.9, 0);
  } else if (w === 'mistArc') {
    ctx.moveTo(player.r * 1.3, 0);
    ctx.bezierCurveTo(player.r * 0.6, -player.r * 1.3, -player.r * 0.9, -player.r * 1.1, -player.r * 0.6, 0);
    ctx.bezierCurveTo(-player.r * 0.9, player.r * 1.1, player.r * 0.6, player.r * 1.3, player.r * 1.3, 0);
  } else if (w === 'rootCannon') {
    ctx.moveTo(player.r * 1.2, -player.r * 0.3);
    ctx.lineTo(player.r * 1.2, player.r * 0.3);
    ctx.lineTo(player.r * 0.6, player.r * 0.5);
    ctx.lineTo(player.r * 0.4, player.r * 0.9);
    ctx.lineTo(-player.r * 0.6, player.r * 0.9);
    ctx.lineTo(-player.r * 1.0, player.r * 0.6);
    ctx.lineTo(-player.r * 1.0, -player.r * 0.6);
    ctx.lineTo(-player.r * 0.6, -player.r * 0.9);
    ctx.lineTo(player.r * 0.4, -player.r * 0.9);
    ctx.lineTo(player.r * 0.6, -player.r * 0.5);
  } else {
    for (let k = 0; k < 8; k++) {
      const aa = (k / 8) * Math.PI * 2;
      const rad = k % 2 === 0 ? player.r * 1.2 : player.r * 0.7;
      if (k === 0) ctx.moveTo(Math.cos(aa) * rad, Math.sin(aa) * rad);
      else ctx.lineTo(Math.cos(aa) * rad, Math.sin(aa) * rad);
    }
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  
  // Inner metallic core accent
  ctx.beginPath();
  ctx.moveTo(player.r * 0.5, 0);
  ctx.lineTo(0, -player.r * 0.35);
  ctx.lineTo(-player.r * 0.35, 0);
  ctx.lineTo(0, player.r * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.35;
  ctx.fill();

  // Highlight outline
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 1.8;
  ctx.globalAlpha = 1;
  ctx.stroke();

  // Engine trailing bulb
  ctx.beginPath();
  ctx.arc(-player.r * 0.45, 0, player.r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  glow(ctx, -player.r * 0.45, 0, player.r * 1.8, '#ffffff', 0.5);

  ctx.restore();
}
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const col = e.col;
  const hp = e.hp / e.maxHp;
  const tA = e.telegraphing ? (1 - e.telTimer / 20) * 0.65 : 0;
  const tck = Date.now() * 0.001;

  glow(ctx, e.x, e.y, e.r * 3.5, col, 0.15 + tA * 0.15);
  if (e.telegraphing) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 5 + tA * 15, 0, Math.PI * 2);
    ctx.strokeStyle = h2r(col, 0.7 * tA);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === 'chaser') {
    ctx.rotate(e.life * 0.04);
    ctx.beginPath();
    // 12 sharp spikes
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const r = k % 2 === 0 ? e.r * 1.3 : e.r * 0.5;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5; ctx.stroke();
    
    // Animated pulsing core
    ctx.beginPath(); ctx.arc(0, 0, e.r * (0.4 + Math.sin(tck * 12) * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.globalAlpha = 1;

  } else if (e.type === 'speeder') {
    const va = Math.atan2(e.vy, e.vx); ctx.rotate(va);
    // Sleeker dart shape
    ctx.beginPath(); 
    ctx.moveTo(e.r * 1.8, 0);
    ctx.lineTo(-e.r * 1.0, -e.r * 0.8);
    ctx.lineTo(-e.r * 0.5, 0);
    ctx.lineTo(-e.r * 1.0, e.r * 0.8);
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6; ctx.stroke();
    
    // Inner detail line
    ctx.beginPath(); ctx.moveTo(-e.r * 0.5, 0); ctx.lineTo(e.r * 1.2, 0);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    
    // Thrusters (flickering exhaust)
    const exFlicker = Math.random() * 0.4 + 0.6;
    ctx.beginPath(); ctx.arc(-e.r * 0.8, 0, e.r * 0.3 * exFlicker, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.globalAlpha = 1;

  } else if (e.type === 'shooter') {
    ctx.rotate(e.life * 0.025);
    
    // Outer rotating segmented ring
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = h2r(col, 0.7); ctx.lineWidth = 3;
    ctx.setLineDash([e.r * 0.8, e.r * 0.4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Hexagonal main body
    ctx.beginPath();
    for (let hk = 0; hk < 6; hk++) {
      const ha = (hk / 6) * Math.PI * 2; const hr2 = e.r * 0.9;
      if (hk === 0) ctx.moveTo(Math.cos(ha) * hr2, Math.sin(ha) * hr2);
      else ctx.lineTo(Math.cos(ha) * hr2, Math.sin(ha) * hr2);
    }
    ctx.closePath(); 
    ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    
    // Inner targeting eye
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.globalAlpha = 1;
    // Pupil
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();

  } else if (e.type === 'tank') {
    ctx.rotate(Math.sin(e.life * 0.02) * 0.12);
    // Outer thick armor plating
    ctx.beginPath();
    ctx.moveTo(e.r, -e.r * 0.45); ctx.lineTo(e.r, e.r * 0.45);
    ctx.lineTo(e.r * 0.45, e.r); ctx.lineTo(-e.r * 0.45, e.r);
    ctx.lineTo(-e.r, e.r * 0.45); ctx.lineTo(-e.r, -e.r * 0.45);
    ctx.lineTo(-e.r * 0.45, -e.r); ctx.lineTo(e.r * 0.45, -e.r);
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8; ctx.stroke();
    
    // Armor bolts
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6;
    for (const [bx, by] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]) {
      ctx.beginPath(); ctx.arc(e.r * bx, e.r * by, 2, 0, Math.PI * 2); ctx.fill();
    }
    
    // Inner counter-rotating plates
    ctx.rotate(-e.life * 0.04);
    ctx.beginPath();
    ctx.moveTo(e.r * 0.6, -e.r * 0.2); ctx.lineTo(e.r * 0.6, e.r * 0.2);
    ctx.lineTo(e.r * 0.2, e.r * 0.6); ctx.lineTo(-e.r * 0.2, e.r * 0.6);
    ctx.lineTo(-e.r * 0.6, e.r * 0.2); ctx.lineTo(-e.r * 0.6, -e.r * 0.2);
    ctx.lineTo(-e.r * 0.2, -e.r * 0.6); ctx.lineTo(e.r * 0.2, -e.r * 0.6);
    ctx.closePath();
    ctx.fillStyle = h2r(col, 0.4); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9; ctx.stroke();
    ctx.globalAlpha = 1;

  } else if (e.type === 'splitter') {
    // Organic cell wobble
    const wob = Math.sin(tck * 12) * e.r * 0.18;
    ctx.beginPath(); ctx.ellipse(0, 0, e.r + wob, e.r - wob, e.life * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.globalAlpha = 0.75; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, e.r - wob * 0.5, e.r + wob * 0.5, -e.life * 0.04, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; ctx.stroke();
    
    // Dual division cores
    ctx.globalAlpha = 1;
    const splitProgress = Math.sin(e.life * 0.05) * 0.5 + 0.5; // 0 to 1
    const dist = e.r * 0.3 * (1 + splitProgress * 0.5);
    for (let dk = -1; dk <= 1; dk += 2) {
      ctx.beginPath(); ctx.arc(dk * dist, 0, e.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }

  } else if (e.type === 'stalker') {
    const flk = e.flickering ? (Math.floor(tck * 20) % 2 === 0 ? 0.1 : 0.9) : 0.8;
    ctx.rotate(e.life * 0.05);
    
    // Dual overlapping ghost triangles
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 1.3); ctx.lineTo(e.r * 0.85, e.r * 0.65); ctx.lineTo(-e.r * 0.85, e.r * 0.65);
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = flk * 0.7; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    
    ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 1.1); ctx.lineTo(e.r * 0.7, e.r * 0.5); ctx.lineTo(-e.r * 0.7, e.r * 0.5);
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = flk * 0.9; ctx.fill();
    
    // Piercing core
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = flk; ctx.fill();
    ctx.globalAlpha = 1;

  } else if (e.type === 'boss') {
    const ph = e.phase ?? 0; const arms = 6 + ph;
    ctx.rotate(e.life * 0.012 * (1 + ph * 0.2));
    
    // Outer massive armor plates
    for (let bk = 0; bk < arms; bk++) {
      ctx.save(); ctx.rotate((bk / arms) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(e.r * 0.45, -e.r * 0.45);
      ctx.lineTo(0, -e.r * 1.15);
      ctx.lineTo(-e.r * 0.45, -e.r * 0.45);
      ctx.closePath();
      ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.6; ctx.stroke();
      
      // Spike accents
      ctx.beginPath(); ctx.moveTo(0, -e.r * 0.6); ctx.lineTo(0, -e.r * 1.0);
      ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4; ctx.stroke();
      ctx.restore();
    }
    
    // Counter-rotating inner gear
    ctx.save(); ctx.rotate(-e.life * 0.025);
    ctx.beginPath();
    for (let ik = 0; ik < arms * 2; ik++) {
      const a = (ik / (arms * 2)) * Math.PI * 2;
      const r = ik % 2 === 0 ? e.r * 0.7 : e.r * 0.45;
      if (ik === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = h2r(col, 0.6); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    
    // Throbbing Boss Core
    const corePulse = Math.sin(tck * (8 + ph * 4)) * 0.1;
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, e.r * (0.35 + corePulse), 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  ctx.restore();

  if (hp < 1) {
    const hpClamped = Math.max(0, hp);
    const bw = e.r * 2.6; const bh = 4; const bx = e.x - bw / 2; const by = e.y - e.r - 12;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(180,155,130,.3)';
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
      .roundRect(bx, by, bw, bh, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.9;
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
      .roundRect(bx, by, bw * hpClamped, bh, 2);
    ctx.fill(); ctx.globalAlpha = 1;
  }
}

export function drawSpeederTrail(ctx: CanvasRenderingContext2D, e: Enemy): void {
  if (e.type !== 'speeder' && e.type !== 'chaser') return;
  if (e.trail.length < 2) return;
  
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < e.trail.length - 1; i++) {
    const t1 = e.trail[i];
    const t2 = e.trail[i + 1];
    const pct = i / e.trail.length;
    
    ctx.globalAlpha = pct * 0.5;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.strokeStyle = e.col;
    ctx.lineWidth = e.r * (0.5 + pct * 0.8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

export function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet): void {
  const wid = b.weaponId;
  const tck = Date.now() * 0.001;

  if (wid === 'pulseBlossom') {
    glow(ctx, b.x, b.y, b.r * 6, b.col, 0.3);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = b.col; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, Math.PI * 2);
    ctx.strokeStyle = h2r(b.col, 0.5); ctx.lineWidth = 1; ctx.stroke();
    
  } else if (wid === 'twinPetal') {
    glow(ctx, b.x, b.y, b.r * 5, b.col, 0.25);
    const ang = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 2.8, b.r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = b.col; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-b.r * 0.5, 0, b.r * 1.5, b.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
    
  } else if (wid === 'mistArc') {
    glow(ctx, b.x, b.y, b.r * 7, b.col, 0.3);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = b.col; ctx.globalAlpha = 0.8; ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + Math.sin(tck * 10) * 2, b.y + Math.cos(tck * 10) * 2, b.r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.8 + Math.sin(tck * 5) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = h2r(b.col, 0.5); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
    
  } else if (wid === 'rootCannon') {
    const wb = Math.sin(b.life * 0.4) * 1.5;
    glow(ctx, b.x, b.y, b.r * 6, b.col, 0.35);
    
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = '#555';
    ctx.fillRect(-b.r*1.5, -b.r*1.2, b.r*1.5, b.r*2.4);
    ctx.restore();

    for (let ri = 2; ri >= 0; ri--) {
      const rr = b.r * (1.2 - ri * 0.3) + wb;
      ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(0.5, rr), 0, Math.PI * 2);
      ctx.fillStyle = ri === 0 ? '#ffffff' : b.col;
      ctx.globalAlpha = ri === 0 ? 1 : 0.6 + ri * 0.15;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
  } else if (wid === 'thornBurst') {
    const ang = Math.atan2(b.vy, b.vx);
    glow(ctx, b.x, b.y, b.r * 4, b.col, 0.2);
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(b.r * 2.5, 0);
    ctx.lineTo(-b.r, -b.r * 1.2);
    ctx.lineTo(0, 0);
    ctx.lineTo(-b.r, b.r * 1.2);
    ctx.closePath();
    ctx.fillStyle = b.col; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.r * 2.5, 0); ctx.lineTo(0, 0);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

  } else if (wid === 'lotusBeam') {
    const ang = Math.atan2(b.vy, b.vx);
    glow(ctx, b.x, b.y, b.r * 5, b.col, 0.3);
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(b.r * 3, 0);
    ctx.lineTo(-b.r * 3, -b.r * 0.8);
    ctx.lineTo(-b.r * 3, b.r * 0.8);
    ctx.closePath();
    ctx.fillStyle = b.col; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.r * 3, 0);
    ctx.lineTo(-b.r * 3, -b.r * 0.3);
    ctx.lineTo(-b.r * 3, b.r * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();

  } else {
    glow(ctx, b.x, b.y, b.r * 5, b.col, 0.25);
    const spd = Math.hypot(b.vx, b.vy);
    if (spd > 0) {
      const len = b.fromEnemy ? 10 : 22;
      const nx = b.vx / spd; const ny = b.vy / spd;
      const tg = ctx.createLinearGradient(b.x - nx * len, b.y - ny * len, b.x, b.y);
      tg.addColorStop(0, 'rgba(0,0,0,0)');
      tg.addColorStop(1, h2r(b.col, 0.6));
      ctx.strokeStyle = tg; 
      ctx.lineWidth = b.r * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - nx * len, b.y - ny * len);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineCap = 'butt';
      
      const tg2 = ctx.createLinearGradient(b.x - nx * len * 0.6, b.y - ny * len * 0.6, b.x, b.y);
      tg2.addColorStop(0, 'rgba(255,255,255,0)');
      tg2.addColorStop(1, '#ffffff');
      ctx.strokeStyle = tg2;
      ctx.lineWidth = b.r * 0.8;
      ctx.beginPath();
      ctx.moveTo(b.x - nx * len * 0.6, b.y - ny * len * 0.6);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = b.col; ctx.globalAlpha = 0.9; ctx.fill(); 
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawSeed(ctx: CanvasRenderingContext2D, s: SeedDrop): void {
  const fade = clamp(s.life < 30 ? s.life / 30 : 1, 0, 1) * (1 - clamp((s.life - s.maxLife + 60) / 60, 0, 1));
  const sc = 1 + Math.sin(s.pulse) * 0.12;
  ctx.save(); ctx.translate(s.x, s.y); ctx.scale(sc, sc); ctx.globalAlpha = fade;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2; const r = k % 2 === 0 ? s.sz : s.sz * 0.45;
    if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fillStyle = PAL.seed; ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,120,.6)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
  glow(ctx, s.x, s.y, 14, PAL.seed, 0.07 * fade);
}

export function drawPowerup(ctx: CanvasRenderingContext2D, pw: Powerup): void {
  const pulse = Math.sin(pw.pulse);
  glow(ctx, pw.x, pw.y, pw.r * 3.5, pw.col, 0.12 + pulse * 0.04);
  ctx.beginPath(); ctx.arc(pw.x, pw.y, pw.r + pulse * 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = pw.col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65; ctx.stroke();
  ctx.fillStyle = pw.col; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = pw.col; ctx.font = 'bold 11px Quicksand, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pw.type === 'health' ? '♥' : '◉', pw.x, pw.y);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const a = Math.max(0, p.life / p.maxLife);
  ctx.globalAlpha = a;
  if (p.isText) {
    ctx.font = `600 ${p.sz}px Quicksand, sans-serif`;
    ctx.fillStyle = p.col; ctx.textAlign = 'center';
    ctx.fillText(p.text ?? '', p.x, p.y);
    ctx.textAlign = 'left';
  } else if (p.isPetal) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0);
    ctx.fillStyle = p.col; ctx.beginPath();
    ctx.ellipse(0, 0, p.sz, p.sz * 1.65, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * a * 0.8 + 0.4, 0, Math.PI * 2);
    ctx.fillStyle = p.col; ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawCrosshair(ctx: CanvasRenderingContext2D, state: GameRunState): void {
  const { mouseX, mouseY, stats } = state;
  const s = 8; const g2 = 5;
  const col = PAL.W[stats.weapon as keyof typeof PAL.W] ?? PAL.player;
  ctx.strokeStyle = h2r(col, 0.6); ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mouseX - s - g2, mouseY); ctx.lineTo(mouseX - g2, mouseY);
  ctx.moveTo(mouseX + g2, mouseY);     ctx.lineTo(mouseX + s + g2, mouseY);
  ctx.moveTo(mouseX, mouseY - s - g2); ctx.lineTo(mouseX, mouseY - g2);
  ctx.moveTo(mouseX, mouseY + g2);     ctx.lineTo(mouseX, mouseY + s + g2);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(mouseX, mouseY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = h2r(col, 0.7); ctx.fill();
}

export function drawReloadArc(ctx: CanvasRenderingContext2D, state: GameRunState): void {
  const { player, stats } = state;
  if (!player?.reloading) return;
  const pct = 1 - (player.reloadTimer ?? 0) / stats.reloadTime;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r + 14, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
  ctx.strokeStyle = h2r(PAL.combo, 0.65); ctx.lineWidth = 2.5; ctx.stroke();
}

export function drawAbilRing(ctx: CanvasRenderingContext2D, state: GameRunState): void {
  const { abilityCooldown, stats, player } = state;
  if (abilityCooldown <= 0 || !stats?.ability || stats.ability === 'none') return;
  // Use same CD formula as useAbility: base CD × abilityCDMult
  const baseCD = ABIL_CD[stats.ability] ?? 1;
  const maxCD = Math.round(baseCD * (stats.abilityCDMult ?? 1));
  if (maxCD <= 0) return;
  const pct = clamp(1 - abilityCooldown / maxCD, 0, 1);
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r + 5, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
  ctx.strokeStyle = h2r('#9070c4', 0.45); ctx.lineWidth = 1.5; ctx.stroke();
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameRunState, showOpponentNames = true): void {
  ctx.save();
  ctx.translate(state.shake.x, state.shake.y);
  drawBg(ctx);
  drawBgPetals(ctx, state.bgPetals);
  drawArrows(ctx, state);
  state.seedDrops.forEach((s) => drawSeed(ctx, s));
  state.powerups.forEach((pw) => drawPowerup(ctx, pw));
  state.particles.forEach((p) => drawParticle(ctx, p));
  state.enemies.forEach((e) => {
    drawSpeederTrail(ctx, e);
    drawEnemy(ctx, e);
    if (showOpponentNames) drawNameplate(ctx, e);
  });
  state.bullets.forEach((b) => drawBullet(ctx, b));
  drawPlayer(ctx, state);
  drawCrosshair(ctx, state);
  drawReloadArc(ctx, state);
  drawAbilRing(ctx, state);
  ctx.restore();
}

export function renderBg(ctx: CanvasRenderingContext2D, state: GameRunState): void {
  ctx.save();
  drawBg(ctx);
  drawBgPetals(ctx, state.bgPetals);
  state.particles.forEach((p) => drawParticle(ctx, p));
  ctx.restore();
}
