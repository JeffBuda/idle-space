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

## Agent Development Guidelines (Learnings from Session History)

### Workflow & Verification

- **Always run the full verification pipeline before declaring work complete:**
  `npm run format` → `npm run lint` → `npm run test` → `npm run build`. Never skip any step — each catches different classes of errors that the others miss (formatting, static analysis, runtime behavior, production build).
- **Prettier is the single source of truth for formatting.** Never use text editor tools, custom `.cjs`/`.mjs` scripts, or manual find/replace to fix formatting — always run `npm run format`.
- **TypeScript Check:** `npx tsc --noEmit` produces pre-existing TS6305/TS6306/TS6310 errors (stale `.d.ts` files). Use `npm run build` (Vite) for the authoritative type check.
- **Git hygiene:** New work sessions should always start by pulling the latest `main` and creating a new feature branch off of it.

### Tooling Gotchas (Windows + PowerShell)

- **Editor Tool Bug:** Substring matching in `old_text` can double leading whitespace on this Windows + PowerShell setup. When replacing lines with leading whitespace, include the FULL original indentation in both `old_text` and `new_text`. For complex edits, use `node -e` to write files directly.
- **Shell Commands:** `cd /D` fails in PowerShell. Use absolute paths in `node -e` or `Set-Location`.
- **Git output parsing in PowerShell:** `git diff` and `git log` output can be truncated or garbled by PowerShell's line-wrapping. Use `--no-pager` flag or pipe through `findstr` for filtering.
- **GitHub CLI:** Installed at `C:\Program Files\GitHub CLI\gh.exe`. Use the full path or add the directory to PATH.
- **Terminal hygiene:** Always set `GIT_PAGER=cat` for git commands, use `--yes`/`-y` for package installs, append `-Force -Confirm:$false` to destructive PowerShell cmdlets, and never launch GUI editors.

### Code Quality Principles

- **SOLID & DRY:** Keep functions small, single-purpose, and DRY (Don't Repeat Yourself). Avoid duplicating logic across engine, components, and hooks layers — extract shared logic into the engine as pure functions.
- **Single Responsibility:** Each file/module should have one clear purpose. Engine files = pure game logic. Component files = presentation only. Hook files = bridge logic. Test files = test logic only. This makes files smaller and easier to edit without the editor tool's whitespace doubling bug on large files.
- **File size discipline:** Keep files small and focused. Large files are prone to editor tool failures (whitespace doubling, timeout errors). If a file grows beyond ~300 lines, consider extracting sub-components, sub-modules, or grouping related logic into separate files.
- **State immutability:** Never use `.push()`, `.splice()`, or direct object mutation. Always return a new state object via spread operators. This is enforced by the engine rules and ArchUnit tests.

### Testing Conventions

- **Component tests importing engine functions:** The ESLint `boundaries/dependencies` rule classifies test files by their file path's element type (e.g., `src/components/` → type `components`) AND their file category (`*.test.{ts,tsx}` → category `test`). Test files in `src/components/` that import from `src/engine/` violate the components→engine boundary. The ESLint boundary policies must exempt test files (`from: { file: { categories: '!test' } }`) from boundary restrictions.
- **E2E test timing:** Never inject state into IndexedDB AFTER the app has loaded — the app's auto-save interval (10s) will overwrite the injected state with the app's in-memory state. Always inject state BEFORE `page.goto('/')`.
- **Test isolation:** Tests that modify IndexedDB state must run in `test.describe.serial` blocks with `beforeEach` hooks that clear IndexedDB.
- **Deterministic seeds in E2E tests:** When E2E tests depend on procedurally-generated graph topology (e.g., star map node adjacency for non-adjacent-node rejection tests), always inject a known `rngSeed` into the game state via `writeGameState(page, { rngSeed: 'test-seed', starMap: null })` so the engine regenerates the star map deterministically from `state.rngSeed`. The game engine already supports full determinism via `createSeededRNG()` from `src/utils/rng.ts` — there is no need to override `crypto.getRandomValues` in the browser context. Without a fixed seed, the random extra-edges added by `generateStarMap` can create adjacency assumptions that fail ~15% of the time (flaky CI). Verify the chosen seed produces the expected graph topology (e.g., `sys_5` NOT adjacent to `sys_0` or `sys_1`) before committing (see `docs/e2e-testing-guide.md` §3).

### ESLint Boundaries Configuration

- The `eslint-plugin-boundaries` `boundaries/elements` patterns match by file path, while `boundaries/files` sets a file category. These are independent dimensions: a file at `src/components/Foo.test.tsx` has BOTH element type `components` AND file category `test`. Boundary policies that restrict `from: { element: { type: 'components' } }` will match test files too unless they also check `file: { categories: '!test' }`.
