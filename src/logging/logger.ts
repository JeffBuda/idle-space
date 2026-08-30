// src/logging/logger.ts
//
// Interceptor (middleware) that wraps the pure engine reducer.
// Captures execution timing, state diffs, and dispatches log entries
// to the LogStorageService ΓÇö without modifying the core engine logic.
//
// Key design principles:
//   - DRY: Logging logic lives here, written exactly once, rather than
//     duplicated across dozens of engine actions.
//   - SRP: Game logic functions remain small, single-purpose, and pure.
//     The logger solely handles recording what happened.
//   - The interceptor is NOT in src/engine/ (which bans Date, window,
//     and side-effects per the ESLint rules). It lives in src/logging/.
//
// The interceptor is a fire-and-forget: the async IDB write is not
// awaited by the caller, so the state transition is synchronous.
import type { EngineReducerFn } from '../engine/reducer';
import type { LogEntry } from '../db';
import { LogCategory } from './types';
import { LogStorageService } from './storage';

/**
 * Maps GameAction.type -> broader LogCategory for the filter dropdown.
 *
 * Only event-type actions are logged. The high-frequency IDLE_PROGRESSION
 * (real-time tick) is explicitly skipped inside withLogging to avoid
 * flooding the debug console with thousands of entries (it fires every
 * 1 second). The entries below cover every action that *does* get logged.
 */
const ACTION_CATEGORY: Record<string, LogCategory> = {
  APP_WAKE: LogCategory.APP_EVENT,
  APP_SUSPEND: LogCategory.APP_EVENT,
};

/**
 * Calculates a shallow diff between two state snapshots, returning
 * only the top-level keys whose values changed. Pure function ΓÇö no
 * side effects, easy to unit test.
 *
 * @param prev - The previous state snapshot
 * @param next - The next state snapshot
 * @returns Array of { key, from, to } for each changed property.
 *          Empty array if states are identical.
 */
export const calculateDiff = (
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Array<{ key: string; from: unknown; to: unknown }> => {
  const diff: Array<{ key: string; from: unknown; to: unknown }> = [];
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of allKeys) {
    const from = prev[key];
    const to = next[key];
    if (from !== to) {
      diff.push({ key, from, to });
    }
  }
  return diff;
};

/**
 * Generates a pseudo-unique ID for a log entry.
 * Combines a timestamp with a random suffix to avoid collisions
 * when multiple entries are created within the same millisecond.
 */
const generateLogEntryId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Higher-order function that wraps a pure engine reducer with
 * diagnostic logging. The returned function has the same signature
 * and return type as the original, making it a drop-in replacement.
 *
 * When invoked:
 *   1. Records the start time (performance.now)
 *   2. Calls the underlying engine reducer (pure, synchronous)
 *   3. Records the execution time
 *   4. Builds a LogEntry with state diff
 *   5. Dispatches it to LogStorageService (fire-and-forget async IDB write)
 *   6. Returns the new GameState (same object the engine produced)
 */
export const withLogging = (reducer: EngineReducerFn): EngineReducerFn => {
  return (prevState, action, currentTime, seed) => {
    const startTime = performance.now();
    const newState = reducer(prevState, action, currentTime, seed);
    const executionTimeMs = performance.now() - startTime;

    // Skip logging for high-frequency engine tick actions.
    // These fire every 1s via the real-time tick interval in useGameState
    // and would flood the debug console with thousands of entries.
    if (action.type === 'IDLE_PROGRESSION') {
      return newState;
    }

    const logEntry: LogEntry = {
      id: generateLogEntryId(),
      timestamp: Date.now(),
      actionType: action.type,
      category: ACTION_CATEGORY[action.type] ?? LogCategory.APP_EVENT,
      executionTimeMs,
      stateDiff: calculateDiff(
        prevState as unknown as Record<string, unknown>,
        newState as unknown as Record<string, unknown>,
      ),
      seed,
    };

    // Fire-and-forget: persist to IndexedDB without blocking the state transition
    LogStorageService.append(logEntry).catch(() => {
      /* errors are already swallowed inside LogStorageService */
    });

    return newState;
  };
};
