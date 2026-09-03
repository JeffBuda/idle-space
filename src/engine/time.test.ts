import { describe, it, expect } from 'vitest';
import {
  advanceIdleGate,
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
    totalElapsedGameTime: 500,
    totalDistanceKm: 5000,
    rngSeed: 'test-seed',
    version: '0.1.0',
    screen: 'PLANET',
    idleTimer: null,
    oreCounts: { commonOre: 0, rareOre: 0 },
    selectedOre: null,
    constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
    lastError: null,
    starMap: null,
    routePath: [],
    routeTravelTimeSeconds: 0,
    currentLocation: 'sys_0',
  };

  it('should calculate idle progression deterministically based on time deltas', () => {
    // 1000 seconds elapsed → 1000 * 10 = 10 000 km added
    const result = processIdleProgression(baseGameState, 2_000_000);
    expect(result.elapsedSeconds).toBe(500 + 1000);
    expect(result.totalElapsedGameTime).toBe(500 + 1000);
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

describe('advanceIdleGate', () => {
  const baseGate = (over: Partial<GameState> = {}): GameState => ({
    lastTimestamp: 1_000_000,
    elapsedSeconds: 0,
    totalElapsedGameTime: 0,
    totalDistanceKm: 0,
    rngSeed: 's',
    version: '0.1.0',
    screen: 'SPACE_TRAVEL',
    idleTimer: null,
    oreCounts: { commonOre: 0, rareOre: 0 },
    selectedOre: null,
    constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
    lastError: null,
    starMap: null,
    routePath: [],
    routeTravelTimeSeconds: 0,
    currentLocation: 'sys_0',
    ...over,
  });
  const gate = (remaining: number, startedAt: number) => ({
    screen: 'SPACE_TRAVEL' as const,
    targetSeconds: 30,
    remainingSeconds: remaining,
    startedAt,
  });

  it('decays remainingSeconds by the delta since startedAt and advances startedAt', () => {
    const s = baseGate({ idleTimer: gate(30, 1_000_000) });
    const r = advanceIdleGate(s, 1_005_000); // 5s elapsed
    expect(r.idleTimer?.remainingSeconds).toBe(25);
    expect(r.idleTimer?.startedAt).toBe(1_005_000);
  });

  it('clamps remaining at 0 when the gate fully expires', () => {
    const s = baseGate({ idleTimer: gate(5, 1_000_000) });
    expect(advanceIdleGate(s, 1_060_000).idleTimer?.remainingSeconds).toBe(0);
  });

  it('returns the same ref when no gate is active', () => {
    const s = baseGate();
    expect(advanceIdleGate(s, 2_000_000)).toBe(s);
  });

  it('returns the same ref when the gate screen does not match the current screen', () => {
    const s = baseGate({ screen: 'PLANET', idleTimer: gate(30, 1_000_000) });
    expect(advanceIdleGate(s, 2_000_000)).toBe(s);
  });

  it('returns the same ref when the delta is sub-second (floor -> 0)', () => {
    const s = baseGate({ idleTimer: gate(30, 2_000_000) });
    expect(advanceIdleGate(s, 2_000_500)).toBe(s);
  });

  it('never mutates the input', () => {
    const s = baseGate({ idleTimer: gate(30, 1_000_000) });
    advanceIdleGate(s, 1_005_000);
    expect(s.idleTimer?.remainingSeconds).toBe(30);
  });
});
