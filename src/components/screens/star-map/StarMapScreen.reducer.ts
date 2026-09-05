// src/components/screens/star-map/StarMapScreen.reducer.ts
//
// Pure reducer for StarMapScreen's component-local intermediate state.
// Manages `plannedRoute` (the proposed waypoint list before Go) and
// `zoomLevel` (the UI zoom, not persisted). Neither belongs in the
// engine/game state — they are discarded if the player cancels out of the
// star map screen (R17/R18).
//
// This file is a pure module (no React imports) so it can be unit-tested
// directly with vitest without jsdom.

import type { StarMapNode } from '../../../types/game-state';
import {
  toggleRouteStop,
  removeRouteStop,
  clearRoute,
  handleZoom,
  resetZoom,
} from './star-map-utils';

/** Component-local state for StarMapScreen's useReducer. */
export interface StarMapUIState {
  plannedRoute: string[];
  zoomLevel: number;
}

/** Actions dispatched by the StarMapScreen component. */
export type StarMapUIAction =
  | { type: 'TOGGLE_NODE'; nodeId: string }
  | { type: 'REMOVE_STOP'; nodeId: string }
  | { type: 'CLEAR_ROUTE' }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'RESET_ZOOM' }
  | { type: 'INIT_FROM_ROUTE_PATH'; stops: string[] };

/**
 * Initial state factory. Reads the saved routePath (if any) to derive
 * the existing waypoint list so the player can modify a previously
 * confirmed route before re-launching.
 */
export const initStarMapUIState = (initialStops: string[]): StarMapUIState => ({
  plannedRoute: initialStops,
  zoomLevel: 1.0,
});

/**
 * The reducer needs `nodes` and `origin` to validate adjacency on toggle.
 * We capture them in a closure via useReducer's second argument (lazy init
 * is used for initial state; for subsequent dispatches we pass them via
 * a stable context or a wrapper). In practice, the component passes a
 * bound dispatch function.
 */
export const createStarMapReducer = (nodes: StarMapNode[], origin: string | null) => {
  return (state: StarMapUIState, action: StarMapUIAction): StarMapUIState => {
    switch (action.type) {
      case 'TOGGLE_NODE':
        return {
          ...state,
          plannedRoute: toggleRouteStop(state.plannedRoute, action.nodeId, nodes, origin),
        };
      case 'REMOVE_STOP':
        return {
          ...state,
          plannedRoute: removeRouteStop(state.plannedRoute, action.nodeId),
        };
      case 'CLEAR_ROUTE':
        return {
          ...state,
          plannedRoute: clearRoute(),
        };
      case 'ZOOM_IN':
        return { ...state, zoomLevel: handleZoom(state.zoomLevel, 'in') };
      case 'ZOOM_OUT':
        return { ...state, zoomLevel: handleZoom(state.zoomLevel, 'out') };
      case 'RESET_ZOOM':
        return { ...state, zoomLevel: resetZoom() };
      case 'INIT_FROM_ROUTE_PATH':
        return {
          ...state,
          plannedRoute: action.stops,
        };
      default:
        return state;
    }
  };
};
