// src/logging/swUpdateLogger.ts
//
// Lightweight logging helper for the Service Worker update lifecycle
// (Force UI Update / cache-invalidation milestones).
//
// Each call creates a LogEntry in the `space_idle_logs` IDB store with
// category = LogCategory.SW_UPDATE. The DebugConsole filter dropdown
// will automatically surface this new category for debugging iOS-specific
// update failures.
//
// Design note: this module lives in `src/logging/` (not `src/utils/`) because
// it imports LogEntry from `src/db/` — a boundary that `src/utils/` is
// architecturally forbidden from touching. The `logging/` directory is not a
// registered ESLint boundary element, so imports into it from `utils/` are
// allowed by the default `allow` policy.
import type { LogEntry } from '../db';
import { LogStorageService } from './storage';
import { LogCategory } from './types';

/** Pseudo-unique ID for log entries, matching the generator in logger.ts. */
const generateLogEntryId = (): string => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return `${Date.now()}-${bytes[0].toString(36)}`;
};

/**
 * Appends a single SW_UPDATE log entry to IndexedDB.
 *
 * Fire-and-forget — errors are swallowed inside LogStorageService so this
 * function never blocks the cache-update flow.
 *
 * @param actionType  Short label for the milestone (e.g. 'FORCE_UPDATE_INITIATED')
 * @param details     Optional structured payload stored in `stateDiff`
 */
export const logSWUpdate = (actionType: string, details?: Record<string, unknown>): void => {
  const entry: LogEntry = {
    id: generateLogEntryId(),
    timestamp: Date.now(),
    actionType,
    category: LogCategory.SW_UPDATE,
    executionTimeMs: 0,
    stateDiff: details ? [{ key: 'details', from: null, to: details }] : [],
    seed: '',
  };

  LogStorageService.append(entry).catch(() => {
    /* errors are swallowed inside LogStorageService */
  });
};
