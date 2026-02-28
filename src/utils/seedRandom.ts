/**
 * Seeded PRNG (mulberry32) for deterministic planet/level generation.
 * Single global generator: setSeed() before a run, then random() for all draws.
 */

let state = 0;

export function setSeed(seed: number): void {
  state = seed >>> 0;
}

/** Returns a number in [0, 1). */
export function random(): number {
  state = (state + 0x6d2b79f5) | 0; // mulberry32
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
