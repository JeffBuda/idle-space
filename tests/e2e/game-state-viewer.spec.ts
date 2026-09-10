// tests/e2e/game-state-viewer.spec.ts
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { captureScreenshot, dismissIOSInstallBanner } from './screenshot-helpers';

/**
 * E2E tests for the game state viewer panel.
 *
 * These tests verify:
 *   - The game state viewer is initially hidden
 *   - Clicking the drawer handle opens the drawer panel
 *   - Clicking the "Game State" tab opens the game state viewer panel
 *   - The viewer displays game state as formatted JSON
 *   - The close button hides the viewer
 */

test.use({ viewport: { width: 390, height: 844 } });

test.describe.serial('game state viewer', () => {
  /** Clears IndexedDB game_state and keyval stores for test isolation. */
  const clearGameState = async (page: Page) => {
    await page.evaluate(async () => {
      if (!('indexedDB' in window)) return;
      try {
        await new Promise<void>((resolve) => {
          const request = indexedDB.open('space_idle_db');
          request.onsuccess = () => {
            const db = request.result;
            const storeNames = Array.from(db.objectStoreNames);
            if (!storeNames.includes('game_state') && !storeNames.includes('keyval')) {
              db.close();
              return resolve();
            }
            const tx = db.transaction(['game_state', 'keyval'], 'readwrite');
            if (storeNames.includes('game_state')) {
              tx.objectStore('game_state').clear();
            }
            if (storeNames.includes('keyval')) {
              tx.objectStore('keyval').clear();
            }
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => resolve();
          };
          request.onerror = () => resolve();
        });
      } catch {
        /* best-effort cleanup — IndexedDB may be unavailable in CI */
      }
    });
  };

  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
  });

  test('game state viewer is hidden by default', async ({ page }, testInfo: TestInfo) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissIOSInstallBanner(page);
    console.log('Page loaded, checking viewer is hidden by default');
    await expect(page.getByTestId('game-state-viewer')).toHaveCount(0);
    console.log('Game state viewer is not present — correct');
    await captureScreenshot(page, testInfo, 'game-state-hidden-default', 1);
  });

  test('clicking "View Game State" opens the game state viewer', async ({
    page,
  }, testInfo: TestInfo) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissIOSInstallBanner(page);
    console.log('Page loaded, opening settings');

    await page.getByTestId('drawer-handle').click();
    await expect(page.getByTestId('drawer-panel')).toBeVisible();
    console.log('Drawer panel opened');
    await captureScreenshot(page, testInfo, 'drawer-opened', 1);

    await page.getByTestId('drawer-tab-game-state').click();
    console.log('Clicked Game State tab');

    await expect(page.getByTestId('game-state-viewer')).toBeVisible();
    console.log('Game state viewer is now visible');
    await captureScreenshot(page, testInfo, 'game-state-viewer-opened', 2);
  });

  test('game state viewer displays formatted JSON', async ({ page }, testInfo: TestInfo) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissIOSInstallBanner(page);

    await page.getByTestId('drawer-handle').click();
    await page.getByTestId('drawer-tab-game-state').click();

    const json = page.getByTestId('game-state-json');
    await expect(json).toBeVisible();
    console.log('Game state JSON element is visible');

    const content = await json.textContent();
    expect(content).toBeTruthy();
    expect(content).toContain('totalDistanceKm');
    console.log('Game state JSON contains expected keys');
    await captureScreenshot(page, testInfo, 'game-state-json-displayed', 1);
  });

  test('close button hides the game state viewer', async ({ page }, testInfo: TestInfo) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissIOSInstallBanner(page);

    await page.getByTestId('drawer-handle').click();
    await page.getByTestId('drawer-tab-game-state').click();

    await expect(page.getByTestId('game-state-viewer')).toBeVisible();
    console.log('Game state viewer opened');
    await captureScreenshot(page, testInfo, 'game-state-viewer-open', 1);

    await page.getByTestId('game-state-close').click();
    await expect(page.getByTestId('game-state-viewer')).toHaveCount(0);
    console.log('Game state viewer closed after clicking close button');
    await captureScreenshot(page, testInfo, 'game-state-viewer-closed', 2);
  });
});
