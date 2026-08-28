// src/engine/time.ts

export interface EngineState {
  lastProcessedTime: number;
  totalDistanceKm: number;
  seed: string;
}

export const calculateIdleDistance = (
  prevState: EngineState,
  currentTime: number,
  speedKmPerSec: number = 10
): EngineState => {
  const deltaSeconds = Math.max(0, (currentTime - prevState.lastProcessedTime) / 1000);
  return {
    ...prevState,
    lastProcessedTime: currentTime,
    totalDistanceKm: prevState.totalDistanceKm + deltaSeconds * speedKmPerSec,
  };
};
