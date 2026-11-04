// engine/anim/tracks.js — keyframe tracks and arc-length parameterised paths (pure functions of time).
//   const y = keyframes([[0, 0], [1, 10, 'outBack'], [2, 4]]);  y(1.5) → number (arrays interpolate per component)
//   const p = path([v0, v1, v2]);  p.at(s) → Vector3 at arc length s;  p.length
import * as THREE from 'three';
import { ease } from './easing.js';

/** keys: [[t, value, easeIntoThisKey?], ...] sorted by t. Values: number or array. Holds before first / after last. */
export function keyframes(keys) {
  const ks = keys.map(([t, v, e]) => ({ t, v, e: ease(e || 'inOutSine') }));
  const lerpV = (a, b, u) => (Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * u) : a + (b - a) * u);
  return (t) => {
    if (t <= ks[0].t) return ks[0].v;
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i].t) {
        const a = ks[i - 1], b = ks[i];
        return lerpV(a.v, b.v, b.e((t - a.t) / Math.max(b.t - a.t, 1e-9)));
      }
    }
    return ks[ks.length - 1].v;
  };
}

/** Centripetal Catmull–Rom through points, sampled by arc length. Degenerate (1 point) paths are allowed. */
export function path(points, { tension = 0.5, closed = false } = {}) {
  const pts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
  if (pts.length === 1) pts.push(pts[0].clone().add(new THREE.Vector3(1e-4, 0, 0)));
  const curve = pts.length === 2 ? new THREE.LineCurve3(pts[0], pts[1]) : new THREE.CatmullRomCurve3(pts, closed, 'centripetal', tension);
  curve.arcLengthDivisions = 400;
  const length = curve.getLength();
  return {
    points: pts, length, curve,
    at: (s, out = new THREE.Vector3()) => curve.getPointAt(Math.min(1, Math.max(0, s / Math.max(length, 1e-9))), out),
    tangent: (s) => curve.getTangentAt(Math.min(1, Math.max(0, s / Math.max(length, 1e-9)))),
  };
}

/**
 * Distance-over-time profile for travelling a length L.
 *  { dur, ease }            → s = L·ease(τ/dur)
 *  { speed, ramp }          → constant speed with smooth start/stop ramps (seconds)
 *  { speed: [v0, v1] }      → linear acceleration from v0 to v1 (accelerating chase)
 *  { keys: [[τ, f], ...] }  → distance fraction f at time τ, smooth monotone cubic between keys (first key [0, 0])
 * Returns { s(τ), dur } where τ is time since segment start.
 */
export function profile(L, o = {}) {
  if (o.keys) {
    const m = monotone(o.keys);
    const dur = o.keys[o.keys.length - 1][0];
    return { dur, s: (tau) => L * Math.min(1, Math.max(0, m(tau))) };
  }
  if (o.dur !== undefined && !o.speed) {
    const e = ease(o.ease || 'inOutSine');
    return { dur: o.dur, s: (tau) => L * e(Math.min(1, Math.max(0, tau / o.dur))) };
  }
  if (Array.isArray(o.speed)) {
    const [v0, v1] = o.speed;
    // s = v0 τ + ½ a τ², with a chosen so that v reaches v1 exactly at L
    const a = (v1 * v1 - v0 * v0) / (2 * Math.max(L, 1e-6));
    const dur = Math.abs(a) < 1e-9 ? L / v0 : (v1 - v0) / a;
    return { dur, s: (tau) => Math.min(L, v0 * Math.max(0, tau) + 0.5 * a * Math.max(0, tau) ** 2) };
  }
  const v = o.speed ?? 30, r = Math.min(o.ramp ?? 0.25, L / v / 2);
  // trapezoid speed profile; ramps are quadratic (smooth)
  const dur = L / v + r;
  return {
    dur,
    s: (tau) => {
      tau = Math.max(0, Math.min(dur, tau));
      if (r <= 0) return Math.min(L, v * tau);
      if (tau < r) return (v * tau * tau) / (2 * r);
      if (tau > dur - r) { const q = dur - tau; return L - (v * q * q) / (2 * r); }
      return v * r / 2 + v * (tau - r);
    },
  };
}

/** Monotone cubic (Fritsch–Carlson) interpolation through [[x, y], ...] (x increasing) — no overshoot, smooth slope,
 *  zero slope at both ends. */
export function monotone(pts) {
  const n = pts.length, x = pts.map((p) => p[0]), y = pts.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  // endpoints start and end at rest (zero slope); interior slopes average the neighbouring secants
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0; while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], u = (t - x[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}
