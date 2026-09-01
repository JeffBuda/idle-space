// tests/e2e/screenshot-helpers.ts
//
// Shared helper for capturing full-page screenshots during E2E sequence
// tests. Screenshots are saved via Playwright's testInfo.outputPath(), which
// places them under the per-test output directory (test-results/ by default).
// The test-results/ path is already gitignored by both .gitignore and
// .prettierignore, so these artifacts never enter source control but remain
// available as GitHub Actions artifacts when the CI workflow uploads them.
import type { Page, TestInfo } from '@playwright/test';

/**
 * Captures a full-page screenshot at a notable stage of the test.
 *
 * One folder is created per test case (via testInfo.outputPath), and each
 * stage within that test produces one PNG file named:
 *   `${zero-padded-step}-${kebab-case-stage}.png`
 *
 * Example output path:
 *   test-results/e2e/onboarding-sequence-<hash>/01-welcome-screen.png
 *
 * @param page     - The Playwright Page fixture
 * @param testInfo - The Playwright TestInfo fixture (2nd arg to test fn)
 * @param stage    - Descriptive kebab-case name for the stage
 * @param step     - Step number for chronological ordering (e.g. 1 → "01")
 */
export async function captureScreenshot(
  page: Page,
  testInfo: TestInfo,
  stage: string,
  step: number,
): Promise<void> {
  const fileName = `${step.toString().padStart(2, '0')}-${stage}.png`;
  await page.screenshot({
    path: testInfo.outputPath(fileName),
    fullPage: true,
  });
}
