// engine/anim/motion.js — root motion of anything that moves (characters, rolling fruit, thrown props).
//
// A Motion is a time-ordered list of segments (path, arc, follow, attach, hold). Positions are pure functions of t
// (`rawPos`). Path-dependent quantities — distance travelled, smoothed heading, rolling rotation — are baked by
// re-simulating from t = 0 with a fixed step (lazily, on demand), so any frame can be rendered in any order.
//
//   const m = new Motion({ start: new Vector3(0,0,0), ground: (x, z) => 0, lift: 0, radius: 4 });
//   m.path(1.0, [p1, p2], { speed: [20, 90] });   m.arc(3.0, to, { dur: 0.5, apex: 6 });
//   m.follow(5.6, other, { gap: 18 });            m.attach(13, (t) => hero.anchorAt('hands', t));
//   m.sample(t) → { pos, vel, speed, dist, yaw, airborne, carried, quat }
import * as THREE from 'three';
import { path as makePath, profile } from './tracks.js';
import { arcPoint } from './physics-fake.js';
import { smoothstep, wrapAngle } from '../core/math.js';

const UP = new THREE.Vector3(0, 1, 0);
/** Points may be given lazily (functions) so actions can reference other actors without forcing a bake. */
const P = (p) => (typeof p === 'function' ? p() : p).clone();

export class Motion {
  constructor({ name = 'actor', start = new THREE.Vector3(), yaw = 0, ground = () => 0, lift = 0, radius = 0, turnRate = 9, dt = 1 / 240 } = {}) {
    Object.assign(this, { name, ground, lift, radius, turnRate, dt });
    this.start = start.clone();
    this.yaw0 = yaw;
    this.segs = []; // { t0, kind, opts, built }
    this.faces = []; // heading overrides { t0, t1, yaw?, target?: () => Vector3 }
    this.events = []; // { t, type, ... } produced by segments (landings, launches)
    this.T = { pos: [], dist: [], yaw: [], quat: [], air: [], carried: [], n: 0 };
    this._baking = false;
  }

  // ---------- authoring ----------
  _add(t0, kind, opts) {
    if (this.T.n) throw new Error(`${this.name}: cannot add segments after baking started`);
    this.segs.push({ t0, kind, opts, built: null });
    this.segs.sort((a, b) => a.t0 - b.t0);
    return this;
  }
  /** Travel through points (Vector3 or () => Vector3; y is re-snapped to ground+lift unless opts.snap === false). timing: {dur, ease} | {speed, ramp} | {speed:[v0,v1]} */
  path(t0, points, opts = {}) { return this._add(t0, 'path', { points, ...opts }); }
  /** Ballistic hop/leap/fall to `to` (Vector3, absolute). opts: { dur, apex, bounces, restitution, timeEase(u) (e.g. slow-motion apex) } */
  arc(t0, to, opts = {}) { return this._add(t0, 'arc', { to, ...opts }); }
  /** Chase another Motion along its trail, `gap` cm behind (number or [g0, g1] over the segment). */
  follow(t0, target, opts = {}) { return this._add(t0, 'follow', { target, ...opts }); }
  /** Glue to a moving world point (e.g. a character's hands). */
  attach(t0, anchorFn, opts = {}) { return this._add(t0, 'attach', { anchorFn, ...opts }); }
  /** Teleport / hold at a point (or stay where you are if `at` omitted). */
  hold(t0, at) { return this._add(t0, 'hold', { at }); }
  /** Smoothly turn to a yaw (radians) or to face a point / function of time, over [t0, t1]. */
  face(t0, t1, what) { this.faces.push({ t0, t1, ...(typeof what === 'number' ? { yaw: what } : { target: what }) }); return this; }

  // ---------- evaluation ----------
  snap(p) { p.y = this.ground(p.x, p.z) + this.lift; return p; }

  _build(i) {
    const s = this.segs[i];
    if (s.built) return s.built;
    const from = i === 0 ? this.start.clone() : this._evalSeg(i - 1, s.t0, new THREE.Vector3());
    const o = s.opts, t0 = s.t0;
    let b;
    if (s.kind === 'path') {
      const pts = [from, ...o.points.map((p) => (o.snap === false ? P(p) : this.snap(P(p))))];
      const pa = makePath(pts, { tension: o.tension ?? 0.5 });
      const pr = profile(pa.length, o);
      b = { end: t0 + pr.dur, pos: (t, out) => { pa.at(pr.s(t - t0), out); if (o.snap !== false) this.snap(out); return out; } };
    } else if (s.kind === 'arc') {
      const to = P(o.to);
      const dur = o.dur ?? 0.5, apex = o.apex ?? 6, nb = o.bounces ?? 0, e = o.restitution ?? 0.35;
      // optional decaying bounces at the landing point
      const bounces = [];
      let bt = t0 + dur, h = Math.max(apex, 2) * e, d = dur * e;
      for (let k = 0; k < nb; k++) { bounces.push({ t0: bt, t1: bt + d, h }); bt += d; h *= e * e; d *= e; }
      this.events.push({ t: t0, type: 'launch', actor: this.name, height: apex });
      this.events.push({ t: t0 + dur, type: 'land', actor: this.name, height: apex, speed: from.distanceTo(to) / dur });
      bounces.forEach((q) => this.events.push({ t: q.t1, type: 'land', actor: this.name, height: q.h, small: true }));
      b = {
        end: bt,
        air: (t) => t >= t0 && t < bt,
        pos: (t, out) => {
          if (t < t0 + dur) { const u = Math.max(0, (t - t0) / dur); return arcPoint(from, to, apex, o.timeEase ? o.timeEase(u) : u, out); }
          out.copy(to);
          for (const q of bounces) if (t >= q.t0 && t < q.t1) { const u = (t - q.t0) / (q.t1 - q.t0); out.y += 4 * q.h * u * (1 - u); }
          return out;
        },
      };
    } else if (s.kind === 'follow') {
      const tg = o.target, gap = o.gap ?? 15, blend = o.blend ?? 0.35, side = o.side ?? 0;
      const g = Array.isArray(gap) ? (t) => gap[0] + (gap[1] - gap[0]) * smoothstep(t0, o.until ?? t0 + 3, t) : () => gap;
      const tmp = new THREE.Vector3(), tan = new THREE.Vector3();
      b = {
        end: Infinity,
        pos: (t, out) => {
          tg.ensure(t);
          const dStart = tg.distAt(t0);
          const tt = tg.timeAtDist(Math.max(dStart, tg.distAt(t) - g(t)));
          tg.rawPos(tt, tmp);
          if (side) { tg.rawPos(tt + 0.02, tan).sub(tmp); tan.y = 0; if (tan.lengthSq() > 1e-8) tmp.addScaledVector(tan.normalize().cross(UP), side); }
          this.snap(tmp);
          return out.lerpVectors(from, tmp, smoothstep(t0, t0 + blend, t));
        },
      };
    } else if (s.kind === 'attach') {
      const blend = o.blend ?? 0.15, off = o.offset || new THREE.Vector3();
      b = { end: Infinity, carried: true, pos: (t, out) => out.copy(o.anchorFn(t)).add(off).lerp(from, 1 - smoothstep(t0, t0 + blend, t)) };
    } else {
      const at = o.at ? P(o.at) : from;
      b = { end: t0, pos: (t, out) => out.copy(at) };
    }
    s.built = b;
    return b;
  }

  _evalSeg(i, t, out) {
    const b = this._build(i);
    return b.pos(Math.min(t, b.end), out);
  }

  _segIndex(t) {
    let i = -1;
    for (let k = 0; k < this.segs.length; k++) if (this.segs[k].t0 <= t) i = k;
    return i;
  }

  /** Exact position at time t (no baking needed except for followed targets). */
  rawPos(t, out = new THREE.Vector3()) {
    const i = this._segIndex(t);
    if (i < 0) return out.copy(this.start);
    return this._evalSeg(i, t, out);
  }
  /** Airborne (in a hop/arc) at time t? */
  airAt(t) { const i = this._segIndex(t); if (i < 0) return false; const b = this._build(i); return !!(b.air && b.air(t)); }
  carriedAt(t) { const i = this._segIndex(t); return i >= 0 && !!this._build(i).carried && t >= this.segs[i].t0; }

  // ---------- baking ----------
  ensure(t) {
    const T = this.T, dt = this.dt;
    const need = Math.ceil(Math.max(0, t) / dt) + 2;
    if (T.n >= need || this._baking) return;
    this._baking = true;
    const p = new THREE.Vector3(), prev = new THREE.Vector3(), q = new THREE.Quaternion(), dq = new THREE.Quaternion(), axis = new THREE.Vector3();
    while (T.n < need) {
      const i = T.n, ti = i * dt;
      this.rawPos(ti, p);
      if (i === 0) {
        T.pos.push(p.x, p.y, p.z); T.dist.push(0); T.yaw.push(this.yaw0); T.quat.push(0, 0, 0, 1);
      } else {
        prev.fromArray(T.pos, (i - 1) * 3);
        const dx = p.x - prev.x, dz = p.z - prev.z, dy = p.y - prev.y;
        const dh = Math.hypot(dx, dz);
        T.pos.push(p.x, p.y, p.z);
        T.dist.push(T.dist[i - 1] + Math.hypot(dh, dy));
        // heading: face overrides > direction of travel > keep
        let yaw = T.yaw[i - 1], target = null;
        const f = this.faces.find((fc) => ti >= fc.t0 && ti <= fc.t1);
        if (f) {
          if (f.yaw !== undefined) target = f.yaw;
          else { const tp = typeof f.target === 'function' ? f.target(ti) : f.target; target = Math.atan2(tp.x - p.x, tp.z - p.z); }
        } else if (dh / dt > 4) target = Math.atan2(dx, dz);
        if (target !== null) yaw += wrapAngle(target - yaw) * (1 - Math.exp(-(f ? 8 : this.turnRate) * dt));
        T.yaw.push(yaw);
        // rolling: rotate about (up × travel) by distance / radius
        q.fromArray(T.quat, (i - 1) * 4);
        if (this.radius > 0 && dh > 1e-7 && !this.carriedAt(ti)) {
          axis.set(dz, 0, -dx).normalize();
          dq.setFromAxisAngle(axis, dh / this.radius);
          q.premultiply(dq);
        }
        T.quat.push(q.x, q.y, q.z, q.w);
      }
      T.air.push(this.airAt(ti) ? 1 : 0);
      T.carried.push(this.carriedAt(ti) ? 1 : 0);
      T.n++;
    }
    this._baking = false;
  }

  _idx(t) { this.ensure(t); const f = Math.max(0, t) / this.dt; const i = Math.min(Math.floor(f), this.T.n - 2); return [i, f - i]; }
  distAt(t) { const [i, u] = this._idx(t); return this.T.dist[i] + (this.T.dist[i + 1] - this.T.dist[i]) * u; }
  timeAtDist(d) {
    const D = this.T.dist; let lo = 0, hi = this.T.n - 1;
    if (d <= D[0]) return 0;
    if (d >= D[hi]) return hi * this.dt;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] < d) lo = m; else hi = m; }
    const u = (d - D[lo]) / Math.max(D[hi] - D[lo], 1e-9);
    return (lo + u) * this.dt;
  }
  yawAt(t) { const [i, u] = this._idx(t); const a = this.T.yaw[i], b = this.T.yaw[i + 1]; return a + (b - a) * u; }
  velAt(t, out = new THREE.Vector3()) {
    const h = 1 / 60;
    const a = this.rawPos(Math.max(0, t - h)), b = this.rawPos(t + h);
    return out.subVectors(b, a).divideScalar(t - h < 0 ? t + h : 2 * h);
  }
  sample(t) {
    const [i, u] = this._idx(t);
    const T = this.T;
    const qa = new THREE.Quaternion().fromArray(T.quat, i * 4), qb = new THREE.Quaternion().fromArray(T.quat, (i + 1) * 4);
    const vel = this.velAt(t);
    const vPrev = this.velAt(t - 1 / 30);
    return {
      pos: this.rawPos(t), vel, speed: Math.hypot(vel.x, vel.z), accel: vel.clone().sub(vPrev).multiplyScalar(30),
      dist: this.distAt(t), yaw: this.yawAt(t), quat: qa.slerp(qb, u),
      airborne: !!T.air[u < 0.5 ? i : i + 1], carried: !!T.carried[u < 0.5 ? i : i + 1],
    };
  }
}
