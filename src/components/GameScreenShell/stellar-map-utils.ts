// src/components/GameScreenShell/stellar-map-utils.ts
//
// Pure UI-state helpers for the StarMapContent component. These operate on
// component-local state (plannedRoute: string[]) rather than on StarMapState
// or GameState, so they can be unit-tested in isolation without engine
// dependencies.
//
// Shared graph functions (findPath, isAdjacent, getNodeById, computeRoutePath)
// are imported from src/utils/star-map.ts — the boundary-safe shared layer
// that BOTH engine and components may use.
import type { StarMapNode } from '../../types/game-state';
import { isAdjacent } from '../../utils/star-map';

// ---------------------------------------------------------------------------
// Route panel operations (operate on plannedRoute: string[])
// ---------------------------------------------------------------------------

/**
 * Add or remove a stop from the planned route.
 *
 * Behavior:
 * - If the node is already in the route: truncate the route at that node's
 *   index (sever the tail). This implements the "click to deselect and break
 *   the chain" pattern — any stops after the clicked one are removed.
 * - If the node is NOT in the route: validate direct-edge adjacency to the
 *   tail (or to origin if the route is empty). Only directly connected
 *   neighbors may be added — no multi-hop teleportation.
 *
 * Rejects silently (returns route unchanged):
 * - Current-location nodes (player can't route to where they stand)
 * - Non-existent nodes (guarded by caller)
 * - Nodes not directly adjacent to the route tail / origin
 *
 * Pure: returns a new array; never mutates input.
 */
export const toggleRouteStop = (
  plannedRoute: string[],
  nodeId: string,
  nodes: StarMapNode[],
  origin: string | null,
): string[] => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.status === 'current') return plannedRoute;

  const existingIndex = plannedRoute.indexOf(nodeId);
  if (existingIndex >= 0) {
    return plannedRoute.slice(0, existingIndex);
  }

  const referenceId = plannedRoute.length > 0 ? plannedRoute[plannedRoute.length - 1] : origin;
  if (referenceId === null || !isAdjacent(nodes, referenceId, nodeId)) {
    return plannedRoute;
  }

  return [...plannedRoute, nodeId];
};

/** Remove a stop from the route by truncating at that node's index (sever tail). */
export const removeRouteStop = (plannedRoute: string[], nodeId: string): string[] => {
  const idx = plannedRoute.indexOf(nodeId);
  if (idx === -1) return plannedRoute;
  return plannedRoute.slice(0, idx);
};

/** Clear the entire planned route. */
export const clearRoute = (): string[] => [];

// ---------------------------------------------------------------------------
// Route path derivation (derive plannedRoute from saved routePath)
// ---------------------------------------------------------------------------

/**
 * Derive stop IDs from a saved GameState.routePath (array of StarMapRouteSegment).
 * Each segment's `to` field is a stop; extracting them gives the waypoint list.
 */
export const derivePlannedRouteFromRoutePath = (routePath: { to: string }[]): string[] =>
  routePath.map((seg) => seg.to);
