// src/components/AppStatusViewer.tsx
//
// Read-only status grid (Application Status / Engine / Build Information).
// Extracted from App.tsx so the onboarding flow can render *alongside* the
// always-visible stats. Keeping the grid on every screen — including the idle
// gate screens — means the "Total Travel Time" / "Distance" widgets the E2E
// suite asserts on stay live throughout the onboarding state machine, and the
// player never loses sight of their travel stats while a gate is running.
import type { GameState } from '../types/game-state';
import { APP_VERSION, BUILD_TIME } from '../config';
import { formatElapsedTime } from '../utils/time';

interface AppStatusViewerProps {
  gameState: GameState | null;
  swStatus: 'Active' | 'Inactive';
  dbStatus: string;
  installReady: boolean;
}

export const AppStatusViewer = ({
  gameState,
  swStatus,
  dbStatus,
  installReady,
}: AppStatusViewerProps) => (
  <>
    <section className="status-card">
      <h2>Application Status</h2>
      <div className="status-item">
        <span className="label">Service Worker</span>
        <span data-testid="sw-status" className="value">
          {swStatus}
        </span>
      </div>
      <div className="status-item">
        <span className="label">IndexedDB</span>
        <span data-testid="db-status" className="value">
          {dbStatus}
        </span>
      </div>
      <div className="status-item">
        <span className="label">Install Ready</span>
        <span data-testid="install-status" className="value">
          {installReady ? 'Yes' : 'No'}
        </span>
      </div>
    </section>

    <section className="time-delta">
      <h2>Engine</h2>
      {gameState ? (
        <>
          <div className="status-item">
            <span className="label">Total Travel Time</span>
            <span data-testid="total-travel-time" className="value">
              {formatElapsedTime(gameState.elapsedSeconds)}
            </span>
          </div>
          <div className="status-item">
            <span className="label">Distance Traveled</span>
            <span data-testid="total-distance" className="value">
              {Math.round(gameState.totalDistanceKm).toLocaleString()} km
            </span>
          </div>
        </>
      ) : (
        <p>No game state loaded</p>
      )}
    </section>

    <section className="status-card">
      <h2>Build Information</h2>
      <div className="status-item">
        <span className="label">Version</span>
        <span data-testid="app-version" className="value">
          {APP_VERSION}
        </span>
      </div>
      <div className="status-item">
        <span className="label">Build Date</span>
        <span data-testid="build-date" className="value">
          {new Date(BUILD_TIME).toLocaleString()}
        </span>
      </div>
    </section>
  </>
);
