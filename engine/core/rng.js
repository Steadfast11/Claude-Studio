// engine/core/rng.js — the only source of randomness in Voxel Studio.
// rng(seed)       → stateful seeded generator (use at build time: layouts, voxel jitter, patterns).
// hash(a, b, ...) → stateless float in [0,1) from integers (use at render time: particles as functions of t).
// Never call Math.random(): frames must be identical no matter which frame was rendered before.

export function hashInt(...xs) {
  let h = 0x811c9dc5 | 0;
  for (const x of xs) {
    let k = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
    k ^= k >>> 13; k = Math.imul(k, 0xc2b2ae35); k ^= k >>> 16;
    h = Math.imul(h ^ k, 0x01000193); h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); h ^= h >>> 16;
  return h >>> 0;
}

/** Stateless hash → [0,1). Arguments are truncated to integers. */
export const hash = (...xs) => hashInt(...xs) / 4294967296;

/** Turn any string into a 32-bit seed (so parts can derive sub-seeds by name). */
export function seedOf(str, base = 0) {
  let h = hashInt(base);
  for (let i = 0; i < str.length; i++) h = hashInt(h, str.charCodeAt(i));
  return h;
}

/** Seeded generator (mulberry32). */
export function rng(seed = 1) {
  let s = hashInt(seed) | 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    chance: (p) => next() < p,
    normal: () => { const u = 1 - next(), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    fork: (salt) => rng(hashInt(s, salt)),
  };
}
