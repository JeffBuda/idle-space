// src/components/GameScreenShell/GameScreenShell.tsx
//
// Reusable full-screen shell layout — used by every game screen.
//
// Layout (mobile-first, iPhone 12 / 390×844):
//   ┌────────────────────────────────────────────┐
//   │ StatusBar  (top — title + time/ore chips) │
//   ├────────────────────────────────────────────┤
//   │ Main content (flex:1, scrollable)         │
//   ├────────────────────────────────────────────┤
//   │ BottomDrawer (collapsible, tabs)          │
//   ├────────────────────────────────────────────┤
//   │ ActionButtonBar (thumb zone, bottom)      │
//   └────────────────────────────────────────────┘
//
// The drawer always has two tabs: "Details" (screen-specific) and
// "Star Map" (interactive star map with route planning). React Aria
// hooks (useOverlayTriggerState, useTabListState, useTab, useTabList, FocusScope) provide
// keyboard navigation and ARIA semantics.
import { useOverlayTriggerState } from '@react-stately/overlays';
import { FocusScope } from '@react-aria/focus';
import { useTabListState } from '@react-stately/tabs';
import { useTab, useTabList } from '@react-aria/tabs';
import type { TabsState } from '@react-stately/tabs';
import { useRef } from 'react';
import { StatusBar, type StatusBarItem } from './StatusBar';
import { StarMapContent } from './StarMapContent';
import type { GameState } from '../../types/game-state';
import './GameScreenShell.css';

export type { StatusBarItem };

export interface GameScreenShellProps {
  /** Screen title shown in the top status row */
  title: string;
  /** Key-value items displayed in the top status row */
  statusItems: StatusBarItem[];
  /** Main screen-specific content (rendered in the scrollable middle area) */
  children: React.ReactNode;
  /** Content for the "Details" tab in the bottom drawer */
  detailsContent: React.ReactNode;
  /** Game state needed for the Star Map tab */
  gameState: GameState;
  /** Callback when the player confirms a star map route */
  onStarMapGo: (plannedRoute: string[]) => void;
  /** Action buttons rendered in the bottom button bar (thumb zone) */
  actionButtons: React.ReactNode;
  /** Controlled drawer state — pass true when screen is STAR_MAP */
  drawerOpen?: boolean;
  /** Called when the user opens or closes the drawer */
  onDrawerChange?: (open: boolean) => void;
  /** Which tab to show by default when the drawer opens */
  defaultDrawerTab?: 'details' | 'star-map';
  /** Optional subtitle shown under the title in the status row */
  subtitle?: string;
}

// ── Internal: drawer tab trigger (React Aria) ──────────────────────────

interface DrawerTabProps {
  state: TabsState<unknown>;
  tabId: string;
  label: string;
}

function DrawerTab({ state, tabId, label }: DrawerTabProps) {
  const tabRef = useRef<HTMLButtonElement>(null);
  const { tabProps } = useTab({ key: tabId, 'aria-label': label }, state, tabRef);
  const isSelected = state.selectedKey === tabId;

  return (
    <button
      {...tabProps}
      ref={tabRef}
      type="button"
      role="tab"
      aria-selected={isSelected}
      data-testid={`drawer-tab-${tabId}`}
      className={`drawer-tab ${isSelected ? 'drawer-tab--selected' : ''}`}
      onClick={() => state.setSelected(tabId)}
    >
      {label}
    </button>
  );
}

// ── GameScreenShell ─────────────────────────────────────────────────────

export function GameScreenShell({
  title,
  statusItems,
  children,
  detailsContent,
  gameState,
  onStarMapGo,
  actionButtons,
  drawerOpen = false,
  onDrawerChange,
  defaultDrawerTab = 'details',
  subtitle,
}: GameScreenShellProps) {
  // Drawer state via React Aria overlay trigger state (controlled)
  const drawerState = useOverlayTriggerState({
    isOpen: drawerOpen,
    onOpenChange: onDrawerChange,
  });

  // Tab state for drawer tabs
  const tabState = useTabListState({
    selectedKey: defaultDrawerTab,
  });

  const tabListRef = useRef<HTMLDivElement>(null);
  const { tabListProps } = useTabList({}, tabState, tabListRef);

  return (
    <div className="game-screen-shell" data-testid="game-screen-shell">
      {/* Top status row */}
      <StatusBar title={title} items={statusItems} subtitle={subtitle} />

      {/* Main content (scrollable) */}
      <main className="game-screen-content" data-testid="screen-content">
        {children}
      </main>

      {/* Bottom drawer (collapsible, tabs: Details | Star Map) */}
      <div
        className={`game-screen-drawer ${drawerState.isOpen ? 'drawer--open' : 'drawer--closed'}`}
        data-testid="screen-drawer"
      >
        {/* Thumb handle — always visible */}
        <div
          className="drawer-handle"
          data-testid="drawer-handle"
          role="button"
          aria-label={drawerState.isOpen ? 'Collapse details' : 'Show details and star map'}
          onClick={drawerState.isOpen ? drawerState.close : drawerState.open}
        >
          <div className="drawer-thumb" />
        </div>

        {/* Expanded panel */}
        {drawerState.isOpen && (
          <FocusScope contain restoreFocus autoFocus>
            <div className="drawer-panel" data-testid="drawer-panel">
              {/* Tab list */}
              <div
                {...tabListProps}
                ref={tabListRef}
                className="drawer-tablist"
                role="tablist"
                data-testid="drawer-tablist"
              >
                <DrawerTab state={tabState as TabsState<unknown>} tabId="details" label="Details" />
                <DrawerTab
                  state={tabState as TabsState<unknown>}
                  tabId="star-map"
                  label="Star Map"
                />
              </div>

              {/* Tab panels */}
              <div className="drawer-tabpanel" data-testid="drawer-tabpanel">
                {tabState.selectedKey === 'details' && (
                  <div className="drawer-tabpanel__content" data-testid="drawer-details">
                    {detailsContent}
                  </div>
                )}
                {tabState.selectedKey === 'star-map' && (
                  <div className="drawer-tabpanel__content" data-testid="drawer-star-map">
                    <StarMapContent gameState={gameState} onGo={onStarMapGo} />
                  </div>
                )}
              </div>

              {/* Close button */}
              <div className="drawer-footer">
                <button
                  type="button"
                  className="btn btn--secondary drawer-close-btn"
                  data-testid="drawer-close"
                  aria-label="Close"
                  onClick={drawerState.close}
                >
                  Close
                </button>
              </div>
            </div>
          </FocusScope>
        )}
      </div>

      {/* Bottom button bar (always visible — thumb zone) */}
      <div className="game-screen-actions" data-testid="action-button-bar">
        {actionButtons}
      </div>
    </div>
  );
}

export default GameScreenShell;
