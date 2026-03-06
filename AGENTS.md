# AGENTS.md — ZShooter

## Project Overview

ZShooter is a top-down shooter game with two parallel codebases that coexist:

1. **`zen-striker.html`** — Original single-file HTML5 canvas game (vanilla JS, no build)
2. **`backend/` + `frontend/`** — Full-stack rebuild: Fastify v5 + Next.js 15 App Router

```
zen-striker.html          ← original game (HTML + CSS + JS, all inline)
backend/                  ← Fastify v5 + TypeScript + MongoDB + Redis
frontend/                 ← Next.js 15 App Router + TypeScript + Canvas 2D
.agents/skills/           ← agent skill packs (guidance docs only)
skills-lock.json          ← agent skills lockfile
AGENTS.md                 ← this file
```

---

## Commands

### Backend (`backend/`)
```bash
npm run dev        # tsx watch src/server.ts  — live reload on port 4000
npm run build      # tsc → dist/
npm run start      # node dist/server.js
npm run typecheck  # tsc --noEmit
```

### Frontend (`frontend/`)
```bash
npm run dev        # next dev --port 3000
npm run build      # next build
npm run start      # next start
npm run typecheck  # tsc --noEmit
```

**No automated tests exist.** Both projects have zero test files. Validation is:
- `npm run typecheck` in each project (must pass at 0 errors)
- Manual browser play-testing for game features
- Browser DevTools console for JS errors

### Running the original game
```bash
# Open directly — no install needed
zen-striker.html

# Or serve locally
python -m http.server 8080   # http://localhost:8080/zen-striker.html
```

---

## Environment

- `backend/.env` — `PORT=4000`, MongoDB Atlas URI, Redis URI, JWT secret, `FRONTEND_URL`
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:4000`
- All `/api/*` requests from the frontend are proxied to the backend via `next.config.mjs` rewrites — no browser CORS issues
- Auth cookie: `zf_token`, `httpOnly`, `sameSite: lax`, 7-day JWT

---

## Backend Code Style (`backend/src/`)

**TypeScript config:** `strict: true`, `target: ES2022`, `module: NodeNext`.
All imports use `.js` extension (NodeNext resolution requires it):
```ts
import { authPlugin } from './plugins/auth.js';
```

**Fastify patterns:**
- Infrastructure plugins wrapped with `fastify-plugin` and registered in order: mongo → redis → auth → cookie → cors → rateLimit
- Route handlers are `async` functions returning `reply.status(N).send(obj)`
- Never `throw` inside route handlers for expected errors — always `return reply.status(N).send(...)`
- Rate limiting: `global: false`, applied via `onRoute` hook to auth endpoints only

**Validation:** Zod `.safeParse()` on `request.body`; return 400 on failure:
```ts
const parsed = schema.safeParse(request.body);
if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
```

**Error handling:**
- `try/catch` around JWT verification in middleware (returns 401 on failure)
- Redis errors silently swallowed with `.catch(() => null)` — cache is non-fatal
- No `try/catch` in business logic — let Fastify's error handler catch unexpected throws

**Naming:** `camelCase` functions and variables, `PascalCase` for Mongoose models and Zod schemas, `UPPER_SNAKE_CASE` for constants (`CACHE_KEY`, `CACHE_TTL`).

---

## Frontend Code Style (`frontend/`)

**TypeScript config:** `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`.
Path alias `@/` maps to the project root.

**Component structure:**
- Server components: `app/page.tsx`, `app/game/page.tsx` — no `'use client'`, do cookie reads + redirects
- Client components: prefix filenames with `_` for page-level client wrappers (`_GamePageClient.tsx`)
- All interactive components carry `'use client'` at the top
- Default exports for all components and pages; named exports for hooks and lib functions

**Imports — order:**
1. React / Next.js (`react`, `next/*`)
2. Internal hooks (`@/hooks/*`)
3. Internal context (`@/context/*`)
4. Internal lib (`@/lib/*`)
5. Sibling components
6. Types (use `import type` for type-only imports)

**React patterns:**
- Game loop mutable state lives in `useRef` — never in `useState` — to avoid re-renders during `requestAnimationFrame`
- Shallow-copy ref state into React context each frame for HUD components: `setRunState({ ...stateRef.current })`
- `useCallback` for all handlers passed as props
- Non-fatal API calls (save sync) swallow errors silently: `try { await api() } catch { /* non-fatal */ }`

**CSS:** All styles in `app/globals.css`. No CSS modules, no Tailwind. Class names are short/abbreviated (`g-header`, `col-ttl`, `ic-badge`). Never add inline `style={{ fontSize: N }}` overrides — use CSS classes instead. Minimum font size is 11px for labels, 12px for body text.

---

## Game Engine Code Style (`zen-striker.html` and `frontend/lib/game/`)

**`zen-striker.html` rules (strict):**
- `var` for all declarations; `const` only for top-level config (`PAL`, `SAVE_KEY`)
- No ES modules, no TypeScript, no `class` syntax, no arrow functions in hot paths
- All colors via `PAL.xxx` — never hardcode hex values in draw functions
- Entity factory functions return plain objects: `function makeBullet(...) { return { ... }; }`
- `try/catch` only around `localStorage` — never in game logic or rendering
- Audio only via `sfx(n)` → `tone(freq, type, dur, vol, delay)`; guard with `if (!AC) return;`
- Section delimiters: `// ══════════════════════════════════════════`

**`frontend/lib/game/` TypeScript port:**
- Mirrors zen-striker.html logic 1:1, translated to TypeScript interfaces and typed functions
- `physics.ts` — `lerp`, `clamp`, `rnd`, `dist`, `glow`, `h2r`
- `entities.ts` — factory functions (same pattern, now typed)
- `renderer.ts` — all Canvas 2D draw functions
- `updater.ts` — all game logic update functions
- `waves.ts` — wave configuration
- `constants.ts` — `PAL`, `W`, `H`, `STAT_DEFS`, `WEAPON_DEFS`, `ABILITY_DEFS`

**Naming conventions (both):**

| Pattern | Convention | Example |
|---|---|---|
| Variables / functions | `camelCase` | `gameState`, `spawnEnemy` |
| Update functions | `updXxx` | `updPlayer`, `updBullets` |
| Draw functions | `drawXxx` | `drawPlayer`, `drawBg` |
| Config constants | `UPPER_SNAKE_CASE` | `SAVE_KEY`, `COMBO_DUR` |
| Palette entries | `PAL.xxx` | `PAL.player`, `PAL.E.chaser` |

**Physics:** normalize all movement by `dt` (`x += vx * dt`). Use `clamp`, `lerp`, `dist` utilities rather than inline `Math.min/max` chains. Canvas origin is top-left; `W` and `H` are canvas width/height.

---

## What NOT to Do

- **Do not add a build step to `zen-striker.html`** — it must stay a single self-contained file
- **Do not add ESLint/Prettier** — the project has none and does not want them
- **Do not hardcode colors** in game draw functions — always use `PAL`
- **Do not use `class` syntax** in game code — factory functions only
- **Do not add inline `style={{ fontSize: N }}`** in React components — use CSS classes
- **Do not change `SAVE_KEY`** — invalidates all existing player saves
- **Do not add external asset files** (images, audio) to either project

---

## Available Agent Skills

| Skill | When to use |
|---|---|
| `game-engine` | Game loop, collision, Canvas/WebGL |
| `game-development/2d-games` | Sprites, physics, camera |
| `game-development/game-design` | Balancing, progression, GDD |
| `game-development/game-audio` | Web Audio API, sound design |
| `game-development/web-games` | Browser optimization, PWA |
| `level-design` | Wave design, difficulty pacing |
| `game-changing-features` | High-impact feature strategy |
| `webgl` | Shaders and visual effects |
| `performance` | Frame-rate optimization |
| `frontend-design` | UI screens, HUD, auth page |
| `senior-backend` | Fastify routes, Mongoose, Redis |
| `svg-logo-designer` | SVG logos and brand marks |
| `ui-ux-pro-max` | UI component design |

Load a skill with the `skill` tool before starting a matching task.
