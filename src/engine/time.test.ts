import { describe, it, expect } from 'vitest';
import { calculateIdleDistance, type EngineState } from './time';

describe('calculateIdleDistance', () => {
  const baseState: EngineState = {
    lastProcessedTime: 1_000_000,
    totalDistanceKm: 500,
    seed: 'test-seed',
  };

  it('should calculate distance deterministically based on elapsed time deltas', () => {
    // 1000 seconds elapsed → 1000 * 10 = 10 000 km
    const result = calculateIdleDistance(baseState, 2_000_000);
    expect(result.totalDistanceKm).toBe(500 + 10_000);
  });

  it('should use a custom speed when provided', () => {
    // 500 seconds elapsed at 20 km/s → 500 * 20 = 10 000 km
    const result = calculateIdleDistance(baseState, 1_500_000, 20);
    expect(result.totalDistanceKm).toBe(500 + 10_000);
  });

  it('should return a new object reference (immutability)', () => {
    const result = calculateIdleDistance(baseState, 2_000_000);
    expect(result).not.toBe(baseState);
  });

  it('should not mutate the original state object', () => {
    const original = { ...baseState };
    calculateIdleDistance(baseState, 2_000_000);
    expect(baseState).toEqual(original);
  });

  it('should handle zero-delta time (currentTime equals lastProcessedTime)', () => {
    const result = calculateIdleDistance(baseState, baseState.lastProcessedTime);
    expect(result.totalDistanceKm).toBe(baseState.totalDistanceKm);
    expect(result.lastProcessedTime).toBe(baseState.lastProcessedTime);
  });

  it('should handle negative-delta time by treating delta as zero', () => {
    const earlierTime = baseState.lastProcessedTime - 5_000; // 5 s in the past
    const result = calculateIdleDistance(baseState, earlierTime);
    // deltaSeconds = max(0, negative) = 0 → no distance added
    expect(result.totalDistanceKm).toBe(baseState.totalDistanceKm);
    // lastProcessedTime is still updated to the (earlier) currentTime
    expect(result.lastProcessedTime).toBe(earlierTime);
  });

  it('should always update lastProcessedTime to currentTime', () => {
    const result = calculateIdleDistance(baseState, 2_000_000);
    expect(result.lastProcessedTime).toBe(2_000_000);
  });

  it('should preserve the seed field from previous state', () => {
    const result = calculateIdleDistance(baseState, 2_000_000);
    expect(result.seed).toBe(baseState.seed);
  });
});
