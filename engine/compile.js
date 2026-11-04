// engine/compile.js — film.json (data a small LLM writes) → film() DSL object, using existing parts only.
//   import { compileFilm } from './compile.js';  const desc = compileFilm(json);   // never throws for bad input
// Steps: autofix (validate.js) → build part specs → layout (props into set slots, cast spots) → beat templates
// (beats.js) lay down shots / actions / sfx per time span → markers for the music cue → titleCard / post.
// Player: ?film-json=films/<slug>/film.json   Render: npm run render -- --film-json films/<slug>/film.json
import { film, shot, at, sfx, music } from './film.js';
import { getPart } from './core/registry.js';
import { seedOf, rng } from './core/rng.js';
import { autofix } from './validate.js';
import { layout } from './layout.js';
import { BEATS } from './beats.js';
import { capOf } from './resolve.js';

const MUSIC_MOOD = {
  happy: { bpm: [100, 160], key: 'G' }, playful: { bpm: [92, 152], key: 'D' }, tense: { bpm: [100, 172], key: 'E' },
  sad: { bpm: [66, 96], key: 'A' }, calm: { bpm: [76, 108], key: 'F' }, epic: { bpm: [100, 168], key: 'C' },
};
const TITLE_COLORS = { happy: ['#f2c14e', '#c8102e'], playful: ['#c8102e', '#f2c14e'], tense: ['#e8e2d0', '#22306e'], sad: ['#cfd8e8', '#22306e'], calm: ['#f3e7cf', '#1f9aa8'], epic: ['#f2c14e', '#7a1020'] };
const MARKER_KEYS = ['hold', 'chase', 'hit', 'tension', 'freeze', 'relief', 'climax', 'resolve', 'end'];
const MARKER_FALLBACK = { hold: 4.4, chase: 5.5, hit: 10.4, tension: 11.5, freeze: 14.2, relief: 15.0, climax: 15.6, resolve: 17.6, end: 20 };

export const slugOf = (s) => String(s || 'film').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `film-${(seedOf(String(s)) >>> 0).toString(36)}`;

/** Music sections land on story beats; missing ones are spread proportionally, always increasing. */
function musicMarkers(spans, D) {
  const first = (type) => spans.find((s) => s.type === type);
  const M = {};
  for (const k of MARKER_KEYS) M[k] = (MARKER_FALLBACK[k] / 20) * D;
  const ch = first('chase'), bk = first('bonk'), ca = first('catch'), ce = first('celebrate') || first('sad'), ti = first('title');
  if (ch) { M.chase = ch.t0; M.hold = Math.max(0.5, ch.t0 - 1.1); }
  if (bk) { M.hit = bk.t0 + (bk.t1 - bk.t0) * 0.45; M.tension = M.hit + Math.min(1.1, (bk.t1 - bk.t0) * 0.5); }
  if (ca) { M.freeze = ca.t0 + (ca.t1 - ca.t0) * 0.5; M.relief = M.freeze + Math.min(0.8, (ca.t1 - ca.t0) * 0.4); }
  if (ce) M.climax = ce.t0;
  if (ti) M.resolve = ti.t0;
  M.end = D;
  let prev = 0;
  MARKER_KEYS.forEach((k, i) => { const room = (MARKER_KEYS.length - 1 - i) * 0.25; M[k] = Math.min(D - room, Math.max(M[k], prev + 0.25)); prev = M[k]; });
  M.end = D;
  for (const k of MARKER_KEYS) M[k] = Math.round(M[k] * 1000) / 1000;
  return M;
}

export function compileFilm(input, { name } = {}) {
  const { json: j, fixes, fallbacks } = autofix(input);
  const seed = (seedOf(j.title) >>> 0) % 100000 + 1;
  const setSpec = getPart(j.set)({});
  const lightSpec = getPart(j.light)({});
  const L = layout(setSpec, j.cast, j.props, seed);
  const parts = {}; // id → part id
  const props = {}, cast = {};
  for (const p of j.props) if (!L.dropped.includes(p.id)) { props[p.id] = getPart(p.part)(p.params || {}).at(L.pos[p.id]); parts[p.id] = p.part; }
  for (const c of j.cast) { cast[c.id] = getPart(c.part)(c.params || {}).at(L.pos[c.id]); parts[c.id] = c.part; }
  if (L.dropped.length) fixes.push(`props: no room on the table for ${L.dropped.join(', ')}`);

  const out = { shots: [], action: [], sfx: [] };
  let titleT0 = null;
  const state = { ...L.pos };
  const live = (id) => id in parts;
  const c = {
    L, rnd: rng(seed).next,
    cap: (id) => capOf(parts[id]),
    pos: (id) => state[id] || [0, 0],
    set: (id, p) => { state[id] = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; },
    r: (id) => L.radius[id] ?? 6,
    isProp: (id) => id in props,
    others: (id) => Object.keys(cast).filter((x) => x !== id),
    nearest: (id, ok = () => true) => {
      let best = null, bd = Infinity;
      for (const x of Object.keys(parts)) { if (x === id || !ok(x) || c.carried[x]) continue; const p = c.pos(x), q = c.pos(id), d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; best = x; } }
      return best;
    },
    carried: {}, carrying: {}, cracked: {},
    at: (t, what, p) => out.action.push(at(Math.round(t * 1000) / 1000, what, p)),
    shot: (t0, t1, o) => { if (t1 - t0 > 0.05) out.shots.push(shot(Math.round(t0 * 1000) / 1000, Math.round(t1 * 1000) / 1000, { name: `b${out.shots.length}`, ...o })); },
    sfx: (t, n, p) => out.sfx.push(sfx(Math.max(0, Math.round(t * 1000) / 1000), n, p)),
    titleCard: (t) => { titleT0 ??= t; },
  };
  // beats → spans → templates
  const spans = [];
  let t = 0;
  j.beats.forEach((b, i) => {
    const t1 = i === j.beats.length - 1 ? j.duration : t + b.seconds;
    spans.push({ ...b, t0: t, t1, target: live(b.target) ? b.target : undefined });
    t = t1;
  });
  for (const s of spans) BEATS[s.type].build(c, s, s.t0, s.t1);
  // shots must tile [0, D] exactly: snap the edges
  out.shots.sort((a, b) => a.t0 - b.t0);
  out.shots.forEach((s, i) => { s.t0 = i === 0 ? 0 : out.shots[i - 1].t1; if (i === out.shots.length - 1) s.t1 = j.duration; });
  out.action.sort((a, b) => a.t - b.t);
  out.sfx.sort((a, b) => a.t - b.t);

  const D = j.duration;
  const markers = musicMarkers(spans, D);
  spans.forEach((s, i) => { markers[`b${i}-${s.type}`] = Math.round(s.t0 * 1000) / 1000; });
  const mood = j.music.mood || 'playful';
  const [color, edge] = TITLE_COLORS[mood] || TITLE_COLORS.playful;
  const desc = {
    name: name || slugOf(j.title), title: j.title, duration: D, fps: 60, seed, format: j.format, markers,
    set: setSpec, light: lightSpec, props, cast, views: {},
    shots: out.shots, action: out.action, sfx: out.sfx,
    music: [music(0, getPart(j.music.cue)(MUSIC_MOOD[mood] || MUSIC_MOOD.playful))],
    post: { fade: [[0, 1], [0.6, 0], [Math.max(0.7, D - 0.6), 0], [D, 0.55]] },
    assembly: { json: j, fixes, fallbacks, dropped: L.dropped, slots: L.slot },
  };
  if (titleT0 !== null) {
    desc.titleCard = { t0: titleT0, text: j.title.toUpperCase(), credit: 'Made with Voxel Studio', color, edge };
    desc.post.letterbox = [[Math.max(0, titleT0 - 0.6), 0], [titleT0 + 0.3, 1]];
  }
  return film(desc);
}
