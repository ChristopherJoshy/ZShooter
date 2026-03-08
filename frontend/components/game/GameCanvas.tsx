'use client';
import { useRef, useEffect, useCallback } from 'react';
import { W, H } from '@/lib/game/constants';
import { makePlayer, newBgPetal } from '@/lib/game/entities';
import { startAudio, sfx } from '@/lib/game/audio';
import { renderGame, renderBg } from '@/lib/game/renderer';
import { updateGame, beginWave, updParticles } from '@/lib/game/updater';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useGame, getStats } from '@/context/GameContext';
import type { GameRunState } from '@/lib/game/types';
import HUD from './HUD';
import PauseOverlay from './PauseOverlay';
import TouchControls from './TouchControls';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRunState(save: any, opponentNames?: string[]): GameRunState {
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
    waveAnnTimer: 0,
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

    opponentNames,
  };
  beginWave(state, 1);
  return state;
}

export default function GameCanvas({ isTouch, isMobile, onReturn, opponentNames = [] }: { isTouch: boolean; isMobile?: boolean; onReturn?: () => void; opponentNames?: string[] }) {
  const { save, setSave, gameState, setGameState, setRunState, runState, persistSave, setLastResult, gameMode, setLastRankedResult, settings } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<GameRunState | null>(null);
  const playingRef = useRef(false);
  const runStartRef = useRef(0);
  const hudFrameRef = useRef(0);

  // Initialise run state when game starts; keep ambient state for background when idle
  useEffect(() => {
    if (gameState === 'playing') {
      const rs = makeRunState(save, opponentNames);
      stateRef.current = rs;
      setRunState(rs);
      sfx('start');
      runStartRef.current = Date.now();
    } else if (!stateRef.current) {
      // Ambient background state — only petals/particles rendered
      stateRef.current = makeRunState(save, opponentNames);
    }
    playingRef.current = gameState === 'playing';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, opponentNames]);

  // Return to Garden from pause — resets to ambient state
  const handleReturnToGarden = useCallback(() => {
    stateRef.current = makeRunState(save, opponentNames);
    playingRef.current = false;
    setRunState(null);
    setGameState('garden');
    if (onReturn) onReturn();
  }, [save, setRunState, setGameState, onReturn, opponentNames]);

  // End-game callback — transitions to results screen
  const handleEndGame = useCallback((state: GameRunState) => {
    const newSeeds = save.seeds + state.runSeeds;
    const newHigh = Math.max(save.highScore, state.score);
    const newHighWave = Math.max(save.highestWave ?? 0, state.wave);
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
      highestWave: newHighWave,
      totalRuns: save.totalRuns + 1,
      runHistory,
      stats: newStats,
    };
    setLastResult({ wave: state.wave, score: state.score, kills: state.kills, seedsEarned: state.runSeeds, weapon: save.activeWeapon, ability: save.activeAbility, died: true });
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

    persistSave(newSave);
    // Reset state to an ambient background state (not null) so petals keep animating
    stateRef.current = makeRunState(newSave, opponentNames);
    playingRef.current = false;
    setRunState(null);
    setGameState('results');
  }, [save, setSave, persistSave, setLastResult, setRunState, setGameState, gameMode, setLastRankedResult, opponentNames]);

  // Seed collect callback — no immediate save needed; saved on game over
  const handleSeedCollect = useCallback(() => { /* runSeeds tracked in state */ }, []);

  // Game loop tick
  const tick = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Cache the context on first use — getContext() is a DOM call we don't
    // need to repeat every frame.
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext('2d');
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const state = stateRef.current;
    if (playingRef.current && state) {
      updateGame(state, dt, handleEndGame, handleSeedCollect);
      // Apply screen shake
      if (state.shake.m > 0) {
        ctx.save();
        const sx = (Math.random() - 0.5) * state.shake.m * 2;
        const sy = (Math.random() - 0.5) * state.shake.m * 2;
        ctx.translate(sx + state.shake.x, sy + state.shake.y);
      }
      renderGame(ctx, state, settings.showOpponentNames);
      if (state.shake.m > 0) ctx.restore();
      // Throttle HUD React updates to ~20 fps (every 3 game frames at 60 fps)
      // to reduce React re-render overhead while keeping HUD visually smooth.
      hudFrameRef.current = (hudFrameRef.current + 1) % 3;
      if (hudFrameRef.current === 0) {
        setRunState({ ...state });
      }
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
      // rect is in CSS-scaled pixels; divide by the CSS→canvas scale ratio
      // so that mouseX/mouseY are in the same coordinate space as player.x/y.
      const scaleX = rect.width / W;
      const scaleY = rect.height / H;
      state.mouseX = (e.clientX - rect.left) / scaleX;
      state.mouseY = (e.clientY - rect.top) / scaleY;
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

  const isPlaying = gameState === 'playing';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        id="gc"
        width={W}
        height={H}
        style={{ display: 'block', cursor: isPlaying ? 'none' : 'default' }}
      />
      {isPlaying && runState && (
        <>
          <HUD state={runState} />
          <PauseOverlay visible={runState.paused} onReturn={handleReturnToGarden} />
        </>
      )}
      {isTouch && (
        <TouchControls stateRef={stateRef} visible={isPlaying && settings.touchControls} isMobile={isMobile} />
      )}
    </div>
  );
}
