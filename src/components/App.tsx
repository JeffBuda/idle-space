import { useState, useEffect } from 'react';
import { IOSInstallBanner } from './IOSInstallBanner';
import { useGameState } from '../hooks/useGameState';
import { useDbStatus } from '../hooks/useDbStatus';
import { APP_VERSION, BUILD_TIME } from '../config';
import { formatElapsedTime } from '../utils/time';
import OfflineGreeting from './OfflineGreeting';
import { SettingsMenu } from './SettingsMenu';
import { DebugConsole } from './DebugConsole';
import { GameStateViewer } from './GameStateViewer';
import './App.css';

const App = () => {
  const [swStatus, setSwStatus] = useState<'Active' | 'Inactive'>('Inactive');
  const dbStatus = useDbStatus();
  const [installReady, setInstallReady] = useState(false);
  const [debugConsoleVisible, setDebugConsoleVisible] = useState(false);
  const [gameStateVisible, setGameStateVisible] = useState(false);
  const toggleDebugConsole = () => setDebugConsoleVisible(!debugConsoleVisible);
  const toggleGameState = () => setGameStateVisible(!gameStateVisible);

  // ---- Service Worker registration status ----
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const sw = navigator.serviceWorker;
      const updateStatus = () => {
        setSwStatus(sw.controller ? 'Active' : 'Inactive');
      };
      updateStatus();
      sw.addEventListener('controllerchange', updateStatus);
      const interval = setInterval(updateStatus, 1000);
      return () => {
        sw.removeEventListener('controllerchange', updateStatus);
        clearInterval(interval);
      };
    }
  }, []);

  // ---- PWA installation readiness ----
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    setInstallReady('serviceWorker' in navigator && manifestLink !== null);
  }, []);

  // Idle progression & offline tracking
  const { gameState, offlineSeconds, clearOfflineSeconds, isLoading } = useGameState();
  const handleCollectRewards = () => { clearOfflineSeconds(); };

  if (isLoading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Space Exploration Idle PWA</h1>
          <SettingsMenu
            debugConsoleVisible={debugConsoleVisible}
            onToggleDebugConsole={toggleDebugConsole}
            gameStateVisible={gameStateVisible}
            onToggleGameState={toggleGameState}
          />
        </header>
        <main>
          <p>Loading game state...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Space Exploration Idle PWA</h1>
        <SettingsMenu
          debugConsoleVisible={debugConsoleVisible}
          onToggleDebugConsole={toggleDebugConsole}
          gameStateVisible={gameStateVisible}
          onToggleGameState={toggleGameState}
        />
      </header>

      <main>
        <section className="status-card">
          <h2>Application Status</h2>
          <div className="status-item">
            <span className="label">Service Worker</span>
            <span data-testid="sw-status" className="value">{swStatus}</span>
          </div>
          <div className="status-item">
            <span className="label">IndexedDB</span>
            <span data-testid="db-status" className="value">{dbStatus}</span>
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
            <span data-testid="app-version" className="value">{APP_VERSION}</span>
          </div>
          <div className="status-item">
            <span className="label">Build Date</span>
            <span data-testid="build-date" className="value">
              {new Date(BUILD_TIME).toLocaleString()}
            </span>
          </div>
        </section>
      </main>

      {/* Offline greeting modal */}
      <OfflineGreeting
        offlineSeconds={offlineSeconds}
        onDismiss={clearOfflineSeconds}
        onCollectRewards={handleCollectRewards}
      />

      {/* iOS install banner */}
      <IOSInstallBanner />

      {/* Debug console */}
      <DebugConsole
        visible={debugConsoleVisible}
        onClose={() => setDebugConsoleVisible(false)}
      />

      {/* Game state viewer */}
      <GameStateViewer
        visible={gameStateVisible}
        gameState={gameState}
        onClose={() => setGameStateVisible(false)}
      />
    </div>
  );
};

export default App;
