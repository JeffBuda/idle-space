// src/engine/reducer.ts
//
// Pure functional game engine reducer — the single dispatch entry point
// that the logging interceptor (src/logging/logger.ts) wraps. Each
// GameAction is routed to the appropriate pure engine function.
//
// This module must remain PURE: no DOM access, no Date, no side effects.
// All time/seed values are passed in as explicit parameters for
// deterministic testability.
import { processIdleProgression, type GameState } from './time';

/**
 * Discriminated union of all engine actions.
 *
 * Each variant routes to a dedicated pure function in src/engine/.
 * To add a new action: add a variant here + a case in engineReducer.
 * The structure mirrors a Redux-style reducer so that the logging
 * interceptor can capture action metadata without coupling to
 * individual engine functions.
 */
export type GameAction = {
  type: 'IDLE_PROGRESSION';
};

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
      return processIdleProgression(prevState, currentTime, SPEED_KM_PER_SEC);
    default:
      return prevState;
  }
};