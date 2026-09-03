import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarMapScreen } from './StarMapScreen';
import type { StarMapScreenProps } from './StarMapScreen';
import { generateStarMap } from '../../engine/starmap';
import type { StarMapState, StarMapRouteSegment, GameState } from '../../types/game-state';

/**
 * Default mock callbacks shared across tests. Each is reset in beforeEach
 * via vi.clearAllMocks(), so call counts from prior tests don't bleed in.
 */
const mockCallbacks: Pick<
  StarMapScreenProps,
  'onNodeToggle' | 'onRemoveStop' | 'onClearRoute' | 'onZoomIn' | 'onZoomOut' | 'onGo' | 'onBack'
> = {
  onNodeToggle: vi.fn(),
  onRemoveStop: vi.fn(),
  onClearRoute: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onGo: vi.fn(),
  onBack: vi.fn(),
};

/**
 * Helper: render the StarMapScreen with a generated star map and optional
 * overrides for routePath / callbacks.
 */
const renderScreen = (
  starMap: StarMapState | null,
  overrides: Partial<StarMapScreenProps> = {},
) => {
  render(
    <StarMapScreen
      gameState={null}
      starMap={starMap}
      routePath={[]}
      routeTravelTimeSeconds={0}
      {...mockCallbacks}
      {...overrides}
    />,
  );
};

describe('StarMapScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  describe('rendering', () => {
    it('returns null when starMap is null', () => {
      const { container } = render(
        <StarMapScreen
          gameState={null}
          starMap={null}
          routePath={[]}
          routeTravelTimeSeconds={0}
          {...mockCallbacks}
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders the screen title', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByTestId('star-map-title')).toHaveTextContent('Stellar Cartography');
    });

    it('renders zoom in/out controls and back button', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByTestId('zoom-in')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out')).toBeInTheDocument();
      expect(screen.getByTestId('back-btn')).toBeInTheDocument();
    });

    it('renders the zoom level as a percentage', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByTestId('zoom-level').textContent).toBe('100%');
    });

    it('applies a CSS transform scale to the canvas reflecting zoomLevel', () => {
      const starMap = { ...generateStarMap('test-seed', 'sys_0'), zoomLevel: 1.5 };
      renderScreen(starMap);
      const canvas = screen.getByTestId('star-map-canvas');
      expect(canvas.style.transform).toBe('scale(1.5)');
    });

    it('renders all star map nodes', () => {
      const starMap = generateStarMap('test-seed', 'sys_0');
      renderScreen(starMap);
      starMap.nodes.forEach((node) => {
        expect(screen.getByTestId(`node-${node.id}`)).toBeInTheDocument();
      });
    });

    it('renders the SVG canvas with an svg child', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      const canvas = screen.getByTestId('star-map-canvas');
      expect(canvas.querySelector('svg')).not.toBeNull();
    });

    it('shows the empty route prompt when plannedRoute is empty', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByTestId('route-empty')).toHaveTextContent(
        'Click stars on the map to plot a course.',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Itinerary / route panel
  // ---------------------------------------------------------------------------
  describe('itinerary list', () => {
    it('shows the itinerary list when plannedRoute has nodes', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      renderScreen(starMap);
      expect(screen.getByTestId('itinerary-list')).toBeInTheDocument();
      expect(screen.getByTestId('stop-index-sys_1')).toHaveTextContent('1.');
      expect(screen.getByTestId('stop-name-sys_1')).toBeInTheDocument();
      expect(screen.getByTestId('stop-index-sys_2')).toHaveTextContent('2.');
      expect(screen.getByTestId('stop-name-sys_2')).toBeInTheDocument();
    });

    it('renders remove-stop buttons for each itinerary stop', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      renderScreen(starMap);
      expect(screen.getByTestId('remove-stop-sys_1')).toBeInTheDocument();
      expect(screen.getByTestId('remove-stop-sys_2')).toBeInTheDocument();
    });

    it('displays the total travel time in the route summary', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1'],
      };
      render(
        <StarMapScreen
          gameState={null}
          starMap={starMap}
          routePath={[]}
          routeTravelTimeSeconds={30}
          {...mockCallbacks}
        />,
      );
      expect(screen.getByTestId('total-travel-time').textContent).toContain('30s');
    });

    it('renders Clear Route and Go buttons when plannedRoute is non-empty', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1'],
      };
      renderScreen(starMap);
      expect(screen.getByTestId('clear-route')).toBeInTheDocument();
      expect(screen.getByTestId('go-btn')).toBeInTheDocument();
    });

    it('does not render Go or Clear Route buttons when route is empty', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.queryByTestId('go-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('clear-route')).not.toBeInTheDocument();
    });
  });

  describe('node interactions', () => {
    it('calls onNodeToggle with the nodeId when a non-current node is clicked', () => {
      const onNodeToggle = vi.fn();
      renderScreen(generateStarMap('test-seed', 'sys_0'), { onNodeToggle });
      fireEvent.click(screen.getByTestId('node-sys_1'));
      expect(onNodeToggle).toHaveBeenCalledTimes(1);
      expect(onNodeToggle).toHaveBeenCalledWith('sys_1');
    });

    it('sets cursor to default on the current node', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByTestId('node-sys_0').style.cursor).toBe('default');
    });

    it('sets cursor to pointer on non-current nodes', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByTestId('node-sys_1').style.cursor).toBe('pointer');
    });

    it('renders a larger circle for the current node', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      const currentNode = screen.getByTestId('node-sys_0');
      const circle = currentNode.querySelector('circle');
      expect(circle?.getAttribute('r')).toBe('2.2');
    });

    it('renders a smaller circle for non-current nodes', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      const node = screen.getByTestId('node-sys_1');
      const circle = node.querySelector('circle');
      expect(circle?.getAttribute('r')).toBe('1.2');
    });
  });

  describe('zoom and navigation', () => {
    it('calls onZoomIn when the zoom-in button is clicked', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      fireEvent.click(screen.getByTestId('zoom-in'));
      expect(mockCallbacks.onZoomIn).toHaveBeenCalledTimes(1);
    });

    it('calls onZoomOut when the zoom-out button is clicked', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      fireEvent.click(screen.getByTestId('zoom-out'));
      expect(mockCallbacks.onZoomOut).toHaveBeenCalledTimes(1);
    });

    it('calls onBack when the back button is clicked', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      fireEvent.click(screen.getByTestId('back-btn'));
      expect(mockCallbacks.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('route panel callbacks', () => {
    it('calls onRemoveStop with the correct nodeId when remove-stop is clicked', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      const onRemoveStop = vi.fn();
      renderScreen(starMap, { onRemoveStop });
      fireEvent.click(screen.getByTestId('remove-stop-sys_1'));
      expect(onRemoveStop).toHaveBeenCalledWith('sys_1');
    });

    it('calls onClearRoute when the clear-route button is clicked', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1'],
      };
      renderScreen(starMap);
      fireEvent.click(screen.getByTestId('clear-route'));
      expect(mockCallbacks.onClearRoute).toHaveBeenCalledTimes(1);
    });

    it('calls onGo when the Go button is clicked', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1'],
      };
      renderScreen(starMap);
      fireEvent.click(screen.getByTestId('go-btn'));
      expect(mockCallbacks.onGo).toHaveBeenCalledTimes(1);
    });
  });

  describe('route path polyline', () => {
    const seg = (to: string): StarMapRouteSegment => ({
      from: 'sys_0',
      to,
      path: ['sys_0', to],
      hops: 1,
    });

    it('renders a route path polyline when routePath has at least one segment', () => {
      const starMap = generateStarMap('test-seed', 'sys_0');
      const routePath = [seg('sys_1')];
      const { container } = render(
        <StarMapScreen
          gameState={null}
          starMap={starMap}
          routePath={routePath}
          routeTravelTimeSeconds={10}
          {...mockCallbacks}
        />,
      );
      expect(container.querySelector('.star-map-route')).not.toBeNull();
    });

    it('renders a route path polyline for multiple segments', () => {
      const starMap = generateStarMap('test-seed', 'sys_0');
      const routePath = [seg('sys_1'), seg('sys_2')];
      const { container } = render(
        <StarMapScreen
          gameState={null}
          starMap={starMap}
          routePath={routePath}
          routeTravelTimeSeconds={10}
          {...mockCallbacks}
        />,
      );
      expect(container.querySelector('.star-map-route')).not.toBeNull();
    });

    it('does not render a route path polyline when routePath is empty', () => {
      const { container } = render(
        <StarMapScreen
          gameState={null}
          starMap={generateStarMap('test-seed', 'sys_0')}
          routePath={[]}
          routeTravelTimeSeconds={0}
          {...mockCallbacks}
        />,
      );
      expect(container.querySelector('.star-map-route')).toBeNull();
    });
  });

  describe('edge highlighting', () => {
    it('highlights edges between planned route nodes', () => {
      const starMap = {
        ...generateStarMap('test-seed', 'sys_0'),
        plannedRoute: ['sys_1', 'sys_2'],
      };
      renderScreen(starMap);
      const svg = screen.getByTestId('star-map-canvas').querySelector('svg');
      const routeEdges = svg?.querySelectorAll('.star-map-edge--route');
      expect(routeEdges?.length).toBeGreaterThan(0);
    });

    it('does not highlight any edges when plannedRoute is empty', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      const svg = screen.getByTestId('star-map-canvas').querySelector('svg');
      const routeEdges = svg?.querySelectorAll('.star-map-edge--route');
      expect(routeEdges?.length).toBe(0);
    });
  });

  describe('accessibility', () => {
    it('has aria-labels on zoom buttons', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
      expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    });

    it('back button has accessible name from text content', () => {
      renderScreen(generateStarMap('test-seed', 'sys_0'));
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });
  });

  describe('gameState prop', () => {
    it('accepts null gameState without errors', () => {
      expect(() => renderScreen(generateStarMap('test-seed', 'sys_0'))).not.toThrow();
    });

    it('accepts a populated GameState without errors', () => {
      const gameState = {
        lastTimestamp: 1000,
        elapsedSeconds: 0,
        totalElapsedGameTime: 0,
        rngSeed: 'seed',
        totalDistanceKm: 0,
        version: '0.1.0',
        screen: 'STAR_MAP',
        idleTimer: null,
        oreCounts: { commonOre: 0, rareOre: 0 },
        selectedOre: null,
        constants: { defaultActionTimeSeconds: 30, rareOreTimeMultiplier: 2 },
        lastError: null,
        starMap: null,
        routePath: [],
        routeTravelTimeSeconds: 0,
      };
      renderScreen(generateStarMap('test-seed', 'sys_0'), { gameState });
      expect(screen.getByTestId('star-map-screen')).toBeInTheDocument();
    });
  });
});
