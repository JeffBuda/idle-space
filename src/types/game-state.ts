// src/types/game-state.ts
//
// Canonical, shared type definitions for game state and actions.
//
// Imported by engine/, db/, hooks/, and components/ (and their tests). This
// file is intentionally type-only and dependency-free, so it can be consumed
// by every architectural layer without crossing the boundary rules enforced by
// ESLint (boundaries) and tests/architecture.test.ts (archunit):
//   engine  -> {db, hooks, components, logging}  (FORBIDDEN)
//   components -> {engine, db}                   (FORBIDDEN)
// `src/types` is not in any forbidden set, so everyone may import from here.
//
// NOTE (known smell, kept intentionally): `elapsedSeconds` is retained for
// backward compatibility with the existing "Total Travel Time" display and the
// pwa-launch / game-state-interaction E2E assertions. `totalElapsedGameTime`
// is the onboarding lifetime counter; both advance together on the idle tick.
// The Welcome render gate is `screen === 'WELCOME'` (NOT the time field), to
// avoid a 1s tick-window where a fresh save would flicker past Welcome before
// the player taps Launch!. `totalElapsedGameTime` uses a `?? 0` default so
// legacy/persisted saves that predate the field (and the logger.test.ts
// baseState) migrate cleanly.
//
// NOTE: `lastError` is transient engine-only. `useGameState` strips it before
// any `saveGameState` call so it never lands in IndexedDB.

// --- Star Map constants ---
export const STAR_MAP_NODE_COUNT = 10;
export const STAR_MAP_MIN_EDGES = 1; /* minimum edges per node */
export const STAR_MAP_MAX_EDGES = 3; /* per requirement: 1-3 edges */
export const STAR_MAP_ZOOM_MIN = 0.4;
export const STAR_MAP_ZOOM_MAX = 3.0;
export const STAR_MAP_ZOOM_STEP = 0.3;

export type Screen = 'WELCOME' | 'STAR_MAP' | 'SPACE_TRAVEL' | 'PLANET' | 'LANDING' | 'MINING';

export interface IdleTimer {
  /** Which screen owns this gate (used to detect stale/gate-switch resets). */
  screen: Screen;
  /** Goal for this gate, in seconds (e.g. 30, or 60 for Rare Ore). */
  targetSeconds: number;
  /**
   * Seconds remaining. Stored (mutable) field — NOT purely derived:
   * - real elapsed wall-clock reduces it (via the timestamp tick / wake);
   * - `Faster!` taps decrement it by 1 per tap.
   * Persisting it is what lets backgrounded / iOS-hibernated phones keep the
   * countdown where they left off.
   */
  remainingSeconds: number;
  /** UNIX ms of the last computation point (gate start or last foreground tick). */
  startedAt: number;
}

export type OreType = 'commonOre' | 'rareOre';

export interface GameConstants {
  /** Base seconds for a fresh idle gate (default 30). Tests override to 1. */
  defaultActionTimeSeconds: number;
  /** Multiplier for Rare Ore gate vs Common (default 2 => 60s). */
  rareOreTimeMultiplier: number;
}

// --- Star Map types ---

export type NodeStatus = 'current' | 'visited' | 'unknown';

export interface StarMapNode {
  id: string;
  name: string;
  x: number; /* percentage 0-100 for SVG viewBox */
  y: number; /* percentage 0-100 for SVG viewBox */
  status: NodeStatus;
  edges: string[]; /* adjacency list: node IDs this node connects to */
}

export interface StarMapEdge {
  from: string;
  to: string;
}

export interface StarMapRouteSegment {
  from: string;
  to: string;
  path: string[]; /* ordered node IDs from->to */
  hops: number; /* path.length - 1 */
}

export interface StarMapState {
  nodes: StarMapNode[];
  edges: StarMapEdge[];
  plannedRoute: string[]; /* ordered destination node IDs */
  zoomLevel: number;
  // NOTE: `currentLocationId` was removed — the canonical player location now lives
  // solely on `GameState.currentLocation` (see R2). The star-map component derives
  // the "current" node marker from that field at render time.
}

/**
 * Result of confirmRoute(): bridges StarMapState (graph) with the route
 * metadata that lives on GameState (routePath, routeTravelTimeSeconds).
 * `error` is null on success, or a human-readable message on failure.
 */
export interface StarMapConfirmResult {
  starMap: StarMapState;
  routePath: StarMapRouteSegment[];
  routeTravelTimeSeconds: number;
  error: string | null;
}

export interface GameState {
  // --- existing fields (kept for compat) ---
  lastTimestamp: number;
  elapsedSeconds: number;
  rngSeed: string;
  totalDistanceKm: number;
  version: string;

  // --- onboarding-flow fields ---
  /** Total seconds of game life. 0 on a fresh save (see render gate in App). */
  totalElapsedGameTime: number;
  /** Current screen; the render gate for the onboarding flow. */
  screen: Screen;
  /** The single active idle gate, or null when no gate is running. */
  idleTimer: IdleTimer | null;
  /** Resource tallies awarded by mining completion. */
  oreCounts: { commonOre: number; rareOre: number };
  /** Currently selected ore on the Mining screen, or null. */
  selectedOre: OreType | null;
  /** Tunable, persisted constants (tests override defaultActionTimeSeconds). */
  constants: GameConstants;
  /**
   * Transient engine error text on a rejected action, `null` otherwise.
   * NOT persisted (stripped by `useGameState` before save).
   */
  lastError: string | null;
  /**
   * Star map graph + planned route state. Seeded at new-game initialization
   * (see R3) so it is non-null from the start; preserved across navigation
   * (the star-map X-close is a non-state screen change, R11). The null branch
   * in `enterStarMap` is retained only as an old-save migration path (R10).
   */
  starMap: StarMapState | null;
  /** Computed BFS route segments (from->to with hop-by-hop path). */
  routePath: StarMapRouteSegment[];
  /** Total gate time in seconds for the current route (set by STAR_MAP_GO). */
  routeTravelTimeSeconds: number;
  /**
   * The player's canonical current star system ID. `null` at new-game init
   * ("deep space" / pre-launch); set to the first waypoint (plannedRoute[0])
   * when the first route is confirmed (STAR_MAP_GO) or on first Launch! (R9).
   * This is the SINGLE source of truth for location — `StarMapState` no
   * longer holds its own copy. Planet-name lookups derive the title from this
   * field via starMap.nodes (see R7). Survives navigation away from star map.
   */
  currentLocation: string | null;
}

/** Discriminated union of all engine actions, shared by engine + hooks + tests. */
export type GameAction =
  | { type: 'IDLE_PROGRESSION' }
  | { type: 'APP_WAKE' }
  | { type: 'APP_SUSPEND' }
  | { type: 'NAVIGATE'; to: Screen }
  | { type: 'HURRY'; bySeconds?: number }
  | { type: 'COMPLETE_ACTION' }
  | { type: 'ORE_SELECTED'; ore: OreType }
  | { type: 'STAR_MAP_NODE_TOGGLE'; nodeId: string }
  | { type: 'STAR_MAP_REMOVE_STOP'; nodeId: string }
  | { type: 'STAR_MAP_CLEAR_ROUTE' }
  | { type: 'STAR_MAP_ZOOM_IN' }
  | { type: 'STAR_MAP_ZOOM_OUT' }
  | { type: 'STAR_MAP_GO' };

/**
 * Presentation-derived view of the active idle gate, computed by `useGameState`
 * from the persisted `idleTimer` so React components never perform game math.
 * `null` when no gate is running (Welcome / Planet hub).
 */
export interface IdleGateStatus {
  active: boolean;
  targetSeconds: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  expired: boolean;
  /** 0–100 visual progress for the gate bar. */
  progressPercent: number;
}

/**
 * Transient summary of an idle-resume reward, captured by `useGameState` on
 * `APP_WAKE` and surfaced to the MiningIdleReward modal. NOT persisted to
 * IndexedDB (like `lastError`, it is stripped before any save) — it is a
 * one-shot presentation value derived from the ore delta the auto-mining loop
 * awarded while the app was backgrounded.
 */
export interface IdleRewardSummary {
  /** Wall-clock seconds the player was away (idle) before this resume. */
  secondsAway: number;
  /** Ore auto-collected by the mining loop during the idle span. */
  oreCollected: { commonOre: number; rareOre: number };
}
