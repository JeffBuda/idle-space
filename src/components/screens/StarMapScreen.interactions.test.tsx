import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarMapScreen } from './StarMapScreen';
import type { StarMapState } from '../../types/game-state';
import { generateStarMap } from '../../engine/starmap';

/**
 * Component-level tests for Actions 1 & 2: Initial Hop
 * Action 1: Plot Initial Hop — tapping an adjacent node adds it to the route.
 * Action 2: Invalid Initial Hop — tapping a non-adjacent node is rejected.
 */
describe('StarMapScreen — Action 1 & 2: Initial Hop', () => {
  let mockNodeToggle: ReturnType<typeof vi.fn>;
  let mockRemoveStop: ReturnType<typeof vi.fn>;
  let mockClearRoute: ReturnType<typeof vi.fn>;
  let mockGo: ReturnType<typeof vi.fn>;

  const renderWithTrackedCallbacks = (starMap: StarMapState) => {
    const { rerender } = render(
      <StarMapScreen
        gameState={{
          currentLocation: 'sys_0',
          screen: 'STAR_MAP',
          starMap,
          routePath: [],
          routeTravelTimeSeconds: 0,
          lastError: null,
        }}
        starMap={starMap}
        routePath={[]}
        routeTravelTimeSeconds={0}
        onNodeToggle={mockNodeToggle}
        onRemoveStop={mockRemoveStop}
        onClearRoute={mockClearRoute}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onGo={mockGo}
        onBack={vi.fn()}
      />,
    );
    return { rerender };
  };

  const rerenderWithRoute = (
    rerender: ReturnType<typeof renderWithTrackedCallbacks>['rerender'],
    starMap: StarMapState,
    plannedRoute: string[],
    travelTime: number = 0,
  ) => {
    rerender(
      <StarMapScreen
        gameState={{
          currentLocation: 'sys_0',
          screen: 'STAR_MAP',
          starMap: { ...starMap, plannedRoute },
          routePath: [],
          routeTravelTimeSeconds: travelTime,
          lastError: null,
        }}
        starMap={{ ...starMap, plannedRoute }}
        routePath={[]}
        routeTravelTimeSeconds={travelTime}
        onNodeToggle={mockNodeToggle}
        onRemoveStop={mockRemoveStop}
        onClearRoute={mockClearRoute}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onGo={mockGo}
        onBack={vi.fn()}
      />,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNodeToggle = vi.fn();
    mockRemoveStop = vi.fn();
    mockClearRoute = vi.fn();
    mockGo = vi.fn();
  });

  it('clicking an adjacent node to sys_0 sets plannedRoute=[sys_1] and highlights the edge', () => {
    const starMap = generateStarMap('test-seed', 'sys_0');
    const { rerender } = renderWithTrackedCallbacks(starMap);

    fireEvent.click(screen.getByTestId('node-sys_1'));
    expect(mockNodeToggle).toHaveBeenCalledWith('sys_1');

    rerenderWithRoute(rerender, starMap, ['sys_1'], 5);

    expect(screen.getByTestId('itinerary-list')).toBeInTheDocument();
    expect(screen.getByTestId('stop-index-sys_1')).toHaveTextContent('1.');
    expect(screen.getByTestId('stop-name-sys_1')).toBeInTheDocument();
    expect(screen.getByTestId('remove-stop-sys_1')).toBeInTheDocument();

    const svg = screen.getByTestId('star-map-canvas').querySelector('svg');
    const activeEdges = svg?.querySelectorAll('[data-testid="route-edge-active"]');
    expect(activeEdges?.length).toBeGreaterThan(0);
  });

  it('clicking sys_3 (non-adjacent to sys_0) fires callback but route stays empty', () => {
    const starMap = generateStarMap('test-seed', 'sys_0');
    renderWithTrackedCallbacks(starMap);

    fireEvent.click(screen.getByTestId('node-sys_3'));
    expect(mockNodeToggle).toHaveBeenCalledWith('sys_3');

    expect(screen.getByTestId('route-empty')).toBeInTheDocument();
  });
});
