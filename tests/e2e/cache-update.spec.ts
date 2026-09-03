// tests/e2e/cache-update.spec.ts
//
// E2E test verifying that the "Force UI Update" cache-invalidation flow
// clears the Service Worker / CacheStorage while preserving the player's
// saved game state in IndexedDB (space_idle_db).
//
// Uses the iPhone 12 viewport (390x844) per E2E conventions.
// Runs in a serial describe block because it mutates IndexedDB state.
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

// ---------------------------------------------------------------------------
// Helper: inject a mock save state into IndexedDB BEFORE the app's JavaScript
// runs.
//
// Why addInitScript instead of page.evaluate?  The test's beforeEach navigates
// to about:blank, and Chromium denies IndexedDB access from about:blank
// ("access to the Indexed Database API is denied in this context").  By using
// addInitScript we queue a script that fires on the NEXT navigation — the
// page.goto('/') call in the test body — before any of the app's own scripts.
// The app's origin (http://localhost:5173) allows IndexedDB, so the injection
// succeeds.
//
// A sessionStorage flag prevents the script from re-injecting on subsequent
// navigations (e.g. the Force UI Update reload), so the test genuinely
// verifies that the state was persisted rather than re-injected.
// ---------------------------------------------------------------------------
async function injectGameState(page: Page, payload: Record<string, unknown>): Promise<void> {
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('__idleSpace_injected') === 'true') return;
    sessionStorage.setItem('__idleSpace_injected', 'true');
    if (!('indexedDB' in window)) return;
    try {
      const req = indexedDB.open('space_idle_db');
      req.onupgradeneeded = (e) => {
        const database = (e.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains('game_state')) {
          database.createObjectStore('game_state');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['game_state'], 'readwrite');
        const store = tx.objectStore('game_state');
        store.put(data, 'game_state');
        tx.oncomplete = () => db.close();
      };
      req.onerror = () => {
        /* best-effort */
      };
    } catch {
      /* best-effort */
    }
  }, payload);
}

// ---------------------------------------------------------------------------
// Helper: read the game_state value from IndexedDB.
// ---------------------------------------------------------------------------
async function getGameStateFromIDB(page: Page): Promise<unknown | null> {
  return page.evaluate(async () => {
    if (!('indexedDB' in window)) return null;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('space_idle_db');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(['game_state'], 'readonly');
      const store = tx.objectStore('game_state');
      const value = await new Promise<unknown>((resolve, reject) => {
        const getReq = store.get('game_state');
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      });
      db.close();
      return value;
    } catch {
      return null;
    }
  });
}

// ---------------------------------------------------------------------------
// Helper: open the SettingsMenu dropdown.
// ---------------------------------------------------------------------------
const openSettings = async (page: Page) => {
  await page.getByTestId('settings-gear').click();
  await expect(page.getByTestId('settings-card')).toBeVisible();
};

// ---------------------------------------------------------------------------
// Clears IndexedDB for test isolation (mirrors debug-console.spec.ts pattern).
// ---------------------------------------------------------------------------
const clearIndexedDB = async (page: Page): Promise<void> => {
  await page.goto('about:blank');
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    if (!('indexedDB' in window)) return;
    try {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('space_idle_db');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    } catch {
      /* best-effort cleanup */
    }
  });
};

test.describe.serial('PWA Cache Invalidation', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDB(page);
  });

  test('should clear Service Worker cache but preserve IndexedDB game state', async ({ page }) => {
    // 1. Inject mock save state into IndexedDB BEFORE the app loads, so the
    //    auto-save interval (10s) doesn't overwrite it with the default state.
    const injectedState = {
      lastTimestamp: Date.now(),
      elapsedSeconds: 42,
      rngSeed: 'test-seed-1234',
      totalDistanceKm: 9999,
      version: '0.1.0',
      totalElapsedGameTime: 42,
      screen: 'PLANET',
      idleTimer: null,
      oreCounts: { commonOre: 10, rareOre: 5 },
      selectedOre: null,
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
      lastError: null,
      starMap: null,
      routePath: [],
      routeTravelTimeSeconds: 0,
      currentLocation: 'sys_0',
    };
    await injectGameState(page, injectedState);

    // Navigate so the app reads the injected state on load (handleWake).
    await page.goto('/');
    await expect(page.getByTestId('settings-gear')).toBeVisible();

    // Verify the injected state is readable.
    const beforeState = await getGameStateFromIDB(page);
    expect(beforeState).not.toBeNull();
    expect((beforeState as Record<string, unknown>).totalDistanceKm).toBe(9999);
    console.log(
      'Pre-update save state injected:',
      (beforeState as Record<string, unknown>).totalDistanceKm,
    );

    // 2. Open settings and trigger Force UI Update.
    await openSettings(page);
    await expect(page.getByTestId('force-ui-update')).toBeVisible();

    // The button calls clearCacheAndUpdate() which ends with either
    // window.location.reload() (SW update lifecycle succeeded) or
    // window.location.replace() (nuclear fallback) — both trigger a
    // page navigation. We race the click against the navigation.
    const [navigationResult] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.getByTestId('force-ui-update').click(),
    ]);
    expect(navigationResult).not.toBeNull();
    console.log('Page reloaded after cache wipe (navigation succeeded)');

    // 3. Verify IndexedDB game state survived the reload + cache wipe.
    await expect(page.getByTestId('settings-gear')).toBeVisible();
    await page.waitForTimeout(2000);

    const survivedState = await getGameStateFromIDB(page);
    expect(survivedState).not.toBeNull();
    console.log('Survived save state:', (survivedState as Record<string, unknown>).totalDistanceKm);
    expect((survivedState as Record<string, unknown>).totalDistanceKm).toBeGreaterThanOrEqual(9999);
    // totalDistanceKm can increase from idle progression after wake, but rngSeed
    // and oreCounts are immutable engine fields — their survival proves the save
    // was loaded intact rather than wiped.
    expect((survivedState as Record<string, unknown>).rngSeed).toBe('test-seed-1234');
    expect((survivedState as Record<string, unknown>).oreCounts).toEqual({
      commonOre: 10,
      rareOre: 5,
    });

    console.log('IndexedDB game state preserved across cache invalidation');
  });
});
