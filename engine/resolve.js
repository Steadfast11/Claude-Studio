// engine/resolve.js — free words (en/uz/ru) → existing part ids. Never throws.
//   resolvePart('cat', 'cast')  → { id: 'pista', how: 'category' }
//   how: exact | synonym | category | fuzzy | default   (anything but exact/synonym counts as a fallback)
// Order: exact part id → part synonym → category word (→ category default) → fuzzy (edit distance / tokens) → kind default.
// Slots: cast (character | mover | rockable | static) · prop (placeable props) · set · light · music.
import tags from '../data/tags.json' with { type: 'json' };
import { listParts } from './core/registry.js';
import '../parts/index.js';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFC').replace(/[ʻʼ`’‘]/g, "'").replace(/[^\p{L}\p{N}' -]+/gu, ' ').replace(/\s+/g, ' ').trim();
const KIND_OF_SLOT = { cast: ['character', 'prop'], prop: ['prop'], set: ['set'], light: ['light'], music: ['music'] };
const DEFAULT_OF_SLOT = { cast: tags.defaults.character, prop: tags.defaults.prop, set: tags.defaults.set, light: tags.defaults.light, music: tags.defaults.music };

export const capOf = (id) => tags.caps[id] || (partKind(id) === 'character' ? 'actor' : 'static');
export const partKind = (id) => listParts().find((d) => d.name === id)?.kind;
const placeable = (id) => capOf(id) !== 'dressing';

/** Part ids usable in a slot (the schema enums come from here). */
export function idsFor(slot) {
  const kinds = KIND_OF_SLOT[slot] || [];
  return listParts().filter((d) => kinds.includes(d.kind) && (slot === 'set' || slot === 'light' || slot === 'music' || placeable(d.name))).map((d) => d.name);
}

let INDEX = null; // word → part id, for parts and categories
function index() {
  if (INDEX) return INDEX;
  const part = new Map(), cat = new Map();
  for (const [id, words] of Object.entries(tags.parts)) for (const w of words) if (!part.has(norm(w))) part.set(norm(w), id);
  for (const [c, { default: d, words }] of Object.entries(tags.categories)) for (const w of words) if (!cat.has(norm(w))) cat.set(norm(w), { id: d, cat: c });
  return (INDEX = { part, cat });
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// crude stemming so "cats", "mushuklar", "кошки" still hit
const stems = (w) => [w, w.replace(/(lar|ler|ning|ni|ga|da|dan|s|es|ы|и|а|у|ом|ой)$/u, '')].filter((x, i, a) => x && a.indexOf(x) === i);

function lookup(word, ok) {
  const { part, cat } = index();
  const w = norm(word);
  if (!w) return null;
  for (const s of stems(w)) {
    if (part.has(s) && ok(part.get(s))) return { id: part.get(s), how: 'synonym' };
    if (cat.has(s) && ok(cat.get(s).id)) return { id: cat.get(s).id, how: 'category' };
  }
  const toks = w.split(' ').filter((x) => x.length > 1);
  if (toks.length > 1) for (const t of toks.slice().reverse()) { const r = lookup(t, ok); if (r) return { id: r.id, how: r.how === 'synonym' ? 'synonym' : 'category' }; }
  let best = null, bd = 3;
  if (w.length >= 4) {
    for (const [k, id] of part) if (ok(id)) { const d = lev(w, k); if (d < bd) { bd = d; best = id; } }
    for (const [k, { id }] of cat) if (ok(id)) { const d = lev(w, k); if (d < bd) { bd = d; best = id; } }
  }
  return best ? { id: best, how: 'fuzzy' } : null;
}

/** Resolve any value to a part id usable in `slot`. Never throws. */
export function resolvePart(value, slot = 'prop') {
  try {
    const allowed = new Set(idsFor(slot));
    const raw = typeof value === 'object' && value ? value.part ?? value.id ?? '' : value;
    const w = norm(raw);
    if (allowed.has(w)) return { id: w, how: 'exact' };
    const r = lookup(w, (id) => allowed.has(id));
    if (r) return r;
    // dressing parts (rug, tablecloth…) asked for as props → closest placeable sibling
    const p = lookup(w, () => true);
    if (p && slot === 'prop') return { id: tags.defaults.prop, how: 'category' };
    return { id: DEFAULT_OF_SLOT[slot] || tags.defaults.prop, how: 'default' };
  } catch {
    return { id: DEFAULT_OF_SLOT[slot] || tags.defaults.prop, how: 'default' };
  }
}

/** Resolve a free word to a beat type or a mood (null if nothing fits). */
export function resolveWord(value, table, fallback = null) {
  const w = norm(value);
  const T = tags[table] || {};
  if (T[w]) return { id: w, how: 'exact' };
  for (const s of stems(w)) for (const [id, words] of Object.entries(T)) if (words.some((x) => norm(x) === s)) return { id, how: 'synonym' };
  for (const t of w.split(' ')) for (const [id, words] of Object.entries(T)) if (words.some((x) => norm(x) === t)) return { id, how: 'synonym' };
  if (w.length >= 4) for (const [id, words] of Object.entries(T)) if (words.some((x) => lev(w, norm(x)) <= 1)) return { id, how: 'fuzzy' };
  return { id: fallback, how: 'default' };
}

export { tags, norm };
