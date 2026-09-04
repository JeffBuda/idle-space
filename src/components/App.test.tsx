import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import App from './App';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Mock the useDbStatus hook so tests don't require a real IDB.
// ---------------------------------------------------------------------------
vi.mock('../hooks/useDbStatus', () => ({
  useDbStatus: vi.fn().mockReturnValue('Connected'),
}));

// ---------------------------------------------------------------------------
// Mock the useGameState hook so tests don't depend on real IDB/visibility events
// ---------------------------------------------------------------------------
const mockGameStateData = {
  lastTimestamp: Date.now(),
  elapsedSeconds: 100,
  totalElapsedGameTime: 100,
  rngSeed: 'test-seed',
  totalDistanceKm: 1000,
  version: '0.1.0',
  // Onboarding-flow fields (defaults to the PLANET hub so the status
  // grid + hub overlay render as before the flow tests override).
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

// Stable dispatch mock so App tests can assert on dispatched flow actions.
const mockDispatch = vi.fn();

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
    starMap: null,
    routePath: [],
    routeTravelTimeSeconds: 0,
    navigateTo: vi.fn(),
  }),
}));

// Mock the cache utility so App tests don't trigger a real page reload
vi.mock('../utils/cache', () => ({
  clearCacheAndUpdate: vi.fn(),
}));

// Mock the useDebugLogs hook so App tests don't require a real IDB
vi.mock('../hooks/useDebugLogs', () => ({
  useDebugLogs: () => ({
    logs: [],
    isLoading: false,
    refresh: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helper: replace navigator.serviceWorker with a controllable mock.
// ---------------------------------------------------------------------------
const mockServiceWorker = (controller: object | null = null) => {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      controller: controller as ServiceWorker | null,
      register: vi.fn().mockResolvedValue({}),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getRegistration: vi.fn(),
    },
    configurable: true,
    writable: true,
  });
};

// ---------------------------------------------------------------------------
// Helper: render the app and open the menu-gated App Status overlay.
// Per docs/DESIGN_BIBLE.md, the status grid is hidden behind the SettingsMenu
// "View App Status" toggle.
// ---------------------------------------------------------------------------
const openAppStatus = async () => {
  await act(async () => {
    render(<App />);
  });
  fireEvent.click(screen.getByTestId('settings-gear'));
  fireEvent.click(screen.getByTestId('toggle-app-status'));
  await waitFor(() => {
    expect(screen.getByTestId('sw-status')).toBeInTheDocument();
  });
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceWorker(null);
    mockGameStateData.screen = 'PLANET';
  });

  it('renders the landing page title', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole('heading', { name: 'Space Exploration Idle PWA' })).toBeInTheDocument();
  });

  it('renders all essential status widgets without errors', async () => {
    await openAppStatus();
    expect(screen.getByText('Service Worker')).toBeInTheDocument();
    expect(screen.getByText('IndexedDB')).toBeInTheDocument();
    expect(screen.getByText('Install Ready')).toBeInTheDocument();
    expect(screen.getByTestId('sw-status')).toBeInTheDocument();
    expect(screen.getByTestId('db-status')).toBeInTheDocument();
    expect(screen.getByTestId('install-status')).toBeInTheDocument();
  });

  it('updates the Service Worker status indicator to Active when registered', async () => {
    mockServiceWorker({} as ServiceWorker);
    await openAppStatus();
    expect(screen.getByTestId('sw-status').textContent).toBe('Active');
  });

  it('shows Inactive when no service worker controller is present', async () => {
    mockServiceWorker(null);
    await openAppStatus();
    expect(screen.getByTestId('sw-status').textContent).toBe('Inactive');
  });

  it('shows Connected for IndexedDB after successful init', async () => {
    await openAppStatus();
    expect(screen.getByTestId('db-status').textContent).toBe('Connected');
  });

  it('renders the engine section with game state information', async () => {
    await openAppStatus();
    expect(screen.getByText('Engine')).toBeInTheDocument();
    expect(screen.getByTestId('total-travel-time')).toBeInTheDocument();
    expect(screen.getByTestId('total-distance')).toBeInTheDocument();
  });

  it('renders the build information card with version and build date', async () => {
    await openAppStatus();
    expect(screen.getByText('Build Information')).toBeInTheDocument();
    expect(screen.getByTestId('app-version')).toBeInTheDocument();
    expect(screen.getByTestId('build-date')).toBeInTheDocument();
    expect(screen.getByTestId('app-version').textContent).toMatch(/\d+\.\d+\.\d+/);
    expect(screen.getByTestId('build-date').textContent).not.toBe('');
  });

  it('renders the gear icon in the header', () => {
    render(<App />);
    expect(screen.getByTestId('settings-gear')).toBeInTheDocument();
  });

  it('opens settings card when gear icon is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();
  });

  it('does not render AppStatusViewer until "View App Status" is toggled', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.queryByText('Application Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Engine')).not.toBeInTheDocument();
    expect(screen.queryByText('Build Information')).not.toBeInTheDocument();
  });

  it('opens app status viewer when "View App Status" is clicked', async () => {
    await openAppStatus();
    expect(screen.getByText('Application Status')).toBeInTheDocument();
  });

  it('closes settings card after toggling app status', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('toggle-app-status'));
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument();
  });

  it('closes app status when "Hide App Status" is clicked', async () => {
    await openAppStatus();
    expect(screen.getByText('Application Status')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('toggle-app-status'));
    expect(screen.queryByText('Application Status')).not.toBeInTheDocument();
  });

  it('opens game state viewer when "View Game State" is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('toggle-game-state'));

    await waitFor(() => {
      expect(screen.getByTestId('game-state-viewer')).toBeInTheDocument();
    });
  });

  it('displays game state JSON in the viewer when visible', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('toggle-game-state'));

    await waitFor(() => {
      const json = screen.getByTestId('game-state-json');
      expect(json).toBeInTheDocument();
      expect(json.textContent).toContain('totalDistanceKm');
      expect(json.textContent).toContain('1000');
    });
  });

  it('closes game state viewer when close button is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('toggle-game-state'));

    await waitFor(() => {
      expect(screen.getByTestId('game-state-viewer')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('game-state-close'));
    expect(screen.queryByTestId('game-state-viewer')).not.toBeInTheDocument();
  });

  it('renders the Welcome overlay on a fresh (WELCOME) save', async () => {
    mockGameStateData.screen = 'WELCOME';
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument();
    expect(screen.getByTestId('launch-btn')).toBeInTheDocument();
  });

  it('dispatches NAVIGATE -> SPACE_TRAVEL when Launch! is clicked', async () => {
    mockGameStateData.screen = 'WELCOME';
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByTestId('launch-btn'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', to: 'SPACE_TRAVEL' });
  });

  it('renders the Mining overlay with ore selection buttons', async () => {
    mockGameStateData.screen = 'MINING';
    mockGameStateData.oreCounts = { commonOre: 2, rareOre: 1 };
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId('mining-screen')).toBeInTheDocument();
    expect(screen.getByTestId('ore-common')).toBeInTheDocument();
    expect(screen.getByTestId('ore-rare')).toBeInTheDocument();
    expect(screen.getByTestId('ore-counts').textContent).toContain('2');
    expect(screen.getByTestId('ore-counts').textContent).toContain('1');
  });

  it('renders the Planet hub with Land / Depart navigation on PLANET', () => {
    render(<App />);
    expect(screen.getByTestId('planet-hub-screen')).toBeInTheDocument();
    expect(screen.getByTestId('nav-landing')).toBeInTheDocument();
    expect(screen.getByTestId('nav-space-travel')).toBeInTheDocument();
  });

  it('Planet hub has a Chart Course button linking to STAR_MAP', () => {
    render(<App />);
    expect(screen.getByTestId('nav-star-map')).toBeInTheDocument();
  });

  it('does NOT render Chart Course button on WelcomeScreen (R9)', () => {
    mockGameStateData.screen = 'WELCOME';
    render(<App />);
    expect(screen.queryByTestId('welcome-chart-course')).not.toBeInTheDocument();
  });

  it('renders the Star Map screen when gameState.starMap is populated', async () => {
    mockGameStateData.screen = 'STAR_MAP';
    mockGameStateData.starMap = {
      nodes: [{ id: 'sys_0', name: 'Test', x: 50, y: 50, status: 'current', edges: [] }],
      edges: [],
      plannedRoute: [],
      zoomLevel: 1.0,
    };
    render(<App />);
    expect(screen.getByTestId('star-map-screen')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-title')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // R7 & R8: planet-name display and Depart/Follow Route branching
  // ---------------------------------------------------------------------------
  it('PlanetHubScreen displays planet name derived from currentLocation (R7)', () => {
    mockGameStateData.screen = 'PLANET';
    mockGameStateData.currentLocation = 'sys_0';
    mockGameStateData.starMap = {
      nodes: [{ id: 'sys_0', name: 'Sol', x: 50, y: 50, status: 'visited', edges: [] }],
      edges: [],
      plannedRoute: [],
      zoomLevel: 1.0,
    };
    render(<App />);
    expect(screen.getByTestId('planet-hub-title')).toHaveTextContent('Orbiting Sol');
  });

  it('PlanetHubScreen Depart button reads "Follow Route" when routePath is non-empty (R8)', () => {
    mockGameStateData.screen = 'PLANET';
    mockGameStateData.routePath = [
      { from: 'sys_0', to: 'sys_1', path: ['sys_0', 'sys_1'], hops: 1 },
    ];
    render(<App />);
    expect(screen.getByTestId('nav-space-travel')).toHaveTextContent('Follow Route');
  });

  it('PlanetHubScreen Depart button reads "Depart" when routePath is empty (R8)', () => {
    mockGameStateData.screen = 'PLANET';
    mockGameStateData.routePath = [];
    render(<App />);
    expect(screen.getByTestId('nav-space-travel')).toHaveTextContent('Depart');
  });

  it('SpaceTravelScreen displays approaching planet name (R7)', () => {
    mockGameStateData.screen = 'SPACE_TRAVEL';
    mockGameStateData.currentLocation = 'sys_0';
    mockGameStateData.starMap = {
      nodes: [{ id: 'sys_0', name: 'Sol', x: 50, y: 50, status: 'current', edges: [] }],
      edges: [],
      plannedRoute: [],
      zoomLevel: 1.0,
    };
    render(<App />);
    expect(screen.getByTestId('space-travel-title')).toHaveTextContent('Approaching Sol');
  });

  // ---------------------------------------------------------------------------
  // iOS portrait-mode touch-target & canonical-button regression tests
  // (docs/DESIGN_BIBLE.md §4.1–4.3)
  // ---------------------------------------------------------------------------
  it('WELCOME launch button uses the canonical .btn system, not the deprecated .primary-btn', () => {
    mockGameStateData.screen = 'WELCOME';
    render(<App />);
    const launchBtn = screen.getByTestId('launch-btn');
    expect(launchBtn).toHaveClass('btn', 'btn--primary');
    expect(launchBtn.className).not.toContain('primary-btn');
  });

  it('MINING ore-selection buttons use .btn btn--primary (44px minimum touch target)', () => {
    mockGameStateData.screen = 'MINING';
    render(<App />);
    const commonOreBtn = screen.getByTestId('ore-common');
    const rareOreBtn = screen.getByTestId('ore-rare');
    expect(commonOreBtn).toHaveClass('btn', 'btn--primary');
    expect(rareOreBtn).toHaveClass('btn', 'btn--primary');
  });

  it('PLANET hub nav buttons use canonical .btn classes', () => {
    mockGameStateData.screen = 'PLANET';
    render(<App />);
    expect(screen.getByTestId('nav-landing')).toHaveClass('btn', 'btn--primary');
    expect(screen.getByTestId('nav-space-travel')).toHaveClass('btn', 'btn--secondary');
  });

  it('app shell applies safe-area insets and canonical touch-target tokens via CSS', () => {
    mockGameStateData.screen = 'PLANET';
    const { container } = render(<App />);
    const appDiv = container.querySelector('.app');
    expect(appDiv).not.toBeNull();
    // jsdom does not load CSS imports, so verify the source CSS declares the
    // safe-area and touch-target custom properties (docs/tokens.md §3)
    const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');
    expect(indexCss).toContain('--safe-area-top');
    expect(indexCss).toContain('--safe-area-right');
    expect(indexCss).toContain('--safe-area-bottom');
    expect(indexCss).toContain('--safe-area-left');
    expect(indexCss).toContain('--touch-target-min');
  });
});
