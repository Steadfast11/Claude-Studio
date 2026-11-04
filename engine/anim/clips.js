// engine/anim/clips.js — one-shot, blendable, time-addressable pose layers (pure in t).
//   const clips = new ClipSet();
//   clips.add({ t0: 4.4, dur: 0.6, fadeIn: 0.05, fadeOut: 0.2, fn: (u, tl) => ({ squash: 0.2 * Math.sin(u * Math.PI), face: 'wide' }) });
//   const pose = clips.evaluate(t, { squash: 0, face: 'normal' });
// Numeric channels are summed (weighted by each clip's fade envelope). Arrays add component-wise.
// Non-numeric channels (strings, objects) are "set": the latest-starting clip whose weight > 0.5 wins.
import { envelope } from '../core/math.js';

export class ClipSet {
  constructor() { this.clips = []; }
  /** { t0, dur, fn(u ∈ [0,1], tLocal seconds, dur) → partial pose, fadeIn, fadeOut, hold (keep last pose after end), name } */
  add(c) {
    this.clips.push({ fadeIn: 0.08, fadeOut: 0.15, hold: false, ...c });
    this.clips.sort((a, b) => a.t0 - b.t0);
    return c;
  }
  active(t, name) { return this.clips.some((c) => (!name || c.name === name) && t >= c.t0 && (c.hold || t < c.t0 + c.dur)); }
  /** Last clip with this name that started at or before t. */
  last(t, name) { let r = null; for (const c of this.clips) if (c.name === name && c.t0 <= t) r = c; return r; }
  evaluate(t, base = {}) {
    const pose = { ...base };
    const setters = {};
    for (const c of this.clips) {
      if (t < c.t0) continue;
      const end = c.t0 + c.dur;
      if (!c.hold && t > end + 1e-9) continue;
      const w = c.hold ? Math.min(envelope(t, c.t0, Infinity, c.fadeIn, 0), 1) : envelope(t, c.t0, end, c.fadeIn, c.fadeOut);
      if (w <= 0) continue;
      const tl = Math.min(t - c.t0, c.dur);
      const part = c.fn(Math.min(1, tl / Math.max(c.dur, 1e-9)), tl, c.dur, t);
      for (const [k, v] of Object.entries(part)) {
        if (typeof v === 'number') pose[k] = (pose[k] || 0) + v * w;
        else if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
          const cur = Array.isArray(pose[k]) ? pose[k].slice() : v.map(() => 0);
          pose[k] = cur.map((x, i) => x + v[i] * w);
        } else if (w > 0.5) setters[k] = v;
      }
    }
    return Object.assign(pose, setters);
  }
}
