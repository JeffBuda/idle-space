# E2E Testing Guide (Playwright)

> **Status:** Living document — captures lessons from star-map E2E debugging sessions.

## Environment

| Concern         | Value                                          |
| --------------- | ---------------------------------------------- |
| Test runner     | Playwright Test                                |
| Test files      | `tests/e2e/*.spec.ts`                          |
| Projects        | `chromium`, `webkit`, `iPhone 12`              |
| Dev server      | `npm run dev` (Vite on `localhost:5173`)       |
| CI command      | `npx playwright test` (auto-starts dev server) |
| Config          | `playwright.config.ts`                         |
| Default timeout | 30 s per test                                  |
| Viewport        | `{ width: 390, height: 844 }` (iPhone 12)      |

## Quick Start

````bash
# Run all E2E tests
npx playwright test

# Run a specific spec
npx playwright test tests/e2e/star-map.spec.ts


---

## 1. State Isolation Between Tests

### Browser contexts are isolated

Playwright creates a **new browser context** (with a fresh IndexedDB) for each
test. This means tests cannot accidentally read state left by a previous test.

**Exception:** `test.describe.serial` blocks share one browser context — state
leaks between tests in the same block.

### Clearing IndexedDB when needed

For tests that modify IndexedDB state, use `test.describe.serial` with a
`beforeEach` that clears the `game_state` store:

```ts
test.describe.serial('My Feature Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('app-ready').waitFor({ state: 'attached' });
    await page.evaluate(async () => {
      if (!('indexedDB' in window)) return;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('space_idle_db');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(['game_state'], 'readwrite');
      await tx.objectStore('game_state').clear();
      db.close();
    });
  });
});
````

### Injecting pre-test state

To skip gates or force the app into a specific screen, use `writeGameState`:

```ts
const writeGameState = async (page: Page, overrides: Record<string, unknown>): Promise<void> => {
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
      const merged = { ...existing, ...overrides };
      if (overrides.starMap && existing.starMap) {
        merged.starMap = { ...(existing.starMap as object), ...(overrides.starMap as object) };
      }
      // ✅ CRITICAL: wrap store.put() IDBRequest in a Promise
      await new Promise<void>((resolve, reject) => {
        const putReq = store.put(merged, 'game_state');
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
    }
    db.close();
  }, overrides);
};
```

> **Never inject state after the app has loaded.** The app's auto-save interval
> (every 10 s) will overwrite your injected state with the app's in-memory copy.
> Always write to IndexedDB **before** `page.reload()` or **before** `page.goto('/')`.

---

## 2. Readiness Signals — Use Hidden DOM, Not Timeouts

### ❌ The old way (fragile)

```ts
await page.goto('/');
await page.waitForTimeout(1500); // What does 1500ms mean? How do you know?
```

`waitForTimeout` is a fixed guess. It races against:

- IndexedDB IDB.open() callback
- `handleWake()` async state load
- React re-render

### ✅ The new way (deterministic)

Add a hidden element to `App.tsx` that renders only when the app is fully
initialized:

```tsx
{
  !isLoading && <div data-testid="app-ready" className="app-ready-signal" />;
}
```

```css
/* App.css */
.app-ready-signal {
  display: none;
}
```

In tests:

```ts
await page.getByTestId('app-ready').waitFor({ state: 'attached' });
```

The `state: 'attached'` option waits for the element to exist in the DOM —
which only happens after `isLoading` becomes `false`, which only happens after
`handleWake()` has loaded state from IndexedDB and called `setGameState(state)`.

**Rule:** Never use `waitForTimeout` for readiness. Always use a `data-testid`
element that represents a verifiable app state.

---

## 3. Deterministic Seeds for Procedural Generation

### The problem

Star map generation uses `crypto.getRandomValues()` for its seed. Without a
fixed seed, the random extra-edges can create a direct edge between nodes the
tests assume are non-adjacent (e.g. `sys_5` adjacent to `sys_1`), causing
~15% intermittent failures.

### The fix

Override `crypto.getRandomValues` in a `beforeEach` hook via
`page.addInitScript`:

```ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    crypto.getRandomValues = ((arr: Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = 0;
      }
      return arr;
    }) as unknown as typeof crypto.getRandomValues;
  });
});
```

Filling typed arrays with `0` produces seed `"0"`, in which the star map ring
topology (`sys_0 <-> sys_1 <-> … <-> sys_9 <-> sys_0`) has no shortcut edges
between non-adjacent nodes.

**Rule:** If your test depends on procedurally generated topology, pin the
seed and verify it produces the expected graph before committing.

---

## 4. WebKit SVG Click Limitations

### The problem

Clicking SVG `<g>` elements (star map nodes) does not dispatch `click` events
reliably in WebKit. Playwright's `page.getByTestId('node-sys_1').click()` works
in Chromium but not in WebKit.

### Workarounds (in order of preference)

1. **`page.evaluate` + `dispatchEvent`** — Works but flaky:

   ```ts
   const clickNode = async (page: Page, nodeId: string) => {
     await page.getByTestId(`node-${nodeId}`).evaluate((el) => {
       el.dispatchEvent(
         new MouseEvent('click', {
           bubbles: true,
           cancelable: true,
           clientX: 0,
           clientY: 0,
         }),
       );
     });
   };
   ```

2. **`force: true`** — Unreliable across browsers:

   ```ts
   await page.getByTestId(`node-${nodeId}`).click({ force: true });
   ```

3. **`test.skip()`** — For tests where the interaction cannot be made
   deterministic on WebKit, skip and rely on unit tests for the logic:
   ```ts
   test.skip('clicking a non-current node adds it to the itinerary', async ({ page }) => {
     // SVG <g> click via dispatchEvent does not work in WebKit.
     // Logic covered by StarMapScreen.interactions.test.tsx + starmap.test.ts
   });
   ```

### Decision matrix

| Test type                 | Skip in WebKit? | Reason                                 |
| ------------------------- | --------------- | -------------------------------------- |
| State injection + reload  | No              | No DOM interaction; deterministic      |
| Zoom button clicks (HTML) | No              | Buttons are HTML, not SVG              |
| SVG node clicks           | Yes             | `dispatchEvent` on `<g>` is unreliable |
| Non-adjacent rejection    | Yes (skip)      | False positive if click never fires    |

> **Key insight:** Tests that assert "a rejected click leaves the route empty"
> are **false positives** when `clickNode` doesn't actually fire — the route
> is empty because the click never happened, not because the engine rejected it.
> These tests pass but don't test the rejection logic. Skip them.

---

## 5. File Organization & Size Discipline

### Keep spec files under ~300 lines

The editor tool used in this project has a known bug: substring replacement can
double leading whitespace on Windows/Powershell. Large files make this worse
and increase timeout risk.

**If a spec exceeds 300 lines, split it:**

```
tests/e2e/
  star-map.spec.ts             # Navigation + rendering (no clickNode)
  star-map-interaction.spec.ts # Node clicking, route building (skip in WebKit)
  star-map-persistence.spec.ts # Reload, browser restart
  star-map-visual.spec.ts      # Screenshot, layout, dimensions
```

### Shared helpers

Put reusable helpers in `tests/e2e/screenshot-helpers.ts` or create a new
`tests/e2e/idb-helpers.ts` for `writeGameState`, `readGameState`, and
`clearGameState`.

---

## 6. Debugging Checklist

When an E2E test fails, follow this checklist in order:

1. **Read the error** — What element was not found? What assertion failed?
2. **Check screenshots** — `npx playwright show-report` opens the HTML report
   with full-page screenshots captured at each stage.
3. **Run with `--timeout=60000`** — Sometimes 30 s is not enough for slow CI.
4. **Run on Chromium only** — `npx playwright test --project=chromium` to
   rule out WebKit-specific issues.
5. **Add `console.log`** — Log state before/after key operations:
   ```ts
   const state = await readGameState(page);
   console.log('State after writeGameState:', JSON.stringify(state, null, 2));
   ```
6. **Check the auto-save race** — After `writeGameState`, do you `page.reload()`?
   If so, the `store.put()` IDBRequest must be properly wrapped in a Promise.
7. **Check the seed** — Run on WebKit with a non-deterministic seed. Does the
   star map topology differ? Does a shortcut edge create an unexpected adjacency?

---

## 7. Screenshot Capture

Use `captureScreenshot` for observability at key stages:

```ts
import { captureScreenshot } from './screenshot-helpers';

await captureScreenshot(page, testInfo, 'star-map-empty', 2);
```

Screenshots are saved to `test-results/<test-name>/02-star-map-empty.png` and
are available as CI artifacts if tests fail.

```
# Run with verbose output
npx playwright test --reporter=list --workers=1

# Run on a specific project only
npx playwright test --project="iPhone 12"

# Debug mode (headed)
npx playwright test --headed --project="iPhone 12" --workers=1
```
