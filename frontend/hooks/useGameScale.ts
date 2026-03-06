'use client';
import { useEffect, useState } from 'react';

const GAME_W = 1050;
const GAME_H = 700;

// Returns true if the primary input device is touch-based.
export function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

// Applies a CSS scale transform to #app so the canvas fills the viewport
// while maintaining the 3:2 aspect ratio. Recalculates on resize.
// Returns { isTouch } — true when a coarse/touch pointer is detected.
export function useGameScale(): { isTouch: boolean } {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(detectTouch());

    function apply() {
      const el = document.getElementById('app');
      if (!el) return;
      const scaleX = window.innerWidth / GAME_W;
      const scaleY = window.innerHeight / GAME_H;
      const scale = Math.min(scaleX, scaleY);
      el.style.transform = `scale(${scale})`;
    }
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  return { isTouch };
}
