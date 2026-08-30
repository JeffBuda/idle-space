---
paths:
  - 'src/engine/**/*.ts'
  - 'src/db.ts'
  - 'src/**/*.test.ts'
---

# Game Engine & Persistence Rules

- **Functional Purity:** Functions in this directory must be small, single-purpose, and possess no side effects.
- **State Immutability:** Never use `.push()`, `.splice()`, or direct object mutation. Always return a new state object via spread operators.
- **Storage:** Always route persistence through the IndexedDB wrapper (`src/db.ts`). Never fallback to `localStorage` for game state, as iOS Intelligent Tracking Prevention (ITP) wipes it after 7 days.
- **Deterministic Execution:** All functions must accept a "current time" delta and an "RNG seed" parameter to guarantee testable, repeatable determinism.
- **No DOM Access:** The engine layer must NEVER import from React or access `window`/`document`. It should be pure TypeScript that can run in Node.js without jsdom.
