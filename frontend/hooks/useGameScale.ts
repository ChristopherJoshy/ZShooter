'use client';
import { useEffect, useState } from 'react';

const GAME_W = 1050;
const GAME_H = 700;

// Returns true if the primary input device is touch-based.
export function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

// Detect if we're on a mobile/tablet touch device (not desktop)
export function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  // Use touch capability rather than width — more reliable across orientations
  return detectTouch() && window.matchMedia('(max-width: 1024px)').matches;
}

export function useGameScale(): { isTouch: boolean; isMobile: boolean } {
  const [isTouch, setIsTouch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const touch = detectTouch();
    setIsTouch(touch);

    function apply() {
      const el = document.getElementById('app');
      const wrap = document.getElementById('app-wrap');
      if (!el) return;

      // Prefer visualViewport so that mobile browser chrome (address bar,
      // nav bar) is excluded from the measured area — window.innerHeight
      // includes those areas on some Android browsers, causing a black strip.
      const vp = window.visualViewport;
      const vw = vp ? vp.width  : window.innerWidth;
      const vh = vp ? vp.height : window.innerHeight;
      const isMob = touch && vw <= 1024;
      setIsMobile(isMob);

      // Both paths use the same centering technique:
      //   position: absolute; top: 50%; left: 50%;
      //   transform-origin: top left;
      //   transform: translate(-50%, -50%) scale(N);
      //
      // This moves the element's top-left corner to the viewport centre,
      // then the translate(-50%,-50%) shifts it back by half its own size so
      // its centre aligns with the viewport centre. The subsequent scale()
      // radiates outward from that already-centred origin — no margin math
      // needed, no layout side-effects from CSS transform.

      el.style.width = GAME_W + 'px';
      el.style.height = GAME_H + 'px';
      el.style.position = 'absolute';
      el.style.top = '50%';
      el.style.left = '50%';
      el.style.transformOrigin = 'top left';
      // Clear any leftover margin from a previous path
      el.style.marginLeft = '';
      el.style.marginTop = '';

      if (isMob) {
        // Fill: scale so the larger dimension covers the viewport (may crop).
        const scale = Math.max(vw / GAME_W, vh / GAME_H);
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;
        el.style.borderRadius = '0';
        el.style.boxShadow = 'none';

        if (wrap) wrap.style.background = '#1a1410';
      } else {
        // Fit: scale so the entire canvas is visible (letterbox if needed).
        const scale = Math.min(vw / GAME_W, vh / GAME_H);
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;
        el.style.borderRadius = '';
        el.style.boxShadow = '';

        if (wrap) wrap.style.background = '';
      }
    }

    apply();
    const onOrientationChange = () => {
      // Delay to allow browser to update dimensions after rotation
      setTimeout(apply, 200);
    };
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', onOrientationChange);
    // visualViewport fires its own resize when the browser chrome shows/hides
    window.visualViewport?.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.visualViewport?.removeEventListener('resize', apply);
    };
  }, []);

  return { isTouch, isMobile };
}
