'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { GameSave, GameState, GameRunState, PlayerSettings } from '@/lib/game/types';
import { apiSaveSave } from '@/lib/api';
import { STAT_DEFS, WEAPON_DEFS, ABILITY_DEFS } from '@/lib/game/constants';
import { clamp } from '@/lib/game/physics';
import { setAudioMix } from '@/lib/game/audio';

export type GameMode = 'arcade' | 'ranked';

const SETTINGS_KEY = 'zshooter_settings_v1';

function defaultSettings(): PlayerSettings {
  return {
    audioLevel: 80,
    sfxEnabled: true,
    screenShake: true,
    showHudLabels: true,
    touchControls: true,
    showOpponentNames: true,
    reducedMotion: false,
  };
}

function defaultSave(): GameSave {
  return {
    seeds: 0, highScore: 0, totalRuns: 0,
    up: {
      vitalRoots: 0, forestMend: 0, ironBark: 0,
      petalEdge: 0, rapidBloom: 0, deepQuiver: 0, swiftLoad: 0,
      windStep: 0, gustMaster: 0, petalGuard: 0,
    },
    weapons: ['seedShot'], abilities: [],
    activeWeapon: 'seedShot', activeAbility: 'none',
    profile: {
      avatar: 'sprout',
      frame: 'none',
      banner: 'forest',
      unlockedAvatars: ['sprout'],
      unlockedFrames: ['none'],
      unlockedBanners: ['forest'],
    },
    pityCount: 0,
    inventory: [],
    runHistory: [],
    stats: {
      totalKills: 0,
      totalSeeds: 0,
      totalWaves: 0,
      highestCombo: 0,
      totalPlayTime: 0,
    },
    ranked: {
      tier: 'seedling',
      division: 'III',
      rp: 0,
      mmr: 1000,
      placementMatchesPlayed: 0,
      peakRp: 0,
      winRate: 0,
      matchesThisSeason: 0,
      matchesAllTime: 0,
      podiumFinishes: 0,
      firstPlaceCount: 0,
    },
    highestWave: 0,
  };
}

export function getStats(save: GameSave) {
  const up = save.up;
  // Reload time reduced by swiftLoad (up to -70fr at max 5, floor 60fr)
  const reloadTime = Math.max(60, 130 - up.swiftLoad * 14);
  return {
    maxHp: 80 + up.vitalRoots * 15,
    speed: 3.64 + up.windStep * 0.25,
    damage: 18 + up.petalEdge * 6,
    fireRate: clamp(14 - up.rapidBloom * 1.3, 6, 14),
    maxAmmo: 10 + up.deepQuiver * 3,
    regen: up.forestMend * 0.006,
    // ironBark: damage reduction factor (1 = full damage, 0.6 = -40%)
    damageReduction: 1 - up.ironBark * 0.08,
    // gustMaster: ability CD multiplier
    abilityCDMult: 1 - up.gustMaster * 0.08,
    // petalGuard: ability duration multiplier
    abilityDurMult: 1 + up.petalGuard * 0.12,
    reloadTime,
    weapon: save.activeWeapon,
    ability: save.activeAbility,
  };
}

interface GameContextValue {
  save: GameSave;
  setSave: (s: GameSave) => void;
  persistSave: (s: GameSave) => Promise<void>;
  gameState: GameState;
  setGameState: (s: GameState) => void;
  runState: GameRunState | null;
  setRunState: (s: GameRunState | null) => void;
  username: string;
  setUsername: (u: string) => void;
  // Results data for display
  lastResult: { wave: number; score: number; kills: number; seedsEarned: number; weapon: string; ability: string; died?: boolean } | null;
  setLastResult: (r: { wave: number; score: number; kills: number; seedsEarned: number; weapon: string; ability: string; died?: boolean } | null) => void;
  // Phase 11 — mode selector
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  // Ranked results
  lastRankedResult: { rpDelta: number; newTier: string; newDivision: string | null; newRp: number } | null;
  setLastRankedResult: (r: { rpDelta: number; newTier: string; newDivision: string | null; newRp: number } | null) => void;
  settings: PlayerSettings;
  setSettings: (settings: PlayerSettings) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children, initialSave, initialUsername }: { children: ReactNode; initialSave?: GameSave; initialUsername?: string }) {
  const [save, setSaveState] = useState<GameSave>(initialSave ?? defaultSave());
  const [gameState, setGameState] = useState<GameState>('garden');
  const [runState, setRunState] = useState<GameRunState | null>(null);
  const [username, setUsername] = useState(initialUsername ?? '');
  const [lastResult, setLastResult] = useState<GameContextValue['lastResult']>(null);
  const [gameMode, setGameMode] = useState<GameMode>('arcade');
  const [lastRankedResult, setLastRankedResult] = useState<GameContextValue['lastRankedResult']>(null);
  const [settings, setSettingsState] = useState<PlayerSettings>(defaultSettings());

  const setSave = useCallback((s: GameSave) => setSaveState(s), []);
  const setSettings = useCallback((value: PlayerSettings) => setSettingsState(value), []);

  const persistSave = useCallback(async (s: GameSave) => {
    setSaveState(s);
    try { await apiSaveSave(s); } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
      setSettingsState({ ...defaultSettings(), ...parsed });
    } catch {
      // ignore invalid local settings
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore local storage write failures
    }
    setAudioMix({
      audioLevel: settings.audioLevel,
      sfxEnabled: settings.sfxEnabled,
    });
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  }, [settings]);

  return (
    <GameContext.Provider value={{
      save, setSave, persistSave,
      gameState, setGameState,
      runState, setRunState,
      username, setUsername,
      lastResult, setLastResult,
      gameMode, setGameMode,
      lastRankedResult, setLastRankedResult,
      settings, setSettings,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}

export { defaultSave, STAT_DEFS, WEAPON_DEFS, ABILITY_DEFS };
