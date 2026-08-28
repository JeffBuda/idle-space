import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import App from './App';

// ---------------------------------------------------------------------------
// Mock the IndexedDB helper (src/db.ts) so tests do not require a real IDB.
// ---------------------------------------------------------------------------
vi.mock('./db', () => ({
  initDB: vi.fn().mockResolvedValue({
    installed: false,
    firstVisit: Date.now(),
    version: '0.1.0',
  }),
  getAppStatus: vi.fn(),
  setAppStatus: vi.fn(),
  DB_NAME: 'space_idle_db',
  APP_STATUS_KEY: 'app_status',
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

  it('renders the time-delta placeholder', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText(/Elapsed time:/)).toBeInTheDocument();
    expect(screen.getByTestId('elapsed-time')).toBeInTheDocument();
  });
});

