// Math helpers and pure utility functions.
import { W, H } from './constants';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function rnd(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Convert a hex color + alpha into an rgba() string.
// The RGB parse result is cached so repeated calls with the same hex string
// skip the parseInt work on every subsequent invocation.
const _h2rCache = new Map<string, [number, number, number]>();
export function h2r(hex: string, a: number): string {
  let rgb = _h2rCache.get(hex);
  if (!rgb) {
    rgb = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    _h2rCache.set(hex, rgb);
  }
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

// Draw a radial glow centered at (x, y) with radius r.
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 0.18): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, h2r(col, a));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Clamp a point to the canvas bounds, given a margin.
export function edgeClamp(v: number, margin: number, max: number): number {
  return clamp(v, margin, max - margin);
}

// Scale factor relative to the original 900×600 canvas.
export const SCALE_X = W / 900;
export const SCALE_Y = H / 600;
