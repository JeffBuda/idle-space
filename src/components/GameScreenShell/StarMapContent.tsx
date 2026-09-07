// src/components/GameScreenShell/StarMapContent.tsx
//
// Reusable star map rendering used inside the GameScreenShell's bottom-drawer
// "Star Map" tab.  Extracted from the old StarMapScreen so the star map is
// always accessible on every screen via the drawer rather than being a
// separate full-screen route.
//
// All graph logic (findPath, isAdjacent, getNodeById, computeRoutePath) is
// imported from src/utils/star-map.ts — the boundary-safe shared layer that
// BOTH engine and components may use.  Component-local route state is managed
// by StarMapContent.reducer.ts (no React imports → unit-testable with vitest).
import { useReducer, useMemo, useState } from 'react';
import type {
  GameState,
  StarMapNode,
  StarMapEdge,
  StarMapRouteSegment,
} from '../../types/game-state';
import { getNodeById } from '../../utils/star-map';
import { createStarMapReducer, initStarMapUIState } from './StarMapContent.reducer';
import { derivePlannedRouteFromRoutePath } from './stellar-map-utils';
import './StarMapContent.css';

export interface StarMapContentProps {
  gameState: GameState;
  onGo: (plannedRoute: string[]) => void;
}

export function StarMapContent({ gameState, onGo }: StarMapContentProps) {
  const starMap = gameState.starMap;
  const nodes = useMemo(() => starMap?.nodes ?? [], [starMap]);
  const edges = starMap?.edges ?? [];
  const currentLocation = gameState.currentLocation;
  const routePath: StarMapRouteSegment[] = gameState.routePath;
  const routeTravelTimeSeconds = gameState.routeTravelTimeSeconds;

  // Component-local state: the proposed waypoint list before pressing Go
  const initialStops = useMemo(() => derivePlannedRouteFromRoutePath(routePath), [routePath]);
  const reducer = useMemo(
    () => createStarMapReducer(nodes, currentLocation),
    [nodes, currentLocation],
  );
  const [state, dispatch] = useReducer(reducer, initialStops, initStarMapUIState);
  const [drawerOpen, setDrawerOpen] = useState(true);

  if (!starMap) {
    return (
      <div className="star-map-empty" data-testid="star-map-empty">
        <p>No star map data available</p>
      </div>
    );
  }

  const { plannedRoute } = state;

  // Flatten route segments into an ordered, deduplicated list of node IDs
  const routeNodeIds: string[] = routePath.reduce((acc: string[], seg) => {
    for (const id of seg.path) {
      if (!acc.includes(id)) acc.push(id);
    }
    return acc;
  }, []);

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

  const handleToggleDrawer = () => setDrawerOpen(!drawerOpen);

  return (
    <section className="star-map-content" data-testid="star-map-content">
      {/* SVG graph canvas */}
      <div className="star-map-canvas-wrapper" data-testid="star-map-canvas-wrapper">
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
                stroke={isActive ? 'var(--color-accent)' : 'var(--color-star-edge)'}
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
              stroke="var(--color-accent)"
              strokeWidth="0.5"
            />
          )}

          {/* Render nodes */}
          {nodes.map((node: StarMapNode) => {
            const isCurrent = node.id === currentLocation;
            const isInRoute = plannedRoute.includes(node.id);
            const nodeClass = isCurrent
              ? 'star-map-node star-map-node--current'
              : `star-map-node star-map-node--${node.status}`;
            return (
              <g key={node.id} className={nodeClass} data-testid={`node-${node.id}`}>
                {isCurrent ? (
                  <rect
                    data-testid="current-location-marker"
                    x={node.x - 4}
                    y={node.y - 4}
                    width="8"
                    height="8"
                    fill="var(--color-star-current)"
                  />
                ) : (
                  <>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isInRoute ? '3.5' : '2.5'}
                      fill={
                        isInRoute
                          ? 'var(--color-accent)'
                          : node.status === 'visited'
                            ? 'var(--color-star-visited)'
                            : 'var(--color-star-unknown)'
                      }
                      onClick={() => dispatch({ type: 'TOGGLE_NODE', nodeId: node.id })}
                      style={{ cursor: 'pointer' }}
                      data-testid={`node-circle-${node.id}`}
                    />
                    <text
                      x={node.x}
                      y={node.y + 9}
                      textAnchor="middle"
                      className="star-map-label"
                      fontSize="5"
                      fill="var(--color-text-secondary)"
                    >
                      {node.name}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Route planning panel (collapsible) */}
      <div
        className={`route-drawer ${drawerOpen ? 'route-drawer--open' : 'route-drawer--closed'}`}
        data-testid="route-panel"
      >
        <div
          className="route-drawer-handle"
          data-testid="route-drawer-handle"
          onClick={handleToggleDrawer}
          role="button"
          aria-label={drawerOpen ? 'Collapse route panel' : 'Expand route panel'}
        >
          <div className="route-drawer-thumb"></div>
        </div>
        <div className="route-drawer-content">
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
                Set Course
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default StarMapContent;
