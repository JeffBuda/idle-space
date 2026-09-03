// src/engine/mining.test.ts
//
// Pure-function unit tests for the mining auto-loop (src/engine/mining.ts).
// No mocks needed — every input (state + currentTime) is explicit.
import { describe, it, expect } from 'vitest';
import { processMiningGate, type GameState } from './mining';
import { type OreType } from '../types/game-state';

const TIME = 2_000_000;

const baseMining = (over: Partial<GameState> = {}): GameState => ({
  lastTimestamp: TIME,
  elapsedSeconds: 0,
  totalElapsedGameTime: 0,
  totalDistanceKm: 0,
  rngSeed: 'test-seed',
  version: '0.1.0',
  screen: 'MINING',
  idleTimer: null,
  oreCounts: { commonOre: 0, rareOre: 0 },
  selectedOre: null,
  constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
  lastError: null,
  currentLocation: 'sys_0',
  ...over,
});

const miningTimer = (remaining: number, startedAt: number, target: number = 30) => ({
  screen: 'MINING' as const,
  targetSeconds: target,
  remainingSeconds: remaining,
  startedAt,
});

describe('processMiningGate: no-op guards', () => {
  it('returns the same ref when the screen is not MINING', () => {
    const s = baseMining({
      screen: 'PLANET',
      selectedOre: 'commonOre',
      idleTimer: miningTimer(10, TIME),
    });
    expect(processMiningGate(s, TIME + 60_000)).toBe(s);
  });

  it('returns the same ref when selectedOre is null', () => {
    const s = baseMining({ selectedOre: null, idleTimer: miningTimer(10, TIME) });
    expect(processMiningGate(s, TIME + 60_000)).toBe(s);
  });

  it('returns the same ref when no gate is active', () => {
    const s = baseMining({ selectedOre: 'commonOre', idleTimer: null });
    expect(processMiningGate(s, TIME + 60_000)).toBe(s);
  });

  it('returns the same ref on a sub-second delta (nothing to collapse)', () => {
    const s = baseMining({ selectedOre: 'commonOre', idleTimer: miningTimer(30, TIME) });
    expect(processMiningGate(s, TIME + 500)).toBe(s);
  });

  it('returns the same ref when the gate target is zero (safety)', () => {
    const s = baseMining({ selectedOre: 'commonOre', idleTimer: miningTimer(0, TIME, 0) });
    expect(processMiningGate(s, TIME + 60_000)).toBe(s);
  });
});

describe('processMiningGate: cycle completion arithmetic', () => {
  it('awards 1 ore and starts a fresh 30s gate on exact expiry', () => {
    const s = baseMining({ selectedOre: 'commonOre', idleTimer: miningTimer(5, TIME) });
    const r = processMiningGate(s, TIME + 5_000);
    expect(r.oreCounts).toEqual({ commonOre: 1, rareOre: 0 });
    expect(r.idleTimer?.remainingSeconds).toBe(30);
    expect(r.idleTimer?.startedAt).toBe(TIME + 5_000);
    expect(r.screen).toBe('MINING');
  });

  it('awards 1 ore and restarts when the persisted gate was already at 0s', () => {
    const s = baseMining({ selectedOre: 'commonOre', idleTimer: miningTimer(0, TIME) });
    const r = processMiningGate(s, TIME + 30_000);
    expect(r.oreCounts.commonOre).toBe(2);
    expect(r.idleTimer?.remainingSeconds).toBe(30);
  });

  it('collapses a long idle span into several completed cycles + a fresh restart', () => {
    const s = baseMining({ selectedOre: 'commonOre', idleTimer: miningTimer(5, TIME) });
    // 95s idle: 5s finishes cycle 1, then 90s = 3 full 30s cycles -> 4 ores, exact boundary
    const r = processMiningGate(s, TIME + 95_000);
    expect(r.oreCounts).toEqual({ commonOre: 4, rareOre: 0 });
    expect(r.idleTimer?.remainingSeconds).toBe(30);
  });

  it('leaves the in-progress cycle with the correct partial remaining time', () => {
    const s = baseMining({ selectedOre: 'commonOre', idleTimer: miningTimer(30, TIME) });
    // 75s idle: 30 (c1) + 30 (c2) + 15 into c3 -> 2 ores, 15s left
    const r = processMiningGate(s, TIME + 75_000);
    expect(r.oreCounts).toEqual({ commonOre: 2, rareOre: 0 });
    expect(r.idleTimer?.remainingSeconds).toBe(15);
    expect(r.idleTimer?.targetSeconds).toBe(30);
  });

  it('rare ore (60s target) awards one unit per completed cycle', () => {
    const s = baseMining({
      selectedOre: 'rareOre' as OreType,
      idleTimer: miningTimer(60, TIME, 60),
    });
    // 119s idle: 60 completes the pending cycle + 59 into the next -> 1 ore, 1s left
    const r = processMiningGate(s, TIME + 119_000);
    expect(r.oreCounts).toEqual({ commonOre: 0, rareOre: 1 });
    expect(r.idleTimer?.remainingSeconds).toBe(1);
    expect(r.idleTimer?.targetSeconds).toBe(60);
  });

  it('awards only the selected ore type', () => {
    const base = baseMining({
      selectedOre: 'rareOre' as OreType,
      idleTimer: miningTimer(0, TIME, 60),
      oreCounts: { commonOre: 7, rareOre: 2 },
    });
    const r = processMiningGate(base, TIME + 60_000);
    expect(r.oreCounts).toEqual({ commonOre: 7, rareOre: 4 });
  });

  it('preserves unrelated fields (immutability boundary)', () => {
    const s = baseMining({
      selectedOre: 'commonOre',
      idleTimer: miningTimer(0, TIME, 30),
      oreCounts: { commonOre: 3, rareOre: 5 },
    });
    const r = processMiningGate(s, TIME + 30_000);
    // remaining=0 + 30s delta: 1 award for the already-expired cycle + 1 for
    // the full 30s leftover cycle = 2 ores (3 + 2 = 5).
    expect(r.oreCounts).toEqual({ commonOre: 5, rareOre: 5 });
    expect(r.rngSeed).toBe('test-seed');
    expect(r.version).toBe('0.1.0');
  });
});
