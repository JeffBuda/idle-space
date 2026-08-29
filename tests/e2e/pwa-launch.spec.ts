import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: read the app_status payload from IndexedDB inside the browser.
// ---------------------------------------------------------------------------
async function getAppStatusFromIDB(page: Page): Promise<unknown | null> {
  return page.evaluate(async () => {
    if (!('indexedDB' in window)) return null;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('space_idle_db');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const tx = db.transaction(['keyval'], 'readonly');
      const store = tx.objectStore('keyval');
      const value = await new Promise<unknown>((resolve, reject) => {
        const getReq = store.get('app_status');
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

  // Wait for game state to load (replaces old 'elapsed-time' test element)
  await expect(page.getByTestId('total-travel-time')).toBeVisible();
  await expect(page.getByTestId('total-distance')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — Service Worker Registration: SW becomes active within 10 seconds.
// Allows extra time for game state initialization via IndexedDB.
// ---------------------------------------------------------------------------
test('Test 2 (Service Worker Registration): controller becomes active within 10 seconds', async ({
  page,
}) => {
  await page.goto('/');

  // Wait for game state to finish loading before checking for SW controller
  // The useGameState hook initializes the loading state, which can delay SW readiness
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

  // Wait for the component to report "Connected"
  await expect(page.getByTestId('db-status')).toHaveText('Connected');

  // Verify the app_status payload was written to IndexedDB
  const statusBeforeReload = await getAppStatusFromIDB(page);
  expect(statusBeforeReload).not.toBeNull();
  expect(statusBeforeReload).toHaveProperty('version');

  // Reload the page
  await page.reload();

  // Wait for the component to reconnect to IndexedDB
  await expect(page.getByTestId('db-status')).toHaveText('Connected');

  // Assert that the same data still exists after reload
  const statusAfterReload = await getAppStatusFromIDB(page);
  expect(statusAfterReload).not.toBeNull();
  expect(statusAfterReload).toEqual(statusBeforeReload);
});
