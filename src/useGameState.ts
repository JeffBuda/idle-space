// src/useGameState.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { calculateElapsedSeconds } from './utils/time';
import { processIdleProgression, type GameState } from './engine/time';
import { getGameState, saveGameState, initGameState, initDB } from './db';

const OFFLINE_THRESHOLD_SECONDS = 60;
const TICK_INTERVAL_MS = 1000;

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
  const tickIntervalRef = useRef<number | null>(null);

  const handleWake = useCallback(async () => {
    try {
      // Ensure IndexedDB is initialized first
      await initDB();
      
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
        const defaultState = await initGameState();
        await saveGameState({
          ...defaultState,
          lastTimestamp: Date.now(),
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

  // Real-time tick to update elapsed seconds while app is active
  const handleTick = useCallback(() => {
    if (gameState) {
      const now = Date.now();
      const newState = processIdleProgression(gameState, now);
      setGameState(newState);
    }
  }, [gameState]);

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
      if (gameState) {
        const stateToSave = {
          ...gameState,
          lastTimestamp: Date.now(),
        };
        saveGameState(stateToSave);
        setGameState(stateToSave);
      }
    }, 10000);

    // Real-time tick to update elapsed seconds every second while active
    tickIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        handleTick();
      }
    }, TICK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', handleSuspend);
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
      // Final save on unmount
      if (gameState) {
        handleSuspend();
      }
    };
  }, [onVisibilityChange, handleSuspend, handleWake, handleTick, gameState]);

  return { gameState, offlineSeconds, clearOfflineSeconds, isLoading };
};