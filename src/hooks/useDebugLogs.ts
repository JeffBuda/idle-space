// src/hooks/useDebugLogs.ts
import { useState, useEffect, useCallback } from 'react';
import { LogStorageService } from '../logging/storage';
import type { LogEntry } from '../db';
import { LogCategory } from '../logging/types';

export interface UseDebugLogsResult {
  logs: LogEntry[];
  isLoading: boolean;
  refresh: () => void;
  clear: () => Promise<void>;
}

export { LogCategory };
export type { LogEntry };

/**
 * React hook that interfaces with the diagnostic logging system.
 *
 * Loads log entries from IndexedDB on mount and exposes them as state
 * for the DebugConsole component. Provides refresh() and clear() actions.
 *
 * The hook is intentionally lightweight — all IDB interaction is
 * delegated to LogStorageService (src/logging/storage.ts).
 */
export const useDebugLogs = (): UseDebugLogsResult => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const entries = await LogStorageService.getAll();
      setLogs(entries);
    } catch (error) {
      console.error('Failed to load debug logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      await LogStorageService.clear();
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear debug logs:', error);
    }
  }, []);

  const refresh = useCallback(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return { logs, isLoading, refresh, clear };
};