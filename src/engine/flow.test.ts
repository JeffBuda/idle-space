import { describe, it, expect } from 'vitest';
import { navigate, hurry, selectOre, completeAction, processFlowAction } from './flow';
import { type GameState, type Screen } from '../types/game-state';
import { generateStarMap, seedInitialRoute, confirmRoute } from '../engine/starmap';

const TIME = 2_000_000;
const newGate = (screen: Screen, remaining: number) => ({
  screen,
  targetSeconds: 30,
  remainingSeconds: remaining,
  startedAt: TIME,
});
// Pre-seed a star map + confirmed one-leg route so tests that navigate
// from WELCOME can use the routePath that the engine expects at launch.
const initStarMap = generateStarMap('s', null);
const initDest = seedInitialRoute(initStarMap, 's', null);
const initConfirm = confirmRoute(initStarMap, [initDest], null);

const base = (over: Partial<GameState> = {}): GameState => ({
  lastTimestamp: 1_000_000,
  elapsedSeconds: 500,
  totalElapsedGameTime: 500,
  rngSeed: 's',
  totalDistanceKm: 5_000,
  version: '0.1.0',
  screen: 'PLANET',
  idleTimer: null,
  oreCounts: { commonOre: 0, rareOre: 0 },
  selectedOre: null,
  constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
  lastError: null,
  starMap: initConfirm.starMap,
  routePath: initConfirm.routePath,
  routeTravelTimeSeconds: initConfirm.routeTravelTimeSeconds,
  currentLocation: null,
  ...over,
});

describe('onboarding flow state machine', () => {
  describe('legal navigation', () => {
    it('WELCOME -> SPACE_TRAVEL starts a gate to the first waypoint', () => {
      const n = navigate(
        base({ screen: 'WELCOME' }),
        { type: 'NAVIGATE', to: 'SPACE_TRAVEL' },
        TIME,
      );
      expect(n.screen).toBe('SPACE_TRAVEL');
      // R9/R4b: first launch from "deep space" (origin=null) to the seeded
      // first waypoint. Null-origin degenerate leg has 0 hops -> 10s floor.
      expect(n.idleTimer).toEqual({
        screen: 'SPACE_TRAVEL',
        targetSeconds: 10,
        remainingSeconds: 10,
        startedAt: TIME,
      });
      expect(n.lastTimestamp).toBe(TIME);
      expect(n.currentLocation).toBe(n.routePath[0]?.to);
    });
    it('PLANET -> LANDING starts a 30s gate', () => {
      const n = navigate(base(), { type: 'NAVIGATE', to: 'LANDING' }, TIME);
      expect(n.screen).toBe('LANDING');
      expect(n.idleTimer?.remainingSeconds).toBe(30);
    });
    it('MINING -> PLANET aborts (Launch!) with no ore awarded', () => {
      const s = base({
        screen: 'MINING',
        idleTimer: newGate('MINING', 10),
        selectedOre: 'commonOre',
        oreCounts: { commonOre: 2, rareOre: 1 },
      });
      const n = navigate(s, { type: 'NAVIGATE', to: 'PLANET' }, TIME);
      expect(n.screen).toBe('PLANET');
      expect(n.idleTimer).toBeNull();
      expect(n.selectedOre).toBeNull();
      expect(n.oreCounts).toEqual({ commonOre: 2, rareOre: 1 });
    });
  });
  describe('illegal navigation', () => {
    it('SPACE_TRAVEL -> LANDING is rejected without advancing', () => {
      const s = base({ screen: 'SPACE_TRAVEL', idleTimer: newGate('SPACE_TRAVEL', 5) });
      const n = navigate(s, { type: 'NAVIGATE', to: 'LANDING' }, TIME);
      expect(n.screen).toBe('SPACE_TRAVEL');
      expect(n.lastError).toContain('Illegal navigation');
      expect(n.idleTimer).toEqual(s.idleTimer);
    });
    it('WELCOME -> PLANET is rejected', () => {
      expect(
        navigate(base({ screen: 'WELCOME' }), { type: 'NAVIGATE', to: 'PLANET' }, TIME).lastError,
      ).toContain('Illegal navigation');
    });
  });
  describe('hurry', () => {
    const s = (rem: number) =>
      base({ screen: 'SPACE_TRAVEL', idleTimer: newGate('SPACE_TRAVEL', rem) });
    it('shaves 1s by default, a delta, and clamps at 0', () => {
      expect(hurry(s(10)).idleTimer?.remainingSeconds).toBe(9);
      expect(hurry(s(10), 5).idleTimer?.remainingSeconds).toBe(5);
      expect(hurry(s(3), 99).idleTimer?.remainingSeconds).toBe(0);
    });
    it('with no active gate records lastError, rest untouched', () => {
      const n = hurry(base({ screen: 'SPACE_TRAVEL' }));
      expect(n.lastError).toContain('no active gate');
      expect(n.screen).toBe('SPACE_TRAVEL');
      expect(n.idleTimer).toBeNull();
    });
  });
  describe('completeAction', () => {
    it('SPACE_TRAVEL -> PLANET when the gate expired', () => {
      const n = completeAction(
        base({ screen: 'SPACE_TRAVEL', idleTimer: newGate('SPACE_TRAVEL', 0) }),
      );
      expect(n.screen).toBe('PLANET');
      expect(n.idleTimer).toBeNull();
      expect(n.lastError).toBeNull();
    });
    it('rejects completion before expiry', () => {
      const n = completeAction(
        base({ screen: 'SPACE_TRAVEL', idleTimer: newGate('SPACE_TRAVEL', 5) }),
      );
      expect(n.lastError).toContain('not expired');
      expect(n.screen).toBe('SPACE_TRAVEL');
    });
    it('MINING awards 1 ore of the selected type', () => {
      expect(
        completeAction(
          base({
            screen: 'MINING',
            selectedOre: 'commonOre',
            idleTimer: newGate('MINING', 0),
            oreCounts: { commonOre: 4, rareOre: 1 },
          }),
        ).oreCounts,
      ).toEqual({ commonOre: 5, rareOre: 1 });
      expect(
        completeAction(
          base({
            screen: 'MINING',
            selectedOre: 'rareOre',
            idleTimer: newGate('MINING', 0),
            oreCounts: { commonOre: 2, rareOre: 0 },
          }),
        ).oreCounts,
      ).toEqual({ commonOre: 2, rareOre: 1 });
    });
    it('MINING with no ore records a lastError', () => {
      expect(
        completeAction(base({ screen: 'MINING', idleTimer: newGate('MINING', 0) })).lastError,
      ).toContain('no ore selected');
    });
  });
  describe('selectOre', () => {
    const m = () => base({ screen: 'MINING', idleTimer: null, selectedOre: null });
    it('Common starts 30s; Rare starts 60s', () => {
      expect(
        selectOre(m(), { type: 'ORE_SELECTED', ore: 'commonOre' }, TIME).idleTimer?.targetSeconds,
      ).toBe(30);
      expect(
        selectOre(m(), { type: 'ORE_SELECTED', ore: 'rareOre' }, TIME).idleTimer?.targetSeconds,
      ).toBe(60);
    });
    it('on PLANET is rejected', () => {
      expect(
        selectOre(base(), { type: 'ORE_SELECTED', ore: 'commonOre' }, TIME).lastError,
      ).toContain('Cannot select ore on PLANET');
    });
  });
  describe('immutability & dispatch', () => {
    it('hurry never mutates the input', () => {
      const s = base({ screen: 'SPACE_TRAVEL', idleTimer: newGate('SPACE_TRAVEL', 10) });
      const n = hurry(s);
      expect(n).not.toBe(s);
      expect(s.idleTimer?.remainingSeconds).toBe(10);
    });
    it('processFlowAction routes COMPLETE_ACTION and warns on IDLE_PROGRESSION', () => {
      expect(
        processFlowAction(
          base({ screen: 'SPACE_TRAVEL', idleTimer: newGate('SPACE_TRAVEL', 0) }),
          { type: 'COMPLETE_ACTION' },
          TIME,
        ).screen,
      ).toBe('PLANET');
      expect(processFlowAction(base(), { type: 'IDLE_PROGRESSION' }, TIME).lastError).toContain(
        'Unhandled flow action',
      );
    });
  });
});
