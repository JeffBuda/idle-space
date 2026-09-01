// src/engine/mining.ts
//
// Pure, deterministic mining-loop logic. Unlike SPACE_TRAVEL / LANDING (where the
// player taps "Complete" once a gate expires), mining auto-resolves: every time
// the active MINING gate's remaining seconds reach zero the selected ore is
// awarded and a fresh gate is started from full, looping for as many whole cycles
// as the elapsed wall-clock time supports.
//
// This runs on BOTH:
//   - the 1-second foreground tick (IDLE_PROGRESSION), and
//   - the idle catch-up pass (APP_WAKE) — so ore accrues while the app is
//     backgrounded / iOS-hibernated, which is precisely what this feature needs.
//
// Constraints (mirrors src/engine/time.ts): no Date / window / DOM / IDB. The
// calling currentTime is passed in explicitly for repeatability. The function
// is idempotent over its own domain — it returns the *same* state reference
// when there is nothing to collapse (sub-second deltas, no ore selected, or a
// non-MINING screen), so callers can avoid needless re-renders.
import { type GameState } from '../types/game-state';

export type { GameState };

/**
 * Collapse the elapsed wall-clock time on a MINING gate into whole completed
 * ore cycles, awarding one unit of the selected ore per cycle and restarting
 * the gate with the correct leftover `remainingSeconds`.
 *
 * Cycle math (pure & closed-form, verified against a step-tracing model):
 *   - `remaining`  = seconds the current in-progress cycle had left at
 *     `timer.startedAt` (banked from the previous computation).
 *   - `delta`      = `floor((currentTime - startedAt) / 1000)` real seconds
 *     that elapsed since the last computation.
 *   - If `delta < remaining` the gate is still counting down — no ore yet.
 *   - Otherwise the current cycle completes (award 1); the leftover time
 *     `(delta - remaining)` spills into fresh full `target`-second cycles.
 *     If that leftover lands exactly on a boundary, the last cycle completed
 *     too, so a brand-new full cycle begins (`remaining = target`); otherwise
 *     the in-progress cycle keeps `target - (leftover mod target)` seconds.
 *
 * @param prevState    - Immutable game state (must be on the MINING screen).
 * @param currentTime  - UNIX ms to collapse idle time up to.
 * @returns A new GameState with cycles awarded + gate restarted, or the same ref.
 */
export const processMiningGate = (prevState: GameState, currentTime: number): GameState => {
  const timer = prevState.idleTimer;

  // Only auto-loop an in-progress MINING gate with a selected ore. Returning
  // the same reference lets callers (e.g. advanceIdleGate's siblings) skip work
  // and avoids spurious React re-renders on foreground ticks.
  if (
    !timer ||
    timer.screen !== 'MINING' ||
    prevState.screen !== 'MINING' ||
    !prevState.selectedOre
  ) {
    return prevState;
  }

  const deltaSeconds = Math.max(0, Math.floor((currentTime - timer.startedAt) / 1000));
  if (deltaSeconds <= 0) {
    return prevState; // sub-second deltas leave nothing to collapse
  }

  const target = timer.targetSeconds;
  if (target <= 0) {
    return prevState; // safety: a zero-target gate cannot collapse meaningfully
  }

  const remaining = timer.remainingSeconds;
  const oreType = prevState.selectedOre;

  let cycles: number;
  let newRemaining: number;

  if (deltaSeconds < remaining) {
    // Gate hasn't expired yet — just advance the countdown, no ore awarded.
    cycles = 0;
    newRemaining = remaining - deltaSeconds;
  } else {
    // The current cycle expires (delta >= remaining). The leftover time
    // (delta - remaining) spills into fresh full cycles of length `target`.
    const leftover = deltaSeconds - remaining;
    const fullCycles = Math.floor(leftover / target);
    cycles = 1 + fullCycles; // +1 for the current cycle that just expired
    const intoNext = leftover - fullCycles * target; // leftover mod target
    // Exactly on a boundary => the last started cycle also completed => begin a
    // fresh full cycle; otherwise the in-progress cycle has partial time left.
    newRemaining = intoNext === 0 ? target : target - intoNext;
  }

  const current = prevState.oreCounts[oreType];
  return {
    ...prevState,
    idleTimer: {
      ...timer,
      remainingSeconds: newRemaining,
      startedAt: currentTime,
    },
    oreCounts: { ...prevState.oreCounts, [oreType]: current + cycles },
    lastError: null,
  };
};
