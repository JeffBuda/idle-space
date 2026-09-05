import { describe, it, expect } from 'vitest';
import {
  generateStarMap,
  validateRoute,
  confirmRoute,
  estimateTravelTime,
  seedInitialRoute,
} from './starmap';
import { computeRoutePath } from '../utils/star-map';
import type { StarMapNode, StarMapState, StarMapRouteSegment } from '../types/game-state';

const SEED = 'test-seed';
const makeMap = () => generateStarMap(SEED, 'sys_0');

// 4-node chain for route tests: sys_0 <-> sys_1 <-> sys_2 <-> sys_3
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

const makeChain4Map = (): StarMapState => ({ nodes: chain4Nodes, edges: [] });
const makeDisconnMap = (): StarMapState => ({ nodes: disconnectedNodes, edges: [] });

const seg = (hops: number): StarMapRouteSegment => ({
  from: 'sys_0',
  to: 'sys_1',
  path: Array.from({ length: hops + 1 }, (_, i) => `node-${i}`),
  hops,
});

describe('generateStarMap', () => {
  it('is deterministic: same seed produces identical nodes and edges', () => {
    expect(generateStarMap(SEED, 'sys_0')).toEqual(generateStarMap(SEED, 'sys_0'));
  });

  it('generates 10 nodes', () => {
    expect(makeMap().nodes).toHaveLength(10);
  });

  it('marks sys_0 as the current node', () => {
    const map = makeMap();
    expect(map.nodes[0].status).toBe('current');
  });

  it('does not carry plannedRoute or zoomLevel (R17/R18)', () => {
    const map = makeMap();
    expect((map as Record<string, unknown>).plannedRoute).toBeUndefined();
    expect((map as Record<string, unknown>).zoomLevel).toBeUndefined();
  });
});

describe('estimateTravelTime', () => {
  it('returns 10s floor for 0 hops (deep-space first launch)', () => {
    expect(estimateTravelTime([])).toBe(10);
  });

  it('returns 10s for 1 hop', () => {
    expect(estimateTravelTime([seg(1)])).toBe(10);
  });

  it('returns 10s for 2 hops (2 * 5 = 10, floored to 10)', () => {
    expect(estimateTravelTime([seg(2)])).toBe(10);
  });

  it('returns 25s for 5 hops', () => {
    expect(estimateTravelTime([seg(5)])).toBe(25);
  });

  it('returns 300s ceiling for many hops', () => {
    expect(estimateTravelTime([seg(100)])).toBe(300);
  });

  it('sums hops across multiple segments', () => {
    expect(estimateTravelTime([seg(2), seg(3)])).toBe(25);
  });
});

describe('validateRoute', () => {
  it('returns true for a valid contiguous route', () => {
    expect(validateRoute(makeChain4Map(), ['sys_1', 'sys_2'], 'sys_0')).toBe(true);
  });

  it('returns true for a single-destination route', () => {
    expect(validateRoute(makeChain4Map(), ['sys_1'], 'sys_0')).toBe(true);
  });

  it('returns true for a deep-space (null origin) route', () => {
    expect(validateRoute(makeChain4Map(), ['sys_1'], null)).toBe(true);
  });

  it('returns false for an empty route', () => {
    expect(validateRoute(makeChain4Map(), [], 'sys_0')).toBe(false);
  });

  it('returns false for duplicate stops', () => {
    expect(validateRoute(makeChain4Map(), ['sys_1', 'sys_1'], 'sys_0')).toBe(false);
  });

  it('returns false for a nonexistent node', () => {
    expect(validateRoute(makeChain4Map(), ['sys_99'], 'sys_0')).toBe(false);
  });

  it('returns false for an unreachable destination (disconnected)', () => {
    expect(validateRoute(makeDisconnMap(), ['sys_3'], 'sys_0')).toBe(false);
  });
});

describe('confirmRoute', () => {
  it('validates and computes a valid route', () => {
    const result = confirmRoute(makeChain4Map(), ['sys_1', 'sys_2'], 'sys_0');
    expect(result.error).toBeNull();
    expect(result.routePath).toHaveLength(2);
    expect(result.routeTravelTimeSeconds).toBe(10);
    expect(result.starMap.nodes[0].status).toBe('visited');
  });

  it('returns error for an invalid route with disconnected nodes', () => {
    const result = confirmRoute(makeDisconnMap(), ['sys_3'], 'sys_0');
    expect(result.error).not.toBeNull();
    expect(result.routePath).toEqual([]);
    expect(result.routeTravelTimeSeconds).toBe(0);
  });

  it('returns error for empty plannedRoute', () => {
    const result = confirmRoute(makeChain4Map(), [], 'sys_0');
    expect(result.error).not.toBeNull();
    expect(result.routePath).toEqual([]);
  });

  it('marks origin node as visited in the returned starMap', () => {
    const result = confirmRoute(makeChain4Map(), ['sys_1'], 'sys_0');
    expect(result.starMap.nodes[0].status).toBe('visited');
    expect(result.starMap.nodes[1].status).toBe('unknown');
  });

  it('does not mutate the input starMap nodes', () => {
    const map = makeChain4Map();
    const originalNodes = JSON.parse(JSON.stringify(map.nodes));
    confirmRoute(map, ['sys_1'], 'sys_0');
    expect(map.nodes).toEqual(originalNodes);
  });
});

describe('seedInitialRoute', () => {
  it('returns a valid node ID from the star map', () => {
    const map = makeMap();
    const dest = seedInitialRoute(map, SEED, null);
    expect(map.nodes).toContainEqual(expect.objectContaining({ id: dest }));
  });

  it('returns a string (not a StarMapState)', () => {
    const map = makeMap();
    const result = seedInitialRoute(map, SEED, null);
    expect(typeof result).toBe('string');
  });

  it('skips currentLocation when selecting a destination', () => {
    const map = makeMap();
    const dest = seedInitialRoute(map, SEED, 'sys_0');
    expect(dest).not.toBe('sys_0');
  });

  it('is deterministic: same seed produces same destination', () => {
    const map = makeMap();
    expect(seedInitialRoute(map, SEED, null)).toBe(seedInitialRoute(map, SEED, null));
  });

  it('produces a different destination for a different seed', () => {
    const map = makeMap();
    const a = seedInitialRoute(map, 'seed-a', null);
    const b = seedInitialRoute(map, 'seed-b', null);
    expect(a).not.toBe(b);
  });
});

describe('computeRoutePath (via utils import)', () => {
  it('returns empty array for empty plannedRoute', () => {
    const map = makeChain4Map();
    expect(computeRoutePath(map.nodes, map.edges, [], 'sys_0')).toEqual([]);
  });

  it('returns null for unreachable destination (disconnected)', () => {
    const map = makeDisconnMap();
    expect(computeRoutePath(map.nodes, map.edges, ['sys_3'], 'sys_0')).toBeNull();
  });

  it('computes a single-leg route from origin', () => {
    const map = makeChain4Map();
    const result = computeRoutePath(map.nodes, map.edges, ['sys_1'], 'sys_0');
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].from).toBe('sys_0');
    expect(result![0].to).toBe('sys_1');
  });

  it('computes multi-leg route across waypoints', () => {
    const map = makeChain4Map();
    const result = computeRoutePath(map.nodes, map.edges, ['sys_1', 'sys_2'], 'sys_0');
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result![0].to).toBe('sys_1');
    expect(result![1].from).toBe('sys_1');
    expect(result![1].to).toBe('sys_2');
  });

  it('handles deep-space (null origin) degenerate first leg', () => {
    const map = makeChain4Map();
    const result = computeRoutePath(map.nodes, map.edges, ['sys_1'], null);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].to).toBe('sys_1');
    expect(result![0].hops).toBe(0);
  });
});

describe('immutability', () => {
  it('confirmRoute never mutates input starMap nodes', () => {
    const map = makeChain4Map();
    const originalNodes = JSON.parse(JSON.stringify(map.nodes));
    confirmRoute(map, ['sys_1', 'sys_2'], 'sys_0');
    expect(map.nodes).toEqual(originalNodes);
  });

  it('generateStarMap is deterministic and side-effect free', () => {
    const a = generateStarMap(SEED);
    const b = generateStarMap(SEED);
    expect(a).toEqual(b);
  });
});
