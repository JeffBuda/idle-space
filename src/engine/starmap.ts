// src/engine/starmap.ts
//
// Pure functional star map engine: procedural graph generation, route
// confirmation, and travel-time estimation. Imports only from
// ../types/game-state (engine -> types is allowed) and ../utils/star-map
// (shared leaf utils).
//
// No Date / window / DOM / IDB — all randomness comes from a seeded PRNG
// (deterministic for testability), and the current time is passed in
// explicitly where needed. Every function returns a NEW state object.
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
} from '../types/game-state';
import { computeRoutePath, getNodeById } from '../utils/star-map';

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

  return { nodes, edges };
};

// ---------------------------------------------------------------------------
// Route validation & confirmation
// ---------------------------------------------------------------------------

/**
 * Validate the planned route: non-empty, no duplicates, all nodes exist,
 * and every leg is pathable via BFS from the given origin.
 *
 * Origin is GameState.currentLocation (R2 — single source of truth).
 * plannedRoute is passed explicitly (it is component-local state, not on
 * StarMapState — see R17/R18).
 */
export const validateRoute = (
  starMap: StarMapState,
  plannedRoute: string[],
  origin: string | null,
): boolean => {
  if (plannedRoute.length === 0) return false;
  const seen = new Set<string>();
  for (const id of plannedRoute) {
    if (seen.has(id)) return false;
    seen.add(id);
  }
  for (const id of plannedRoute) {
    if (!getNodeById(starMap.nodes, id)) return false;
  }
  if (computeRoutePath(starMap.nodes, starMap.edges, plannedRoute, origin) === null) return false;
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
 * Confirm route: validate the full planned route is reachable from origin,
 * compute the full BFS route path + whole-route travel time, and mark the
 * origin node as 'visited' so it renders with the visited style.
 *
 * plannedRoute is the component-local proposed waypoint list (passed
 * explicitly from the reducer — it is NOT stored on StarMapState).
 * Origin is GameState.currentLocation (R2 — single source of truth).
 *
 * Note (R5): the reducer's STAR_MAP_GO extracts only the FIRST segment
 * (routePath[0]) to set a single-leg gate. This still validates the entire
 * route so an unreachable later waypoint rejects the whole plan up-front.
 *
 * `error` is null on success, non-null message on failure.
 */
export const confirmRoute = (
  starMap: StarMapState,
  plannedRoute: string[],
  origin: string | null,
): StarMapConfirmResult => {
  if (!validateRoute(starMap, plannedRoute, origin)) {
    return {
      starMap,
      routePath: [],
      routeTravelTimeSeconds: 0,
      error: 'Invalid route: cannot reach all destinations',
    };
  }
  const routePath = computeRoutePath(starMap.nodes, starMap.edges, plannedRoute, origin)!;
  const travelTime = estimateTravelTime(routePath);
  const nodes =
    origin === null
      ? starMap.nodes
      : starMap.nodes.map((n) => (n.id === origin ? { ...n, status: 'visited' } : n));
  return {
    starMap: { ...starMap, nodes },
    routePath,
    routeTravelTimeSeconds: travelTime,
    error: null,
  };
};

// ---------------------------------------------------------------------------
// New-game seeding
// ---------------------------------------------------------------------------

/**
 * Pick a random destination node ID for a brand-new game (R3). Uses the
 * same seeded RNG that generateStarMap used, so the chosen node is
 * reproducible for a given rngSeed. Skips currentLocation (if non-null)
 * so the route never points back at where the player stands; if
 * currentLocation is null (fresh launch), any node is eligible.
 *
 * Unlike the previous implementation (which embedded the waypoint in
 * starMap.plannedRoute), this returns ONLY the destination ID — the
 * caller (createInitialGameState) then computes the route path + travel
 * time via confirmRoute and writes them to GameState.routePath.
 *
 * Pure: returns a string; never mutates input.
 */
export const seedInitialRoute = (
  starMap: StarMapState,
  rngSeed: string,
  currentLocation: string | null = null,
): string => {
  const rng = createSeededRNG(rngSeed);
  const candidates = starMap.nodes.filter((n) => n.id !== currentLocation);
  // Guard: a freshly generated star map always has >=1 node, so candidates is non-empty.
  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx]!.id;
};

// Re-export constants for convenience in tests
export { STAR_MAP_NODE_COUNT, STAR_MAP_MIN_EDGES, STAR_MAP_MAX_EDGES };
