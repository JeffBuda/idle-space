# Phase 4: React Components & CSS

> **Files affected:** `src/components/screens/StarMapScreen.tsx` (NEW),
> `src/components/screens/StarMapScreen.css` (NEW),
> `src/components/screens/StarMapScreen.test.tsx` (NEW),
> `src/components/screens/PlanetHubScreen.tsx` (MODIFY),
> `src/components/screens/WelcomeScreen.tsx` (MODIFY — add Chart Course button)

---

## 4.1 `PlanetHubScreen.tsx` — Add "Chart Course" Button

Add a third button alongside "Land" and "Depart". This button navigates to
`STAR_MAP` via a new `onChartCourse` callback prop:

```tsx
interface PlanetHubScreenProps {
  gameState: GameState;
  onNavigate: (to: Screen) => void;
  onChartCourse: () => void; /* NEW */
}
```

Add inside the `<div className="ore-controls">`, after the Depart button:

```tsx
<button
  type="button"
  className="btn btn--secondary"
  data-testid="nav-star-map"
  onClick={onChartCourse}
>
  Chart Course
</button>
```

> **Q2 + Q8 note:** The "Chart Course" button appears on BOTH `PlanetHubScreen`
> and `WelcomeScreen`. On PlanetHub, it opens the star map for route planning
> post-arrival. On WelcomeScreen, it lets players plan their initial route
> before launching. The star map is NOT accessible from SpaceTravel (mid-travel).

## 4.1b `WelcomeScreen.tsx` — Add "Chart Course" Button

Per Q8, add a secondary "Chart Course" button alongside the primary "Launch!"
button on the Welcome screen. This lets players plan their initial destination
before launching:

```tsx
interface WelcomeScreenProps {
  onLaunch: () => void;
  onChartCourse: () => void; /* NEW */
}
```

Add after the Launch! button:

```tsx
<button
  type="button"
  className="btn btn--secondary"
  data-testid="welcome-chart-course"
  onClick={onChartCourse}
>
  Chart Course
</button>
```

---

## 4.2 `StarMapScreen.tsx` — Production Component

**Imports:** Only from `types/`, CSS file, React. NO `engine/` or `db/`.

```tsx
import React from 'react';
import type { StarMapState, StarMapNode, Screen } from '../../types/game-state';
import './StarMapScreen.css';
```

**Props interface:**

```tsx
interface StarMapScreenProps {
  gameState: GameState | null; /* full state for dispatch-free rendering */
  starMap: StarMapState | null; /* graph + planned route */
  onNodeToggle: (nodeId: string) => void;
  onRemoveStop: (nodeId: string) => void;
  onClearRoute: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onGo: () => void;
  onBack: () => void;
}
```

**Render structure:**

```tsx
<section className="star-map-screen" data-testid="star-map-screen">
  {/* Header: title + zoom controls + Back */}
  <header className="star-map-header">
    <h2 data-testid="star-map-title">Stellar Cartography</h2>
    <div className="zoom-controls">
      <button data-testid="zoom-out" onClick={onZoomOut} type="button">
        −
      </button>
      <span data-testid="zoom-level">{Math.round(zoom * 100)}%</span>
      <button data-testid="zoom-in" onClick={onZoomIn} type="button">
        +
      </button>
    </div>
    <button data-testid="back-btn" onClick={onBack} type="button">
      Back
    </button>
  </header>

  {/* SVG graph canvas */}
  <div className="star-map-canvas" data-testid="star-map-canvas">
    <svg viewBox="0 0 100 100" className="star-map-svg">
      {/* Edges */}
      {starMap.edges.map((edge, i) => {
        const from = getNodeById(starMap.nodes, edge.from);
        const to = getNodeById(starMap.nodes, edge.to);
        if (!from || !to) return null;
        return (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="star-map-edge" />
        );
      })}
      {/* Nodes */}
      {starMap.nodes.map((node) => (
        <g key={node.id} transform={`translate(${node.x},${node.y})`}>
          <circle
            className={`star-map-node star-map-node--${node.status}`}
            r={node.status === 'current' ? 2.2 : 1.5}
            data-testid={`node-${node.id}`}
          />
          <text className="star-map-label">{node.name}</text>
        </g>
      ))}
      {/* Planned route path (highlighted edges) */}
      {/* ... render routePath segments as polylines ... */}
    </svg>
  </div>

  {/* Bottom sheet: itinerary */}
  <div className="route-panel" data-testid="route-panel">
    <h3>Route: {plannedRoute.length} stop(s)</h3>
    {plannedRoute.length === 0 ? (
      <p>Click a star to add a destination.</p>
    ) : (
      <ul>
        {plannedRoute.map((id, i) => {
          const node = getNodeById(starMap.nodes, id);
          return (
            <li key={id} data-testid={`route-stop-${id}`}>
              {i + 1}. {node?.name || id}
              <button data-testid={`remove-${id}`} onClick={() => onRemoveStop(id)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
    )}
    <button data-testid="clear-route" onClick={onClearRoute} disabled={plannedRoute.length === 0}>
      Clear Route
    </button>
    <button data-testid="go-btn" onClick={onGo} disabled={plannedRoute.length === 0}>
      Go!
    </button>
  </div>
</section>
```

**Component-level logic (allowed — UI transforms only, no game math):**

- Zoom level display from `starMap.zoomLevel`
- Node status → CSS class mapping (`--current`, `--visited`, `--unknown`)
- Route panel empty/disabled states
- Back button always enabled

---

## 4.3 `StarMapScreen.css`

Mobile-first (390×844 viewport), matching existing `.flow-screen` patterns:

```css
.star-map-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.star-map-header {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
}
.star-map-canvas {
  flex: 1;
  overflow: hidden;
} /* zoom via transform */
.star-map-svg {
  width: 100%;
  height: 100%;
}
.star-map-node {
  cursor: pointer;
}
.star-map-node--current {
  fill: var(--color-star-current);
}
.star-map-node--visited {
  fill: var(--color-star-visited);
}
.star-map-node--unknown {
  fill: var(--color-star-unknown);
  cursor: pointer;
}
.route-panel {
  position: fixed;
  bottom: 0;
  width: 100%;
  background: var(--color-panel);
}
```

**Q5 note:** The `zoomLevel` is currently persisted on `StarMapState` (Phase 2 §2.1).
This means it survives app restarts. If we decide zoom should be ephemeral (Q5), it
would be local React state instead. CSS: the SVG `transform: scale(zoomLevel)` is
applied via inline style on `.star-map-canvas` for smooth CSS transition. Per Q5,
zoom IS persisted (not local state).

> **Q4 update:** Zoom actions (`STAR_MAP_ZOOM_IN`/`STAR_MAP_ZOOM_OUT`) and route
> edits (`STAR_MAP_NODE_TOGGLE`, `STAR_MAP_REMOVE_STOP`, `STAR_MAP_CLEAR_ROUTE`)
> are dispatched GameActions that `withLogging` captures. However, the `STAR_MAP_*`
> types must be **added to** the `ACTION_CATEGORY` map in `src/logging/logger.ts`
> (categorized as `GAME_FLOW`) — they are not in the current map. Without this
> update, they'd fall into the default `APP_EVENT` bucket.

---

## 4.4 MockStarMap Removal (Q9)

Delete the sandbox prototype entirely — the production `StarMapScreen` supersedes it.

**Files to delete:**

- `src/components/MockStarMap.tsx`
- `src/components/MockStarMap.css`
- `src/components/MockStarMap.test.tsx`

**Files to modify (remove MockStarMap references):**

### 4.4.1 `src/components/App.tsx`

- Remove `import { MockStarMap } from './MockStarMap';`
- Remove `starMapSandboxVisible` state + `handleOpenStarMapSandbox` + `handleCloseStarMapSandbox`
- Remove `<MockStarMap onDismiss={...} />` render block (line ~205)

### 4.4.2 `src/components/SettingsMenu.tsx`

- Remove the "Test Star Map UI (Sandbox)" secondary button
- Remove `onOpenStarMapSandbox` prop
- Remove `onCloseStarMap` prop (if present)

### 4.4.3 `src/components/SettingsMenu.test.tsx`

- Remove test cases for the sandbox button

**Boundary note:** Since MockStarMap was already sandbox-isolated (local state only),
deleting it has zero impact on engine/db layer boundaries. The production
StarMapScreen follows the same isolation pattern (no engine/db imports).
