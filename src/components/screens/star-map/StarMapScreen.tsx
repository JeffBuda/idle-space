// src/components/screens/star-map/StarMapScreen.tsx
//
// Production star map screen: renders the generated graph as an interactive
// SVG, a bottom-sheet-style route panel, and zoom controls.
//
// Architecture (R17/R18):
//   - All game logic (graph generation, pathfinding, route validation,
//     route confirmation, travel time) lives in src/engine/ + shared
//     src/utils/star-map.ts — NEVER imported here from engine/.
//   - Component-local intermediate state (plannedRoute, zoomLevel) is
//     managed by StarMapScreen.reducer.ts via useReducer.
//   - Pure helper functions live in star-map-utils.ts and are unit tested
//     in star-map-utils.test.ts.
//   - This component imports ONLY from types/, utils/star-map, and its own
//     co-located reducer + utils — NO engine/ imports (enforced by ESLint
//     boundaries and tests/architecture.test.ts).

import { useReducer, useMemo } from 'react';
import type { GameState, StarMapNode, StarMapEdge } from '../../../types/game-state';
import { getNodeById } from '../../../utils/star-map';
import { createStarMapReducer, initStarMapUIState } from './StarMapScreen.reducer';
import { derivePlannedRouteFromRoutePath } from './star-map-utils';
import './StarMapScreen.css';

export interface StarMapScreenProps {
  gameState: GameState;
  onGo: (plannedRoute: string[]) => void;
  onBack: () => void;
}

export const StarMapScreen = ({ gameState, onGo, onBack }: StarMapScreenProps) => {
  const starMap = gameState.starMap;
  const nodes = useMemo(() => starMap?.nodes ?? [], [starMap]);
  const edges = starMap?.edges ?? [];
  const currentLocation = gameState.currentLocation;
  const routePath = gameState.routePath;
  const routeTravelTimeSeconds = gameState.routeTravelTimeSeconds;

  // Initialize component-local state: derive plannedRoute from saved routePath
  // (R18 — so the player can modify a previously confirmed route), zoom = 1.0.
  const initialStops = useMemo(() => derivePlannedRouteFromRoutePath(routePath), [routePath]);
  const reducer = useMemo(
    () => createStarMapReducer(nodes, currentLocation),
    [nodes, currentLocation],
  );
  const [state, dispatch] = useReducer(reducer, initialStops, initStarMapUIState);

  if (!starMap) return null;

  const { plannedRoute, zoomLevel } = state;

  // ---- Derived display values (pure transforms, no game math) ----

  // Flatten route segments into an ordered, deduplicated list of node IDs.
  const routeNodeIds: string[] = routePath.reduce((acc: string[], seg) => {
    for (const id of seg.path) {
      if (!acc.includes(id)) acc.push(id);
    }
    return acc;
  }, []);

  // Build a set of route edge pairs for highlighting edges in the selected route.
  // When plannedRoute is empty but a saved routePath exists, use its stops.
  const routeStops =
    plannedRoute.length > 0 ? plannedRoute : derivePlannedRouteFromRoutePath(routePath);
  const routeEdgePairs = new Set<string>();
  if (currentLocation && routeStops.length > 0) {
    const first = routeStops[0]!;
    routeEdgePairs.add(`${currentLocation}->${first}`);
    routeEdgePairs.add(`${first}->${currentLocation}`);
    for (let i = 0; i < routeStops.length - 1; i++) {
      const a = routeStops[i]!;
      const b = routeStops[i + 1]!;
      routeEdgePairs.add(`${a}->${b}`);
      routeEdgePairs.add(`${b}->${a}`);
    }
  }

  // SVG polyline points for the active route path (finalized routePath)
  const getRoutePoints = (): string => {
    if (routeNodeIds.length === 0) return '';
    return routeNodeIds
      .map((id) => {
        const node = getNodeById(nodes, id);
        return node ? `${node.x} ${node.y}` : '';
      })
      .filter(Boolean)
      .join(' ');
  };

  return (
    <section className="star-map-screen" data-testid="star-map-screen">
      {/* Header: title + zoom controls + Back */}
      <header className="star-map-header">
        <h2 data-testid="star-map-title">Stellar Cartography</h2>
        <div className="zoom-controls">
          <button
            type="button"
            className="btn btn--icon"
            data-testid="zoom-out"
            onClick={() => dispatch({ type: 'ZOOM_OUT' })}
            aria-label="Zoom out"
          >
            −
          </button>
          <span data-testid="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            className="btn btn--icon"
            data-testid="zoom-in"
            onClick={() => dispatch({ type: 'ZOOM_IN' })}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="btn btn--icon btn--small"
          data-testid="back-btn"
          onClick={onBack}
          aria-label="Close star map"
        >
          ✕
        </button>
      </header>

      {/* SVG graph canvas */}
      <div
        className="star-map-canvas"
        data-testid="star-map-canvas"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <svg viewBox="0 0 100 100" className="star-map-svg" data-testid="star-map-svg">
          {/* Render edges as lines */}
          {edges.map((edge: StarMapEdge, i: number) => {
            const fromNode = getNodeById(nodes, edge.from);
            const toNode = getNodeById(nodes, edge.to);
            if (!fromNode || !toNode) return null;
            const isActive = routeEdgePairs.has(`${edge.from}->${edge.to}`);
            return (
              <line
                key={`edge-${i}`}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                className={isActive ? 'star-map-edge star-map-edge--route' : 'star-map-edge'}
                data-testid={isActive ? 'route-edge-active' : undefined}
                stroke={isActive ? 'var(--color-star-route)' : 'var(--color-star-edge)'}
                strokeWidth={isActive ? '0.5' : '0.3'}
              />
            );
          })}
          {/* Render route path polyline over edges */}
          {routeNodeIds.length > 1 && (
            <polyline
              points={getRoutePoints()}
              className="star-map-route"
              fill="none"
              stroke="var(--color-star-route)"
              strokeWidth="0.5"
            />
          )}

          {/* Render nodes */}
          {nodes.map((node: StarMapNode) => {
            const isCurrent = node.id === currentLocation;
            const isInRoute = plannedRoute.includes(node.id);
            const nodeClass = `star-map-node star-map-node--${node.status}`;
            return (
              <g
                key={node.id}
                className={nodeClass}
                data-testid={`node-${node.id}`}
                onClick={() => dispatch({ type: 'TOGGLE_NODE', nodeId: node.id })}
                style={{ cursor: isCurrent ? 'default' : 'pointer' }}
              >
                {isCurrent ? (
                  <rect
                    data-testid="current-location-marker"
                    x={node.x - 2.5}
                    y={node.y - 2.5}
                    width="5"
                    height="5"
                    fill="var(--color-star-current)"
                  />
                ) : (
                  <circle
                    cx={node.x}
                    cy={node.y - 3}
                    r={isInRoute ? 1.6 : 1.2}
                    fill={
                      node.status === 'visited'
                        ? 'var(--color-star-visited)'
                        : isInRoute
                          ? 'var(--color-star-route)'
                          : 'var(--color-star-unknown)'
                    }
                  />
                )}
                {!isCurrent && (
                  <text
                    x={node.x}
                    y={node.y + 7}
                    textAnchor="middle"
                    className="star-map-label"
                    fontSize="3.5"
                    fill="var(--color-text-secondary)"
                  >
                    {node.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Route panel (bottom sheet) */}
      <div className="route-panel" data-testid="route-panel">
        {plannedRoute.length === 0 ? (
          <p data-testid="route-empty">Click stars on the map to plot a course.</p>
        ) : (
          <>
            <ul data-testid="itinerary-list">
              {plannedRoute.map((nodeId: string, index: number) => {
                const node = getNodeById(nodes, nodeId);
                return (
                  <li key={nodeId} className="itinerary-stop">
                    <span data-testid={`stop-index-${nodeId}`}>{index + 1}.</span>
                    <span data-testid={`stop-name-${nodeId}`}>{node ? node.name : nodeId}</span>
                    <button
                      type="button"
                      className="btn btn--icon btn--small"
                      data-testid={`remove-stop-${nodeId}`}
                      aria-label={`Remove ${node ? node.name : nodeId} from route`}
                      onClick={() => dispatch({ type: 'REMOVE_STOP', nodeId })}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="route-summary">
              <span data-testid="total-travel-time">
                Travel time: {Math.round(routeTravelTimeSeconds)}s
              </span>
            </div>
            <button
              type="button"
              className="btn btn--secondary"
              data-testid="clear-route"
              onClick={() => dispatch({ type: 'CLEAR_ROUTE' })}
            >
              Clear Route
            </button>
            <button
              type="button"
              className="btn btn--primary"
              data-testid="go-btn"
              onClick={() => onGo(plannedRoute)}
              disabled={plannedRoute.length === 0}
            >
              Go!
            </button>
          </>
        )}
      </div>
    </section>
  );
};

export default StarMapScreen;
