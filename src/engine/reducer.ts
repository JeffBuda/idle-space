// src/engine/reducer.ts
//
// Pure functional game engine reducer — the single dispatch entry point
// that the logging interceptor (src/logging/logger.ts) wraps. Each
// GameAction is routed to the appropriate pure engine function.
//
// This module must remain PURE: no DOM access, no Date, no side effects.
// All time/seed values are passed in as explicit parameters for
// deterministic testability.
import { advanceIdleGate, processIdleProgression } from './time';
import { processFlowAction } from './flow';
import type { GameState, GameAction } from '../types/game-state';

/**
 * Discriminated union of all engine actions — canonical definition lives in
 * src/types/game-state.ts (shared by engine, hooks, and components to avoid
 * cross-layer coupling).
 */
export type { GameAction };

/**
 * Function signature for the engine reducer. Used by the logging
 * interceptor (withLogging) to maintain type safety.
 */
export type EngineReducerFn = (
  prevState: GameState,
  action: GameAction,
  currentTime: number,
  seed: string,
) => GameState;

/** Default travel speed in km/s — used by the idle progression engine. */
export const SPEED_KM_PER_SEC = 10;

/**
 * Dispatches a GameAction against the current game state, producing a
 * new immutable GameState.
 *
 * @param prevState    - The current immutable game state
 * @param action       - The action to dispatch
 * @param currentTime  - UNIX timestamp (ms) to process idle time from
 * @param _seed        - RNG seed (reserved for future deterministic systems)
 * @returns A new GameState with all transitions applied
 */
export const engineReducer: EngineReducerFn = (
  prevState,
  action,
  currentTime,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _seed,
) => {
  switch (action.type) {
    case 'IDLE_PROGRESSION':
    case 'APP_WAKE': {
      // Both advance idle math, then catch up the active gate countdown so a
      // backgrounded/idle phone still completes its gate (iOS ITP safe).
      // APP_WAKE is logged via withLogging; IDLE_PROGRESSION bypasses logging.
      const progressed = processIdleProgression(prevState, currentTime, SPEED_KM_PER_SEC);
      return advanceIdleGate(progressed, currentTime);
    }
    case 'APP_SUSPEND':
      // Going idle — snapshot the time baseline. The gate is NOT advanced here;
      // the wake pass above accounts for the full background stretch.
      return { ...prevState, lastTimestamp: currentTime };
    case 'NAVIGATE':
    case 'HURRY':
    case 'COMPLETE_ACTION':
    case 'ORE_SELECTED':
      return processFlowAction(prevState, action, currentTime);
    default:
      return prevState;
  }
};
