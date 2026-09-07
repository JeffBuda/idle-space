// tests/e2e/onboarding-sequence.spec.ts
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

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

const waitForAppReady = async (page: Page) => {
  await page.getByTestId('app-ready').waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1000);
};

test.describe.serial('Onboarding Sequence', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDB(page);
  });

  test('fresh install renders WELCOME screen with game UI', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('PAGE ERROR:', msg.text());
      }
    });

    await page.goto('/');
    await waitForAppReady(page);

    // Verify screen content renders
    const shell = page.getByTestId('game-screen-shell');
    await expect(shell).toBeVisible();
    console.log('game-screen-shell is visible');

    const screenTitle = await page.getByTestId('screen-title').textContent();
    console.log('Screen title:', screenTitle);

    // Verify Launch button exists (WELCOME screen)
    const launchBtn = page.getByTestId('launch-btn');
    await expect(launchBtn).toBeVisible();
    console.log('Launch button is visible on WELCOME screen');

    // Verify bottom drawer handle exists
    const drawerHandle = page.getByTestId('drawer-handle');
    await expect(drawerHandle).toBeVisible();
    console.log('Drawer handle is visible');

    // Verify star map content exists in the DOM (may be hidden until tab is active)
    const starMapContent = page.getByTestId('star-map-content');
    await expect(starMapContent).toHaveCount(1);
    console.log('Star Map content is present in DOM');

    // Verify Go button exists (in star map tab)
    const goBtn = page.getByTestId('go-btn');
    await expect(goBtn).toHaveCount(1);
    console.log('Go button is present in DOM');

    expect(errors).toEqual([]);
  });

  test('New Game flow: open drawer, click New Game, confirm modal, reset', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Open the drawer
    await page.getByTestId('drawer-handle').click();
    await page.waitForTimeout(500);

    // Click the App Status tab
    await page.getByTestId('drawer-tab-app-status').click();
    await page.waitForTimeout(500);

    // Verify New Game button is visible
    const newGameBtn = page.getByTestId('new-game');
    await expect(newGameBtn).toBeVisible();
    console.log('New Game button is visible in App Status tab');

    // Click New Game to open confirmation modal
    await newGameBtn.click();
    await page.waitForTimeout(500);

    const modalOverlay = page.getByTestId('new-game-confirm-modal');
    await expect(modalOverlay).toBeVisible();
    console.log('New Game confirmation modal is visible');

    // Click Start New Game
    await page.getByTestId('new-game-confirm').click();
    await page.waitForTimeout(2000);

    // Verify modal is dismissed
    expect(await page.getByTestId('new-game-confirm-modal').isVisible()).toBeFalsy();
    console.log('New Game confirmation modal is dismissed');

    // Verify we're back on the WELCOME screen with screen still rendering
    const shell = page.getByTestId('game-screen-shell');
    await expect(shell).toBeVisible();
    console.log('Game screen shell still visible after New Game');
  });
});
