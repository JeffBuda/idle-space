# Phase 1: TypeScript Types & Engine Functions

> **Files affected:** `src/types/game-state.ts` (MODIFY), `src/engine/starmap.ts` (NEW),
> `src/engine/starmap.test.ts` (NEW), `src/engine/flow.ts` (MODIFY)

---

## 1.1 Add Types to `src/types/game-state.ts`

### 1.1.1 New Constants

```ts
export const STAR_MAP_NODE_COUNT = 10;
export const STAR_MAP_MIN_EDGES = 1; /* minimum edges per node */
export const STAR_MAP_MAX_EDGES = 3; /* per requirement: 1-3 edges */
export const STAR_MAP_ZOOM_MIN = 0.4;
export const STAR_MAP_ZOOM_MAX = 3.0;
export const STAR_MAP_ZOOM_STEP = 0.3;
```

### 1.1.2 New Type Definitions

```ts
export type NodeStatus = 'current' | 'visited' | 'unknown';

export interface StarMapNode {
  id: string;
  name: string;
  x: number; /* percentage 0-100 for SVG viewBox */
  y: number; /* percentage 0-100 for SVG viewBox */
  status: NodeStatus;
  edges: string[]; /* adjacency list: node IDs this node connects to */
}

export interface StarMapEdge {
  from: string;
  to: string;
}

export interface StarMapRouteSegment {
  from: string;
  to: string;
  path: string[]; /* ordered node IDs from->to */
  hops: number; /* path.length - 1 */
}

export interface StarMapState {
  nodes: StarMapNode[];
  edges: StarMapEdge[];
  plannedRoute: string[]; /* ordered destination node IDs */
  currentLocationId: string;
  zoomLevel: number;
}
```

### 1.1.3 Extend Screen & GameState & GameAction

```ts
// Screen type
export type Screen = 'WELCOME' | 'STAR_MAP' | 'SPACE_TRAVEL' | 'PLANET' | 'LANDING' | 'MINING';

// GameState additions
interface GameState {
  /* ... existing fields ... */
  starMap: StarMapState | null;
  routePath: StarMapRouteSegment[];
  routeTravelTimeSeconds: number;
}

// GameAction additions
type GameAction =
  | /* ...existing */ { type: 'STAR_MAP_NODE_TOGGLE'; nodeId: string }
  | { type: 'STAR_MAP_REMOVE_STOP'; nodeId: string }
  | { type: 'STAR_MAP_CLEAR_ROUTE' }
  | { type: 'STAR_MAP_ZOOM_IN' }
  | { type: 'STAR_MAP_ZOOM_OUT' }
  | { type: 'STAR_MAP_GO' };
```

---

## 1.2 Create `src/engine/starmap.ts`

Pure-function module. Imports only from `../types/game-state`. No React, DOM,
Date, or IDB access.

### 1.2.1 Seeded PRNG

```ts
/** Deterministic djb2 hash -> LCG for repeatability. Pure: same seed = same seq. */
const djb2Hash = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1;
};

const createSeededRNG = (seed: string) => {
  let state = djb2Hash(seed);
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
};
```

### 1.2.2 Graph Generation

```ts
const STAR_MAP_NAMES = [
  'Sol',
  'Alpha Centauri',
  'Sirius',
  'Proxima',
  'Vega',
  'Altair',
  'Tau Ceti',
  'Arcturus',
  'Spica',
  'Deneb',
  'Rigel',
  'Betelgeuse',
  'Castor',
  'Pollux',
  'Aldebaran',
  'Capella',
  'Cassiopeia',
  'Cygnus',
  'Lyra',
  'Pegasus',
];

/** Generate a connected 10-node star map graph, deterministic by seed. */
export const generateStarMap = (seed: string, currentNodeId: string = 'sys_0'): StarMapState => {
  const rng = createSeededRNG(seed);
  const nodes: StarMapNode[] = [];
  const edges: StarMapEdge[] = [];

  // 1. Generate 10 nodes with random positions (10-90% to avoid edges)
  for (let i = 0; i < STAR_MAP_NODE_COUNT; i++) {
    const id = `sys_${i}`;
    const name = STAR_MAP_NAMES[Math.floor(rng() * STAR_MAP_NAMES.length)];
    nodes.push({
      id,
      name,
      x: rng() * 80 + 10,
      y: rng() * 80 + 10,
      status: id === currentNodeId ? 'current' : 'unknown',
      edges: [],
    });
  }

  // 2. Build a ring for guaranteed connectivity: 0->1->...->9->0
  for (let i = 0; i < STAR_MAP_NODE_COUNT; i++) {
    const a = `sys_${i}`;
    const b = `sys_${(i + 1) % STAR_MAP_NODE_COUNT}`;
    edges.push({ from: a, to: b });
    addToAdjacency(nodes, a, b);
  }

  // 3. Add extra random edges up to MAX_EDGES per node
  for (let i = 0; i < STAR_MAP_NODE_COUNT; i++) {
    const a = `sys_${i}`;
    const nodeA = nodes.find((n) => n.id === a)!;
    while (nodeA.edges.length < STAR_MAP_MAX_EDGES) {
      const j = Math.floor(rng() * STAR_MAP_NODE_COUNT);
      if (j === i) continue;
      const b = `sys_${j}`;
      if (nodeA.edges.includes(b)) continue;
      edges.push({ from: a, to: b });
      addToAdjacency(nodes, a, b);
    }
  }
  return { nodes, edges, plannedRoute: [], currentLocationId, zoomLevel: 1.0 };
};

const addToAdjacency = (nodes: StarMapNode[], a: string, b: string): void => {
  const nodeA = nodes.find((n) => n.id === a);
  const nodeB = nodes.find((n) => n.id === b);
  if (nodeA && !nodeA.edges.includes(b)) nodeA.edges.push(b);
  if (nodeB && !nodeB.edges.includes(a)) nodeB.edges.push(a);
};
```

### 1.2.3 Pathfinding (findPath)

```ts
/**
 * BFS pathfinding on an unweighted, undirected graph.
 * Returns ordered path array [start, ..., end] or null if unreachable.
 * Pure: does not mutate nodes.
 */
export const findPath = (nodes: StarMapNode[], start: string, end: string): string[] | null => {
  if (start === end) return [start];

  // Build bidirectional adjacency map from node.edges (undirected graph)
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    if (!adj.has(node.id)) adj.set(node.id, []);
    for (const neighborId of node.edges) {
      adj.get(node.id)!.push(neighborId);
      if (!adj.has(neighborId)) adj.set(neighborId, []);
      if (!adj.get(neighborId)!.includes(node.id)) {
        adj.get(neighborId)!.push(node.id);
      }
    }
  }

  // BFS with parent tracking for path reconstruction
  const visited = new Set<string>([start]);
  const parent = new Map<string, string | null>([[start, null]]);
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === end) return reconstructPath(parent, end);
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }
  return null;
};

const reconstructPath = (parent: Map<string, string | null>, end: string): string[] => {
  const path: string[] = [];
  let current: string | null = end;
  while (current !== null) {
    path.unshift(current);
    current = parent.get(current) ?? null;
  }
  return path;
};
```

### 1.2.4 Route Operations

```ts
/** Check if start and end nodes are directly connected by an edge. */
export const nodesConnected = (nodes: StarMapNode[], from: string, to: string): boolean => {
  const fromNode = nodes.find((n) => n.id === from);
  if (!fromNode) return false;
  return fromNode.edges.includes(to);
};

/** Get a node by ID (for lookups). Returns undefined if not found. */
export const getNodeById = (nodes: StarMapNode[], id: string): StarMapNode | undefined =>
  nodes.find((n) => n.id === id);

/**
 * Toggle a node in the planned route.
 * Rejects: current location, already-in-route nodes, unreachable nodes.
 * Pure: returns new StarMapState, never mutates input.
 */
export const toggleRouteNode = (state: StarMapState, nodeId: string): StarMapState => {
  const node = getNodeById(state.nodes, nodeId);
  if (!node || node.status === 'current') return state;

  const exists = state.plannedRoute.includes(nodeId);
  if (exists) return removeRouteNode(state, nodeId);

  // Validate reachability: BFS from last route stop (or current location)
  const start =
    state.plannedRoute.length > 0
      ? state.plannedRoute[state.plannedRoute.length - 1]
      : state.currentLocationId;
  const path = findPath(state.nodes, start, nodeId);
  if (!path) return state; // unreachable — reject silently

  return {
    ...state,
    plannedRoute: [...state.plannedRoute, nodeId],
  };
};

/**
 * Remove a node from the planned route and re-bridge the gap.
 * If bridging fails, truncate the route at the removal point.
 */
export const removeRouteNode = (state: StarMapState, nodeId: string): StarMapState => {
  const idx = state.plannedRoute.indexOf(nodeId);
  if (idx === -1) return state;

  const before = state.plannedRoute.slice(0, idx);
  const after = state.plannedRoute.slice(idx + 1);

  // Try to bridge: BFS from last of `before` (or currentLocation) to 1st of `after`
  const bridgeStart = before.length > 0 ? before[before.length - 1] : state.currentLocationId;
  if (after.length > 0) {
    const bridgeEnd = after[0];
    const bridge = findPath(state.nodes, bridgeStart, bridgeEnd);
    if (!bridge) return { ...state, plannedRoute: before }; // truncate
  }
  return { ...state, plannedRoute: [...before, ...after] };
};
```

### 1.2.5 Route Validation & Confirmation

```ts
/**
 * Compute the full route path across all waypoints via BFS pathfinding.
 * Returns array of route segments (one per leg) or null if any leg is unreachable.
 */
export const computeRoutePath = (state: StarMapState): StarMapRouteSegment[] | null => {
  if (state.plannedRoute.length === 0) return [];

  const waypoints = [state.currentLocationId, ...state.plannedRoute];
  const segments: StarMapRouteSegment[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]!;
    const to = waypoints[i + 1]!;
    const path = findPath(state.nodes, from, to);
    if (!path) return null;
    segments.push({ from, to, path, hops: path.length - 1 });
  }
  return segments;
};

/**
 * Validate the planned route: non-empty, no duplicates, all nodes exist,
 * and every leg is pathable via BFS.
 */
export const validateRoute = (state: StarMapState): boolean => {
  if (state.plannedRoute.length === 0) return false;
  // No duplicate destinations
  const seen = new Set<string>();
  for (const id of state.plannedRoute) {
    if (seen.has(id)) return false;
    seen.add(id);
  }
  // All node IDs must exist
  for (const id of state.plannedRoute) {
    if (!getNodeById(state.nodes, id)) return false;
  }
  // Every leg must be pathable
  if (computeRoutePath(state) === null) return false;
  return true;
};

/**
 * Estimate total travel time. [Q3: hop-based vs distance-based?]
 * Current implementation: 5 seconds per hop, clamped to [10, 300] seconds.
 */
export const estimateTravelTime = (segments: StarMapRouteSegment[]): number => {
  const totalHops = segments.reduce((sum, s) => sum + s.hops, 0);
  const seconds = totalHops * 5;
  return Math.max(10, Math.min(300, seconds));
};

/**
 * Confirm route: validate, compute path + time, mark start node as 'visited'.
 * Returns new StarMapState with updated node statuses, or original state
 * with lastError set if validation fails.
 */
export const confirmRoute = (state: StarMapState): StarMapState => {
  if (!validateRoute(state)) {
    return {
      ...state,
      lastError: 'Invalid route: cannot reach all destinations',
    };
  }
  const routePath = computeRoutePath(state)!;
  const travelTime = estimateTravelTime(routePath);
  // Mark current location as visited
  const nodes = state.nodes.map((n) =>
    n.id === state.currentLocationId ? { ...n, status: 'visited' } : n,
  );
  return { ...state, nodes, routePath, travelTime };
};
```

> **Design note:** `confirmRoute` returns `StarMapState` per the above for
> documentation, but in the actual engine implementation it must return a
> `StarMapConfirmResult` type since `routePath`, `routeTravelTimeSeconds`,
> and `lastError` live on `GameState`, not `StarMapState`:
>
> ```ts
> export interface StarMapConfirmResult {
>   starMap: StarMapState;
>   routePath: StarMapRouteSegment[];
>   routeTravelTimeSeconds: number;
>   error: string | null;
> }
> ```
>
> The reducer maps this result onto `GameState` fields.

### 1.2.6 Zoom & Clear

```ts
/** Adjust zoom level, clamped to [STAR_MAP_ZOOM_MIN, STAR_MAP_ZOOM_MAX]. Pure. */
export const handleZoom = (state: StarMapState, direction: 'in' | 'out'): StarMapState => {
  const step = direction === 'in' ? STAR_MAP_ZOOM_STEP : -STAR_MAP_ZOOM_STEP;
  const next = Math.max(STAR_MAP_ZOOM_MIN, Math.min(STAR_MAP_ZOOM_MAX, state.zoomLevel + step));
  return { ...state, zoomLevel: next };
};

/** Clear the planned route. Pure. */
export const clearRoute = (state: StarMapState): StarMapState => {
  return { ...state, plannedRoute: [] };
};
```

---

## 1.3 Integrate with `src/engine/flow.ts`

**Add `STAR_MAP` entry logic to `navigate()`** — accessible from both `WELCOME`
and `PLANET` (per Q8 decision):

```ts
case 'NAVIGATE':
  switch (action.to) {
    /* ... existing cases ... */
    case 'STAR_MAP':
      // Generate star map if not already present (deterministic by rngSeed)
      if (state.starMap === null) {
        const starMap = generateStarMap(state.rngSeed, 'sys_0');
        return { ...state, screen: 'STAR_MAP', starMap, lastError: null };
      }
      return { ...state, screen: 'STAR_MAP', lastError: null };
    /* ... */
  }
```

This `case 'NAVIGATE'` logic handles `STAR_MAP` from **both** `WELCOME` and
`PLANET` — the `navigate()` function's outer `switch` on `state.screen` has
entries for both screens, and both route to the same `NAVIGATE` handler that
checks `action.to === 'STAR_MAP'`.

**Add route confirmation flow to `processFlowAction()`:**

```ts
// In processFlowAction switch:
case 'STAR_MAP_GO': {
  const { starMap, routePath, routeTravelTimeSeconds, error } =
    confirmRoute(state.starMap!, state.rngSeed);
  if (error) return { ...state, lastError: error };
  return {
    ...state,
    starMap,
    routePath,
    routeTravelTimeSeconds,
    screen: 'SPACE_TRAVEL',
    lastError: null,
  };
}
```

**Add `STAR_MAP` to the screen-type assertion** in `navigate()` so TypeScript
narrows correctly (currently `Screen` doesn't include it per §1.1.3).

---

## 1.4 Star Map Engine Tests (`src/engine/starmap.test.ts`)

| Test Case                     | Input / Setup                      | Expected                             |
| ----------------------------- | ---------------------------------- | ------------------------------------ |
| generateStarMap determinism   | `generateStarMap('seed1')` x2      | Identical node/edge arrays           |
| generateStarMap default       | `generateStarMap('abc')`           | 10 nodes, ≥10 edges, currentId=sys_0 |
| node edges range              | any seed                           | every node has 1-3 edges             |
| graph connectivity            | any seed                           | BFS finds path between any two nodes |
| findPath adjacent             | edge 0-1 exists                    | `[sys_0, sys_1]`                     |
| findPath multi-hop            | skip 0->2 via 1                    | `[sys_0, sys_1, sys_2]`              |
| findPath same                 | start === end                      | `[sys_0]`                            |
| findPath unreachable          | after edge removal                 | `null`                               |
| findPath symmetry             | A->B and B->A                      | both non-null, same length           |
| toggleRouteNode add           | empty route, node 5                | `[sys_5]` added                      |
| toggleRouteNode current       | node 0 (current)                   | no change                            |
| toggleRouteNode unreachable   | after disconnecting graph          | no change                            |
| toggleRouteNode remove        | existing in route                  | removed                              |
| removeRouteNode middle        | [2,3,5] remove 3                   | [2,5] with bridge                    |
| removeRouteNode bridge fail   | no bridge possible                 | truncated to before                  |
| validateRoute valid           | plannedRoute=[1,2,3] all reachable | true                                 |
| validateRoute empty           | plannedRoute=[]                    | false                                |
| validateRoute duplicates      | [1,1]                              | false                                |
| validateRoute nonexistent     | [99]                               | false                                |
| validateRoute unreachable     | disconnected leg                   | false                                |
| computeRoutePath valid        | [1,2,3] all connected              | 3 segments                           |
| computeRoutePath unreachable  | one leg fails                      | null                                 |
| estimateTravelTime            | 6 hops                             | 30 seconds                           |
| estimateTravelTime clamp low  | 0 hops                             | 10 seconds (min)                     |
| estimateTravelTime clamp high | 100 hops                           | 300 seconds (max)                    |
| handleZoom in                 | zoom=1.0                           | 1.3                                  |
| handleZoom out                | zoom=1.0                           | 0.7                                  |
| handleZoom clamp max          | zoom=2.9                           | 3.0                                  |
| handleZoom clamp min          | zoom=0.5                           | 0.4                                  |
| clearRoute                    | [1,2,3]                            | []                                   |
| immutability                  | pass state, modify returned        | original unchanged                   |
