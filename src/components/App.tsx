import { useState, useEffect } from 'react';
import { GameThemeProvider, DebugDrawer, DebugButton } from './ui';
import { GameScreenShell } from './GameScreenShell/GameScreenShell';
import { getScreenProps } from './GameScreenShell/ScreenContent';
import { IOSInstallBanner } from './IOSInstallBanner';
import { AppStatusViewer } from './AppStatusViewer';
import { useGameState } from '../hooks/useGameState';
import { useDbStatus } from '../hooks/useDbStatus';
import OfflineGreeting from './OfflineGreeting';
import { MiningRewardModal } from './MiningRewardModal';
import { DebugConsole } from './DebugConsole';
import { GameStateViewer } from './GameStateViewer';
import { NewGameConfirmModal } from './NewGameConfirmModal';
import { clearCacheAndUpdate } from '../utils/cache';
import './App.css';

const App = () => {
  const [swStatus, setSwStatus] = useState<'Active' | 'Inactive'>('Inactive');
  const dbStatus = useDbStatus();
  const [installReady, setInstallReady] = useState(false);
  const [debugConsoleVisible, setDebugConsoleVisible] = useState(false);
  const [gameStateVisible, setGameStateVisible] = useState(false);
  const [appStatusVisible, setAppStatusVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmNewGameVisible, setConfirmNewGameVisible] = useState(false);
  const toggleDebugConsole = () => setDebugConsoleVisible(!debugConsoleVisible);
  const toggleGameState = () => setGameStateVisible(!gameStateVisible);
  const toggleAppStatus = () => setAppStatusVisible(!appStatusVisible);
  const handleForceUpdate = () => {
    clearCacheAndUpdate();
  };

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

  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    setInstallReady('serviceWorker' in navigator && manifestLink !== null);
  }, []);

  const {
    gameState,
    screen,
    oreCounts,
    gate,
    offlineSeconds,
    clearOfflineSeconds,
    idleReward,
    clearIdleReward,
    isLoading,
    dispatch,
    dispatchStarMapGo,
    startNewGame,
  } = useGameState();

  const handleCollectRewards = () => {
    clearOfflineSeconds();
  };

  const handleNewGameConfirm = () => {
    void startNewGame();
    setConfirmNewGameVisible(false);
  };

  if (isLoading) {
    return (
      <GameThemeProvider>
        <div className="app">
          <header className="app-header">
            <h1>Space Exploration Idle PWA</h1>
            <DebugDrawer
              trigger={
                <DebugButton data-testid="settings-gear" variant="ghost" aria-label="Open settings">
                  Settings
                </DebugButton>
              }
              data-testid="settings-card"
              label="Settings"
              isOpen={settingsOpen}
              onOpenChange={setSettingsOpen}
            >
              <DebugButton
                data-testid="toggle-debug-console"
                variant={debugConsoleVisible ? 'accent' : 'secondary'}
                onPress={() => {
                  toggleDebugConsole();
                  setSettingsOpen(false);
                }}
              >
                {debugConsoleVisible ? 'Hide' : 'Show'} Debug Console
              </DebugButton>
              <DebugButton
                data-testid="toggle-game-state"
                variant={gameStateVisible ? 'accent' : 'secondary'}
                onPress={() => {
                  toggleGameState();
                  setSettingsOpen(false);
                }}
              >
                {gameStateVisible ? 'Hide' : 'View'} Game State
              </DebugButton>
              <DebugButton
                data-testid="toggle-app-status"
                variant={appStatusVisible ? 'accent' : 'secondary'}
                onPress={() => {
                  toggleAppStatus();
                  setSettingsOpen(false);
                }}
              >
                {appStatusVisible ? 'Hide' : 'View'} App Status
              </DebugButton>
              <DebugButton
                data-testid="force-ui-update"
                variant="warn"
                onPress={() => {
                  handleForceUpdate();
                  setSettingsOpen(false);
                }}
              >
                Force UI Update (Preserve Save)
              </DebugButton>
              <div className="settings-divider" data-testid="settings-divider" />
              <DebugButton
                data-testid="new-game"
                variant="warn"
                aria-label="Start a new game (current progress will be lost)"
                onPress={() => {
                  setSettingsOpen(false);
                  setConfirmNewGameVisible(true);
                }}
              >
                New Game
              </DebugButton>
            </DebugDrawer>
          </header>
          <main>
            <p>Loading game state...</p>
          </main>
        </div>
      </GameThemeProvider>
    );
  }

  const screenProps = gameState
    ? getScreenProps({
        gameState,
        screen: screen ?? 'WELCOME',
        oreCounts,
        gate,
        dispatch,
        dispatchStarMapGo,
      })
    : null;

  return (
    <GameThemeProvider>
      <div className="app">
        <header className="app-header">
          <h1>Space Exploration Idle PWA</h1>
          <DebugDrawer
            trigger={
              <DebugButton data-testid="settings-gear" variant="ghost" aria-label="Open settings">
                Settings
              </DebugButton>
            }
            data-testid="settings-card"
            label="Settings"
            isOpen={settingsOpen}
            onOpenChange={setSettingsOpen}
          >
            <DebugButton
              data-testid="toggle-debug-console"
              variant={debugConsoleVisible ? 'accent' : 'secondary'}
              onPress={() => {
                toggleDebugConsole();
                setSettingsOpen(false);
              }}
            >
              {debugConsoleVisible ? 'Hide' : 'Show'} Debug Console
            </DebugButton>
            <DebugButton
              data-testid="toggle-game-state"
              variant={gameStateVisible ? 'accent' : 'secondary'}
              onPress={() => {
                toggleGameState();
                setSettingsOpen(false);
              }}
            >
              {gameStateVisible ? 'Hide' : 'View'} Game State
            </DebugButton>
            <DebugButton
              data-testid="toggle-app-status"
              variant={appStatusVisible ? 'accent' : 'secondary'}
              onPress={() => {
                toggleAppStatus();
                setSettingsOpen(false);
              }}
            >
              {appStatusVisible ? 'Hide' : 'View'} App Status
            </DebugButton>
            <DebugButton
              data-testid="force-ui-update"
              variant="warn"
              onPress={() => {
                handleForceUpdate();
                setSettingsOpen(false);
              }}
            >
              Force UI Update (Preserve Save)
            </DebugButton>
            <div className="settings-divider" data-testid="settings-divider" />
            <DebugButton
              data-testid="new-game"
              variant="warn"
              aria-label="Start a new game (current progress will be lost)"
              onPress={() => {
                setSettingsOpen(false);
                setConfirmNewGameVisible(true);
              }}
            >
              New Game
            </DebugButton>
          </DebugDrawer>
        </header>

        <main>
          {appStatusVisible && (
            <AppStatusViewer
              gameState={gameState}
              swStatus={swStatus}
              dbStatus={dbStatus}
              installReady={installReady}
            />
          )}

          {/* Hidden signal element for E2E tests: becomes present when the app
            has finished initializing (handleWake complete, gameState loaded). */}
          <div data-testid="app-ready" className="app-ready-signal" />

          {gameState && screenProps && <GameScreenShell {...screenProps} />}
        </main>

        {/* Offline greeting modal (non-mining screens) */}
        {idleReward === null && (
          <OfflineGreeting
            offlineSeconds={offlineSeconds}
            onDismiss={clearOfflineSeconds}
            onCollectRewards={handleCollectRewards}
          />
        )}

        {/* Welcome-back modal for resume-from-idle while mining */}
        {idleReward !== null && (
          <MiningRewardModal
            reward={idleReward}
            onDismiss={() => {
              clearIdleReward();
              clearOfflineSeconds();
            }}
          />
        )}

        {/* iOS install banner */}
        <IOSInstallBanner />

        {/* Debug console */}
        <DebugConsole visible={debugConsoleVisible} onClose={() => setDebugConsoleVisible(false)} />

        {/* Game state viewer */}
        <GameStateViewer
          visible={gameStateVisible}
          gameState={gameState}
          onClose={() => setGameStateVisible(false)}
        />

        {/* "New Game" confirmation — destructive reset is delegated to the hook. */}
        <NewGameConfirmModal
          visible={confirmNewGameVisible}
          onCancel={() => setConfirmNewGameVisible(false)}
          onConfirm={handleNewGameConfirm}
        />
      </div>
    </GameThemeProvider>
  );
};

export default App;
