// engine/director.js — picks a camera for a beat from data/director/presets.json (ANOR's camera language) and
// proves it with a framing check. Generic: it only knows subjects as { pos:[x,z], y, h, r, yaw, face } over time.
//   const shot = direct(type, { who, target, runner, t0, t1, aspect, at(id, t) → subject, limits });
//   → { shot (for film.js shot()), preset, checks: [{ t, ok, why }] }
// Rules: the camera stays in the subject's front half-space (|camera yaw − facing| ≤ frontLimit) and inside the set's
// front arc (|yaw| ≤ worldYaw, +z = the dressed side). At start/mid/end every framed subject must be in frame, ≥ minHeight
// of the frame height, not cut by the edge, and (for characters) show its face. A failing preset → the next one;
// if none passes, the best-scoring one is kept and pulled back until it fits (reported, never thrown).
import presets from '../data/director/presets.json' with { type: 'json' };

export const RULES = presets.rules;
export const PRESETS = presets.beats;
const DEG = Math.PI / 180;
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const r1 = (v) => Math.round(v * 10) / 10;

/** Project world point p through a camera (pos, look, lens mm on a 36 mm-wide sensor) → [nx, ny] in [-1, 1] or null (behind). */
export function project(cam, p, aspect) {
  const f = norm(sub(cam.look, cam.pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), d = sub(p, cam.pos);
  const z = dot(d, f);
  if (z < 0.5) return null;
  const tw = 18 / cam.lens, th = tw / aspect;
  return [dot(d, r) / (z * tw), dot(d, u) / (z * th)];
}

/** Framing check of one camera against subjects. → { ok, why: [...], score } */
export function check(cam, subjects, aspect, rules = RULES) {
  const why = [];
  let score = 0;
  for (const [si, s] of subjects.entries()) {
    const pts = [];
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) for (const y of [s.y, s.y + s.h]) pts.push([s.pos[0] + dx * s.r * 0.8, y, s.pos[1] + dz * s.r * 0.8]);
    const pr = pts.map((p) => project(cam, p, aspect));
    if (pr.some((q) => !q)) { why.push(`${s.id}: behind camera`); score -= 3; continue; }
    const xs = pr.map((q) => q[0]), ys = pr.map((q) => q[1]);
    const cut = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs)) > rules.edge;
    const fh = (Math.max(...ys) - Math.min(...ys)) / 2;
    if (cut) { why.push(`${s.id}: cut by frame edge`); score -= 2; }
    if (si === 0 && fh < rules.minHeight) { why.push(`${s.id}: ${Math.round(fh * 100)}% of frame height`); score -= 1 + (rules.minHeight - fh) * 10; }
    if (s.face) {
      const toCam = Math.atan2(cam.pos[0] - s.pos[0], cam.pos[2] - s.pos[1]);
      const off = Math.abs(wrap(toCam - s.yaw)) / DEG;
      if (off > rules.frontLimit) { why.push(`${s.id}: face away (${Math.round(off)}°)`); score -= 2 + off / 90; }
    }
    score += Math.min(fh, 0.5);
  }
  return { ok: !why.length, why, score };
}

/** Camera yaw (world, rad) around a subject facing `facing` with preset yaw `y` (deg): the side nearer the set's front. */
function camYaw(facing, y, rules) {
  const cand = [facing + y * DEG, facing - y * DEG].map(wrap).sort((a, b) => Math.abs(a) - Math.abs(b));
  let az = cand[0];
  const W = rules.worldYaw * DEG, F = (rules.frontLimit - 4) * DEG;
  if (Math.abs(az) > W) az = Math.sign(az) * W;                                // stay in the set's front arc…
  if (Math.abs(wrap(az - facing)) > F) az = wrap(facing + Math.sign(wrap(az - facing)) * F); // …but in front of the face first
  return az;
}

/** Camera { pos, look, lens } for a framing { yaw, dist, height, lookY } around subjects at one moment. */
function place(fr, subs, lens, rules, bounds, k = 1, aspect = 16 / 9) {
  const main = subs[0];
  const c = subs.length > 1 ? [subs.reduce((s, q) => s + q.pos[0], 0) / subs.length, subs.reduce((s, q) => s + q.pos[1], 0) / subs.length] : main.pos;
  const h = Math.max(...subs.map((q) => q.h)), sc = Math.min(2.2, Math.max(0.55, h / 10));
  const az = camYaw(main.yaw, fr.yaw ?? 0, rules);
  // how wide the group looks from this side (lateral to the view), so staged-in-depth pairs can come closer
  const rx = Math.cos(az), rz = -Math.sin(az);
  const spread = subs.length > 1 ? Math.max(...subs.map((q) => Math.abs((q.pos[0] - c[0]) * rx + (q.pos[1] - c[1]) * rz) + q.r)) : 0;
  const ak = Math.min(1, aspect / (16 / 9)); // vertical / square frames: same subject size → come closer (width is the sensor's)
  const dist = Math.max(fr.dist * sc * ak, spread * 2.4 * (40 / lens)) * k;
  const y0 = main.y;
  const pos = [c[0] + Math.sin(az) * dist, y0 + Math.max(2, fr.height * sc * ak * Math.min(k, 1.6)), c[1] + Math.cos(az) * dist];
  if (bounds) { pos[1] = Math.min(pos[1], y0 + bounds.maxY); pos[2] = Math.min(pos[2], bounds.maxZ); }
  return { pos, look: [c[0], y0 + h * (fr.lookY ?? 0.5), c[1]], lens };
}

const lerp3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

/** Choose and build the shot for a beat. Never throws; returns the best effort with its check results. */
export function direct(type, o) {
  const rules = { ...RULES, ...(o.rules || {}) };
  let list = PRESETS[type] || PRESETS.perform;
  if (o.skip) list = list.filter((P) => !o.skip.includes(P.name) && !(o.skip.includes('insert') && P.frame === 'target'));
  if (o.only) list = list.filter((P) => o.only.includes(P.name) || (o.only.includes('insert') && P.frame === 'target'));
  if (o.prefer) list = [...list.filter((P) => P.name === o.prefer), ...list.filter((P) => P.name !== o.prefer)];
  if (!list.length) list = PRESETS.perform;
  const { t0, t1, aspect = 16 / 9 } = o;
  const times = rules.samples.map((u) => t0 + (t1 - t0) * u);
  let best = null;
  for (const P of list) {
    if (P.frame === 'target' && !o.target) continue;
    if (P.on === 'runner' && !o.runner) continue;
    const ids = P.frame === 'both' && o.target ? [o.who, o.target] : P.frame === 'target' ? [o.target] : [o.who];
    for (const k of [1, 1.3, 1.7]) {
      const cams = [], checks = [];
      for (const [i, t] of times.entries()) {
        const subs = ids.map((id) => o.at(id, t));
        const u = rules.samples[i];
        let cam;
        if (P.move === 'track') {
          const anchor = o.at(P.on === 'runner' ? o.runner : o.who, t);
          cam = place(P.to, [{ ...anchor, yaw: o.at(o.who, t).yaw }], P.lens, rules, null, k, aspect);
        } else if (P.from) { const a = place(P.from, subs, P.lens, rules, o.bounds, k, aspect), b = place(P.to, subs, P.lensTo ?? P.lens, rules, o.bounds, k, aspect); cam = { pos: lerp3(a.pos, b.pos, u), look: lerp3(a.look, b.look, u), lens: a.lens + (b.lens - a.lens) * u }; }
        else cam = place(P.to, subs, P.lens, rules, o.bounds, k, aspect);
        cams.push(cam);
        const framed = P.on === 'runner' ? [o.at(o.who, t)] : subs;
        checks.push({ t: Math.round(t * 100) / 100, ...check(cam, framed, aspect, rules) });
      }
      const score = checks.reduce((s, c) => s + c.score, 0) - (k - 1) * 0.5;
      const ok = checks.every((c) => c.ok);
      const cand = { P, k, cams, checks, ok, score, ids };
      if (!best || (ok && !best.ok) || (ok === best.ok && score > best.score)) best = cand;
      if (ok) return build(best, o);
    }
  }
  return build(best, o);
}

function build({ P, k, cams, checks, ok, ids }, o) {
  const { t0, t1 } = o;
  const focus = o.focus || ids[0];
  const base = { lens: P.lens, fstop: P.fstop ?? 5.6, handheld: (P.handheld ?? 0) + (o.shake || 0), ...(P.grade || o.grade ? { grade: { ...(P.grade || {}), ...(o.grade || {}) } } : {}) };
  let shot;
  if (P.move === 'track') {
    const on = P.on === 'runner' ? o.runner : o.who;
    const anchor = o.at(on, (t0 + t1) / 2), cm = cams[1];
    const off = [r1(cm.pos[0] - anchor.pos[0]), r1(cm.pos[1] - anchor.y - anchor.h * 0.5), r1(cm.pos[2] - anchor.pos[1])];
    shot = { rig: 'track', target: on, offset: off, lag: P.lag ?? 0.25, lookOffset: [0, r1(cm.look[1] - anchor.y - anchor.h * 0.5), 0], focus, ...base };
  } else if (P.from) {
    const a = cams[0], b = cams[cams.length - 1];
    const ext = (c, u) => ({ pos: c.pos.map(r1), look: c.look.map(r1), lens: c.lens });
    shot = { rig: P.move, ease: P.move === 'pull' ? 'inOutSine' : 'inOutCubic', from: ext(a), to: ext(b), focus, ...base };
  } else {
    const c = cams[1];
    shot = { rig: 'static', at: { pos: c.pos.map(r1), look: c.look.map(r1) }, focus, ...base };
  }
  if (P.focusPull && o.pullFrom) shot.focus = [{ t: t0, on: o.pullFrom }, { t: t0 + 0.12, on: focus, pull: P.focusPull }];
  return { shot, preset: P.name, ok, k, checks };
}
