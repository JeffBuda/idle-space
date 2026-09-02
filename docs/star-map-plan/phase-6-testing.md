# Phase 6: Testing & CI Verification

> **Files affected:** `src/engine/starmap.test.ts` (NEW),
> `src/components/screens/StarMapScreen.test.tsx` (NEW),
> `tests/e2e/star-map.spec.ts` (NEW),
> `tests/e2e/onboarding-sequence.spec.ts` (MODIFY)

---

## 6.1 Engine Unit Tests (`src/engine/starmap.test.ts`)

Uses `vitest` + pure function testing (no mocks — all inputs are explicit params).
All tests pass `seed` and `currentTime` explicitly for determinism.

```ts
import { describe, it, expect } from 'vitest';
import {
  generateStarMap,
  findPath,
  toggleRouteNode,
  removeRouteNode,
  clearRoute,
  handleZoom,
  validateRoute,
  computeRoutePath,
  estimateTravelTime,
  confirmRoute,
  nodesConnected,
  getNodeById,
} from './starmap';
import type { StarMapState } from '../types/game-state';
```

**Test coverage table** (28 tests):

| #   | Test                                 | Asserts                                                   |
| --- | ------------------------------------ | --------------------------------------------------------- |
| 1   | generateStarMap determinism          | two calls with 'seed1' -> identical                       |
| 2   | generates 10 nodes                   | nodes.length === 10                                       |
| 3   | currentLocationId is 'sys_0'         | nodes[0].status === 'current'                             |
| 4   | ring connectivity                    | every node can reach next via BFS                         |
| 5   | edge count per node                  | 1 <= edges.length <= 3 for all                            |
| 6   | findPath adjacent                    | findPath(nodes, 'sys_0', 'sys_1') -> ['sys_0','sys_1']    |
| 7   | findPath multi-hop                   | findPath(nodes, 'sys_0', 'sys_2') -> length 3 (via sys_1) |
| 8   | findPath same node                   | findPath(nodes, 'sys_0', 'sys_0') -> ['sys_0']            |
| 9   | findPath unreachable                 | remove edge, findPath -> null                             |
| 10  | findPath symmetry                    | A->B and B->A have same length                            |
| 11  | toggleRouteNode add                  | empty route + node 5 -> [sys_5]                           |
| 12  | toggleRouteNode current rejected     | node 0 -> unchanged                                       |
| 13  | toggleRouteNode unreachable rejected | disconnected -> unchanged                                 |
| 14  | toggleRouteNode removes              | existing -> removed (toggle off)                          |
| 15  | removeRouteNode middle               | [2,3,5] remove 3 -> [2,5]                                 |
| 16  | removeRouteNode bridge fail          | truncation to before-only                                 |
| 17  | validateRoute valid                  | [1,2,3] -> true                                           |
| 18  | validateRoute empty                  | [] -> false                                               |
| 19  | validateRoute duplicates             | [1,1] -> false                                            |
| 20  | validateRoute nonexistent            | [99] -> false                                             |
| 21  | validateRoute unreachable            | disconnected -> false                                     |
| 22  | computeRoutePath valid               | 3 segments for [1,2,3]                                    |
| 23  | computeRoutePath unreachable         | null                                                      |
| 24  | estimateTravelTime normal            | 6 hops -> 30s                                             |
| 25  | estimateTravelTime min clamp         | 0 hops -> 10s                                             |
| 26  | estimateTravelTime max clamp         | 100 hops -> 300s                                          |
| 27  | handleZoom bounds                    | 1.0 +in = 1.3, +out = 0.7, clamp max 3.0                  |
| 28  | clearRoute empties                   | [1,2] -> []                                               |
| 29  | immutability                         | original state unchanged after all ops                    |

**Immutability test pattern:**

```ts
it('never mutates input state', () => {
  const state = generateStarMap('immutable-seed');
  const originalNodes = JSON.parse(JSON.stringify(state.nodes));
  toggleRouteNode(state, 'sys_5');
  removeRouteNode(state, 'sys_5');
  handleZoom(state, 'in');
  clearRoute(state);
  expect(JSON.parse(JSON.stringify(state.nodes))).toEqual(originalNodes);
});
```

---

## 6.2 Component Tests (`src/components/screens/StarMapScreen.test.tsx`)

Uses Vitest + jsdom + `@testing-library/react` v14. `renderHook` NOT needed —
tests use standard `render()` + `screen` queries.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StarMapScreen } from './StarMapScreen';
import { generateStarMap } from '../../engine/starmap';
import type { StarMapState } from '../../types/game-state';
```

**Test coverage table** (18 tests):

| #   | Test                             | Asserts                                  |
| --- | -------------------------------- | ---------------------------------------- |
| 1   | renders star map screen          | `getByTestId('star-map-screen')` visible |
| 2   | renders 10 node buttons          | `getAllByTestId(/^node-sys_/)` length 10 |
| 3   | renders title                    | title text 'Stellar Cartography'         |
| 4   | current location node disabled   | node-sys-0 has `disabled` attr           |
| 5   | renders zoom controls            | zoom-in + zoom-out buttons visible       |
| 6   | renders zoom level text          | e.g., '100%'                             |
| 7   | back button visible              | back-btn text 'Back'                     |
| 8   | Go! disabled when route empty    | go-btn has `disabled`                    |
| 9   | clear-route disabled when empty  | clear-route has `disabled`               |
| 10  | clicking node calls onNodeToggle | mock called with 'sys_3'                 |
| 11  | clicking X calls onRemoveStop    | mock called with 'sys_3'                 |
| 12  | zoom in calls onZoomIn           | mock called                              |
| 13  | zoom out calls onZoomOut         | mock called                              |
| 14  | back button calls onBack         | mock called                              |
| 15  | Go! enabled when route has stops | go-btn NOT disabled                      |
| 16  | Go! calls onGo when clicked      | mock called                              |
| 17  | route panel shows stop count     | '1 stop(s)' after adding                 |
| 18  | route panel shows stop names     | node name in itinerary list              |

**Component test helper pattern:**

```tsx
const mockProps = {
  gameState: null,
  starMap: generateStarMap('test-seed'),
  onNodeToggle: vi.fn(),
  onRemoveStop: vi.fn(),
  onClearRoute: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onGo: vi.fn(),
  onBack: vi.fn(),
};

const renderWithRoute = (plannedRoute: string[] = []) => {
  const starMap = { ...mockProps.starMap, plannedRoute };
  render(<StarMapScreen {...mockProps} starMap={starMap} />);
};
```

**Boundary compliance test:** StarMapScreen test must NOT trigger archunit failures.
Since the test imports `generateStarMap` from `../../engine/starmap`, and tests
are exempt from boundary rules (only source code is checked), this is fine.
Verify `tests/architecture.test.ts` doesn't flag `.test.tsx` files.

---

## 6.4 CI Pipeline Updates

### 6.4.1 `npm run test` (Vitest)

Add to the `test` script in `package.json` — already covers both `src/` unit
and component tests:

```json
"test": "vitest run"
```

New files (`starmap.test.ts`, `StarMapScreen.test.tsx`) are auto-discovered.
No script changes needed.

### 6.4.2 `npm run build` (Vite + TypeScript)

This is the **authoritative** type check (per project rules — `npx tsc --noEmit`
has pre-existing TS6305/6306/6310 errors). New files must:

- Include `StarMapState` import path correctly
- Type `confirmRoute` return value matches `StarMapConfirmResult`
- `engine/starmap.ts` imports only from `../types/game-state`

### 6.4.3 Playwright E2E

```bash
npx playwright test --project="iPhone 12"
```

New spec `tests/e2e/star-map.spec.ts` runs alongside existing specs.
Verify all existing specs still pass (no regressions).

### 6.4.4 GitHub Actions (`.github/workflows/deploy.yml`)

> **MUST halt on test failures before deploying to GitHub Pages.**
> Verify the workflow's `npm run test` step has `set -e` or equivalent.
> The deploy step should NOT run if tests fail.

No workflow file changes needed for test discovery, but verify the test
step includes the new test files (they're auto-globbed by vitest config).

---

## 6.3 E2E Tests (`tests/e2e/star-map.spec.ts`)

Playwright, mobile viewport (iPhone 12), serial block for IDB tests.

```ts
import { test, expect, type Page } from '@playwright/test';

test.describe.serial('Star Map E2E', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    // Clear game_state store before each test (IDB isolation)
    await page.goto('/');
    await page.evaluate(async () => {
      const keys = await indexedDB?.databases();
      // Clear game_state store
      // (exact IDB clearing code per existing E2E patterns)
    });
  });

  test('full onboarding -> PLANET -> STAR_MAP -> SPACE_TRAVEL', async ({ page }) => {
    // 1. Welcome -> Launch
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await page.getByTestId('launch-btn').click();

    // 2. Space Travel gate
    await expect(page.getByTestId('space-travel-screen')).toBeVisible();
    await page.getByTestId('complete-action-btn').click();

    // 3. Planet Hub -> Chart Course
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await page.getByTestId('nav-star-map').click();

    // 4. Star Map renders 10 nodes
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    const nodes = page.locator('[data-testid^="node-sys-"]');
    await expect(nodes).toHaveCount(10);

    // 5. Plot a route: click sys_1
    await page.getByTestId('node-sys-1').click();
    await expect(page.getByTestId('route-stop-sys_1')).toBeVisible();
    await expect(page.getByTestId('go-btn')).not.toBeDisabled();

    // 6. Add second stop: click sys_3
    await page.getByTestId('node-sys-3').click();
    await expect(page.getByTestId('route-stop-sys_3')).toBeVisible();

    // 7. Remove a stop
    await page.getByTestId('remove-sys_1').click();
    await expect(page.getByTestId('route-stop-sys_1')).toHaveCount(0); // hidden/removed

    // 8. Go! -> SPACE_TRAVEL with computed timer
    await page.getByTestId('go-btn').click();
    await expect(page.getByTestId('space-travel-screen')).toBeVisible();

    // 9. Verify route persisted in IndexedDB
    const dbState = await page.evaluate(() => {
      // Read game_state from IDB
      // Return starMap + routePath + routeTravelTimeSeconds
    });
    expect(dbState.routePath).toHaveLength(1); // one segment (0->3)
    expect(dbState.routeTravelTimeSeconds).toBeGreaterThan(0);

    // 10. Verify log entries in DebugConsole
    // ... open debug console, check for STAR_MAP_NODE_TOGGLE, STAR_MAP_GO logs
  });

  test('invalid navigation to STAR_MAP from SPACE_TRAVEL is rejected', async ({ page }) => {
    // Navigate to SPACE_TRAVEL, then try to go to STAR_MAP via dispatch
    // Should fail with lastError
  });
});
```

**E2E updates to `onboarding-sequence.spec.ts`:**

- Add `STAR_MAP` to the `Screen` type assertions
- The existing flow test should still pass (STAR_MAP is an optional detour, not a
  required step in the main onboarding path)
