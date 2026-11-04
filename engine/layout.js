// engine/layout.js — places props into named slots of the set's table top (film.json has no coordinates).
//   const L = layout(setSpec, cast, props, seed) → { pos: { id: [x, z] }, radius: { id: r }, slot: { id: name },
//                                                   dropped: [ids], hw, hd, clear(p, r), route(a, b), wander(a, n, rnd) }
// Rules: cast start spots are reserved first (front half, where the camera is), props fill the back/sides in slot
// order, largest first; nothing overlaps; routes for moving cast are pushed out of every prop's footprint.
import { getPart } from './core/registry.js';
import { rng } from './core/rng.js';

const CAST_SPOTS = [['stage-left', -0.5, 0.32], ['stage-right', 0.48, 0.28], ['front-center', 0, 0.55], ['center', 0.05, 0.02]];
const PROP_SLOTS = [
  ['back-center', 0, -0.58], ['back-left', -0.62, -0.55], ['back-right', 0.62, -0.55], ['left', -0.84, 0.02], ['right', 0.84, 0.0],
  ['back-mid-left', -0.31, -0.62], ['back-mid-right', 0.31, -0.62], ['front-left', -0.84, 0.7], ['front-right', 0.84, 0.7],
  ['mid-left', -0.5, -0.12], ['mid-right', 0.5, -0.15], ['center', 0, -0.15],
];

/** Footprint radius (cm) of a part from its own options — generic, no per-part tables. */
export function radiusOf(part, params = {}) {
  let o = {};
  try { o = { ...getPart(part).def.options, ...params }; } catch { /* unknown → default */ }
  const s = Number(o.scale) || 1;
  if (getSafeKind(part) === 'character') { let fp = 6; try { fp = getPart(part).def.footprint ?? 6; } catch { /* default */ } return fp * s; }
  if (o.diameter) return o.diameter / 2;
  if (o.size) return o.size / 2;
  if (o.length) return Math.min(o.length / 2, 8);
  if (o.height) return o.height * 0.65;
  return 6;
}
const getSafeKind = (p) => { try { return getPart(p).def.kind; } catch { return null; } };

/** Half extents of the set's table top, from the set's own options. */
export function tableOf(setSpec) {
  const o = setSpec?.opts || {};
  const [w, d] = o.table || o.tableSize || [110, 72];
  return { hw: w / 2 - 3, hd: d / 2 - 3 };
}

export function layout(setSpec, cast = [], props = [], seed = 1) {
  const { hw, hd } = tableOf(setSpec);
  const pos = {}, radius = {}, slot = {}, dropped = [];
  const placed = []; // { id, p:[x,z], r, solid }
  const fits = (p, r, ignore) => Math.abs(p[0]) + r * 0.7 <= hw + 3 && Math.abs(p[1]) + r * 0.7 <= hd + 3 &&
    placed.every((q) => q.id === ignore || Math.hypot(p[0] - q.p[0], p[1] - q.p[1]) >= r + q.r + 3);
  const put = (id, p, r, name, solid) => { pos[id] = p; radius[id] = r; slot[id] = name; placed.push({ id, p, r, solid }); };
  // 1) cast start spots
  cast.forEach((c, i) => {
    const r = radiusOf(c.part, c.params);
    const cands = [...CAST_SPOTS.slice(i), ...CAST_SPOTS.slice(0, i)];
    const s = cands.find(([, fx, fz]) => fits([fx * hw, fz * hd], r)) || cands[0];
    put(c.id, [s[1] * hw, s[2] * hd], r, s[0], false);
  });
  // 2) props: largest first, first free slot, then a deterministic scan of the table; else dropped
  const order = props.map((p, i) => ({ ...p, i, r: radiusOf(p.part, p.params) })).sort((a, b) => b.r - a.r || a.i - b.i);
  const rnd = rng(seed).next;
  for (const p of order) {
    let s = PROP_SLOTS.find(([n, fx, fz]) => !Object.values(slot).includes(n) && fits([fx * hw, fz * hd], p.r));
    if (s) { put(p.id, [s[1] * hw, s[2] * hd], p.r, s[0], true); continue; }
    let ok = null;
    for (let k = 0; k < 60 && !ok; k++) { const q = [(rnd() * 2 - 1) * (hw - p.r), (rnd() * 1.6 - 1) * (hd - p.r)]; if (fits(q, p.r)) ok = q; }
    if (ok) put(p.id, ok, p.r, 'free', true); else dropped.push(p.id);
  }
  const solids = () => placed.filter((q) => q.solid);
  /** Push a point out of every prop footprint and back onto the table. */
  const clear = (p, r = 6, ignore) => {
    let [x, z] = p;
    for (let it = 0; it < 4; it++) {
      for (const q of solids()) {
        if (q.id === ignore) continue;
        const dx = x - q.p[0], dz = z - q.p[1], d = Math.hypot(dx, dz), need = q.r + r + 1.5;
        if (d < need) { const k = d < 1e-6 ? [0, 1] : [dx / d, dz / d]; x = q.p[0] + k[0] * need; z = q.p[1] + k[1] * need; }
      }
      x = Math.max(-hw + r, Math.min(hw - r, x)); z = Math.max(-hd + r, Math.min(hd - r, z));
    }
    return [round(x), round(z)];
  };
  /** A reachable route a → b: straight segments sampled and pushed clear of props. */
  const route = (a, b, r = 6, ignore) => {
    const out = [clear(a, r, ignore)];
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8));
    for (let i = 1; i <= n; i++) { const u = i / n; out.push(clear([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], r, i === n ? ignore : undefined)); }
    return out.filter((p, i) => i === 0 || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 0.5);
  };
  /** A wandering route from a through n open-table waypoints (front/mid lanes), deterministic from rnd. */
  const wander = (a, n, rnd2, r = 6) => {
    let pts = [a], side = a[0] > 0 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const target = [side * (0.35 + 0.4 * rnd2()) * hw, (rnd2() * 0.75 - 0.05) * hd];
      pts = pts.concat(route(pts[pts.length - 1], target, r).slice(1));
      side = -side;
    }
    return pts;
  };
  return { pos, radius, slot, dropped, hw, hd, clear, route, wander };
}
const round = (v) => Math.round(v * 10) / 10;
