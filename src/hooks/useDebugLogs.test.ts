// src/hooks/useDebugLogs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDebugLogs } from './useDebugLogs';
import { LogStorageService } from '../logging/storage';
import { type LogEntry } from '../db';

// Mock the LogStorageService so the hook test doesn't touch IndexedDB
vi.mock('../logging/storage', () => ({
  LogStorageService: {
    append: vi.fn(),
    getAll: vi.fn(),
    clear: vi.fn(),
  },
}));

let logIdCounter = 0;
const makeLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: `log-${++logIdCounter}`,
  timestamp: Date.now(),
  actionType: 'IDLE_PROGRESSION',
  category: 'APP_EVENT',
  executionTimeMs: 0.1,
  stateDiff: [{ key: 'totalDistanceKm', from: 0, to: 10 }],
  seed: 'test-seed',
  ...overrides,
});

describe('useDebugLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return isLoading=true initially, then false after loading', async () => {
    vi.mocked(LogStorageService.getAll).mockResolvedValue([]);
    const { result } = renderHook(() => useDebugLogs());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should load log entries from LogStorageService on mount', async () => {
    const entries = [makeLogEntry({ id: '1' }), makeLogEntry({ id: '2' })];
    vi.mocked(LogStorageService.getAll).mockResolvedValue(entries);

    const { result } = renderHook(() => useDebugLogs());
    await waitFor(() => {
      expect(result.current.logs).toEqual(entries);
    });

    expect(LogStorageService.getAll).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when no logs exist', async () => {
    vi.mocked(LogStorageService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useDebugLogs());
    await waitFor(() => {
      expect(result.current.logs).toEqual([]);
    });
  });

  it('should clear logs when clear() is called', async () => {
    const entries = [makeLogEntry({ id: '1' })];
    vi.mocked(LogStorageService.getAll).mockResolvedValue(entries);
    vi.mocked(LogStorageService.clear).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDebugLogs());
    await waitFor(() => {
      expect(result.current.logs).toHaveLength(1);
    });

    await act(async () => {
      await result.current.clear();
    });

    expect(LogStorageService.clear).toHaveBeenCalledTimes(1);
    expect(result.current.logs).toEqual([]);
  });

  it('should reload logs when refresh() is called', async () => {
    const initialEntries = [makeLogEntry({ id: '1' })];
    const refreshedEntries = [makeLogEntry({ id: '1' }), makeLogEntry({ id: '2' })];
    vi.mocked(LogStorageService.getAll)
      .mockResolvedValueOnce(initialEntries)
      .mockResolvedValueOnce(refreshedEntries);

    const { result } = renderHook(() => useDebugLogs());
    await waitFor(() => {
      expect(result.current.logs).toHaveLength(1);
    });

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.logs).toHaveLength(2);
    });

    expect(LogStorageService.getAll).toHaveBeenCalledTimes(2);
  });
});
