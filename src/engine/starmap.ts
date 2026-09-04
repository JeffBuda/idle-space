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
import { createSeededRNG } from '../utils/rng';
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
export const generateStarMap = (
  seed: string,
  currentNodeId: string | null = null,
): StarMapState => {
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

/** Check if two nodes share a direct edge (adjacency, not BFS reachability). */
export const isEdgeBetween = (nodes: StarMapNode[], a: string, b: string): boolean => {
  const fromNode = getNodeById(nodes, a);
  if (!fromNode) return false;
  return fromNode.edges.includes(b);
};

/**
 * Check whether two nodes share a direct edge (adjacency).
 * Unlike nodesConnected (which uses BFS), this only returns true for
 * directly-connected neighbors — the contiguous-hop validation used by
 * the star map route builder.
 * Pure: does not mutate state, has no side effects.
 */
export const isAdjacent = (state: StarMapState, from: string, to: string): boolean =>
  isEdgeBetween(state.nodes, from, to);

// ---------------------------------------------------------------------------
// Route operations
// ---------------------------------------------------------------------------

/**
 * Toggle a node in the planned route.
 *
 * Behavior:
 * - If the node is already in the route: truncate the route at that node's
 *   index (sever the tail). This implements the "click to deselect and break
 *   the chain" pattern — any stops after the clicked one are removed.
 * - If the node is NOT in the route: validate direct-edge adjacency to the
 *   tail (or to currentLocation if the route is empty). Only directly
 *   connected neighbors may be added — no multi-hop teleportation.
 *
 * Rejects silently (returns state unchanged):
 * - current location nodes, non-existent nodes
 * - nodes not directly adjacent to the route tail / current location
 *
 * Pure: returns new StarMapState, never mutates input.
 */
export const toggleRouteNode = (
  state: StarMapState,
  nodeId: string,
  origin: string | null = null,
): StarMapState => {
  const node = getNodeById(state.nodes, nodeId);
  if (!node || node.status === 'current') return state;

  // If already in the route, truncate at this node (sever the tail)
  const existingIndex = state.plannedRoute.indexOf(nodeId);
  if (existingIndex >= 0) {
    return { ...state, plannedRoute: state.plannedRoute.slice(0, existingIndex) };
  }

  // Validate direct-edge adjacency: must share an edge with the last stop
  // (or with `origin` — passed from GameState.currentLocation — when the route
  // is empty). R2: GameState.currentLocation is the sole source of truth; the
  // call here is an optimization (the reducer passes it explicitly). When
  // `origin` is omitted (e.g. tests), fall back to deriving it from the node
  // marked `status === 'current'` in the star map — this is read-only and does
  // NOT reintroduce a mirrored location field.
  const referenceId =
    state.plannedRoute.length > 0
      ? state.plannedRoute[state.plannedRoute.length - 1]
      : origin ??
        state.nodes.find((n) => n.status === 'current')?.id ??
        null;

  if (referenceId === null || !isAdjacent(state, referenceId, nodeId)) {
    return state; // no origin yet (pre-launch) or not directly connected — reject
  }

  return {
    ...state,
    plannedRoute: [...state.plannedRoute, nodeId],
  };
};

/**
 * Remove a node from the planned route by truncating at that node's index.
 * Any stops after the removed node are also removed (sever the tail).
 * This is the same truncation behavior used by toggleRouteNode when
 * re-tapping an existing route node on the map.
 * Pure: returns new StarMapState, never mutates input.
 */
export const removeRouteNode = (state: StarMapState, nodeId: string): StarMapState => {
  const idx = state.plannedRoute.indexOf(nodeId);
  if (idx === -1) return state;
  return { ...state, plannedRoute: state.plannedRoute.slice(0, idx) };
};

// ---------------------------------------------------------------------------
// Route validation & confirmation
// ---------------------------------------------------------------------------

/**
 * Compute the full route path across all waypoints via BFS pathfinding.
 * Returns array of route segments (one per leg) or null if any leg is unreachable.
 *
 * Origin is now taken from `GameState.currentLocation` (R2 — the single source of
 * truth) rather than `StarMapState.currentLocationId` (removed). The caller passes
 * the origin node ID explicitly so this function stays pure and engine-only.
 */
export const computeRoutePath = (
  state: StarMapState,
  origin: string | null,
): StarMapRouteSegment[] | null => {
  if (state.plannedRoute.length === 0) return [];
  // If origin is null (fresh, unlaunched game), BFS has no start node -> route
  // is not yet active; return [] rather than failing.
  const waypoints = origin === null ? [...state.plannedRoute] : [origin, ...state.plannedRoute];
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
 * and every leg is pathable via BFS from the given origin.
 * Origin is `GameState.currentLocation` (R2 — single source of truth).
 */
export const validateRoute = (state: StarMapState, origin: string | null): boolean => {
  if (state.plannedRoute.length === 0) return false;
  const seen = new Set<string>();
  for (const id of state.plannedRoute) {
    if (seen.has(id)) return false;
    seen.add(id);
  }
  for (const id of state.plannedRoute) {
    if (!getNodeById(state.nodes, id)) return false;
  }
  if (computeRoutePath(state, origin) === null) return false;
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
 * Confirm route: validate the full planned route is reachable from `origin`,
 * compute the full BFS route path + whole-route travel time, and mark the
 * origin node as 'visited' so it renders with the visited style.
 *
 * Note (R5): the reducer's STAR_MAP_GO extracts only the FIRST segment
 * (routePath[0]) to set a single-leg gate and currentLocation=plannedRoute[0].
 * This still validates the entire route so an unreachable later waypoint
 * rejects the whole plan up-front.
 *
 * `error` is null on success, non-null message on failure.
 */
export const confirmRoute = (state: StarMapState, origin: string | null): StarMapConfirmResult => {
  if (!validateRoute(state, origin)) {
    return {
      starMap: state,
      routePath: [],
      routeTravelTimeSeconds: 0,
      error: 'Invalid route: cannot reach all destinations',
    };
  }
  const routePath = computeRoutePath(state, origin)!;
  const travelTime = estimateTravelTime(routePath);
  const nodes =
    origin === null
      ? state.nodes
      : state.nodes.map((n) => (n.id === origin ? { ...n, status: 'visited' } : n));
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

// ---------------------------------------------------------------------------
// New-game seeding
// ---------------------------------------------------------------------------

/**
 * Seed an initial one-waypoint route for a brand-new game (R3). Picks a random
 * planet from the (already-generated) star map as the player's first destination.
 *
 * Deterministic: uses the same seeded RNG that `generateStarMap` used, so the
 * chosen node is reproducible for a given `rngSeed`. Skips `currentLocation`
 * (if non-null) so the route never points back at where the player stands; if
 * `currentLocation` is null (fresh launch), any node is eligible.
 *
 * Pure: returns a NEW StarMapState with `plannedRoute: [P]`; never mutates input.
 */
export const seedInitialRoute = (
  state: StarMapState,
  rngSeed: string,
  currentLocation: string | null,
): StarMapState => {
  const rng = createSeededRNG(rngSeed);
  const candidates = state.nodes.filter((n) => n.id !== currentLocation);
  // Guard: a freshly generated star map always has >=1 node, so candidates is non-empty.
  const idx = Math.floor(rng() * candidates.length);
  const waypoint = candidates[idx]!.id;
  return { ...state, plannedRoute: [waypoint] };
};

// Re-export constants for convenience in tests and components
export {
  STAR_MAP_NODE_COUNT,
  STAR_MAP_MIN_EDGES,
  STAR_MAP_MAX_EDGES,
  STAR_MAP_ZOOM_MIN,
  STAR_MAP_ZOOM_MAX,
  STAR_MAP_ZOOM_STEP,
};
