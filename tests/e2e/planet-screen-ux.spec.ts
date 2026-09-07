// tests/e2e/planet-screen-ux.spec.ts
//
// E2E tests verifying the PLANET (Planet Hub) screen action-bar buttons:
//   - "Land"         (testid: nav-landing,    variant: btn--primary)
//   - "Chart Course" (testid: nav-star-map,   variant: btn--primary)
//   - "Depart"       (testid: nav-space-travel, variant: btn--secondary)
//
// These are the buttons modified in ScreenContent.tsx to use btn--primary
// for primary actions (Land, Chart Course) and btn--secondary for the
// secondary action (Depart). The Depart button's testid was also unified
// to always be "nav-space-travel" regardless of route state.
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

// ── Helpers ────────────────────────────────────────────────────────────────

/** Clears IndexedDB to ensure a clean slate before the test. */
const clearIndexedDB = async (page: Page) => {
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
      /* best-effort */
    }
  });
};

/**
 * Injects a pre-made game-state record into IndexedDB BEFORE the app's
 * JavaScript runs. Uses addInitScript so the script fires on the next
 * navigation (page.goto('/')) before any app scripts execute.
 */
const injectGameState = async (page: Page, payload: Record<string, unknown>): Promise<void> => {
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
      req.onerror = () => {};
    } catch {
      /* best-effort */
    }
  }, payload);
};

/** Waits for the app's #app-ready signal element to appear in the DOM. */
const waitForAppReady = async (page: Page) => {
  await page.getByTestId('app-ready').waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1000); // allow one idle tick to settle
};

// ── Shared injected state: PLANET screen with a star map regen from seed ───
const PLANET_STATE = {
  lastTimestamp: Date.now(),
  elapsedSeconds: 0,
  rngSeed: 'test-seed',
  totalDistanceKm: 5000,
  version: '0.1.0',
  totalElapsedGameTime: 0,
  screen: 'PLANET',
  idleTimer: null,
  oreCounts: { commonOre: 10, rareOre: 5 },
  selectedOre: null,
  constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
  lastError: null,
  starMap: null, // regenerated from rngSeed on load
  routePath: [],
  routeTravelTimeSeconds: 0,
  currentLocation: 'sys_1',
};

test.describe.serial('PLANET screen action-bar UX', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDB(page);
  });

  test('app loads without runtime errors on PLANET screen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await injectGameState(page, PLANET_STATE);
    await page.goto('/');
    await waitForAppReady(page);

    expect(errors).toEqual([]);
    console.log('App loaded without runtime errors on PLANET screen');
  });

  test('Land and Chart Course buttons use btn--primary variant', async ({ page }) => {
    await injectGameState(page, PLANET_STATE);
    await page.goto('/');
    await waitForAppReady(page);

    const landBtn = page.getByTestId('nav-landing');
    await expect(landBtn).toBeVisible();
    await expect(landBtn).toHaveClass(/btn--primary/);
    await expect(landBtn).toHaveText('Land');
    console.log('Land button has btn--primary variant');

    const chartCourseBtn = page.getByTestId('nav-star-map');
    await expect(chartCourseBtn).toBeVisible();
    await expect(chartCourseBtn).toHaveClass(/btn--primary/);
    await expect(chartCourseBtn).toHaveText('Chart Course');
    console.log('Chart Course button has btn--primary variant');
  });

  test('Depart button uses nav-space-travel testid with btn--secondary variant', async ({
    page,
  }) => {
    await injectGameState(page, PLANET_STATE);
    await page.goto('/');
    await waitForAppReady(page);

    const departBtn = page.getByTestId('nav-space-travel');
    await expect(departBtn).toBeVisible();
    await expect(departBtn).toHaveClass(/btn--secondary/);
    await expect(departBtn).toHaveText('Depart');
    console.log('Depart button has btn--secondary variant and nav-space-travel testid');
  });

  test('Planet screen title shows Orbiting', async ({ page }) => {
    await injectGameState(page, PLANET_STATE);
    await page.goto('/');
    await waitForAppReady(page);

    const titleEl = page.getByTestId('screen-title');
    await expect(titleEl).toBeVisible();
    await expect(titleEl).toHaveText(/Orbiting/i);
    console.log(`Planet screen title: "${await titleEl.textContent()}"`);
  });
});
