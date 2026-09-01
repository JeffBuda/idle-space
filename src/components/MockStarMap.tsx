// src/components/MockStarMap.tsx
//
// Interactive dummy Star Map (UI Sandbox).
//
// This component is a standalone visual prototype for validating mobile UX and
// multi-stop routing interactions.  It is STRICTLY isolated from the core
// game engine — it does not import from src/engine/ or src/db/ and does not
// read or write IndexedDB game state.  All interactions rely entirely on local
// React `useState` to simulate route plotting, cancellation, and bottom-sheet
// expansion.
//
// Access: via the "Test Star Map UI (Sandbox)" secondary button in the
// SettingsMenu.  Mounted as a full-screen overlay in App.tsx.
import React, { useState } from 'react';
import './MockStarMap.css';

// ── Isolated types ──────────────────────────────────────────────
type NodeStatus = 'current' | 'unknown';
interface MockNode {
  id: string;
  name: string;
  x: number; /* percentage 0–100 */
  y: number; /* percentage 0–100 */
  status: NodeStatus;
}

// ── Hardcoded node dictionary ───────────────────────────────────
const MOCK_NODES: Record<string, MockNode> = {
  sol: { id: 'sol', name: 'Sol System', x: 20, y: 40, status: 'current' },
  sysA: { id: 'sysA', name: 'System A', x: 55, y: 25, status: 'unknown' },
  sysB: { id: 'sysB', name: 'System B', x: 40, y: 60, status: 'unknown' },
  sysC: { id: 'sysC', name: 'System C', x: 85, y: 35, status: 'unknown' },
};

// Mock travel times (hours) from Sol — sandbox placeholder values
const MOCK_TRAVEL_TIMES: Record<string, number> = {
  sol: 0,
  sysA: 4.2 /* 4h 12m */,
  sysB: 3.5 /* 3h 30m */,
  sysC: 2.08 /* 2h 05m */,
};

// Static star-map edges for the decorative background grid
const MOCK_EDGES: Array<[string, string]> = [
  ['sol', 'sysA'],
  ['sol', 'sysB'],
  ['sol', 'sysC'],
  ['sysA', 'sysC'],
  ['sysB', 'sysC'],
];

// ── Pure helper: format hours → "Xh Ym" ────────────────────────
const formatTravelTime = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${m}m`;
};

// ── Pure helper: build SVG polyline path for active route ───────
const generateRoutePath = (route: string[]): string => {
  const points = [MOCK_NODES.sol, ...route.map((id) => MOCK_NODES[id])];
  return points.map((n, i) => (i === 0 ? `M ${n.x} ${n.y}` : `L ${n.x} ${n.y}`)).join(' ');
};

// ── Component ───────────────────────────────────────────────────
export const MockStarMap: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  const [activeRoute, setActiveRoute] = useState<string[]>([]);

  /* ── Interaction handlers (local state only) ────────────── */

  const handleNodeClick = (id: string) => {
    if (id === 'sol') return; /* Sol is the current location — cannot be selected */
    if (activeRoute.includes(id)) {
      /* Toggle off — remove this specific stop */
      setActiveRoute(activeRoute.filter((s) => s !== id));
    } else {
      /* Toggle on — append to route */
      setActiveRoute([...activeRoute, id]);
    }
  };

  const handleRemoveStop = (id: string) => {
    setActiveRoute(activeRoute.filter((s) => s !== id));
  };

  const handleClearRoute = () => {
    setActiveRoute([]);
  };

  const handleAddStop = () => {
    /* Sandbox mock — node taps on the canvas are the primary interaction.
       This button is present for UI validation only. */
    console.log('MockStarMap: Add Stop clicked — tap a star on the map');
  };

  const handleSimulateWarp = () => {
    /* Sandbox mock — would dispatch a game action in the real screen. */
    console.log('MockStarMap: Simulate Warp Drive with route:', activeRoute);
  };

  /* ── Derived view state ─────────────────────────────────── */

  const sheetHeightClass =
    activeRoute.length === 0
      ? 'mock-star-map__sheet--15'
      : activeRoute.length === 1
        ? 'mock-star-map__sheet--30'
        : 'mock-star-map__sheet--50';

  const routePath = generateRoutePath(activeRoute);

  return (
    <div className="mock-star-map" data-testid="mock-star-map">
      {/* ── Top Bar (safe-area slot) ────────────────────────── */}
      <header className="mock-star-map__top-bar" data-testid="star-map-top-bar">
        <button
          type="button"
          className="mock-star-map__back-btn"
          data-testid="star-map-back-btn"
          aria-label="Back to Settings"
          onClick={onDismiss}
        >
          ←
        </button>
        <h2 className="mock-star-map__title" data-testid="star-map-title">
          Star Map UI Sandbox
        </h2>
      </header>

      {/* ── Primary View: SVG Edge Canvas + Node Divs ───────── */}
      <div className="mock-star-map__canvas" data-testid="star-map-canvas">
        <svg
          className="mock-star-map__svg"
          data-testid="star-map-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Decorative inactive edges */}
          {MOCK_EDGES.map(([fromId, toId], i) => {
            const from = MOCK_NODES[fromId];
            const to = MOCK_NODES[toId];
            return (
              <path
                key={`edge-${i}`}
                className="mock-star-map__edge-path"
                d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                fill="none"
                aria-hidden="true"
              />
            );
          })}
          {/* Active route (animated) */}
          {activeRoute.length > 0 && (
            <path
              className="mock-star-map__route-path"
              d={routePath}
              fill="none"
              aria-hidden="true"
            />
          )}
        </svg>

        {/* Star nodes — absolutely positioned, 44×44px hit area */}
        {Object.values(MOCK_NODES).map((node) => {
          const isCurrent = node.id === 'sol';
          const isSelected = activeRoute.includes(node.id);
          let nodeClass = 'mock-star-map__node';
          if (isCurrent) {
            nodeClass += ' mock-star-map__node--current';
          } else if (isSelected) {
            nodeClass += ' mock-star-map__node--selected';
          } else {
            nodeClass += ' mock-star-map__node--unknown';
          }

          return (
            <div
              key={node.id}
              className="mock-star-map__node-wrap"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <button
                type="button"
                className={nodeClass}
                data-testid={`star-map-node-${node.id}`}
                aria-label={node.name}
                onClick={() => handleNodeClick(node.id)}
                disabled={isCurrent}
              >
                <span className="mock-star-map__node-dot" aria-hidden="true" />
              </button>
              <span className="mock-star-map__node-label" data-testid={`star-map-label-${node.id}`}>
                {node.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Interactive Tier: Dynamic Bottom Sheet ────────────── */}
      <aside
        className={`mock-star-map__sheet ${sheetHeightClass}`}
        data-testid="star-map-bottom-sheet"
      >
        <div
          className="mock-star-map__drag-handle"
          data-testid="bottom-sheet-handle"
          aria-hidden="true"
        />

        {/* State 1: Default Exploration (15% height) */}
        {activeRoute.length === 0 && (
          <div className="mock-star-map__sheet-content" data-testid="sheet-default-content">
            <div className="mock-star-map__sheet-row">
              <span className="mock-star-map__sheet-label">Current Location</span>
              <span className="mock-star-map__sheet-value" data-testid="current-location">
                Sol System
              </span>
            </div>
            <p className="mock-star-map__sheet-prompt" data-testid="sheet-prompt">
              Tap adjacent star to plot a route.
            </p>
            <div className="mock-star-map__sheet-actions">
              <button
                type="button"
                className="btn btn--primary"
                data-testid="simulate-warp-btn"
                onClick={handleSimulateWarp}
                disabled
              >
                Simulate Warp Drive
              </button>
            </div>
          </div>
        )}

        {/* State 2: Single Stop Selected (30% height) */}
        {activeRoute.length === 1 && (
          <div className="mock-star-map__sheet-content" data-testid="sheet-single-content">
            <div className="mock-star-map__sheet-row">
              <span className="mock-star-map__sheet-label">Destination 1</span>
              <span className="mock-star-map__sheet-value" data-testid="destination-1">
                {MOCK_NODES[activeRoute[0]].name}
              </span>
            </div>
            <div className="mock-star-map__sheet-row">
              <span className="mock-star-map__sheet-label">Est. Travel Time</span>
              <span className="mock-star-map__sheet-value" data-testid="travel-time-1">
                {formatTravelTime(MOCK_TRAVEL_TIMES[activeRoute[0]])}
              </span>
            </div>
            <div className="mock-star-map__sheet-actions">
              <button
                type="button"
                className="btn btn--primary"
                data-testid="add-stop-btn"
                onClick={handleAddStop}
              >
                + Add Stop
              </button>
              <button
                type="button"
                className="btn btn--secondary mock-star-map__clear-btn"
                data-testid="clear-route-btn"
                onClick={handleClearRoute}
              >
                Clear Route
              </button>
            </div>
          </div>
        )}

        {/* State 3: Multi-Stop Itinerary (50% height) */}
        {activeRoute.length >= 2 && (
          <div className="mock-star-map__sheet-content" data-testid="sheet-multi-content">
            <h3 className="mock-star-map__itinerary-title" data-testid="itinerary-title">
              Course Itinerary ({activeRoute.length} stops)
            </h3>
            <div className="mock-star-map__itinerary-list" data-testid="itinerary-list">
              {activeRoute.map((stopId, index) => {
                const node = MOCK_NODES[stopId];
                return (
                  <div
                    key={stopId}
                    className="mock-star-map__itinerary-stop"
                    data-testid={`itinerary-stop-${stopId}`}
                  >
                    <span
                      className="mock-star-map__stop-index"
                      data-testid={`stop-index-${stopId}`}
                    >
                      {index + 1}.
                    </span>
                    <span className="mock-star-map__stop-name" data-testid={`stop-name-${stopId}`}>
                      {node.name}
                    </span>
                    <span
                      className="mock-star-map__stop-time"
                      data-testid={`segment-time-${stopId}`}
                    >
                      {formatTravelTime(MOCK_TRAVEL_TIMES[stopId])}
                    </span>
                    <button
                      type="button"
                      className="mock-star-map__stop-remove"
                      data-testid={`remove-stop-${stopId}`}
                      aria-label={`Remove ${node.name} from route`}
                      onClick={() => handleRemoveStop(stopId)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mock-star-map__sheet-row">
              <span className="mock-star-map__sheet-label">Total Offline Time</span>
              <span className="mock-star-map__sheet-value" data-testid="total-travel-time">
                {formatTravelTime(activeRoute.reduce((sum, id) => sum + MOCK_TRAVEL_TIMES[id], 0))}
              </span>
            </div>
            <div className="mock-star-map__sheet-actions">
              <button
                type="button"
                className="btn btn--primary"
                data-testid="simulate-warp-btn"
                onClick={handleSimulateWarp}
              >
                Simulate Warp Drive
              </button>
              <button
                type="button"
                className="btn btn--secondary mock-star-map__clear-btn"
                data-testid="clear-route-btn"
                onClick={handleClearRoute}
              >
                Clear Route
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default MockStarMap;
