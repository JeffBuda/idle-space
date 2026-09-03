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
      currentLocation: 'sys_0',
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

  it('migrates legacy pre-v4 saves with missing starMap/routePath/routeTravelTimeSeconds fields', () => {
    // Legacy saves predate the star map feature — fields are entirely absent
    // from the serialized object. The spread of GAME_STATE_DEFAULT should fill
    // them in, and the explicit nullish guards are a no-op (already defaulted).
    const legacy = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 500,
      rngSeed: 'legacy',
      totalDistanceKm: 5_000,
      version: '0.1.0',
      screen: 'WELCOME' as const,
      idleTimer: null,
      oreCounts: { commonOre: 0, rareOre: 0 },
      selectedOre: null,
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
      lastError: null,
    } as GameState;

    const migrated = migrateGameState(legacy);

    expect(migrated.starMap).toBeNull();
    expect(migrated.routePath).toEqual([]);
    expect(migrated.routeTravelTimeSeconds).toBe(0);
  });

  it('fills starMap/routePath/routeTravelTimeSeconds from nullish guards on partial writes', () => {
    // Partially-written save: star map fields present-but-undefined.
    // The nullish coalescing guards in migrateGameState must fill the gaps.
    const partial = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 500,
      rngSeed: 'partial',
      totalDistanceKm: 5_000,
      version: '0.1.0',
      screen: 'PLANET' as const,
      idleTimer: null,
      oreCounts: { commonOre: 0, rareOre: 0 },
      selectedOre: null,
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
      lastError: null,
      starMap: undefined,
      routePath: undefined,
      routeTravelTimeSeconds: undefined,
    } as unknown as GameState;

    const migrated = migrateGameState(partial);

    expect(migrated.starMap).toBeNull();
    expect(migrated.routePath).toEqual([]);
    expect(migrated.routeTravelTimeSeconds).toBe(0);
  });

  it('preserves an active star map and route path during migration', () => {
    // When the player has an active star map with a plotted route, the
    // spread in migrateGameState must preserve all values unchanged.
    const starMap = {
      nodes: [
        { id: 'sys_0', name: 'Sol', x: 50, y: 50, status: 'current' as const, edges: ['sys_1'] },
        {
          id: 'sys_1',
          name: 'Alpha Centauri',
          x: 70,
          y: 30,
          status: 'unknown' as const,
          edges: ['sys_0'],
        },
      ],
      edges: [{ from: 'sys_0', to: 'sys_1' }],
      plannedRoute: ['sys_1'],
      currentLocationId: 'sys_0',
      zoomLevel: 1.5,
    };
    const routePath = [{ from: 'sys_0', to: 'sys_1', path: ['sys_0', 'sys_1'], hops: 1 }];
    const active = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 500,
      rngSeed: 'active',
      totalDistanceKm: 5_000,
      version: '0.1.0',
      screen: 'STAR_MAP' as const,
      idleTimer: null,
      oreCounts: { commonOre: 5, rareOre: 3 },
      selectedOre: null,
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
      lastError: null,
      starMap,
      routePath,
      routeTravelTimeSeconds: 10,
    } as GameState;

    const migrated = migrateGameState(active);

    expect(migrated.starMap).toBe(starMap);
    expect(migrated.routePath).toBe(routePath);
    expect(migrated.routeTravelTimeSeconds).toBe(10);
  });

  it('guards routePath null (corrupted) to empty array', () => {
    // A corrupted save where routePath is explicitly null (not undefined)
    // must still be guarded to an empty array by the nullish coalescing.
    const corrupted = {
      lastTimestamp: 1_000_000,
      elapsedSeconds: 500,
      rngSeed: 'corrupt',
      totalDistanceKm: 5_000,
      version: '0.1.0',
      screen: 'STAR_MAP' as const,
      idleTimer: null,
      oreCounts: { commonOre: 0, rareOre: 0 },
      selectedOre: null,
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
      lastError: null,
      starMap: null,
      routePath: null,
      routeTravelTimeSeconds: null,
    } as unknown as GameState;

    const migrated = migrateGameState(corrupted);

    expect(migrated.starMap).toBeNull();
    expect(migrated.routePath).toEqual([]);
    expect(migrated.routeTravelTimeSeconds).toBe(0);
  });
});
