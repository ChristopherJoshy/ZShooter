'use client';
import { useEffect, useRef, useCallback } from 'react';
import { clamp } from '@/lib/game/physics';
import type { GameRunState } from '@/lib/game/types';

type LoopFn = (dt: number) => void;

// Drives requestAnimationFrame with a normalized dt (≈1 at 60fps).
export function useGameLoop(active: boolean, fn: LoopFn): void {
  const fnRef = useRef<LoopFn>(fn);
  fnRef.current = fn;
  const lastTs = useRef<number>(0);
  const rafId = useRef<number>(0);

  const loop = useCallback((ts: number) => {
    const dt = clamp((ts - lastTs.current) / 16.667, 0, 3);
    lastTs.current = ts;
    fnRef.current(dt);
    rafId.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (!active) return;
    lastTs.current = performance.now();
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, [active, loop]);
}
