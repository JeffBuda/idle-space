// src/useGameState.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { calculateElapsedSeconds } from '../utils/time';
import { type GameState } from '../engine/time';
import { engineReducer, type GameAction } from '../engine/reducer';
import { withLogging } from '../logging/logger';
import { getGameState, saveGameState, initGameState, initDB } from '../db';

export type { GameState };

/**
 * Wraps the pure engine reducer with diagnostic logging.
 * Created once at module scope for a stable, memoized reference.
 */
const loggedReducer = withLogging(engineReducer);

const OFFLINE_THRESHOLD_SECONDS = 60;
const TICK_INTERVAL_MS = 1000;
const SAVE_INTERVAL_MS = 10000;

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

  // Refs to hold mutable state without triggering re-renders
  const gameStateRef = useRef<GameState | null>(null);
  const saveIntervalRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Keep the ref in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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

      // APP_WAKE: resuming from idle — process idle progression through the
      // logged engine reducer so the event appears in the debug console.
      const action: GameAction = { type: 'APP_WAKE' };
      const newState = loggedReducer(savedState, action, now, savedState.rngSeed);
      setGameState(newState);
      lastTickRef.current = now;
      await saveGameState(newState);
    } catch (error) {
      console.error('Failed to process game state on wake:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSuspend = useCallback(async () => {
    try {
      const currentState = gameStateRef.current;
      if (currentState) {
        const now = Date.now();
        // APP_SUSPEND: going idle — dispatch through the logged engine reducer
        // so the event and its lastTimestamp update appear in the debug console.
        const action: GameAction = { type: 'APP_SUSPEND' };
        const newState = loggedReducer(currentState, action, now, currentState.rngSeed);
        gameStateRef.current = newState;
        setGameState(newState);
        await saveGameState(newState);
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
  }, []);

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

  // Real-time tick to update elapsed seconds every second.
  // Uses the raw engineReducer (NOT loggedReducer) to avoid producing a
  // debug log entry for every 1-second game tick. Only events that affect
  // the time aggregation calculation (going idle, resuming from idle) are
  // logged, via APP_WAKE and APP_SUSPEND action types.
  const tick = useCallback(() => {
    const currentState = gameStateRef.current;
    if (currentState && lastTickRef.current > 0) {
      const now = Date.now();
      const deltaSeconds = calculateElapsedSeconds(lastTickRef.current, now);

      if (deltaSeconds > 0) {
        const action: GameAction = { type: 'IDLE_PROGRESSION' };
        const newState = engineReducer(currentState, action, now, currentState.rngSeed);
        gameStateRef.current = newState;
        setGameState(newState);
        lastTickRef.current = now;
      }
    }
  }, []);

  useEffect(() => {
    // Listen for tab switching and backgrounding
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Listen for tab closing/navigation (pagehide is more reliable on iOS)
    window.addEventListener('pagehide', handleSuspend);

    // Initial wake check on mount
    handleWake();

    // Real-time tick every second to update elapsed time while active
    tickIntervalRef.current = window.setInterval(tick, TICK_INTERVAL_MS);

    // Debounced Auto-Save every 10 seconds to catch unexpected terminations
    // (e.g., iOS force-killing the app without a pagehide event)
    saveIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        const currentState = gameStateRef.current;
        if (currentState) {
          const stateToSave = {
            ...currentState,
            lastTimestamp: Date.now(),
          };
          saveGameState(stateToSave);
        }
      }
    }, SAVE_INTERVAL_MS);

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
      handleSuspend();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { gameState, offlineSeconds, clearOfflineSeconds, isLoading };
};
