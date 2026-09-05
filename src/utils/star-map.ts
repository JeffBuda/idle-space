// src/utils/star-map.ts
//
// Shared pure graph functions for star map pathfinding, validation,
// and lookups. These are leaf-level utilities with NO dependencies on
// engine/, db/, hooks/, or components/ — only on src/types/ (which is
// import-free and shared by all layers).
//
// Functions here are consumed by BOTH:
//   - src/engine/starmap.ts  (for confirmRoute / route computation)
//   - src/components/screens/star-map/ (for route preview display)
//
// This split keeps the engine focused on game-state transitions while
// giving components the pure helpers they need for UI calculations
// without crossing the component->engine boundary (enforced by ESLint
// boundaries and ArchUnit tests in tests/architecture.test.ts).

import type { StarMapNode, StarMapEdge, StarMapRouteSegment } from '../types/game-state';

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Get a node by ID (for lookups). Returns undefined if not found. */
export const getNodeById = (nodes: StarMapNode[], id: string): StarMapNode | undefined =>
  nodes.find((n) => n.id === id);

/**
 * Resolve a star-system ID (e.g. GameState.currentLocation) to its display
 * name by looking it up in the node list. Returns a safe fallback when the
 * star map is null or the node can't be found, so UI components never crash
 * on pre-launch (null) or migration states.
 */
export const getNodeName = (
  nodes: StarMapNode[] | null,
  id: string | null,
  fallback = 'Planet X',
): string => {
  if (!nodes || !id) return fallback;
  const node = getNodeById(nodes, id);
  return node?.name ?? fallback;
};

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
 */
export const isAdjacent = (nodes: StarMapNode[], from: string, to: string): boolean =>
  isEdgeBetween(nodes, from, to);

// ---------------------------------------------------------------------------
// Pathfinding (BFS)
// ---------------------------------------------------------------------------

/** Reconstruct a BFS path from the parent map. Pure internal helper. */
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

/** Check whether two nodes are connected via BFS on the undirected graph. */
export const nodesConnected = (nodes: StarMapNode[], a: string, b: string): boolean =>
  findPath(nodes, a, b) !== null;

// ---------------------------------------------------------------------------
// Route computation (pure: takes nodes + edges + plannedRoute, returns segments)
// ---------------------------------------------------------------------------

/**
 * Compute the full route path across all waypoints via BFS pathfinding.
 * Returns array of route segments (one per leg) or null if any leg is unreachable.
 *
 * Origin is passed explicitly (from GameState.currentLocation — the single
 * source of truth) rather than from StarMapState, since plannedRoute no
 * longer lives on StarMapState.
 */
export const computeRoutePath = (
  nodes: StarMapNode[],
  edges: StarMapEdge[],
  plannedRoute: string[],
  origin: string | null,
): StarMapRouteSegment[] | null => {
  if (plannedRoute.length === 0) return [];
  const segments: StarMapRouteSegment[] = [];

  // R18/R4b: first-launch case. When origin is null ("deep space" / pre-launch),
  // there is no graph start node, so BFS cannot compute a leg FROM null. We
  // synthesize a degenerate first segment representing "deep space -> first
  // waypoint" with 0 hops (path is just the destination itself). estimateTravelTime
  // then floors this to 10s. Subsequent legs use normal BFS between real nodes.
  let waypoints: string[];
  if (origin === null) {
    waypoints = [...plannedRoute];
    if (waypoints.length > 0) {
      segments.push({
        from: null as unknown as string, // deep-space placeholder (not a real node)
        to: waypoints[0]!,
        path: [waypoints[0]!],
        hops: 0,
      });
    }
  } else {
    waypoints = [origin, ...plannedRoute];
  }

  // R18/R4b: first-launch case. When origin is null ("deep space" / pre-launch),
  // there is no graph start node, so BFS cannot compute a leg FROM null. We
  // synthesize a degenerate first segment representing "deep space -> first
  // waypoint" with 0 hops (path is just the destination itself). estimateTravelTime
  // then floors this to 10s. Subsequent legs use normal BFS between real nodes.
  // The loop iterates over consecutive waypoint pairs — when origin is null,
  // waypoints contains only plannedRoute entries, so i=0 correctly processes
  // waypoints[0] -> waypoints[1] (the first real hop after the degenerate segment).
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]!;
    const to = waypoints[i + 1]!;
    const path = findPath(nodes, from, to);
    if (!path) return null;
    segments.push({ from, to, path, hops: path.length - 1 });
  }
  return segments;
};
