// src/utils/star-map.test.ts
//
// Tests for the shared pure graph functions in src/utils/star-map.ts.
// These functions are consumed by BOTH engine/ and components/, so they
// live in the dependency-free utils/ layer and are tested here independently
// of either consumer.
import { describe, it, expect } from 'vitest';
import {
  findPath,
  nodesConnected,
  getNodeById,
  getNodeName,
  isEdgeBetween,
  isAdjacent,
  computeRoutePath,
} from './star-map';
import type { StarMapNode, StarMapEdge } from '../types/game-state';

// 3-node chain: sys_0 <-> sys_1 <-> sys_2
const chainNodes: StarMapNode[] = [
  { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current', edges: ['sys_1'] },
  { id: 'sys_1', name: 'B', x: 50, y: 10, status: 'unknown', edges: ['sys_0', 'sys_2'] },
  { id: 'sys_2', name: 'C', x: 90, y: 10, status: 'unknown', edges: ['sys_1'] },
];

// 4-node chain: sys_0 <-> sys_1 <-> sys_2 <-> sys_3
const chain4Nodes: StarMapNode[] = [
  { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current', edges: ['sys_1'] },
  { id: 'sys_1', name: 'B', x: 30, y: 10, status: 'unknown', edges: ['sys_0', 'sys_2'] },
  { id: 'sys_2', name: 'C', x: 60, y: 10, status: 'unknown', edges: ['sys_1', 'sys_3'] },
  { id: 'sys_3', name: 'D', x: 90, y: 10, status: 'unknown', edges: ['sys_2'] },
];

// Disconnected: {0-1} and {2-3}
const disconnectedNodes: StarMapNode[] = [
  { id: 'sys_0', name: 'A', x: 10, y: 10, status: 'current', edges: ['sys_1'] },
  { id: 'sys_1', name: 'B', x: 30, y: 10, status: 'unknown', edges: ['sys_0'] },
  { id: 'sys_2', name: 'C', x: 50, y: 50, status: 'unknown', edges: ['sys_3'] },
  { id: 'sys_3', name: 'D', x: 70, y: 50, status: 'unknown', edges: ['sys_2'] },
];

const emptyEdges: StarMapEdge[] = [];

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

describe('getNodeName', () => {
  it('returns the node name when found', () => {
    expect(getNodeName(chainNodes, 'sys_0')).toBe('A');
  });

  it('returns fallback when node not found', () => {
    expect(getNodeName(chainNodes, 'sys_99')).toBe('Planet X');
  });

  it('returns fallback when nodes is null', () => {
    expect(getNodeName(null, 'sys_0')).toBe('Planet X');
  });

  it('returns custom fallback when node not found', () => {
    expect(getNodeName(chainNodes, 'sys_99', 'Unknown System')).toBe('Unknown System');
  });

  it('returns fallback when id is null', () => {
    expect(getNodeName(chainNodes, null)).toBe('Planet X');
  });
});

describe('isEdgeBetween', () => {
  it('returns true for nodes that share a direct edge', () => {
    expect(isEdgeBetween(chainNodes, 'sys_0', 'sys_1')).toBe(true);
  });

  it('returns false for nodes without a direct edge', () => {
    expect(isEdgeBetween(chainNodes, 'sys_0', 'sys_2')).toBe(false);
  });

  it('returns false when either node does not exist', () => {
    expect(isEdgeBetween(chainNodes, 'sys_0', 'sys_99')).toBe(false);
    expect(isEdgeBetween(chainNodes, 'sys_99', 'sys_0')).toBe(false);
  });
});

describe('isAdjacent', () => {
  it('returns true for directly connected nodes', () => {
    expect(isAdjacent(chainNodes, 'sys_0', 'sys_1')).toBe(true);
  });

  it('returns false for non-adjacent nodes (BFS-reachable but no direct edge)', () => {
    // sys_0 and sys_2 are BFS-connected via sys_1, but share no direct edge
    expect(isAdjacent(chainNodes, 'sys_0', 'sys_2')).toBe(false);
  });

  it('returns false for disconnected components', () => {
    expect(isAdjacent(disconnectedNodes, 'sys_0', 'sys_3')).toBe(false);
  });

  it('returns false for non-existent nodes', () => {
    expect(isAdjacent(chainNodes, 'sys_0', 'sys_99')).toBe(false);
  });
});

describe('computeRoutePath', () => {
  it('returns empty array for empty plannedRoute', () => {
    expect(computeRoutePath(chain4Nodes, emptyEdges, [], 'sys_0')).toEqual([]);
  });

  it('returns null for unreachable destination (disconnected)', () => {
    expect(computeRoutePath(disconnectedNodes, emptyEdges, ['sys_3'], 'sys_0')).toBeNull();
  });

  it('computes a single-leg route from origin', () => {
    const result = computeRoutePath(chain4Nodes, emptyEdges, ['sys_1'], 'sys_0');
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].from).toBe('sys_0');
    expect(result![0].to).toBe('sys_1');
  });

  it('computes multi-leg route across waypoints', () => {
    const result = computeRoutePath(chain4Nodes, emptyEdges, ['sys_1', 'sys_2'], 'sys_0');
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result![0].to).toBe('sys_1');
    expect(result![1].from).toBe('sys_1');
    expect(result![1].to).toBe('sys_2');
  });

  it('handles deep-space (null origin) degenerate first leg', () => {
    const result = computeRoutePath(chain4Nodes, emptyEdges, ['sys_1'], null);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].to).toBe('sys_1');
    expect(result![0].hops).toBe(0);
  });

  it('handles deep-space multi-leg route', () => {
    const result = computeRoutePath(chain4Nodes, emptyEdges, ['sys_1', 'sys_2'], null);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result![0].to).toBe('sys_1');
    expect(result![0].hops).toBe(0);
    expect(result![1].from).toBe('sys_1');
    expect(result![1].to).toBe('sys_2');
  });
});
