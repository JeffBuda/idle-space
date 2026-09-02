# Phase 2: GameState & Migration

> **Files affected:** `src/types/game-state.ts` (MODIFY), `src/db/index.ts` (MODIFY),
> `src/engine/flow.test.ts` (MODIFY), `src/db/index.test.ts` (MODIFY)

---

## 2.1 Extend `GameState` in `src/types/game-state.ts`

Add three fields after `lastError` in the `GameState` interface:

```ts
  /**
   * Star map graph + planned route state. `null` until the player first
   * enters the STAR_MAP screen (lazy generation by rngSeed).
   */
  starMap: StarMapState | null;

  /** Computed BFS route segments (from->to with hop-by-hop path). */
  routePath: StarMapRouteSegment[];

  /** Total gate time in seconds for the current route (set by STAR_MAP_GO). */
  routeTravelTimeSeconds: number;
```

> **See §1.1.2–§1.1.5** of phase-1-types-and-engine.md for `StarMapState`,
> `StarMapNode`, `StarMapEdge`, `StarMapRouteSegment`, and the new `GameAction`
> union members.

---

## 2.2 Update `src/db/index.ts`

### 2.2.1 Bump DB_VERSION

```ts
// Line 51 (current):
export const DB_VERSION = 3;

// Change to:
export const DB_VERSION = 4; // Bumped to 4: adds starMap/routePath/routeTravelTimeSeconds to GameState
```

> **Note:** No new object stores are needed — `starMap`, `routePath`, and
> `routeTravelTimeSeconds` are just additional fields on the existing `GameState`
> value stored in the `game_state` object store. The version bump ensures any
> open connections in dev refresh. No `upgrade()` callback changes required.

### 2.2.2 Add Defaults to `GAME_STATE_DEFAULT`

Append three new default fields at the end of the `GAME_STATE_DEFAULT` object
(line 78, after `lastError: null,`):

```ts
  starMap: null,            /* lazily generated on first STAR_MAP entry */
  routePath: [],
  routeTravelTimeSeconds: 0,
```

### 2.2.3 Update `migrateGameState`

The existing migration function spreads `GAME_STATE_DEFAULT` first, then
`savedState`, then applies nullish-coalescing guards for critical fields.
Add explicit guards for the three new fields:

```ts
export const migrateGameState = (savedState: GameState): GameState => ({
  ...GAME_STATE_DEFAULT,
  ...savedState,
  screen: savedState.screen ?? 'WELCOME',
  totalElapsedGameTime: savedState.totalElapsedGameTime ?? 0,
  // NEW — guard against partial writes / legacy saves:
  starMap: savedState.starMap ?? null,
  routePath: savedState.routePath ?? [],
  routeTravelTimeSeconds: savedState.routeTravelTimeSeconds ?? 0,
});
```

> The spread `...GAME_STATE_DEFAULT` already provides the defaults; the explicit
> guards ensure partially-written saves (fields present-but-undefined) are handled
> the same way as missing fields.

---

## 2.3 Update Engine Tests

### 2.3.1 `src/engine/flow.test.ts` — Add Fields to `base()` Factory

The `base()` helper at line 12 must include the three new fields so every test
state is a valid `GameState`:

```ts
const base = (over: Partial<GameState> = {}): GameState => ({
  /* ... existing fields ... */
  lastError: null,
  // NEW:
  starMap: null,
  routePath: [],
  routeTravelTimeSeconds: 0,
  ...over,
});
```

### 2.3.2 `src/db/index.test.ts` — Add Migration Test

Add a test case for legacy-save migration of the new fields:

```ts
it('migrates legacy saves with missing starMap/routePath fields', () => {
  const legacy = { ...GAME_STATE_DEFAULT, starMap: undefined, routePath: undefined };
  const migrated = migrateGameState(legacy as GameState);
  expect(migrated.starMap).toBeNull();
  expect(migrated.routePath).toEqual([]);
  expect(migrated.routeTravelTimeSeconds).toBe(0);
});
```

---

## 2.4 Migration Scenarios

| Save State        | starMap        | routePath   | routeTravelTimeSeconds | Action                            |
| ----------------- | -------------- | ----------- | ---------------------- | --------------------------------- |
| Fresh save        | `null`         | `[]`        | `0`                    | ✅ Default — no migration needed  |
| Legacy pre-v4     | `undefined`    | `undefined` | `undefined`            | ✅ Defaults applied via spread    |
| Partially written | `undefined`    | `[]`        | `undefined`            | ✅ Nullish guards fill gaps       |
| Active star map   | `StarMapState` | `[seg]`     | `45`                   | ✅ Preserved via spread           |
| Corrupted (null)  | `null`         | `null`      | `null`                 | ⚠️ routePath null -> [] via guard |
