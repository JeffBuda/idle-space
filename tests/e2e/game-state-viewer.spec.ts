// tests/e2e/game-state-viewer.spec.ts
import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the game state viewer panel.
 *
 * These tests verify:
 *   - The game state viewer is initially hidden
 *   - Clicking the settings gear opens the settings card
 *   - Clicking "View Game State" opens the game state viewer panel
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

  test('game state viewer is hidden by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    console.log('Page loaded, checking viewer is hidden by default');
    await expect(page.getByTestId('game-state-viewer')).toHaveCount(0);
    console.log('Game state viewer is not present \u2014 correct');
  });

  test('clicking "View Game State" opens the game state viewer', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    console.log('Page loaded, opening settings');

    await page.getByTestId('settings-gear').click();
    await expect(page.getByTestId('settings-card')).toBeVisible();
    console.log('Settings card opened');

    await page.getByTestId('toggle-game-state').click();
    console.log('Clicked "View Game State" toggle');

    await expect(page.getByTestId('game-state-viewer')).toBeVisible();
    console.log('Game state viewer is now visible');
  });

  test('game state viewer displays formatted JSON', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByTestId('settings-gear').click();
    await page.getByTestId('toggle-game-state').click();

    const json = page.getByTestId('game-state-json');
    await expect(json).toBeVisible();
    console.log('Game state JSON element is visible');

    const content = await json.textContent();
    expect(content).toBeTruthy();
    expect(content).toContain('totalDistanceKm');
    console.log('Game state JSON contains expected keys');
  });

  test('close button hides the game state viewer', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByTestId('settings-gear').click();
    await page.getByTestId('toggle-game-state').click();

    await expect(page.getByTestId('game-state-viewer')).toBeVisible();
    console.log('Game state viewer opened');

    await page.getByTestId('game-state-close').click();
    await expect(page.getByTestId('game-state-viewer')).toHaveCount(0);
    console.log('Game state viewer closed after clicking close button');
  });
});
