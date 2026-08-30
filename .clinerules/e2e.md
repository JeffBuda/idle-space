---
paths:
  - 'tests/e2e/**/*.spec.ts'
---

# Playwright E2E Testing Rules

- **Test Isolation:** Tests that modify IndexedDB state must run within a `test.describe.serial` block with a `beforeEach` hook that clears the `game_state` store before each test.
- **Browser Viewport:** Set `test.use({ viewport: { width: 1280, height: 720 } })` at the top of each test file.
- **Dev Server:** Always wait for the Vite dev server to be ready before running tests. The `playwright.config.ts` `webServer` config handles this automatically.
- **Test Conventions:**
  - Use `data-testid` selectors (via `page.getByTestId()`) for all element queries.
  - Use `await expect(locator).toBeVisible()` for presence checks — never raw DOM queries without waiting.
  - Add `console.log()` statements for test observability (time values, state before/after).
- **Serial vs Parallel:** Basic UI/SW/IndexedDB tests can run in parallel. Interactive game state tests (modifying timestamps, clicking buttons that change state) MUST run serially.
- **Test Timeout:** Use the default 30s timeout. For real-time tick tests, wait at least 6 seconds to ensure the 1-second interval fires multiple times.
- **State Verification:** After user interactions (collect rewards, dismiss), always verify both the UI state AND the persisted IndexedDB state to ensure consistency.
