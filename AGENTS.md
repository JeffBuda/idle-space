# Space Exploration Idle PWA - Agent Instructions

You are an autonomous AI developer working on a pure client-side Progressive Web App (PWA) game.

## Project Identity & Architecture

- **Stack:** Vite, React 18+, TypeScript (Strict), Vitest (component/unit tests), Playwright (E2E tests).
- **Paradigm:** Strictly decoupled. The React presentation layer is entirely separated from the pure functional game engine.
- **Architecture:** Subdirectory-based organization:
  - `src/engine/` — Pure functional game logic (no React imports)
  - `src/hooks/` — React hooks that interface with the engine layer
  - `src/components/` — Presentational React components
  - `src/utils/` — Utility functions (formatting, calculations)
  - `src/db/` — IndexedDB persistence layer
- **Storage:** Purely client-side. No backend server. State persistence relies entirely on IndexedDB (via `idb`) and Service Workers for offline caching.

## Strict Rules of Engagement

1. **Never mutate state:** The game engine operates on a pure functional paradigm. All state transitions must return entirely new object references (using spread operators or structured cloning).
2. **Deterministic execution:** All procedural generation, calculations, and engine progression must accept a `Current Time` delta and an `RNG Seed` parameter to guarantee testable, repeatable determinism.
3. **No active background timers:** iOS Safari aggressively hibernates PWAs. Never use `setInterval` for core progression. Always calculate elapsed time deltas via UNIX timestamps when the app wakes (using the Page Visibility API).
4. **Separation of concerns:** Never perform game math inside React components. All game logic must live in `src/engine/` as pure functions. React components only consume immutable state passed from hooks.

## Deep Context

Before beginning complex architectural tasks, read `ARCHITECTURE.md` to understand the Space Idle economy, star map generation, and multi-layered testing pyramid (Node.js unit tests -> Vitest component tests -> Playwright WebKit E2E tests).

## Supplementary Documentation

- **MEMORY.md** — Detailed implementation notes, gotchas, and development history. Read for context on prior decisions.
- **docs/DESIGN_BIBLE.md** — Design system specification (tokens, components, conventions). ALWAYS read before implementing any UI or component change.
- **tests/e2e/** — Playwright E2E test conventions and user flow documentation.
