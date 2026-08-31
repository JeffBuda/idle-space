# Feature Design Doc — Welcome Onboarding Flow

> **Status:** Plan / Proposed — not yet implemented.
> **Companion to:** `docs/DESIGN_BIBLE.md` (routing, layout, conventions),
> `ARCHITECTURE.md` (layering, data flow), `.clinerules/engine.md` (pure
> functions, immutability, no DOM/timers), `.clinerules/ui.md` (presentational
> only, props-driven), `.clinerules/e2e.md` (serial blocks, viewport, IDB state
> verification).

## TL;DR

A **linear-ish state machine** (driven by the pure game engine, not React) that
takes a brand-new player from a **Welcome** screen through **Space Travel →
Planet (hub) → Landing → Mining → Planet**, with idle-countdown gates and
`Faster!` buttons that reduce the remaining time 1s per click. The whole flow is
timestamp-driven so it survives iOS hibernation, and the 30s base cost is a
GameState knob that tests override to `1` for speed.

## 1. Overview & Goals

### What

Introduce a **new-game onboarding flow** that runs when `GameState` indicates a
fresh save (see §4 detection rule). The flow gates progression behind short idle
countdowns (30 s / 60 s) that the player can:

1. **actively wait out** while watching a countdown (the phone stays on-screen),
2. **fast-forward** by tapping **Faster!** (−1 s per tap), or
3. **truly idle** the app / background the tab — the countdown continues to tick
   down against a real timestamp and survives iOS hibernation on resume.

### Goals

- Engine is the single source of truth for the screen state machine; React only
  renders the current `screen` and dispatched callbacks.
- Zero `setInterval`-based _core progression_. Time is computed from UNIX
  timestamps (`lastTimestamp`-style deltas), per `.clinerules/engine.md`.
- Full testability: a GameState knob shrinks the 30 s base cost so the Playwright
  **Sequence** test traverses a full cycle in seconds, not minutes.
- ≥80 % unit-test coverage of the new engine modules.

### Non-goals

- No new artwork/icons/copy v1.0 beyond placeholder tone-matching text.
- No star-map canvas, market, or ship-upgrades (out of scope for this flow).
- No changes to the existing `elapsedSeconds`/`totalDistanceKm` idle-distance
  progression math (it keeps working; see §4).

## 2. User Flow (state machine)

```mermaid
stateDiagram-v2
  [*] --> WELCOME : new save (totalElapsedGameTime === 0)
  WELCOME --> SPACE_TRAVEL : Launch! (initializes state)
  SPACE_TRAVEL --> PLANET : 30s gate cleared (idle +/or Faster!)
  PLANET --> LANDING : Land (start 30s gate)
  PLANET --> SPACE_TRAVEL : Depart (restart 30s gate)
  LANDING --> MINING : 30s gate cleared
  MINING --> PLANET : mine complete (Common 30s / Rare 60s gate cleared, ore +1)
  MINING --> PLANET : Launch! (abort, no ore awarded)
  note right of SPACE_TRAVEL,MINING
    Faster! reduces remaining by 1s per tap.
    Navigating away mid-gate resets the clock on re-entry.
  end note
```

**Rules enforced by the engine (§5):**

- Exactly **one active `idleTimer`** at a time. Switching screens before a timer
  hits 0 **discards** it; re-entering restarts from the screen's base cost.
- From **Mining**, pick **either** Common Ore (30 s) **or** Rare Ore (60 s) —
  not both. Switching ore before completion resets the target.
- **Launch!** from Mining is an immediate, unconditional escape — no ore.
- All transitions are **validated**. An illegal dispatch returns the previous
  state unchanged and logs a `VALIDATION_ERROR` (§5.3).

## 3. GameState schema

The game currently has **two** hand-maintained `GameState` copies —
`src/engine/time.ts` and `src/db/index.ts` (see ARCHITECTURE §6 "duplicate
GameState"). This feature adds flow state, so we **move a single canonical
`GameState` to a shared location** (answer 4: shared type).

**Proposed shared type — `src/engine/types.ts` (new):**

```ts
/** Canonical, engine-owned game state. Persisted verbatim by src/db/. */
export type Screen = 'WELCOME' | 'SPACE_TRAVEL' | 'PLANET' | 'LANDING' | 'MINING';

export interface IdleTimer {
  screen: Screen; // which screen owns this timer
  targetSeconds: number; // goal (base cost; e.g. 30 or 60)
  remainingSeconds: number; // decremented by elapsed time + Faster! taps
  startedAt: number; // UNIX ms timestamp; recompute remaining on wake
}

export type OreType = 'commonOre' | 'rareOre';

export interface GameState {
  // …existing fields (kept) …
  lastTimestamp: number;
  totalDistanceKm: number;
  rngSeed: string;
  version: string;

  // …new flow fields…
  /** Total seconds of game life so far; 0 => first run => show Welcome. */
  totalElapsedGameTime: number; // see OPEN Q4 (rename vs. add)
  /** Current screen in the onboarding flow. */
  screen: Screen;
  /** The one active idle countdown, or null. */
  idleTimer: IdleTimer | null;
  /** Resource tallies awarded by mining completion. */
  oreCounts: { commonOre: number; rareOre: number };
  /** Tunable game constants (persisted so tests can override them). */
  constants: {
    /** Base seconds for a fresh idle gate. Default 30. Tests override to 1. */
    defaultActionTimeSeconds: number;
    /** Multiplier applied per screen to compute a gate's target
     *  (e.g. Rare Ore = 2x => 60 s). */
    rareOreTimeMultiplier: number;
  };
  /**
   * Transient engine error message. Set to a human-readable string on an
   * illegal transition, `null` otherwise. NOT persisted to IndexedDB
   * (stripped by useGameState before save) so saved games stay clean
   * (see OPEN QA).
   */
  lastError: string | null;
}
```

**Detection rule (confirmed answer 5):** a _brand-new_ save has
`totalElapsedGameTime === 0` ⟹ the engine/App renders the `WELCOME` screen.
Any persisted save with `totalElapsedGameTime > 0` resumes directly on its last
`screen`; Welcome never re-appears for returning players.

**IdleTimer time model (confirmed answers 7 & 14):** `remainingSeconds` is a
stored field, **not** derived purely from `startedAt`. It is decremented in two
ways, both pure:

| Event                                    | Effect on `idleTimer.remainingSeconds`                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| Real-time/idle tick (`IDLE_PROGRESSION`) | `−= floor((now − startedAt)/1000)`; then `startedAt ← now` |
| `Faster!` tap (`HURRY`)                  | `−= 1`, clamped ≥ 0                                        |
| Timer reaches `0`                        | transition permitted (`COMPLETE_ACTION`)                   |

Because `remainingSeconds` is _persisted_, a 30 s gate backgrounded at
`15 s remaining` wakes at `15 s remaining` (minus clock drift during sleep) —
the count does **not** restart. This is what "idle the phone and the phone
counts for you" means in practice.

## 4. Engine design

### 4.1 Module split (confirmed answer 17)

Per "separate the idle time reducer from the game flow reducer":

- **`src/engine/time.ts`** — keep idle/timestamp math. Extend
  `processIdleProgression` (or add a sibling `processIdleTick`) so the 1 s real-time
  tick also advances `idleTimer.remainingSeconds` from `startedAt`. **No React,
  no DOM, no `Date`** — `currentTime` passed in explicitly.
- **`src/engine/flow.ts`** (new) — the **state machine**: `Screen` enum, the
  transition table, validation, and the new `GameAction` cases. Pure functions.
- **`src/engine/reducer.ts`** — keep the existing `engineReducer` switch; it routes
  `IDLE_PROGRESSION`/`APP_WAKE`/`APP_SUSPEND` to `time.ts` and the new action
  types to `flow.ts`.

Architecture lint stays green: `engine/` must not import `db`/`hooks`/`components`
(see `tests/architecture.test.ts`). `db/` keeps its own GameState-shaped type but we
align the field set with the shared `src/engine/types.ts`.

### 4.2 New `GameAction` variants

```ts
export type GameAction =
  | { type: 'IDLE_PROGRESSION' } // 1s tick — advances elapsed + idleTimer
  | { type: 'APP_WAKE' } // resume from idle (logged APP_EVENT)
  | { type: 'APP_SUSPEND' } // going idle (logged APP_EVENT)
  | { type: 'NAVIGATE'; to: Screen } // request a screen change
  | { type: 'HURRY'; bySeconds?: number } // Faster! (default 1)
  | { type: 'COMPLETE_ACTION' } // gate hit 0 -> advance per table
  | { type: 'ORE_SELECTED'; ore: OreType } // pick Common/Rare on Mining
  | { type: 'START_ACTION' }; // begin the gate for the current screen
```

`HURRY` / `NAVIGATE` / `ORE_SELECTED` / `START_ACTION` / `COMPLETE_ACTION` are
user-initiated events — routed through `withLogging` (answer 9) into a new
`GAME_FLOW` log category.

### 4.3 Transition table & validation

The engine **rejects** illegal transitions by returning `prevState` unchanged.
Each rejected transition is recorded as a log entry (§4.4).

| From         | Trigger                           | To           | Preconditions                                 |
| ------------ | --------------------------------- | ------------ | --------------------------------------------- |
| WELCOME      | `NAVIGATE TO SPACE_TRAVEL`        | SPACE_TRAVEL | `totalElapsedGameTime === 0` (seeds state)    |
| SPACE_TRAVEL | gate `remaining ≤ 0`              | PLANET       | requires active timer on SPACE_TRAVEL         |
| PLANET       | `NAVIGATE TO LANDING`             | LANDING      | none                                          |
| PLANET       | `NAVIGATE TO SPACE_TRAVEL`        | SPACE_TRAVEL | restarts 30 s gate                            |
| LANDING      | gate `remaining ≤ 0`              | MINING       | requires active timer on LANDING              |
| MINING       | gate `remaining ≤ 0` + ore chosen | PLANET       | awards `oreCounts[ore] += 1`                  |
| MINING       | `NAVIGATE TO PLANET`              | PLANET       | immediate; **no** ore awarded (Launch!/abort) |

**Illegal example:** `NAVIGATE TO LANDING` while on `SPACE_TRAVEL` returns the
previous state and logs `VALIDATION_ERROR` (answer 8).

### 4.4 Logging categories (proposed, OPEN Q10)

```ts
export enum LogCategory {
  APP_EVENT = 'APP_EVENT', // existing: wake/suspend
  GAME_FLOW = 'GAME_FLOW', // new: navigate, hurry, complete, ore
  VALIDATION_ERROR = 'VALIDATION_ERROR', // new: rejected transitions
}
```

The 1 s `IDLE_PROGRESSION` tick is **excluded** from logging (flood control —
mirrors the existing skip in `withLogging`).

## 5. Screens & data-testid registry

Per `docs/conventions.md`, every interactive element gets a `data-testid`
(kebab-case) and every component root. Screens are **full `<main>` content
swaps** (answer 15). The Welcome screen is also a full swap (not a modal) — see
OPEN Q1 if you'd prefer a centered modal like `OfflineGreeting`.

### 5.1 Screen → testid map

| Screen       | Root testid      | Key interactive testids                                                                                     |
| ------------ | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Welcome      | `welcome-screen` | `welcome-launch-btn`                                                                                        |
| Space Travel | `space-travel`   | `space-travel-progress`, `space-travel-faster-btn`                                                          |
| Planet       | `planet-screen`  | `planet-land-btn`, `planet-depart-btn`                                                                      |
| Landing      | `landing-screen` | `landing-progress`, `landing-faster-btn`                                                                    |
| Mining       | `mining-screen`  | `mining-common-ore-btn`, `mining-rare-ore-btn`, `mining-faster-btn`, `mining-launch-btn`, `mining-progress` |

### 5.2 Per-screen behaviour

- **Welcome** — intro copy (placeholder, §9) + `Launch!` (`welcome-launch-btn`).
  On click: engine seeds state (`screen → SPACE_TRAVEL`, starts 30 s gate) and
  returns a new `GameState` (answer 12).
- **Space Travel** — countdown bar (`space-travel-progress`) + `Faster!`
  (`space-travel-faster-btn`). On gate `0` → `PLANET`.
- **Planet** — hub with `Land` (`planet-land-btn`) → `LANDING`, and `Depart`
  (`planet-depart-btn`) → `SPACE_TRAVEL` (restarts the 30 s gate).
- **Landing** — countdown + `Faster!` (`landing-faster-btn`). On `0` → `MINING`.
- **Mining** — two ore buttons set the target (Common 30 s / Rare 60 s), a shared
  `Faster!` (`mining-faster-btn`), a countdown (`mining-progress`), `Launch!`
  (`mining-launch-btn`, abort → `PLANET`, no ore). On gate `0` with ore chosen →
  `PLANET`, `oreCounts[ore] += 1` (answers 10 & 11).

### 5.3 Nav menu (Application Status move, answer 3)

"Application Status" becomes a **third toggle** in the existing `SettingsMenu`
dropdown, surfaced as a **modal/overlay** (mirroring `GameStateViewer` /
`DebugConsole`). Proposed testids: `toggle-app-status` (menu item),
`app-status-viewer` (modal root), `app-status-close`. The existing
`DebugConsole`/`GameStateViewer` panels are unaffected; only App.tsx's `<main>`
content changes.

## 6. Component & file layout

New files follow `docs/conventions.md` scaffolding (1 `.tsx` + 1 `.css` per
component, co-located `.test.tsx`):

```
src/
├── engine/
│   ├── types.ts          # (NEW) shared Screen/IdleTimer/GameState types
│   ├── time.ts           # (EXTEND) idle tick now advances idleTimer
│   ├── flow.ts           # (NEW) state machine + transition validation
│   ├── flow.test.ts      # (NEW) transition table + immutability tests
│   ├── reducer.ts        # (EXTEND) route new actions to flow.ts
│   ├── reducer.test.ts   # (EXTEND) new action cases
│   └── time.test.ts      # (EXTEND) idleTimer tick assertions
├── components/
│   └── screens/          # (NEW) one folder per screen
│       ├── WelcomeScreen.tsx  + .css + .test.tsx
│       ├── SpaceTravelScreen.tsx + .css + .test.tsx
│       ├── PlanetScreen.tsx     + .css + .test.tsx
│       ├── LandingScreen.tsx    + .css + .test.tsx
│       ├── MiningScreen.tsx     + .css + .test.tsx
│       └── AppStatusViewer.tsx  + .css + .test.tsx   # moved Application Status
├── hooks/
│   ├── useGameState.ts   # (EXTEND) expose dispatch + screen + oreCounts
│   └── useScreenRenderer.ts # (NEW) map state.screen -> component (no game math)
├── db/index.ts           # (ADOPT) align GameState shape; keep defaultActionTimeSeconds
├── logging/types.ts      # (EXTEND) add GAME_FLOW, VALIDATION_ERROR categories
└── ...
tests/e2e/
  └── onboarding-sequence.spec.ts  # (NEW) Sequence test — full cycle
```

**Architectural guardrails** (`tests/architecture.test.ts` stays green):

- `components/` must **not** import `engine/` or `db/` (no game math in JSX).
- `engine/` must **not** import `db/`, `hooks/`, `components/`, or `logging/`.
- `hooks/` bridges engine↔db↔React; must **not** import `components/`.
- `db/` must **not** import `engine/` (hence the **shared** `engine/types.ts` is
  imported by both — this is the one deliberate exception; we add an
  architecture rule to codify `db → engine/types.ts` only).

## 7. Testing strategy

### 7.1 Unit tests (Vitest) — primary coverage lever

All engine logic stays **pure** (`engine/` layer, no mocks). Target **≥80 %**
of the new engine modules.

- **`src/engine/flow.test.ts`** (new):
  - every **legal** transition advances `screen` correctly;
  - every **illegal** transition returns a **new ref** whose only changed field is
    `lastError` (string), all other fields byte-identical to `prevState`
    (immutability — answer 8 + answer 13);
  - `HURRY` reduces `idleTimer.remainingSeconds` by exactly 1, clamped ≥ 0;
  - `COMPLETE_ACTION` only advances when `remainingSeconds ≤ 0`;
  - `ORE_SELECTED` sets the Mining target — Common = `constants.defaultActionTimeSeconds`
    (30), Rare = `× rareOreTimeMultiplier` (60); resets the timer (answer 11);
  - `WELCOME → SPACE_TRAVEL` seeds `screen`, `lastTimestamp`, `startedAt`, and a
    fresh `idleTimer` (answer 12);
  - ore award: `oreCounts[ore] += 1` on completion — **never** on `Launch!` abort.
- **`src/engine/reducer.test.ts`** (extend): route new actions through
  `engineReducer`; verify `lastError` surfaces on rejected dispatches.
- **`src/engine/time.test.ts`** (extend): the 1 s tick now also decrements an
  active `idleTimer.remainingSeconds` from `startedAt`; verify hibernation deltas
  and negative-clamp (answers 4 & 7).
- **Component tests** (`*.test.tsx`): render each screen from a fixture
  `GameState`, assert `data-testid`s + button behaviour. Mock `useGameState`
  (mirror the existing `App.test.tsx` pattern).
- **`useGameState` save-stripping** (new test): assert `lastError` is omitted
  from the object passed to `saveGameState` (so it never pollutes IndexedDB —
  answer 13).

### 7.2 E2E Sequence tests (Playwright) — full cycle

New file: **`tests/e2e/onboarding-sequence.spec.ts`**,
`test.describe.serial` (mutates IndexedDB; per `.clinerules/e2e.md`).

```ts
test.use({ viewport: { width: 1280, height: 720 } });

test.describe.serial('Onboarding Flow — full user cycle', () => {
  // beforeEach: best-effort deleteDatabase('space_idle_db') then reload
  //             (mirrors debug-console.spec.ts cleanup pattern).

  test('full cycle: Welcome -> Space Travel -> Planet -> Landing -> Mining -> Planet (ore via UI)', async ({
    page,
  }) => {
    // 0) Seed speed knob BEFORE any navigation:
    //    write a GameState with constants.defaultActionTimeSeconds = 1
    //    to IDB pre-load (answers 2 & 16) so each 30s gate resolves instantly.
    // 1) Assert welcome-screen visible + totalElapsedGameTime === 0 in IDB.
    // 2) Click welcome-launch-btn        -> assert space-travel visible.
    // 3) Click space-travel-faster-btn   -> assert planet-screen (ore counts: 0/0).
    // 4) Click planet-land-btn           -> assert landing-screen.
    // 5) Click landing-faster-btn        -> assert mining-screen.
    // 6) Click mining-common-ore-btn, then mining-faster-btn
    //    -> assert planet-screen + a visible ore count of 1 (answer 11: UI reward).
    // 7) (per-step variant) Click planet-depart-btn -> assert space-travel again.
    // Assert BOTH UI (data-testids) and persisted IDB (screen, oreCounts, idleTimer).
  });
});
```

Design points:

- Speed comes **only** from the `constants.defaultActionTimeSeconds` knob (answer 16),
  not from time mocking — so the Sequence test stays a real idle-tick exercise.
- The Sequence test validates **UI side effects** (including the visible ore-count
  increment on Mining completion — answer 11). **Unit tests** own every engine
  state-value assertion (screen, remainingSeconds, oreCounts, lastError).
- A second, **per-step** focused serial test suite (same describe block) is added
  so a regression in _one_ gate doesn't hide in a passing full-cycle run (answer 12).

## 8. Impacted existing tests (must update — answer 18)

| File                                       | Current assertion                                                                                       | Required change                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/App.test.tsx`              | "Application Status" + "Engine" + "Build Info" render in `<main>`; SettingsMenu = 2 toggles             | Main now renders the Welcome/flow screen on a fresh save; Application Status is a 3rd nav toggle (`toggle-app-status` → `app-status-viewer`); mock `useGameState` to return `screen`/`oreCounts`/`constants`/`lastError`/`totalElapsedGameTime`. |
| `tests/e2e/pwa-launch.spec.ts`             | waits on `total-travel-time` (hidden on fresh save → now behind Welcome) and reads IDB `elapsedSeconds` | Seed a non-new state (or Launch! first) so the Engine card shows; update IDB shape: `elapsedSeconds` → `totalElapsedGameTime` + new fields.                                                                                                      |
| `tests/e2e/game-state-interaction.spec.ts` | clears `game_state`, reloads, asserts `elapsedSeconds > 0`                                              | Same rename + the reload now lands on Welcome (must Launch! before asserting).                                                                                                                                                                   |
| `tests/architecture.test.ts`               | engine/db isolation rules                                                                               | `db → engine/types.ts` becomes a **new, explicit** permitted dependency (codify it).                                                                                                                                                             |

> CI order is `lint → npm run test → build → npx playwright test` and is a hard
> gate before deploy (`deploy.yml`). Everything above must pass.

## 9. Open questions (resolved vs. still-decided)

**Resolved by your answers** (captured as decisions, listed for traceability):

- Q1 Welcome = full `<main>` swap on a fresh save (answer 9).
- Q3 time knob = `GameState.constants.defaultActionTimeSeconds` (answer 2).
- Q4 rename `elapsedSeconds` → `totalElapsedGameTime` is in scope (answer 3).
- Q5 idle gates run in background / survive hibernation (answer 4).
- Q7 only user-initiated events are logged; `IDLE_PROGRESSION` tick is silent
  (answer 7).
- Q9 illegal transition → previous state unchanged **except** `lastError` is set,
  and a `VALIDATION_ERROR` log entry is written (answer 13).
- Q10 `Constants` lives in GameState; Sequence test writes `defaultActionTimeSeconds=1`
  to IDB pre-load (answer 16).

**Still to decide (do NOT assume — block on these):**

| ID  | Question                                                                                                                                         | My proposed default (needs sign-off)                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| A   | **Where is `lastError` stripped before persist?** `useGameState` (hook) is cleanest — `db/` must not import `engine` types (architectural rule). | Strip in the hook before `saveGameState`.                                                          |
| B   | **Scope of `constants`.** Only `defaultActionTimeSeconds` (30) + `rareOreTimeMultiplier` (2 → 60s)? Or also per-screen base targets?             | Keep `defaultActionTimeSeconds` + `rareOreTimeMultiplier` only; all other gates derive from these. |
| C   | **Is `rareOreTimeMultiplier` mutable/persisted** (so tests/balance could tweak it), or a fixed engine constant?                                  | Persisted in `constants` (consistent with the "all tunables here" answer 2).                       |
| D   | **Error surfacing** — `lastError` is set by the engine; should the UI render it as a toast/banner, or is it debug-only for now?                  | UI: surfaced in DebugConsole only for v1 (deferred toast).                                         |
| E   | `useScreenRenderer` hook vs. an inline `switch` in `App.tsx`.                                                                                    | Hook (keeps `App.tsx` thin; testable).                                                             |

## 10. Phased implementation plan

1. **Types & schema** — add `src/engine/types.ts` (`Screen`, `IdleTimer`, `OreType`,
   canonical `GameState` incl. `constants` + `lastError`); adopt it in `db/index.ts`
   (drop the duplicate); update `GameStateViewer` + tests for the rename.
2. **Engine — flow** — add `src/engine/flow.ts` (transition table + pure handlers,
   `lastError` on reject); extend `reducer.ts` to route new actions to `flow.ts`;
   extend the `time.ts` tick to advance `idleTimer`. Add `flow.test.ts` + extend
   `reducer.test.ts`/`time.test.ts` (**unit coverage first — the validate gate**).
3. **Logging** — add `GAME_FLOW`/`VALIDATION_ERROR` categories (§4.4); wire
   illegal transitions through `withLogging`.
4. **Hook** — extend `useGameState` to expose `dispatch`, `screen`, `oreCounts`,
   `constants`; strip `lastError` before save (decision A); add
   `useScreenRenderer` (decision E).
5. **Components** — build `WelcomeScreen`, `SpaceTravelScreen`, `PlanetScreen`,
   `LandingScreen`, `MiningScreen`, `AppStatusViewer`; add the 3rd SettingsMenu
   toggle. Add component tests.
6. **App.tsx** — `<main>` swaps to `useScreenRenderer()`; render `WelcomeScreen`
   when `totalElapsedGameTime === 0` (answer 5/9).
7. **E2E Sequence** — add `onboarding-sequence.spec.ts` (full-cycle + per-step);
   update impacted existing tests (§8).
8. **Verify** — `npm run format` → `npm run test` → `npm run build` →
   `npx playwright test` (chromium + webkit). Update `docs/DESIGN_BIBLE.md`
   testid table + `ARCHITECTURE.md` layer diagram when stable.

<!-- END onboarding-flow -->
