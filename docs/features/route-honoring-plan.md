# Feature Design Doc - Honor Star Map Route on Approaching / Orbiting Planet

> **Status:** Planning — R1 resolved (immutable confirmed); line-ending policy pre-step done
> **Branch:** `feature/planet-route-honoring`
>
> **Goal:** Make Approaching Planet (`SPACE_TRAVEL`) and Orbiting Planet (`PLANET`) honor the
> star-map route; branch `Depart` to the star map when the route is exhausted / absent; surface
> the current planet name (from game state) on both screens.
>
> **No assumptions.** Each non-obvious choice is a locked `R#` decision; the only open item is
> in section 5.

---

## 1. Current State (what exists today — verified against live files)

- Approaching Planet = `SPACE_TRAVEL` (`SpaceTravelScreen.tsx`, title hard-coded "Approaching Planet").
- Orbiting Planet = `PLANET` (`PlanetHubScreen.tsx`, title hard-coded "Orbiting Planet X").
- `GameState.currentLocation: string` (already **non-null**, top-level, persisted) — see
  game-state.ts:148. JSDoc: "the player's current star system ID... Updated to the route's final
  destination when a route is confirmed (STAR_MAP_GO). Survives navigation away from the star map."
- `StarMapState` holds `nodes`, `plannedRoute: string[]`, `currentLocationId`, `zoomLevel` (game-state.ts:87-93).
- `STAR_MAP_GO` (reducer.ts:108-137): `confirmRoute(starMap, rngSeed)` -> `currentLocation` =
  **final** waypoint, `starMap.currentLocationId` = same final waypoint, starts **one combined**
  gate of whole-route `routeTravelTimeSeconds`. `plannedRoute` left unchanged.
- `flow.ts` `enterStarMap` (58-64): generates via `generateStarMap(rngSeed, currentLocation)`
  if `starMap === null`. New games seed the star map at init (R3) so this null-branch is only
  hit by **old saves** (R10 migration); it stays as the migration path. The star-map X-close
  (R11) must NOT null `starMap`, so this branch is no longer re-entered after a visit.
- `NAVIGATE STAR_MAP -> PLANET` (flow.ts:97-99): currently **nulls** `starMap`
  (`starMap: null`). Per new guidance this becomes a **non-state X-close** (see R11).
- `NAVIGATE WELCOME -> SPACE_TRAVEL` (flow.ts:73-84): sets `lastTimestamp=now`, starts a 30s gate.
  No star map, no route involved.
- `completeAction` SPACE_TRAVEL -> PLANET (flow.ts:154-155): just sets screen + clears timer. No
  route pop, no location advance.
- `Depart` (PlanetHub `data-testid="nav-space-travel"`) -> `NAVIGATE -> SPACE_TRAVEL` -> `startGate`
  (30s gate, no route awareness). A "Chart Course" button opens the star map.

---

## 2. Locked Decisions (R1-R11)

### R1 - State mutation contract [RESOLVED]

Engine rule forbids `push`/`splice`/mutation. Route model uses "pop a visited waypoint"
and "advance currentLocation". Confirmed by user: **(A) immutable** only — replace
`plannedRoute` with a new array (`slice(1)`) and update `currentLocation` via spread;
original arrays/objects are never mutated. ReactJS best practices on state management
and immutable state at all times. All engine code is pure and testable; no React imports
/ no DOM in `src/engine/`.

### R1b - Line-ending policy [PRE-STEP DONE]

Working-tree diffs were pure CRLF artifacts (`core.autocrlf=true`, no `.gitattributes`,
index already LF). Fixed by adding `.gitattributes` (`* text=auto eol=lf`) to lock LF
policy across platforms. No mass-rewrite; Prettier remains the sole formatting source of
truth (run via `npm run format` on touched files).

### R2 - Consolidate location to a single source of truth

`GameState.currentLocation` (already non-null, top-level) is the canonical player location.
The task is to make it the **sole** source of truth and stop redundant `StarMapState.currentLocationId`
drift:

- `generateStarMap(seed, currentNodeId)` already takes `currentLocation` (flow.ts:60) - keep it as the
  origin param, not `starMap.currentLocationId`.
- Remove `StarMapState.currentLocationId` (game-state.ts:88-93; used in starmap.ts:280/339 and
  reducer.ts:116-118/121). Route path math derives "origin" from `GameState.currentLocation`.
- `STAR_MAP_GO` sets **only** `GameState.currentLocation` (R5), not `starMap.currentLocationId`.
  Star-map component derives the "current" node marker from `GameState.currentLocation` at render.

### R3 - Star map + route seeded at new-game init

- New game generates the star map (`generateStarMap(rngSeed, currentLocation)`) at state init,
  so `starMap` is **non-null from the start** (NOT lazily generated on first star-map entry).
- `plannedRoute` seeded with one random planet P from the star map.
- `currentLocation: null` at init ("deep space" / pre-launch); P is the first destination.
- Invariant consequence: since `starMap` is non-null from init and Back is a non-state close (R11),
  `starMap.nodes` **always** contains `currentLocation`'s node once a location is set. Planet-name
  lookup can therefore never fail (no fallback needed -> answer A).

### R4 - Per-leg gates, not one combined gate

- Each waypoint hop = its own gate. Gate time = BFS hops(origin -> next) x 5s, clamped to a
  10s floor (via `estimateTravelTime`).
- First Launch! gate (null origin -> P): degenerate 0-hop path -> 10s floor.

### R5 - STAR_MAP_GO semantics (new)

- Sets `currentLocation = plannedRoute[0]` (next waypoint), starts Approaching gate for that leg.
- `starMap.plannedRoute` unchanged (cursor concept replaced by arrival pop).

### R6 - Pop at ARRIVAL (not departure)

- On `SPACE_TRAVEL -> PLANET` completion: `currentLocation = dest`; pop the reached waypoint
  from `plannedRoute` (`slice(1)`, immutable). During approach `plannedRoute[0] === dest`.

### R7 - Planet name source

- Both screens derive the title from `currentLocation` via a name lookup into
  `starMap.nodes`. Approach: `currentLocation` (P, not yet popped). Orbit: same.
- Must never be null (R3 seeds it).

### R8 - Depart branching (PlanetHub)

- If `plannedRoute` empty/null OR route exhausted -> open `STAR_MAP` (navigate), NOT
  `SPACE_TRAVEL`.
- If mid-route -> `NAVIGATE -> SPACE_TRAVEL` toward next waypoint (per-leg gate, R4).

### R9 - Welcome screen

- First Launch! sets `currentLocation = P`, starts the Approaching gate (R4 first leg).
- No Chart Course button on Welcome for a new game (route pre-seeded). Reachable later via
  PlanetHub after init planet is popped.

### R10 - Backward compatibility / migration

- Old saves (`currentLocation` populated, no route) treated as route-complete -> Depart opens
  star map (R8). Star map lazy-regenerates from seed (existing `enterStarMap` path).

### R11 - Star map close [UI NAV CHANGE]

`flow.ts` line 98 (`NAVIGATE STAR_MAP -> PLANET`) currently nulls `starMap`. Per new guidance:

- The star map's **Back** button is replaced by an **X close**.
- The X close is a **non-state screen change** only — it returns to `PLANET` (Orbiting Planet)
  and does **not** modify game state (no `starMap: null`).
- Net effect: `starMap` is never nulled by navigation, reinforcing R3's invariant. The star-map
  component derives current/visited markers from `GameState.currentLocation`.

---

## 3. Affected Tests (must update)

- `src/engine/reducer.test.ts` - `STAR_MAP_GO` sets `currentLocation` to first waypoint (R5).
- `src/engine/flow.test.ts` - gate timing / arrival pop (R4, R6).
- `src/components/App.test.tsx` - planet name from state (R7), Depart branching (R8).
- `tests/e2e/onboarding-sequence.spec.ts` - full new-game flow (R9 first leg, 10s gate).
- `tests/e2e/star-map.spec.ts` - Go/navigate flow (R5, R7).

---

## 4. Engine / UI Touchpoints

- `src/types/game-state.ts` - type `currentLocation: string | null`; drop
  `StarMapState.currentLocationId`.
- `src/engine/starmap.ts` - `confirmRoute`: single-leg setup (R5); thread `currentLocation` (R2).
- `src/engine/flow.ts` + `reducer.ts` - arrival pop (R6); Depart branch (R8); new-game star map
  init (R3); X-close star-map return to `PLANET` without nulling `starMap` (R11); keep
  `enterStarMap` null-branch as old-save migration (R10).
- `src/engine/starmap.ts` - `confirmRoute`: single-leg setup (R5); thread `currentLocation`
  (R2); add `seedInitialRoute(starMap, seed)` pure helper that picks P and returns a new
  `plannedRoute` (R3).
- `src/engine/` - new pure `createInitialGameState(seed): GameState` for new-game seeding
  (R3 + R12) — db layer cannot import engine, so seeding lives here (A).
- `src/components/App.tsx` - Welcome Launch! -> first leg (R9, R4).
- `src/components/screens/PlanetHubScreen.tsx` - Depart branches (R8); title from
  `currentLocation` (R7).
- `src/components/screens/SpaceTravelScreen.tsx` - title from state (R7).
- `src/components/screens/StarMapScreen.tsx` - derive current node from
  `GameState.currentLocation`; drop `currentLocationId` read (R2); Back button -> X close that
  returns to `PLANET` with no state mutation (R11).

---

## 5. Open Items

- None blocking. R1 (mutation) resolved (immutable). R1b (line endings) resolved
  (`.gitattributes` added). R4b (gate-time edge case) resolved = (A): `estimateTravelTime`
  per leg (hops x 5, clamped [10,300]); first-launch null-origin -> 10s floor.
  Implementation can begin on R2 (consolidate `currentLocation`) as the first code step.
