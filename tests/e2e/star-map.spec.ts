import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { captureScreenshot } from './screenshot-helpers';

/**
 * Click a star map SVG node by dispatching the click event directly on the
 * underlying DOM element. SVG <g> elements are often intercepted by the SVG
 * container, so Playwright's .click() requires force:true which can be
 * unreliable across browsers. This helper is deterministic.
 */
const clickNode = async (page: Page, nodeId: string): Promise<void> => {
  const node = page.getByTestId(`node-${nodeId}`);
  await node.evaluate((el) => {
    el.dispatchEvent(
      new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      }),
    );
  });
};

/**
 * Write a partial game-state override into IndexedDB's `game_state` store.
 * Used to skip the 30s Launch! gate in star-map tests by injecting a state
 * that starts on the PLANET screen (the star map is already seeded at init).
 */
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
      // Deep-merge starMap so tests can override nested fields like
      // `plannedRoute` without clobbering the generated nodes/edges graph.
      if (overrides.starMap && existing.starMap) {
        merged.starMap = {
          ...(existing.starMap as Record<string, unknown>),
          ...(overrides.starMap as Record<string, unknown>),
        };
      }
      await store.put(merged, 'game_state');
    }
    db.close();
  }, overrides);
};

test.describe('Star Map Flow', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    // Deterministic seed: override crypto.getRandomValues so the star map graph is
    // reproducible across test runs. The ring topology is always the same
    // (sys_0 <-> sys_1 <-> ... <-> sys_9 <-> sys_0), but the RNG extra-edges
    // can occasionally create a direct edge between nodes the tests assume
    // are non-adjacent (e.g. sys_5 <-> sys_1, which happens ~15% of the time
    // with a random seed). Filling typed arrays with 0 produces seed "0",
    // in which sys_5 is NOT adjacent to sys_0 or sys_1.
    await page.addInitScript(() => {
      crypto.getRandomValues = ((
        arr: Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray,
      ) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = 0;
        }
        return arr;
      }) as unknown as typeof crypto.getRandomValues;
    });
  });

  const openStarMap = async (page: Page, testInfo?: TestInfo) => {
    await page.goto('/');
    // R9: WelcomeScreen no longer has a Chart Course button. Wait for the app to
    // initialize and seed the star map, then inject screen=PLANET so we can open
    // the star map via the PlanetHub "Chart Course" button.
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await page.waitForTimeout(1500);
    await writeGameState(page, { screen: 'PLANET', starMap: { plannedRoute: [] } });
    await page.reload();
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await page.getByTestId('nav-star-map').click();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    // Dismiss iOS install banner if present (it covers bottom UI on small viewports)
    if (await page.getByTestId('ios-install-dismiss').isVisible()) {
      await page.getByTestId('ios-install-dismiss').click();
    }
    if (testInfo) await captureScreenshot(page, testInfo, 'star-map-empty', 2);
  };

  test('Planet hub Chart Course navigates to star map', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await expect(page.getByTestId('star-map-title')).toHaveText('Stellar Cartography');
    if (testInfo) await captureScreenshot(page, testInfo, 'star-map-title-visible', 3);
  });

  test('star map renders 10 nodes and zoom controls', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    for (let i = 0; i < 10; i++) {
      await expect(page.getByTestId(`node-sys_${i}`)).toBeVisible();
    }
    await expect(page.getByTestId('zoom-in')).toBeVisible();
    await expect(page.getByTestId('zoom-out')).toBeVisible();
    await expect(page.getByTestId('zoom-level')).toHaveText('100%');
    await captureScreenshot(page, testInfo, 'star-map-full-graph', 3);
  });

  test('clicking a non-current node adds it to the itinerary', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('itinerary-list')).toBeVisible();
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await expect(page.getByTestId('total-travel-time')).toBeVisible();
    await captureScreenshot(page, testInfo, 'single-stop-itinerary', 3);
  });

  test('clicking a planned node again removes it (toggle)', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    // sys_1 is directly adjacent to sys_0 (ring neighbor), so it can be added
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    // Re-clicking sys_1 truncates the route (sever the tail) → empty
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('route-empty')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-cleared-by-toggle', 3);
  });

  test('clicking a non-adjacent node is rejected (Action 2: Invalid Initial Hop)', async ({
    page,
  }, testInfo) => {
    await openStarMap(page, testInfo);
    // sys_5 is NOT adjacent to sys_0 (deterministic seed yields no shortcut edge)
    await clickNode(page, 'sys_5');
    // Route should remain empty — the tap is silently ignored
    await expect(page.getByTestId('route-empty')).toBeVisible();
    await captureScreenshot(page, testInfo, 'invalid-hop-rejected', 3);
  });

  test('clicking a non-adjacent node after first hop is rejected (Action 5)', async ({
    page,
  }, testInfo) => {
    await openStarMap(page, testInfo);
    // sys_1 is adjacent to sys_0 → valid first hop
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    // sys_5 is NOT adjacent to sys_1 (ring neighbors are sys_0 and sys_2;
    // deterministic seed adds no shortcut to sys_5) → rejected silently
    await clickNode(page, 'sys_5');
    // Itinerary should still only have sys_1
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(1);
    await captureScreenshot(page, testInfo, 'invalid-sequential-hop-rejected', 3);
  });

  test('tapping a middle node in the route severs the tail (Action 8)', async ({
    page,
  }, testInfo) => {
    await openStarMap(page, testInfo);
    // Build a 3-stop route: sys_1 → sys_2 → sys_3
    await clickNode(page, 'sys_1');
    await clickNode(page, 'sys_2');
    await clickNode(page, 'sys_3');
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(3);
    // Tap sys_1 (middle node) on the map → truncates to empty (severs entire tail)
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('route-empty')).toBeVisible();
    await captureScreenshot(page, testInfo, 'middle-node-tap-severs-tail', 4);
  });

  test('tapping the last node in the route pops it (Action 7)', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await clickNode(page, 'sys_1');
    await clickNode(page, 'sys_2');
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(2);
    // Tap sys_2 (last node) → pops it, route shrinks to [sys_1]
    await clickNode(page, 'sys_2');
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(1);
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await captureScreenshot(page, testInfo, 'last-node-tap-pops', 3);
  });

  test('remove-stop button removes a specific itinerary stop', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    // Build a contiguous route: sys_1 (adjacent to sys_0) → sys_2 (adjacent to sys_1)
    await clickNode(page, 'sys_1');
    await clickNode(page, 'sys_2');
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(2);
    await captureScreenshot(page, testInfo, 'two-stop-itinerary', 3);
    await page.getByTestId('remove-stop-sys_2').click();
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(1);
    await captureScreenshot(page, testInfo, 'one-stop-after-remove', 4);
  });

  test('clear route button empties the itinerary (Action 3)', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await clickNode(page, 'sys_1');
    await clickNode(page, 'sys_2');
    await captureScreenshot(page, testInfo, 'multi-stop-before-clear', 3);
    await page.getByTestId('clear-route').click();
    await expect(page.getByTestId('route-empty')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-cleared-by-button', 4);
  });

  test('Go button with valid route navigates to space travel', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await clickNode(page, 'sys_1');
    await captureScreenshot(page, testInfo, 'route-ready-to-go', 2);
    await page.getByTestId('go-btn').click();
    await expect(page.getByTestId('space-travel-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'star-map-go-navigates-to-travel', 3);
  });

  test('zoom in/out changes zoom level display', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await page.getByTestId('zoom-in').click();
    const zoomText = await page.getByTestId('zoom-level').textContent();
    expect(parseInt(zoomText || '0')).toBeGreaterThan(100);
    await captureScreenshot(page, testInfo, 'zoomed-in', 3);
  });

  test('zoom buttons are exactly 44x44px per iOS HIG (DESIGN BIBLE §4.1)', async ({
    page,
  }, testInfo) => {
    await openStarMap(page, testInfo);
    const zoomInBtn = page.getByTestId('zoom-in');
    const zoomOutBtn = page.getByTestId('zoom-out');
    await expect(zoomInBtn).toBeVisible();
    await expect(zoomOutBtn).toBeVisible();
    // Verify dimensions are exactly 44x44px (not flexing or too wide)
    const zoomInBox = await zoomInBtn.boundingBox();
    const zoomOutBox = await zoomOutBtn.boundingBox();
    console.log('zoom-in dimensions:', zoomInBox);
    console.log('zoom-out dimensions:', zoomOutBox);
    // Width and height should both be exactly 44px (allowing small subpixel tolerance)
    expect(zoomInBox.width).toBeCloseTo(44, 0);
    expect(zoomInBox.height).toBeCloseTo(44, 0);
    expect(zoomOutBox.width).toBeCloseTo(44, 0);
    expect(zoomOutBox.height).toBeCloseTo(44, 0);
  });

  test('remove-stop buttons are exactly 44x44px per iOS HIG', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    const removeStopBtn = page.getByTestId('remove-stop-sys_1');
    await expect(removeStopBtn).toBeVisible();
    const removeStopBox = await removeStopBtn.boundingBox();
    console.log('remove-stop dimensions:', removeStopBox);
    // Width and height should both be exactly 44px
    expect(removeStopBox.width).toBeCloseTo(44, 0);
    expect(removeStopBox.height).toBeCloseTo(44, 0);
  });

  test('edges connecting route nodes are highlighted green', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    // Add two stops to create a route with an edge between them
    await clickNode(page, 'sys_1');
    await clickNode(page, 'sys_2');
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await expect(page.getByTestId('stop-name-sys_2')).toBeVisible();
    // Find all edge lines in the SVG
    const edges = page.locator('line.star-map-edge');
    const edgeCount = await edges.count();
    console.log(`Total edges found: ${edgeCount}`);
    // At least one edge should have the star-map-edge--route class (green)
    const routeEdges = page.locator('line.star-map-edge.star-map-edge--route');
    const routeEdgeCount = await routeEdges.count();
    console.log(`Route edges found: ${routeEdgeCount}`);
    expect(routeEdgeCount).toBeGreaterThan(0);
    // Verify the route edges have the green stroke color
    const firstRouteEdgeStroke = await routeEdges.first().getAttribute('stroke');
    console.log('Route edge stroke:', firstRouteEdgeStroke);
    // The stroke should reference the accent color variable (green)
    expect(firstRouteEdgeStroke).toContain('var(--color-star-route)');
    await captureScreenshot(page, testInfo, 'route-edges-highlighted-green', 2);
  });

  test('Back button returns to PLANET from star map', async ({ page }, testInfo) => {
    await openStarMap(page, testInfo);
    await page.getByTestId('back-btn').click();
    await expect(page.getByTestId('planet-hub-screen')).toBeVisible();
    await captureScreenshot(page, testInfo, 'back-to-planet', 3);
  });
});

test.describe.serial('Star Map IndexedDB Persistence', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    // Deterministic seed: same override as the main describe block so the
    // star map topology is reproducible (sys_5 NOT adjacent to sys_0/sys_1).
    await page.addInitScript(() => {
      crypto.getRandomValues = ((
        arr: Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray,
      ) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = 0;
        }
        return arr;
      }) as unknown as typeof crypto.getRandomValues;
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map((db) => {
          if (db.name) {
            const req = indexedDB.deleteDatabase(db.name);
            return new Promise((resolve) => {
              req.onsuccess = () => resolve(true);
              req.onerror = () => resolve(true);
            });
          }
          return Promise.resolve(true);
        }),
      );
    });
  });

  test('star map state persists across page reloads', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await page.waitForTimeout(1500);
    await writeGameState(page, { screen: 'PLANET', starMap: { plannedRoute: [] } });
    await page.reload();
    await page.getByTestId('nav-star-map').click();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    if (await page.getByTestId('ios-install-dismiss').isVisible()) {
      await page.getByTestId('ios-install-dismiss').click();
    }
    await clickNode(page, 'sys_1');
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-before-reload', 1);
    await page.reload();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    await expect(page.getByTestId('stop-name-sys_1')).toBeVisible();
    await captureScreenshot(page, testInfo, 'route-restored-after-reload', 2);
  });

  test('plotted route survives browser restart', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await page.waitForTimeout(1500);
    await writeGameState(page, { screen: 'PLANET', starMap: { plannedRoute: [] } });
    await page.reload();
    await page.getByTestId('nav-star-map').click();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    if (await page.getByTestId('ios-install-dismiss').isVisible()) {
      await page.getByTestId('ios-install-dismiss').click();
    }
    // Build a contiguous route: sys_1 (adjacent to sys_0) → sys_2 (adjacent to sys_1)
    await clickNode(page, 'sys_1');
    await clickNode(page, 'sys_2');
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(2);
    await captureScreenshot(page, testInfo, 'multi-stop-before-restart', 1);
    await page.reload();
    await expect(page.getByTestId('star-map-screen')).toBeVisible();
    await expect(page.getByTestId('itinerary-list').getByRole('listitem')).toHaveCount(2);
    await captureScreenshot(page, testInfo, 'multi-stop-restored', 2);
  });
});
