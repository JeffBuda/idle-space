# Star Map Implementation: Open Questions

> **Status:** Review before Phase 1 begins. These decisions significantly
> affect the engine types, component API, and test surface.

---

## Q1: Procedural Graph vs Hardcoded?

**Decision:** Procedural generation using `generateStarMap(seed)`.

**Pros:** Deterministic replay, single `starMap` state field, minimal storage
overhead (1 graph per save, ~small JSON), aligns with "deterministic execution"
rule and engine testability.

**Cons:** Harder to design specific routes for E2E tests; graph structure
unpredictable (though BFS guarantees connectivity).

**Rationale:** The engine rules require "deterministic execution via RNG seed."
A seeded PRNG graph satisfies this. E2E tests use known seeds and BFS to assert
reachability, not hardcoded positions. The existing `MockStarMap` uses hardcoded
data for the sandbox prototype; the production screen uses procedural.

**Impact if changed to hardcoded:** Would need to store 10 full node objects
in `GAME_STATE_DEFAULT`. No star map generation function needed. E2E tests
could assert exact node names.

---

## Q2: Does STAR_MAP Replace "Depart" on Planet Hub?

**Decision:** STAR_MAP is a **new button** ("Chart Course") alongside the existing
"Land" and "Depart" buttons on `PlanetHubScreen`.

**Rationale:** "Depart" starts a standard 30s SPACE_TRAVEL gate (existing flow).
"Chart Course" opens the star map for route planning, which then leads to
SPACE_TRAVEL with a **route-specific** gate time. Keeping both paths preserves
backward compatibility and gives players a choice.

**Impact if changed:** If STAR_MAP replaced "Depart", the `onNavigate('SPACE_TRAVEL')`
callback on PlanetHub would be removed, and all SPACE_TRAVEL would go through
the star map. Simpler but less flexible.

---

## Q3: Travel Time: Fixed, Hop-Based, or Distance-Based?

**Decision (tentative):** Hop-based — `5 seconds per hop`, clamped to [10, 300].

`estimateTravelTime(segments)` sums all `hops` across route segments, multiplies
by 5, and clamps. This is deterministic and testable without floating-point
distance calculations.

**Alternatives:**

- **Fixed (30s):** Simplest, but doesn't reward short routes.
- **Distance-based:** Sum Euclidean distances between consecutive nodes × speed.
  More "realistic" but harder to test deterministically and ties travel time
  to screen coordinates (a presentation concern).

**Open:** Should travel time use the `rngSeed`? No — it's derived purely from
the graph structure (deterministic by seed). No additional seed parameter needed.

---

## Q4: How to Log UI-Only Interactions (Zoom)?

**Decision:** Zoom actions ARE logged. `STAR_MAP_ZOOM_IN` and `STAR_MAP_ZOOM_OUT`
dispatch through `dispatch()`, which routes through `loggedReducer`, so
`withLogging` captures them automatically as `GAME_FLOW` category.

**Rationale:** Even though zoom doesn't change game progression, it IS a player
interaction that appears in the debug log for session replay. Since zoom is
implemented as a dispatched `GameAction` (not local React state), it's
automatically logged. This also means zoom is persisted on `StarMapState`
(see Q5).

**If zoom used local React state instead:** It would NOT be logged (no dispatch)
and NOT persisted. Simpler, less state, but loses session-replay fidelity.

---

## Q5: Zoom State — Persisted or Ephemeral?

**Decision (tentative):** Persisted. `zoomLevel` is a field on `StarMapState`
in `GameState`, saved to IndexedDB.

**Pros:** Player's preferred zoom level survives app restarts. Consistent with
"no localStorage" rule (state must use IndexedDB).

**Cons:** Adds 1 field to migration. Slight IDB write overhead on every zoom
(dispatch triggers `saveGameState`).

**If ephemeral:** `zoomLevel` would be `useState` in `StarMapScreen.tsx`,
not part of `StarMapState`. Simpler, fewer dispatches, no migration needed,
but resets on every visit.

---

## Q6: Route Selection — Any Node (Pathfinding) or Edge-Adjacent Only?

**Decision:** Any reachable node (pathfinding-based selection).

**Rationale:** BFS pathfinding (Phase 1 §1.2.3) finds the route between any
two reachable nodes. This is the existing `MockStarMap` behavior (click any
system to add it). Restricting to edge-adjacent only would be simpler but
less useful — players couldn't plan multi-hop routes visually.

**Edge case:** If a node is unreachable (disconnected graph — shouldn't happen
with the ring topology), clicking it is a no-op (toggleRouteNode returns
unchanged state, logged as `VALIDATION_ERROR` via `lastError`).

---

## Q7: Bottom Pane — Flow-Screen Pattern or Bottom-Sheet Pattern?

**Decision (tentative):** Bottom-sheet / fixed-panel pattern, rendered as part of
`StarMapScreen.tsx` itself (not a separate modal overlay).

**Rationale:** The star map needs continuous canvas interaction (panning,
zooming, clicking nodes) while the player reads their itinerary and presses
"Go!". A bottom-sheet that overlays the lower third of the SVG canvas keeps
both interactions visible simultaneously. A flow-screen modal would hide the
graph when showing the itinerary.

**Alternatives:**

- **Flow-screen:** Navigate to a separate "Route Summary" screen. Cleaner
  separation but requires an extra navigation step.
- **Bottom-sheet:** Fixed at bottom, always visible. Matches the existing
  `MockStarMap` prototype behavior (bottom sheet expands/collapses).

**Open:** Should the route panel collapse to a mini-bar when the player
scrolls/pzooms the canvas? [Q5: zoom affects panel visibility]

---

## Q8: Star Map Accessible from Welcome Screen?

**Decision:** No. Star map is only accessible from the **Planet Hub** screen
(via "Chart Course" button), after the player completes the SPACE_TRAVEL gate
to arrive at the planet.

**Rationale:** The star map is a mid/late-game feature. Opening it from the
Welcome screen creates a flow bypass (WELCOME -> STAR_MAP -> SPACE_TRAVEL)
that skips the launch animation and initial gate. This would complicate
the onboarding flow tests and the `flow.ts` navigation state machine.

**If needed in future:** Add `case 'WELCOME':` to `navigate()` with a
`to === 'STAR_MAP'` branch. Requires `generateStarMap(state.rngSeed, 'sys_0')`
call (same as PLANET -> STAR_MAP). Easy to add later.

---

## Unresolved: CSS Transition for SVG Zoom

The zoom `transform: scale()` on the SVG canvas should use CSS transitions
for smoothness. But CSS transitions on SVG `transform` can be janky on iOS
Safari. Verify in E2E (iPhone 12 project) before committing to CSS transition
vs `requestAnimationFrame` fallback.
