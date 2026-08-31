// src/db/index.test.ts
//
// Unit tests for the pure migrateGameState helper. The db module imports
// `idb` for its IndexedDB functions, but migrateGameState itself is a
// pure function — we mock `idb` to avoid needing a real IDB at test time.
import { describe, it, expect, vi } from 'vitest';

vi.mock('idb', () => ({
  openDB: vi.fn(),
}));

import { migrateGameState } from './index';
import type { GameState } from '../types/game-state';

describe('migrateGameState', () => {
  it('fills in WELCOME screen and all onboarding fields for legacy saves', () => {
    // Pre-onboarding GameState had only 5 fields — no screen, oreCounts, etc.
    const legacy = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 500,
      rngSeed: 'legacy-seed',
      totalDistanceKm: 5_000,
      version: '0.1.0',
    } as GameState;

    const migrated = migrateGameState(legacy);

    expect(migrated.screen).toBe('WELCOME');
    expect(migrated.totalElapsedGameTime).toBe(0);
    expect(migrated.idleTimer).toBeNull();
    expect(migrated.oreCounts).toEqual({ commonOre: 0, rareOre: 0 });
    expect(migrated.selectedOre).toBeNull();
    expect(migrated.constants).toEqual({
      defaultActionTimeSeconds: 30,
      rareOreTimeMultiplier: 2,
    });
    expect(migrated.lastError).toBeNull();
  });

  it('preserves legacy travel stats during migration', () => {
    const legacy = {
      lastTimestamp: 2_000_000,
      elapsedSeconds: 1_000,
      rngSeed: 'old-seed',
      totalDistanceKm: 10_000,
      version: '0.1.0',
    } as GameState;

    const migrated = migrateGameState(legacy);

    expect(migrated.lastTimestamp).toBe(2_000_000);
    expect(migrated.elapsedSeconds).toBe(1_000);
    expect(migrated.rngSeed).toBe('old-seed');
    expect(migrated.totalDistanceKm).toBe(10_000);
    expect(migrated.version).toBe('0.1.0');
  });

  it('preserves existing values on a modern save (no-op migration)', () => {
    const modern: GameState = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 500,
      totalElapsedGameTime: 500,
      rngSeed: 'mod-seed',
      totalDistanceKm: 5_000,
      version: '0.1.0',
      screen: 'PLANET',
      idleTimer: null,
      oreCounts: { commonOre: 5, rareOre: 3 },
      selectedOre: null,
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
      lastError: null,
    };

    const migrated = migrateGameState(modern);

    expect(migrated.screen).toBe('PLANET');
    expect(migrated.oreCounts).toEqual({ commonOre: 5, rareOre: 3 });
    expect(migrated.rngSeed).toBe('mod-seed');
    expect(migrated.totalDistanceKm).toBe(5_000);
    expect(migrated.totalElapsedGameTime).toBe(500);
  });

  it('handles partially-written saves with explicit undefined fields', () => {
    const partial = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 100,
      rngSeed: 'partial',
      totalDistanceKm: 1_000,
      version: '0.1.0',
      screen: undefined,
      idleTimer: undefined,
      oreCounts: undefined,
      selectedOre: undefined,
      constants: undefined,
      totalElapsedGameTime: undefined,
      lastError: undefined,
    } as unknown as GameState;

    const migrated = migrateGameState(partial);

    expect(migrated.screen).toBe('WELCOME');
    expect(migrated.idleTimer).toBeNull();
    expect(migrated.oreCounts).toEqual({ commonOre: 0, rareOre: 0 });
    expect(migrated.selectedOre).toBeNull();
    expect(migrated.constants).toEqual({
      defaultActionTimeSeconds: 30,
      rareOreTimeMultiplier: 2,
    });
    expect(migrated.totalElapsedGameTime).toBe(0);
    expect(migrated.lastError).toBeNull();
  });

  it('returns a new object reference (immutability)', () => {
    const legacy = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 500,
      rngSeed: 'seed',
      totalDistanceKm: 5_000,
      version: '0.1.0',
    } as GameState;

    const migrated = migrateGameState(legacy);
    expect(migrated).not.toBe(legacy);
  });
});
