const fs = require('fs');
const f = 'c:/Users/jeffr/git/idle-space/tests/e2e/onboarding-sequence.spec.ts';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(/^            \/\/ Verify the gate progress/i, '    // Verify the gate progress');
c = c.replace(
  /    console\.log\(.space-travel-content count:.\,\n    console\.log\(.gate-progress count:.*?\n\n    \/\/ Dump the main content to debug\n    const mainContent.*?\n    console\.log\(.screen-content innerHTML:.*?\n/s,
  '    console.log("gate-progress count:", await gateProgress.count());\n\n    // Wait for the first 1-second tick to fire\n    await page.waitForTimeout(2000);\n\n    // The gate-progress should be visible once the gate is active\n    await expect(gateProgress).toBeVisible();\n    console.log("gate-progress is visible");\n\n    // Verify the gate time is visible and counting down\n    const gateTime = page.getByTestId("gate-time");\n    await expect(gateTime).toBeVisible();',
);
fs.writeFileSync(f, c);
console.log('Fixed');
