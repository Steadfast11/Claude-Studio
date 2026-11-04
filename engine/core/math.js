// engine/core/math.js — small scalar/vector helpers and deterministic smooth noise.
// Everything here is pure. Noise functions take an optional integer seed.
import { hashInt } from './rng.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x, a, b, c, d, clampIt = true) => {
  const u = invLerp(a, b, x);
  return lerp(c, d, clampIt ? clamp(u) : u);
};
export const smoothstep = (a, b, x) => { const u = clamp(invLerp(a, b, x)); return u * u * (3 - 2 * u); };
export const fract = (x) => x - Math.floor(x);
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Shortest-path angle interpolation (radians). */
export const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
/** Window that is 0 outside [t0,t1], ramps in over `fin` and out over `fout` (both smooth). */
export const envelope = (t, t0, t1, fin = 0.1, fout = 0.1) =>
  Math.min(smoothstep(t0, t0 + Math.max(fin, 1e-6), t), 1 - smoothstep(t1 - Math.max(fout, 1e-6), t1, t));
/** Damped oscillation impulse response, 0 for u<0: amplitude * e^(-damp u) * sin(freq·2π u). */
export const ring = (u, freq = 3, damp = 6, amplitude = 1) => (u < 0 ? 0 : amplitude * Math.exp(-damp * u) * Math.sin(TAU * freq * u));

// ---------- gradient noise (Perlin-style), 1D/2D/3D ----------
const grad1 = (i, s) => (hashInt(i, s) / 4294967296) * 2 - 1;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  return lerp(grad1(i, seed) * f, grad1(i + 1, seed) * (f - 1), fade(f)) * 2;
}

function g2(ix, iy, s, x, y) {
  const h = hashInt(ix, iy, s) & 7;
  const a = (h * Math.PI) / 4;
  return Math.cos(a) * x + Math.sin(a) * y;
}
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fade(fx), v = fade(fy);
  return lerp(
    lerp(g2(ix, iy, seed, fx, fy), g2(ix + 1, iy, seed, fx - 1, fy), u),
    lerp(g2(ix, iy + 1, seed, fx, fy - 1), g2(ix + 1, iy + 1, seed, fx - 1, fy - 1), u), v) * 1.4;
}

const G3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
function g3(ix, iy, iz, s, x, y, z) { const g = G3[hashInt(ix, iy, iz, s) % 12]; return g[0] * x + g[1] * y + g[2] * z; }
export function noise3(x, y, z, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz, u = fade(fx), v = fade(fy), w = fade(fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(g3(ix, iy, iz, seed, fx, fy, fz), g3(ix + 1, iy, iz, seed, fx - 1, fy, fz), u),
      l(g3(ix, iy + 1, iz, seed, fx, fy - 1, fz), g3(ix + 1, iy + 1, iz, seed, fx - 1, fy - 1, fz), u), v),
    l(l(g3(ix, iy, iz + 1, seed, fx, fy, fz - 1), g3(ix + 1, iy, iz + 1, seed, fx - 1, fy, fz - 1), u),
      l(g3(ix, iy + 1, iz + 1, seed, fx, fy - 1, fz - 1), g3(ix + 1, iy + 1, iz + 1, seed, fx - 1, fy - 1, fz - 1), u), v), w);
}

/** Fractal sum of noise2 (octaves of halving amplitude). */
export function fbm2(x, y, seed = 0, octaves = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { s += a * noise2(x * f, y * f, seed + i * 17); f *= 2; a *= 0.5; }
  return s;
}
