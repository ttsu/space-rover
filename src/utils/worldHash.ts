export function hashToUnit(
  seed: number,
  ...parts: (string | number)[]
): number {
  let h = seed >>> 0;
  for (const part of parts) {
    if (typeof part === "number") {
      h = mix(h, part | 0);
      continue;
    }
    for (let i = 0; i < part.length; i++) {
      h = mix(h, part.charCodeAt(i));
    }
  }
  return finalize(h);
}

function mix(hash: number, value: number): number {
  let h = hash ^ (value + 0x9e3779b9 + (hash << 6) + (hash >> 2));
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return h ^ (h >>> 16);
}

function finalize(state: number): number {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
