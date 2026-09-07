// src/components/ui/DebugButton.tsx
import { useRef, forwardRef } from 'react';
import { useButton } from '@react-aria/button';
import { useGameTheme } from './GameThemeProvider';
import './DebugButton.css';

export type DebugButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'icon';
export type DebugButtonSize = 'sm' | 'md' | 'lg';

export interface DebugButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: DebugButtonVariant;
  size?: DebugButtonSize;
  'data-testid'?: string;
  'aria-label'?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
}

/**
 * DebugButton — a button styled with the debug console theme.
 *
 * Visual language mirrors DebugConsole.css `.debug-btn` and
 * `.debug-close`: subtle border, cyan accent on interactive
 * states, monospace-friendly font stack, 44px minimum touch target.
 */
export const DebugButton = forwardRef<HTMLButtonElement, DebugButtonProps>(
  (
    {
      children,
      onPress,
      variant = 'secondary',
      size = 'md',
      'data-testid': testId,
      'aria-label': ariaLabel,
      type = 'button',
      disabled = false,
      className = '',
    },
    ref,
  ) => {
    const theme = useGameTheme();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { buttonProps } = useButton(
      {
        onPress,
        type,
        'aria-label': ariaLabel,
        isDisabled: disabled,
      },
      buttonRef,
    );

    // Merge forwarded ref with internal ref
    const mergedRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    };

    const variantClass = `debug-btn--${variant}`;
    const sizeClass = `debug-btn--size-${size}`;

    return (
      <button
        {...buttonProps}
        ref={mergedRef}
        type={type}
        data-testid={testId}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`debug-btn ${variantClass} ${sizeClass} ${className}`}
        style={
          {
            '--debug-color-accent': theme.accent,
            '--debug-color-accent-hover': theme.accentHover,
          } as React.CSSProperties
        }
      >
        {children}
      </button>
    );
  },
);

DebugButton.displayName = 'DebugButton';
