// src/useIOSInstallPrompt.ts
//
// React hook that detects whether the iOS "Add to Home Screen" install
// banner should be shown.  iOS Safari does not support the standard
// `beforeinstallprompt` event, so we must prompt the user manually.
//
// Showing the banner is critical: installing the PWA to the Home Screen
// bypasses iOS Safari's 7-day Intelligent Tracking Prevention (ITP)
// local-storage wipe, ensuring the player's game state persists.
import { useState, useEffect } from 'react';

/**
 * sessionStorage key that records whether the user has dismissed the
 * iOS install banner during the current browser session.
 *
 * `sessionStorage` (not `localStorage`) is intentionally used so that a
 * dismissed banner re-appears on the user's next visit — important for
 * a message about save-game persistence that the user should not
 * permanently suppress.
 */
export const IOS_INSTALL_PROMPT_DISMISSED_KEY = 'iosInstallPromptDismissed';

/**
 * Returns `true` when the supplied user-agent string belongs to an iOS
 * device — iPhone, iPad, or iPod touch.
 *
 * The check is case-insensitive because some desktop browsers spoof
 * parts of the iOS user-agent string.
 */
export const isIOSUserAgent = (userAgent: string): boolean => {
  const ua = userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
};

/**
 * Returns `true` when the PWA is running in standalone mode.
 *
 * Two detection strategies are used:
 *
 * 1. **Legacy — `navigator.standalone`** (iOS Safari only).
 *    This boolean is `true` when the page was launched from the Home
 *    Screen rather than through the Safari browser chrome.
 *
 * 2. **Modern — `display-mode: standalone` CSS media query**.
 *    Supported by all modern browsers that implement the CSS
 *    Window Controls spec.
 *
 * If either check is positive the user has already installed the PWA,
 * so the banner must not appear.
 */
export const isStandaloneMode = (): boolean => {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  const isLegacyStandalone =
    'standalone' in window.navigator && navigatorWithStandalone.standalone === true;
  const isModernStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return isLegacyStandalone || isModernStandalone;
};

/**
 * Returns `true` when the user has dismissed the install banner during
 * the current browser session.
 */
export const hasPromptBeenDismissed = (): boolean =>
  sessionStorage.getItem(IOS_INSTALL_PROMPT_DISMISSED_KEY) === 'true';

export interface IOSInstallPromptResult {
  /** Whether the install banner should be visible right now. */
  showPrompt: boolean;
  /** Whether the current device is an iOS device. */
  isIOS: boolean;
  /** Whether the app is running in standalone PWA mode. */
  isStandalone: boolean;
  /** Call to dismiss the banner for the remainder of this session. */
  handleDismiss: () => void;
}

/**
 * `useIOSInstallPrompt`
 *
 * Detects whether the iOS "Add to Home Screen" install banner should be
 * displayed.  The banner is shown when **all** of the following are true:
 *
 * 1. The user is on an iOS device (iPhone, iPad, or iPod).
 * 2. The app is **not** running in standalone PWA mode.
 * 3. The user has not dismissed the banner during this session.
 *
 * @returns An object containing `showPrompt`, `isIOS`, `isStandalone`,
 *   and `handleDismiss`.
 */
export const useIOSInstallPrompt = (): IOSInstallPromptResult => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ios = isIOSUserAgent(window.navigator.userAgent);
    const standalone = isStandaloneMode();
    const dismissed = hasPromptBeenDismissed();

    setIsIOS(ios);
    setIsStandalone(standalone);

    if (ios && !standalone && !dismissed) {
      setShowPrompt(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(IOS_INSTALL_PROMPT_DISMISSED_KEY, 'true');
    setShowPrompt(false);
  };

  return { showPrompt, isIOS, isStandalone, handleDismiss };
};
