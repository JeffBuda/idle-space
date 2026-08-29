// src/useIOSInstallPrompt.test.ts
//
// Unit tests for the exported helper functions and the useIOSInstallPrompt hook.
// These cover Task 1 (the detection hook) independently of the UI component.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useIOSInstallPrompt,
  isIOSUserAgent,
  isStandaloneMode,
  hasPromptBeenDismissed,
  IOS_INSTALL_PROMPT_DISMISSED_KEY,
} from './useIOSInstallPrompt';

// Reusable fake matchMedia factory that returns a fixed `matches` value
// for every query.
const createMatchMediaMock = (matches: boolean) =>
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

// Reusable fake matchMedia factory that returns `true` only for a
// specific query string (useful for simulating display-mode: standalone).
const createConditionalMatchMediaMock = (targetQuery: string) =>
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

// ---------------------------------------------------------------------------
// isIOSUserAgent
// ---------------------------------------------------------------------------
describe('isIOSUserAgent', () => {
  it('returns true for iPhone', () => {
    expect(
      isIOSUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe(true);
  });

  it('returns true for iPad', () => {
    expect(
      isIOSUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe(true);
  });

  it('returns true for iPod', () => {
    expect(
      isIOSUserAgent('Mozilla/5.0 (iPod; CPU iPhone OS 17_0 like Mac OS X)')
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (IPHONE; CPU IPHONE OS 17_0)')).toBe(true);
  });

  it('returns false for Chrome on Windows', () => {
    expect(
      isIOSUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });

  it('returns false for Safari on macOS', () => {
    expect(
      isIOSUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      )
    ).toBe(false);
  });

  it('returns false for Android Chrome', () => {
    expect(
      isIOSUserAgent(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isStandaloneMode
// ---------------------------------------------------------------------------
describe('isStandaloneMode', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    Object.defineProperty(navigator, 'standalone', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('returns false when display-mode is not standalone and navigator.standalone is undefined', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });
    expect(isStandaloneMode()).toBe(false);
  });

  it('returns true when the display-mode: standalone media query matches', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createConditionalMatchMediaMock('(display-mode: standalone)'),
    });
    expect(isStandaloneMode()).toBe(true);
  });

  it('returns true when navigator.standalone is true (legacy iOS)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      configurable: true,
      writable: true,
    });
    expect(isStandaloneMode()).toBe(true);
  });

  it('returns false when navigator.standalone is false', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });
    Object.defineProperty(navigator, 'standalone', {
      value: false,
      configurable: true,
      writable: true,
    });
    expect(isStandaloneMode()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasPromptBeenDismissed
// ---------------------------------------------------------------------------
describe('hasPromptBeenDismissed', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns false when no dismissal key exists', () => {
    expect(hasPromptBeenDismissed()).toBe(false);
  });

  it('returns true when the dismissal key is set to "true"', () => {
    sessionStorage.setItem(IOS_INSTALL_PROMPT_DISMISSED_KEY, 'true');
    expect(hasPromptBeenDismissed()).toBe(true);
  });

  it('returns false when the dismissal key is set to "false"', () => {
    sessionStorage.setItem(IOS_INSTALL_PROMPT_DISMISSED_KEY, 'false');
    expect(hasPromptBeenDismissed()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useIOSInstallPrompt (hook via renderHook)
// ---------------------------------------------------------------------------
describe('useIOSInstallPrompt', () => {
  const originalUserAgent = navigator.userAgent;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    originalMatchMedia = window.matchMedia;

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

  it('returns showPrompt=true on iOS in browser mode', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });

    const { result } = renderHook(() => useIOSInstallPrompt());

    expect(result.current.showPrompt).toBe(true);
    expect(result.current.isIOS).toBe(true);
    expect(result.current.isStandalone).toBe(false);
  });

  it('returns showPrompt=false on non-iOS (Chrome Windows)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });

    const { result } = renderHook(() => useIOSInstallPrompt());

    expect(result.current.showPrompt).toBe(false);
    expect(result.current.isIOS).toBe(false);
  });

  it('returns showPrompt=false on non-iOS (Safari macOS)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });

    const { result } = renderHook(() => useIOSInstallPrompt());

    expect(result.current.showPrompt).toBe(false);
    expect(result.current.isIOS).toBe(false);
  });

  it('returns showPrompt=false when in standalone PWA mode', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createConditionalMatchMediaMock('(display-mode: standalone)'),
    });

    const { result } = renderHook(() => useIOSInstallPrompt());

    expect(result.current.showPrompt).toBe(false);
    expect(result.current.isStandalone).toBe(true);
  });

  it('returns showPrompt=false when previously dismissed in this session', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });
    sessionStorage.setItem(IOS_INSTALL_PROMPT_DISMISSED_KEY, 'true');

    const { result } = renderHook(() => useIOSInstallPrompt());

    expect(result.current.showPrompt).toBe(false);
  });

  it('handleDismiss sets sessionStorage and showPrompt becomes false', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(false),
    });

    const { result } = renderHook(() => useIOSInstallPrompt());

    // Banner should be visible initially
    expect(result.current.showPrompt).toBe(true);

    // Dismiss
    act(() => {
      result.current.handleDismiss();
    });

    // sessionStorage should be set
    expect(sessionStorage.getItem(IOS_INSTALL_PROMPT_DISMISSED_KEY)).toBe('true');
    // showPrompt should be false
    expect(result.current.showPrompt).toBe(false);
  });
});

