# Report 8: Fixed Sluggish Movement & Frame-Independent Physics

## Overview
The player and enemy movement felt "sluggish" and exhibited periodic "stopping" hitches. This was caused by the game loop's physics being heavily frame-dependent. Many calculations (velocity interpolation, damping/friction, and particle movement) were using fixed constants that did not account for the variable time between frames (`dt`). On devices where the frame rate fluctuated or when micro-stutters occurred, the movement speed would drop or feel inconsistent because the physics were "falling behind" the real-time clock.

## Changes
- **New Physics Helpers:** Added `lerpDt` and `expDt` to `frontend/lib/game/physics.ts`. These functions use exponential decay formulas (`1 - Math.pow(1 - t, dt)`) to ensure that interpolation and friction feel identical regardless of the frame rate (30fps, 60fps, 144fps, etc.).
- **Frame-Independent Velocity:** Updated `updPlayer` and `updEnemies` in `updater.ts` to use `lerpDt` for all velocity changes and `expDt` for damping. This ensures that the time-to-reach-target-speed is consistent across all devices.
- **Damping & Friction Fixes:** Replaced fixed multiplication (e.g., `vx *= 0.9`) with `expDt(vx, 0.9, dt)`, which correctly scales the friction based on the time delta.
- **Background & Particle Smoothness:** Updated `drawBgPetals`, `updParticles`, and `updSeeds` to correctly multiply all movement and oscillations by `dt`. This fixes the "jittery" or "stopping" look of the background elements during frame drops.
- **Consistent Loop Timing:** Verified that `requestAnimationFrame` and `dt` calculation in `useGameLoop` are accurately measuring the time since the last frame.

## Impact
- Movement now feels "butter smooth" and consistent, even during occasional frame drops.
- Hitches are no longer visible as the physics now "skips" correctly to maintain constant real-time speed.
- The game feels much more responsive and "alive," as the animations and movement are no longer tied to a fixed 60Hz update rate.

## Verification
- Verified smooth movement across simulated 30fps and 60fps environments.
- `npm run typecheck` passed.

## Agent Attribution
Christopher Joshy (AI Agent)
