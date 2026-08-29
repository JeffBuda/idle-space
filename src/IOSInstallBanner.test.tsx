// src/IOSInstallBanner.test.tsx
//
// Component tests for IOSInstallBanner — verifies rendering on iOS Safari,
// non-rendering on desktop browsers, non-rendering in standalone mode,
// dismissal behaviour, and presence of SVG icon + instructional text.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IOSInstallBanner } from './IOSInstallBanner';
import { IOS_INSTALL_PROMPT_DISMISSED_KEY } from './useIOSInstallPrompt';

// ── User-agent strings ────────────────────────────────────────────
const IOS_IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const IOS_IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SAFARI_MACOS_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// Factory that produces a fake MediaQueryList with controllable `matches`
const makeMatchMedia = (matches: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

// Factory that returns matches=true only for a specific media query
const makeConditionalMatchMedia = (targetQuery: string) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: query === targetQuery,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

describe('IOSInstallBanner', () => {
  const originalUserAgent = navigator.userAgent;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    originalMatchMedia = window.matchMedia;

    // Default: standard browser mode (display-mode: standalone = false)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: makeMatchMedia(false),
    });

    // Default: navigator.standalone is not set → browser mode
    Object.defineProperty(navigator, 'standalone', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  const setUserAgent = (ua: string) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua,
      configurable: true,
    });
  };

  // ───────────────────────────────────────────────────────────────
  // Task 3 — renders on iOS Safari in standard browser mode
  // ───────────────────────────────────────────────────────────────
  it('renders on iOS iPhone Safari in standard browser mode', async () => {
    setUserAgent(IOS_IPHONE_UA);
    render(<IOSInstallBanner />);
    expect(
      await screen.findByTestId('ios-install-banner')
    ).toBeInTheDocument();
  });

  it('renders on iOS iPad Safari in standard browser mode', async () => {
    setUserAgent(IOS_IPAD_UA);
    render(<IOSInstallBanner />);
    expect(
      await screen.findByTestId('ios-install-banner')
    ).toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────
  // Task 3 — does NOT render on non-iOS browsers
  // ───────────────────────────────────────────────────────────────
  it('does not render on Chrome (Windows)', async () => {
    setUserAgent(CHROME_WINDOWS_UA);
    render(<IOSInstallBanner />);
    await waitFor(() => {
      expect(
        screen.queryByTestId('ios-install-banner')
      ).not.toBeInTheDocument();
    });
  });

  it('does not render on Safari (macOS)', async () => {
    setUserAgent(SAFARI_MACOS_UA);
    render(<IOSInstallBanner />);
    await waitFor(() => {
      expect(
        screen.queryByTestId('ios-install-banner')
      ).not.toBeInTheDocument();
    });
  });

  it('does not render when running locally on Windows (same as Chrome)', async () => {
    setUserAgent(CHROME_WINDOWS_UA);
    render(<IOSInstallBanner />);
    await waitFor(() => {
      expect(
        screen.queryByTestId('ios-install-banner')
      ).not.toBeInTheDocument();
    });
  });
  // ───────────────────────────────────────────────────────────────
  // Task 3 — does NOT render in standalone PWA mode
  // ───────────────────────────────────────────────────────────────
  it('does not render in standalone PWA mode (display-mode: standalone)', async () => {
    setUserAgent(IOS_IPHONE_UA);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: makeConditionalMatchMedia('(display-mode: standalone)'),
    });

    render(<IOSInstallBanner />);

    await waitFor(() => {
      expect(
        screen.queryByTestId('ios-install-banner')
      ).not.toBeInTheDocument();
    });
  });

  it('does not render when navigator.standalone is true (legacy iOS)', async () => {
    setUserAgent(IOS_IPHONE_UA);
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      configurable: true,
      writable: true,
    });

    render(<IOSInstallBanner />);

    await waitFor(() => {
      expect(
        screen.queryByTestId('ios-install-banner')
      ).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Task 3 — dismissal sets sessionStorage and unmounts the component
  // ───────────────────────────────────────────────────────────────
  it('unmounts the banner and sets sessionStorage when the dismiss button is clicked', async () => {
    setUserAgent(IOS_IPHONE_UA);
    render(<IOSInstallBanner />);

    const dismissButton = await screen.findByRole('button', {
      name: 'Dismiss',
    });
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId('ios-install-banner')
      ).not.toBeInTheDocument();
    });

    expect(
      sessionStorage.getItem(IOS_INSTALL_PROMPT_DISMISSED_KEY)
    ).toBe('true');
  });

  it('does not render if the banner was previously dismissed in this session', async () => {
    setUserAgent(IOS_IPHONE_UA);
    sessionStorage.setItem(IOS_INSTALL_PROMPT_DISMISSED_KEY, 'true');
    render(<IOSInstallBanner />);

    await waitFor(() => {
      expect(
        screen.queryByTestId('ios-install-banner')
      ).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Task 2 — renders instructional text and SVG icon
  // ───────────────────────────────────────────────────────────────
  it('renders instructional text mentioning Share, Add to Home Screen, and save-game rationale', async () => {
    setUserAgent(IOS_IPHONE_UA);
    render(<IOSInstallBanner />);

    const banner = await screen.findByTestId('ios-install-banner');
    expect(banner).toBeInTheDocument();

    expect(screen.getByText(/Save Your Game/i)).toBeInTheDocument();
    expect(screen.getByText(/Share/i)).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
  });

  it('renders an inline SVG icon illustrating the iOS Share / Add flow', async () => {
    setUserAgent(IOS_IPHONE_UA);
    render(<IOSInstallBanner />);

    await waitFor(() => {
      const banner = screen.getByTestId('ios-install-banner');
      const svg = banner.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBeTruthy();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('exposes a dismiss button with proper accessibility attributes', async () => {
    setUserAgent(IOS_IPHONE_UA);
    render(<IOSInstallBanner />);

    const dismissButton = await screen.findByRole('button', {
      name: 'Dismiss',
    });
    expect(dismissButton).toHaveAttribute(
      'data-testid',
      'ios-install-dismiss'
    );
  });
});

