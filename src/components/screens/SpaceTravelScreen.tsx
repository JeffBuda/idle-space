// src/components/screens/SpaceTravelScreen.tsx
//
// Idle-gate view for interstellar travel. Receives the presentation-only
// `gate` view from useGameState (no time-to-distance math in React) and renders
// a progress bar + a "Faster!" tap (HURRY) while the gate is active, swapping to
// a "Complete" action when the gate has expired.
import type { GameState } from '../../types/game-state';
import type { IdleGateStatus } from '../../types/game-state';
import { getNodeName } from '../../utils/star-map';

interface SpaceTravelScreenProps {
  gameState: GameState | null;
  gate: IdleGateStatus | null;
  onHurry: () => void;
  onComplete: () => void;
}

export const SpaceTravelScreen = ({
  gameState,
  gate,
  onHurry,
  onComplete,
}: SpaceTravelScreenProps) => {
  const target = gate?.targetSeconds ?? 0;
  const remaining = gate ? Math.round(gate.remainingSeconds) : 0;
  // R7: show the destination planet name in the title.
  const planetName = getNodeName(gameState?.starMap?.nodes ?? null, gameState?.currentLocation);
  return (
    <section className="flow-screen" data-testid="space-travel-screen">
      <h2 data-testid="space-travel-title">Approaching {planetName}</h2>
      {gate?.active ? (
        <>
          <div className="gate-bar" data-testid="gate-bar">
            <div
              className="gate-fill"
              style={{ width: `${gate.progressPercent}%` }}
              data-testid="gate-fill"
            />
          </div>
          <p data-testid="gate-remaining">
            {remaining}s / {target}s
          </p>
          {gate.expired ? (
            <button
              type="button"
              className="btn btn--primary"
              data-testid="complete-action-btn"
              onClick={onComplete}
            >
              Landed! Tap to continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              data-testid="hurry-btn"
              onClick={onHurry}
            >
              Faster!
            </button>
          )}
        </>
      ) : (
        <p>Navigating the void…</p>
      )}
    </section>
  );
};
