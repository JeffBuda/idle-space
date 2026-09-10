// tests/e2e/onboarding-sequence.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { dismissIOSInstallBanner } from './screenshot-helpers';

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

const getGateTimeValue = async (page: Page): Promise<number | null> => {
  const gateTimeText = await page.getByTestId('gate-time').textContent();
  console.log('gate-time text:', gateTimeText);
  const match = gateTimeText?.match(/(\d+)s/);
  if (match) return parseInt(match[1], 10);
  if (gateTimeText?.includes('Ready!')) return 0;
  return null;
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
    await dismissIOSInstallBanner(page);
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

  test('launch from WELCOME shows Approaching screen with countdown timer', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Click Launch! to transition to SPACE_TRAVEL (Approaching)
    await dismissIOSInstallBanner(page);
    const launchBtn = page.getByTestId('launch-btn');
    await launchBtn.click();
    await page.waitForTimeout(2000);

    // Verify we're on the Approaching screen
    const screenTitle = page.getByTestId('screen-title');
    await expect(screenTitle).toContainText('Approaching');
    console.log('Screen title is:', await screenTitle.textContent());

    // Verify the gate progress bar is present in the DOM
    const gateProgress = page.getByTestId('gate-progress');
    console.log('gate-progress count:', await gateProgress.count());

    // Wait for the first 1-second tick to fire
    await page.waitForTimeout(2000);

    // The gate-progress should be visible once the gate is active
    await expect(gateProgress).toBeVisible();
    console.log('gate-progress is visible');

    // Verify the gate time is visible and counting down
    const gateTime = page.getByTestId('gate-time');
    await expect(gateTime).toBeVisible();

    const time1 = await getGateTimeValue(page);
    console.log('First gate time reading:', time1);

    await page.waitForTimeout(3000);

    const time2 = await getGateTimeValue(page);
    console.log('Second gate time reading:', time2);

    // Time should have decreased (counting down)
    expect(time1).not.toBeNull();
    expect(time2).not.toBeNull();
    expect(time2).toBeLessThan(time1!);
    console.log('Countdown timer is counting down correctly');
  });
});
