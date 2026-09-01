import { test, expect, type Page } from '@playwright/test';

/** Minimal snapshot of persisted game state read from IndexedDB. */
interface GameStateSnapshot {
  elapsedSeconds: number;
  [key: string]: unknown;
}

test.use({ viewport: { width: 390, height: 844 } });

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

async function setGameTimestamp(page: Page, msAgo: number): Promise<void> {
  await page.evaluate(async (offset) => {
    if (!('indexedDB' in window)) return;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('space_idle_db');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(['game_state'], 'readwrite');
    const store = tx.objectStore('game_state');
    const existing = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const getReq = store.get('game_state');
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    });
    if (existing) {
      await store.put({ ...existing, lastTimestamp: Date.now() - offset }, 'game_state');
    }
    db.close();
  }, msAgo);
}

// ---------------------------------------------------------------------------
// Helper: open the menu-gated App Status overlay so status widgets
// (travel time, distance) are visible in the DOM.
// ---------------------------------------------------------------------------
const openAppStatus = async (page: Page) => {
  await page.getByTestId('settings-gear').click();
  await page.getByTestId('toggle-app-status').click();
};

test.describe.serial('Game State Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and ensure game state loads
    await page.goto('/');
    await openAppStatus(page);
    await expect(page.getByTestId('total-travel-time')).toBeVisible();

    // Clear game state from IndexedDB to ensure test isolation
    await page.evaluate(async () => {
      if (!('indexedDB' in window)) return;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('space_idle_db');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(['game_state'], 'readwrite');
      const store = tx.objectStore('game_state');
      await new Promise<void>((resolve, reject) => {
        const delReq = store.delete('game_state');
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(delReq.error);
      });
      db.close();
    });

    // Reload to create fresh game state
    await page.reload();
    await openAppStatus(page);
    await expect(page.getByTestId('total-travel-time')).toBeVisible();
  });

  test('Test 5 (Offline Greeting): greeting appears after 2+ minutes idle', async ({ page }) => {
    // beforeEach created fresh game state; now simulate 2 min idle
    await setGameTimestamp(page, 120000);
    await page.reload();

    // Wait for the offline greeting to appear
    await expect(page.getByTestId('offline-greeting')).toBeVisible();

    // Verify the displayed offline time shows ~2 minutes
    const offlineTime = await page.$eval(
      '[data-testid="offline-time-display"]',
      (el) => el.textContent,
    );
    console.log('Offline time displayed:', offlineTime);
    expect(offlineTime).toMatch(/2m/);

    // Verify the greeting title text
    await expect(page.getByText('Welcome Back, Explorer!')).toBeVisible();
  });

  test('Test 6 (Offline Greeting Dismiss): dismissing the modal hides it', async ({ page }) => {
    // beforeEach created fresh game state; now simulate 2 min idle
    await setGameTimestamp(page, 120000);
    await page.reload();

    // Verify the offline greeting is visible
    await expect(page.getByTestId('offline-greeting')).toBeVisible();

    // Click the Dismiss button
    await page.getByTestId('dismiss-offline-btn').click();

    // The modal should disappear
    await expect(page.getByTestId('offline-greeting')).not.toBeVisible();
  });

  test('Test 7 (Offline Greeting Collect Rewards): collecting rewards hides modal', async ({
    page,
  }) => {
    // beforeEach created fresh game state; now simulate 2 min idle
    await setGameTimestamp(page, 120000);
    await page.reload();

    // Verify the offline greeting is visible
    await expect(page.getByTestId('offline-greeting')).toBeVisible();

    // Click the Collect Rewards button
    await page.getByTestId('collect-rewards-btn').click();

    // The modal should disappear
    await expect(page.getByTestId('offline-greeting')).not.toBeVisible();

    // Verify game state was updated (elapsedSeconds should be > 0)
    const gameState = await getGameStateFromIDB(page);
    expect(gameState).not.toBeNull();
    expect((gameState as GameStateSnapshot).elapsedSeconds).toBeGreaterThan(0);
  });

  test('Test 8 (Real-Time Elapsed Time): travel time increments in real-time', async ({ page }) => {
    // beforeEach already created fresh game state and the page is loaded
    // Get initial travel time
    const initialTime = await page.$eval(
      '[data-testid="total-travel-time"]',
      (el) => el.textContent,
    );
    console.log('Initial time:', initialTime);

    // Wait 6 seconds for the real-time tick to fire
    await page.waitForTimeout(6000);

    // Check that time has incremented
    const updatedTime = await page.$eval(
      '[data-testid="total-travel-time"]',
      (el) => el.textContent,
    );
    console.log('Updated time after 6s:', updatedTime);

    // The time should have increased
    expect(updatedTime).not.toBe(initialTime);
  });
});
