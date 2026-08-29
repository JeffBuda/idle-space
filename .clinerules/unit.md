---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "vitest.config.ts"
  - "vitest.setup.ts"
---
# Unit & Component Test Rules

* **Framework:** Vitest + jsdom + @testing-library/react v14. Run with `npm run test` (`vitest run`).
* **Location:** All test files live co-located with source: `src/**/*.test.{ts,tsx}`.
* **Engine Tests:** Tests in `src/engine/` must test pure functions only. No mocks needed for engine logic — all inputs are explicit parameters.
* **Component Tests:** Use `@testing-library/react` `render()` and `screen` queries. Query by `data-testid` or accessible roles, not CSS classes.
* **Test Isolation:** Each test file runs in its own jsdom environment. Use `beforeEach` to reset any global mocks (especially `matchMedia` and `indexedDB`).
* **Mocking:** `vitest.setup.ts` already mocks `window.matchMedia`. Save/restore originals in `beforeEach`/`afterEach`.
* **renderHook:** Use `@testing-library/react` v14.3.1 (NOT `@testing-library/react-hooks`).
* **TypeScript:** Tests use the same strict config as source. Omit `.ts`/`.tsx` extensions in imports — Vite resolves them.
* **All tests must pass** before committing. CI runs `npm run test` and will fail the build on any failure.