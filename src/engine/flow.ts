// src/engine/flow.ts — pure onboarding-flow state machine (docs/onboarding-flow.md §2).
// Side-effect-free: no Date/window/DOM/IDB; time is passed in explicitly for
// deterministic testability. Each handler returns a NEW state (spread, never
// mutates) and records a human-readable `lastError` on rejected transitions.
// Illegal transitions are surfaced as VALIDATION_ERROR logs by logger.ts.
import { type GameState, type GameAction, type Screen, type IdleTimer } from '../types/game-state';
import { generateStarMap, seedInitialRoute, confirmRoute, estimateTravelTime } from './starmap';

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
 * Enter the STAR_MAP screen. New games seed the star map at init (R3), so
 * `state.starMap` is non-null from the start and we just switch screens.
 * The null branch below is retained only for OLD saves (R10 migration) that
 * predate the seeded-star-map change — it (re)generates from rngSeed.
 *
 * Per R11 the star-map X-close is a non-state screen change returning to PLANET,
 * so `enterStarMap` is only called when the player explicitly opens the map
 * (from WELCOME Launch! fallback, from PLANET Chart Course, etc.).
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
        // R9 - Launch!: the star map + initial one-stop route were seeded at
        // new-game init (createInitialGameState -> seedInitialRoute). Set the
        // canonical location to the first waypoint and start the single-leg
        // Approaching gate (hops × 5s, floored at 10s; null origin -> 10s per
        // R4b). Inlined rather than calling setupNextTravelLeg because first
        // launch is guaranteed to have a non-empty plannedRoute.
        const starMap = state.starMap;
        if (!starMap || starMap.plannedRoute.length === 0) {
          return { ...state, lastError: 'No route seeded for launch', screen: 'STAR_MAP' };
        }
        const origin = state.currentLocation; // null at first launch (R3)
        const confirm = confirmRoute(starMap, origin);
        if (confirm.error) return { ...state, lastError: confirm.error, screen: 'STAR_MAP' };
        const leg = confirm.routePath[0]!;
        const legTravelSeconds = estimateTravelTime([leg]); // R4/R4b
        const nextWaypoint = starMap.plannedRoute[0]!;
        return {
          ...state,
          screen: 'SPACE_TRAVEL',
          starMap: confirm.starMap,
          currentLocation: nextWaypoint, // R5: target = plannedRoute[0]
          routePath: confirm.routePath,
          routeTravelTimeSeconds: legTravelSeconds,
          lastTimestamp: currentTime,
          idleTimer: makeTimerWithTarget(state, 'SPACE_TRAVEL', legTravelSeconds, currentTime),
          lastError: null,
        };
      }
      if (to === 'STAR_MAP') {
        return enterStarMap(state);
      }
      break;
    case 'PLANET':
      if (to === 'LANDING') return startGate(state, 'LANDING', currentTime);
      if (to === 'SPACE_TRAVEL') {
        // R8 - Depart branching: if the route is exhausted/empty, open the star map
        // to (re)chart a course; otherwise continue along the in-progress route via
        // the shared single-leg logic (setupNextTravelLeg, see STAR_MAP_GO).
        const hasRoute = state.starMap?.plannedRoute?.length > 0;
        if (!hasRoute) {
          return { ...state, screen: 'STAR_MAP', lastError: null };
        }
        return setupNextTravelLeg(state, currentTime);
      }
      if (to === 'STAR_MAP') {
        return enterStarMap(state);
      }
      break;
    case 'STAR_MAP':
      if (to === 'PLANET') {
        // R11 - The star-map Back button is now a non-state X-close: return to
        // the Orbiting Planet screen WITHOUT mutating game state (do not null
        // starMap, so the graph + pending route are preserved). The star-map
        // component derives current/visited markers from GameState.currentLocation.
        return { ...state, screen: 'PLANET', lastError: null };
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

/**
 * Build the canonical GameState for a brand-new game (R3 + R12).
 *
 * Seeds the star map at init (not lazily) and plants a one-waypoint route to a
 * random planet P, so `currentLocation` is null ("deep space") until the player
 * launches, and the Approaching/Orbiting screens always resolve a real planet
 * name from starMap.nodes (see R7 - the name never fails once currentLocation
 * is set).
 *
 * Engine-owned & pure (no Date/DOM/IDB): the caller supplies `seed` and
 * `baseTimestamp`. The db layer cannot import engine, so this lives in the
 * engine and is invoked by the hooks layer (which bridges engine + db) when a
 * fresh save is created.
 */
export const createInitialGameState = (
  seed: string,
  baseTimestamp: number,
  defaultActionTimeSeconds: number = 30,
  rareOreTimeMultiplier: number = 2,
): GameState => {
  // `currentLocation` is null at init — "deep space", pre-launch (R3).
  const starMap = seedInitialRoute(generateStarMap(seed, null), seed, null);
  return {
    lastTimestamp: baseTimestamp,
    elapsedSeconds: 0,
    totalElapsedGameTime: 0,
    rngSeed: seed,
    totalDistanceKm: 0,
    version: '0.1.0',
    // Fresh save -> WELCOME render gate (see game-state.ts header note).
    screen: 'WELCOME',
    idleTimer: null,
    oreCounts: { commonOre: 0, rareOre: 0 },
    selectedOre: null,
    constants: { defaultActionTimeSeconds, rareOreTimeMultiplier },
    lastError: null,
    starMap,
    routePath: [],
    routeTravelTimeSeconds: 0,
    currentLocation: null,
  };
};

/**
 * Set up the NEXT route leg: confirm the route is valid (full-route check),
 * target plannedRoute[0] (R5), set currentLocation to that waypoint, and start
 * a single-leg Approaching gate sized by hops(origin -> next) * 5s, floored 10s (R4/R4b).
 *
 * Shared by STAR_MAP_GO (reducer) and the Planet departy branch (R8) so the
 * single-leg gate logic is defined once (DRY). Pure & engine-only.
 *
 * Returns a new GameState with screen=SPACE_TRAVEL + idleTimer set, OR a state
 * with lastError set + screen=STAR_MAP if the route is empty/invalid/unpathable.
 */
export const setupNextTravelLeg = (state: GameState, currentTime: number): GameState => {
  if (!state.starMap)
    return { ...state, lastError: 'Star map not initialized', screen: 'STAR_MAP' };
  if (state.starMap.plannedRoute.length === 0) {
    return { ...state, lastError: 'No route planned', screen: 'STAR_MAP' };
  }
  const origin = state.currentLocation; // R2 canonical location
  const result = confirmRoute(state.starMap, origin);
  if (result.error) return { ...state, lastError: result.error, screen: 'STAR_MAP' };
  if (!result.routePath || result.routePath.length === 0) {
    return { ...state, lastError: 'Route has no pathable segments', screen: 'STAR_MAP' };
  }
  const leg = result.routePath[0]!; // R5: next waypoint only
  const legTravelSeconds = estimateTravelTime([leg]); // R4/R4b
  const nextWaypoint = state.starMap.plannedRoute[0]!; // target = plannedRoute[0]
  return {
    ...state,
    starMap: result.starMap,
    currentLocation: nextWaypoint,
    routePath: result.routePath,
    routeTravelTimeSeconds: legTravelSeconds,
    screen: 'SPACE_TRAVEL',
    idleTimer: makeTimerWithTarget(state, 'SPACE_TRAVEL', legTravelSeconds, currentTime),
    lastError: null,
  };
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
    case 'SPACE_TRAVEL': {
      // R6: arriving at the planet. Pop the visited waypoint from plannedRoute
      // (immutably via slice(1)). currentLocation is already the destination
      // (set to plannedRoute[0] by STAR_MAP_GO); keep it here defensively.
      const starMap = state.starMap;
      const poppedRoute = starMap?.plannedRoute?.length ? starMap.plannedRoute.slice(1) : [];
      const updatedStarMap = starMap ? { ...starMap, plannedRoute: poppedRoute } : starMap;
      return {
        ...state,
        screen: 'PLANET',
        starMap: updatedStarMap,
        currentLocation: state.currentLocation,
        idleTimer: null,
        lastError: null,
      };
    }
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
