// src/components/screens/star-map/star-map-utils.ts
//
// Pure UI-state helpers for the StarMapScreen component. These operate on
// component-local state (plannedRoute: string[], zoomLevel: number) rather
// than on StarMapState or GameState, so they can be unit-tested in isolation
// without engine dependencies.
//
// Shared graph functions (findPath, isAdjacent, getNodeById, computeRoutePath)
// are imported from src/utils/star-map.ts — the boundary-safe shared layer
// that BOTH engine and components may use. This avoids duplicating graph
// algorithms while keeping components out of the engine boundary.

import { type StarMapNode } from '../../../types/game-state';
import { isAdjacent } from '../../../utils/star-map';

// Zoom constants (component-local — not persisted, per R17/R18)
export const STAR_MAP_ZOOM_MIN = 0.4;
export const STAR_MAP_ZOOM_MAX = 3.0;
export const STAR_MAP_ZOOM_STEP = 0.3;
export const STAR_MAP_ZOOM_DEFAULT = 1.0;

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
  // Reject if node is the current location
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.status === 'current') return plannedRoute;

  // If already in the route, truncate at this node (sever the tail)
  const existingIndex = plannedRoute.indexOf(nodeId);
  if (existingIndex >= 0) {
    return plannedRoute.slice(0, existingIndex);
  }

  // Validate adjacency to the tail (or origin if route is empty)
  const referenceId = plannedRoute.length > 0 ? plannedRoute[plannedRoute.length - 1] : origin;

  if (referenceId === null || !isAdjacent(nodes, referenceId, nodeId)) {
    return plannedRoute; // reject: not directly connected
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
// Zoom operations (operate on zoomLevel: number)
// ---------------------------------------------------------------------------

/**
 * Adjust zoom level, clamped to [STAR_MAP_ZOOM_MIN, STAR_MAP_ZOOM_MAX].
 * Pure: returns a number, never mutates.
 */
export const handleZoom = (zoomLevel: number, direction: 'in' | 'out'): number => {
  const step = direction === 'in' ? STAR_MAP_ZOOM_STEP : -STAR_MAP_ZOOM_STEP;
  return Math.max(STAR_MAP_ZOOM_MIN, Math.min(STAR_MAP_ZOOM_MAX, zoomLevel + step));
};

/** Reset zoom to the default (1.0 = 100%). */
export const resetZoom = (): number => STAR_MAP_ZOOM_DEFAULT;

// ---------------------------------------------------------------------------
// Route path derivation (derive plannedRoute from saved routePath)
// ---------------------------------------------------------------------------

/**
 * Derive stop IDs from a saved GameState.routePath (array of StarMapRouteSegment).
 * Each segment's `to` field is a stop; extracting them gives the waypoint list
 * so the component can initialize its plannedRoute from the player's existing
 * route (e.g. after a previous "Go" that was never started).
 */
export const derivePlannedRouteFromRoutePath = (routePath: { to: string }[]): string[] =>
  routePath.map((seg) => seg.to);
