// src/components/MiningRewardModal.tsx
//
// Welcome-back modal shown when the player resumes the app while the automated
// mining loop was running in the background. It mirrors the centered-modal
// pattern documented in docs/components.md ("Modal / Overlay") and the welcoming
// tone of OfflineGreeting, surfacing how long the player was away and how much
// ore the idle mining loop collected while they were idle.
import type { IdleRewardSummary } from '../types/game-state';
import { formatElapsedTime } from '../utils/time';
import './MiningRewardModal.css';

export interface MiningRewardModalProps {
  reward: IdleRewardSummary | null;
  onDismiss: () => void;
}

export const MiningRewardModal = ({ reward, onDismiss }: MiningRewardModalProps) => {
  if (!reward) return null;

  const { secondsAway, oreCollected } = reward;
  const formattedTime = formatElapsedTime(secondsAway);

  return (
    <div className="mining-reward-overlay" data-testid="mining-reward-modal" onClick={onDismiss}>
      <div className="mining-reward-content" onClick={(e) => e.stopPropagation()}>
        <header className="mining-reward-header">
          <h3 data-testid="mining-reward-title">Welcome Back, Explorer!</h3>
          <button
            type="button"
            className="mining-reward-close"
            data-testid="mining-reward-close"
            aria-label="Close"
            onClick={onDismiss}
          >
            ✕
          </button>
        </header>
        <div className="mining-reward-body" data-testid="mining-reward-body">
          <p className="mining-reward__message">You've been away for:</p>
          <div className="mining-reward__time" data-testid="mining-reward-time">
            {formattedTime}
          </div>
          <p className="mining-reward__subtext">
            Your automated mining operation kept working in your absence.
          </p>
          <div className="mining-reward__summary">
            <p data-testid="mining-reward-common">Common Ore: +{oreCollected.commonOre}</p>
            <p data-testid="mining-reward-rare">Rare Ore: +{oreCollected.rareOre}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="dismiss-mining-reward-btn"
          onClick={onDismiss}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default MiningRewardModal;
