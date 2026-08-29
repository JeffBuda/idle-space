// src/useGameState.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { calculateElapsedSeconds } from './utils/time';
import { processIdleProgression } from './engine/time';
import { getGameState, saveGameState, initGameState, type GameState } from './db';

const OFFLINE_THRESHOLD_SECONDS = 60;

export interface UseGameStateResult {
  gameState: GameState | null;
  offlineSeconds: number | null;
  clearOfflineSeconds: () => void;
  isLoading: boolean;
}

export const useGameState = (): UseGameStateResult => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [offlineSeconds, setOfflineSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveIntervalRef = useRef<number | null>(null);

  const handleWake = useCallback(async () => {
    try {
      let savedState = await getGameState();
      
      if (!savedState) {
        savedState = await initGameState();
      }
      
      const now = Date.now();
      const elapsed = calculateElapsedSeconds(savedState.lastTimestamp, now);
      
      // Only show offline modal if the user was gone for more than 1 minute
      if (elapsed > OFFLINE_THRESHOLD_SECONDS) {
        setOfflineSeconds(elapsed);
      }
      
      // Process idle progression with the pure functional engine
      const newState = processIdleProgression(savedState, now);
      setGameState(newState);
      await saveGameState(newState);
    } catch (error) {
      console.error('Failed to process game state on wake:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSuspend = useCallback(async () => {
    try {
      if (gameState) {
        const stateToSave = {
          ...gameState,
          lastTimestamp: Date.now(),
        };
        await saveGameState(stateToSave);
        setGameState(stateToSave);
      } else {
        // Save current timestamp even if we haven't loaded state yet
        await saveGameState({
          lastTimestamp: Date.now(),
          elapsedSeconds: 0,
          rngSeed: Math.random().toString(36).substring(2, 15),
          totalDistanceKm: 0,
          version: '0.1.0',
        });
      }
    } catch (error) {
      console.error('Failed to save game state on suspend:', error);
    }
  }, [gameState]);

  const onVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      handleWake();
    } else {
      handleSuspend();
    }
  }, [handleWake, handleSuspend]);

  const clearOfflineSeconds = useCallback(() => {
    setOfflineSeconds(null);
  }, []);

  useEffect(() => {
    // Listen for tab switching and backgrounding
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Listen for tab closing/navigation (pagehide is more reliable on iOS)
    window.addEventListener('pagehide', handleSuspend);

    // Initial wake check on mount
    handleWake();

    // Debounced Auto-Save every 10 seconds to catch unexpected terminations
    // (e.g., iOS force-killing the app without a pagehide event)
    saveIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible' && gameState) {
        const stateToSave = {
          ...gameState,
          lastTimestamp: Date.now(),
        };
        saveGameState(stateToSave);
        setGameState(stateToSave);
      }
    }, 10000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', handleSuspend);
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      // Final save on unmount
      if (gameState) {
        handleSuspend();
      }
    };
  }, [onVisibilityChange, handleSuspend, handleWake, gameState]);

  return { gameState, offlineSeconds, clearOfflineSeconds, isLoading };
};