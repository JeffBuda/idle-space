// src/utils/cache.ts
//
// PWA cache-invalidation utility for iOS Safari / standalone (Add-to-Home-
// Screen) instances. When a new build is deployed to GitHub Pages, iOS can
// aggressively keep the old Service Worker alive. This utility forces a
// fresh fetch of `index.html` (and therefore the newly-hashed asset manifest)
// by unregistering every Service Worker, deleting every CacheStorage entry,
// and performing a cache-busting hard reload.
//
// CRITICAL: IndexedDB (`space_idle_db`) is intentionally untouched — the
// player's saved game state lives there and must survive a cache refresh.

/** Force a server fetch by appending a cache-busting query parameter. */
const buildCacheBustedUrl = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${Date.now()}`;
};

/**
 * Unregisters all active Service Workers for the current origin.
 *
 * After calling this, the page is no longer under SW control and all
 * network requests fall through to the browser's normal fetch path.
 */
const unregisterServiceWorkers = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
};

/**
 * Purges every CacheStorage entry for the current origin.
 *
 * This targets the HTTP-level Cache API only (HTML, JS, CSS, image payloads
 * that Workbox/caches APIs stored). It does NOT touch IndexedDB or
 * localStorage/ sessionStorage.
 */
const purgeCacheStorage = async (): Promise<void> => {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  for (const key of keys) {
    await caches.delete(key);
  }
};

/**
 * Clears the Service Worker cache while preserving IndexedDB game state,
 * then force-reloads the page from the server.
 *
 * Steps:
 *   1. Unregister every active Service Worker.
 *   2. Delete every CacheStorage cache (precached HTML / JS / CSS assets).
 *   3. Perform a cache-busting reload so `index.html` is fetched fresh,
 *      pulling in the newly-hashed asset references from the latest deploy.
 *
 * NOTE: `space_idle_db` (IndexedDB) is intentionally never cleared — the
 * player's saved game depends on it.
 */
export const clearCacheAndUpdate = async (): Promise<void> => {
  await unregisterServiceWorkers();
  await purgeCacheStorage();

  // Force a hard reload that bypasses the HTTP cache. We use a cache-busting
  // query parameter (rather than the deprecated `location.reload(true)`)
  // so that iOS Safari is guaranteed to re-fetch `index.html` from GitHub
  // Pages, which in turn references the newly-hashed JS/CSS bundles.
  // Using `replace` (instead of `assign`/`href`) avoids polluting the
  // browser history with a redundant cache-bust entry.
  window.location.replace(buildCacheBustedUrl(window.location.href));
};
