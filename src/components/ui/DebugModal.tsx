// src/components/ui/DebugModal.tsx
import { useOverlay, OverlayContainer } from '@react-aria/overlays';
import { useOverlayTriggerState } from '@react-stately/overlays';
import { FocusScope } from '@react-aria/focus';
import { useGameTheme } from './GameThemeProvider';
import { DebugButton } from './DebugButton';
import { useRef } from 'react';
import './DebugModal.css';

export interface DebugModalProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  'data-testid'?: string;
  label?: string;
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeButton?: boolean;
}

/**
 * DebugModal — a modal dialog styled like the debug console.
 *
 * Uses React Aria's overlay system for focus management,
 * escape-to-close, and backdrop.  Visual styling mirrors
 * DebugConsole.css: dark surface, subtle border, rounded
 * corners, monospace-friendly typography.
 */
export function DebugModal({
  trigger,
  children,
  'data-testid': testId,
  label = 'Modal',
  className = '',
  isOpen: controlledOpen,
  onOpenChange,
  closeButton = true,
}: DebugModalProps) {
  const theme = useGameTheme();
  const state = useOverlayTriggerState({
    isOpen: controlledOpen,
    onOpenChange,
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps, titleProps, closeButtonRef } = useOverlay(
    {
      isOpen: state.isOpen,
      onClose: state.close,
      shouldCloseOnBlur: true,
      isDismissable: true,
      'aria-label': label,
    },
    dialogRef,
  );

  return (
    <>
      <span onClick={state.open}>{trigger}</span>
      {state.isOpen && (
        <OverlayContainer>
          <div
            {...underlayProps}
            style={
              {
                '--debug-color-overlay': theme.surface,
              } as React.CSSProperties
            }
            className="debug-modal-backdrop"
          >
            <FocusScope contain restoreFocus autoFocus={false}>
              <div
                {...overlayProps}
                ref={dialogRef as React.Ref<HTMLDivElement>}
                data-testid={testId}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className={`debug-modal ${className}`}
                style={
                  {
                    '--debug-color-bg': theme.bg,
                    '--debug-color-surface': theme.surface,
                    '--debug-color-border': theme.border,
                    '--debug-color-border-subtle': theme.borderSubtle,
                    '--debug-color-white': theme.white,
                    '--debug-color-text': theme.text,
                    '--debug-color-text-secondary': theme.textSecondary,
                    '--debug-color-accent': theme.accent,
                    '--debug-color-accent-hover': theme.accentHover,
                    '--debug-color-warn': theme.warn,
                    '--debug-color-warn-hover': theme.warnHover,
                    '--debug-radius-modal': theme.radiusCard,
                    '--debug-shadow-modal': theme.shadowModal,
                    '--debug-font-family': theme.fontFamily,
                    '--debug-font-size-lg': theme.fontSizeLg,
                    '--debug-font-size-xl': theme.fontSizeXl,
                    '--debug-font-weight-semibold': theme.fontWeightSemibold,
                    '--debug-transition-speed': theme.transitionSpeed,
                    '--debug-z-modal': theme.zIndexModal,
                    '--debug-touch-target-min': theme.touchTargetMin,
                    '--debug-safe-area-bottom': 'env(safe-area-inset-bottom)',
                    '--debug-safe-area-top': 'env(safe-area-inset-top)',
                  } as React.CSSProperties
                }
              >
                <div className="debug-modal-content">
                  <div className="debug-modal-header">
                    <h3
                      {...titleProps}
                      data-testid={`${testId}-title`}
                      className="debug-modal-title"
                    >
                      {label}
                    </h3>
                    {closeButton && (
                      <DebugButton
                        ref={closeButtonRef as React.RefObject<HTMLButtonElement>}
                        variant="ghost"
                        size="sm"
                        aria-label="Close modal"
                        onPress={state.close}
                        data-testid={`${testId}-close`}
                      >
                        ✕
                      </DebugButton>
                    )}
                  </div>
                  <div className="debug-modal-body" data-testid={`${testId}-body`}>
                    {children}
                  </div>
                </div>
              </div>
            </FocusScope>
          </div>
        </OverlayContainer>
      )}
    </>
  );
}
