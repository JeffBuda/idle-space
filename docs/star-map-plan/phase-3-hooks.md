# Phase 3: Hook Layer Exposure

> **Files affected:** `src/hooks/useGameState.ts` (MODIFY)

---

## 3.1 `src/hooks/useGameState.ts` Changes

The hook already wraps `engineReducer` in `withLogging` and exposes
`gameState`, `screen`, `dispatch`, etc. Only two changes are needed:

### 3.1.1 Expose Star Map State

Add three new return values to `UseGameStateResult`:

```ts
export interface UseGameStateResult {
  /* ... existing fields ... */

  // NEW — Star Map state (null until first STAR_MAP entry)
  starMap: GameState['starMap'];
  routePath: GameState['routePath'];
  routeTravelTimeSeconds: number;

  // NEW — typed navigation helper (convenience wrapper around dispatch)
  navigateTo: (to: Screen) => void;
}
```

### 3.1.2 Wire Up in Hook Body

In the `return` block of `useGameState` (line 252), add:

```ts
return {
  gameState,
  screen,
  oreCounts,
  gate,
  offlineSeconds,
  clearOfflineSeconds,
  idleReward,
  clearIdleReward,
  isLoading,
  dispatch,
  // NEW:
  starMap: gameState?.starMap ?? null,
  routePath: gameState?.routePath ?? [],
  routeTravelTimeSeconds: gameState?.routeTravelTimeSeconds ?? 0,
  navigateTo: useCallback(
    (to: Screen) => {
      dispatch({ type: 'NAVIGATE', to });
    },
    [dispatch],
  ),
};
```

### 3.1.3 Import Update

Add `Screen` to the type import (line 5):

```ts
import type { IdleGateStatus, IdleRewardSummary, Screen } from '../types/game-state';
```

---

## 3.2 App.tsx Callback Wiring

In `src/components/App.tsx`, add a `handleChartCourse` callback and wire it
to both `PlanetHubScreen` and `WelcomeScreen`:

```tsx
const handleChartCourse = () => {
  dispatch({ type: 'NAVIGATE', to: 'STAR_MAP' });
};
```

In the PlanetHubScreen render block:

```tsx
{
  screen === 'PLANET' && (
    <PlanetHubScreen
      gameState={gameState}
      onNavigate={(to) => dispatch({ type: 'NAVIGATE', to })}
      onChartCourse={handleChartCourse}
    />
  );
}
```

In the WelcomeScreen render block:

```tsx
{
  screen === 'WELCOME' && (
    <WelcomeScreen
      onLaunch={() => dispatch({ type: 'NAVIGATE', to: 'SPACE_TRAVEL' })}
      onChartCourse={handleChartCourse}
    />
  );
}
```

The `dispatch` already flows through `loggedReducer`, so `NAVIGATE to STAR_MAP`
will be automatically logged as `GAME_FLOW` (per §5 of the main plan). No
changes to `withLogging` or `ACTION_CATEGORY` are needed for the navigation
itself — only the star-map-specific actions need categorization (Phase 1 §1.3).
