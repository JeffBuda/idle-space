// src/components/screens/StarMapScreen.tsx
//
// Production star map screen: renders the generated graph as an interactive
// SVG, a draggable bottom-sheet-style route panel, and zoom controls.
//
// Per the architecture rules (docs/star-map-plan/phase-4-components-and-css.md):
//   - Imports ONLY from types/ and CSS — NO engine/ or db/ imports.
//   - All game logic (graph generation, pathfinding, route validation) lives
//     in src/engine/starmap.ts and is dispatched via props callbacks.
//   - Component-level logic is UI transforms only (status->CSS class, zoom
//     display, empty/disabled states).
import type { StarMapState, StarMapRouteSegment, GameState } from '../../types/game-state';
import './StarMapScreen.css';

export interface StarMapScreenProps {
  gameState: GameState | null;
  starMap: StarMapState | null;
  routePath: StarMapRouteSegment[];
  routeTravelTimeSeconds: number;
  onNodeToggle: (nodeId: string) => void;
  onRemoveStop: (nodeId: string) => void;
  onClearRoute: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onGo: () => void;
  onBack: () => void;
}

export const StarMapScreen = ({
  gameState,
  starMap,
  routePath,
  routeTravelTimeSeconds,
  onNodeToggle,
  onRemoveStop,
  onClearRoute,
  onZoomIn,
  onZoomOut,
  onGo,
  onBack,
}: StarMapScreenProps) => {
  if (!starMap) return null;

  const { nodes, plannedRoute, zoomLevel } = starMap;
  // R2/R8: the canonical player location now lives on GameState.currentLocation,
  // not on StarMapState.currentLocationId (removed). Derive here for rendering —
  // this is a read-only lookup, not a mirrored/owned field.
  const currentLocation = gameState?.currentLocation ?? null;

  // Flatten route segments into an ordered, deduplicated list of node IDs.
  // Each StarMapRouteSegment.path is an ordered array of node IDs for one leg;
  // concatenating all legs gives the full route as a flat path.
  const routeNodeIds: string[] = routePath.reduce((acc: string[], seg) => {
    for (const id of seg.path) {
      if (!acc.includes(id)) acc.push(id);
    }
    return acc;
  }, []);

  // Determine the node IDs that are part of the computed route path visual.
  const pathNodeIds = new Set(routeNodeIds.slice(1, -1).filter((id) => id !== currentLocation));

  // Build a set of route edge pairs for highlighting edges in the selected route.
  // Per the UI Interaction Specification: edges are active when source and target
  // match a sequential pair in the active route, INCLUDING currentLocationId to
  // the first node (e.g., currentLocation -> index 0; index 0 -> index 1, etc.).
  const routeEdgePairs = new Set<string>();
  if (plannedRoute.length > 0) {
    // Edge from the player's current location to the first route stop
    const first = plannedRoute[0]!;
    routeEdgePairs.add(`${currentLocation}->${first}`);
    routeEdgePairs.add(`${first}->${currentLocation}`);
    for (let i = 0; i < plannedRoute.length - 1; i++) {
      const a = plannedRoute[i];
      const b = plannedRoute[i + 1];
      routeEdgePairs.add(`${a}->${b}`);
      routeEdgePairs.add(`${b}->${a}`);
    }
  }

  // Helper: generate SVG polyline points for the active route path
  const getRoutePoints = (): string => {
    if (routeNodeIds.length === 0) return '';
    return routeNodeIds
      .map((id) => {
        const node = nodes.find((n) => n.id === id);
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
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            −
          </button>
          <span data-testid="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            className="btn btn--icon"
            data-testid="zoom-in"
            onClick={onZoomIn}
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
          {starMap.edges.map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <line
                key={`edge-${i}`}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                className={
                  routeEdgePairs.has(`${edge.from}->${edge.to}`)
                    ? 'star-map-edge star-map-edge--route'
                    : 'star-map-edge'
                }
                data-testid={
                  routeEdgePairs.has(`${edge.from}->${edge.to}`) ? 'route-edge-active' : undefined
                }
                stroke={
                  routeEdgePairs.has(`${edge.from}->${edge.to}`)
                    ? 'var(--color-star-route)'
                    : 'var(--color-star-edge)'
                }
                strokeWidth={routeEdgePairs.has(`${edge.from}->${edge.to}`) ? '0.5' : '0.3'}
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
          {nodes.map((node) => {
            const isCurrent = node.id === currentLocation;
            const isInRoute = plannedRoute.includes(node.id);
            const nodeClass = `star-map-node star-map-node--${node.status}`;
            return (
              <g
                key={node.id}
                className={nodeClass}
                data-testid={`node-${node.id}`}
                onClick={() => onNodeToggle(node.id)}
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
                      node.status === 'current'
                        ? 'var(--color-star-current)'
                        : node.status === 'visited'
                          ? 'var(--color-star-visited)'
                          : pathNodeIds.has(node.id)
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
              {plannedRoute.map((nodeId, index) => {
                const node = nodes.find((n) => n.id === nodeId);
                return (
                  <li key={nodeId} className="itinerary-stop">
                    <span data-testid={`stop-index-${nodeId}`}>{index + 1}.</span>
                    <span data-testid={`stop-name-${nodeId}`}>{node ? node.name : nodeId}</span>
                    <button
                      type="button"
                      className="btn btn--icon btn--small"
                      data-testid={`remove-stop-${nodeId}`}
                      aria-label={`Remove ${node ? node.name : nodeId} from route`}
                      onClick={() => onRemoveStop(nodeId)}
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
              onClick={onClearRoute}
            >
              Clear Route
            </button>
            <button type="button" className="btn btn--primary" data-testid="go-btn" onClick={onGo}>
              Go!
            </button>
          </>
        )}
      </div>
    </section>
  );
};

export default StarMapScreen;
