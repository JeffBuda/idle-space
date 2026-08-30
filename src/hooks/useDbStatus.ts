// src/hooks/useDbStatus.ts
//
// React hook that encapsulates IndexedDB connection status checking.
// Components consume this hook instead of importing initDB directly
// from the persistence layer, maintaining clean architectural boundaries.
import { useState, useEffect } from 'react';
import { initDB } from '../db';

export type DbStatus = 'Connected' | 'Disconnected';

/**
 * Checks whether the IndexedDB database can be initialized.
 * Returns 'Connected' on success, 'Disconnected' on failure.
 */
export const useDbStatus = (): DbStatus => {
  const [dbStatus, setDbStatus] = useState<DbStatus>('Disconnected');

  useEffect(() => {
    initDB()
      .then(() => setDbStatus('Connected'))
      .catch(() => setDbStatus('Disconnected'));
  }, []);

  return dbStatus;
};
