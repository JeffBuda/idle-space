// src/IOSInstallBanner.tsx
//
// A fixed-position banner that instructs iOS Safari users to install the
// PWA to their Home Screen via the native Share sheet.  Visible only on
// iOS devices running in standard browser mode (not standalone).
import React from 'react';
import { useIOSInstallPrompt } from '../hooks/useIOSInstallPrompt';
import './IOSInstallBanner.css';

export const IOSInstallBanner: React.FC = () => {
  const { showPrompt, handleDismiss } = useIOSInstallPrompt();

  if (!showPrompt) return null;

  return (
    <div className="ios-install-banner" data-testid="ios-install-banner">
      <div className="ios-install-banner__inner">
        {/*
          Inline SVG: a simplified iPhone with a Share sheet sliding up
          from the bottom, containing an upward-arrow "Add to Home Screen"
          icon.  The same information is conveyed in text, so the SVG is
          marked aria-hidden for accessibility.
        */}
        <div className="ios-install-banner__icon" aria-hidden="true">
          <svg
            width="80"
            height="96"
            viewBox="0 0 80 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            {/* iPhone body */}
            <rect
              x="24"
              y="4"
              width="32"
              height="80"
              rx="10"
              fill="#2d3748"
              stroke="#4a5568"
              strokeWidth="1.5"
            />
            {/* iPhone screen (showing the browser) */}
            <rect x="26" y="6" width="28" height="76" rx="4" fill="#1a202c" />
            {/* Home indicator / gesture bar */}
            <rect x="33" y="78" width="14" height="2.5" rx="1.25" fill="#718096" />
            {/* iOS Share sheet (slides up from bottom of phone) */}
            <rect
              x="18"
              y="68"
              width="44"
              height="28"
              rx="12"
              fill="#2d3748"
              stroke="#4a5568"
              strokeWidth="1.5"
            />
            {/* Grabber handle at top of share sheet */}
            <rect x="30" y="70" width="20" height="2" rx="1" fill="#718096" />
            {/* "Add to Home Screen" icon: circle + upward arrow */}
            <circle cx="40" cy="81" r="7" fill="#4a5568" fillOpacity="0.3" />
            <path d="M40 75 L34 84 L37 84 L37 88 L43 88 L43 84 L46 84 Z" fill="#4ade80" />
          </svg>
        </div>

        <div className="ios-install-banner__text">
          <h3 className="ios-install-banner__title">Save Your Game!</h3>
          <p className="ios-install-banner__desc">
            To prevent your save from being wiped by iOS Safari, install this game. Tap{' '}
            <strong>Share</strong> and choose <strong>Add to Home Screen</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="ios-install-banner__dismiss"
          aria-label="Dismiss"
          data-testid="ios-install-dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default IOSInstallBanner;
