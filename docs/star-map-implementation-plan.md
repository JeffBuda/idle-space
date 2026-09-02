# Star Map Implementation Plan

> **Branch:** `feat/star-map-implementation-plan`
> **Status:** Planning document (pre-implementation)
> **Goal:** Plan a fully functional star map integrating with engine,
> immutable game state, debug logging, and the onboarding flow.

This plan is broken into per-phase detail files under `docs/star-map-plan/`:

| File                                                                                               | Phase                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------- |
| [phase-1-types-and-engine.md](./star-map-plan/phase-1-types-and-engine.md)       | TS types + engine functions     |
| [phase-2-state-and-migration.md](./star-map-plan/phase-2-state-and-migration.md) | GameState + migration           |
| [phase-3-hooks.md](./star-map-plan/phase-3-hooks.md)                             | Hook layer exposure             |
| [phase-4-components-and-css.md](./star-map-plan/phase-4-components-and-css.md)   | React components + CSS          |
| [phase-5-app-integration.md](./star-map-plan/phase-5-app-integration.md)         | App.tsx + PlanetHub integration |
| [phase-6-testing.md](./star-map-plan/phase-6-testing.md)                         | Unit, component, E2E tests      |
| [questions.md](./star-map-plan/questions.md)                                     | Open questions for review       |

---

## 1. Overview

The star map is a new top-level screen (`STAR_MAP`) in the game's flow. It displays
a graph of **10 star systems** (nodes) connected by **1-3 edges** per node. The player
plots a route by selecting destination nodes; the engine's **BFS pathfinding** computes
the actual edge-traversing path. Pressing **Go!** validates the route, persists it to
immutable game state, and navigates to **Approaching Planet** (`SPACE_TRAVEL`) with a
gate timer.

The existing `MockStarMap` (SettingsMenu sandbox) is a local-state UI prototype — it
will be kept as-is for UI iteration; the production screen lives in `screens/`.

---

## 2. Architecture Summary

```
src/types/game-state.ts         -> StarMapState, StarMapNode, StarMapEdge types (NEW)
src/engine/starmap.ts           -> Pure functions: generateStarMap, findPath, etc. (NEW)
src/engine/flow.ts              -> Update navigate() + processFlowAction() (MODIFY)
src/engine/reducer.ts           -> Routes new actions to starmap.ts (MODIFY)
src/db/index.ts                 -> GameState defaults + migration (MODIFY)
src/hooks/useGameState.ts       -> Expose starMap state + dispatch (MODIFY)
src/components/screens/StarMapScreen.tsx    -> Production component (NEW)
src/components/screens/StarMapScreen.css    -> Styles (NEW)
src/components/screens/PlanetHubScreen.tsx  -> "Chart Course" (MODIFY)
src/components/App.tsx          -> STAR_MAP render gate (MODIFY)
src/logging/logger.ts           -> Add STAR_MAP_* to ACTION_CATEGORY (MODIFY)
```

**Boundary rules** (ESLint `boundaries/dependencies` + `tests/architecture.test.ts`):

```
engine    -> {types} only
db        -> {types} only
hooks     -> {engine, db, types, logging, utils} (NO components)
components -> {types, hooks, utils, logging} (NO engine, NO db)
```

**Key constraint:** `StarMapScreen.tsx` cannot import `src/engine/` or `src/db/`.
All star map logic lives in `src/engine/starmap.ts`; the hook exposes data +
dispatch as props.

---

## 3. Data Model (Condensed)

```ts
// src/types/game-state.ts additions:

export type NodeStatus = 'current' | 'visited' | 'unknown';

export interface StarMapNode {
  id: string; name: string; x: number; y: number;
  status: NodeStatus; edges: string[];
}

export interface StarMapEdge { from: string; to: string; }

export interface StarMapRouteSegment {
  from: string; to: string; path: string[]; hops: number;
}

export interface StarMapState {
  nodes: StarMapNode[];
  edges: StarMapEdge[];
  plannedRoute: string[];
  currentLocationId: string;
  zoomLevel: number;
}

export type Screen =
  | 'WELCOME' | 'STAR_MAP' | 'SPACE_TRAVEL'
  | 'PLANET' | 'LANDING' | 'MINING';

// GameState additions:
  starMap: StarMapState | null;
  routePath: StarMapRouteSegment[];
  routeTravelTimeSeconds: number;

// GameAction additions:
  | { type: 'STAR_MAP_NODE_TOGGLE'; nodeId: string }
  | { type: 'STAR_MAP_REMOVE_STOP'; nodeId: string }
  | { type: 'STAR_MAP_CLEAR_ROUTE' }
  | { type: 'STAR_MAP_ZOOM_IN' }
  | { type: 'STAR_MAP_ZOOM_OUT' }
  | { type: 'STAR_MAP_GO' };
```

---

## 4. Navigation Flow

```
WELCOME -> (Launch!) -> SPACE_TRAVEL -> PLANET
  PLANET -> (Chart Course) -> STAR_MAP -> (Go!) -> SPACE_TRAVEL -> PLANET
  PLANET -> (Land) -> LANDING -> MINING -> (Back) -> PLANET
```

- **Go!**: dispatches `STAR_MAP_GO` (validate + persist), then `NAVIGATE to SPACE_TRAVEL`
- **SPACE_TRAVEL gate target** = `routeTravelTimeSeconds` [Q3: hop-based vs distance]
- **Back to Planet** on STAR_MAP: `NAVIGATE to PLANET` (clears route)
- **Entry to STAR_MAP from PLANET**: `generateStarMap(seed)` if `starMap === null`

---

## 5. Logging Strategy

All interactions flow through the existing `withLogging` interceptor (wraps
`engineReducer` in `useGameState.ts`). Every dispatched `GameAction` is logged to the
`space_idle_logs` IndexedDB store **except** `IDLE_PROGRESSION` (too frequent).

**New `ACTION_CATEGORY` entries** in `src/logging/logger.ts`:

| Action               | Category  | State Change?      |
| -------------------- | --------- | ------------------ |
| STAR_MAP_NODE_TOGGLE | GAME_FLOW | Yes (plannedRoute) |
| STAR_MAP_REMOVE_STOP | GAME_FLOW | Yes (plannedRoute) |
| STAR_MAP_CLEAR_ROUTE | GAME_FLOW | Yes (plannedRoute) |

---

## 6. Pathfinding Algorithm

**BFS (Breadth-First Search)** on an unweighted, undirected graph. The simplest
possible algorithm; O(V+E) time. Pure function in `src/engine/starmap.ts`.

**Algorithm steps:**

1. Build bidirectional adjacency list from `node.edges`
2. BFS from `start`, tracking parent pointers for path reconstruction
3. When `end` is reached, reconstruct path via parent chain
4. Return path as `[start, ..., end]` or `null` if unreachable

**Route computation:** `computeRoutePath()` calls `findPath()` between each
consecutive pair of waypoints in `plannedRoute`, using `currentLocationId` as the
implicit start of the first segment.

**Route validation:** `validateRoute()` calls `computeRoutePath()` and checks that
every segment has a non-null path. Also checks: no duplicate destinations, all
node IDs exist.

**Node removal:** `removeRouteNode()` removes a waypoint, then BFS-bridges the
gap between the nodes before and after the removed one. If the bridge fails, the
route is truncated.

---

## 7. Testing Strategy

| Layer        | Tool       | File                                            | Scope                                 |
| ------------ | ---------- | ----------------------------------------------- | ------------------------------------- |
| Engine       | Vitest     | `src/engine/starmap.test.ts`                    | Graph gen, BFS, validation, route ops |
| Component    | Vitest     | `src/components/screens/StarMapScreen.test.tsx` | Render, clicks, disabled states       |
| Architecture | ArchUnit   | `tests/architecture.test.ts`                    | Layer boundaries (auto-covered)       |
| E2E          | Playwright | `tests/e2e/star-map.spec.ts`                    | Full flow + IDB + logging             |

**Engine tests:**

- `generateStarMap`: 10 nodes, connected graph, 1-3 edges, deterministic by seed
- `findPath`: adjacent nodes, multi-hop, same node, unreachable, symmetry

---

## 8. Implementation Phases

| Phase | Title                  | Key Deliverables                                    | Files                                                                                        |
| ----- | ---------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     | Types & Engine         | StarMapState types, starmap.ts, flow.ts integration | `types/game-state.ts`, `engine/starmap.ts`, `engine/flow.ts`, `engine/starmap.test.ts`       |
| 2     | Game State & Migration | GameState additions, db defaults, migration         | `db/index.ts`, `engine/flow.test.ts`                                                         |
| 3     | Hooks                  | useGameState exposure, dispatch wiring              | `hooks/useGameState.ts`                                                                      |
| 4     | Components & CSS       | StarMapScreen.tsx + .css, PlanetHub changes         | `screens/StarMapScreen.tsx`, `.css`, `screens/StarMapScreen.test.tsx`, `PlanetHubScreen.tsx` |
| 5     | App Integration        | App.tsx render gate, callback wiring, App.test.tsx  | `App.tsx`, `App.test.tsx`                                                                    |
| 6     | Testing                | Full test suite, E2E, CI verification               | `tests/e2e/star-map.spec.ts`, `onboarding-sequence.spec.ts`                                  |

**Phase gate checklist (each phase):**

1. `npm run format` — Prettier auto-format
2. `npm run test` — All unit + component tests pass
3. `npm run build` — Production build succeeds (authoritative type check)
4. Architecture tests pass (`tests/architecture.test.ts`)
5. E2E tests pass (`npx playwright test`)

---

## 9. Open Questions

See `./star-map-plan/questions.md` for 8 critical decisions that
significantly affect the implementation. Please review before Phase 1.

Key decisions:

- **Q1:** Procedural graph (from rngSeed) vs. hardcoded 10-node graph?
- **Q2:** Does STAR_MAP replace "Depart" on Planet hub?
- **Q3:** Travel time: fixed, hop-based, or distance-based?
- **Q4:** How to log UI-only interactions (zoom)?
- **Q5:** Zoom state: persisted or ephemeral?
- **Q6:** Route selection: any node (pathfinding) or edge-adjacent only?
- **Q7:** Bottom pane: flow-screen pattern or bottom-sheet pattern?
- **Q8:** Star map accessible from Welcome screen?
