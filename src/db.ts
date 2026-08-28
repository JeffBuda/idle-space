// src/db.ts
import { openDB, type DBSchema } from 'idb';

export interface AppStatus {
  installed: boolean;
  firstVisit: number;
  version: string;
}

export interface SpaceIdleDB extends DBSchema {
  keyval: {
    key: string;
    value: unknown;
  };
}

export const DB_NAME = 'space_idle_db';
export const APP_STATUS_KEY = 'app_status';

const APP_STATUS_DEFAULT: AppStatus = {
  installed: false,
  firstVisit: Date.now(),
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
