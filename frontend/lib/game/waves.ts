// Wave configuration — enemy counts and type distributions per wave.
import type { WaveCfg, EnemyType, StoryDifficulty } from './types';

export function getWaveCfg(w: number): WaveCfg {
  if (w % 5 === 0) return { count: 1, types: ['boss'] };
  const n = Math.min(4 + w * 2, 22);
  const types: EnemyType[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (w < 2)      types.push(r < 0.75 ? 'chaser' : 'speeder');
    else if (w < 4) types.push(r < 0.40 ? 'chaser' : r < 0.70 ? 'shooter' : r < 0.88 ? 'speeder' : 'splitter');
    else if (w < 7) types.push(r < 0.25 ? 'chaser' : r < 0.48 ? 'shooter' : r < 0.62 ? 'speeder' : r < 0.78 ? 'tank' : 'splitter');
    else            types.push(r < 0.20 ? 'chaser' : r < 0.38 ? 'shooter' : r < 0.52 ? 'speeder' : r < 0.65 ? 'tank' : r < 0.82 ? 'splitter' : 'stalker');
  }
  return { count: n, types };
}

// ── Story mode ─────────────────────────────────────────────────────────────────

export interface StoryWaveCfg extends WaveCfg {
  /** Optional per-wave narrative label shown on wave banner */
  label?: string;
}

export interface StoryChapterDef {
  id: number;
  title: string;
  description: string;
  waves: StoryWaveCfg[];
}

/** Difficulty multipliers applied to enemy HP and speed */
export const STORY_DIFFICULTY_MULT: Record<StoryDifficulty, { hp: number; speed: number }> = {
  calm:     { hp: 0.70, speed: 0.80 },
  balanced: { hp: 1.00, speed: 1.00 },
  tempest:  { hp: 1.40, speed: 1.25 },
};

/** Three story chapters, each with 5 scripted waves (wave 5 = boss). */
export const STORY_CHAPTERS: StoryChapterDef[] = [
  {
    id: 1,
    title: 'The First Bloom',
    description: 'The garden stirs. Shadowed chasers flood the clearing — your training begins.',
    waves: [
      { count: 6,  types: ['chaser', 'chaser', 'chaser', 'chaser', 'speeder', 'speeder'],                                              label: 'Awakening' },
      { count: 8,  types: ['chaser', 'chaser', 'chaser', 'shooter', 'shooter', 'speeder', 'speeder', 'chaser'],                        label: 'The Swarm' },
      { count: 8,  types: ['shooter', 'shooter', 'shooter', 'chaser', 'chaser', 'speeder', 'splitter', 'splitter'],                    label: 'Ranged Assault' },
      { count: 10, types: ['chaser', 'chaser', 'shooter', 'shooter', 'speeder', 'speeder', 'splitter', 'splitter', 'tank', 'chaser'],  label: 'Encirclement' },
      { count: 1,  types: ['boss'],                                                                                                    label: 'Root Warden' },
    ],
  },
  {
    id: 2,
    title: 'Willow\'s Reckoning',
    description: 'The canopy darkens. Stalkers emerge from shadow — only precision will see you through.',
    waves: [
      { count: 8,  types: ['shooter', 'shooter', 'tank', 'tank', 'speeder', 'speeder', 'chaser', 'chaser'],                                              label: 'Storm Front' },
      { count: 10, types: ['stalker', 'stalker', 'chaser', 'chaser', 'shooter', 'shooter', 'speeder', 'speeder', 'splitter', 'splitter'],                label: 'Phantoms' },
      { count: 10, types: ['tank', 'tank', 'tank', 'shooter', 'shooter', 'stalker', 'stalker', 'speeder', 'splitter', 'splitter'],                       label: 'Iron Grove' },
      { count: 12, types: ['stalker', 'stalker', 'stalker', 'shooter', 'shooter', 'shooter', 'tank', 'tank', 'speeder', 'speeder', 'splitter', 'chaser'], label: 'Convergence' },
      { count: 1,  types: ['boss'],                                                                                                                       label: 'Hollow Willow' },
    ],
  },
  {
    id: 3,
    title: 'Storm Petal\'s End',
    description: 'The final tempest. Every enemy type converges — survive the heart of the storm.',
    waves: [
      { count: 12, types: ['chaser', 'chaser', 'shooter', 'shooter', 'tank', 'tank', 'speeder', 'speeder', 'stalker', 'stalker', 'splitter', 'splitter'], label: 'The Maelstrom' },
      { count: 14, types: ['stalker', 'stalker', 'stalker', 'stalker', 'tank', 'tank', 'tank', 'shooter', 'shooter', 'shooter', 'speeder', 'speeder', 'splitter', 'splitter'], label: 'Siege of Thorns' },
      { count: 14, types: ['shooter', 'shooter', 'shooter', 'shooter', 'tank', 'tank', 'tank', 'stalker', 'stalker', 'speeder', 'speeder', 'splitter', 'splitter', 'chaser'], label: 'Dark Canopy' },
      { count: 16, types: ['stalker', 'stalker', 'stalker', 'stalker', 'tank', 'tank', 'tank', 'tank', 'shooter', 'shooter', 'shooter', 'speeder', 'speeder', 'speeder', 'splitter', 'splitter'], label: 'Last Stand' },
      { count: 1,  types: ['boss'],                                                                                                                                                                label: 'Storm Petal' },
    ],
  },
];

/** Returns the wave config for a specific story chapter and wave number (1-indexed). */
export function getStoryWaveCfg(chapterId: number, waveIndex: number): StoryWaveCfg {
  const chapter = STORY_CHAPTERS.find((c) => c.id === chapterId);
  if (!chapter) return { count: 6, types: ['chaser', 'chaser', 'chaser', 'chaser', 'chaser', 'chaser'] };
  const waveIdx = Math.max(0, Math.min(waveIndex - 1, chapter.waves.length - 1));
  return chapter.waves[waveIdx];
}

/** Total number of waves in a story chapter. */
export function getStoryChapterLength(chapterId: number): number {
  const chapter = STORY_CHAPTERS.find((c) => c.id === chapterId);
  return chapter?.waves.length ?? 5;
}

