// src/components/ui/DebugDrawer.tsx
import { useGameTheme } from './GameThemeProvider';
import { DebugButton } from './DebugButton';
import { useRef, useEffect, useState, cloneElement } from 'react';
import './DebugDrawer.css';

export interface DebugDrawerProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  'data-testid'?: string;
  label?: string;
  placement?: 'bottom' | 'top' | 'left' | 'right';
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * DebugDrawer — a slide-up panel styled like the debug console.
 * Uses React Aria's overlay trigger state with click-outside detection.
 */
export function DebugDrawer({
  trigger,
  children,
  'data-testid': testId,
  label = 'Panel',
  placement = 'bottom',
  className = '',
  isOpen: controlledOpen,
  onOpenChange,
}: DebugDrawerProps) {
  const theme = useGameTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);

  // Sync with controlled state when provided.
  const isOpen = controlledOpen ?? internalOpen;
  const toggleOpen = () => {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Click-outside detection: close when clicking outside the panel.
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        toggleOpen();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const drawerClass = 'debug-drawer debug-drawer--' + placement;

  const triggerElement = cloneElement(trigger as React.ReactElement, {
    onPress: toggleOpen,
  });

  return (
    <>
      {triggerElement}
      {isOpen && (
        <div
          className="debug-drawer-backdrop"
          data-testid={testId + '-backdrop'}
          style={
            {
              '--debug-z-modal': theme.zIndexModal,
            } as React.CSSProperties
          }
        >
          <div
            ref={panelRef}
            data-testid={testId}
            className={drawerClass + ' ' + className}
            style={
              {
                '--debug-color-bg': theme.bg,
                '--debug-color-surface': theme.surface,
                '--debug-color-border': theme.border,
                '--debug-color-border-subtle': theme.borderSubtle,
                '--debug-radius-card': theme.radiusCard,
                '--debug-shadow-panel': theme.shadowPanel,
                '--debug-transition-speed': theme.transitionSpeed,
                '--debug-z-panel': theme.zIndexPanel,
                '--debug-touch-target-min': theme.touchTargetMin,
                '--debug-safe-area-bottom': 'env(safe-area-inset-bottom)',
              } as React.CSSProperties
            }
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="debug-drawer-header">
              <h3 data-testid={`${testId}-title`} className="debug-drawer-title">
                {label}
              </h3>
              <DebugButton
                variant="ghost"
                size="sm"
                aria-label="Close panel"
                onPress={toggleOpen}
                data-testid={testId + '-close'}
              >
                ×
              </DebugButton>
            </div>
            <div className="debug-drawer-body" data-testid={testId + '-body'}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
