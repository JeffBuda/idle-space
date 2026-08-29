import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import App from './App';

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
  rngSeed: 'test-seed',
  totalDistanceKm: 1000,
  version: '0.1.0',
};

vi.mock('../hooks/useGameState', () => ({
  useGameState: () => ({
    gameState: mockGameStateData,
    offlineSeconds: null,
    clearOfflineSeconds: vi.fn(),
    isLoading: false,
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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no active service worker
    mockServiceWorker(null);
  });

  it('renders the landing page title', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(
      screen.getByRole('heading', { name: 'Space Exploration Idle PWA' })
    ).toBeInTheDocument();
  });

  it('renders all essential status widgets without errors', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Service Worker')).toBeInTheDocument();
    expect(screen.getByText('IndexedDB')).toBeInTheDocument();
    expect(screen.getByText('Install Ready')).toBeInTheDocument();
    expect(screen.getByTestId('sw-status')).toBeInTheDocument();
    expect(screen.getByTestId('db-status')).toBeInTheDocument();
    expect(screen.getByTestId('install-status')).toBeInTheDocument();
  });

  it('updates the Service Worker status indicator to Active when registered', async () => {
    mockServiceWorker({} as ServiceWorker);
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('sw-status').textContent).toBe('Active');
    });
  });

  it('shows Inactive when no service worker controller is present', async () => {
    mockServiceWorker(null);
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId('sw-status').textContent).toBe('Inactive');
  });

  it('shows Connected for IndexedDB after successful init', async () => {
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('db-status').textContent).toBe('Connected');
    });
  });

  it('renders the engine section with game state information', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Engine')).toBeInTheDocument();
    expect(screen.getByTestId('total-travel-time')).toBeInTheDocument();
    expect(screen.getByTestId('total-distance')).toBeInTheDocument();
  });
});

