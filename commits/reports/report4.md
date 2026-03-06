# Report #4: Cross-Origin Auth & Vercel 404 Fix

**Author**: Christopher Joshy
**Date**: 2026-03-06

## Summary
Fixed a critical issue where account creation and login failed on Vercel due to absolute URL mismatches and CORS/Cookie policy restrictions.

## Changes
- **Frontend**:
    - Refactored `frontend/lib/api.ts` to use an absolute base URL from `process.env.NEXT_PUBLIC_API_URL` when available. This bypasses Vercel's proxy rewrite limitations for POST requests.
    - Simplified `frontend/next.config.mjs` by removing the `rewrites` block.
- **Backend**:
    - Updated `backend/src/server.ts` to allow `origin: true` in CORS settings, enabling dynamic origin reflection for cross-domain requests.
    - Updated `backend/src/routes/auth.ts` to use `SameSite: 'none'` and `Secure: true` for the authentication cookie in production. This is required for browsers to accept cookies in cross-origin scenarios (Vercel frontend -> Render backend).
    - Fixed `clearCookie` in logout to use matching options for proper removal.

## Verification
- Both repositories pass `npm run typecheck` with 0 errors.
- Verified absolute URL construction in `api.ts`.

## Proposed Commit Message
`fix(auth): enable cross-origin credentials and use absolute API paths for production #4`
