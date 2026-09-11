// src/components/ui/GameThemeProvider.tsx
//
// Game-wide theme provider — exposes visual tokens as CSS custom properties
// so React Aria components (drawers, tabs, buttons, overlays) stay visually
// consistent with the rest of the PWA.
//
// Color palette: cyan / orange / black (the single, unified game theme).
// All values are `var(--...)` references into `src/index.css` `:root`,
// so a token change in one place propagates everywhere.
import { createContext, useContext, type ReactNode } from 'react';

export interface GameTheme {
  // Surfaces
  bg: string;
  surface: string;
  surfaceAlt: string;
  // Borders
  border: string;
  borderSubtle: string;
  borderInteractive: string;
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textDark: string;
  textDim: string;
  white: string;
  // Accents — cyan and orange
  accent: string;
  accentHover: string;
  warn: string;
  warnHover: string;
  // Fills
  fillHover: string;
  fillHoverSubtle: string;
  // Shadows
  shadowPanel: string;
  shadowModal: string;
  shadowCard: string;
  // Typography
  fontFamily: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontWeightRegular: string;
  fontWeightMedium: string;
  fontWeightSemibold: string;
  // Radii
  radiusCard: string;
  radiusInput: string;
  radiusSmall: string;
  // Layout
  zIndexPanel: string;
  zIndexModal: string;
  transitionSpeed: string;
  // Touch targets
  touchTargetMin: string;
  touchTargetFrequent: string;
}

const GAME_THEME: GameTheme = {
  // Surfaces — reference main theme tokens for a single source of truth
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  surfaceAlt: '#161b22',
  // Borders
  border: 'var(--color-border)',
  borderSubtle: 'var(--color-border-subtle)',
  borderInteractive: 'var(--color-border-interactive)',
  // Text
  text: 'var(--color-text)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textDark: 'var(--color-text-dark)',
  textDim: 'var(--color-text-dim)',
  white: 'var(--color-white)',
  // Accents — cyan and orange (unified game palette, no green)
  accent: 'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',
  warn: 'var(--color-warning)',
  warnHover: '#ffb347',
  // Fills
  fillHover: 'var(--color-fill-hover)',
  fillHoverSubtle: 'var(--color-fill-hover-subtle)',
  // Shadows
  shadowPanel: 'var(--shadow-console)',
  shadowModal: 'var(--shadow-modal)',
  shadowCard: 'var(--shadow-card)',
  // Typography
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizeSm: 'var(--font-size-75)',
  fontSizeMd: 'var(--font-size-85)',
  fontSizeLg: 'var(--font-size-9)',
  fontSizeXl: 'var(--font-size-1)',
  fontWeightRegular: '400',
  fontWeightMedium: '500',
  fontWeightSemibold: '600',
  // Radii
  radiusCard: 'var(--radius-card)',
  radiusInput: 'var(--radius-input)',
  radiusSmall: 'var(--radius-small)',
  // Layout
  zIndexPanel: 'var(--z-console)',
  zIndexModal: 'var(--z-modal)',
  transitionSpeed: '0.2s',
  // Touch targets (iOS portrait minimums)
  touchTargetMin: 'var(--touch-target-min)',
  touchTargetFrequent: 'var(--touch-target-frequent)',
} as const;

const GameThemeContext = createContext<GameTheme>(GAME_THEME);

export function useGameTheme(): GameTheme {
  return useContext(GameThemeContext);
}

interface GameThemeProviderProps {
  children: ReactNode;
  /** Override theme values (optional) */
  theme?: Partial<GameTheme>;
}

/**
 * Provider that exposes the unified game theme (cyan / orange / black) via
 * React Context. Components consume tokens from CSS custom properties so they
 * automatically stay in sync with `src/index.css`.
 */
export function GameThemeProvider({ children, theme }: GameThemeProviderProps) {
  const mergedTheme = { ...GAME_THEME, ...theme };
  return <GameThemeContext.Provider value={mergedTheme}>{children}</GameThemeContext.Provider>;
}
