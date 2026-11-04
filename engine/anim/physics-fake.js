// engine/anim/physics-fake.js — closed-form "physics": no integration, every function is pure in time.
//   arcPoint(p0, p1, apex, u)   hop/leap/fall trajectory      bounceY(h0, t, g, e)  decaying bounces
//   ballistic(p0, v0, g, t)     particle flight               squash(s)             volume-preserving scale
//   wobble(u, f, damp)          damped shake                  settle(u, k)          overshoot then settle to 1
import * as THREE from 'three';
import { TAU } from '../core/math.js';

/**
 * Parabolic arc from p0 to p1 (u∈[0,1], linear in x/z like real ballistics).
 * apex: extra height above the higher endpoint; apex = 0 with p1 lower gives a horizontal launch (falling off an edge).
 */
export function arcPoint(p0, p1, apex, u, out = new THREE.Vector3()) {
  out.lerpVectors(p0, p1, u);
  const y0 = p0.y, y1 = p1.y;
  if (apex <= 0 && y1 < y0) { out.y = y0 + (y1 - y0) * u * u; return out; }
  const top = Math.max(y0, y1) + Math.max(apex, 0);
  // y(u) = y0 + b u + c u², with max = top: solve for b, c (take the root with apex inside [0,1])
  const d0 = top - y0, d1 = top - y1;
  const sb = Math.sqrt(Math.max(d0, 1e-9)), sc = Math.sqrt(Math.max(d1, 1e-9));
  const ua = sb / (sb + sc); // apex parameter
  const c = -d0 / (ua * ua);
  const b = -2 * c * ua;
  out.y = y0 + b * u + c * u * u;
  return out;
}

/** Height above floor of a dropped object with restitution e (0..1): closed-form sum over bounces. */
export function bounceY(h0, t, g = 981, e = 0.45, maxBounces = 6) {
  if (t < 0) return h0;
  const tFall = Math.sqrt((2 * h0) / g);
  if (t < tFall) return h0 - 0.5 * g * t * t;
  let tt = t - tFall, v = g * tFall * e;
  for (let i = 0; i < maxBounces; i++) {
    const dur = (2 * v) / g;
    if (tt < dur) return v * tt - 0.5 * g * tt * tt;
    tt -= dur; v *= e;
  }
  return 0;
}

export function ballistic(p0, v0, g, t, out = new THREE.Vector3()) {
  return out.set(p0.x + v0.x * t, p0.y + v0.y * t - 0.5 * g * t * t, p0.z + v0.z * t);
}

/** Ballistic with a floor at floorY and restitution e; also returns how many times it bounced. */
export function ballisticFloor(p0, v0, g, t, floorY, e = 0.35, friction = 0.6, out = new THREE.Vector3()) {
  let p = p0.clone(), v = v0.clone(), tt = t, bounces = 0;
  for (let i = 0; i < 4; i++) {
    // time to reach floor: p.y + v.y τ − ½gτ² = floorY
    const a = -0.5 * g, b = v.y, c = p.y - floorY;
    const disc = b * b - 4 * a * c;
    const tHit = disc < 0 ? Infinity : (-b - Math.sqrt(disc)) / (2 * a);
    if (!(tHit > 1e-6) || tt < tHit) { ballistic(p, v, g, tt, out); out.y = Math.max(out.y, floorY); return { pos: out, bounces }; }
    ballistic(p, v, g, tHit, p); p.y = floorY;
    v.set(v.x * friction, -(v.y - g * tHit) * e, v.z * friction);
    tt -= tHit; bounces++;
    if (v.y < 15) { // resting: slide to a stop
      const k = 4, s = (1 - Math.exp(-k * tt)) / k;
      return { pos: out.set(p.x + v.x * s, floorY, p.z + v.z * s), bounces };
    }
  }
  return { pos: out.copy(p), bounces };
}

/** Volume-preserving squash: s>1 stretches vertically. Returns [sx, sy, sz]. */
export const squash = (s) => { const k = 1 / Math.sqrt(Math.max(s, 0.05)); return [k, s, k]; };
export const wobble = (u, freq = 4, damp = 5) => (u < 0 ? 0 : Math.exp(-damp * u) * Math.sin(TAU * freq * u));
/** 0→1 with overshoot (k≈ how springy). */
export const settle = (u, k = 1) => (u <= 0 ? 0 : 1 - Math.exp(-6 * u) * Math.cos(TAU * 1.1 * u * k));
