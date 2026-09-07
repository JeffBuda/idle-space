import { useState, useEffect } from 'react';
import { GameThemeProvider } from './ui';
import { GameScreenShell } from './GameScreenShell/GameScreenShell';
import { getScreenProps } from './GameScreenShell/ScreenContent';
import { IOSInstallBanner } from './IOSInstallBanner';
import { useGameState } from '../hooks/useGameState';
import { useDbStatus } from '../hooks/useDbStatus';
import OfflineGreeting from './OfflineGreeting';
import { MiningRewardModal } from './MiningRewardModal';
import { NewGameConfirmModal } from './NewGameConfirmModal';
import { BottomDrawer } from './BottomDrawer/BottomDrawer';
import { clearCacheAndUpdate } from '../utils/cache';
import './App.css';

const App = () => {
  const [swStatus, setSwStatus] = useState<'Active' | 'Inactive'>('Inactive');
  const dbStatus = useDbStatus();
  const [installReady, setInstallReady] = useState(false);
  const [confirmNewGameVisible, setConfirmNewGameVisible] = useState(false);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);

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
    offlineSeconds,
    clearOfflineSeconds,
    idleReward,
    clearIdleReward,
    isLoading,
    dispatch,
    gate,
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

  const handleForceUpdate = () => {
    clearCacheAndUpdate();
    setForceUpdateKey((k) => k + 1);
  };

  const screenProps = gameState
    ? getScreenProps({
        gameState,
        screen,
        oreCounts: gameState.oreCounts,
        gate,
        dispatch,
        dispatchStarMapGo,
      })
    : null;

  return (
    <GameThemeProvider>
      <div className="app" key={forceUpdateKey}>
        <header className="app-header">
          <h1>Idle Space</h1>
        </header>

        <main>
          {/* Hidden signal element for E2E tests: becomes present when the app
              has finished initializing (handleWake complete, gameState loaded). */}
          <div data-testid="app-ready" className="app-ready-signal" />

          {gameState && screenProps && <GameScreenShell {...screenProps} />}
        </main>

        {/* Offline greeting modal (non-mining screens) */}
        {idleReward === null && !isLoading && (
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

        {/* Bottom drawer with tabs: Details, Debug Console, Game State, App Status, Star Map */}
        <BottomDrawer
          gameState={gameState}
          swStatus={swStatus}
          dbStatus={dbStatus}
          installReady={installReady}
          dispatchStarMapGo={dispatchStarMapGo}
          detailsContent={screenProps?.detailsContent ?? null}
          onForceUpdate={handleForceUpdate}
          onNewGame={() => setConfirmNewGameVisible(true)}
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
