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

export type Screen = 'WELCOME' | 'SPACE_TRAVEL' | 'PLANET' | 'LANDING' | 'MINING';

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
}

/** Discriminated union of all engine actions, shared by engine + hooks + tests. */
export type GameAction =
  | { type: 'IDLE_PROGRESSION' }
  | { type: 'APP_WAKE' }
  | { type: 'APP_SUSPEND' }
  | { type: 'NAVIGATE'; to: Screen }
  | { type: 'HURRY'; bySeconds?: number }
  | { type: 'COMPLETE_ACTION' }
  | { type: 'ORE_SELECTED'; ore: OreType };

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
