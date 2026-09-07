import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import App from './App';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../hooks/useDbStatus', () => ({
  useDbStatus: vi.fn().mockReturnValue('Connected'),
}));

const mockGameStateData = {
  lastTimestamp: Date.now(),
  elapsedSeconds: 100,
  totalElapsedGameTime: 100,
  rngSeed: 'test-seed',
  totalDistanceKm: 1000,
  version: '0.1.0',
  screen: 'PLANET',
  idleTimer: null,
  oreCounts: { commonOre: 0, rareOre: 0 },
  selectedOre: null,
  constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
  lastError: null,
  starMap: null,
  routePath: [],
  routeTravelTimeSeconds: 0,
  currentLocation: 'sys_0',
};

const mockDispatch = vi.fn();
const mockStartNewGame = vi.fn();
const mockDispatchStarMapGo = vi.fn();

vi.mock('../hooks/useGameState', () => ({
  useGameState: () => ({
    gameState: mockGameStateData,
    screen: mockGameStateData.screen,
    oreCounts: mockGameStateData.oreCounts,
    gate: null,
    offlineSeconds: null,
    clearOfflineSeconds: vi.fn(),
    idleReward: null,
    clearIdleReward: vi.fn(),
    isLoading: false,
    dispatch: mockDispatch,
    dispatchStarMapGo: mockDispatchStarMapGo,
    startNewGame: mockStartNewGame,
  }),
}));

vi.mock('../utils/cache', () => ({
  clearCacheAndUpdate: vi.fn(),
}));

vi.mock('@react-stately/overlays', () => ({
  useOverlayTriggerState: (props) => ({
    isOpen: Boolean(props.isOpen),
    open: () => props.onOpenChange && props.onOpenChange(true),
    close: () => props.onOpenChange && props.onOpenChange(false),
    toggle: () => props.onOpenChange && props.onOpenChange(!props.isOpen),
    onOpenChange: props.onOpenChange,
  }),
}));

vi.mock('@react-aria/focus', () => ({
  FocusScope: ({ children }) => children,
}));

vi.mock('@react-aria/button', () => ({
  useButton: (props) => {
    const onPress = props.onPress;
    return {
      buttonProps: {
        onClick: onPress,
        type: props.type || 'button',
        disabled: props.isDisabled,
      },
    };
  },
}));

vi.mock('../hooks/useDebugLogs', () => ({
  useDebugLogs: () => ({
    logs: [],
    isLoading: false,
    refresh: vi.fn(),
    clear: vi.fn(),
  }),
}));

// React Aria mocks for GameScreenShell tabs
vi.mock('@react-stately/tabs', () => ({
  useTabListState: (props) => ({
    selectedKey: props.selectedKey || 'details',
    setSelected: vi.fn(),
  }),
}));

vi.mock('@react-aria/tabs', () => ({
  useTab: () => ({ tabProps: {}, isSelected: false }),
  useTabList: () => ({ tabListProps: {}, tabListRef: { current: null } }),
}));

const mockServiceWorker = (controller = null) => {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      controller,
      register: vi.fn().mockResolvedValue({}),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getRegistration: vi.fn(),
    },
    configurable: true,
    writable: true,
  });
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGameStateData.screen = 'PLANET';
    mockGameStateData.currentLocation = 'sys_0';
    mockGameStateData.routePath = [];
    mockGameStateData.oreCounts = { commonOre: 0, rareOre: 0 };
    mockGameStateData.starMap = null;
    mockGameStateData.selectedOre = null;
    mockGameStateData.idleTimer = null;
    mockGameStateData.idleReward = null;
  });

  it('renders the landing page title', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole('heading', { name: 'Idle Space' })).toBeInTheDocument();
  });

  it('renders all essential status widgets in the bottom drawer', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByText('Service Worker')).toBeInTheDocument();
      expect(screen.getByText('IndexedDB')).toBeInTheDocument();
      expect(screen.getByText('Install Ready')).toBeInTheDocument();
      expect(screen.getByTestId('sw-status')).toBeInTheDocument();
      expect(screen.getByTestId('db-status')).toBeInTheDocument();
      expect(screen.getByTestId('install-status')).toBeInTheDocument();
    });
  });

  it('updates the Service Worker status indicator to Active when registered', async () => {
    mockServiceWorker({});
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByTestId('sw-status').textContent).toBe('Active');
    });
  });

  it('shows Inactive when no service worker controller is present', async () => {
    mockServiceWorker(null);
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByTestId('sw-status').textContent).toBe('Inactive');
    });
  });

  it('shows Connected for IndexedDB after successful init', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByTestId('db-status').textContent).toBe('Connected');
    });
  });

  it('renders the engine section with game state information', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByText('Engine')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('total-travel-time').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('total-distance').length).toBeGreaterThan(0);
  });

  it('renders the build information card with version and build date', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByText('Build Information')).toBeInTheDocument();
      expect(screen.getByTestId('app-version')).toBeInTheDocument();
      expect(screen.getByTestId('build-date')).toBeInTheDocument();
      expect(screen.getByTestId('app-version').textContent).toMatch(/^\d+\.\d+\.\d+$/);
      expect(screen.getByTestId('build-date').textContent).not.toBe('');
    });
  });

  it('renders the bottom drawer with a handle', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId('bottom-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-handle')).toBeInTheDocument();
  });

  it('opens the bottom drawer when the handle is clicked', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-panel')).toBeInTheDocument();
    });
  });

  it('renders all five tabs in the bottom drawer', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-tab-details')).toBeInTheDocument();
      expect(screen.getByTestId('drawer-tab-debug-console')).toBeInTheDocument();
      expect(screen.getByTestId('drawer-tab-game-state')).toBeInTheDocument();
      expect(screen.getByTestId('drawer-tab-app-status')).toBeInTheDocument();
      expect(screen.getByTestId('drawer-tab-star-map')).toBeInTheDocument();
    });
  });

  it('renders the New Game button in the app status tab', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByTestId('new-game')).toBeInTheDocument();
    });
  });

  it('opens the New Game confirmation modal', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('new-game'));
      expect(screen.getByTestId('new-game-confirm-modal')).toBeInTheDocument();
    });
  });

  it('confirms New Game and invokes the hook reset', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('new-game'));
      fireEvent.click(screen.getByTestId('new-game-confirm'));
      expect(mockStartNewGame).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('new-game-confirm-modal')).not.toBeInTheDocument();
    });
  });

  it('dismisses the New Game modal via Cancel without resetting', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('new-game'));
      fireEvent.click(screen.getByTestId('new-game-cancel'));
      expect(mockStartNewGame).not.toHaveBeenCalled();
      expect(screen.queryByTestId('new-game-confirm-modal')).not.toBeInTheDocument();
    });
  });

  it('renders AppStatusViewer contents in the app status tab', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByText('Application Status')).toBeInTheDocument();
    });
  });

  it('renders Debug Console tab content', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-debug-console'));
    await waitFor(() => {
      expect(screen.getByTestId('debug-console')).toBeInTheDocument();
    });
  });

  it('renders Game State viewer tab content', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-game-state'));
    await waitFor(() => {
      expect(screen.getByTestId('game-state-viewer')).toBeInTheDocument();
    });
  });

  it('renders App Status tab in the bottom drawer', async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('drawer-handle'));
    fireEvent.click(screen.getByTestId('drawer-tab-app-status'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-tab-app-status')).toBeInTheDocument();
    });
  });

  it('renders the Welcome screen on a fresh (WELCOME) save', async () => {
    mockGameStateData.screen = 'WELCOME';
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId('screen-content')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-content')).toBeInTheDocument();
    expect(screen.getByTestId('launch-btn')).toBeInTheDocument();
  });

  it('dispatches NAVIGATE to SPACE_TRAVEL when Launch! is clicked', async () => {
    mockGameStateData.screen = 'WELCOME';
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('launch-btn'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', to: 'SPACE_TRAVEL' });
  });

  it('does NOT render Chart Course button on WelcomeContent (R9)', () => {
    mockGameStateData.screen = 'WELCOME';
    render(<App />);
    expect(screen.queryByTestId('welcome-chart-course')).not.toBeInTheDocument();
  });

  it('renders the Mining screen with ore selection buttons', async () => {
    mockGameStateData.screen = 'MINING';
    mockGameStateData.oreCounts = { commonOre: 2, rareOre: 1 };
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId('screen-content')).toBeInTheDocument();
    expect(screen.getByTestId('mining-content')).toBeInTheDocument();
    expect(screen.getByTestId('ore-common')).toBeInTheDocument();
    expect(screen.getByTestId('ore-rare')).toBeInTheDocument();
  });

  it('renders the Planet hub with Land / Depart navigation on PLANET', () => {
    render(<App />);
    expect(screen.getByTestId('screen-content')).toBeInTheDocument();
    expect(screen.getByTestId('planet-hub-content')).toBeInTheDocument();
    expect(screen.getByTestId('nav-landing')).toBeInTheDocument();
    expect(screen.getByTestId('nav-space-travel')).toBeInTheDocument();
  });

  it('renders the Star Map tab content when gameState.starMap is populated', async () => {
    mockGameStateData.screen = 'STAR_MAP';
    mockGameStateData.starMap = {
      nodes: [{ id: 'sys_0', name: 'Test', x: 50, y: 50, status: 'current', edges: [] }],
      edges: [],
    };
    render(<App />);
    expect(screen.getByTestId('screen-title')).toBeInTheDocument();
  });

  it('Planet hub displays planet name derived from currentLocation (R7)', () => {
    mockGameStateData.screen = 'PLANET';
    mockGameStateData.currentLocation = 'sys_0';
    mockGameStateData.starMap = {
      nodes: [{ id: 'sys_0', name: 'Sol', x: 50, y: 50, status: 'visited', edges: [] }],
      edges: [],
    };
    render(<App />);
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Orbiting Sol');
  });

  it('Planet hub Depart button reads "Follow Route" when routePath is non-empty (R8)', () => {
    mockGameStateData.screen = 'PLANET';
    mockGameStateData.routePath = [
      { from: 'sys_0', to: 'sys_1', path: ['sys_0', 'sys_1'], hops: 1 },
    ];
    render(<App />);
    expect(screen.getByTestId('nav-space-travel')).toHaveTextContent('Follow Route');
  });

  it('Planet hub Depart button reads "Depart" when routePath is empty (R8)', () => {
    mockGameStateData.screen = 'PLANET';
    mockGameStateData.routePath = [];
    render(<App />);
    expect(screen.getByTestId('nav-space-travel')).toHaveTextContent('Depart');
  });

  it('SpaceTravel screen displays approaching planet name (R7)', () => {
    mockGameStateData.screen = 'SPACE_TRAVEL';
    mockGameStateData.currentLocation = 'sys_0';
    mockGameStateData.starMap = {
      nodes: [{ id: 'sys_0', name: 'Sol', x: 50, y: 50, status: 'current', edges: [] }],
      edges: [],
    };
    render(<App />);
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Approaching Sol');
  });

  it('WELCOME launch button uses the canonical .btn system', () => {
    mockGameStateData.screen = 'WELCOME';
    render(<App />);
    const launchBtn = screen.getByTestId('launch-btn');
    expect(launchBtn).toHaveClass('btn', 'btn--primary');
    expect(launchBtn.className).not.toContain('primary-btn');
  });

  it('MINING ore-selection buttons use .btn classes', () => {
    mockGameStateData.screen = 'MINING';
    render(<App />);
    const commonOreBtn = screen.getByTestId('ore-common');
    const rareOreBtn = screen.getByTestId('ore-rare');
    expect(commonOreBtn).toHaveClass('btn');
    expect(rareOreBtn).toHaveClass('btn');
  });

  it('PLANET hub nav buttons use canonical .btn classes', () => {
    mockGameStateData.screen = 'PLANET';
    render(<App />);
    expect(screen.getByTestId('nav-landing')).toHaveClass('btn', 'btn--primary');
    expect(screen.getByTestId('nav-space-travel')).toHaveClass('btn', 'btn--secondary');
  });

  it('app shell applies safe-area insets and touch-target tokens via CSS', () => {
    mockGameStateData.screen = 'PLANET';
    const { container } = render(<App />);
    const appDiv = container.querySelector('.app');
    expect(appDiv).not.toBeNull();
    const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');
    expect(indexCss).toContain('--safe-area-top');
    expect(indexCss).toContain('--safe-area-right');
    expect(indexCss).toContain('--safe-area-bottom');
    expect(indexCss).toContain('--safe-area-left');
    expect(indexCss).toContain('--touch-target-min');
  });
});
