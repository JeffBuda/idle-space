// src/engine/starmap.ts
//
// Pure functional star map engine: procedural graph generation, BFS pathfinding,
// route planning, and travel-time estimation. Imports only from
// ../types/game-state (engine -> types is an allowed dependency per the
// ESLint boundaries rule and tests/architecture.test.ts).
//
// No Date / window / DOM / IDB — all randomness comes from a seeded PRNG
// (deterministic for testability), and the current time is passed in
// explicitly where needed. Every function returns a NEW state object; the
// input state is never mutated (except for freshly-created local node arrays
// during graph construction, which are not shared with any caller).
import {
  type StarMapNode,
  type StarMapEdge,
  type StarMapRouteSegment,
  type StarMapState,
  type StarMapConfirmResult,
  STAR_MAP_NODE_COUNT,
  STAR_MAP_MIN_EDGES,
  STAR_MAP_MAX_EDGES,
  STAR_MAP_ZOOM_MIN,
  STAR_MAP_ZOOM_MAX,
  STAR_MAP_ZOOM_STEP,
} from '../types/game-state';

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

/** Deterministic djb2 hash - LCG for repeatability. Pure: same seed = same seq. */
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

// ---------------------------------------------------------------------------
// Graph generation
// ---------------------------------------------------------------------------

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

/**
 * Add a bidirectional edge between two nodes in the adjacency lists.
 * Only called during graph construction on freshly-created nodes, so
 * in-place mutation is safe (no shared input state is modified).
 */
const addToAdjacency = (nodes: StarMapNode[], a: string, b: string): void => {
  const nodeA = nodes.find((n) => n.id === a);
  const nodeB = nodes.find((n) => n.id === b);
  if (nodeA && !nodeA.edges.includes(b)) nodeA.edges.push(b);
  if (nodeB && !nodeB.edges.includes(a)) nodeB.edges.push(a);
};

/** Generate a connected graph (STAR_MAP_NODE_COUNT nodes) by seed. Ring + extras. */
export const generateStarMap = (seed: string, currentNodeId: string = 'sys_0'): StarMapState => {
  const rng = createSeededRNG(seed);
  const nodes: StarMapNode[] = [];
  const edges: StarMapEdge[] = [];

  // 1. Generate STAR_MAP_NODE_COUNT nodes with random positions (10-90%)
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

  // 3. Add extra random edges up to STAR_MAP_MAX_EDGES per node
  for (let i = 0; i < STAR_MAP_NODE_COUNT; i++) {
    const a = `sys_${i}`;
    const nodeA = nodes.find((n) => n.id === a)!;
    let attempts = 0;
    while (nodeA.edges.length < STAR_MAP_MAX_EDGES && attempts < STAR_MAP_NODE_COUNT * 4) {
      attempts++;
      const j = Math.floor(rng() * STAR_MAP_NODE_COUNT);
      if (j === i) continue;
      const b = `sys_${j}`;
      if (nodeA.edges.includes(b)) continue;
      const nodeB = nodes.find((n) => n.id === b)!;
      if (nodeB.edges.length >= STAR_MAP_MAX_EDGES) continue;
      edges.push({ from: a, to: b });
      addToAdjacency(nodes, a, b);
    }
  }

  return {
    nodes,
    edges,
    plannedRoute: [],
    currentLocationId: currentNodeId,
    zoomLevel: 1.0,
  };
};

// ---------------------------------------------------------------------------
// Pathfinding (BFS)
// ---------------------------------------------------------------------------

const reconstructPath = (parent: Map<string, string | null>, end: string): string[] => {
  const path: string[] = [];
  let current: string | null = end;
  while (current !== null) {
    path.unshift(current);
    current = parent.get(current) ?? null;
  }
  return path;
};

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

/**
 * Check whether two nodes are connected via BFS on the undirected graph.
 * Pure: does not mutate nodes.
 */
export const nodesConnected = (nodes: StarMapNode[], a: string, b: string): boolean =>
  findPath(nodes, a, b) !== null;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Get a node by ID (for lookups). Returns undefined if not found. */
export const getNodeById = (nodes: StarMapNode[], id: string): StarMapNode | undefined =>
  nodes.find((n) => n.id === id);

/** Check if two nodes share a direct edge. */
export const isEdgeBetween = (nodes: StarMapNode[], a: string, b: string): boolean => {
  const fromNode = getNodeById(nodes, a);
  if (!fromNode) return false;
  return fromNode.edges.includes(b);
};

// ---------------------------------------------------------------------------
// Route operations
// ---------------------------------------------------------------------------

/**
 * Toggle a node in the planned route.
 * Rejects: current location, already-in-route nodes (removes instead),
 * unreachable nodes.
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
 * Pure: returns new StarMapState, never mutates input.
 */
export const removeRouteNode = (state: StarMapState, nodeId: string): StarMapState => {
  const idx = state.plannedRoute.indexOf(nodeId);
  if (idx === -1) return state;

  const before = state.plannedRoute.slice(0, idx);
  const after = state.plannedRoute.slice(idx + 1);

  // Try to bridge: BFS from last of before (or currentLocation) to 1st of after
  const bridgeStart = before.length > 0 ? before[before.length - 1] : state.currentLocationId;
  if (after.length > 0) {
    const bridgeEnd = after[0];
    const bridge = findPath(state.nodes, bridgeStart, bridgeEnd);
    if (!bridge) return { ...state, plannedRoute: before }; // truncate
  }
  return { ...state, plannedRoute: [...before, ...after] };
};

// ---------------------------------------------------------------------------
// Route validation & confirmation
// ---------------------------------------------------------------------------

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
  const seen = new Set<string>();
  for (const id of state.plannedRoute) {
    if (seen.has(id)) return false;
    seen.add(id);
  }
  for (const id of state.plannedRoute) {
    if (!getNodeById(state.nodes, id)) return false;
  }
  if (computeRoutePath(state) === null) return false;
  return true;
};

/**
 * Estimate total travel time. Hop-based model: 5 seconds per hop,
 * clamped to [10, 300] seconds.
 * Derived purely from graph structure — does NOT use rngSeed.
 */
export const estimateTravelTime = (segments: StarMapRouteSegment[]): number => {
  const totalHops = segments.reduce((sum, s) => sum + s.hops, 0);
  const seconds = totalHops * 5;
  return Math.max(10, Math.min(300, seconds));
};

/**
 * Confirm route: validate, compute path + time, mark start node as visited.
 * `error` is null on success, non-null message on failure.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const confirmRoute = (state: StarMapState, _seed: string): StarMapConfirmResult => {
  if (!validateRoute(state)) {
    return {
      starMap: state,
      routePath: [],
      routeTravelTimeSeconds: 0,
      error: 'Invalid route: cannot reach all destinations',
    };
  }
  const routePath = computeRoutePath(state)!;
  const travelTime = estimateTravelTime(routePath);
  const nodes = state.nodes.map((n) =>
    n.id === state.currentLocationId ? { ...n, status: 'visited' } : n,
  );
  return {
    starMap: { ...state, nodes },
    routePath,
    routeTravelTimeSeconds: travelTime,
    error: null,
  };
};

// ---------------------------------------------------------------------------
// Zoom & clear
// ---------------------------------------------------------------------------

/** Adjust zoom level, clamped to [STAR_MAP_ZOOM_MIN, STAR_MAP_ZOOM_MAX]. */
export const handleZoom = (state: StarMapState, direction: 'in' | 'out'): StarMapState => {
  const step = direction === 'in' ? STAR_MAP_ZOOM_STEP : -STAR_MAP_ZOOM_STEP;
  const next = Math.max(STAR_MAP_ZOOM_MIN, Math.min(STAR_MAP_ZOOM_MAX, state.zoomLevel + step));
  return { ...state, zoomLevel: next };
};

/** Clear the planned route. Pure. */
export const clearRoute = (state: StarMapState): StarMapState => ({ ...state, plannedRoute: [] });

// Re-export constants for convenience in tests and components
export {
  STAR_MAP_NODE_COUNT,
  STAR_MAP_MIN_EDGES,
  STAR_MAP_MAX_EDGES,
  STAR_MAP_ZOOM_MIN,
  STAR_MAP_ZOOM_MAX,
  STAR_MAP_ZOOM_STEP,
};
