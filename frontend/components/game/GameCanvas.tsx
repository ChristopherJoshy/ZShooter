'use client';
import { useRef, useEffect, useCallback } from 'react';
import { W, H } from '@/lib/game/constants';
import { makePlayer, newBgPetal } from '@/lib/game/entities';
import { startAudio, sfx } from '@/lib/game/audio';
import { renderGame, renderBg } from '@/lib/game/renderer';
import { updateGame, beginWave, updParticles } from '@/lib/game/updater';
import { getStoryWaveCfg, getStoryChapterLength, STORY_DIFFICULTY_MULT } from '@/lib/game/waves';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useGame, getStats } from '@/context/GameContext';
import type { GameRunState } from '@/lib/game/types';
import type { StoryDifficulty } from '@/lib/game/types';
import HUD from './HUD';
import PauseOverlay from './PauseOverlay';
import TouchControls from './TouchControls';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRunState(save: any, storyChapterId?: number, storyDifficulty?: StoryDifficulty, opponentNames?: string[]): GameRunState {
  const stats = getStats(save);
  const player = makePlayer(stats);
  const state: GameRunState = {
    player,
    bullets: [],
    enemies: [],
    particles: [],
    seedDrops: [],
    powerups: [],
    bgPetals: Array.from({ length: 22 }, newBgPetal),

    score: 0,
    kills: 0,
    runSeeds: 0,
    wave: 0,
    combo: 1,
    comboTimer: 0,
    shake: { x: 0, y: 0, m: 0 },

    waveLeft: 0,
    waveSpawned: 0,
    waveTotal: 0,
    waveTransTimer: 0,
    waveTrans: false,
    spawnTimer: 0,
    spawnInterval: 60,

    mouseX: W / 2,
    mouseY: H / 2,
    keys: {},
    justPressed: {},
    autoFire: false,

    abilityCooldown: 0,
    abilityActive: false,
    abilityTimer: 0,
    shieldActive: false,

    stats,
    paused: false,

    storyChapterId,
    storyDiffMult: storyDifficulty ? STORY_DIFFICULTY_MULT[storyDifficulty] : undefined,
    opponentNames,
  };
  beginWave(state, 1);
  return state;
}

export default function GameCanvas({ isTouch, onReturn, opponentNames = [] }: { isTouch: boolean; onReturn?: () => void; opponentNames?: string[] }) {
  const { save, setSave, gameState, setGameState, setRunState, runState, persistSave, setLastResult, gameMode, storyChapter, storyDifficulty, setLastRankedResult, settings } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameRunState | null>(null);
  const playingRef = useRef(false);
  const runStartRef = useRef(0);

  // Initialise run state when game starts; keep ambient state for background when idle
  useEffect(() => {
    if (gameState === 'playing' || gameState === 'story') {
      const rs = gameState === 'story' && storyChapter !== null && storyDifficulty !== null
        ? makeRunState(save, storyChapter, storyDifficulty, opponentNames)
        : makeRunState(save, undefined, undefined, opponentNames);
      stateRef.current = rs;
      setRunState(rs);
      sfx('start');
      runStartRef.current = Date.now();
    } else if (!stateRef.current) {
      // Ambient background state — only petals/particles rendered
      stateRef.current = makeRunState(save, undefined, undefined, opponentNames);
    }
    playingRef.current = gameState === 'playing' || gameState === 'story';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, opponentNames]);

  // Return to Garden from pause — resets to ambient state
  const handleReturnToGarden = useCallback(() => {
    stateRef.current = makeRunState(save, undefined, undefined, opponentNames);
    playingRef.current = false;
    setRunState(null);
    setGameState('garden');
    if (onReturn) onReturn();
  }, [save, setRunState, setGameState, onReturn, opponentNames]);

  // End-game callback — transitions to results screen
  const handleEndGame = useCallback((state: GameRunState) => {
    const newSeeds = save.seeds + state.runSeeds;
    const newHigh = Math.max(save.highScore, state.score);
    const durationMs = Date.now() - runStartRef.current;

    // Build run record for history
    const record = {
      wave: state.wave,
      score: state.score,
      kills: state.kills,
      seeds: state.runSeeds,
      date: Date.now(),
      weapon: save.activeWeapon,
      ability: save.activeAbility,
    };
    const runHistory = [record, ...(save.runHistory ?? [])].slice(0, 20);

    // Accumulate lifetime stats
    const prev = save.stats ?? { totalKills: 0, totalSeeds: 0, totalWaves: 0, highestCombo: 0, totalPlayTime: 0 };
    const newStats = {
      totalKills: prev.totalKills + state.kills,
      totalSeeds: prev.totalSeeds + state.runSeeds,
      totalWaves: prev.totalWaves + state.wave,
      highestCombo: Math.max(prev.highestCombo, state.combo),
      totalPlayTime: prev.totalPlayTime + Math.round(durationMs / 1000),
    };

    const newSave = {
      ...save,
      seeds: newSeeds,
      highScore: newHigh,
      totalRuns: save.totalRuns + 1,
      runHistory,
      stats: newStats,
    };
    setLastResult({ wave: state.wave, score: state.score, kills: state.kills, seedsEarned: state.runSeeds, weapon: save.activeWeapon, ability: save.activeAbility });
    if (state.score > save.highScore) sfx('newHighScore');

    // ── Ranked: submit match result ──────────────────────────────────────────
    if (gameMode === 'ranked') {
      import('@/lib/api').then(({ apiSubmitMatchResult }) => {
        apiSubmitMatchResult({
          placement: 1, // solo ranked: always 1st (PvE survival)
          score: state.score,
          kills: state.kills,
          wavesReached: state.wave,
          durationMs,
        }).then((res) => {
          setLastRankedResult({
            rpDelta:     res.rpDelta,
            newTier:     res.newTier,
            newDivision: res.newDivision,
            newRp:       res.newRp,
          });
          setSave({
            ...newSave,
            ranked: {
              ...newSave.ranked,
              tier: res.newTier,
              division: res.newDivision,
              rp: res.newRp,
              mmr: newSave.ranked.mmr + res.mmrDelta,
              peakRp: Math.max(newSave.ranked.peakRp, res.newRp),
              placementMatchesPlayed: res.isPlacement
                ? newSave.ranked.placementMatchesPlayed + 1
                : newSave.ranked.placementMatchesPlayed,
              matchesThisSeason: newSave.ranked.matchesThisSeason + 1,
              matchesAllTime: newSave.ranked.matchesAllTime + 1,
              podiumFinishes: newSave.ranked.podiumFinishes + 1,
              firstPlaceCount: newSave.ranked.firstPlaceCount + 1,
            },
          });
        }).catch(() => null);
      });
    }

    // ── Story: record chapter completion ──────────────────────────────────────
    if (gameMode === 'story' && storyChapter !== null && storyDifficulty !== null) {
      // Only mark complete if the player cleared all waves (not died early)
      if (state.wave >= getStoryChapterLength(storyChapter)) {
        const newStoryProgress = [
          ...(save.storyProgress ?? []),
          { chapterId: storyChapter, difficulty: storyDifficulty, completedAt: Date.now() },
        ];
        newSave.storyProgress = newStoryProgress;
        newSave.story = {
          completedChapters: newStoryProgress,
          fullClearDate: new Set(newStoryProgress.map((item) => item.chapterId)).size >= 3 ? Date.now() : save.story.fullClearDate,
        };
        import('@/lib/api').then(({ apiCompleteChapter }) => {
          apiCompleteChapter({ chapterId: storyChapter!, difficulty: storyDifficulty! }).catch(() => null);
        });
      }
    }

    persistSave(newSave);
    // Reset state to an ambient background state (not null) so petals keep animating
    stateRef.current = makeRunState(newSave, undefined, undefined, opponentNames);
    playingRef.current = false;
    setRunState(null);
    setGameState('results');
  }, [save, setSave, persistSave, setLastResult, setRunState, setGameState, gameMode, storyChapter, storyDifficulty, setLastRankedResult, opponentNames]);

  // Seed collect callback — no immediate save needed; saved on game over
  const handleSeedCollect = useCallback(() => { /* runSeeds tracked in state */ }, []);

  // Game loop tick
  const tick = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    if (playingRef.current && state) {
      updateGame(state, dt, handleEndGame, handleSeedCollect);
      if (!settings.screenShake) {
        state.shake.x = 0;
        state.shake.y = 0;
        state.shake.m = 0;
      }
      renderGame(ctx, state, settings.showOpponentNames);
      // Shallow-copy state into React context each frame so HUD stays live.
      setRunState({ ...state });
    } else {
      // Garden / results — render ambient background with floating petals.
      // stateRef holds a minimal ambient state when not playing.
      const ambient = stateRef.current!;
      renderBg(ctx, ambient);
      updParticles(ambient, dt);
    }
  }, [handleEndGame, handleSeedCollect, setRunState, settings.showOpponentNames]);

  useGameLoop(true, tick); // always running for background animation

  // ── Input ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      if (!state.keys[e.code]) state.justPressed[e.code] = true;
      state.keys[e.code] = true;
      if (playingRef.current && (e.code === 'Escape' || e.code === 'KeyP')) {
        state.paused = !state.paused;
        // Force a re-render of HUD to pick up paused change
        setRunState({ ...state });
      }
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (state) state.keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setRunState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const rect = canvas.getBoundingClientRect();
      state.mouseX = e.clientX - rect.left;
      state.mouseY = e.clientY - rect.top;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      startAudio();
      const state = stateRef.current;
      if (state) state.autoFire = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const state = stateRef.current;
      if (state) state.autoFire = false;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const isPlaying = gameState === 'playing' || gameState === 'story';

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <canvas
        ref={canvasRef}
        id="gc"
        width={W}
        height={H}
        style={{ display: 'block', borderRadius: 18, cursor: isPlaying ? 'none' : 'default' }}
      />
      {isPlaying && runState && (
        <>
          <HUD state={runState} />
          <PauseOverlay visible={runState.paused} onReturn={handleReturnToGarden} />
        </>
      )}
      {isTouch && (
        <TouchControls stateRef={stateRef} visible={isPlaying && settings.touchControls} />
      )}
    </div>
  );
}
