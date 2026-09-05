// src/useGameState.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { calculateElapsedSeconds } from '../utils/time';
import { type GameState } from '../engine/time';
import type { IdleGateStatus, IdleRewardSummary, Screen } from '../types/game-state';
import { engineReducer, type GameAction } from '../engine/reducer';
import { createInitialGameState } from '../engine/flow';
import { withLogging } from '../logging/logger';
import {
  getGameState,
  saveGameState,
  initGameState,
  initDB,
  migrateGameState,
  resetAllGameData,
  DEFAULT_GAME_CONSTANTS,
} from '../db';
import { createRandomSeed } from '../utils/rng';

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
  screen: GameState['screen'];
  oreCounts: GameState['oreCounts'];
  offlineSeconds: number | null;
  clearOfflineSeconds: () => void;
  idleReward: IdleRewardSummary | null;
  clearIdleReward: () => void;
  isLoading: boolean;
  dispatch: (action: GameAction) => void;
  gate: IdleGateStatus | null;

  // Star Map state (null until first STAR_MAP entry)
  starMap: GameState['starMap'];
  routePath: GameState['routePath'];
  routeTravelTimeSeconds: number;

  // Star Map Go: dispatch the finalized route to the engine (R17)
  dispatchStarMapGo: (plannedRoute: string[]) => void;

  // Typed navigation helper (convenience wrapper around dispatch)
  navigateTo: (to: Screen) => void;

  // New Game: wipes persisted progress + logs and reseeds a fresh game state
  // (new star map + route, WELCOME screen) with a new rngSeed — as if the game
  // were freshly downloaded.
  startNewGame: () => Promise<void>;
}

export const useGameState = (): UseGameStateResult => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [offlineSeconds, setOfflineSeconds] = useState<number | null>(null);
  const [idleReward, setIdleReward] = useState<IdleRewardSummary | null>(null);
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

      const now = Date.now();

      if (!savedState) {
        // Fresh save (R3 + R12): seed the star map + initial route via the pure
        // engine function. initGameState() persists the db record and supplies a
        // crypto-random rngSeed; createInitialGameState re-derives the canonical
        // new-game state (starMap non-null, plannedRoute: [P], currentLocation: null).
        const seeded = await initGameState();
        savedState = createInitialGameState(
          seeded.rngSeed,
          now,
          seeded.constants.defaultActionTimeSeconds,
          seeded.constants.rareOreTimeMultiplier,
        );
      } else {
        // Migrate legacy saves (persisted before the onboarding flow) that lack
        // `screen`, `oreCounts`, `constants`, etc. - otherwise screen is undefined
        // and App.tsx renders nothing inside <main>.
        savedState = migrateGameState(savedState);
      }

      const elapsed = calculateElapsedSeconds(savedState.lastTimestamp, now);

      // Capture ore counts BEFORE wake processing — processMiningGate in the
      // wake pass auto-awards ore while idle, and we need the delta for the
      // welcome-back modal that surfaces on resume-from-idle (MINING screen).
      const oreCountsBefore = savedState.oreCounts;

      // APP_WAKE: resuming from idle — process idle progression through the
      // logged engine reducer so the event appears in the debug console.
      const action: GameAction = { type: 'APP_WAKE' };
      const newState = loggedReducer(savedState, action, now, savedState.rngSeed);

      // If the user was mining while away the auto-loop collected ore. Surface
      // a welcome-back modal with time-away + ore delta. For other screens,
      // keep the existing offline greeting (time-away only).
      if (elapsed > OFFLINE_THRESHOLD_SECONDS) {
        if (savedState.screen === 'MINING') {
          const oreCollected = {
            commonOre: newState.oreCounts.commonOre - oreCountsBefore.commonOre,
            rareOre: newState.oreCounts.rareOre - oreCountsBefore.rareOre,
          };
          setIdleReward({ secondsAway: elapsed, oreCollected });
        } else {
          setOfflineSeconds(elapsed);
        }
      }

      setGameState(newState);
      lastTickRef.current = now;
      // lastError is transient engine-only — reset before persisting so no
      // stale validation message lands in IndexedDB.
      await saveGameState({ ...newState, lastError: null });
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
        await saveGameState({ ...newState, lastError: null });
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

  const clearIdleReward = useCallback(() => {
    setIdleReward(null);
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
            lastError: null,
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

  // Dispatch a flow action (NAVIGATE / HURRY / COMPLETE_ACTION / ORE_SELECTED)
  // through the logged reducer so it appears in the debug console, then persist
  // the result. lastError is stripped from the saved copy (transient only).
  const dispatch = useCallback((action: GameAction) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const newState = loggedReducer(currentState, action, now, currentState.rngSeed);
    gameStateRef.current = newState;
    setGameState(newState);
    saveGameState({ ...newState, lastError: null });
  }, []);

  // `?.` + `??` safety net: even after migrateGameState, a partially-written
  // save could have screen/oreCounts as undefined. Default to WELCOME so the
  // player always lands on the Welcome screen rather than a blank page.
  const screen = gameState?.screen ?? 'WELCOME';
  const oreCounts = gameState?.oreCounts ?? { commonOre: 0, rareOre: 0 };

  // Derive a presentation-only view of the active gate from the persisted
  // idleTimer so presentational screen components receive ready-to-render data
  // (no game math / time-to-distance conversion in React).
  const timer = gameState?.idleTimer ?? null;
  const gate: IdleGateStatus | null = timer
    ? {
        active: true,
        targetSeconds: timer.targetSeconds,
        remainingSeconds: timer.remainingSeconds,
        elapsedSeconds: timer.targetSeconds - timer.remainingSeconds,
        expired: timer.remainingSeconds <= 0,
        progressPercent:
          timer.targetSeconds > 0
            ? Math.round(
                ((timer.targetSeconds - timer.remainingSeconds) / timer.targetSeconds) * 100,
              )
            : 0,
      }
    : null;

  return {
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
    // Star Map state (null/[]/0 until the player first enters the STAR_MAP screen)
    starMap: gameState?.starMap ?? null,
    routePath: gameState?.routePath ?? [],
    routeTravelTimeSeconds: gameState?.routeTravelTimeSeconds ?? 0,
    // Star Map Go: dispatch the finalized route to the engine (R17)
    dispatchStarMapGo: useCallback(
      (plannedRoute: string[]) => {
        dispatch({ type: 'STAR_MAP_GO', plannedRoute });
      },
      [dispatch],
    ),
    // Convenience wrapper around dispatch for typed screen navigation
    navigateTo: useCallback(
      (to: Screen) => {
        dispatch({ type: 'NAVIGATE', to });
      },
      [dispatch],
    ),
    // Hard "New Game" reset — reinitializes the game to a brand-new state:
    //   1. resetAllGameData(): atomically wipes the persisted game_state record
    //      + all debug logs (as if first download).
    //   2. createInitialGameState(): pure engine fn seeds a fresh star map +
    //      one-leg route with a new crypto rngSeed, WELCOME screen, zero ore,
    //      and the shipped-default constants (hard reset, per design).
    //   3. Persist + reset the live tick/save refs so the running intervals
    //      operate cleanly on the fresh state.
    // Lives in the hooks layer (not engine) because it touches db + crypto;
    // reuses the exact same first-launch path for deterministic parity.
    startNewGame: useCallback(async () => {
      const now = Date.now();
      await resetAllGameData();
      const newState = createInitialGameState(
        createRandomSeed(),
        now,
        DEFAULT_GAME_CONSTANTS.defaultActionTimeSeconds,
        DEFAULT_GAME_CONSTANTS.rareOreTimeMultiplier,
      );
      gameStateRef.current = newState;
      lastTickRef.current = now; // prevent a stale 1s tick on the old state
      setGameState(newState);
      await saveGameState({ ...newState, lastError: null });
    }, []),
  };
};
