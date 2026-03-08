# Report 6: Fixed Enemy Position Indicator (Mobile & PC)

## Overview
The enemy position indicator (off-screen arrows) was broken on both mobile and PC. On mobile, arrows were often drawn in the cropped, invisible regions of the canvas, making them useless for tracking enemies. Additionally, the direction was based on the screen center, which felt counter-intuitive during high-mobility gameplay.

## Changes
- **Refined Off-Screen Tracking:** Updated `drawArrows` in `renderer.ts` to calculate the actual **visible rectangle** within the 1050x700 game space. This ensures indicators are always visible, regardless of the device's aspect ratio (clamping to screen edges instead of fixed canvas edges).
- **Player-Relative Direction:** Changed the indicator logic to point from the **Player's position** rather than the screen center. This provides a more accurate and intuitive sense of direction for incoming threats.
- **Responsive Clamping:** 
    - **Desktop:** Arrows clamp to the full 1050x700 arena (mg=26).
    - **Mobile:** Arrows clamp to the dynamic visible viewport based on the browser aspect ratio.
- **Visual Improvements:**
    - Increased indicator opacity to `0.55` for better visibility.
    - Scaled arrows up by **40% on mobile** for better readability on touch screens.
- **Renderer Integration:** Updated `renderGame` to pass the `isMobile` state to `drawArrows`.

## Impact
Players can now reliably track off-screen enemies across all devices, including ultra-wide and tall aspect ratios on mobile. The feedback is now more localized and accurate to the player's perspective.

## Verification
- Verified on PC (Fit mode) and simulated mobile (Fill mode) aspect ratios.
- `npm run typecheck` passed.

## Agent Attribution
Christopher Joshy (AI Agent)
