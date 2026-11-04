// engine/camera/rigs.js — camera rigs: each shot becomes a pure function t → { pos, look, lens, roll }.
// Rigs: static | move (aliases dolly, crane, push, pull) | orbit | track | whip.  Any rig accepts `handheld`.
//   { rig: 'static', at: 'bowl-close' }                         // named view (film/set `views`)
//   { rig: 'crane', from: 'wide-window', to: { pos: [..], look: 'hero' }, ease: 'weighty' }
//   { rig: 'orbit', around: 'hero', radius: 60, height: 15, from: -30, to: 20 }       // degrees
//   { rig: 'track', target: 'fruit', offset: [0, 4, 35], lag: 0.25, look: 'fruit', lead: 0.15 }
// Points accept anything the stage resolver understands: 'hero', 'choynak.spout', [x,y,z], { at, offset }.
import * as THREE from 'three';
import { ease } from '../anim/easing.js';
import { noise1, DEG } from '../core/math.js';

/** Focal length (mm, 36 mm-wide sensor) → vertical FOV in degrees for a given aspect. */
export function lensToFov(mm, aspect = 16 / 9) {
  const h = 2 * Math.atan(18 / mm);
  return (2 * Math.atan(Math.tan(h / 2) / aspect)) / DEG;
}

const V = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(...a));

/** Build the rig function for one shot. resolve(spec, t) → Vector3, views: { name: { pos, look, lens } } */
export function makeRig(shot, resolve, views = {}) {
  const view = (v) => (typeof v === 'string' ? (views[v] || (() => { throw new Error(`Unknown camera view "${v}"`); })()) : v);
  const pt = (spec, t) => (spec === undefined ? null : resolve(spec, t));
  const span = Math.max(shot.t1 - shot.t0, 1e-6);
  const e = ease(shot.ease || 'weighty');
  const u = (t) => e(Math.min(1, Math.max(0, (t - shot.t0) / span)));
  const lens0 = shot.lens ?? 50;
  let fn;
  const kind = shot.rig || 'static';
  if (kind === 'static') {
    const v = view(shot.at || shot);
    fn = (t) => ({ pos: pt(v.pos, t), look: pt(shot.look ?? v.look, t), lens: v.lens ?? lens0 });
  } else if (['move', 'dolly', 'crane', 'push', 'pull'].includes(kind)) {
    const a = view(shot.from), b = view(shot.to);
    fn = (t) => {
      const k = u(t);
      const la = a.lens ?? lens0, lb = b.lens ?? la;
      return { pos: pt(a.pos, t).lerp(pt(b.pos, t), k), look: pt(a.look, t).lerp(pt(b.look, t), k), lens: la + (lb - la) * k };
    };
  } else if (kind === 'orbit') {
    fn = (t) => {
      const c = pt(shot.around, t), ang = ((shot.from ?? 0) + ((shot.to ?? 0) - (shot.from ?? 0)) * u(t)) * DEG;
      const r = shot.radius ?? 60;
      return { pos: c.clone().add(new THREE.Vector3(Math.sin(ang) * r, shot.height ?? 10, Math.cos(ang) * r)), look: shot.look ? pt(shot.look, t) : c, lens: lens0 };
    };
  } else if (kind === 'track') {
    // camera rides with a smoothed copy of the target (weight), looks slightly ahead (lead)
    const lag = shot.lag ?? 0.25, lead = shot.lead ?? 0.1, off = V(shot.offset || [0, 6, 40]);
    const smooth = (t) => {
      const acc = new THREE.Vector3(); let wsum = 0;
      for (let i = 0; i <= 8; i++) { const tt = t - (i / 8) * lag * 2; const w = 1 - i / 9; acc.addScaledVector(pt(shot.target, Math.max(tt, 0)), w); wsum += w; }
      return acc.divideScalar(wsum);
    };
    const offEnd = shot.offsetTo ? V(shot.offsetTo) : off;
    fn = (t) => {
      const base = smooth(t);
      return { pos: base.clone().add(off.clone().lerp(offEnd, u(t))), look: pt(shot.look ?? shot.target, t + lead).add(V(shot.lookOffset || [0, 0, 0])), lens: lens0 };
    };
  } else if (kind === 'whip') {
    const a = view(shot.from), b = view(shot.to), we = ease('inOutExpo');
    fn = (t) => { const k = we(Math.min(1, Math.max(0, (t - shot.t0) / span))); return { pos: pt(a.pos, t).lerp(pt(b.pos, t), k), look: pt(a.look, t).lerp(pt(b.look, t), k), lens: a.lens ?? lens0 }; };
  } else throw new Error('Unknown camera rig ' + kind);

  // handheld: low-frequency positional + look noise (cm), deterministic
  const hh = shot.handheld ?? 0.25, seed = Math.round(shot.t0 * 1000) + 7;
  const roll = shot.roll ?? 0;
  return (t) => {
    const c = fn(t);
    if (hh > 0) {
      const f = 0.55;
      c.pos.x += noise1(t * f, seed) * hh; c.pos.y += noise1(t * f, seed + 1) * hh * 0.7; c.pos.z += noise1(t * f, seed + 2) * hh * 0.5;
      c.look.x += noise1(t * f * 1.3, seed + 3) * hh * 0.6; c.look.y += noise1(t * f * 1.3, seed + 4) * hh * 0.5;
    }
    c.roll = (roll + (hh > 0 ? noise1(t * 0.4, seed + 5) * hh * 0.6 : 0)) * DEG;
    return c;
  };
}
