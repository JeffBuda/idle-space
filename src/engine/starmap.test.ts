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
  getNodeById,
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

// 4-node chain for computeRoutePath / validateRoute: sys_0 <-> sys_1 <-> sys_2 <-> sys_3
const chain4Nodes: StarMapNode[] = [
  { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current', edges: ['sys_1'] },
  { id: 'sys_1', name: 'B', x: 30, y: 10, status: 'unknown', edges: ['sys_0', 'sys_2'] },
  { id: 'sys_2', name: 'C', x: 60, y: 10, status: 'unknown', edges: ['sys_1', 'sys_3'] },
  { id: 'sys_3', name: 'D', x: 90, y: 10, status: 'unknown', edges: ['sys_2'] },
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

const makeChain4Map = (): StarMapState => ({
  nodes: chain4Nodes,
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

describe('findPath', () => {
  it('finds an adjacent path', () => {
    expect(findPath(chainNodes, 'sys_0', 'sys_1')).toEqual(['sys_0', 'sys_1']);
  });

  it('finds a multi-hop path', () => {
    expect(findPath(chainNodes, 'sys_0', 'sys_2')).toEqual(['sys_0', 'sys_1', 'sys_2']);
  });

  it('returns a single-element path for the same node', () => {
    expect(findPath(chainNodes, 'sys_0', 'sys_0')).toEqual(['sys_0']);
  });

  it('returns null for unreachable nodes', () => {
    expect(findPath(disconnectedNodes, 'sys_0', 'sys_3')).toBeNull();
  });

  it('is symmetric: A->B and B->A have the same path length', () => {
    const ab = findPath(chainNodes, 'sys_0', 'sys_2');
    const ba = findPath(chainNodes, 'sys_2', 'sys_0');
    expect(ab).not.toBeNull();
    expect(ba).not.toBeNull();
    expect(ab!.length).toBe(ba!.length);
  });
});

describe('nodesConnected', () => {
  it('returns true for connected nodes', () => {
    expect(nodesConnected(chainNodes, 'sys_0', 'sys_2')).toBe(true);
  });

  it('returns false for disconnected components', () => {
    expect(nodesConnected(disconnectedNodes, 'sys_0', 'sys_3')).toBe(false);
  });
});

describe('getNodeById', () => {
  it('returns the node when it exists', () => {
    const node = getNodeById(chainNodes, 'sys_0');
    expect(node).toBeDefined();
    expect(node?.id).toBe('sys_0');
    expect(node?.name).toBe('A');
  });

  it('returns undefined when the node does not exist', () => {
    expect(getNodeById(chainNodes, 'sys_99')).toBeUndefined();
  });
});

describe('toggleRouteNode', () => {
  it('adds a reachable node to the empty route', () => {
    const result = toggleRouteNode(makeChainMap(), 'sys_1');
    expect(result.plannedRoute).toEqual(['sys_1']);
  });

  it('rejects the current location node (no change)', () => {
    const result = toggleRouteNode(makeChainMap(), 'sys_0');
    expect(result.plannedRoute).toEqual([]);
  });

  it('rejects unreachable nodes (no change)', () => {
    const result = toggleRouteNode(makeDisconnMap(), 'sys_3');
    expect(result.plannedRoute).toEqual([]);
  });

  it('removes a node when toggled off', () => {
    const withNode = toggleRouteNode(makeChainMap(), 'sys_1');
    expect(withNode.plannedRoute).toEqual(['sys_1']);
    const removed = toggleRouteNode(withNode, 'sys_1');
    expect(removed.plannedRoute).toEqual([]);
  });
});

describe('removeRouteNode', () => {
  it('removes a middle node and bridges the gap', () => {
    const map: StarMapState = { ...makeChain4Map(), plannedRoute: ['sys_1', 'sys_2', 'sys_3'] };
    const result = removeRouteNode(map, 'sys_2');
    expect(result.plannedRoute).toEqual(['sys_1', 'sys_3']);
  });

  it('truncates to before-only when bridge is impossible', () => {
    const map: StarMapState = { ...makeDisconnMap(), plannedRoute: ['sys_1', 'sys_3', 'sys_2'] };
    const result = removeRouteNode(map, 'sys_3');
    expect(result.plannedRoute).toEqual(['sys_1']);
  });
});

describe('validateRoute', () => {
  it('returns true for a valid route', () => {
    const map: StarMapState = { ...makeChain4Map(), plannedRoute: ['sys_1', 'sys_2', 'sys_3'] };
    expect(validateRoute(map)).toBe(true);
  });

  it('returns false for an empty route', () => {
    expect(validateRoute(makeChainMap())).toBe(false);
  });

  it('returns false for duplicate stops', () => {
    const map: StarMapState = { ...makeChainMap(), plannedRoute: ['sys_1', 'sys_1'] };
    expect(validateRoute(map)).toBe(false);
  });

  it('returns false for a nonexistent node', () => {
    const map: StarMapState = { ...makeChainMap(), plannedRoute: ['sys_99'] };
    expect(validateRoute(map)).toBe(false);
  });

  it('returns false for an unreachable stop', () => {
    const map: StarMapState = { ...makeDisconnMap(), plannedRoute: ['sys_3'] };
    expect(validateRoute(map)).toBe(false);
  });
});

describe('computeRoutePath', () => {
  it('returns one segment per leg for a valid route', () => {
    const map: StarMapState = { ...makeChain4Map(), plannedRoute: ['sys_1', 'sys_2', 'sys_3'] };
    const segments = computeRoutePath(map);
    expect(segments).not.toBeNull();
    expect(segments).toHaveLength(3);
    expect(segments![0].from).toBe('sys_0');
    expect(segments![0].to).toBe('sys_1');
    expect(segments![0].hops).toBe(1);
  });

  it('returns null when a leg is unreachable', () => {
    const map: StarMapState = { ...makeDisconnMap(), plannedRoute: ['sys_3'] };
    expect(computeRoutePath(map)).toBeNull();
  });
});

describe('estimateTravelTime', () => {
  it('computes 5s per hop (6 hops -> 30s)', () => {
    expect(estimateTravelTime([seg(6)])).toBe(30);
  });

  it('clamps the minimum to 10s (0 hops -> 10s)', () => {
    expect(estimateTravelTime([])).toBe(10);
  });

  it('clamps the maximum to 300s (100 hops -> 300s)', () => {
    expect(estimateTravelTime([seg(100)])).toBe(300);
  });
});

describe('handleZoom', () => {
  it('zooms in by STEP (1.0 -> 1.3)', () => {
    const map = makeChainMap();
    const result = handleZoom(map, 'in');
    expect(result.zoomLevel).toBeCloseTo(1.3);
  });

  it('zooms out by STEP (1.0 -> 0.7)', () => {
    const map = makeChainMap();
    const result = handleZoom(map, 'out');
    expect(result.zoomLevel).toBeCloseTo(0.7);
  });

  it('clamps to the maximum (2.9 -> 3.0)', () => {
    const map: StarMapState = { ...makeChainMap(), zoomLevel: 2.9 };
    const result = handleZoom(map, 'in');
    expect(result.zoomLevel).toBeCloseTo(3.0);
  });

  it('clamps to the minimum (0.5 -> 0.4)', () => {
    const map: StarMapState = { ...makeChainMap(), zoomLevel: 0.5 };
    const result = handleZoom(map, 'out');
    expect(result.zoomLevel).toBeCloseTo(0.4);
  });
});

describe('clearRoute', () => {
  it('clears the planned route to an empty array', () => {
    const map: StarMapState = { ...makeChainMap(), plannedRoute: ['sys_1', 'sys_2'] };
    expect(clearRoute(map).plannedRoute).toEqual([]);
  });
});

describe('confirmRoute', () => {
  it('validates and computes a valid route', () => {
    const map: StarMapState = { ...makeChain4Map(), plannedRoute: ['sys_1', 'sys_2'] };
    const result = confirmRoute(map, 'seed');
    expect(result.error).toBeNull();
    expect(result.routePath).toHaveLength(2);
    expect(result.routeTravelTimeSeconds).toBe(10);
    expect(result.starMap.nodes[0].status).toBe('visited');
  });

  it('rejects an invalid route with an error message', () => {
    const map: StarMapState = { ...makeDisconnMap(), plannedRoute: ['sys_3'] };
    const result = confirmRoute(map, 'seed');
    expect(result.error).not.toBeNull();
    expect(result.routePath).toEqual([]);
    expect(result.routeTravelTimeSeconds).toBe(0);
  });
});

describe('immutability', () => {
  it('never mutates the input state across calls', () => {
    const map = makeChainMap();
    const original = JSON.parse(JSON.stringify(map));
    const withNode = toggleRouteNode(map, 'sys_1');
    const cleared = clearRoute(withNode);
    const zoomed = handleZoom(map, 'in');

    expect(map.plannedRoute).toEqual(original.plannedRoute);
    expect(map.zoomLevel).toBe(original.zoomLevel);
    expect(withNode).not.toBe(map);
    expect(cleared).not.toBe(withNode);
    expect(zoomed).not.toBe(map);
  });
});
