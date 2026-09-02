import { test, expect, type Page } from '@playwright/test';
import { captureScreenshot } from './screenshot-helpers';

/**
 * Click a star map SVG node by dispatching the click event directly on the
 * underlying DOM element. SVG <g> elements are often intercepted by the SVG
 * container, so Playwright's .click() requires force:true which can be
 * unreliable across browsers. This helper is deterministic.
 */
const clickNode = async (page: Page, nodeId: string): Promise<void> => {
  const node = page.getByTestId(`node-${nodeId}`);
  await node.evaluate((el) => {
    el.dispatchEvent(
      new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      }),
    );
  });
};

test.describe('Star Map Flow', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const openStarMapViaWelcome = async (page: Page, testInfo?: any) => {
    await page.goto('/');
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    if (testInfo) await captureScreenshot(page, testInfo, 'welcome-screen', 1);
    await page.getByTestId('welcome-chart-course').click();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    // Dismiss iOS install banner if present (it covers bottom UI on small viewports)
    if (await page.getByTestId('ios-install-dismiss').isVisible()) {
      await page.getByTestId('ios-install-dismiss').click();
    }
    if (testInfo) await captureScreenshot(page, testInfo, 'star-map-empty', 2);
  };

  test('Welcome screen Chart Course navigates to star map', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await expect(page.getByTestId('star-map-title')).toHaveText('Stellar Cartography');
    await captureScreenshot(page, testInfo, 'star-map-title-visible', 3);
  });

  test('star map renders 10 nodes and zoom controls', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    for (let i = 0; i < 10; i++) {
      await expect(page.getByTestId(`node-sys_${i}`)).toBeVisible();
    }
    await expect(page.getByTestId('zoom-in')).toBeVisible();
    await expect(page.getByTestId('zoom-out')).toBeVisible();
    await expect(page.getByTestId('zoom-level')).toHaveText('100%');
    await captureScreenshot(page, testInfo, 'star-map-full-graph', 3);
  });

  test('clicking a non-current node adds it to the itinerary', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('itinerary-list')).toBeVisible();
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await expect(page.getByTestId('total-travel-time')).toBeVisible();
    await captureScreenshot(page, testInfo, 'single-stop-itinerary', 3);
  });

  test('clicking a planned node again removes it (toggle)', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await clickNode(page, 'sys_2');
    await expect(page.getByTestId('stop-name-sys_2')).toBeVisible();
    await clickNode(page, 'sys_2');
    await expect(page.getByTestId('route-empty')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-cleared-by-toggle', 3);
  });

  test('remove-stop button removes a specific itinerary stop', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await clickNode(page, 'sys_3');
    await clickNode(page, 'sys_4');
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(2);
    await captureScreenshot(page, testInfo, 'two-stop-itinerary', 3);
    await page.getByTestId('remove-stop-sys_3').click();
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(1);
    await captureScreenshot(page, testInfo, 'one-stop-after-remove', 4);
  });

  test('clear route button empties the itinerary', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await clickNode(page, 'sys_1');
    await clickNode(page, 'sys_2');
    await captureScreenshot(page, testInfo, 'multi-stop-before-clear', 3);
    await page.getByTestId('clear-route').click();
    await expect(page.getByTestId('route-empty')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-cleared-by-button', 4);
  });

  test('Go button with valid route navigates to space travel', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await clickNode(page, 'sys_1');
    await captureScreenshot(page, testInfo, 'route-ready-to-go', 2);
    await page.getByTestId('go-btn').click();
    await expect(page.getByTestId('space-travel-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'star-map-go-navigates-to-travel', 3);
  });

  test('zoom in/out changes zoom level display', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await page.getByTestId('zoom-in').click();
    const zoomText = await page.getByTestId('zoom-level').textContent();
    expect(parseInt(zoomText || '0')).toBeGreaterThan(100);
    await captureScreenshot(page, testInfo, 'zoomed-in', 3);
  });

  test('Back button returns to PLANET from star map', async ({ page }, testInfo) => {
    await openStarMapViaWelcome(page, testInfo);
    await page.getByTestId('back-btn').click();
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'back-to-planet', 3);
  });
});

test.describe.serial('Star Map IndexedDB Persistence', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map((db) => {
          if (db.name) {
            const req = indexedDB.deleteDatabase(db.name);
            return new Promise((resolve) => {
              req.onsuccess = () => resolve(true);
              req.onerror = () => resolve(true);
            });
          }
          return Promise.resolve(true);
        }),
      );
    });
  });

  test('star map state persists across page reloads', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('welcome-chart-course').click();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    if (await page.getByTestId('ios-install-dismiss').isVisible()) {
      await page.getByTestId('ios-install-dismiss').click();
    }
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-before-reload', 1);
    await page.reload();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-restored-after-reload', 2);
  });

  test('plotted route survives browser restart', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('welcome-chart-course').click();
    if (await page.getByTestId('ios-install-dismiss').isVisible()) {
      await page.getByTestId('ios-install-dismiss').click();
    }
    await clickNode(page, 'sys_2');
    await clickNode(page, 'sys_5');
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(2);
    await captureScreenshot(page, testInfo, 'multi-stop-before-restart', 1);
    await page.reload();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(2);
    await captureScreenshot(page, testInfo, 'multi-stop-restored', 2);
  });
});
