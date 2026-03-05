import { createNoise2D } from "simplex-noise";
import alea from "alea";

export type Noise2D = (x: number, y: number) => number;

const cache = new Map<number, Noise2D>();

export function getNoise2D(seed: number): Noise2D {
  const key = seed >>> 0;
  const existing = cache.get(key);
  if (existing) return existing;

  const prng = alea(String(key));
  const noise = createNoise2D(prng);
  cache.set(key, noise);
  return noise;
}
