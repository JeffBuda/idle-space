// src/components/BottomDrawer/BottomDrawer.tsx
//
// Bottom drawer with tabs for Debug Console, Game State, App Status,
// and Star Map. Renders on every screen. Collapses to a thumb handle
// when closed. Tab content is always rendered (not conditionally mounted)
// so StarMapContent always has its SVG dimensions.
import { DebugConsole } from '../DebugConsole';
import { GameStateViewer } from '../GameStateViewer';
import { AppStatusViewer } from '../AppStatusViewer';
import { StarMapContent } from '../GameScreenShell/StarMapContent';
import type { GameState } from '../../hooks/useGameState';
import './BottomDrawer.css';

export type DrawerTabId = 'details' | 'debug-console' | 'game-state' | 'app-status' | 'star-map';

export interface BottomDrawerProps {
  gameState: GameState | null;
  swStatus: 'Active' | 'Inactive';
  dbStatus: string;
  installReady: boolean;
  dispatchStarMapGo: (route: string[]) => void;
  detailsContent: React.ReactNode;
  onForceUpdate?: () => void;
  onNewGame?: () => void;
  /** Drawer open state (controlled) */
  drawerOpen: boolean;
  /** Active tab (controlled) */
  activeTab: DrawerTabId;
  /** Called when drawer open state changes */
  onDrawerOpenChange: (open: boolean) => void;
  /** Called when the active tab changes */
  onTabChange: (tab: DrawerTabId) => void;
}

const TABS: { id: DrawerTabId; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'debug-console', label: 'Debug Console' },
  { id: 'game-state', label: 'Game State' },
  { id: 'app-status', label: 'App Status' },
  { id: 'star-map', label: 'Star Map' },
];

export const BottomDrawer = ({
  gameState,
  swStatus,
  dbStatus,
  installReady,
  dispatchStarMapGo,
  detailsContent,
  onForceUpdate,
  onNewGame,
  drawerOpen,
  activeTab,
  onDrawerOpenChange,
  onTabChange,
}: BottomDrawerProps) => {
  const handleToggle = () => onDrawerOpenChange(!drawerOpen);

  const renderTabContent = () => (
    <>
      <section
        className={`drawer-tab-panel ${activeTab === 'details' ? 'is-active' : ''}`}
        data-testid="drawer-tabpanel-details"
      >
        {gameState ? detailsContent : <p>No game state loaded</p>}
      </section>
      <section
        className={`drawer-tab-panel ${activeTab === 'debug-console' ? 'is-active' : ''}`}
        data-testid="drawer-tabpanel-debug-console"
      >
        <DebugConsole visible={true} onClose={() => {}} />
      </section>
      <section
        className={`drawer-tab-panel ${activeTab === 'game-state' ? 'is-active' : ''}`}
        data-testid="drawer-tabpanel-game-state"
      >
        <GameStateViewer visible={true} gameState={gameState} onClose={() => {}} />
      </section>
      <section
        className={`drawer-tab-panel ${activeTab === 'app-status' ? 'is-active' : ''}`}
        data-testid="drawer-tabpanel-app-status"
      >
        <AppStatusViewer
          gameState={gameState}
          swStatus={swStatus}
          dbStatus={dbStatus}
          installReady={installReady}
          onForceUpdate={onForceUpdate}
          onNewGame={onNewGame}
        />
      </section>
      <section
        className={`drawer-tab-panel ${activeTab === 'star-map' ? 'is-active' : ''}`}
        data-testid="drawer-tabpanel-star-map"
      >
        {gameState && gameState.starMap ? (
          <StarMapContent gameState={gameState} onGo={dispatchStarMapGo} />
        ) : (
          <p data-testid="star-map-empty">No star map data available yet.</p>
        )}
      </section>
    </>
  );

  return (
    <div className={`bottom-drawer`} data-testid={`bottom-drawer`}>
      <div
        className={`drawer-handle ${drawerOpen ? 'drawer-handle--open' : ''}`}
        data-testid={`drawer-handle`}
        onClick={handleToggle}
        aria-label={drawerOpen ? 'Collapse details' : 'Show details and star map'}
      >
        <div className={`drawer-thumb`} />
      </div>

      <div
        className={`drawer-panel ${drawerOpen ? 'drawer-panel--open' : 'drawer-panel--closed'}`}
        data-testid={`drawer-panel`}
      >
        <div className={`drawer-tablist`} role={`tablist`} data-testid={`drawer-tablist`}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type={`button`}
              role={`tab`}
              aria-selected={activeTab === tab.id}
              className={`drawer-tab ${activeTab === tab.id ? 'drawer-tab--selected' : ''}`}
              data-testid={`drawer-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="drawer-tabcontent" data-testid="drawer-tabcontent">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};
