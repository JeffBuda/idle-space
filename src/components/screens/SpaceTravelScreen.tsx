// src/components/screens/SpaceTravelScreen.tsx
//
// Idle-gate view for interstellar travel. Receives the presentation-only
// `gate` view from useGameState (no time-to-distance math in React) and renders
// a progress bar + a "Faster!" tap (HURRY) while the gate is active, swapping to
// a "Complete" action when the gate has expired.
import type { IdleGateStatus } from '../../types/game-state';

interface SpaceTravelScreenProps {
  gate: IdleGateStatus | null;
  onHurry: () => void;
  onComplete: () => void;
}

export const SpaceTravelScreen = ({ gate, onHurry, onComplete }: SpaceTravelScreenProps) => {
  const target = gate?.targetSeconds ?? 0;
  const remaining = gate ? Math.round(gate.remainingSeconds) : 0;
  return (
    <section className="flow-screen" data-testid="space-travel-screen">
      <h2 data-testid="space-travel-title">Approaching Planet</h2>
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
              className="primary-btn"
              data-testid="complete-action-btn"
              onClick={onComplete}
            >
              Landed! Tap to continue
            </button>
          ) : (
            <button type="button" data-testid="hurry-btn" onClick={onHurry}>
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
