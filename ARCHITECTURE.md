# Space Exploration Idle PWA — Architecture

> **Status:** Working document — describes the intended target architecture and current state.

## 1. Overview

Space Exploration Idle PWA is a client-side Progressive Web App built with React 18, TypeScript, and Vite. It uses a **strict separation** between the React presentation layer and a pure functional game engine. There is no backend server.

## 2. Layer Architecture

```
src/
├── App.tsx              # Root component — orchestrates status UI + delegates to components
├── main.tsx            # Entry point (createRoot, SW registration)
├── index.css           # Global CSS reset and theme variables
├── App.css             # App-scoped component styles
├── db.ts               # IndexedDB persistence layer (idb v8 wrapper)
├── useGameState.ts     # Game state hook — interfaces engine with React
├── OfflineGreeting.tsx  # Modal component for offline greeting
├── OfflineGreeting.css  # Offline greeting styles
├── IOSInstallBanner.tsx # iOS "Add to Home Screen" install banner
├── IOSInstallBanner.css  # Banner styles
├── useIOSInstallPrompt.ts # iOS detection + install prompt logic
├── utils/
│   ├── time.ts        # Time formatting utilities (formatElapsedTime, calculateElapsedSeconds)
│   └── time.test.ts   # Unit tests for time utilities
├── engine/
│   ├── time.ts        # Pure functional game engine (processIdleProgression, GameState type)
│   └── time.test.ts   # Unit tests for engine logic (17 test cases)
└── components/         # Reserved for future component extraction
```

### Layer Responsibilities

| Layer           | Responsibility                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **engine/**     | Pure functions for game logic (time progression, RNG, distance calculation). No React imports. |
| **hooks/**      | (Planned) React hooks that bridge engine logic to component state.                             |
| **components/** | (Planned) Presentational React components that consume immutable state.                        |
| **utils/**      | Pure utility functions (formatting, parsing, calculations).                                    |
| **db/**         | IndexedDB persistence layer using `idb` (openDB). No game logic.                               |

## 3. Data Flow

```
IndexedDB (game_state) → useGameState hook → App.tsx → OfflineGreeting / Status UI
                                    ↑
                              Engine functions (processIdleProgression)
```

1. On page load or visibility change, `useGameState` calls `handleWake()`
2. `handleWake()` reads state from IndexedDB, calls `processIdleProgression()` with current timestamp
3. `processIdleProgression()` computes idle rewards purely (no side effects)
4. Updated state flows through React to all components via props
5. Real-time ticks update elapsed seconds while the page is visible
6. On pagehide/visibilitychange to hidden, state is saved back to IndexedDB

## 4. Testing Pyramid

| Layer             | Tool                            | Location                                   | Purpose                                           |
| ----------------- | ------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Unit              | Vitest + jsdom                  | `src/**/*.test.ts`                         | Engine logic, pure functions, utilities           |
| Component         | Vitest + @testing-library/react | `src/**/*.test.tsx`                        | React component rendering and behavior            |
| E2E (Basic)       | Playwright                      | `tests/e2e/pwa-launch.spec.ts`             | PWA shell, SW registration, IndexedDB persistence |
| E2E (Interactive) | Playwright (serial)             | `tests/e2e/game-state-interaction.spec.ts` | Offline greeting, dismissal, real-time increments |

> **Testing strategy:** New features must include tests at all three pyramid
> layers. See [docs/testing-strategy.md](./docs/testing-strategy.md) for the
> full strategy and [docs/e2e-testing-guide.md](./docs/e2e-testing-guide.md)
> for E2E-specific patterns and pitfalls.

## 5. Key Design Decisions

- **DB Version 2**: IndexedDB schema version 2 adds the `game_state` object store for progress data.
- **Time Calculation**: `elapsedSeconds` stored as integer (seconds). `lastTimestamp` in UNIX ms. Delta calculated as `Math.floor((now - lastTimestamp) / 1000)`.
- **Real-time Tick**: 1-second interval updates `elapsedSeconds` via `gameStateRef` (not React state) to avoid stale closures and effect re-runs.
- **Auto-Save**: Every 10 seconds, state is persisted to IndexedDB to handle iOS force-kills without `pagehide`.
- **Test Isolation**: E2E tests that modify IndexedDB state run serially (`test.describe.serial`) with `beforeEach` clearing the `game_state` store.

## 6. Gotchas & Constraints

- **iOS Safari**: 7-day Intelligent Tracking Prevention (ITP) wipes `localStorage`. Only IndexedDB is safe for persistence.
- **Editor Tool**: Substring replacement in the editor tool can double leading whitespace. Always include full original indentation in `old_text`, or use `node -e` to write files.
- **TypeScript**: `npx tsc --noEmit` produces pre-existing TS6305/TS6306/TS6310 errors due to stale `.d.ts` files. Use `npm run build` for authoritative type checking.
