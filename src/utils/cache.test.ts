// src/utils/cache.test.ts
//
// Unit tests for the Force UI Update cache-invalidation utility.
//
// Since cache.ts depends on browser APIs (navigator.serviceWorker,
// caches, window.location), the tests mock these globals to verify
// the SW update lifecycle logic and nuclear fallback behaviour without
// a real browser.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearCacheAndUpdate } from './cache';

// Mock the logging helper so tests don't touch IndexedDB.
vi.mock('../logging/swUpdateLogger', () => ({
  logSWUpdate: vi.fn(),
}));

// --- Mock builder helpers ------------------------------------------------

/**
 * Creates a mock ServiceWorkerRegistration with configurable
 * `waiting`, `active`, `installing`, and an `update()` method.
 */
const createMockRegistration = (
  overrides: {
    waiting?: ServiceWorker | null;
    active?: ServiceWorker | null;
    installing?: ServiceWorker | null;
  } = {},
): ServiceWorkerRegistration => {
  const waitingSW = overrides.waiting ?? null;
  const postMessage = vi.fn();
  if (waitingSW) {
    (waitingSW as unknown as { postMessage: typeof vi.fn }).postMessage = postMessage;
  }

  const listeners = new Map<string, EventListenerOrEventListenerObject[]>();

  return {
    waiting: waitingSW,
    active: overrides.active ?? null,
    installing: overrides.installing ?? null,
    scope: 'http://localhost/',
    update: vi.fn().mockResolvedValue(undefined),
    showNotification: vi.fn(),
    getNotifications: vi.fn(),
    unregister: vi.fn().mockResolvedValue(true),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const arr = listeners.get(type) ?? [];
      arr.push(listener);
      listeners.set(type, arr);
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    _emit: (type: string, event?: Event) => {
      const arr = listeners.get(type) ?? [];
      arr.forEach((l) =>
        typeof l === 'function'
          ? l(event ?? new Event(type))
          : (l as EventListener).handleEvent(event ?? new Event(type)),
      );
    },
  } as unknown as ServiceWorkerRegistration;
};

/**
 * Sets up the global navigator.serviceWorker mock with the given
 * controller and registration. Returns a handle to emit events.
 */
const mockServiceWorker = (
  options: {
    controller?: object | null;
    registration?: ServiceWorkerRegistration | null;
  } = {},
) => {
  const swContainer = {
    controller: options.controller ?? null,
    registrations: options.registration ? [options.registration] : [],
    _listeners: new Map<string, EventListenerOrEventListenerObject[]>(),
    getRegistration: vi.fn().mockResolvedValue(options.registration ?? null),
    getRegistrations: vi.fn().mockResolvedValue(options.registration ? [options.registration] : []),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const arr = swContainer._listeners.get(type) ?? [];
      arr.push(listener);
      swContainer._listeners.set(type, arr);
    }),
    removeEventListener: vi.fn(),
    _emit: (type: string) => {
      const arr = swContainer._listeners.get(type) ?? [];
      arr.forEach((l) =>
        typeof l === 'function'
          ? l(new Event(type))
          : (l as EventListener).handleEvent(new Event(type)),
      );
    },
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: swContainer,
    configurable: true,
    writable: true,
  });

  return swContainer;
};

const mockLocation = {
  href: 'http://localhost/',
  replace: vi.fn(),
  reload: vi.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  configurable: true,
  writable: true,
});

const mockCaches = {
  keys: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockResolvedValue(true),
};

Object.defineProperty(window, 'caches', {
  value: mockCaches,
  configurable: true,
  writable: true,
});

import { logSWUpdate } from '../logging/swUpdateLogger';
const mockedLogSWUpdate = vi.mocked(logSWUpdate);

describe('clearCacheAndUpdate', () => {
  let swContainer: ReturnType<typeof mockServiceWorker>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockLocation.href = 'http://localhost/';
    mockLocation.replace.mockClear();
    mockLocation.reload.mockClear();
    mockCaches.keys.mockResolvedValue([]);
    mockCaches.delete.mockResolvedValue(true);

    swContainer = mockServiceWorker({ controller: null, registration: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use the SW update lifecycle when a waiting SW is found', async () => {
    const waitingSW = {
      postMessage: vi.fn(),
      scriptURL: 'http://localhost/sw.js',
      state: 'installed',
    } as unknown as ServiceWorker;

    const registration = createMockRegistration({ waiting: waitingSW });

    swContainer = mockServiceWorker({
      controller: waitingSW,
      registration: registration,
    });

    const promise = clearCacheAndUpdate();

    // waitForSWUpdate times out (no updatefound event fires before listener
    // is set up). registration.waiting is already set, so SW_WAITING path
    // is taken after the timeout.
    await vi.advanceTimersByTimeAsync(15000);
    swContainer._emit('controllerchange');

    await promise;

    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(waitingSW.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
    expect(mockCaches.keys).toHaveBeenCalled();
    expect(mockLocation.reload).toHaveBeenCalledTimes(1);
    expect(mockLocation.replace).not.toHaveBeenCalled();

    expect(mockedLogSWUpdate).toHaveBeenCalledWith('FORCE_UPDATE_INITIATED');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_UPDATE_CHECK');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_WAITING');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SKIP_WAITING_SENT');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_UPDATE_FOUND');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('CONTROLLER_CHANGED');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_UPDATE_SUCCESS');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('CACHES_PURGED');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('PAGE_RELOAD');
  });

  it('should fall back to nuclear when serviceWorker is unavailable', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const promise = clearCacheAndUpdate();

    await vi.advanceTimersByTimeAsync(1000);

    await promise;

    expect(mockedLogSWUpdate).toHaveBeenCalledWith('FORCE_UPDATE_INITIATED');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('NO_SW_SUPPORT');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('NUCLEAR_FALLBACK');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_UNREGISTERED');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('CACHES_PURGED');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('PAGE_RELOAD');

    expect(mockLocation.replace).toHaveBeenCalledTimes(1);
    expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('_cb='));
    expect(mockLocation.reload).not.toHaveBeenCalled();

    mockServiceWorker({ controller: null, registration: null });
  });

  it('should fall back to nuclear when no SW registration exists', async () => {
    swContainer = mockServiceWorker({ controller: null, registration: null });

    const promise = clearCacheAndUpdate();

    await vi.advanceTimersByTimeAsync(15000 + 1000);

    await promise;

    expect(mockedLogSWUpdate).toHaveBeenCalledWith('NO_SW_REGISTRATION');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('NUCLEAR_FALLBACK');
    expect(mockLocation.replace).toHaveBeenCalledTimes(1);
    expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('_cb='));
  });

  it('should reload current SW when no update is found', async () => {
    const registration = createMockRegistration({ waiting: null });
    swContainer = mockServiceWorker({
      controller: {} as ServiceWorker,
      registration,
    });

    const promise = clearCacheAndUpdate();

    await vi.advanceTimersByTimeAsync(15000 + 500);

    await promise;

    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_UPDATE_CHECK');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_ALREADY_CURRENT');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('CONTROLLER_CHANGED');
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_UPDATE_SUCCESS');
    expect(mockLocation.reload).toHaveBeenCalledTimes(1);
    expect(mockLocation.replace).not.toHaveBeenCalled();
  });

  it('should fall back to nuclear when registration.update() throws', async () => {
    const registration = createMockRegistration();
    (registration.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    swContainer = mockServiceWorker({
      controller: {} as ServiceWorker,
      registration,
    });

    const promise = clearCacheAndUpdate();

    await vi.advanceTimersByTimeAsync(1000);

    await promise;

    expect(mockedLogSWUpdate).toHaveBeenCalledWith('SW_UPDATE_CHECK_FAILED', {
      error: 'Error: Network error',
    });
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('NUCLEAR_FALLBACK');
    expect(mockLocation.replace).toHaveBeenCalledTimes(1);
  });

  it('should catch unexpected errors and fall back to nuclear', async () => {
    swContainer = mockServiceWorker({ controller: null, registration: null });
    swContainer.getRegistration = vi.fn().mockRejectedValue(new Error('IDB error'));

    const promise = clearCacheAndUpdate();

    await vi.advanceTimersByTimeAsync(1000);

    await promise;

    expect(mockedLogSWUpdate).toHaveBeenCalledWith('FORCE_UPDATE_ERROR', {
      error: 'Error: IDB error',
    });
    expect(mockedLogSWUpdate).toHaveBeenCalledWith('NUCLEAR_FALLBACK');
    expect(mockLocation.replace).toHaveBeenCalledTimes(1);
  });

  it('should unregister all SWs and purge all caches in nuclear fallback', async () => {
    swContainer = mockServiceWorker({ controller: null, registration: null });
    swContainer.getRegistrations = vi
      .fn()
      .mockResolvedValue([
        { unregister: vi.fn().mockResolvedValue(true) },
        { unregister: vi.fn().mockResolvedValue(true) },
      ]);

    mockCaches.keys.mockResolvedValue(['workbox-precache', 'html-cache']);

    const promise = clearCacheAndUpdate();

    await vi.advanceTimersByTimeAsync(15000 + 1000);

    await promise;

    expect(swContainer.getRegistrations).toHaveBeenCalledTimes(1);
    expect(mockCaches.keys).toHaveBeenCalledTimes(1);
    expect(mockCaches.delete).toHaveBeenCalledWith('workbox-precache');
    expect(mockCaches.delete).toHaveBeenCalledWith('html-cache');
    expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('_cb='));
  });

  it('should append a cache-busting _cb param to the nuclear reload URL', async () => {
    swContainer = mockServiceWorker({ controller: null, registration: null });

    const promise = clearCacheAndUpdate();

    await vi.advanceTimersByTimeAsync(15000 + 1000);

    await promise;

    const reloadUrl = mockLocation.replace.mock.calls[0][0] as string;
    expect(reloadUrl).toMatch(/_cb=\d+$/);
  });
});
