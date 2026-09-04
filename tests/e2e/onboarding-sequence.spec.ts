// tests/e2e/onboarding-sequence.spec.ts
//
// End-to-end coverage for the idle-gated onboarding state machine
// (docs/onboarding-flow.md §6). The full Launch! -> Land -> Mine -> Collect
// cycle is exercised with 1-second gates (fast-test override written straight
// to IndexedDB, mirroring the SettingsMenu "fast action time" toggle) so the
// cycle completes in seconds rather than ~90s.
import { test, expect, type Page } from '@playwright/test';
import { captureScreenshot } from './screenshot-helpers';

test.use({ viewport: { width: 390, height: 844 } });

// ---------------------------------------------------------------------------
// IDB helpers
// ---------------------------------------------------------------------------
interface GameStateSnapshot {
  screen: string;
  oreCounts?: { commonOre: number; rareOre: number };
  [key: string]: unknown;
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

// ---------------------------------------------------------------------------
// Full onboarding cycle with 1s gates. Serial + clears the game_state store
// before each test (IDB-modifying tests per the e2e isolation rules).
// ---------------------------------------------------------------------------
test.describe.serial('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('settings-gear')).toBeVisible();

    // Clear the game_state store for test isolation.
    await page.evaluate(async () => {
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

    // Reload to recreate a fresh save, then override gate timing to 1s so the
    // cycle runs quickly (Rare Ore stays 2s via rareOreTimeMultiplier).
    // Wait for welcome-screen (not just settings-gear) so handleWake has fully
    // completed and persisted the fresh state to IndexedDB -- otherwise
    // writeGameState may find no existing record and silently no-op on its
    // merge, leaving gates at the 30s default.
    await page.reload();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await writeGameState(page, {
      constants: { defaultActionTimeSeconds: 1, rareOreTimeMultiplier: 2 },
    });
    await page.reload();
    await expect(page.getByTestId('settings-gear')).toBeVisible();

    // Fresh save renders the Welcome screen (render gate: screen === 'WELCOME').
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
  });

  test('full onboarding cycle: Launch! -> Land -> Mine (Common) -> Collect', async ({
    page,
  }, testInfo) => {
    console.log('Start onboarding cycle');
    await captureScreenshot(page, testInfo, 'welcome-screen', 1);

    // Step 1 - Welcome: player must tap Launch! to begin.
    await page.getByTestId('launch-btn').click();

    // Step 2 - Space Travel gate (min 10s per leg, floored by estimateTravelTime).
    await expect(page.getByTestId('space-travel-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'space-travel-gate', 2);
    await expect(page.getByTestId('complete-action-btn')).toBeVisible({ timeout: 15000 });
    console.log('Space Travel gate complete');
    await page.getByTestId('complete-action-btn').click();

    // Step 3 - Planet hub -> Land.
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'planet-hub-after-travel', 3);
    await page.getByTestId('nav-landing').click();

    // Step 4 - Landing gate (1s), then complete -> Mining.
    await expect(page.getByTestId('landing-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'landing-gate', 4);
    await expect(page.getByTestId('complete-action-btn')).toBeVisible({ timeout: 10000 });
    console.log('Landing gate complete');
    await page.getByTestId('complete-action-btn').click();

    // Step 5 - Mining: select Common Ore (1s gate). With the auto-mining loop,
    // ore is awarded automatically once the gate reaches 0s and a fresh gate
    // starts — no "Collect Ore" tap needed. Wait for the first auto-award.
    await expect(page.getByTestId('mining-screen')).toBeVisible();
    await page.getByTestId('ore-common').click();
    await expect(page.locator('[data-testid="ore-counts"]')).toContainText(/Common: [1-9]/, {
      timeout: 10000,
    });
    console.log('Mining loop auto-awarded first Common Ore');
    await captureScreenshot(page, testInfo, 'mining-first-ore', 5);

    // Navigate back to the Planet hub — "Back to Planet" stops mining.
    await page.getByTestId('back-to-planet-btn').click();

    // Step 6 - Back on the Planet hub with Common Ore awarded by the auto-loop.
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'planet-hub-with-ore', 6);
    const oreTally = await page.getByTestId('ore-tally').textContent();
    console.log('Ore tally after cycle:', oreTally);
    expect(oreTally).toMatch(/Common Ore: [1-9]/);

    // The award is persisted in IndexedDB.
    const gameState = await readGameState(page);
    expect(gameState).not.toBeNull();
    expect(gameState.screen).toBe('PLANET');
    expect(gameState.oreCounts?.commonOre).toBeGreaterThanOrEqual(1);
  });

  test('Rare Ore gate is twice as long (2s) before collecting', async ({ page }, testInfo) => {
    console.log('Start rare-ore cycle');
    await captureScreenshot(page, testInfo, 'welcome-screen', 1);

    await page.getByTestId('launch-btn').click();
    await expect(page.getByTestId('complete-action-btn')).toBeVisible({ timeout: 15000 });
    await captureScreenshot(page, testInfo, 'space-travel-gate', 2);
    await page.getByTestId('complete-action-btn').click();

    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'planet-hub-after-travel', 3);
    await page.getByTestId('nav-landing').click();
    await expect(page.getByTestId('landing-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'landing-gate', 4);
    await expect(page.getByTestId('complete-action-btn')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('complete-action-btn').click();

    await expect(page.getByTestId('mining-screen')).toBeVisible();
    await page.getByTestId('ore-rare').click();
    // Rare Ore uses a 2s gate (1s default × 2 multiplier); the auto-loop
    // awards it automatically once the gate expires — no "Collect Ore" tap.
    await expect(page.locator('[data-testid="ore-counts"]')).toContainText(/Rare: [1-9]/, {
      timeout: 10000,
    });
    console.log('Mining loop auto-awarded first Rare Ore');
    await captureScreenshot(page, testInfo, 'mining-first-rare-ore', 5);
    await page.getByTestId('back-to-planet-btn').click();

    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'planet-hub-with-rare-ore', 6);
    const oreTally = await page.getByTestId('ore-tally').textContent();
    console.log('Rare ore tally after cycle:', oreTally);
    expect(oreTally).toMatch(/Rare Ore: [1-9]/);

    const gameState = await readGameState(page);
    expect(gameState.oreCounts?.rareOre).toBeGreaterThanOrEqual(1);
  });
});
