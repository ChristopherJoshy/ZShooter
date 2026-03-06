'use client';
import { useEffect, useRef } from 'react';
import type { GameRunState } from '@/lib/game/types';
import { W, H } from '@/lib/game/constants';
import { startAudio } from '@/lib/game/audio';

// Deadzone radius before joystick registers movement
const DEADZONE = 12;
// Max joystick knob displacement in px (visual only — direction is normalised)
const KNOB_MAX = 48;

interface TouchControlsProps {
  stateRef: React.RefObject<GameRunState | null>;
  /** Only renders controls when visible (game is playing) */
  visible: boolean;
}

export default function TouchControls({ stateRef, visible }: TouchControlsProps) {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const fireZoneRef = useRef<HTMLDivElement>(null);
  const abilBtnRef = useRef<HTMLButtonElement>(null);

  // Track active touch IDs so left/right zones don't steal each other's touches
  const joystickTouchId = useRef<number | null>(null);
  const joystickOrigin = useRef<{ x: number; y: number } | null>(null);
  const fireTouchId = useRef<number | null>(null);

  // Joystick: inject WASD-equivalent keys + aim direction into state
  const applyJoystick = (dx: number, dy: number) => {
    const state = stateRef.current;
    if (!state) return;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < DEADZONE) {
      state.keys['KeyW'] = false;
      state.keys['KeyS'] = false;
      state.keys['KeyA'] = false;
      state.keys['KeyD'] = false;
      return;
    }
    const nx = dx / len;
    const ny = dy / len;
    state.keys['KeyW'] = ny < -0.35;
    state.keys['KeyS'] = ny > 0.35;
    state.keys['KeyA'] = nx < -0.35;
    state.keys['KeyD'] = nx > 0.35;
  };

  const resetJoystick = () => {
    const state = stateRef.current;
    if (state) {
      state.keys['KeyW'] = false;
      state.keys['KeyS'] = false;
      state.keys['KeyA'] = false;
      state.keys['KeyD'] = false;
    }
    joystickTouchId.current = null;
    joystickOrigin.current = null;
    const base = joystickBaseRef.current;
    const knob = joystickKnobRef.current;
    if (base) base.style.opacity = '0';
    if (knob) { knob.style.transform = 'translate(-50%,-50%)'; }
  };

  useEffect(() => {
    if (!visible) return;

    const joystickZone = document.getElementById('tc-left');
    const fireZone = fireZoneRef.current;
    const abilBtn = abilBtnRef.current;
    if (!joystickZone || !fireZone || !abilBtn) return;

    // ── Joystick ────────────────────────────────────────────────────────────

    const onJoyStart = (e: TouchEvent) => {
      e.preventDefault();
      startAudio();
      if (joystickTouchId.current !== null) return; // already tracking one finger
      const touch = e.changedTouches[0];
      joystickTouchId.current = touch.identifier;
      joystickOrigin.current = { x: touch.clientX, y: touch.clientY };

      const base = joystickBaseRef.current;
      if (base) {
        base.style.left = touch.clientX + 'px';
        base.style.top = touch.clientY + 'px';
        base.style.opacity = '1';
      }
      const knob = joystickKnobRef.current;
      if (knob) knob.style.transform = 'translate(-50%,-50%)';
    };

    const onJoyMove = (e: TouchEvent) => {
      e.preventDefault();
      if (joystickTouchId.current === null || !joystickOrigin.current) return;
      let touch: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;
      const dx = touch.clientX - joystickOrigin.current.x;
      const dy = touch.clientY - joystickOrigin.current.y;
      applyJoystick(dx, dy);

      // Update knob visual
      const knob = joystickKnobRef.current;
      if (knob) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const clampLen = Math.min(len, KNOB_MAX);
        const angle = Math.atan2(dy, dx);
        const kx = Math.cos(angle) * clampLen;
        const ky = Math.sin(angle) * clampLen;
        knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      }

      // Also update aim: point mouseX/mouseY away from player center in joystick direction
      const state = stateRef.current;
      if (state) {
        const len2 = Math.sqrt(dx * dx + dy * dy);
        if (len2 > DEADZONE) {
          state.mouseX = state.player.x + (dx / len2) * 300;
          state.mouseY = state.player.y + (dy / len2) * 300;
        }
      }
    };

    const onJoyEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          resetJoystick();
          break;
        }
      }
    };

    joystickZone.addEventListener('touchstart', onJoyStart, { passive: false });
    joystickZone.addEventListener('touchmove', onJoyMove, { passive: false });
    joystickZone.addEventListener('touchend', onJoyEnd, { passive: false });
    joystickZone.addEventListener('touchcancel', onJoyEnd, { passive: false });

    // ── Fire zone ───────────────────────────────────────────────────────────

    const onFireStart = (e: TouchEvent) => {
      e.preventDefault();
      startAudio();
      if (fireTouchId.current !== null) return;
      const touch = e.changedTouches[0];
      fireTouchId.current = touch.identifier;
      const state = stateRef.current;
      if (state) {
        state.autoFire = true;
        // Update aim to touch position mapped to canvas space
        const canvasEl = document.getElementById('gc') as HTMLCanvasElement | null;
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          state.mouseX = touch.clientX - rect.left;
          state.mouseY = touch.clientY - rect.top;
        }
      }
    };

    const onFireMove = (e: TouchEvent) => {
      e.preventDefault();
      if (fireTouchId.current === null) return;
      let touch: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === fireTouchId.current) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;
      const state = stateRef.current;
      if (state) {
        const canvasEl = document.getElementById('gc') as HTMLCanvasElement | null;
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          state.mouseX = touch.clientX - rect.left;
          state.mouseY = touch.clientY - rect.top;
        }
      }
    };

    const onFireEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === fireTouchId.current) {
          fireTouchId.current = null;
          const state = stateRef.current;
          if (state) state.autoFire = false;
          break;
        }
      }
    };

    fireZone.addEventListener('touchstart', onFireStart, { passive: false });
    fireZone.addEventListener('touchmove', onFireMove, { passive: false });
    fireZone.addEventListener('touchend', onFireEnd, { passive: false });
    fireZone.addEventListener('touchcancel', onFireEnd, { passive: false });

    // ── Ability button ──────────────────────────────────────────────────────

    const onAbilTouch = (e: TouchEvent) => {
      e.preventDefault();
      const state = stateRef.current;
      if (state) state.justPressed['Space'] = true;
    };

    abilBtn.addEventListener('touchstart', onAbilTouch, { passive: false });

    return () => {
      joystickZone.removeEventListener('touchstart', onJoyStart);
      joystickZone.removeEventListener('touchmove', onJoyMove);
      joystickZone.removeEventListener('touchend', onJoyEnd);
      joystickZone.removeEventListener('touchcancel', onJoyEnd);
      fireZone.removeEventListener('touchstart', onFireStart);
      fireZone.removeEventListener('touchmove', onFireMove);
      fireZone.removeEventListener('touchend', onFireEnd);
      fireZone.removeEventListener('touchcancel', onFireEnd);
      abilBtn.removeEventListener('touchstart', onAbilTouch);
      resetJoystick();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* Left half — joystick zone */}
      <div id="tc-left" className="tc-zone tc-left" />

      {/* Right half — fire zone */}
      <div ref={fireZoneRef} className="tc-zone tc-right" />

      {/* Ability button — bottom right corner */}
      <button ref={abilBtnRef} className="tc-abil-btn" aria-label="Use ability">
        <span className="tc-abil-icon">✦</span>
        <span className="tc-abil-label">ABILITY</span>
      </button>

      {/* Joystick visuals — absolutely positioned, repositioned on each touch start */}
      <div ref={joystickBaseRef} className="tc-joy-base">
        <div ref={joystickKnobRef} className="tc-joy-knob" />
      </div>
    </>
  );
}
