// src/db.ts
import { openDB, type DBSchema } from 'idb';

export interface AppStatus {
  installed: boolean;
  firstVisit: number;
  version: string;
}

export interface GameState {
  lastTimestamp: number;
  elapsedSeconds: number;
  rngSeed: string;
  totalDistanceKm: number;
  version: string;
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
}

export const DB_NAME = 'space_idle_db';
export const APP_STATUS_KEY = 'app_status';
export const GAME_STATE_KEY = 'game_state';

const APP_STATUS_DEFAULT: AppStatus = {
  installed: false,
  firstVisit: Date.now(),
  version: '0.1.0',
};

const GAME_STATE_DEFAULT: GameState = {
  lastTimestamp: Date.now(),
  elapsedSeconds: 0,
  rngSeed: Math.random().toString(36).substring(2, 15),
  totalDistanceKm: 0,
  version: '0.1.0',
};

/**
 * Opens (or creates) the IndexedDB database `space_idle_db` with a
 * key-value object store. If the `app_status` payload does not yet
 * exist it is seeded with a default value.
 */
export async function initDB(): Promise<AppStatus> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('keyval')) {
        database.createObjectStore('keyval');
      }
      if (!database.objectStoreNames.contains('game_state')) {
        database.createObjectStore('game_state');
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
  const db = await openDB<SpaceIdleDB>(DB_NAME, 1);
  const value = await db.get('keyval', APP_STATUS_KEY);
  return value as AppStatus | undefined;
}

export async function setAppStatus(status: AppStatus): Promise<void> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, 1);
  await db.put('keyval', status, APP_STATUS_KEY);
}

/**
 * Retrieves the saved game state from IndexedDB.
 * Returns undefined if no game state has been saved yet.
 */
export async function getGameState(): Promise<GameState | undefined> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, 1);
  return await db.get('game_state', GAME_STATE_KEY);
}

/**
 * Saves the current game state to IndexedDB.
 */
export async function saveGameState(state: GameState): Promise<void> {
  const db = await openDB<SpaceIdleDB>(DB_NAME, 1);
  await db.put('game_state', state, GAME_STATE_KEY);
}

/**
 * Initializes a default game state if none exists in IndexedDB.
 * Returns the existing state or creates a new one.
 */
export async function initGameState(): Promise<GameState> {
  const existing = await getGameState();
  if (existing) {
    return existing;
  }
  await saveGameState(GAME_STATE_DEFAULT);
  return GAME_STATE_DEFAULT;
}
