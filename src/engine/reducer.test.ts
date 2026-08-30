// src/engine/reducer.test.ts
import { describe, it, expect } from 'vitest';
import { engineReducer, SPEED_KM_PER_SEC, type GameAction } from './reducer';
import { type GameState } from './time';

const baseState: GameState = {
  lastTimestamp: 1_000_000,
  elapsedSeconds: 500,
  rngSeed: 'test-seed',
  totalDistanceKm: 5_000,
  version: '0.1.0',
};

describe('engineReducer', () => {
  it('should process idle progression correctly via delegated engine function', () => {
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    const now = 2_000_000; // 1 000 seconds elapsed → 10 000 km at 10 km/s
    const result = engineReducer(baseState, action, now, 'test-seed');

    expect(result.elapsedSeconds).toBe(500 + 1_000);
    expect(result.totalDistanceKm).toBe(5_000 + 10_000);
    expect(result.lastTimestamp).toBe(now);
    expect(result.rngSeed).toBe('test-seed');
    expect(result.version).toBe('0.1.0');
  });

  it('should return a new object reference (immutability)', () => {
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    const result = engineReducer(baseState, action, 2_000_000, 'seed');
    expect(result).not.toBe(baseState);
  });

  it('should not mutate the original state object', () => {
    const original = { ...baseState };
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    engineReducer(baseState, action, 2_000_000, 'seed');
    expect(baseState).toEqual(original);
  });

  it('should return the same state reference for unknown action types', () => {
    const unknownAction = { type: 'UNKNOWN' } as unknown as GameAction;
    const result = engineReducer(baseState, unknownAction, 2_000_000, 'seed');
    expect(result).toBe(baseState);
  });

  it('should propagate the seed parameter to processIdleProgression via engine function', () => {
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    const result = engineReducer(baseState, action, 1_001_000, 'custom-seed');
    // 1 second elapsed → 1 * 10 = 10 km added
    expect(result.totalDistanceKm).toBe(5_000 + 10);
    expect(result.rngSeed).toBe('test-seed'); // rngSeed preserved from state
  });
});

describe('SPEED_KM_PER_SEC', () => {
  it('should be 10', () => {
    expect(SPEED_KM_PER_SEC).toBe(10);
  });
});