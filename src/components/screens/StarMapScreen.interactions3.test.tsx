import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarMapScreen } from './StarMapScreen';
import type { StarMapState } from '../../types/game-state';
import { generateStarMap } from '../../engine/starmap';

/**
 * Component-level tests for Actions 7, 8, and Go button:
 * Action 7: Deselect the Final Node (Pop) — tap or remove the last stop.
 * Action 8: Deselect a Middle Node (Sever the Tail) — tap or remove a middle stop.
 * Go button: Confirms the route and navigates.
 */
describe('StarMapScreen — Action 7, 8: Deselection & Go', () => {
  let mockNodeToggle: ReturnType<typeof vi.fn>;
  let mockRemoveStop: ReturnType<typeof vi.fn>;
  let mockClearRoute: ReturnType<typeof vi.fn>;
  let mockGo: ReturnType<typeof vi.fn>;

  const renderWithTrackedCallbacks = (starMap: StarMapState) => {
    const { rerender } = render(
      <StarMapScreen
        gameState={null}
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
        gameState={null}
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

  describe('Action 7: Deselect the Final Node (Pop)', () => {
    it('re-tapping the last route node calls onNodeToggle with that node', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('node-sys_2'));
      expect(mockNodeToggle).toHaveBeenCalledWith('sys_2');
    });

    it('remove-stop button for last node calls onRemoveStop and truncates', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      const { rerender } = renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('remove-stop-sys_2'));
      expect(mockRemoveStop).toHaveBeenCalledWith('sys_2');

      rerenderWithRoute(rerender, starMap, ['sys_1'], 5);

      expect(screen.getByTestId('itinerary-list').children).toHaveLength(1);
      expect(screen.queryByTestId('stop-name-sys_2')).not.toBeInTheDocument();
    });
  });

  describe('Action 8: Deselect a Middle Node (Sever the Tail)', () => {
    it('tapping sys_1 (middle node) calls onNodeToggle with sys_1', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2', 'sys_3'],
      };
      renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('node-sys_1'));
      expect(mockNodeToggle).toHaveBeenCalledWith('sys_1');
    });

    it('remove-stop for sys_1 truncates to empty', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2', 'sys_3'],
      };
      const { rerender } = renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('remove-stop-sys_1'));
      expect(mockRemoveStop).toHaveBeenCalledWith('sys_1');

      rerenderWithRoute(rerender, starMap, [], 0);

      expect(screen.getByTestId('route-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('itinerary-list')).not.toBeInTheDocument();
    });

    it('remove-stop for sys_2 (middle node) truncates to [sys_1]', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2', 'sys_3'],
      };
      const { rerender } = renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('remove-stop-sys_2'));
      expect(mockRemoveStop).toHaveBeenCalledWith('sys_2');

      rerenderWithRoute(rerender, starMap, ['sys_1'], 5);

      expect(screen.getByTestId('itinerary-list').children).toHaveLength(1);
      expect(screen.queryByTestId('stop-name-sys_2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('stop-name-sys_3')).not.toBeInTheDocument();
    });
  });

  describe('Go button interaction', () => {
    it('clicking Go with a valid route calls onGo callback', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1'],
      };
      renderWithTrackedCallbacks(starMap);

      fireEvent.click(screen.getByTestId('go-btn'));
      expect(mockGo).toHaveBeenCalledTimes(1);
    });
  });
});
