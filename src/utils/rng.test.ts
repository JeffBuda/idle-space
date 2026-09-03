import { describe, it, expect } from 'vitest';
import { createSeededRNG, createRandomSeed } from './rng';

describe('createSeededRNG', () => {
  it('produces the same sequence for the same seed', () => {
    const rng1 = createSeededRNG('test-seed');
    const rng2 = createSeededRNG('test-seed');
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = createSeededRNG('seed-a');
    const rng2 = createSeededRNG('seed-b');
    const vals1 = Array.from({ length: 10 }, () => rng1());
    const vals2 = Array.from({ length: 10 }, () => rng2());
    expect(vals1).not.toEqual(vals2);
  });

  it('always returns values in [0, 1)', () => {
    const rng = createSeededRNG('test');
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe('createRandomSeed', () => {
  it('returns a non-empty string', () => {
    expect(createRandomSeed().length).toBeGreaterThan(0);
  });

  it('produces different seeds on subsequent calls', () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seeds.add(createRandomSeed());
    }
    // Extremely unlikely to collide with 100 random 32-bit values
    expect(seeds.size).toBeGreaterThan(90);
  });
});
