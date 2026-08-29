import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: read the game_state payload from IndexedDB inside the browser.
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
// Helper: wait until navigator.serviceWorker.controller is truthy.
// ---------------------------------------------------------------------------
async function waitForServiceWorker(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForFunction(
    () => navigator.serviceWorker && navigator.serviceWorker.controller !== null,
    { timeout: timeoutMs }
  );
}

// ---------------------------------------------------------------------------
// Test 1 — UI Render: main header and status widgets exist in the DOM.
// ---------------------------------------------------------------------------
test('Test 1 (UI Render): main headers and status widgets exist', async ({
  page,
}) => {
  await page.goto('/');

  // Header
  await expect(
    page.getByRole('heading', { name: 'Space Exploration Idle PWA' })
  ).toBeVisible();

  // Status widgets
  await expect(page.getByText('Service Worker')).toBeVisible();
  await expect(page.getByText('IndexedDB')).toBeVisible();
  await expect(page.getByText('Install Ready')).toBeVisible();

  // Status values
  await expect(page.getByTestId('sw-status')).toBeVisible();
  await expect(page.getByTestId('db-status')).toBeVisible();
  await expect(page.getByTestId('install-status')).toBeVisible();

  // Wait for game state to load
  await expect(page.getByTestId('total-travel-time')).toBeVisible();
  await expect(page.getByTestId('total-distance')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — Service Worker Registration: SW becomes active within 10 seconds.
// ---------------------------------------------------------------------------
test('Test 2 (Service Worker Registration): controller becomes active within 10 seconds', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('total-travel-time')).toBeVisible();

  await waitForServiceWorker(page, 10000);

  const hasController = await page.evaluate(
    () => navigator.serviceWorker?.controller !== null
  );
  expect(hasController).toBe(true);
});

// ---------------------------------------------------------------------------
// Test 3 — IndexedDB Operations: data persists across a page reload.
// ---------------------------------------------------------------------------
test('Test 3 (IndexedDB Operations): state persists across reload', async ({
  page,
}) => {
  await page.goto('/');

  // Wait for game state to load
  await expect(page.getByTestId('total-travel-time')).toBeVisible();

  // Reload the page
  await page.reload();

  // Wait for game state to load again
  await expect(page.getByTestId('total-travel-time')).toBeVisible();

  // Verify game state still exists after reload
  const gameState = await getGameStateFromIDB(page);
  expect(gameState).not.toBeNull();
  expect(gameState).toHaveProperty('lastTimestamp');
  expect(gameState).toHaveProperty('elapsedSeconds');
  expect(gameState).toHaveProperty('rngSeed');
  expect(gameState).toHaveProperty('totalDistanceKm');
});

// ---------------------------------------------------------------------------
// Test 4 — Game State Creation: game_state is created on first load.
// ---------------------------------------------------------------------------
test('Test 4 (Game State Creation): game state is created and displayed', async ({
  page,
}) => {
  await page.goto('/');

  // Wait for game state to load
  await expect(page.getByTestId('total-travel-time')).toBeVisible();
  await expect(page.getByTestId('total-distance')).toBeVisible();

  // Verify game state was written to IndexedDB
  const gameState = await getGameStateFromIDB(page);
  expect(gameState).not.toBeNull();
  expect(gameState).toHaveProperty('lastTimestamp');
  expect(gameState).toHaveProperty('elapsedSeconds');
  expect(gameState).toHaveProperty('rngSeed');
  expect(gameState).toHaveProperty('totalDistanceKm');
});