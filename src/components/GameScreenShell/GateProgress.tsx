// src/components/GameScreenShell/GateProgress.tsx
//
// Visual gate countdown bar — used as the main content of
// SpaceTravel, Landing, and Mining screens.  Displays an animated
// progress fill + remaining time.  Purely presentational: the
// gate data is computed by the engine / useGameState hook and passed
// in as a prop (no game math in components).
import type { IdleGateStatus } from '../../types/game-state';
import './GateProgress.css';

export interface GateProgressProps {
  /** Gate status from useGameState (null when no gate is active) */
  gate: IdleGateStatus | null;
  /** Optional label shown above the bar, e.g. "Approach", "Landing" */
  label?: string;
}

/**
 * Renders a full-width progress bar with a time-remaining figure.
 * When the gate has expired the fill turns orange (warning) and the
 * time displays "Ready!".
 */
export function GateProgress({ gate, label }: GateProgressProps) {
  if (!gate) {
    return null;
  }

  const isExpired = gate.expired;
  const timeText = isExpired ? 'Ready!' : `${gate.remainingSeconds}s`;
  const timeVariant = isExpired ? 'gate-time--warn' : 'gate-time--normal';

  return (
    <div className="gate-progress" data-testid="gate-progress">
      {label && (
        <span className="gate-label" data-testid="gate-label">
          {label}
        </span>
      )}
      <div className="gate-bar" data-testid="gate-bar">
        <div
          className="gate-fill"
          data-testid="gate-fill"
          style={{ width: `${gate.progressPercent}%` }}
        />
      </div>
      <div className={`gate-time ${timeVariant}`} data-testid="gate-time">
        {timeText}
      </div>
    </div>
  );
}

export default GateProgress;
