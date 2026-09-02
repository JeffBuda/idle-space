# Phase 5: App Integration

> **Files affected:** `src/components/App.tsx` (MODIFY),
> `src/components/App.test.tsx` (MODIFY),
> `src/engine/flow.ts` (MODIFY — navigate case for STAR_MAP),
> `src/engine/reducer.ts` (MODIFY — route starmap actions)

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

> **Note:** `makeTimer` is currently private to `flow.ts`. We need to either
> export it or use the existing `startGate` helper. Since `confirmRoute` needs
> the travel time (which is `routeTravelTimeSeconds`), we can't use `startGate`
> directly (it uses `gateTarget` which returns `30` for SPACE_TRAVEL). The
> `STAR_MAP_GO` case must set `idleTimer` with `targetSeconds` and
> `remainingSeconds` both equal to `routeTravelTimeSeconds`, and `screen:
'SPACE_TRAVEL'`. See §5.3 below.

---

## 5.2 `src/engine/flow.ts` — STAR_MAP Navigation Case

Add a `case 'STAR_MAP':` in the `NAVIGATE` branch of `navigate()`:

```ts
case 'PLANET':
  if (to === 'LANDING') return startGate(state, 'LANDING', currentTime);
  if (to === 'SPACE_TRAVEL') return startGate(state, 'SPACE_TRAVEL', currentTime);
  if (to === 'STAR_MAP') {
    // Lazy-generate the star map if not yet present (deterministic by rngSeed)
    if (state.starMap === null) {
      const starMap = generateStarMap(state.rngSeed, 'sys_0');
      return { ...state, screen: 'STAR_MAP', starMap, lastError: null };
    }
    return { ...state, screen: 'STAR_MAP', lastError: null };
  }
  break;
```

Also add `case 'STAR_MAP':` to the `default:` fallthrough so `NAVIGATE` from
STAR_MAP to PLANET/SPACE_TRAVEL is rejected (player uses Back button instead):

```ts
case 'STAR_MAP':
  if (to === 'PLANET') {
    return { ...state, screen: 'PLANET', starMap: null, lastError: null };
  }
  break;
```

> Importing `generateStarMap` into `flow.ts` is allowed — both are in `engine/`.

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

Also pass `onChartCourse` to PlanetHubScreen:

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
```

> **Note:** If `App.test.tsx` uses a custom render wrapper, ensure the wrapper
> passes `starMap` and `routePath` defaults to new mock states. See phase-6-testing.md
> for the test helper pattern.
