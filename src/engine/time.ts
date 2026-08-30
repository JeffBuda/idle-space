// src/engine/time.ts

export interface GameState {
  lastTimestamp: number;
  elapsedSeconds: number;
  rngSeed: string;
  totalDistanceKm: number;
  version: string;
}

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
  };
};
