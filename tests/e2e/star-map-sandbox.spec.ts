// tests/e2e/star-map-sandbox.spec.ts
//
// E2E tests for the MockStarMap UI sandbox.
//
// These tests verify:
//   - The star map sandbox button appears in the SettingsMenu
//   - Clicking it opens the MockStarMap overlay
//   - The back button closes the overlay
//   - All four star map nodes render with proper disabled state for Sol
//   - Clicking a destination node transitions the bottom sheet from
//     State 1 (15%) -> State 2 (30%) -> State 3 (50%)
//   - Screenshots are captured at each state for visual regression review
//
// The star map is a pure UI sandbox -- it does not read or write IndexedDB.
// However, the app itself loads game state from IndexedDB on startup, so
// we clear the DB in beforeEach for consistent initial state.
import { test, expect, type Page } from '@playwright/test';
import { captureScreenshot } from './screenshot-helpers';

// Viewport size per E2E test conventions (iPhone 12 resolution)
test.use({ viewport: { width: 390, height: 844 } });

/** Clears IndexedDB to isolate each test's state. */
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
      /* best-effort cleanup */
    }
  });
};

/** Opens the Star Map UI Sandbox overlay from the SettingsMenu. */
const openStarMapSandbox = async (page: Page) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="settings-gear"]', {
    timeout: 10000,
  });
  console.log('App loaded, opening settings menu');

  await page.getByTestId('settings-gear').click();
  await expect(page.getByTestId('settings-card')).toBeVisible();
  console.log('Settings card opened');

  await page.getByTestId('star-map-sandbox').click();
  await expect(page.getByTestId('mock-star-map')).toBeVisible();
  console.log('Star Map sandbox overlay opened');
};

// ---------------------------------------------------------------------------
// Basic UI tests (no IDB mutation - can run in parallel)
// ---------------------------------------------------------------------------
test('star map sandbox button is visible in settings menu', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="settings-gear"]', {
    timeout: 10000,
  });

  await page.getByTestId('settings-gear').click();
  await expect(page.getByTestId('settings-card')).toBeVisible();

  const sandboxBtn = page.getByTestId('star-map-sandbox');
  await expect(sandboxBtn).toBeVisible();
  await expect(sandboxBtn).toHaveText('Test Star Map UI (Sandbox)');
  console.log('Star Map sandbox button is visible with correct label');
});

test('back button closes the star map overlay', async ({ page }) => {
  await openStarMapSandbox(page);

  const backBtn = page.getByTestId('star-map-back-btn');
  await expect(backBtn).toBeVisible();
  await expect(backBtn).toHaveAttribute('aria-label', 'Back to Settings');

  await backBtn.click();
  await expect(page.getByTestId('mock-star-map')).toHaveCount(0);
  console.log('Star Map overlay closed after clicking back button');
});

test('star map renders the title and SVG canvas', async ({ page }) => {
  await openStarMapSandbox(page);

  await expect(page.getByTestId('star-map-title')).toHaveText('Star Map UI Sandbox');
  console.log('Star map title is visible');

  const svg = page.getByTestId('star-map-svg');
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
  console.log('SVG canvas with viewBox 0 0 100 100 is rendered');
});

test('renders all four star map nodes with Sol disabled', async ({ page }) => {
  await openStarMapSandbox(page);

  const solNode = page.getByTestId('star-map-node-sol');
  const sysA = page.getByTestId('star-map-node-sysA');
  const sysB = page.getByTestId('star-map-node-sysB');
  const sysC = page.getByTestId('star-map-node-sysC');

  await expect(solNode).toBeVisible();
  await expect(sysA).toBeVisible();
  await expect(sysB).toBeVisible();
  await expect(sysC).toBeVisible();

  // Sol is the current location and must be disabled
  await expect(solNode).toBeDisabled();
  console.log('All 4 nodes rendered; Sol node is disabled (current location)');
});

test('node labels are visible for all systems', async ({ page }) => {
  await openStarMapSandbox(page);

  await expect(page.getByTestId('star-map-label-sol')).toHaveText('Sol System');
  await expect(page.getByTestId('star-map-label-sysA')).toHaveText('System A');
  await expect(page.getByTestId('star-map-label-sysB')).toHaveText('System B');
  await expect(page.getByTestId('star-map-label-sysC')).toHaveText('System C');
  console.log('All node labels rendered with correct names');
});

// ---------------------------------------------------------------------------
// Interactive state flow tests (modify local component state - serial)
// ---------------------------------------------------------------------------
test.describe.serial('star map state transitions', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDB(page);
    await openStarMapSandbox(page);
  });

  test('starts in State 1: empty route, 15% sheet, default content', async ({ page }) => {
    const sheet = page.getByTestId('star-map-bottom-sheet');
    await expect(sheet).toHaveClass(/mock-star-map__sheet--15/);
    console.log('Sheet starts at 15% height (State 1)');

    await expect(page.getByTestId('sheet-default-content')).toBeVisible();
    await expect(page.getByTestId('sheet-single-content')).toHaveCount(0);
    await expect(page.getByTestId('sheet-multi-content')).toHaveCount(0);

    await expect(page.getByTestId('current-location')).toHaveText('Sol System');
    console.log('Default content shows Sol System as current location');
  });

  test('State 2: clicking a destination transitions to 30% sheet', async ({ page }) => {
    await page.getByTestId('star-map-node-sysA').click();

    const sheet = page.getByTestId('star-map-bottom-sheet');
    await expect(sheet).toHaveClass(/mock-star-map__sheet--30/);
    console.log('Sheet transitioned to 30% height (State 2)');

    await expect(page.getByTestId('sheet-single-content')).toBeVisible();
    await expect(page.getByTestId('destination-1')).toHaveText('System A');
    await expect(page.getByTestId('travel-time-1')).toHaveText('4h 12m');
    console.log('Destination is System A with travel time 4h 12m');

    // Active route path should be rendered in the SVG
    const svg = page.getByTestId('star-map-svg');
    const paths = await svg.locator('path').all();
    const lastPath = paths[paths.length - 1];
    expect(await lastPath.getAttribute('class')).toContain('mock-star-map__route-path');
    console.log('Active route path rendered in SVG after node selection');
  });

  test('State 3: clicking a second destination transitions to 50% sheet', async ({ page }) => {
    await page.getByTestId('star-map-node-sysA').click();
    await page.getByTestId('star-map-node-sysB').click();

    const sheet = page.getByTestId('star-map-bottom-sheet');
    await expect(sheet).toHaveClass(/mock-star-map__sheet--50/);
    console.log('Sheet transitioned to 50% height (State 3)');

    await expect(page.getByTestId('sheet-multi-content')).toBeVisible();

    // Itinerary should list both stops
    await expect(page.getByTestId('itinerary-stop-sysA')).toBeVisible();
    await expect(page.getByTestId('itinerary-stop-sysB')).toBeVisible();
    console.log('Itinerary lists both stops (sysA, sysB)');

    // Total travel time should be sum of segments
    const total = page.getByTestId('total-travel-time');
    await expect(total).toBeVisible();
    const totalText = await total.textContent();
    console.log('Total travel time displayed:', totalText);
  });

  test('toggling a node off removes it from the route', async ({ page }) => {
    await page.getByTestId('star-map-node-sysA').click();
    await expect(page.getByTestId('sheet-single-content')).toBeVisible();

    // Click the same node again to deselect
    await page.getByTestId('star-map-node-sysA').click();
    await expect(page.getByTestId('sheet-default-content')).toBeVisible();
    console.log('Node toggled off - returned to State 1 (default content)');
  });

  test('clearing the route returns to State 1', async ({ page }) => {
    await page.getByTestId('star-map-node-sysA').click();
    await page.getByTestId('star-map-node-sysB').click();

    // Clear route via the bottom sheet button
    await page.getByTestId('clear-route-btn').click();

    await expect(page.getByTestId('sheet-default-content')).toBeVisible();
    console.log('Route cleared via Clear Route button - back to State 1');
  });

  test('per-stop remove button removes a single stop from itinerary', async ({ page }) => {
    // Build a 3-stop route so removing one still leaves >= 2 stops (State 3)
    await page.getByTestId('star-map-node-sysA').click();
    await page.getByTestId('star-map-node-sysB').click();
    await page.getByTestId('star-map-node-sysC').click();

    // Verify State 3 with 3 stops
    await expect(page.getByTestId('sheet-multi-content')).toBeVisible();
    await expect(page.getByTestId('itinerary-stop-sysA')).toBeVisible();
    await expect(page.getByTestId('itinerary-stop-sysB')).toBeVisible();
    await expect(page.getByTestId('itinerary-stop-sysC')).toBeVisible();
    console.log('State 3 with 3 stops (sysA, sysB, sysC)');

    // Remove sysA from the itinerary
    await page.getByTestId('remove-stop-sysA').click();

    // sysA should be gone, sysB and sysC should remain
    expect(await page.getByTestId('itinerary-stop-sysA').count()).toBe(0);
    await expect(page.getByTestId('itinerary-stop-sysB')).toBeVisible();
    await expect(page.getByTestId('itinerary-stop-sysC')).toBeVisible();
    console.log('Removed sysA from itinerary - sysB and sysC remain');
  });

  test('screenshot: State 1 (default exploration)', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, 'star-map-state-1-default', 1);
    console.log('Captured screenshot: star-map-state-1');
  });

  test('screenshot: State 2 (single destination)', async ({ page }, testInfo) => {
    await page.getByTestId('star-map-node-sysA').click();
    await captureScreenshot(page, testInfo, 'star-map-state-2-single-stop', 2);
    console.log('Captured screenshot: star-map-state-2');
  });

  test('screenshot: State 3 (multi-stop itinerary)', async ({ page }, testInfo) => {
    await page.getByTestId('star-map-node-sysA').click();
    await page.getByTestId('star-map-node-sysB').click();
    await captureScreenshot(page, testInfo, 'star-map-state-3-itinerary', 3);
    console.log('Captured screenshot: star-map-state-3');
  });
});
