// src/db.ts
import { openDB, type DBSchema } from 'idb';
import type { GameState } from '../types/game-state';

export interface AppStatus {
  installed: boolean;
  firstVisit: number;
  version: string;
}

// Canonical GameState is defined in src/types/game-state.ts (engine-owned) and
// re-exported here so the db layer is typed against the shared shape without
// duplicating it. db -> types is an allowed dependency (db may not depend on
// engine/hooks/components/utils, but `types` is a shared, dependency-free zone).
export type { GameState };

/**
 * A single diagnostic log entry persisted to the `space_idle_logs`
 * object store. Created by the withLogging interceptor
 * (src/logging/logger.ts) and consumed by the DebugConsole overlay.
 *
 * This type is self-contained ΓÇö it does NOT reference GameState from
 * the engine layer, preserving the db layer's architectural isolation.
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  actionType: string;
  category: string;
  executionTimeMs: number;
  stateDiff: Array<{ key: string; from: unknown; to: unknown }>;
  seed: string;
}

export interface SpaceIdleDB extends DBSchema {
  keyval: {
    key: string;
    value: unknown;
  };
  game_state: {
    key: string;
    value: GameState;
  };
  space_idle_logs: {
    key: string;
    value: LogEntry[];
  };
}

export const DB_NAME = 'space_idle_db';
export const DB_VERSION = 5; // Bumped to 5: adds currentLocation to GameState
export const APP_STATUS_KEY = 'app_status';
export const GAME_STATE_KEY = 'game_state';
export const LOGS_STORE_NAME = 'space_idle_logs';
export const LOGS_KEY = 'logs';
export const LOG_ENTRY_LIMIT = 1000;

const APP_STATUS_DEFAULT: AppStatus = {
  installed: false,
  firstVisit: Date.now(),
  version: '0.1.0',
};

const GAME_STATE_DEFAULT: GameState = {
  lastTimestamp: Date.now(),
  elapsedSeconds: 0,
  totalElapsedGameTime: 0,
  rngSeed: Math.random().toString(36).substring(2, 15),
  totalDistanceKm: 0,
  version: '0.1.0',
  // Brand-new save -> the engine renders the WELCOME screen (render gate is
  // `screen === 'WELCOME'`, NOT the time fields, to avoid a 1s tick flicker).
  screen: 'WELCOME',
  idleTimer: null,
  oreCounts: { commonOre: 0, rareOre: 0 },
  selectedOre: null,
  constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
  lastError: null,
  starMap: null,
  routePath: [],
  routeTravelTimeSeconds: 0,
  currentLocation: 'sys_0',
};

/**
 * Migrates a legacy game state (persisted before the onboarding flow was added)
 * to the current schema by filling in any missing fields with defaults from
 * GAME_STATE_DEFAULT.
 *
 * The pre-onboarding GameState only carried: lastTimestamp, elapsedSeconds,
 * rngSeed, totalDistanceKm, version. The onboarding-flow schema added:
 * totalElapsedGameTime, screen, idleTimer, oreCounts, selectedOre, constants,
 * lastError. Without migration, an old save's `screen` is `undefined`, which
 * causes App.tsx's `screen === 'WELCOME'` gate to fail and renders a blank page.
 *
 * This function is pure (no I/O) so it can be unit-tested directly.
 */
export const migrateGameState = (savedState: GameState): GameState => ({
  ...GAME_STATE_DEFAULT,
  ...savedState,
  // Nullish coalescing guards against fields that are present-but-undefined
  // (possible if a save was partially written), not just missing keys.
  screen: savedState.screen ?? 'WELCOME',
  totalElapsedGameTime: savedState.totalElapsedGameTime ?? 0,
  idleTimer: savedState.idleTimer ?? null,
  oreCounts: savedState.oreCounts ?? { commonOre: 0, rareOre: 0 },
  selectedOre: savedState.selectedOre ?? null,
  constants: savedState.constants ?? GAME_STATE_DEFAULT.constants,
  lastError: savedState.lastError ?? null,
  starMap: savedState.starMap ?? null,
  routePath: savedState.routePath ?? [],
  routeTravelTimeSeconds: savedState.routeTravelTimeSeconds ?? 0,
  currentLocation: savedState.currentLocation ?? 'sys_0',
});

/**
 * Opens (or creates) the IndexedDB database `space_idle_db` with a
 * key-value object store. If the `app_status` payload does not yet
 * exist it is seeded with a default value.
 */
export async function initDB(): Promise<AppStatus> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('keyval')) {
        database.createObjectStore('keyval');
      }
      if (!database.objectStoreNames.contains('game_state')) {
        database.createObjectStore('game_state');
      }
      if (!database.objectStoreNames.contains(LOGS_STORE_NAME)) {
        database.createObjectStore(LOGS_STORE_NAME);
      }
    },
  });

  const existing = await db.get('keyval', APP_STATUS_KEY);
  if (!existing) {
    await db.put('keyval', APP_STATUS_DEFAULT, APP_STATUS_KEY);
    return APP_STATUS_DEFAULT;
  }
  return existing as AppStatus;
}

export async function getAppStatus(): Promise<AppStatus | undefined> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION);
  const value = await db.get('keyval', APP_STATUS_KEY);
  return value as AppStatus | undefined;
}

export async function setAppStatus(status: AppStatus): Promise<void> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION);
  await db.put('keyval', status, APP_STATUS_KEY);
}

/**
 * Retrieves the saved game state from IndexedDB.
 * Returns undefined if no game state has been saved yet.
 */
export async function getGameState(): Promise<GameState | undefined> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION);
  return await db.get('game_state', GAME_STATE_KEY);
}

/**
 * Saves the current game state to IndexedDB.
 */
export async function saveGameState(state: GameState): Promise<void> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION);
  await db.put('game_state', state, GAME_STATE_KEY);
}

/**
 * Initializes a default game state if none exists in IndexedDB.
 * Returns the existing state or creates a new one.
 * Ensures the game_state object store exists before accessing it.
 */
export async function initGameState(): Promise<GameState> {
  // First ensure the database and stores are properly initialized
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('keyval')) {
        database.createObjectStore('keyval');
      }
      if (!database.objectStoreNames.contains('game_state')) {
        database.createObjectStore('game_state');
      }
      if (!database.objectStoreNames.contains(LOGS_STORE_NAME)) {
        database.createObjectStore(LOGS_STORE_NAME);
      }
    },
  });

  const existing = await db.get('game_state', GAME_STATE_KEY);
  if (existing) {
    return existing;
  }
  await db.put('game_state', GAME_STATE_DEFAULT, GAME_STATE_KEY);
  return GAME_STATE_DEFAULT;
}

/**
 * Retrieves all persisted debug log entries from the `space_idle_logs`
 * store. Returns undefined if no logs have been written yet.
 */
export async function getLogEntries(): Promise<LogEntry[] | undefined> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION);
  return await db.get('space_idle_logs', LOGS_KEY);
}

/**
 * Replaces the entire log entry array in the `space_idle_logs` store.
 * The caller (LogStorageService) is responsible for trimming to
 * LOG_ENTRY_LIMIT (ring-buffer policy).
 */
export async function saveLogEntries(entries: LogEntry[]): Promise<void> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION);
  await db.put('space_idle_logs', entries, LOGS_KEY);
}

/**
 * Clears all persisted debug log entries.
 */
export async function clearLogEntries(): Promise<void> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, DB_VERSION);
  await db.delete('space_idle_logs', LOGS_KEY);
}
