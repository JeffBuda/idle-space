// src/utils/rng.ts
//
// Centralized RNG utilities for the Space Idle engine.
//
// Two functions serve different purposes:
//   - createSeededRNG: deterministic PRNG for reproducible procedural generation.
//     Same seed always produces the same sequence — essential for testable,
//     repeatable determinism per the engine rules.
//   - createRandomSeed: entropy source for the initial game-state seed.
//     Uses the Web Crypto API (crypto.getRandomValues) — never Math.random().
//
// This module is dependency-free (utils layer cannot import from
// engine/db/hooks/components per the ESLint boundary rules).
//

/** Djb2 hash — deterministic seed-to-number for the LCG. Pure: same seed = same seq. */
const djb2Hash = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1;
};

/**
 * Deterministic LCG PRNG — same seed produces the same random sequence.
 * Used by the star map generator and any other procedural content.
 */
export const createSeededRNG = (seed: string) => {
  let state = djb2Hash(seed);
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
};

/**
 * Generate a random seed string using the Web Crypto API for entropy.
 * Replaces Math.random() which is banned project-wide.
 */
export const createRandomSeed = (): string => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0].toString(36);
};
