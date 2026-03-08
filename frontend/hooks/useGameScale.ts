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

      // Use Fill for all touch devices to use full screen, Fit for desktop/mouse.
      const scale = touch ? Math.max(vw / GAME_W, vh / GAME_H) : Math.min(vw / GAME_W, vh / GAME_H);
      
      // On mobile/touch, we resize the container to fill the viewport (Full Screen).
      // On PC, we keep it fixed at 1050x700 (Centered Box).
      const visibleW = touch ? vw / scale : GAME_W;
      const visibleH = touch ? vh / scale : GAME_H;

      el.style.width = visibleW + 'px';
      el.style.height = visibleH + 'px';
      
      el.style.position = 'absolute';
      el.style.top = '50%';
      el.style.left = '50%';
      el.style.transformOrigin = 'center center';
      el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      
      // Clear any leftover margin
      el.style.marginLeft = '';
      el.style.marginTop = '';

      // Calculate crop/safe area offsets (how much we are shifted relative to game center)
      // Since the canvas is 1050x700 but the container is now visibleW x visibleH,
      // we need to offset children that want to stay in "game space" vs "screen space".
      // But for HUD, we actually want it to stay in "screen space" (the container).
      const cropX = Math.max(0, (GAME_W - visibleW) / 2);
      const cropY = Math.max(0, (GAME_H - visibleH) / 2);
      el.style.setProperty('--crop-x', `${cropX}px`);
      el.style.setProperty('--crop-y', `${cropY}px`);

      if (touch) {
        el.style.borderRadius = '0';
        el.style.boxShadow = 'none';
        if (wrap) wrap.style.background = '#1a1410';
      } else {
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
