import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarMapScreen } from './StarMapScreen';
import type { StarMapState } from '../../types/game-state';
import { generateStarMap } from '../../engine/starmap';

/**
 * Component-level tests for Actions 3, 4, 5:
 * Action 3: Clear Route — resets plannedRoute to empty.
 * Action 4: Plot Sequential Hop — adds node adjacent to the route tail.
 * Action 5: Invalid Sequential Hop — rejects node not adjacent to tail.
 */
describe('StarMapScreen — Action 3, 4, 5: Multi-hop & Clear', () => {
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

  describe('Action 3: Clear Route', () => {
    it('clicking Clear Route button calls onClearRoute callback', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('clear-route'));
      expect(mockClearRoute).toHaveBeenCalledTimes(1);
    });

    it('after Clear Route, itinerary empties and edge highlighting clears', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      const { rerender } = renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('clear-route'));
      expect(mockClearRoute).toHaveBeenCalledTimes(1);

      rerenderWithRoute(rerender, starMap, [], 0);

      expect(screen.getByTestId('route-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('itinerary-list')).not.toBeInTheDocument();

      const svg = screen.getByTestId('star-map-canvas').querySelector('svg');
      const activeEdges = svg?.querySelectorAll('[data-testid="route-edge-active"]');
      expect(activeEdges?.length).toBe(0);
    });
  });

  describe('Action 4: Plot Sequential Hop', () => {
    it('clicking sys_1 then sys_2 adds both to itinerary and highlights two edges', () => {
      const starMap = generateStarMap('test-seed', 'sys_0');
      const { rerender } = renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('node-sys_1'));
      expect(mockNodeToggle).toHaveBeenCalledWith('sys_1');
      rerenderWithRoute(rerender, starMap, ['sys_1'], 10);

      expect(screen.getByTestId('itinerary-list').children).toHaveLength(1);
      expect(screen.getByTestId('stop-index-sys_1')).toHaveTextContent('1.');

      fireEvent.click(screen.getByTestId('node-sys_2'));
      expect(mockNodeToggle).toHaveBeenCalledWith('sys_2');
      rerenderWithRoute(rerender, starMap, ['sys_1', 'sys_2'], 20);

      expect(screen.getByTestId('itinerary-list').children).toHaveLength(2);
      expect(screen.getByTestId('stop-index-sys_1')).toHaveTextContent('1.');
      expect(screen.getByTestId('stop-index-sys_2')).toHaveTextContent('2.');

      const svg = screen.getByTestId('star-map-canvas').querySelector('svg');
      const activeEdges = svg?.querySelectorAll('[data-testid="route-edge-active"]');
      expect(activeEdges?.length).toBeGreaterThan(1);
    });
  });

  describe('Action 5: Invalid Sequential Hop', () => {
    it('clicking sys_5 after sys_1 is rejected — route stays at [sys_1]', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1'],
      };
      const { rerender } = renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('node-sys_5'));
      expect(mockNodeToggle).toHaveBeenCalledWith('sys_5');

      rerenderWithRoute(rerender, starMap, ['sys_1'], 10);

      expect(screen.getByTestId('itinerary-list').children).toHaveLength(1);
      expect(screen.queryByTestId('stop-name-sys_5')).not.toBeInTheDocument();
    });
  });
});
