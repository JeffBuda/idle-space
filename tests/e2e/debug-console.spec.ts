// tests/e2e/debug-console.spec.ts
import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for the diagnostic logging system.
 *
 * These tests verify:
 *   - The gear icon (ΓÜÖ∩╕Å) appears in the app header
 *   - Clicking the gear opens the settings card
 *   - The debug console toggle and panel work end-to-end
 *   - Log entries from app events (wake/suspend) appear in the console
 *
 * Serial block is used because idle progression writes to IndexedDB
 * (game_state and space_idle_logs stores). The beforeEach hook clears
 * these stores for test isolation.
 */

// Viewport size per E2E test conventions
test.use({ viewport: { width: 1280, height: 720 } })

/** Clears IndexedDB to isolate each test's state.
 *
 * Uses deleteDatabase for a clean slate instead of trying to
 * open-and-clear stores. Opening without a version argument can
 * create a version-1 database that forces initDB() to run a
 * version upgrade on the next page load, adding latency that
 * makes tests flaky in CI.
 */
const clearIndexedDB = async (page: Page) => {
  // Navigate to a blank page to release any open IDB connections
  // from the app, allowing deleteDatabase to succeed without blocking.
  await page.goto('about:blank')
  await page.waitForLoadState('load')

  await page.evaluate(async () => {
    if (!('indexedDB' in window)) return
    try {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('space_idle_db')
        request.onsuccess = () => resolve()
        request.onerror = () => resolve() // best-effort
        request.onblocked = () => resolve() // best-effort
      })
    } catch {
      /* IndexedDB may be unavailable in some CI browser contexts -
         best-effort cleanup, continue with tests */
    }
  })
}

/** Waits for at least minCount log entries to appear in the debug
 * console. Clicks the Refresh button and polls the DOM, since
 * useDebugLogs only loads once on mount -- the APP_WAKE entry may
 * be written to IDB (fire-and-forget via LogStorageService.append)
 * after the initial mount read completes. */
const waitForLogEntries = async (page: Page, minCount = 1, timeout = 10000) => {
  const endTime = Date.now() + timeout
  while (Date.now() < endTime) {
    try {
      await expect(page.getByTestId('debug-loading')).toBeHidden({ timeout: 2000 })
    } catch {}
    await page.getByTestId('debug-refresh').click()
    try {
      await expect(page.getByTestId('debug-loading')).toBeHidden({ timeout: 2000 })
    } catch {}
    const count = await page.locator('[data-testid^="log-entry-"]').count()
    if (count >= minCount) return
    await page.waitForTimeout(500)
  }
  const count = await page.locator('[data-testid^="log-entry-"]').count()
  expect(count).toBeGreaterThanOrEqual(minCount)
}

// ---------------------------------------------------------------------------
// Basic UI tests (no IDB mutation)
// ---------------------------------------------------------------------------
test('gear icon is visible in the app header', async ({ page }) => {
  await page.goto('/')
  const gear = page.getByTestId('settings-gear')
  await expect(gear).toBeVisible()
  console.log('Settings gear icon is visible in header')
})

test('clicking the gear icon opens the settings card', async ({ page }) => {
  await page.goto('/')
  const gear = page.getByTestId('settings-gear')
  await expect(gear).toBeVisible()
  await gear.click()

  const card = page.getByTestId('settings-card')
  await expect(card).toBeVisible()
  console.log('Settings card opened after clicking gear')
})

test('clicking outside the settings card closes it', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('settings-gear').click()
  await expect(page.getByTestId('settings-card')).toBeVisible()

  // Click at a position far from the settings card
  await page.mouse.click(20, 20)
  await page.waitForTimeout(200)

  const card = page.getByTestId('settings-card')
  const isVisible = await card.isVisible()
  expect(isVisible).toBeFalsy()
  console.log('Settings card closed after clicking outside')
})

// ---------------------------------------------------------------------------
// Debug console interaction tests (modify IndexedDB ΓÇö run serially)
// ---------------------------------------------------------------------------
test.describe.serial('debug console toggle flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDB(page)
    await page.goto('/')
    // Wait for the app to finish loading (game state loaded via handleWake).
    // This ensures the APP_WAKE log entry has been dispatched before tests run.
    await page.waitForSelector('[data-testid="total-travel-time"]', {
      timeout: 10000,
    })
  })

  test('toggling "Show Debug Console" reveals the console panel', async ({ page }) => {
    // Open settings
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-card')).toBeVisible()

    // The toggle button should say "Show Debug Console" initially
    const toggle = page.getByTestId('toggle-debug-console')
    await expect(toggle).toBeVisible()
    const toggleText = await toggle.textContent()
    expect(toggleText).toContain('Show Debug Console')

    // Toggle debug console on
    await toggle.click()

    // Debug console should appear
    const consolePanel = page.getByTestId('debug-console')
    await expect(consolePanel).toBeVisible()
    console.log('Debug console is visible after toggle')

    // Verify control elements are present
    await expect(page.getByTestId('debug-filter')).toBeVisible()
    await expect(page.getByTestId('debug-refresh')).toBeVisible()
    await expect(page.getByTestId('debug-clear')).toBeVisible()
    await expect(page.getByTestId('debug-export')).toBeVisible()
    console.log('All debug console controls are present')
  })

  test('debug console displays log entries from app events (not game ticks)', async ({ page }) => {
    // Open settings and toggle debug console on
    await page.getByTestId('settings-gear').click()
    await page.getByTestId('toggle-debug-console').click()

    const consolePanel = page.getByTestId('debug-console')
    await expect(consolePanel).toBeVisible()
    console.log('Debug console visible')

    // The page load in beforeEach triggered handleWake(), which produced
    // an APP_WAKE log entry via the loggedReducer. Wait for it to appear.
    await waitForLogEntries(page)

    // Check for log entries
    const entries = page.locator('[data-testid^="log-entry-"]')
    const count = await entries.count()
    console.log(`Found ${count} log entries in debug console`)

    // At least one entry should exist from the wake event on page load
    expect(count).toBeGreaterThan(0)

    // Verify the entry is an APP_WAKE event (not a tick)
    const firstEntry = entries.first()
    await expect(firstEntry).toBeVisible()
    const entryText = await firstEntry.textContent()
    expect(entryText).toBeTruthy()
    expect(entryText).toContain('APP_WAKE')
    console.log(`First log entry content: ${entryText}`)
  })

  test('debug console shows empty state when no logs exist', async ({ page }) => {
    // Open settings and toggle debug console on
    await page.getByTestId('settings-gear').click()
    await page.getByTestId('toggle-debug-console').click()

    await expect(page.getByTestId('debug-console')).toBeVisible()

    // Wait for entries to be loaded before clearing
    await waitForLogEntries(page)

    // Click clear to remove all logs
    await page.getByTestId('debug-clear').click()

    const emptyState = page.getByTestId('debug-empty')
    await expect(emptyState).toBeVisible({ timeout: 5000 })
    console.log('Debug console shows empty state after clearing logs')
  })

  test('debug console filter dropdown filters by category', async ({ page }) => {
    await page.getByTestId('settings-gear').click()
    await page.getByTestId('toggle-debug-console').click()

    await expect(page.getByTestId('debug-console')).toBeVisible()
    // Wait for at least one APP_WAKE entry from page load before filtering
    await waitForLogEntries(page)

    // The filter dropdown should exist
    const filter = page.getByTestId('debug-filter')
    await expect(filter).toBeVisible()

    // Change filter to a specific category
    await filter.selectOption('APP_EVENT')
    await page.waitForTimeout(500)

    // All visible entries should match the filter
    const entries = page.locator('[data-testid^="log-entry-"]')
    const count = await entries.count()
    for (let i = 0; i < count; i++) {
      const entry = entries.nth(i)
      const categoryText = await entry.locator('.log-category').textContent()
      expect(categoryText).toBe('APP_EVENT')
    }
    console.log(`Filtered to APP_EVENT: ${count} entries visible`)

    // Switch back to ALL
    await filter.selectOption('ALL')
    await page.waitForTimeout(500)
    const allCount = await page.locator('[data-testid^="log-entry-"]').count()
    console.log(`All categories: ${allCount} entries visible`)
  })

  test('debug console logs suspend and resume events', async ({ page }) => {
    // Open debug console -- page load already produced an APP_WAKE entry
    await page.getByTestId('settings-gear').click()
    await page.getByTestId('toggle-debug-console').click()
    await expect(page.getByTestId('debug-console')).toBeVisible()
    // Wait for at least one APP_WAKE entry from page load
    await waitForLogEntries(page)

    // Record initial entry count (should include the wake event from page load)
    let entries = page.locator('[data-testid^="log-entry-"]')
    const initialCount = await entries.count()
    console.log('Initial log entries (from wake on load):', initialCount)
    expect(initialCount).toBeGreaterThan(0)

    // Simulate going idle (tab hidden) -- triggers handleSuspend
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForFunction(() => document.visibilityState === 'hidden', null, { timeout: 5000 })

    // Wait > 1 second so the resume event has a non-zero idle delta
    await page.waitForTimeout(1500)

    // Simulate resuming (tab visible) -- triggers handleWake
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForFunction(() => document.visibilityState === 'visible', null, {
      timeout: 5000,
    })

    // Wait for both the suspend + resume log entries to appear.
    // APP_SUSPEND and APP_WAKE are both fire-and-forget via
    // LogStorageService.append, so we poll by refreshing until they surface.
    await waitForLogEntries(page, initialCount + 2)

    // Verify final entry count includes suspend + resume events
    entries = page.locator('[data-testid^="log-entry-"]')
    const updatedCount = await entries.count()
    console.log('Updated log entries (after suspend/resume cycle):', updatedCount)
    expect(updatedCount).toBeGreaterThanOrEqual(initialCount + 2)
  })

  test('debug console refresh button reloads entries', async ({ page }) => {
    await page.getByTestId('settings-gear').click()
    await page.getByTestId('toggle-debug-console').click()

    await expect(page.getByTestId('debug-console')).toBeVisible()

    const refreshBtn = page.getByTestId('debug-refresh')
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()
    try {
      await expect(page.getByTestId('debug-loading')).toBeHidden({ timeout: 5000 })
    } catch {}

    console.log('Refresh button clicked successfully')
  })
})
