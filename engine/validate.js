// engine/validate.js — film.json checks with short, human-readable errors, plus an auto-fix pass.
//   validate(json) → ['beats[2].who: \'cat\' not in cast', ...]      (empty = valid; never throws)
//   autofix(json)  → { json, fixes: [...], fallbacks: { field: [how, ...] } }   always returns a valid film.json
// Auto-fix: parse strings, clamp numbers, resolve unknown words to existing part ids (engine/resolve.js),
// repair ids/who/target references, fill a default story, rescale beat seconds to the duration.
import { catalog, LIMITS, FORMATS } from './schema.js';
import { resolvePart, resolveWord, norm } from './resolve.js';
import { BEATS } from './beats.js';
import { getPart } from './core/registry.js';

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const q = (v) => (typeof v === 'string' ? `'${v.slice(0, 30)}'` : JSON.stringify(v)?.slice(0, 30));
const ID = /^[a-z][a-z0-9_-]{0,23}$/;

export function validate(input) {
  const e = [];
  try {
    const j = typeof input === 'string' ? JSON.parse(input) : input;
    if (!isObj(j)) return ['film: not a JSON object'];
    const c = catalog();
    const known = new Set(['title', 'duration', 'format', 'set', 'light', 'cast', 'props', 'beats', 'music']);
    for (const k of Object.keys(j)) if (!known.has(k)) e.push(`${k}: unknown field`);
    if (typeof j.title !== 'string' || !j.title.trim()) e.push('title: missing');
    if (typeof j.duration !== 'number' || !(j.duration >= LIMITS.duration[0] && j.duration <= LIMITS.duration[1])) e.push(`duration: ${q(j.duration)} must be ${LIMITS.duration.join('–')} seconds`);
    if (j.format !== undefined && !FORMATS.includes(j.format)) e.push(`format: ${q(j.format)} not one of ${FORMATS.join(' | ')}`);
    if (!c.sets.includes(j.set)) e.push(`set: ${q(j.set)} not one of ${c.sets.join(', ')}`);
    if (j.light !== undefined && !c.lights.includes(j.light)) e.push(`light: ${q(j.light)} not one of ${c.lights.join(', ')}`);
    const ids = new Set();
    const list = (key, allowed, max, min) => {
      const a = j[key];
      if (a === undefined && !min) return;
      if (!Array.isArray(a)) { e.push(`${key}: must be a list`); return; }
      if (a.length < min) e.push(`${key}: needs at least ${min}`);
      if (a.length > max) e.push(`${key}: at most ${max}`);
      a.forEach((x, i) => {
        if (!isObj(x)) { e.push(`${key}[${i}]: must be an object`); return; }
        if (typeof x.id !== 'string' || !ID.test(x.id)) e.push(`${key}[${i}].id: ${q(x.id)} must be lowercase like 'cat' or 'cup1'`);
        else if (ids.has(x.id)) e.push(`${key}[${i}].id: ${q(x.id)} used twice`);
        else ids.add(x.id);
        if (!allowed.includes(x.part)) e.push(`${key}[${i}].part: ${q(x.part)} not one of ${allowed.join(', ')}`);
        if (x.params !== undefined && !isObj(x.params)) e.push(`${key}[${i}].params: must be an object`);
      });
    };
    list('cast', c.cast, LIMITS.cast, 1);
    const castIds = new Set(Array.isArray(j.cast) ? j.cast.map((x) => x?.id) : []);
    list('props', c.props, LIMITS.props, 0);
    if (!Array.isArray(j.beats) || !j.beats.length) e.push('beats: needs at least 1');
    else {
      if (j.beats.length > LIMITS.beats) e.push(`beats: at most ${LIMITS.beats}`);
      j.beats.forEach((b, i) => {
        if (!isObj(b)) { e.push(`beats[${i}]: must be an object`); return; }
        if (!c.beats.includes(b.type)) e.push(`beats[${i}].type: ${q(b.type)} not one of ${c.beats.join(', ')}`);
        if (b.who !== undefined && !castIds.has(b.who)) e.push(`beats[${i}].who: ${q(b.who)} not in cast`);
        if (b.target !== undefined && !ids.has(b.target)) e.push(`beats[${i}].target: ${q(b.target)} not in cast or props`);
        if (b.seconds !== undefined && !(typeof b.seconds === 'number' && b.seconds > 0)) e.push(`beats[${i}].seconds: must be a positive number`);
        if (b.mood !== undefined && !c.moods.includes(b.mood)) e.push(`beats[${i}].mood: ${q(b.mood)} not one of ${c.moods.join(', ')}`);
      });
    }
    if (j.music !== undefined) {
      if (!isObj(j.music)) e.push('music: must be an object');
      else {
        if (j.music.cue !== undefined && !c.music.includes(j.music.cue)) e.push(`music.cue: ${q(j.music.cue)} not one of ${c.music.join(', ')}`);
        if (j.music.mood !== undefined && !c.moods.includes(j.music.mood)) e.push(`music.mood: ${q(j.music.mood)} not one of ${c.moods.join(', ')}`);
      }
    }
  } catch (err) {
    e.push(`film: not valid JSON (${String(err.message).slice(0, 60)})`);
  }
  return e;
}

// ---------- auto-fix ----------
const COLORS = {
  red: '#d83a34', qizil: '#d83a34', 'красный': '#d83a34', orange: '#f08a2c', 'to\'q sariq': '#f08a2c', 'оранжевый': '#f08a2c',
  yellow: '#f2c230', sariq: '#f2c230', 'жёлтый': '#f2c230', 'желтый': '#f2c230', green: '#4fb86a', yashil: '#4fb86a', 'зелёный': '#4fb86a', 'зеленый': '#4fb86a',
  blue: '#3f7fd8', "ko'k": '#3f7fd8', 'синий': '#3f7fd8', 'голубой': '#6fb0e8', purple: '#8a5cc8', binafsha: '#8a5cc8', 'фиолетовый': '#8a5cc8',
  pink: '#f08cb0', pushti: '#f08cb0', 'розовый': '#f08cb0', white: '#eeeae2', oq: '#eeeae2', 'белый': '#eeeae2', black: '#3a3a40', qora: '#3a3a40', 'чёрный': '#3a3a40', 'черный': '#3a3a40',
  grey: '#9a9aa0', gray: '#9a9aa0', kulrang: '#9a9aa0', 'серый': '#9a9aa0', brown: '#8a5a3a', jigarrang: '#8a5a3a', 'коричневый': '#8a5a3a', gold: '#e0a93b', oltin: '#e0a93b', 'золотой': '#e0a93b',
  mint: '#4fb8a8', teal: '#2f9a9a',
};
const CAST_COLORS = ['#4fb8a8', '#f08a5c', '#8a7ad8', '#e8c34a'];

/** Keep only options the part really has, with the right type and a sane range. */
export function cleanParams(part, params) {
  if (!isObj(params)) return {};
  let def = {};
  try { def = getPart(part).def.options; } catch { return {}; }
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (!(k in def)) continue;
    const d = def[k];
    if (typeof d === 'number') { const n = Number(v); if (Number.isFinite(n)) out[k] = d > 0 ? Math.min(d * 3, Math.max(d / 3, n)) : n; }
    else if (typeof d === 'boolean') out[k] = v === true || v === 'true' || v === 1;
    else if (typeof d === 'string' && d.startsWith('#')) { const c = /^#[0-9a-f]{6}$/i.test(v) ? v : COLORS[norm(v)]; if (c) out[k] = c; }
    else if (typeof d === 'string' && typeof v === 'string' && v.length < 24) out[k] = v;
  }
  return out;
}

const slugId = (s, fb) => {
  const t = norm(s).normalize('NFKD').replace(/[^a-z0-9_ -]/g, '').trim().replace(/\s+/g, '-').slice(0, 20);
  return ID.test(t) ? t : fb;
};
const defaultWeights = (beats) => beats.map((b) => BEATS[b.type].weight);

/** Rescale beat seconds so they sum to `duration`, each ≥ LIMITS.minBeat. */
export function rescale(weights, duration) {
  const n = weights.length, min = LIMITS.minBeat;
  let w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 1));
  let fixed = new Array(n).fill(false);
  for (let it = 0; it < n; it++) {
    const freeW = w.reduce((s, x, i) => s + (fixed[i] ? 0 : x), 0), freeT = duration - fixed.filter(Boolean).length * min;
    const out = w.map((x, i) => (fixed[i] ? min : (x / freeW) * freeT));
    const low = out.findIndex((x, i) => !fixed[i] && x < min);
    if (low < 0) { const r = out.map((x) => Math.round(x * 100) / 100); r[n - 1] = Math.round((duration - r.slice(0, -1).reduce((s, x) => s + x, 0)) * 100) / 100; return r; }
    fixed[low] = true;
  }
  return new Array(n).fill(Math.round((duration / n) * 100) / 100);
}

export function autofix(input) {
  const fixes = [], fallbacks = {};
  const fb = (field, how, note) => { (fallbacks[field] ||= []).push(how); if (how !== 'exact' && note) fixes.push(note); };
  let j = input;
  if (typeof j === 'string') { try { j = JSON.parse(j); } catch { const m = String(input).match(/\{[\s\S]*\}/); try { j = m ? JSON.parse(m[0]) : {}; } catch { j = {}; } fixes.push('film: unreadable JSON, rebuilt'); } }
  if (!isObj(j)) { j = {}; fixes.push('film: not an object, rebuilt'); }
  const out = {};
  // title
  out.title = typeof j.title === 'string' && j.title.trim() ? j.title.trim().slice(0, 40) : (fixes.push('title: missing → "Untitled"'), 'Untitled');
  fb('title', out.title === 'Untitled' && j.title !== 'Untitled' ? 'default' : 'exact');
  // format
  const fm = norm(j.format);
  out.format = FORMATS.includes(j.format) ? j.format : /9.?16|vertical|portrait|tiktok|reels|shorts|vertikal|вертик/.test(fm) ? '9:16' : /1.?1|square|kvadrat|квадрат/.test(fm) ? '1:1' : '16:9';
  fb('format', j.format === undefined || FORMATS.includes(j.format) ? 'exact' : 'fuzzy', j.format !== undefined && !FORMATS.includes(j.format) && `format: ${q(j.format)} → ${out.format}`);
  // set, light
  for (const k of ['set', 'light']) {
    if (j[k] === undefined && k === 'light') { out.light = 'golden-hour'; fb('light', 'default'); continue; }
    const r = resolvePart(j[k], k);
    out[k] = r.id; fb(k, r.how, `${k}: ${q(j[k])} → ${r.id} (${r.how})`);
  }
  // cast, props
  const used = new Set();
  const entities = (key, slot, max, dflt) => {
    let a = Array.isArray(j[key]) ? j[key] : j[key] ? [j[key]] : [];
    if (a.length > max) { fixes.push(`${key}: ${a.length} items, kept ${max}`); a = a.slice(0, max); }
    const res = [], alias = {};
    a.forEach((x, i) => {
      const o = isObj(x) ? x : { part: x };
      const r = resolvePart(o.part ?? o.id, slot);
      fb(`${key}.part`, r.how, `${key}[${i}].part: ${q(o.part)} → ${r.id} (${r.how})`);
      let id = slugId(o.id ?? o.part, `${key === 'cast' ? 'actor' : 'prop'}${i + 1}`);
      if (used.has(id)) { let k = 2; while (used.has(`${id}${k}`)) k++; fixes.push(`${key}[${i}].id: '${id}' used twice → '${id}${k}'`); id = `${id}${k}`; }
      used.add(id);
      for (const w of [o.id, o.part, o.name]) if (typeof w === 'string') alias[norm(w)] ??= id;
      res.push({ id, part: r.id, ...(o.params || o.color ? { params: cleanParams(r.id, { ...(o.params || {}), ...(o.color ? { color: o.color } : {}) }) } : {}) });
    });
    if (!res.length && dflt) { res.push(dflt); used.add(dflt.id); fixes.push(`${key}: empty → ${dflt.part}`); fb(`${key}.part`, 'default'); }
    return { list: res, alias };
  };
  const cast = entities('cast', 'cast', LIMITS.cast, { id: 'hero', part: 'pista' });
  const props = entities('props', 'prop', LIMITS.props, null);
  out.cast = cast.list;
  // repeated characters get different colours unless one was asked for
  const seen = {};
  for (const c of out.cast) if (c.part === 'pista') { const k = (seen.pista = (seen.pista ?? -1) + 1); if (k > 0 && !c.params?.color) c.params = { ...(c.params || {}), color: CAST_COLORS[k % CAST_COLORS.length] }; }
  out.props = props.list;
  const castIds = out.cast.map((c) => c.id), allIds = [...castIds, ...out.props.map((p) => p.id)];
  const findRef = (v, pool) => {
    if (v === undefined || v === null || v === '') return { id: undefined, how: 'exact' };
    if (pool.includes(v)) return { id: v, how: 'exact' };
    const w = norm(v);
    const a = cast.alias[w] ?? props.alias[w];
    if (a && pool.includes(a)) return { id: a, how: 'synonym' };
    const ent = [...out.cast, ...out.props].filter((e) => pool.includes(e.id));
    for (const slot of ['cast', 'prop']) { const r = resolvePart(v, slot); const m = ent.find((e) => e.part === r.id); if (m && r.how !== 'default') return { id: m.id, how: 'category' }; }
    return { id: null, how: 'default' };
  };
  // beats
  let beats = Array.isArray(j.beats) ? j.beats : [];
  if (!beats.length) {
    const other = allIds.find((id) => id !== castIds[0]);
    beats = ['establish', 'discover', 'chase', 'catch', 'celebrate', 'title'].map((type) => ({ type, ...(other && type !== 'establish' && type !== 'title' && type !== 'celebrate' ? { target: other } : {}) }));
    fixes.push('beats: empty → default story'); fb('beats.type', 'default');
  }
  out.beats = beats.map((b0, i) => {
    const b = isObj(b0) ? b0 : { type: b0 };
    const t = resolveWord(b.type, 'beats', i === 0 ? 'establish' : i === beats.length - 1 && beats.length > 1 ? 'title' : 'discover');
    fb('beats.type', t.how, t.how !== 'exact' && `beats[${i}].type: ${q(b.type)} → ${t.id}`);
    const who = findRef(b.who, castIds);
    const whoId = who.id ?? castIds[0];
    fb('beats.who', b.who === undefined ? 'exact' : who.id ? who.how : 'default', b.who !== undefined && who.how !== 'exact' && `beats[${i}].who: ${q(b.who)} → ${whoId}`);
    const tg = findRef(b.target, allIds.filter((x) => x !== whoId));
    fb('beats.target', b.target === undefined ? 'exact' : tg.id ? tg.how : 'default', b.target !== undefined && tg.how !== 'exact' && `beats[${i}].target: ${q(b.target)} → ${tg.id ?? 'none'}`);
    const r = { type: t.id, who: whoId };
    if (tg.id) r.target = tg.id;
    const sec = typeof b.seconds === 'number' ? b.seconds : parseFloat(b.seconds);
    if (sec > 0) r.seconds = sec;
    if (b.mood !== undefined) { const m = resolveWord(b.mood, 'moods', null); fb('beats.mood', m.how); if (m.id) r.mood = m.id; }
    return r;
  });
  // duration (parse "30s", clamp), then rescale the beats to it
  let d = typeof j.duration === 'number' ? j.duration : parseFloat(String(j.duration ?? '').replace(',', '.'));
  if (!Number.isFinite(d)) { d = Math.min(30, Math.max(8, defaultWeights(out.beats).reduce((s, x) => s + x, 0))); fixes.push(`duration: missing → ${d}`); fb('duration', 'default'); }
  else if (d < LIMITS.duration[0] || d > LIMITS.duration[1]) { const d2 = Math.min(LIMITS.duration[1], Math.max(LIMITS.duration[0], d)); fixes.push(`duration: ${d} → ${d2}`); d = d2; fb('duration', 'fuzzy'); }
  else fb('duration', 'exact');
  out.duration = Math.round(d * 10) / 10;
  const maxBeats = Math.min(LIMITS.beats, Math.floor(out.duration / LIMITS.minBeat));
  if (out.beats.length > maxBeats) { fixes.push(`beats: ${out.beats.length} too many for ${out.duration}s, kept ${maxBeats}`); out.beats = [...out.beats.slice(0, maxBeats - 1), out.beats[out.beats.length - 1]]; }
  const secs = rescale(out.beats.map((b, i) => b.seconds ?? BEATS[b.type].weight), out.duration);
  out.beats.forEach((b, i) => { b.seconds = secs[i]; });
  // music
  const mu = isObj(j.music) ? j.music : typeof j.music === 'string' ? { cue: j.music } : {};
  const cue = resolvePart(mu.cue, 'music');
  fb('music.cue', mu.cue === undefined ? 'exact' : cue.how, mu.cue !== undefined && cue.how !== 'exact' && `music.cue: ${q(mu.cue)} → ${cue.id}`);
  const filmMood = out.beats.find((b) => b.mood)?.mood || 'playful';
  const mm = mu.mood === undefined ? { id: filmMood, how: 'exact' } : resolveWord(mu.mood, 'moods', filmMood);
  fb('music.mood', mm.how);
  out.music = { cue: cue.id, mood: mm.id };
  return { json: out, fixes: fixes.filter(Boolean), fallbacks };
}
