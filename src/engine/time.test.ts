import { describe, it, expect } from 'vitest';
import {
  calculateIdleDistance,
  processIdleProgression,
  type EngineState,
  type GameState,
} from './time';

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

describe('processIdleProgression', () => {
  const baseGameState: GameState = {
    lastTimestamp: 1_000_000,
    elapsedSeconds: 500,
    rngSeed: 'test-seed',
    totalDistanceKm: 5000,
    version: '0.1.0',
  };

  it('should calculate idle progression deterministically based on time deltas', () => {
    // 1000 seconds elapsed → 1000 * 10 = 10 000 km added
    const result = processIdleProgression(baseGameState, 2_000_000);
    expect(result.elapsedSeconds).toBe(500 + 1000);
    expect(result.totalDistanceKm).toBe(5000 + 10000);
  });

  it('should use a custom speed when provided', () => {
    // 500 seconds elapsed at 20 km/s → 500 * 20 = 10 000 km added
    const result = processIdleProgression(baseGameState, 1_500_000, 20);
    expect(result.totalDistanceKm).toBe(5000 + 10000);
  });

  it('should return a new object reference (immutability)', () => {
    const result = processIdleProgression(baseGameState, 2_000_000);
    expect(result).not.toBe(baseGameState);
  });

  it('should not mutate the original state object', () => {
    const original = { ...baseGameState };
    processIdleProgression(baseGameState, 2_000_000);
    expect(baseGameState).toEqual(original);
  });

  it('should handle zero-delta time (currentTime equals lastTimestamp)', () => {
    const result = processIdleProgression(baseGameState, baseGameState.lastTimestamp);
    expect(result.elapsedSeconds).toBe(baseGameState.elapsedSeconds);
    expect(result.totalDistanceKm).toBe(baseGameState.totalDistanceKm);
    expect(result.lastTimestamp).toBe(baseGameState.lastTimestamp);
  });

  it('should handle negative-delta time by treating delta as zero', () => {
    const earlierTime = baseGameState.lastTimestamp - 5_000; // 5 s in the past
    const result = processIdleProgression(baseGameState, earlierTime);
    // deltaSeconds = max(0, negative) = 0 → no progression added
    expect(result.elapsedSeconds).toBe(baseGameState.elapsedSeconds);
    expect(result.totalDistanceKm).toBe(baseGameState.totalDistanceKm);
    // lastTimestamp is still updated to the (earlier) currentTime
    expect(result.lastTimestamp).toBe(earlierTime);
  });

  it('should always update lastTimestamp to currentTime', () => {
    const result = processIdleProgression(baseGameState, 2_000_000);
    expect(result.lastTimestamp).toBe(2_000_000);
  });

  it('should preserve the rngSeed field from previous state', () => {
    const result = processIdleProgression(baseGameState, 2_000_000);
    expect(result.rngSeed).toBe(baseGameState.rngSeed);
  });

  it('should preserve the version field from previous state', () => {
    const result = processIdleProgression(baseGameState, 2_000_000);
    expect(result.version).toBe(baseGameState.version);
  });
});
