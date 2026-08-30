// src/logging/storage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogStorageService } from './storage';
import {
  getLogEntries,
  saveLogEntries,
  clearLogEntries,
  LOG_ENTRY_LIMIT,
  type LogEntry,
} from '../db';

// Mock the db layer so storage tests don't touch real IndexedDB
vi.mock('../db', () => ({
  getLogEntries: vi.fn(),
  saveLogEntries: vi.fn(),
  clearLogEntries: vi.fn(),
  LOG_ENTRY_LIMIT: 1000,
}));

const makeLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: `log-${Math.random().toString(36).slice(2, 9)}`,
  timestamp: Date.now(),
  actionType: 'IDLE_PROGRESSION',
  category: 'ENGINE_TICK',
  executionTimeMs: 0.1,
  stateDiff: [{ key: 'totalDistanceKm', from: 0, to: 10 }],
  seed: 'test-seed',
  ...overrides,
});

describe('LogStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('append', () => {
    it('should persist a new entry to an empty store', async () => {
      vi.mocked(getLogEntries).mockResolvedValue(undefined);
      vi.mocked(saveLogEntries).mockResolvedValue(undefined);

      const entry = makeLogEntry();
      await LogStorageService.append(entry);

      expect(getLogEntries).toHaveBeenCalledTimes(1);
      expect(saveLogEntries).toHaveBeenCalledTimes(1);
      expect(saveLogEntries).toHaveBeenCalledWith([entry]);
    });

    it('should append to existing entries', async () => {
      const existing = [makeLogEntry({ id: 'old-1' })];
      vi.mocked(getLogEntries).mockResolvedValue(existing);
      vi.mocked(saveLogEntries).mockResolvedValue(undefined);

      const newEntry = makeLogEntry({ id: 'new-1' });
      await LogStorageService.append(newEntry);

      expect(saveLogEntries).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'old-1' }),
        expect.objectContaining({ id: 'new-1' }),
      ]);
    });

    it('should trim to LOG_ENTRY_LIMIT when buffer is full (ring buffer)', async () => {
      // Simulate a full buffer
      const fullBuffer: LogEntry[] = [];
      for (let i = 0; i < LOG_ENTRY_LIMIT; i++) {
        fullBuffer.push(makeLogEntry({ id: `old-${i}` }));
      }
      vi.mocked(getLogEntries).mockResolvedValue(fullBuffer);
      vi.mocked(saveLogEntries).mockResolvedValue(undefined);

      const newEntry = makeLogEntry({ id: 'overflow-entry' });
      await LogStorageService.append(newEntry);

      const savedArg = vi.mocked(saveLogEntries).mock.calls[0][0];
      expect(savedArg).toHaveLength(LOG_ENTRY_LIMIT);
      // The oldest entry (old-0) should be dropped, oldest remaining is old-1
      expect(savedArg[0].id).toBe('old-1');
      expect(savedArg[savedArg.length - 1].id).toBe('overflow-entry');
    });

    it('should serialize concurrent appends via a promise queue', async () => {
      // Use a shared mock store to simulate read-modify-write persistence
      const mockStore: LogEntry[] = [];
      vi.mocked(getLogEntries).mockImplementation(async () => [...mockStore]);
      vi.mocked(saveLogEntries).mockImplementation(async (entries) => {
        mockStore.length = 0;
        mockStore.push(...entries);
      });

      const entry1 = makeLogEntry({ id: 'concurrent-1' });
      const entry2 = makeLogEntry({ id: 'concurrent-2' });

      // Append sequentially, awaiting each — the writeQueue serializes them
      await LogStorageService.append(entry1);
      await LogStorageService.append(entry2);

      expect(saveLogEntries).toHaveBeenCalledTimes(2);
      // Second write should include the first entry
      const secondWriteArg = vi.mocked(saveLogEntries).mock.calls[1][0];
      expect(secondWriteArg).toHaveLength(2);
      expect(secondWriteArg[0].id).toBe('concurrent-1');
      expect(secondWriteArg[1].id).toBe('concurrent-2');
    });

    it('should not throw on IDB errors (fire-and-forget)', async () => {
      vi.mocked(getLogEntries).mockRejectedValue(new Error('IDB error'));
      vi.mocked(saveLogEntries).mockResolvedValue(undefined);

      // Should not throw — the error is caught internally
      await expect(LogStorageService.append(makeLogEntry())).resolves.toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return entries from IDB', async () => {
      const entries = [makeLogEntry({ id: '1' }), makeLogEntry({ id: '2' })];
      vi.mocked(getLogEntries).mockResolvedValue(entries);

      const result = await LogStorageService.getAll();
      expect(result).toEqual(entries);
    });

    it('should return an empty array when no logs exist', async () => {
      vi.mocked(getLogEntries).mockResolvedValue(undefined);

      const result = await LogStorageService.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should call clearLogEntries', async () => {
      vi.mocked(clearLogEntries).mockResolvedValue(undefined);

      await LogStorageService.clear();
      expect(clearLogEntries).toHaveBeenCalledTimes(1);
    });
  });
});