// src/engine/flow.ts — pure onboarding-flow state machine (docs/onboarding-flow.md §2).
// Side-effect-free: no Date/window/DOM/IDB; time is passed in explicitly for
// deterministic testability. Each handler returns a NEW state (spread, never
// mutates) and records a human-readable `lastError` on rejected transitions.
// Illegal transitions are surfaced as VALIDATION_ERROR logs by logger.ts.
import { type GameState, type GameAction, type Screen, type IdleTimer } from '../types/game-state';
import { generateStarMap } from './starmap';

/** Seconds a gate target should take for a given screen + chosen ore. */
const gateTarget = (state: GameState, screen: Screen): number => {
  if (screen === 'SPACE_TRAVEL' || screen === 'LANDING') {
    return state.constants.defaultActionTimeSeconds;
  }
  if (screen === 'MINING') {
    return state.selectedOre === 'rareOre'
      ? state.constants.defaultActionTimeSeconds * state.constants.rareOreTimeMultiplier
      : state.constants.defaultActionTimeSeconds;
  }
  return 0; // WELCOME / PLANET have no gate
};

/** Build a fresh IdleTimer for a screen at a given instant. */
const makeTimer = (state: GameState, screen: Screen, currentTime: number): IdleTimer => {
  const target = gateTarget(state, screen);
  return { screen, targetSeconds: target, remainingSeconds: target, startedAt: currentTime };
};

/**
 * Build a fresh IdleTimer with a custom target (used for star map route
 * confirmation, where the gate time is derived from the route length rather
 * than the fixed game constants).
 */
export const makeTimerWithTarget = (
  _state: GameState,
  screen: Screen,
  target: number,
  currentTime: number,
): IdleTimer => ({
  screen,
  targetSeconds: target,
  remainingSeconds: target,
  startedAt: currentTime,
});

/** Begin (or re-begin) a gate for `screen`, resetting its countdown to the target. */
const startGate = (state: GameState, screen: Screen, currentTime: number): GameState => ({
  ...state,
  screen,
  idleTimer: makeTimer(state, screen, currentTime),
  lastError: null,
});

/**
 * Enter the STAR_MAP screen — lazily generating the star map graph by rngSeed
 * if this is the player's first visit, or preserving the existing graph on
 * return visits. Accessible from both WELCOME and PLANET (per Q8 decision).
 */
const enterStarMap = (state: GameState): GameState => {
  if (state.starMap === null) {
    const starMap = generateStarMap(state.rngSeed, state.currentLocation);
    return { ...state, screen: 'STAR_MAP', starMap, lastError: null };
  }
  return { ...state, screen: 'STAR_MAP', lastError: null };
};

export const navigate = (
  state: GameState,
  action: Extract<GameAction, { type: 'NAVIGATE' }>,
  currentTime: number,
): GameState => {
  const { to } = action;
  switch (state.screen) {
    case 'WELCOME':
      if (to === 'SPACE_TRAVEL') {
        // Launch!: seed the idle baseline to "now" so the first tick measures
        // from real start-of-play, not the stale fresh-save timestamp.
        return {
          ...state,
          screen: 'SPACE_TRAVEL',
          lastTimestamp: currentTime,
          idleTimer: makeTimer(state, 'SPACE_TRAVEL', currentTime),
          lastError: null,
        };
      }
      if (to === 'STAR_MAP') {
        return enterStarMap(state);
      }
      break;
    case 'PLANET':
      if (to === 'LANDING') return startGate(state, 'LANDING', currentTime);
      if (to === 'SPACE_TRAVEL') return startGate(state, 'SPACE_TRAVEL', currentTime);
      if (to === 'STAR_MAP') {
        return enterStarMap(state);
      }
      break;
    case 'STAR_MAP':
      if (to === 'PLANET') {
        return { ...state, screen: 'PLANET', starMap: null, lastError: null };
      }
      break;
    case 'MINING':
      if (to === 'PLANET') {
        // Launch! — abort immediately, no ore awarded.
        return { ...state, screen: 'PLANET', idleTimer: null, selectedOre: null, lastError: null };
      }
      break;
    default:
      break;
  }
  return { ...state, lastError: `Illegal navigation from ${state.screen} to ${to}` };
};

export const hurry = (state: GameState, bySeconds: number = 1): GameState => {
  const timer = state.idleTimer;
  if (!timer || timer.screen !== state.screen) {
    return { ...state, lastError: `Cannot hurry on ${state.screen}: no active gate` };
  }
  const remaining = Math.max(0, timer.remainingSeconds - bySeconds);
  return { ...state, idleTimer: { ...timer, remainingSeconds: remaining }, lastError: null };
};

export const selectOre = (
  state: GameState,
  action: Extract<GameAction, { type: 'ORE_SELECTED' }>,
  currentTime: number,
): GameState => {
  if (state.screen !== 'MINING') {
    return { ...state, lastError: `Cannot select ore on ${state.screen}` };
  }
  const isRare = action.ore === 'rareOre';
  const target = isRare
    ? state.constants.defaultActionTimeSeconds * state.constants.rareOreTimeMultiplier
    : state.constants.defaultActionTimeSeconds;
  return {
    ...state,
    screen: 'MINING',
    selectedOre: action.ore,
    idleTimer: {
      screen: 'MINING',
      targetSeconds: target,
      remainingSeconds: target,
      startedAt: currentTime,
    },
    lastError: null,
  };
};

export const completeAction = (state: GameState): GameState => {
  const timer = state.idleTimer;
  if (!timer || timer.screen !== state.screen || timer.remainingSeconds > 0) {
    return { ...state, lastError: `Cannot complete on ${state.screen}: gate not expired` };
  }
  switch (state.screen) {
    case 'SPACE_TRAVEL':
      return { ...state, screen: 'PLANET', idleTimer: null, lastError: null };
    case 'LANDING':
      return { ...state, screen: 'MINING', idleTimer: null, selectedOre: null, lastError: null };
    case 'MINING': {
      const ore = state.selectedOre;
      if (!ore) return { ...state, lastError: 'Cannot mine: no ore selected' };
      return {
        ...state,
        screen: 'PLANET',
        idleTimer: null,
        selectedOre: null,
        oreCounts: { ...state.oreCounts, [ore]: state.oreCounts[ore] + 1 },
        lastError: null,
      };
    }
    default:
      return { ...state, lastError: `No completion defined for ${state.screen}` };
  }
};

/**
 * Routes flow-only actions. `IDLE_PROGRESSION` / `APP_WAKE` / `APP_SUSPEND`
 * are time-domain actions handled by src/engine/time.ts inside engineReducer;
 * this dispatcher never sees them (it only warns if it does).
 */
export const processFlowAction = (
  state: GameState,
  action: GameAction,
  currentTime: number,
): GameState => {
  switch (action.type) {
    case 'NAVIGATE':
      return navigate(state, action, currentTime);
    case 'HURRY':
      return hurry(state, action.bySeconds ?? 1);
    case 'COMPLETE_ACTION':
      return completeAction(state);
    case 'ORE_SELECTED':
      return selectOre(state, action, currentTime);
    default:
      return { ...state, lastError: `Unhandled flow action: ${action.type}` };
  }
};
