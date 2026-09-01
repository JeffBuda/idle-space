// tests/e2e/mining-auto-loop.spec.ts
//
// E2E coverage for the mining auto-loop feature: once the player selects an
// ore on the Mining screen, the MINING gate auto-resolves every time it reaches
// 0s (ore +1, fresh gate from full) — no manual "Collect Ore" tap required.
// Also covers the welcome-back reward modal that surfaces when the player
// resumes the app after being idle on the Mining screen.
import { test, expect, type Page } from '@playwright/test';
import { captureScreenshot } from './screenshot-helpers';

test.use({ viewport: { width: 1280, height: 720 } });

// ---------------------------------------------------------------------------
// IDB helpers
// ---------------------------------------------------------------------------
interface GameStateSnapshot {
  screen: string;
  oreCounts?: { commonOre: number; rareOre: number };
  selectedOre?: string | null;
  idleTimer?: {
    screen: string;
    targetSeconds: number;
    remainingSeconds: number;
    startedAt: number;
  };
  constants?: { defaultActionTimeSeconds: number; rareOreTimeMultiplier: number };
  lastTimestamp?: number;
  [key: string]: unknown;
}

async function clearGameState(page: Page): Promise<void> {
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
}

async function writeGameState(page: Page, overrides: Record<string, unknown>): Promise<void> {
  await page.evaluate(async (overrides) => {
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
      getReq.onsuccess = () => resolve(getReq.result as Record<string, unknown>);
      getReq.onerror = () => reject(getReq.error);
    });
    if (existing) {
      await store.put({ ...existing, ...overrides }, 'game_state');
    }
    db.close();
  }, overrides);
}

async function readGameState(page: Page): Promise<GameStateSnapshot | null> {
  return page.evaluate(async () => {
    if (!('indexedDB' in window)) return null;
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
    return value as GameStateSnapshot;
  });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Fast-test setup: clears IDB, writes 1-second gate constants, reloads. */
async function setupFastGates(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('settings-gear')).toBeVisible();
  await clearGameState(page);
  await page.reload();
  await expect(page.getByTestId('welcome-screen')).toBeVisible();
  await writeGameState(page, {
    constants: { defaultActionTimeSeconds: 1, rareOreTimeMultiplier: 2 },
  });
  await page.reload();
  await expect(page.getByTestId('welcome-screen')).toBeVisible();
}

/** Walks the player through onboarding to the Mining screen (1s gates). */
async function navigateToMining(page: Page): Promise<void> {
  await page.getByTestId('launch-btn').click();
  await expect(page.getByTestId('space-travel-screen')).toBeVisible();
  await expect(page.getByTestId('complete-action-btn')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('complete-action-btn').click();
  await expect(page.getByTestId('planet-hub-screen')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('nav-landing').click();
  await expect(page.getByTestId('landing-screen')).toBeVisible();
  await expect(page.getByTestId('complete-action-btn')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('complete-action-btn').click();
  await expect(page.getByTestId('mining-screen')).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Auto-mining loop tests (modify IndexedDB state → serial)
// ---------------------------------------------------------------------------
test.describe.serial('Mining Auto-Loop', () => {
  test.beforeEach(async ({ page }) => {
    await setupFastGates(page);
  });

  test('ore is awarded automatically without tapping Collect Ore', async ({ page }, testInfo) => {
    console.log('--- Test: auto-award first ore ---');
    await navigateToMining(page);
    await captureScreenshot(page, testInfo, 'mining-screen-initial', 1);

    // Select Common Ore (1s gate) — the auto-loop will fire on the next tick
    await page.getByTestId('ore-common').click();

    // Wait for the first ore to be auto-awarded (gate hits 0s → award → restart)
    await expect(page.locator('[data-testid="ore-counts"]')).toContainText(/Common: [1-9]/, {
      timeout: 10000,
    });
    console.log('First Common Ore auto-awarded by mining loop');
    await captureScreenshot(page, testInfo, 'ore-auto-awarded', 2);

    // "Collect Ore" should never appear — the gate auto-restarts at 0s
    await expect(page.getByTestId('complete-action-btn')).not.toBeVisible();
    // "Faster!" should be visible — gate is active and counting down
    await expect(page.getByTestId('hurry-btn')).toBeVisible();

    // Navigate back — the NAVIGATE dispatch saves the auto-awarded ore to IDB
    await page.getByTestId('back-to-planet-btn').click();
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'planet-hub-after-auto-mine', 3);

    // Verify persisted state reflects the auto-awarded ore
    const gameState = await readGameState(page);
    expect(gameState).not.toBeNull();
    expect(gameState.screen).toBe('PLANET');
    expect(gameState.oreCounts?.commonOre).toBeGreaterThanOrEqual(1);
    console.log('Persisted commonOre after auto-award:', gameState.oreCounts?.commonOre);
  });

  test('auto-loop continues awarding ore across multiple cycles', async ({ page }, testInfo) => {
    console.log('--- Test: multiple cycles ---');
    await navigateToMining(page);
    await captureScreenshot(page, testInfo, 'mining-screen-initial', 1);

    await page.getByTestId('ore-common').click();

    // Wait for the first ore to confirm the loop started
    await expect(page.locator('[data-testid="ore-counts"]')).toContainText(/Common: [1-9]/, {
      timeout: 10000,
    });
    console.log('First ore detected; waiting for additional cycles');
    await captureScreenshot(page, testInfo, 'ore-auto-awarded', 2);

    // Wait 6 more seconds — with 1s gates and 1s ticks, ~5-6 additional cycles
    await page.waitForTimeout(6000);

    const oreText = await page.$eval('[data-testid="ore-counts"]', (el) => el.textContent);
    console.log('Ore counts after 6s:', oreText);

    const match = oreText?.match(/Common: (\d+)/);
    const commonCount = match ? parseInt(match[1], 10) : 0;
    expect(commonCount).toBeGreaterThanOrEqual(3);
    console.log('Common Ore count after multiple cycles:', commonCount);
    await captureScreenshot(page, testInfo, 'multiple-ore-cycles', 3);

    // The gate should still be active (never permanently expired)
    await expect(page.getByTestId('hurry-btn')).toBeVisible();
    await expect(page.getByTestId('complete-action-btn')).not.toBeVisible();

    // "Back to Planet" is always available to stop mining
    await page.getByTestId('back-to-planet-btn').click();
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'planet-hub-multi-ore', 4);

    // Verify multiple ores persisted
    const gameState = await readGameState(page);
    expect(gameState).not.toBeNull();
    expect(gameState.screen).toBe('PLANET');
    expect(gameState.oreCounts?.commonOre).toBeGreaterThanOrEqual(3);
  });

  test('"Faster!" button works during auto-loop', async ({ page }, testInfo) => {
    console.log('--- Test: hurry during auto-loop ---');
    await navigateToMining(page);
    await captureScreenshot(page, testInfo, 'mining-screen-initial', 1);

    await page.getByTestId('ore-common').click();
    await expect(page.locator('[data-testid="ore-counts"]')).toContainText(/Common: [1-9]/, {
      timeout: 10000,
    });

    // Verify the gate is counting down
    const remainingBefore = await page.$eval(
      '[data-testid="gate-remaining"]',
      (el) => el.textContent,
    );
    console.log('Gate remaining before hurry:', remainingBefore);
    await captureScreenshot(page, testInfo, 'gate-before-hurry', 2);

    // Click "Faster!" to skip 1 second of gate time
    await page.getByTestId('hurry-btn').click();
    await captureScreenshot(page, testInfo, 'after-hurry-click', 3);

    // A brief moment may show "Collect Ore" (expired) before the next tick
    // auto-restarts the gate — wait for the tick to fire and the gate to restart
    await page.waitForTimeout(2000);

    // Gate should have auto-restarted: "Faster!" visible again
    await expect(page.getByTestId('hurry-btn')).toBeVisible();

    // Navigate back — NAVIGATE dispatch saves state to IDB
    await page.getByTestId('back-to-planet-btn').click();
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'planet-hub-after-hurry', 4);

    // Ore count should reflect at least 1 (auto-awarded by the loop)
    const gameState = await readGameState(page);
    expect(gameState).not.toBeNull();
    expect(gameState.oreCounts?.commonOre).toBeGreaterThanOrEqual(1);
    console.log('Persisted commonOre after hurry + navigation:', gameState.oreCounts?.commonOre);
  });

  test('Back to Planet exits mining and stops the auto-loop', async ({ page }, testInfo) => {
    console.log('--- Test: back to planet ---');
    await navigateToMining(page);
    await captureScreenshot(page, testInfo, 'mining-screen-initial', 1);

    await page.getByTestId('ore-common').click();
    await expect(page.locator('[data-testid="ore-counts"]')).toContainText(/Common: [1-9]/, {
      timeout: 10000,
    });
    console.log('Ore auto-awarded; navigating back');
    await captureScreenshot(page, testInfo, 'ore-auto-awarded', 2);

    // Navigate back — NAVIGATE dispatch saves current React state to IDB
    await page.getByTestId('back-to-planet-btn').click();
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible({ timeout: 10000 });
    await captureScreenshot(page, testInfo, 'planet-hub-stops-loop', 3);

    // Read persisted ore count (should reflect auto-awarded ore via dispatch save)
    const gameState = await readGameState(page);
    expect(gameState).not.toBeNull();
    expect(gameState.screen).toBe('PLANET');
    expect(gameState.oreCounts?.commonOre).toBeGreaterThanOrEqual(1);
    const oreAfterNav = gameState.oreCounts?.commonOre ?? 0;
    console.log('Common Ore after navigation:', oreAfterNav);

    // Ore count should be frozen (no more auto-awards on Planet screen)
    await page.waitForTimeout(3000);

    const gameStateAfterWait = await readGameState(page);
    expect(gameStateAfterWait?.oreCounts?.commonOre).toBe(oreAfterNav);
    console.log('Ore count stable after 3s on Planet:', gameStateAfterWait?.oreCounts?.commonOre);
    await captureScreenshot(page, testInfo, 'ore-frozen', 4);
  });
});

// ---------------------------------------------------------------------------
// Welcome-back modal tests (idle resume while mining)
// ---------------------------------------------------------------------------
test.describe.serial('Mining Welcome-Back Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('settings-gear')).toBeVisible();
    // Clear game_state store for test isolation (e2e isolation rules)
    await clearGameState(page);
    // Reload so handleWake creates a fresh state via initGameState —
    // writeGameState below needs an existing record to merge overrides into.
    await page.reload();
    await expect(page.getByTestId('settings-gear')).toBeVisible();
  });

  test('modal appears when resuming from idle on the Mining screen', async ({ page }, testInfo) => {
    console.log('--- Test: modal appears after idle ---');

    // Simulate 75 seconds of idle time while mining (threshold is 60s)
    const now = await page.evaluate(() => Date.now());
    await writeGameState(page, {
      screen: 'MINING',
      selectedOre: 'commonOre',
      oreCounts: { commonOre: 0, rareOre: 0 },
      lastTimestamp: now - 75_000,
      idleTimer: {
        screen: 'MINING',
        targetSeconds: 30,
        remainingSeconds: 15,
        startedAt: now - 75_000,
      },
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
    });

    // Reload — handleWake processes APP_WAKE and surfaces the modal
    await page.reload();
    await expect(page.getByTestId('settings-gear')).toBeVisible();

    // The welcome-back modal should appear
    await expect(page.getByTestId('mining-reward-modal')).toBeVisible();
    await expect(page.getByTestId('mining-reward-title')).toHaveText('Welcome Back, Explorer!');
    console.log('MiningRewardModal is visible');
    await captureScreenshot(page, testInfo, 'modal-visible', 1);

    // Verify time-away display (75s → "1m 15s")
    const timeDisplay = await page.$eval(
      '[data-testid="mining-reward-time"]',
      (el) => el.textContent,
    );
    console.log('Time away display:', timeDisplay);
    expect(timeDisplay).toMatch(/\d+m/);

    // Verify ore collected (75s idle with 30s gates → ~3 ores)
    const commonDisplay = await page.$eval(
      '[data-testid="mining-reward-common"]',
      (el) => el.textContent,
    );
    console.log('Common Ore collected:', commonDisplay);
    expect(commonDisplay).toMatch(/\+\d+/);
    // The auto-loop should have awarded at least 1 ore
    expect(commonDisplay).not.toMatch(/\+0$/);

    // Rare Ore should show +0 (player was mining Common)
    const rareDisplay = await page.$eval(
      '[data-testid="mining-reward-rare"]',
      (el) => el.textContent,
    );
    expect(rareDisplay).toMatch(/\+0$/);
  });

  test('clicking Continue dismisses the modal and shows MiningScreen', async ({
    page,
  }, testInfo) => {
    console.log('--- Test: Continue dismissal ---');

    const now = await page.evaluate(() => Date.now());
    // Give the auto-loop enough idle time to award several ores
    await writeGameState(page, {
      screen: 'MINING',
      selectedOre: 'commonOre',
      oreCounts: { commonOre: 0, rareOre: 0 },
      lastTimestamp: now - 120_000,
      idleTimer: {
        screen: 'MINING',
        targetSeconds: 30,
        remainingSeconds: 15,
        startedAt: now - 120_000,
      },
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
    });

    await page.reload();
    await expect(page.getByTestId('settings-gear')).toBeVisible();

    // Modal should appear
    await expect(page.getByTestId('mining-reward-modal')).toBeVisible();
    console.log('Modal visible; clicking Continue');
    await captureScreenshot(page, testInfo, 'modal-before-continue', 1);

    // Click "Continue"
    await page.getByTestId('dismiss-mining-reward-btn').click();

    // Modal should disappear
    await expect(page.getByTestId('mining-reward-modal')).not.toBeVisible();

    // MiningScreen should be visible (player resumes mining)
    await expect(page.getByTestId('mining-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'mining-screen-after-dismiss', 2);

    // Ore should have been awarded
    const gameState = await readGameState(page);
    expect(gameState).not.toBeNull();
    expect(gameState.oreCounts?.commonOre).toBeGreaterThan(0);
    console.log('Persisted commonOre after dismissal:', gameState.oreCounts?.commonOre);
  });

  test('clicking the backdrop also dismisses the modal', async ({ page }, testInfo) => {
    console.log('--- Test: backdrop dismissal ---');

    const now = await page.evaluate(() => Date.now());
    await writeGameState(page, {
      screen: 'MINING',
      selectedOre: 'commonOre',
      oreCounts: { commonOre: 0, rareOre: 0 },
      lastTimestamp: now - 75_000,
      idleTimer: {
        screen: 'MINING',
        targetSeconds: 30,
        remainingSeconds: 15,
        startedAt: now - 75_000,
      },
      constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
    });

    await page.reload();
    await expect(page.getByTestId('settings-gear')).toBeVisible();

    await expect(page.getByTestId('mining-reward-modal')).toBeVisible();
    await captureScreenshot(page, testInfo, 'modal-before-backdrop', 1);

    // Click the overlay backdrop (edge of the modal, outside content)
    const modal = page.getByTestId('mining-reward-modal');
    await modal.click({ position: { x: 10, y: 10 } });

    await expect(page.getByTestId('mining-reward-modal')).not.toBeVisible();
    await expect(page.getByTestId('mining-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'mining-screen-after-backdrop', 2);
    console.log('Modal dismissed via backdrop click');
  });
});
