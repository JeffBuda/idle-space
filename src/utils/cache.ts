// src/utils/cache.ts
//
// PWA cache-invalidation utility for iOS Safari / standalone (Add-to-Home-
// Screen) instances. When a new build is deployed to GitHub Pages, iOS can
// aggressively keep the old Service Worker alive, causing the "Force UI
// Update" button to fail.
//
// ROOT CAUSE (iOS): The previous implementation used a "nuclear" approach —
// unregister the SW, purge all caches, then reload via location.replace()
// with a cache-busting param. On iOS Safari this fails because:
//
//   1. unregister() marks the SW for removal but it stays active as the
//      page's controller until the page unloads. The reload navigation is
//      intercepted by the still-active SW, which serves stale precached
//      assets.
//   2. iOS Safari CacheStorage is inconsistent — keys() may omit caches and
//      delete() may not take immediate effect.
//   3. In standalone PWA mode, iOS caches the app shell at the HTTP level,
//      making cache-busting query params unreliable.
//
// FIX: Use the standard Service Worker update lifecycle instead of
// unregistering the active SW:
//
//   1. registration.update() — force the browser to re-fetch the SW script
//   2. Wait for updatefound → new SW is installing
//   3. If registration.waiting exists → send { type: 'SKIP_WAITING' }
//      to prompt it to activate immediately
//   4. Wait for controllerchange → new SW has taken control
//   5. window.location.reload() — new SW serves freshly precached assets
//
// The nuclear fallback (unregister + purge + delayed reload) is kept as a
// last resort for when no SW is registered or the lifecycle approach times
// out.
//
// CRITICAL: IndexedDB (space_idle_db) is intentionally untouched — the
// player's saved game state lives there and must survive a cache refresh.
import { logSWUpdate } from '../logging/swUpdateLogger';

/** Timeout for waiting on SW update lifecycle events (iOS is slow). */
const SW_UPDATE_TIMEOUT_MS = 15_000;

/** Delay before nuclear-reload to let iOS process SW unregistration. */
const UNREGISTER_SETTLE_MS = 1_000;

/** Force a server fetch by appending a cache-busting query parameter. */
const buildCacheBustedUrl = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${Date.now()}`;
};

/**
 * Sends a SKIP_WAITING message to a waiting Service Worker, prompting it
 * to activate immediately instead of waiting for all clients to close.
 *
 * This is the de-facto standard message understood by Workbox's SW runtime.
 * It is a no-op when no SW is in the waiting state.
 */
const signalWaitingSW = (registration: ServiceWorkerRegistration): void => {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
};

/**
 * Returns a Promise that resolves when the Service Worker changes its
 * controller for the current page (controllerchange event), or resolves
 * (not rejects) after timeoutMs milliseconds so the caller can proceed.
 *
 * On iOS, controllerchange may fire immediately (if the new SW has
 * already activated) or may never fire (if the update failed).
 */
const waitForControllerChange = (timeoutMs: number): Promise<void> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve();
    }, timeoutMs);

    const onControllerChange = () => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  });
};

/**
 * Returns a Promise that resolves when the specified registration
 * acquires a new waiting Service Worker (updatefound event fires),
 * or resolves after timeoutMs if no updatefound event fires.
 */
const waitForSWUpdate = (
  registration: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<void> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve();
    }, timeoutMs);

    const onUpdateFound = () => {
      clearTimeout(timer);
      registration.removeEventListener('updatefound', onUpdateFound);
      resolve();
    };

    registration.addEventListener('updatefound', onUpdateFound);
  });
};

/**
 * Purges every CacheStorage entry for the current origin.
 *
 * This targets the HTTP-level Cache API only (HTML, JS, CSS, image payloads
 * that Workbox/caches APIs stored). It does NOT touch IndexedDB or
 * localStorage/sessionStorage.
 */
const purgeCacheStorage = async (): Promise<void> => {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  for (const key of keys) {
    await caches.delete(key);
  }
};

/**
 * Unregisters all active Service Workers for the current origin.
 *
 * After calling this, the page is no longer under SW control (pending a
 * navigation) and all network requests fall through to the browser's
 * normal fetch path.
 */
const unregisterServiceWorkers = async (): Promise<void> => {
  if (!navigator.serviceWorker) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
};

/**
 * Attempts to force a Service Worker update via the standard update
 * lifecycle (update → SKIP_WAITING → controllerchange).
 *
 * Returns true if the SW successfully changed controllers (a reload
 * is then safe). Returns false if no SW is registered, the lifecycle
 * approach times out, or the active SW is already up to date.
 */
const trySWUpdateLifecycle = async (): Promise<boolean> => {
  if (!navigator.serviceWorker) {
    logSWUpdate('NO_SW_SUPPORT');
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    logSWUpdate('NO_SW_REGISTRATION');
    return false;
  }

  logSWUpdate('SW_UPDATE_CHECK');
  try {
    await registration.update();
  } catch (err) {
    logSWUpdate('SW_UPDATE_CHECK_FAILED', { error: String(err) });
    return false;
  }

  // Wait for the browser to find (and start installing) a new SW version.
  await waitForSWUpdate(registration, SW_UPDATE_TIMEOUT_MS);

  // Check for a waiting SW — may exist immediately or after updatefound.
  if (registration.waiting) {
    logSWUpdate('SW_WAITING');
    signalWaitingSW(registration);
    logSWUpdate('SKIP_WAITING_SENT');
  } else {
    // Give the newly-installing SW a brief window to enter the waiting
    // phase (updatefound may have just fired).
    await new Promise((r) => setTimeout(r, 500));
    if (registration.waiting) {
      logSWUpdate('SW_WAITING');
      signalWaitingSW(registration);
      logSWUpdate('SKIP_WAITING_SENT');
    }
  }

  if (registration.waiting) {
    // Waiting SW exists — we signaled it. Wait for controllerchange.
    logSWUpdate('SW_UPDATE_FOUND');
    await waitForControllerChange(SW_UPDATE_TIMEOUT_MS);
  } else {
    // No waiting SW — either no update found, or update found and
    // SW activated via skipWaiting in its install event.
    logSWUpdate('SW_ALREADY_CURRENT');
  }

  if (navigator.serviceWorker.controller) {
    logSWUpdate('CONTROLLER_CHANGED');
    logSWUpdate('SW_UPDATE_SUCCESS');
    return true;
  }

  logSWUpdate('SW_UPDATE_TIMEOUT');
  return false;
};

/**
 * Nuclear fallback: unregister all Service Workers, purge all caches,
 * wait for iOS to settle, then reload with a cache-busting URL.
 *
 * This is the old strategy — kept as a last resort for browsers/devices
 * where the SW update lifecycle does not fire controllerchange in time.
 */
const nuclearCacheClear = async (): Promise<void> => {
  logSWUpdate('NUCLEAR_FALLBACK');

  await unregisterServiceWorkers();
  logSWUpdate('SW_UNREGISTERED');

  await purgeCacheStorage();
  logSWUpdate('CACHES_PURGED');

  // On iOS, the SW remains the controller right up until the page
  // navigates. A short delay gives the browser time to process the
  // unregistration so the subsequent reload is not SW-intercepted.
  await new Promise((r) => setTimeout(r, UNREGISTER_SETTLE_MS));

  logSWUpdate('PAGE_RELOAD');
  window.location.replace(buildCacheBustedUrl(window.location.href));
};

/**
 * Clears the Service Worker cache while preserving IndexedDB game state,
 * then reloads the page so the latest deployed version takes effect.
 *
 * Strategy (in priority order):
 *
 *   Step 1 — SW update lifecycle (preferred):
 *     Force registration.update(), optionally message the waiting SW
 *     with { type: 'SKIP_WAITING' }, wait for controllerchange, then
 *     purge caches + reload. The new SW serves fresh precached assets.
 *
 *   Step 2 — Nuclear fallback:
 *     If no SW is registered or the lifecycle times out, unregister all
 *     SWs, purge all CacheStorage entries, wait briefly (iOS settle),
 *     then reload with a cache-busting URL.
 *
 * NOTE: space_idle_db (IndexedDB) is intentionally never cleared — the
 * player's saved game depends on it.
 */
export const clearCacheAndUpdate = async (): Promise<void> => {
  logSWUpdate('FORCE_UPDATE_INITIATED');

  try {
    const success = await trySWUpdateLifecycle();

    if (success) {
      // The new SW is now the controller. Purge old caches and reload.
      await purgeCacheStorage();
      logSWUpdate('CACHES_PURGED');
      logSWUpdate('PAGE_RELOAD');
      window.location.reload();
    } else {
      // Lifecycle approach failed — fall back to the nuclear strategy.
      await nuclearCacheClear();
    }
  } catch (err) {
    logSWUpdate('FORCE_UPDATE_ERROR', { error: String(err) });
    // Last-resort: try nuclear approach even if the lifecycle threw.
    await nuclearCacheClear();
  }
};
