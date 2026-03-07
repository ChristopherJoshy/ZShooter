// Wave configuration — enemy counts and type distributions per wave.
import type { WaveCfg, EnemyType } from './types';

export function getWaveCfg(w: number): WaveCfg {
  if (w % 5 === 0) return { count: 1, types: ['boss'] };
  const n = Math.min(6 + w * 3, 40);
  const types: EnemyType[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (w < 2)      types.push(r < 0.65 ? 'chaser' : r < 0.88 ? 'speeder' : 'splitter');
    else if (w < 4) types.push(r < 0.35 ? 'chaser' : r < 0.60 ? 'shooter' : r < 0.78 ? 'speeder' : 'splitter');
    else if (w < 7) types.push(r < 0.22 ? 'chaser' : r < 0.44 ? 'shooter' : r < 0.58 ? 'speeder' : r < 0.74 ? 'tank' : 'splitter');
    else            types.push(r < 0.18 ? 'chaser' : r < 0.34 ? 'shooter' : r < 0.48 ? 'speeder' : r < 0.62 ? 'tank' : r < 0.78 ? 'splitter' : 'stalker');
  }
  return { count: n, types };
}
