import { useState, useEffect } from 'react';
import { IOSInstallBanner } from './IOSInstallBanner';
import { AppStatusViewer } from './AppStatusViewer';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SpaceTravelScreen } from './screens/SpaceTravelScreen';
import { LandingScreen } from './screens/LandingScreen';
import { MiningScreen } from './screens/MiningScreen';
import { PlanetHubScreen } from './screens/PlanetHubScreen';
import { useGameState } from '../hooks/useGameState';
import { useDbStatus } from '../hooks/useDbStatus';
import OfflineGreeting from './OfflineGreeting';
import { MiningRewardModal } from './MiningRewardModal';
import { SettingsMenu } from './SettingsMenu';
import { clearCacheAndUpdate } from '../utils/cache';
import { DebugConsole } from './DebugConsole';
import { GameStateViewer } from './GameStateViewer';
import './App.css';

const App = () => {
  const [swStatus, setSwStatus] = useState<'Active' | 'Inactive'>('Inactive');
  const dbStatus = useDbStatus();
  const [installReady, setInstallReady] = useState(false);
  const [debugConsoleVisible, setDebugConsoleVisible] = useState(false);
  const [gameStateVisible, setGameStateVisible] = useState(false);
  const [appStatusVisible, setAppStatusVisible] = useState(false);
  const toggleDebugConsole = () => setDebugConsoleVisible(!debugConsoleVisible);
  const toggleGameState = () => setGameStateVisible(!gameStateVisible);
  const toggleAppStatus = () => setAppStatusVisible(!appStatusVisible);
  const handleForceUpdate = () => {
    clearCacheAndUpdate();
  };

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
  } = useGameState();
  const handleCollectRewards = () => {
    clearOfflineSeconds();
  };

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
            appStatusVisible={appStatusVisible}
            onToggleAppStatus={toggleAppStatus}
            onForceUpdate={handleForceUpdate}
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
          appStatusVisible={appStatusVisible}
          onToggleAppStatus={toggleAppStatus}
          onForceUpdate={handleForceUpdate}
        />
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

        {/* App Status overlay — menu-gated. The screen -> component switch
          lives here in App.tsx (NOT a hook) because src/engine/flow.ts is
          forbidden from importing React/components, and a custom hook that
          imported the screen components would violate the archunit
          "hooks -> components" rule. */}
        {gameState && (
          <>
            {screen === 'WELCOME' && (
              <WelcomeScreen onLaunch={() => dispatch({ type: 'NAVIGATE', to: 'SPACE_TRAVEL' })} />
            )}
            {screen === 'SPACE_TRAVEL' && (
              <SpaceTravelScreen
                gate={gate}
                onHurry={() => dispatch({ type: 'HURRY' })}
                onComplete={() => dispatch({ type: 'COMPLETE_ACTION' })}
              />
            )}
            {screen === 'LANDING' && (
              <LandingScreen
                gate={gate}
                onHurry={() => dispatch({ type: 'HURRY' })}
                onComplete={() => dispatch({ type: 'COMPLETE_ACTION' })}
              />
            )}
            {screen === 'MINING' && (
              <MiningScreen
                gameState={gameState}
                oreCounts={oreCounts}
                gate={gate}
                onOreSelect={(ore) => dispatch({ type: 'ORE_SELECTED', ore })}
                onHurry={() => dispatch({ type: 'HURRY' })}
                onComplete={() => dispatch({ type: 'COMPLETE_ACTION' })}
                onNavigate={(to) => dispatch({ type: 'NAVIGATE', to })}
              />
            )}
            {screen === 'PLANET' && (
              <PlanetHubScreen
                gameState={gameState}
                onNavigate={(to) => dispatch({ type: 'NAVIGATE', to })}
              />
            )}
          </>
        )}
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
    </div>
  );
};

export default App;
