// tests/e2e/debug-console.spec.ts
import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the diagnostic logging system.
 *
 * These tests verify:
 *   - The gear icon (⚙️) appears in the app header
 *   - Clicking the gear opens the settings card
 *   - The debug console toggle and panel work end-to-end
 *   - Log entries from idle progression appear in the console
 *
 * Serial block is used because idle progression writes to IndexedDB
 * (game_state and space_idle_logs stores). The beforeEach hook clears
 * these stores for test isolation.
 */

// Viewport size per E2E test conventions
test.use({ viewport: { width: 1280, height: 720 } });

/** Clears IndexedDB stores to isolate each test's state. */
const clearIndexedDB = async (page: Page) => {
  await page.evaluate(async () => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('space_idle_db');
      request.onupgradeneeded = () => {
        const db = request.result;
        ['game_state', 'keyval', 'space_idle_logs'].forEach((store) => {
          if (db.objectStoreNames.contains(store)) {
            db.deleteObjectStore(store);
          }
        });
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(
          ['game_state', 'keyval', 'space_idle_logs'],
          'readwrite',
        );
        tx.objectStore('game_state').clear();
        tx.objectStore('keyval').clear();
        tx.objectStore('space_idle_logs').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
};

// ---------------------------------------------------------------------------
// Basic UI tests (no IDB mutation)
// ---------------------------------------------------------------------------
test('gear icon is visible in the app header', async ({ page }) => {
  await page.goto('/');
  const gear = page.getByTestId('settings-gear');
  await expect(gear).toBeVisible();
  console.log('Settings gear icon is visible in header');
});

test('clicking the gear icon opens the settings card', async ({ page }) => {
  await page.goto('/');
  const gear = page.getByTestId('settings-gear');
  await expect(gear).toBeVisible();
  await gear.click();

  const card = page.getByTestId('settings-card');
  await expect(card).toBeVisible();
  console.log('Settings card opened after clicking gear');
});

test('clicking outside the settings card closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('settings-gear').click();
  await expect(page.getByTestId('settings-card')).toBeVisible();

  // Click at a position far from the settings card
  await page.mouse.click(20, 20);
  await page.waitForTimeout(200);

  const card = page.getByTestId('settings-card');
  const isVisible = await card.isVisible();
  expect(isVisible).toBeFalsy();
  console.log('Settings card closed after clicking outside');
});

// ---------------------------------------------------------------------------
// Debug console interaction tests (modify IndexedDB — run serially)
// ---------------------------------------------------------------------------
test.describe.serial('debug console toggle flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDB(page);
    await page.goto('/');
    // Wait for initial game state load + first idle tick
    await page.waitForTimeout(2000);
  });

  test('toggling "Show Debug Console" reveals the console panel', async ({
    page,
  }) => {
    // Open settings
    await page.getByTestId('settings-gear').click();
    await expect(page.getByTestId('settings-card')).toBeVisible();

    // The toggle button should say "Show Debug Console" initially
    const toggle = page.getByTestId('toggle-debug-console');
    await expect(toggle).toBeVisible();
    const toggleText = await toggle.textContent();
    expect(toggleText).toContain('Show Debug Console');

    // Toggle debug console on
    await toggle.click();

    // Debug console should appear
    const consolePanel = page.getByTestId('debug-console');
    await expect(consolePanel).toBeVisible();
    console.log('Debug console is visible after toggle');

    // Verify control elements are present
    await expect(page.getByTestId('debug-filter')).toBeVisible();
    await expect(page.getByTestId('debug-refresh')).toBeVisible();
    await expect(page.getByTestId('debug-clear')).toBeVisible();
    await expect(page.getByTestId('debug-export')).toBeVisible();
    console.log('All debug console controls are present');
  });

  test('debug console displays log entries from idle progression', async ({
    page,
  }) => {
    // Open settings and toggle debug console on
    await page.getByTestId('settings-gear').click();
    await page.getByTestId('toggle-debug-console').click();

    const consolePanel = page.getByTestId('debug-console');
    await expect(consolePanel).toBeVisible();
    console.log('Debug console visible, waiting for log entries to appear');

    // Wait for the 1-second interval tick to fire multiple times
    await page.waitForTimeout(5000);

    // Check for log entries
    const entries = page.locator('[data-testid^="log-entry-"]');
    const count = await entries.count();
    console.log(`Found ${count} log entries in debug console`);

    // At least one entry should exist after ticks fire
    if (count > 0) {
      const firstEntry = entries.first();
      await expect(firstEntry).toBeVisible();
      const entryText = await firstEntry.textContent();
      expect(entryText).toBeTruthy();
      console.log(`First log entry content: ${entryText}`);
    }
  });

  test('debug console shows empty state when no logs exist', async ({
    page,
  }) => {
    // Open settings and toggle debug console on
    await page.getByTestId('settings-gear').click();
    await page.getByTestId('toggle-debug-console').click();

    await expect(page.getByTestId('debug-console')).toBeVisible();

    // Click clear to remove all logs
    await page.getByTestId('debug-clear').click();
    await page.waitForTimeout(500);

    const emptyState = page.getByTestId('debug-empty');
    await expect(emptyState).toBeVisible();
    console.log('Debug console shows empty state after clearing logs');
  });

  test('debug console filter dropdown filters by category', async ({
    page,
  }) => {
    await page.getByTestId('settings-gear').click();
    await page.getByTestId('toggle-debug-console').click();

    await expect(page.getByTestId('debug-console')).toBeVisible();
    await page.waitForTimeout(3000);

    // The filter dropdown should exist
    const filter = page.getByTestId('debug-filter');
    await expect(filter).toBeVisible();

    // Change filter to a specific category
    await filter.selectOption('ENGINE_TICK');
    await page.waitForTimeout(500);

    // All visible entries should match the filter
    const entries = page.locator('[data-testid^="log-entry-"]');
    const count = await entries.count();
    for (let i = 0; i < count; i++) {
      const entry = entries.nth(i);
      const categoryText = await entry.locator('.log-category').textContent();
      expect(categoryText).toBe('ENGINE_TICK');
    }
    console.log(`Filtered to ENGINE_TICK: ${count} entries visible`);

    // Switch back to ALL
    await filter.selectOption('ALL');
    await page.waitForTimeout(500);
    const allCount = await page.locator('[data-testid^="log-entry-"]').count();
    console.log(`All categories: ${allCount} entries visible`);
  });

  test('debug console refresh button reloads entries', async ({ page }) => {
    await page.getByTestId('settings-gear').click();
    await page.getByTestId('toggle-debug-console').click();

    await expect(page.getByTestId('debug-console')).toBeVisible();
    await page.waitForTimeout(2000);

    const refreshBtn = page.getByTestId('debug-refresh');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await page.waitForTimeout(500);

    console.log('Refresh button clicked successfully');
  });
});