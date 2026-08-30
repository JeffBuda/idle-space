// src/OfflineGreeting.tsx
//
// A modal that greets the user upon waking the app, displaying the
// exact offline time elapsed formatted in Days, Hours, Minutes, Seconds.
// Visible when the user was away for more than 60 seconds.
import React from 'react';
import { formatElapsedTime } from '../utils/time';
import './OfflineGreeting.css';

export interface OfflineGreetingProps {
  offlineSeconds: number | null;
  onDismiss: () => void;
  onCollectRewards: () => void;
}

export const OfflineGreeting: React.FC<OfflineGreetingProps> = ({
  offlineSeconds,
  onDismiss,
  onCollectRewards,
}) => {
  if (offlineSeconds === null) return null;

  const formattedTime = formatElapsedTime(offlineSeconds);

  return (
    <div className="offline-greeting-overlay" data-testid="offline-greeting">
      <div className="offline-greeting-modal">
        <div className="offline-greeting__content">
          <h2 className="offline-greeting__title">Welcome Back, Explorer!</h2>
          <p className="offline-greeting__message">You've been away for:</p>
          <div className="offline-greeting__time" data-testid="offline-time-display">
            {formattedTime}
          </div>
          <p className="offline-greeting__subtext">
            Your ship has continued its journey in your absence.
          </p>
        </div>
        <div className="offline-greeting__actions">
          <button
            type="button"
            onClick={onCollectRewards}
            className="btn btn--primary offline-greeting__collect-btn"
            data-testid="collect-rewards-btn"
          >
            Collect Rewards
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="btn btn--secondary offline-greeting__dismiss-btn"
            data-testid="dismiss-offline-btn"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineGreeting;
