// tools/mock-assemble.mjs — deterministic stand-in for the LLM: one-line idea → film.json written with FREE WORDS
// (like a small model would: "cat", "kitchen", "chases"), so engine/resolve.js + validate.js autofix do the real work.
//   import { mockAssemble } from './mock-assemble.mjs';  mockAssemble('a cat chases a pomegranate')
//   node tools/mock-assemble.mjs "a cat chases a pomegranate"   → prints film.json
import { tags, norm, resolveWord, partKind } from '../engine/resolve.js';

const has = (list, w) => list.some((x) => norm(x) === w);
const CHAR = [...tags.categories.character.words, ...Object.entries(tags.parts).filter(([id]) => partKind(id) === 'character').flatMap(([, w]) => w)];
const MOVER = [...tags.categories.mover.words, ...tags.parts.anor];
const THINGS = [...tags.categories.rockable.words, ...tags.categories.static.words,
  ...['kosa', 'piyola', 'choynak', 'non', 'lagan-plov', 'qoshiq', 'kurpacha', 'dasturxon'].flatMap((id) => tags.parts[id])];
const PLACES = [...tags.parts['uzbek-room'], ...tags.parts.studio];
const LIGHTS = [...tags.parts['golden-hour'], ...tags.parts['night-lamp'], ...tags.parts.overcast];
const COLOR = /^(red|orange|yellow|green|blue|purple|pink|white|black|grey|gray|brown|gold|qizil|sariq|yashil|ko'k|oq|qora|pushti|красн\S*|жёлт\S*|желт\S*|зел\S*|син\S*|бел\S*|чёрн\S*|черн\S*|розов\S*)$/u;
const STOP = new Set(['a', 'an', 'the', 'and', 'with', 'in', 'on', 'at', 'of', 'to', 'into', 'from', 'va', 'bilan', 'и', 'в', 'на', 'с']);

export function mockAssemble(idea) {
  const text = norm(idea);
  const words = text.split(' ').filter((w) => w && !STOP.has(w));
  const cast = [], props = [], verbs = [], acts = {};
  let set, light, mood, color, duration, format;
  const dm = text.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|soniya|сек\S*)\b/u);
  if (dm) duration = parseFloat(dm[1].replace(',', '.'));
  if (/vertical|portrait|vertikal|tiktok|reels|вертик/u.test(text)) format = 'vertical';
  else if (/square|kvadrat|квадрат/u.test(text)) format = 'square';
  const ids = new Set();
  const idOf = (w) => { let id = w.replace(/[^a-z0-9]/g, '') || (cast.length + props.length ? `thing${cast.length + props.length + 1}` : 'hero'); if (!/^[a-z]/.test(id)) id = `x${id}`; while (ids.has(id)) id += '2'; ids.add(id); return id; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (COLOR.test(w)) { color = w; continue; }
    const beat = resolveWord(w, 'beats');
    const act = resolveWord(w, 'actions');
    if (beat.id && beat.how !== 'fuzzy') { verbs.push(beat.id); if (act.id && act.how !== 'fuzzy') acts[verbs.length - 1] = w; continue; }
    if (act.id && act.how !== 'fuzzy' && w.length > 2) { verbs.push('perform'); acts[verbs.length - 1] = w; continue; }
    const m = resolveWord(w, 'moods');
    if (m.id && m.how !== 'fuzzy' && !mood) { mood = w; continue; }
    if (has(CHAR, w) && cast.length < 3) { cast.push({ id: idOf(w), part: w, ...(color ? { params: { color } } : {}) }); color = undefined; continue; }
    if (has(MOVER, w)) { (cast.length < 4 ? cast : props).push({ id: idOf(w), part: w }); continue; }
    if (has(THINGS, w) && props.length < 6) { props.push({ id: idOf(w), part: w }); continue; }
    if (has(PLACES, w) && !set) { set = w; continue; }
    if (has(LIGHTS, w) && !light) { light = w; continue; }
    // unknown noun-ish word: a model would still try to use it — as a prop (or the hero if there is none yet)
    if (w.length > 3 && !/^\d/.test(w) && props.length < 6 && !/(s|sec|seconds|soniya)$/.test(w)) {
      if (!cast.length) cast.push({ id: idOf(w), part: w });
      else if (cast.length === 1 && verbs.length) cast.push({ id: idOf(w), part: w });
      else props.push({ id: idOf(w), part: w });
    }
  }
  if (!cast.length) cast.push({ id: 'hero', part: 'hero' });
  for (const w of ['cup', 'bread']) if (props.length < 2) props.push({ id: idOf(w), part: w });
  const who = cast[0].id;
  const target = cast[1]?.id || props[0]?.id;
  const story = verbs.map((v, i) => ({ v, a: acts[i] })).filter((x, i, a) => (i === 0 || x.v !== a[i - 1].v || x.a) && x.v !== 'establish' && x.v !== 'title');
  const S = story.map((x) => x.v);
  if (!S.length) story.push({ v: 'chase' }, { v: 'catch' });
  const vs = () => story.map((x) => x.v);
  if (vs().includes('chase') && !vs().includes('catch') && !vs().includes('sad')) story.splice(vs().indexOf('chase') + 1, 0, { v: 'catch' });
  if (!['celebrate', 'sad'].includes(vs()[vs().length - 1])) story.push({ v: mood && resolveWord(mood, 'moods').id === 'sad' ? 'sad' : 'celebrate' });
  const beats = [{ type: 'establish', who }, { type: 'discover', who, target }, ...story.slice(0, 7).map(({ v: type, a }) => ({ type, who, ...(a ? { action: a } : {}), ...(type === 'celebrate' || type === 'sad' ? {} : { target }) })), { type: 'title', who }];
  if (mood) beats.forEach((b) => { if (b.type !== 'title') b.mood = mood; });
  const title = idea.trim().replace(/\s+\d+\s*\S*$/, '').split(/\s+/).slice(0, 6).join(' ').replace(/^./, (c) => c.toUpperCase());
  return {
    title, duration: duration ?? Math.min(40, 6 + beats.length * 2.6), ...(format ? { format } : {}),
    set: set || 'room', light: light || 'evening', cast, props, beats, music: { mood: mood || 'playful' },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(mockAssemble(process.argv.slice(2).join(' ') || 'a cat chases a pomegranate'), null, 2));
