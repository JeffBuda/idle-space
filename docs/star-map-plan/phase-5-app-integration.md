# Phase 5: App Integration

> **Files affected:** `src/components/App.tsx` (MODIFY),
> `src/components/App.test.tsx` (MODIFY),
> `src/engine/flow.ts` (MODIFY — navigate case for STAR_MAP),
> `src/engine/reducer.ts` (MODIFY — route starmap actions),
> `src/components/screens/WelcomeScreen.tsx` (MODIFY — add onChartCourse prop)

---

## 5.1 `src/engine/reducer.ts` — Route STAR_MAP Actions

Add new action types to the `engineReducer` switch statement. Currently the
default case returns `prevState` unchanged. The star-map actions must be handled
by calling functions from `starmap.ts` (imported at the top):

```ts
import { toggleRouteNode, removeRouteNode, clearRoute, handleZoom, confirmRoute } from './starmap';
```

Add cases before the `default:` (after the existing `ORE_SELECTED` case):

```ts
    case 'STAR_MAP_NODE_TOGGLE': {
      if (!prevState.starMap) return prevState;
      const starMap = toggleRouteNode(prevState.starMap, action.nodeId);
      return { ...prevState, starMap };
    }

    case 'STAR_MAP_REMOVE_STOP': {
      if (!prevState.starMap) return prevState;
      const starMap = removeRouteNode(prevState.starMap, action.nodeId);
      return { ...prevState, starMap };
    }

    case 'STAR_MAP_CLEAR_ROUTE': {
      if (!prevState.starMap) return prevState;
      const starMap = clearRoute(prevState.starMap);
      return { ...prevState, starMap, routePath: [], routeTravelTimeSeconds: 0 };
    }

    case 'STAR_MAP_ZOOM_IN': {
      if (!prevState.starMap) return prevState;
      const starMap = handleZoom(prevState.starMap, 'in');
      return { ...prevState, starMap };
    }

    case 'STAR_MAP_ZOOM_OUT': {
      if (!prevState.starMap) return prevState;
      const starMap = handleZoom(prevState.starMap, 'out');
      return { ...prevState, starMap };
    }

    case 'STAR_MAP_GO': {
      if (!prevState.starMap) return prevState;
      const result = confirmRoute(prevState.starMap, prevState.rngSeed);
      if (result.error) {
        return { ...prevState, lastError: result.error };
      }
      return {
        ...prevState,
        starMap: result.starMap,
        routePath: result.routePath,
        routeTravelTimeSeconds: result.routeTravelTimeSeconds,
        screen: 'SPACE_TRAVEL',
        idleTimer: makeTimer(prevState, 'SPACE_TRAVEL', currentTime),
        lastError: null,
      };
    }
```

> **IMPORTANT:** `makeTimer` uses `gateTarget(state, screen)` which returns `30`
> for `SPACE_TRAVEL`. The `STAR_MAP_GO` case needs a **custom** gate time equal
> to `routeTravelTimeSeconds`. Solution: add a `makeTimerWithTarget` helper in
> `flow.ts` and export it:

```ts
// In flow.ts — new exported helper:
export const makeTimerWithTarget = (
  state: GameState,
  screen: Screen,
  target: number,
  currentTime: number,
): IdleTimer => ({
  screen,
  targetSeconds: target,
  remainingSeconds: target,
  startedAt: currentTime,
});

// In reducer.ts STAR_MAP_GO case:
import { makeTimerWithTarget } from './flow';
idleTimer: makeTimerWithTarget(
  prevState,
  'SPACE_TRAVEL',
  result.routeTravelTimeSeconds,
  currentTime,
);
```

---

## 5.2 `src/engine/flow.ts` — STAR_MAP Navigation Case

Add `STAR_MAP` as a valid `NAVIGATE` target from **both** `WELCOME` and `PLANET`
(per Q8 decision). The `navigate()` function has a `case` for each source screen:

```ts
// In navigate() — WELCOME case:
case 'WELCOME':
  if (to === 'SPACE_TRAVEL') { /* existing Launch! logic */ }
  if (to === 'STAR_MAP') {
    if (state.starMap === null) {
      const starMap = generateStarMap(state.rngSeed, 'sys_0');
      return { ...state, screen: 'STAR_MAP', starMap, lastError: null };
    }
    return { ...state, screen: 'STAR_MAP', lastError: null };
  }
  break;

// In navigate() — PLANET case:
case 'PLANET':
  if (to === 'LANDING') return startGate(state, 'LANDING', currentTime);
  if (to === 'SPACE_TRAVEL') return startGate(state, 'SPACE_TRAVEL', currentTime);
  if (to === 'STAR_MAP') {
    if (state.starMap === null) {
      const starMap = generateStarMap(state.rngSeed, 'sys_0');
      return { ...state, screen: 'STAR_MAP', starMap, lastError: null };
    }
    return { ...state, screen: 'STAR_MAP', lastError: null };
  }
  break;

// In navigate() — STAR_MAP case (Back to Planet only):
case 'STAR_MAP':
  if (to === 'PLANET') {
    return { ...state, screen: 'PLANET', starMap: null, lastError: null };
  }
  break;
```

Note: `STAR_MAP_GO` is a standalone action in `processFlowAction()`, not a `NAVIGATE`
action. See §5.1 for its reducer case routing.

---

## 5.3 `src/components/App.tsx` — STAR_MAP Render Gate

Add `StarMapScreen` import + render block, following the existing pattern:

```tsx
import { StarMapScreen } from './screens/StarMapScreen';
```

In the render block (after the PLANET block at line 166):

```tsx
{
  screen === 'STAR_MAP' && gameState?.starMap && (
    <StarMapScreen
      gameState={gameState}
      starMap={gameState.starMap}
      onNodeToggle={(id) => dispatch({ type: 'STAR_MAP_NODE_TOGGLE', nodeId: id })}
      onRemoveStop={(id) => dispatch({ type: 'STAR_MAP_REMOVE_STOP', nodeId: id })}
      onClearRoute={() => dispatch({ type: 'STAR_MAP_CLEAR_ROUTE' })}
      onZoomIn={() => dispatch({ type: 'STAR_MAP_ZOOM_IN' })}
      onZoomOut={() => dispatch({ type: 'STAR_MAP_ZOOM_OUT' })}
      onGo={() => dispatch({ type: 'STAR_MAP_GO' })}
      onBack={() => dispatch({ type: 'NAVIGATE', to: 'PLANET' })}
    />
  );
}
```

Also pass `onChartCourse` to PlanetHubScreen AND WelcomeScreen:

```tsx
{
  screen === 'PLANET' && (
    <PlanetHubScreen
      gameState={gameState}
      onNavigate={(to) => dispatch({ type: 'NAVIGATE', to })}
      onChartCourse={() => dispatch({ type: 'NAVIGATE', to: 'STAR_MAP' })}
    />
  );
}
```

```tsx
{
  screen === 'WELCOME' && (
    <WelcomeScreen
      onLaunch={() => dispatch({ type: 'NAVIGATE', to: 'SPACE_TRAVEL' })}
      onChartCourse={() => dispatch({ type: 'NAVIGATE', to: 'STAR_MAP' })}
    />
  );
}
```

---

## 5.4 `src/components/App.test.tsx` Updates

Add a test for the STAR_MAP render gate. The existing test file renders App
with a mock game state. Add:

```tsx
it('renders StarMapScreen when screen is STAR_MAP', async () => {
  const starMapState = generateStarMap('test-seed', 'sys_0');
  render(<App />, {
    gameState: { ...baseGameState, screen: 'STAR_MAP', starMap: starMapState },
  });
  expect(screen.getByTestId('star-map-screen')).toBeInTheDocument();
  expect(screen.getByTestId('star-map-title')).toHaveTextContent('Stellar Cartography');
});

it('renders Chart Course button on PlanetHub', () => {
  render(<App />, {
    gameState: { ...baseGameState, screen: 'PLANET' },
  });
  expect(screen.getByTestId('nav-star-map')).toHaveTextContent('Chart Course');
});

it('renders Chart Course button on WelcomeScreen', () => {
  render(<App />, {
    gameState: { ...baseGameState, screen: 'WELCOME' },
  });
  expect(screen.getByTestId('welcome-chart-course')).toHaveTextContent('Chart Course');
});
```

> **Note:** If `App.test.tsx` uses a custom render wrapper, ensure the wrapper
> passes `starMap` and `routePath` defaults to new mock states. See phase-6-testing.md
> for the test helper pattern.
