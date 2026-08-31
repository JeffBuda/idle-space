// src/engine/time.ts
//
// Pure time-domain engine: idle progression (distance / elapsed time) and the
// active idle-gate countdown. Imports the canonical GameState from
// src/types/game-state.ts (engine -> types is an allowed dependency).
// No Date / window / DOM — all time values are passed in explicitly.
import { type GameState } from '../types/game-state';

export type { GameState };

export interface EngineState {
  lastProcessedTime: number;
  totalDistanceKm: number;
  seed: string;
}

export const calculateIdleDistance = (
  prevState: EngineState,
  currentTime: number,
  speedKmPerSec: number = 10,
): EngineState => {
  const deltaSeconds = Math.max(0, (currentTime - prevState.lastProcessedTime) / 1000);
  return {
    ...prevState,
    lastProcessedTime: currentTime,
    totalDistanceKm: prevState.totalDistanceKm + deltaSeconds * speedKmPerSec,
  };
};

/**
 * Pure function that processes all idle progression in a single deterministic pass.
 * Calculates elapsed time since the last interaction and updates the game state accordingly.
 *
 * @param prevState - The previous game state
 * @param currentTime - The current UNIX timestamp (from Date.now())
 * @param speedKmPerSec - Speed in km/s for distance calculation (default: 10)
 * @returns A new GameState with updated values
 */
export const processIdleProgression = (
  prevState: GameState,
  currentTime: number,
  speedKmPerSec: number = 10,
): GameState => {
  const deltaSeconds = Math.max(0, Math.floor((currentTime - prevState.lastTimestamp) / 1000));

  // Calculate idle distance traveled
  const distanceTraveled = deltaSeconds * speedKmPerSec;

  return {
    ...prevState,
    lastTimestamp: currentTime,
    elapsedSeconds: prevState.elapsedSeconds + deltaSeconds,
    totalDistanceKm: prevState.totalDistanceKm + distanceTraveled,
    // `?? 0` keeps legacy/partial (pre-onboarding) saves migratable.
    totalElapsedGameTime: (prevState.totalElapsedGameTime ?? 0) + deltaSeconds,
  };
};

/**
 * Catch up the active idle gate countdown for time elapsed since `startedAt`
 * (including while the app was backgrounded). Applies the leftover delta in one
 * chunk on wake so a gate completes even when the app slept — no double-count
 * vs. the 1s foreground ticks (startedAt advances on each tick). Pure: returns
 * a new state, or the same ref when no gate is active.
 */
export const advanceIdleGate = (prevState: GameState, currentTime: number): GameState => {
  const timer = prevState.idleTimer;
  if (!timer || timer.screen !== prevState.screen) {
    return prevState;
  }
  const deltaSeconds = Math.max(0, Math.floor((currentTime - timer.startedAt) / 1000));
  if (deltaSeconds <= 0) {
    return prevState;
  }
  const remaining = Math.max(0, timer.remainingSeconds - deltaSeconds);
  return {
    ...prevState,
    idleTimer: { ...timer, remainingSeconds: remaining, startedAt: currentTime },
  };
};
