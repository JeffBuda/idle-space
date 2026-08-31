// src/components/screens/LandingScreen.tsx
//
// Idle-gate view for atmospheric entry. Shares the gate-bar contract with the
// other flow screens: "Faster!" while a gate is counting down, "Complete" once
// it has expired.
import type { IdleGateStatus } from '../../types/game-state';

interface LandingScreenProps {
  gate: IdleGateStatus | null;
  onHurry: () => void;
  onComplete: () => void;
}

export const LandingScreen = ({ gate, onHurry, onComplete }: LandingScreenProps) => {
  const target = gate?.targetSeconds ?? 0;
  const remaining = gate ? Math.round(gate.remainingSeconds) : 0;
  return (
    <section className="flow-screen" data-testid="landing-screen">
      <h2 data-testid="landing-title">Entering Atmosphere</h2>
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
              Touchdown! Continue to Mining
            </button>
          ) : (
            <button type="button" data-testid="hurry-btn" onClick={onHurry}>
              Faster!
            </button>
          )}
        </>
      ) : (
        <p>Brace for landing…</p>
      )}
    </section>
  );
};
