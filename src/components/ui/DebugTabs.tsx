// src/components/ui/DebugTabs.tsx
import { useTabListState } from '@react-stately/tabs';
import { useTab, useTabList } from '@react-aria/tabs';
import { FocusScope } from '@react-aria/focus';
import { useGameTheme } from './GameThemeProvider';
import './DebugTabs.css';

export interface DebugTab {
  id: string;
  label: React.ReactNode;
  content?: React.ReactNode;
  'data-testid'?: string;
}

export interface DebugTabsProps {
  tabs: DebugTab[];
  'data-testid'?: string;
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
  children?: (tab: DebugTab) => React.ReactNode;
}

/**
 * DebugTabs — tab navigation styled like the debug console.
 *
 * Tab list mirrors the `.debug-controls` aesthetic: subtle borders,
 * cyan active indicator, consistent 44px touch targets.
 * Uses React Aria's tab hooks for keyboard navigation and
 * ARIA-compliant semantics.
 */
export function DebugTabs({
  tabs,
  'data-testid': testId,
  defaultTab,
  onTabChange,
  className = '',
  children,
}: DebugTabsProps) {
  const theme = useGameTheme();
  const state = useTabListState({
    selectedKey: defaultTab ?? tabs[0]?.id,
    onSelectionChange: onTabChange,
  });

  const { tabs: tabRef } = useTabList({}, null, state);

  return (
    <div
      data-testid={testId}
      className={`debug-tabs ${className}`}
      style={
        {
          '--debug-color-border': theme.border,
          '--debug-color-border-subtle': theme.borderSubtle,
          '--debug-color-text': theme.text,
          '--debug-color-text-secondary': theme.textSecondary,
          '--debug-color-text-muted': theme.textMuted,
          '--debug-color-accent': theme.accent,
          '--debug-color-bg': theme.bg,
          '--debug-font-family': theme.fontFamily,
          '--debug-font-size-md': theme.fontSizeMd,
          '--debug-font-weight-medium': theme.fontWeightMedium,
          '--debug-font-weight-semibold': theme.fontWeightSemibold,
          '--debug-radius-small': theme.radiusSmall,
          '--debug-radius-card': theme.radiusCard,
          '--debug-transition-speed': theme.transitionSpeed,
        } as React.CSSProperties
      }
    >
      <FocusScope contain restoreFocus autoFocus={false}>
        <div
          ref={tabRef}
          className="debug-tablist"
          role="tablist"
          data-testid={`${testId}-tablist`}
        >
          {tabs.map((tab) => (
            <DebugTabTrigger key={tab.id} tab={tab} state={state} testId={testId} />
          ))}
        </div>
      </FocusScope>

      <div className="debug-tabpanel" data-testid={`${testId}-tabpanel`}>
        {children
          ? children(tabs.find((t) => t.id === state.selectedKey)!)
          : tabs.find((t) => t.id === state.selectedKey)?.content}
      </div>
    </div>
  );
}

interface DebugTabTriggerProps {
  tab: DebugTab;
  state: ReturnType<typeof useTabListState>;
  testId?: string;
}

function DebugTabTrigger({ tab, state, testId }: DebugTabTriggerProps) {
  const { tabRef } = useTab({ 'aria-label': tab.label }, state, null);
  const isSelected = state.selectedKey === tab.id;

  return (
    <button
      ref={tabRef}
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={`${testId}-panel-${tab.id}`}
      data-testid={tab['data-testid'] ?? `${testId}-tab-${tab.id}`}
      className={`debug-tab ${isSelected ? 'debug-tab--selected' : ''}`}
      onClick={() => state.setSelected(tab.id)}
    >
      {tab.label}
    </button>
  );
}
