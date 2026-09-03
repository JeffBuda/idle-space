// src/engine/reducer.test.ts
import { describe, it, expect } from 'vitest';
import { engineReducer, SPEED_KM_PER_SEC, type GameAction } from './reducer';
import { type GameState } from './time';

const baseState: GameState = {
  lastTimestamp: 1_000_000,
  elapsedSeconds: 500,
  totalElapsedGameTime: 500,
  rngSeed: 'test-seed',
  totalDistanceKm: 5_000,
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

describe('engineReducer', () => {
  it('should process idle progression correctly via delegated engine function', () => {
    const action: GameAction = { type: 'IDLE_PROGRESSION' };
    const now = 2_000_000; // 1 000 seconds elapsed -> 10 000 km at 10 km/s
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
    // 1 second elapsed -> 1 * 10 = 10 km added
    expect(result.totalDistanceKm).toBe(5_000 + 10);
    expect(result.rngSeed).toBe('test-seed'); // rngSeed preserved from state
  });

  // ---- APP_WAKE: resuming from idle ----

  it('should process idle progression correctly for APP_WAKE (same as IDLE_PROGRESSION)', () => {
    const action: GameAction = { type: 'APP_WAKE' };
    const now = 2_000_000; // 1 000 seconds elapsed -> 10 000 km at 10 km/s
    const result = engineReducer(baseState, action, now, 'test-seed');

    expect(result.elapsedSeconds).toBe(500 + 1_000);
    expect(result.totalDistanceKm).toBe(5_000 + 10_000);
    expect(result.lastTimestamp).toBe(now);
    expect(result.rngSeed).toBe('test-seed');
    expect(result.version).toBe('0.1.0');
  });

  it('should return a new object reference for APP_WAKE (immutability)', () => {
    const action: GameAction = { type: 'APP_WAKE' };
    const result = engineReducer(baseState, action, 2_000_000, 'seed');
    expect(result).not.toBe(baseState);
  });

  it('should not mutate the original state for APP_WAKE', () => {
    const original = { ...baseState };
    const action: GameAction = { type: 'APP_WAKE' };
    engineReducer(baseState, action, 2_000_000, 'seed');
    expect(baseState).toEqual(original);
  });

  // ---- APP_SUSPEND: going idle ----

  it('should update lastTimestamp for APP_SUSPEND without changing other fields', () => {
    const action: GameAction = { type: 'APP_SUSPEND' };
    const now = 2_000_000;
    const result = engineReducer(baseState, action, now, 'test-seed');

    expect(result.lastTimestamp).toBe(now);
    // Other fields should be preserved unchanged
    expect(result.elapsedSeconds).toBe(500);
    expect(result.totalDistanceKm).toBe(5_000);
    expect(result.rngSeed).toBe('test-seed');
    expect(result.version).toBe('0.1.0');
  });

  it('should return a new object reference for APP_SUSPEND (immutability)', () => {
    const action: GameAction = { type: 'APP_SUSPEND' };
    const result = engineReducer(baseState, action, 2_000_000, 'seed');
    expect(result).not.toBe(baseState);
  });

  it('should not mutate the original state for APP_SUSPEND', () => {
    const original = { ...baseState };
    const action: GameAction = { type: 'APP_SUSPEND' };
    engineReducer(baseState, action, 2_000_000, 'seed');
    expect(baseState).toEqual(original);
  });
});

describe('SPEED_KM_PER_SEC', () => {
  it('should be 10', () => {
    expect(SPEED_KM_PER_SEC).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Star Map Actions — UI Interaction Specification compliance at the reducer level
// ---------------------------------------------------------------------------

describe('star map actions', () => {
  const TIME = 2_000_000;

  const makeStarMapState = (): GameState => ({
    lastTimestamp: TIME,
    elapsedSeconds: 0,
    totalElapsedGameTime: 0,
    rngSeed: 'test-seed',
    totalDistanceKm: 0,
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
  });

  // -- Helper: 3-node chain for adjacency tests --
  const chainStarMap = {
    nodes: [
      { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current' as const, edges: ['sys_1'] },
      {
        id: 'sys_1',
        name: 'B',
        x: 50,
        y: 10,
        status: 'unknown' as const,
        edges: ['sys_0', 'sys_2'],
      },
      { id: 'sys_2', name: 'C', x: 90, y: 10, status: 'unknown' as const, edges: ['sys_1'] },
    ],
    edges: [],
    plannedRoute: [],
    currentLocationId: 'sys_0',
    zoomLevel: 1.0,
  };

  it('STAR_MAP_NODE_TOGGLE does nothing when starMap is null', () => {
    const state = makeStarMapState();
    const result = engineReducer(
      state,
      { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_1' },
      TIME,
      'seed',
    );
    expect(result).toBe(state);
  });

  it('STAR_MAP_NODE_TOGGLE adds an adjacent node (Origin Rule)', () => {
    const state: GameState = { ...makeStarMapState(), starMap: { ...chainStarMap } };
    const result = engineReducer(
      state,
      { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_1' },
      TIME,
      'seed',
    );
    expect(result.starMap!.plannedRoute).toEqual(['sys_1']);
  });

  it('STAR_MAP_NODE_TOGGLE rejects non-adjacent node (Action 2)', () => {
    const state: GameState = { ...makeStarMapState(), starMap: { ...chainStarMap } };
    const result = engineReducer(
      state,
      { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_2' },
      TIME,
      'seed',
    );
    expect(result.starMap!.plannedRoute).toEqual([]);
  });

  it('STAR_MAP_NODE_TOGGLE rejects current location node', () => {
    const state: GameState = { ...makeStarMapState(), starMap: { ...chainStarMap } };
    const result = engineReducer(
      state,
      { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_0' },
      TIME,
      'seed',
    );
    expect(result.starMap!.plannedRoute).toEqual([]);
  });

  it('STAR_MAP_NODE_TOGGLE builds multi-hop contiguous route (Action 4)', () => {
    let state: GameState = { ...makeStarMapState(), starMap: { ...chainStarMap } };
    state = engineReducer(state, { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_1' }, TIME, 'seed');
    state = engineReducer(state, { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_2' }, TIME, 'seed');
    expect(state.starMap!.plannedRoute).toEqual(['sys_1', 'sys_2']);
  });

  it('STAR_MAP_NODE_TOGGLE rejects non-adjacent tail hop (Action 5)', () => {
    const state: GameState = {
      ...makeStarMapState(),
      starMap: { ...chainStarMap, plannedRoute: ['sys_1'] },
    };
    const result = engineReducer(
      state,
      { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_0' },
      TIME,
      'seed',
    );
    expect(result.starMap!.plannedRoute).toEqual(['sys_1']);
  });

  it('STAR_MAP_NODE_TOGGLE sever-tails when re-tapping middle node (Action 8)', () => {
    const state: GameState = {
      ...makeStarMapState(),
      starMap: { ...chainStarMap, plannedRoute: ['sys_1', 'sys_2'] },
    };
    const result = engineReducer(
      state,
      { type: 'STAR_MAP_NODE_TOGGLE', nodeId: 'sys_1' },
      TIME,
      'seed',
    );
    expect(result.starMap!.plannedRoute).toEqual([]);
  });

  it('STAR_MAP_REMOVE_STOP truncates at the removed node', () => {
    const state: GameState = {
      ...makeStarMapState(),
      starMap: { ...chainStarMap, plannedRoute: ['sys_1', 'sys_2'] },
    };
    const result = engineReducer(
      state,
      { type: 'STAR_MAP_REMOVE_STOP', nodeId: 'sys_1' },
      TIME,
      'seed',
    );
    expect(result.starMap!.plannedRoute).toEqual([]);
  });

  it('STAR_MAP_CLEAR_ROUTE clears route, routePath, and travel time', () => {
    const state: GameState = {
      ...makeStarMapState(),
      starMap: { ...chainStarMap, plannedRoute: ['sys_1', 'sys_2'] },
      routePath: [{ from: 'sys_0', to: 'sys_2', path: ['sys_0', 'sys_1', 'sys_2'], hops: 2 }],
      routeTravelTimeSeconds: 10,
    };
    const result = engineReducer(state, { type: 'STAR_MAP_CLEAR_ROUTE' }, TIME, 'seed');
    expect(result.starMap!.plannedRoute).toEqual([]);
    expect(result.routePath).toEqual([]);
    expect(result.routeTravelTimeSeconds).toBe(0);
  });

  it('STAR_MAP_GO with valid route navigates to SPACE_TRAVEL', () => {
    const state: GameState = {
      ...makeStarMapState(),
      starMap: { ...chainStarMap, plannedRoute: ['sys_1'] },
    };
    const result = engineReducer(state, { type: 'STAR_MAP_GO' }, TIME, 'seed');
    expect(result.screen).toBe('SPACE_TRAVEL');
    expect(result.currentLocation).toBe('sys_1');
    expect(result.lastError).toBeNull();
  });

  it('STAR_MAP_GO with invalid route stays on STAR_MAP and sets lastError', () => {
    const disconnectedMap = {
      ...chainStarMap,
      nodes: [
        { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current' as const, edges: [] },
        { id: 'sys_1', name: 'B', x: 50, y: 10, status: 'unknown' as const, edges: [] },
        { id: 'sys_2', name: 'C', x: 90, y: 10, status: 'unknown' as const, edges: [] },
      ],
    };
    const state: GameState = {
      ...makeStarMapState(),
      screen: 'STAR_MAP',
      starMap: { ...disconnectedMap, plannedRoute: ['sys_1'] },
    };
    const result = engineReducer(state, { type: 'STAR_MAP_GO' }, TIME, 'seed');
    expect(result.lastError).not.toBeNull();
    expect(result.screen).toBe('STAR_MAP');
  });

  it('STAR_MAP_ZOOM_IN increases zoom level', () => {
    const state: GameState = { ...makeStarMapState(), starMap: { ...chainStarMap } };
    const result = engineReducer(state, { type: 'STAR_MAP_ZOOM_IN' }, TIME, 'seed');
    expect(result.starMap!.zoomLevel).toBeCloseTo(1.3);
  });

  it('STAR_MAP_ZOOM_OUT decreases zoom level', () => {
    const state: GameState = { ...makeStarMapState(), starMap: { ...chainStarMap } };
    const result = engineReducer(state, { type: 'STAR_MAP_ZOOM_OUT' }, TIME, 'seed');
    expect(result.starMap!.zoomLevel).toBeCloseTo(0.7);
  });
});

describe('onboarding flow dispatch', () => {
  const TIME = 2_000_000;
  const gate = (remaining: number, startedAt: number) => ({
    screen: 'SPACE_TRAVEL' as const,
    targetSeconds: 30,
    remainingSeconds: remaining,
    startedAt,
  });

  const flowState: GameState = {
    lastTimestamp: 1_000_000,
    elapsedSeconds: 0,
    totalElapsedGameTime: 0,
    totalDistanceKm: 0,
    rngSeed: 'test-seed',
    version: '0.1.0',
    screen: 'WELCOME',
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

  it('NAVIGATE WELCOME -> SPACE_TRAVEL starts a 30s gate and seeds lastTimestamp', () => {
    const r = engineReducer(flowState, { type: 'NAVIGATE', to: 'SPACE_TRAVEL' }, TIME, 'test-seed');
    expect(r.screen).toBe('SPACE_TRAVEL');
    expect(r.idleTimer?.remainingSeconds).toBe(30);
    expect(r.lastTimestamp).toBe(TIME);
    expect(r.lastError).toBeNull();
  });

  it('IDLE_PROGRESSION advances the gate; COMPLETE_ACTION fires when it expires', () => {
    let s = engineReducer(flowState, { type: 'NAVIGATE', to: 'SPACE_TRAVEL' }, TIME, 'test-seed');
    expect(s.idleTimer?.remainingSeconds).toBe(30);
    // tick 25s -> 5s left
    s = engineReducer(s, { type: 'IDLE_PROGRESSION' }, TIME + 25_000, 'test-seed');
    expect(s.idleTimer?.remainingSeconds).toBe(5);
    expect(s.idleTimer?.startedAt).toBe(TIME + 25_000);
    // tick 5s more -> expired
    s = engineReducer(s, { type: 'IDLE_PROGRESSION' }, TIME + 30_000, 'test-seed');
    expect(s.idleTimer?.remainingSeconds).toBe(0);
    s = engineReducer(s, { type: 'COMPLETE_ACTION' }, TIME + 30_000, 'test-seed');
    expect(s.screen).toBe('PLANET');
    expect(s.idleTimer).toBeNull();
  });

  it('HURRY shaves 1s off the active gate', () => {
    const s = { ...flowState, screen: 'SPACE_TRAVEL', idleTimer: gate(10, TIME) };
    expect(engineReducer(s, { type: 'HURRY' }, TIME, 'test-seed').idleTimer?.remainingSeconds).toBe(
      9,
    );
  });

  it('illegal NAVIGATE is rejected and sets lastError', () => {
    const s = { ...flowState, screen: 'SPACE_TRAVEL', idleTimer: gate(5, TIME) };
    const r = engineReducer(s, { type: 'NAVIGATE', to: 'LANDING' }, TIME, 'test-seed');
    expect(r.lastError).toContain('Illegal navigation');
    expect(r.screen).toBe('SPACE_TRAVEL');
  });

  it('ORE_SELECTED Rare starts a 60s gate; COMPLETE awards rareOre', () => {
    const mining = { ...flowState, screen: 'MINING', idleTimer: null };
    let s = engineReducer(mining, { type: 'ORE_SELECTED', ore: 'rareOre' }, TIME, 'test-seed');
    expect(s.selectedOre).toBe('rareOre');
    expect(s.idleTimer?.targetSeconds).toBe(60);
    expect(s.idleTimer?.remainingSeconds).toBe(60);
    // jump to expiry, then complete
    s = { ...s, idleTimer: { ...s.idleTimer!, remainingSeconds: 0 } };
    s = engineReducer(s, { type: 'COMPLETE_ACTION' }, TIME, 'test-seed');
    expect(s.screen).toBe('PLANET');
    expect(s.oreCounts).toEqual({ commonOre: 0, rareOre: 1 });
  });
});
