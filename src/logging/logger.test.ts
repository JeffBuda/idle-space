// src/logging/logger.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withLogging, calculateDiff } from './logger';
import { LogStorageService } from './storage';
import { engineReducer, type GameAction } from '../engine/reducer';
import { type GameState } from '../engine/time';

// Mock the storage layer so withLogging tests don't touch IndexedDB
vi.mock('./storage', () => ({
  LogStorageService: {
    append: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

const baseState: GameState = {
  lastTimestamp: 1_000_000,
  elapsedSeconds: 500,
  rngSeed: 'test-seed',
  totalDistanceKm: 5_000,
  version: '0.1.0',
};

describe('calculateDiff', () => {
  it('should return an empty array when states are identical', () => {
    const state = { a: 1, b: 'hello', c: true };
    expect(calculateDiff(state, state)).toEqual([]);
  });

  it('should detect a changed value', () => {
    const prev = { a: 1, b: 'hello' };
    const next = { a: 2, b: 'hello' };
    expect(calculateDiff(prev, next)).toEqual([
      { key: 'a', from: 1, to: 2 },
    ]);
  });

  it('should detect multiple changed values', () => {
    const prev = { a: 1, b: 'hello' };
    const next = { a: 2, b: 'world' };
    const diff = calculateDiff(prev, next);
    expect(diff).toHaveLength(2);
    expect(diff).toContainEqual({ key: 'a', from: 1, to: 2 });
    expect(diff).toContainEqual({ key: 'b', from: 'hello', to: 'world' });
  });

  it('should detect a newly added key (from undefined)', () => {
    const prev = { a: 1 };
    const next = { a: 1, b: 'new' };
    expect(calculateDiff(prev, next)).toEqual([
      { key: 'b', from: undefined, to: 'new' },
    ]);
  });

  it('should detect a removed key (to undefined)', () => {
    const prev = { a: 1, b: 'value' };
    const next = { a: 1 };
    expect(calculateDiff(prev, next)).toEqual([
      { key: 'b', from: 'value', to: undefined },
    ]);
  });

  it('should handle empty state objects', () => {
    expect(calculateDiff({}, {})).toEqual([]);
  });

  it('should handle objects with many keys efficiently', () => {
    const prev: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) {
      prev[`key${i}`] = i;
      next[`key${i}`] = i + 1;
    }
    const diff = calculateDiff(prev, next);
    expect(diff).toHaveLength(50);
  });
});

describe('withLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the same GameState as the underlying reducer', () => {
    const wrapped = withLogging(engineReducer);
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    const result = wrapped(baseState, action, 2_000_000, 'test-seed');

    // With 1 000 s elapsed at 10 km/s, 10 000 km is added
    expect(result.totalDistanceKm).toBe(5_000 + 10_000);
    expect(result.elapsedSeconds).toBe(500 + 1_000);
    expect(result.lastTimestamp).toBe(2_000_000);
  });

  it('should dispatch a log entry to LogStorageService.append on each call', () => {
    const wrapped = withLogging(engineReducer);
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    wrapped(baseState, action, 2_000_000, 'test-seed');

    expect(LogStorageService.append).toHaveBeenCalledTimes(1);
    const logEntry = vi.mocked(LogStorageService.append).mock.calls[0][0];
    expect(logEntry).toMatchObject({
      actionType: 'IDLE_PROGRESSION',
      category: 'ENGINE_TICK',
      seed: 'test-seed',
    });
    expect(logEntry.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(logEntry.id).toBeTruthy();
    expect(logEntry.timestamp).toBeTruthy();
    expect(Array.isArray(logEntry.stateDiff)).toBe(true);
  });

  it('should not throw when LogStorageService.append rejects (fire-and-forget)', () => {
    vi.mocked(LogStorageService.append).mockRejectedValueOnce(
      new Error('IDB write failed'),
    );
    const wrapped = withLogging(engineReducer);
    const action: GameAction = { type: 'IDLE_PROGRESSION' };

    expect(() => wrapped(baseState, action, 2_000_000, 'test-seed')).not.toThrow();
  });

  it('should capture stateDiff with from/to values for changed fields', () => {
    const wrapped = withLogging(engineReducer);
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    wrapped(baseState, action, 2_000_000, 'test-seed');

    const logEntry = vi.mocked(LogStorageService.append).mock.calls[0][0];
    const elapsedDiff = logEntry.stateDiff.find((d) => d.key === 'elapsedSeconds');
    expect(elapsedDiff).toBeDefined();
    expect(elapsedDiff?.from).toBe(500);
    expect(elapsedDiff?.to).toBe(1_500);
  });

  it('should log APP_WAKE with APP_EVENT category', () => {
    const wrapped = withLogging(engineReducer);
    const action: GameAction = { type: 'APP_WAKE' };
    wrapped(baseState, action, 2_000_000, 'test-seed');

    expect(LogStorageService.append).toHaveBeenCalledTimes(1);
    const logEntry = vi.mocked(LogStorageService.append).mock.calls[0][0];
    expect(logEntry).toMatchObject({
      actionType: 'APP_WAKE',
      category: 'APP_EVENT',
      seed: 'test-seed',
    });
    // APP_WAKE processes idle progression, so the diff should show changes
    expect(logEntry.stateDiff.length).toBeGreaterThan(0);
    const lastTsDiff = logEntry.stateDiff.find((d) => d.key === 'lastTimestamp');
    expect(lastTsDiff).toBeDefined();
    expect(lastTsDiff?.from).toBe(1_000_000);
    expect(lastTsDiff?.to).toBe(2_000_000);
  });

  it('should log APP_SUSPEND with APP_EVENT category and capture lastTimestamp change', () => {
    const wrapped = withLogging(engineReducer);
    const action: GameAction = { type: 'APP_SUSPEND' };
    const now = 2_000_000;
    wrapped(baseState, action, now, 'test-seed');

    expect(LogStorageService.append).toHaveBeenCalledTimes(1);
    const logEntry = vi.mocked(LogStorageService.append).mock.calls[0][0];
    expect(logEntry).toMatchObject({
      actionType: 'APP_SUSPEND',
      category: 'APP_EVENT',
      seed: 'test-seed',
    });
    // APP_SUSPEND updates lastTimestamp only ΓÇö diff should show exactly that
    const lastTsDiff = logEntry.stateDiff.find((d) => d.key === 'lastTimestamp');
    expect(lastTsDiff).toBeDefined();
    expect(lastTsDiff?.from).toBe(1_000_000);
    expect(lastTsDiff?.to).toBe(now);
    // Other fields should not appear in the diff
    expect(logEntry.stateDiff).toHaveLength(1);
  });

  it('should still log IDLE_PROGRESSION with ENGINE_TICK category', () => {
    const wrapped = withLogging(engineReducer);
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    wrapped(baseState, action, 2_000_000, 'test-seed');

    const logEntry = vi.mocked(LogStorageService.append).mock.calls[0][0];
    expect(logEntry).toMatchObject({
      actionType: 'IDLE_PROGRESSION',
      category: 'ENGINE_TICK',
    });
  });
});
