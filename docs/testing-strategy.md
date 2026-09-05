# Testing Strategy

> **Status:** Living document — updated as we learn from test failures.

## The Testing Pyramid

Every new feature must include tests at all three layers of the pyramid. The
ratio is **many unit → fewer component → fewest E2E**:

| Layer         | Tool                      | Location              | When to use                                           | Target ratio |
| ------------- | ------------------------- | --------------------- | ----------------------------------------------------- | ------------ |
| **Unit**      | Vitest + jsdom            | `src/**/*.test.ts`    | Pure functions, engine logic, utilities               | ~70%         |
| **Component** | Vitest + @testing-library | `src/**/*.test.tsx`   | React rendering, prop-driven behavior, user events    | ~25%         |
| **E2E**       | Playwright (WebKit)       | `tests/e2e/*.spec.ts` | Full app flows, cross-layer integration, PWA behavior | ~5%          |

### Rules for every feature request

1. **Before writing code**, add a `docs/features/<feature-name>-testing.md`
   file that specifies:
   - Which unit functions will be tested (engine purity, determinism)
   - Which components will have component tests (render output, event handling)
   - Which user flow will have an E2E test (keep to 1–2 per feature)

2. **Every E2E test must have a unit-test counterpart** — the game logic that
   the E2E test exercises should already be covered by deterministic unit
   tests. The E2E test validates integration, not logic.

3. **E2E tests that modify IndexedDB state** must run in a
   `test.describe.serial` block with a `beforeEach` hook that clears the
   `game_state` store (see [E2E Testing Guide](./e2e-testing-guide.md)).

---

## Tool Matrix

| Concern                | Command                      | Exit code means                      |
| ---------------------- | ---------------------------- | ------------------------------------ |
| Format code            | `npm run format`             | Always 0 (Prettier writes in place)  |
| Lint                   | `npm run lint`               | 0 = no errors; 1 = ESLint violations |
| Unit + Component tests | `npm run test`               | 0 = all passed; 1 = at least 1 fail  |
| Production build       | `npm run build`              | 0 = type-check + bundle success      |
| E2E (all projects)     | `npx playwright test`        | 0 = all passed; 1 = at least 1 fail  |
| E2E (specific file)    | `npx playwright test <file>` | Same                                 |

### CI is the gate

`.github/workflows/deploy.yml` runs lint → unit tests → build → E2E. If any
step fails, the deploy job (which uses `needs: test-and-build`) does not run.
Never merge without a green CI check.

---

## Common Pitfalls (Learned the Hard Way)

### 1. IndexedDB writes are not Promises

```ts
// ❌ BUG: store.put() returns an IDBRequest, NOT a Promise.
// `await` resolves immediately — db.close() runs before the write finishes.
await store.put(state, 'game_state');
db.close();

// ✅ FIX: wrap the IDBRequest in a Promise
await new Promise<void>((resolve, reject) => {
  const req = store.put(state, 'game_state');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
});
```

This bug appeared in `tests/e2e/star-map.spec.ts` and
`tests/e2e/onboarding-sequence.spec.ts` — both in `writeGameState` helpers.
It caused silent data-loss on page reload in E2E tests.

### 2. State leaks between E2E tests

Each Playwright test gets a **fresh browser context** (new IndexedDB), but:

- The Vite dev server (`npm run dev`) is shared across all test files.
- `test.describe.serial` blocks share one browser context — state leaks between tests in the same block.
- `afterEach` must explicitly clear IndexedDB when tests modify state.

**Pattern:**

```ts
test.describe.serial('Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      const db = await indexedDB.open('space_idle_db');
      const tx = db.result.transaction(['game_state'], 'readwrite');
      await tx.objectStore('game_state').clear();
      db.result.close();
    });
  });
});
```

### 3. Editor tool whitespace doubling

When using the `editor` tool to replace lines with leading whitespace on
Windows/Powershell, leading whitespace is often doubled. **Always include the
full original indentation** in both `old_text` and `new_text`, or use
`node -e` to write the entire file.

### 4. TypeScript errors from stale .d.ts files

`npx tsc --noEmit` produces pre-existing TS6305/TS6306/TS6310 errors. Use
`npm run build` (Vite) for the authoritative type check.

### 5. File size discipline

Files > 300 lines are prone to editor-tool failures (whitespace doubling,
timeout errors). If a spec file grows beyond ~300 lines, split it into
focused sub-specs (e.g., `star-map-interaction.spec.ts`,
`star-map-visual.spec.ts`).

---

## Pre-Commit Verification Checklist

```
npm run format       # Prettier (never hand-format)
npm run lint         # ESLint + boundaries
npm run test         # 396 unit + component tests
npm run build        # Production build + type check
npx playwright test  # All E2E (Chromium + WebKit + iPhone 12)
```
