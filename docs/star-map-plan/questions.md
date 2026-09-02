# Star Map Implementation: Open Questions

> **Status:** ✅ All resolved. Decisions captured below for implementation reference.

---

## Q1: Procedural Graph vs Hardcoded?

**Decision:** Procedural generation using `generateStarMap(seed)`.

**Rationale:** The engine rules require deterministic execution via RNG seed.
A seeded PRNG graph satisfies this. E2E tests use known seeds and BFS to
assert reachability, not hardcoded positions.

**Impact if changed to hardcoded:** Would need to store 10 full node objects
in `GAME_STATE_DEFAULT`. No star map generation function needed. E2E tests
could assert exact node names.

> **Q1A (from user):** The existing `MockStarMap` sandbox prototype and its
> SettingsMenu menu item are **deleted** — no longer needed now that the
> production screen exists. Tracked in Phase 4 §4.4 (Removal of MockStarMap).

---

## Q2: Does STAR_MAP Replace "Depart" on Planet Hub?

**Decision:** STAR_MAP is a **new button** ("Chart Course") alongside the
existing "Land" and "Depart" buttons on `PlanetHubScreen`.

**Rationale:** "Depart" starts a standard 30s SPACE_TRAVEL gate (existing flow).
"Chart Course" opens the star map for route planning, which then leads to
SPACE_TRAVEL with a route-specific gate time. Keeping both paths preserves
backward compatibility and gives players a choice.

---

## Q3: Travel Time: Fixed, Hop-Based, or Distance-Based?

**Decision:** Hop-based — `5 seconds per hop`, clamped to [10, 300].

`estimateTravelTime(segments)` sums all `hops` across route segments, multiplies
by 5, and clamps. Deterministic and testable without floating-point distance
calculations.

**Open:** Travel time does NOT use `rngSeed` — it's derived purely from graph
structure (deterministic by seed). No additional seed parameter needed.

---

## Q4: How to Log UI-Only Interactions (Zoom)?

**Decision:** Zoom actions ARE logged. `STAR_MAP_ZOOM_IN` and
`STAR_MAP_ZOOM_OUT` dispatch through `dispatch()`, which routes through
`loggedReducer`, so `withLogging` captures them automatically as `GAME_FLOW`
category.

**Route edits also logged:** `STAR_MAP_NODE_TOGGLE`, `STAR_MAP_REMOVE_STOP`,
and `STAR_MAP_CLEAR_ROUTE` are all dispatched GameActions, so they're
automatically captured by `withLogging` for session replay. No additional
logging code needed — the interceptor handles it (same as NAVIGATE, HURRY,
etc.).

---

## Q5: Zoom State — Persisted or Ephemeral?

**Decision:** Persisted. `zoomLevel` is a field on `StarMapState` in
`GameState`, saved to IndexedDB.

**Pros:** Player's preferred zoom level survives app restarts. Consistent with
"no localStorage" rule (state must use IndexedDB).

**Cons:** Adds 1 field to migration. Slight IDB write overhead on every zoom
(dispatch triggers `saveGameState`).

---

## Q6: Route Selection — Any Node or Edge-Adjacent Only?

**Decision:** Any reachable node (BFS pathfinding-based selection).

**Rationale:** `findPath` finds a valid route between any two reachable nodes.
The user can click on any reachable node as long as there is a valid path from
the current location to the selected node. This is the `MockStarMap` UX.

**Edge case:** If a node is unreachable (disconnected graph — shouldn't happen
with the ring topology), clicking it is a no-op (`toggleRouteNode` returns
unchanged state, logged as `VALIDATION_ERROR` via `lastError`).

---

## Q7: Bottom Pane — Flow-Screen Pattern or Bottom-Sheet Pattern?

**Decision:** Bottom-sheet / fixed-panel pattern, rendered as part of
`StarMapScreen.tsx` itself (not a separate modal overlay).

**Rationale:** The star map needs continuous canvas interaction while the player
reads their itinerary and presses "Go!". A bottom-sheet that overlays the lower
third of the SVG canvas keeps both interactions visible simultaneously.

---

## Q8: Star Map Accessible from Welcome Screen?

**Decision:** YES. The star map is accessible from **both** the Welcome screen
and the Planet Hub screen.

**Rationale:** Opening from Welcome lets players plan their initial route before
launching — they discover available destinations, plan a multi-stop route, then
launch toward their chosen destination. This creates an engaging pre-launch
planning loop. The flow is: `WELCOME -> STAR_MAP -> (Go!) -> SPACE_TRAVEL`
with the route-specific gate time.

**Implementation:** Add `case 'WELCOME':` to `navigate()` in `flow.ts` with a
`to === 'STAR_MAP'` branch. Same as PLANET -> STAR_MAP: calls
`generateStarMap(state.rngSeed, 'sys_0')` and sets `screen: 'STAR_MAP'`.

**Impact on onboarding tests:** The existing onboarding flow
(`WelcomeScreen -> Launch -> SPACE_TRAVEL -> PLANET`) is unchanged. STAR_MAP
is an optional navigation the user can choose from either WELCOME or PLANET.

---

## Q9: Remove MockStarMap Sandbox?

**Decision:** YES. Delete `MockStarMap.tsx`, `MockStarMap.css`,
`MockStarMap.test.tsx`, the "Test Star Map UI (Sandbox)" SettingsMenu button,
and remove the `MockStarMap` import + state from `App.tsx`.

**Rationale:** The production `StarMapScreen` supersedes the prototype.
Keeping both causes confusion about which is the source of truth. The sandbox
served its purpose for early UI iteration; the production screen now handles
that and more.

**Files to delete:**

- `src/components/MockStarMap.tsx`
- `src/components/MockStarMap.css`
- `src/components/MockStarMap.test.tsx`

**Files to modify (remove MockStarMap references):**

- `src/components/App.tsx` — remove import, state, handler, and render block
- `src/components/SettingsMenu.tsx` — remove sandbox button + handler prop
- `src/components/SettingsMenu.test.tsx` — remove sandbox-related tests

**Tracked in:** Phase 4 §4.4 (MockStarMap Removal), Phase 5 §5.5 (App.tsx cleanup)

---

## CSS Transition for SVG Zoom

**Decision:** Use CSS `transition` on the `.star-map-canvas` wrapper `<div>`,
not on the `<svg>` directly. Apply `transform: scale(zoomLevel)` with
`-webkit-transform` fallback. Add `will-change: transform` for hardware
acceleration on iOS Safari.

**Rationale:** CSS transitions on SVG `transform` attributes directly can be
janky on iOS Safari (especially <iOS 15). Wrapping the SVG in a `<div>` and
transforming the div gets better GPU acceleration. The zoom is persisted
(Q5) so the canvas re-renders with the stored `zoomLevel` on mount, with
CSS transition smoothing the visual change.

**E2E verification:** Test on the iPhone 12 Playwright project — verify
zoom in/out produces smooth visual scaling (no stuttering) and the
zoom-level percentage displays correctly.
