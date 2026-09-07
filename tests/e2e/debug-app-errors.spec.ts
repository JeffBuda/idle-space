import { test, expect } from '@playwright/test';

test('debug app loading errors', async ({ page }) => {
  const errors: string[] = [];
  const consoleMessages: string[] = [];

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto('/');
  await page.waitForTimeout(3000);

  console.log('=== Debug Info ===');
  console.log(`Page errors: ${JSON.stringify(errors)}`);
  console.log(`Console errors: ${JSON.stringify(consoleMessages)}`);

  // Wait for the app to finish loading — use the app-ready signal
  await page.getByTestId('app-ready').waitFor({ state: 'attached', timeout: 15000 });

  console.log(`After app-ready wait, errors: ${JSON.stringify(errors)}`);

  // App should have loaded without runtime errors
  expect(errors).toEqual([]);
  expect(consoleMessages).toEqual([]);

  // Settings gear (DebugDrawer trigger) should be visible
  const gearButton = page.getByTestId('settings-gear');
  await expect(gearButton).toBeVisible();
});
