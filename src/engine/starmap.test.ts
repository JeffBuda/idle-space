import { describe, it, expect } from 'vitest';
import {
  generateStarMap,
  findPath,
  toggleRouteNode,
  removeRouteNode,
  clearRoute,
  handleZoom,
  validateRoute,
  computeRoutePath,
  estimateTravelTime,
  confirmRoute,
  nodesConnected,
} from './starmap';
import type { StarMapNode, StarMapState, StarMapRouteSegment } from '../types/game-state';

const SEED = 'test-seed';
const makeMap = () => generateStarMap(SEED, 'sys_0');

// Custom 3-node chain: sys_0 <-> sys_1 <-> sys_2
const chainNodes: StarMapNode[] = [
  { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current', edges: ['sys_1'] },
  { id: 'sys_1', name: 'B', x: 50, y: 10, status: 'unknown', edges: ['sys_0', 'sys_2'] },
  { id: 'sys_2', name: 'C', x: 90, y: 10, status: 'unknown', edges: ['sys_1'] },
];

// 4-node graph with two disconnected components: {0-1} and {2-3}
const disconnectedNodes: StarMapNode[] = [
  { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current', edges: ['sys_1'] },
  { id: 'sys_1', name: 'B', x: 30, y: 10, status: 'unknown', edges: ['sys_0'] },
  { id: 'sys_2', name: 'C', x: 50, y: 50, status: 'unknown', edges: ['sys_3'] },
  { id: 'sys_3', name: 'D', x: 70, y: 50, status: 'unknown', edges: ['sys_2'] },
];

const makeChainMap = (): StarMapState => ({
  nodes: chainNodes,
  edges: [],
  plannedRoute: [],
  currentLocationId: 'sys_0',
  zoomLevel: 1.0,
});

const makeDisconnMap = (): StarMapState => ({
  nodes: disconnectedNodes,
  edges: [],
  plannedRoute: [],
  currentLocationId: 'sys_0',
  zoomLevel: 1.0,
});

const seg = (hops: number): StarMapRouteSegment => ({
  from: 'sys_0',
  to: 'sys_1',
  path: Array.from({ length: hops + 1 }, (_, i) => `n${i}`),
  hops,
});

describe('generateStarMap', () => {
  it('is deterministic: same seed produces identical nodes and edges', () => {
    expect(generateStarMap(SEED)).toEqual(generateStarMap(SEED));
  });

  it('generates 10 nodes', () => {
    expect(makeMap().nodes).toHaveLength(10);
  });

  it('sets currentLocationId to sys_0 and marks it current', () => {
    const map = makeMap();
    expect(map.currentLocationId).toBe('sys_0');
    expect(map.nodes[0].status).toBe('current');
  });

  it('ring connectivity: every node can reach the next via BFS', () => {
    const map = makeMap();
    for (let i = 0; i < 10; i++) {
      expect(findPath(map.nodes, `sys_${i}`, `sys_${(i + 1) % 10}`)).not.toBeNull();
    }
  });

  it('every node has 1-3 edges', () => {
    const map = makeMap();
    for (const node of map.nodes) {
      expect(node.edges.length).toBeGreaterThanOrEqual(1);
      expect(node.edges.length).toBeLessThanOrEqual(3);
    }
  });
});
