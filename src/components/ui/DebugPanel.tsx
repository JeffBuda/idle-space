// src/components/ui/DebugPanel.tsx
import { useGameTheme } from './GameThemeProvider';
import './DebugPanel.css';

export interface DebugPanelProps {
  children: React.ReactNode;
  'data-testid'?: string;
  className?: string;
  onClick?: () => void;
  role?: 'region' | 'aside' | 'section';
}

/**
 * DebugPanel — a card-style container styled like the debug console's
 * log-entry header area.
 *
 * Uses the debug console theme: subtle border, surface background,
 * rounded corners, and consistent padding.
 */
export function DebugPanel({
  children,
  'data-testid': testId,
  className = '',
  onClick,
  role = 'section',
}: DebugPanelProps) {
  const theme = useGameTheme();

  return (
    <div
      data-testid={testId}
      role={role}
      className={`debug-panel ${className}`}
      onClick={onClick}
      style={
        {
          '--debug-color-bg': theme.bg,
          '--debug-color-surface': theme.surface,
          '--debug-color-border': theme.border,
          '--debug-radius-card': theme.radiusCard,
          '--debug-shadow-card': theme.shadowCard,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
