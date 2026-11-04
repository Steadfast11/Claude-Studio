// tools/coverage.mjs — 1,000 synthetic topics (small en/uz/ru word lists, seeded) → mock film.json → autofix →
// validate → compile → deep structural check of the compiled film. Writes renders/coverage.md.
//   npm run coverage -- --n 1000 [--seed 1] [--browser 4]   (--browser N: also build + seek N compiled films in Chromium)
import fs from 'node:fs';
import { mockAssemble } from './mock-assemble.mjs';
import { validate, autofix } from '../engine/validate.js';
import { compileFilm } from '../engine/compile.js';
import { capOf } from '../engine/resolve.js';
import { SFX } from '../engine/audio/sfx.js';
import { LIMITS } from '../engine/schema.js';
import { rng } from '../engine/core/rng.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', 1000)), SEED = Number(arg('seed', 1)), BROWSER = Number(arg('browser', 0));

const W = {
  mood: ['', '', 'funny', 'sad', 'scary', 'epic', 'cozy', 'silly', 'quvnoq', 'g\'amgin', 'весёлый', 'грустный', 'mysterious', 'romantic'],
  who: ['a cat', 'a dog', 'a robot', 'a little girl', 'grandpa', 'a fox', 'a tiny dragon', 'a white rabbit', 'two friends', 'a chef', 'a penguin', 'an astronaut', 'a unicorn', 'a hedgehog',
    'mushuk', 'kuchuk', 'quyon', 'qizcha', 'bobo', 'кот', 'собака', 'ёжик', 'девочка', 'робот', 'a green alien', 'a knight', 'a snail', 'pista'],
  verb: ['chases', 'finds', 'loses', 'catches', 'bumps into', 'celebrates with', 'dances around', 'races', 'hugs', 'falls over', 'quvadi', 'topadi', 'yo\'qotadi', 'ловит', 'ищет',
    'гоняется за', 'paints', 'builds', 'sings to', 'shares', 'eats', 'rescues', 'waits for'],
  what: ['a pomegranate', 'a melon', 'a teapot', 'a cup of tea', 'warm bread', 'plov', 'a golden coin', 'a balloon', 'a book', 'anor', 'olma', 'tarvuz', 'non', 'choynak', 'яблоко', 'мяч',
    'чайник', 'a rocket', 'a smartphone', 'a guitar', 'a birthday cake', 'a lost star', 'a pizza', 'a snowman', 'a red ball', 'grandma', 'a kitten'],
  where: ['', 'in the kitchen', 'at the bazaar', 'in space', 'in a castle', 'at school', 'in the forest', 'uyda', 'bozorda', 'на кухне', 'в лесу', 'on the moon', 'in a tea house', 'at the office', 'underwater'],
  when: ['', '', 'at night', 'at sunset', 'in the rain', 'in winter', 'kechasi', 'yomg\'irda', 'ночью', 'in the morning', 'during a storm'],
  dur: ['', '', '10s', '30 seconds', '60s', '90s', '5s', '120s', '3s', '45 soniya'],
  fmt: ['', '', '', 'vertical', 'square'],
};
export function topics(n, seed = 1) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) out.push(Object.values(W).map((l) => r.pick(l)).filter(Boolean).join(' '));
  return out;
}

const VERBS = {
  actor: 'walk run sprint chase stop turn look face blink smile gasp anticipate jump hop leap land skid bonk shake peek sniff catch push lift cheer wave eat blush laugh sit balance hug snap'.split(' '),
  mover: 'wobble fall hop roll carry crack'.split(' '), rockable: ['wobble'], static: [], dressing: [],
};
/** Structural checks of a compiled film (what the stage would otherwise throw on). */
export function deepCheck(f) {
  const e = [];
  const D = f.duration;
  if (!(D >= LIMITS.duration[0] && D <= LIMITS.duration[1])) e.push(`duration ${D}`);
  if (!f.shots.length || f.shots[0].t0 !== 0 || Math.abs(f.shots[f.shots.length - 1].t1 - D) > 1e-6) e.push('shots do not cover the film');
  f.shots.forEach((s, i) => { if (!(s.t1 > s.t0)) e.push(`shot ${i} empty`); if (i && Math.abs(s.t0 - f.shots[i - 1].t1) > 1e-6) e.push(`shot ${i} gap`); if (!['static', 'crane', 'push', 'pull', 'track'].includes(s.rig)) e.push(`shot ${i} rig ${s.rig}`); });
  const parts = {};
  for (const [id, s] of Object.entries({ ...f.props, ...f.cast })) parts[id] = s.name;
  for (const a of f.action) {
    const [id, verb] = a.what.split('.');
    if (!(id in parts)) { e.push(`action ${a.what}: unknown actor`); continue; }
    if (!VERBS[capOf(parts[id])].includes(verb)) e.push(`action ${a.what}: ${parts[id]} has no ${verb}`);
    if (!(a.t >= 0 && a.t < D)) e.push(`action ${a.what} at ${a.t}`);
    for (const k of ['at', 'target', 'by']) if (typeof a.params[k] === 'string' && !(a.params[k].split('.')[0] in parts)) e.push(`action ${a.what}.${k}: ${a.params[k]}`);
  }
  for (const s of f.sfx) if (!(s.name in SFX)) e.push(`sfx ${s.name}`);
  const order = ['hold', 'chase', 'hit', 'tension', 'freeze', 'relief', 'climax', 'resolve', 'end'];
  order.forEach((k, i) => { if (!(f.markers[k] >= 0) || (i && !(f.markers[k] > f.markers[order[i - 1]]))) e.push(`marker ${k}`); });
  // nothing overlaps; every walking/rolling path stays out of prop footprints
  const L = f.assembly;
  const P = Object.keys(f.props).map((id) => ({ id, p: f.props[id].place.pos, r: radiusFrom(f, id) }));
  P.forEach((a, i) => P.slice(i + 1).forEach((b) => { if (Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) < a.r + b.r - 0.01) e.push(`props ${a.id}/${b.id} overlap`); }));
  for (const a of f.action) if (Array.isArray(a.params.path)) for (const q of a.params.path) for (const b of P) {
    if (a.params.path.indexOf(q) === a.params.path.length - 1) continue; // last point may touch its goal
    if (Math.hypot(q[0] - b.p[0], q[1] - b.p[1]) < b.r - 0.5) e.push(`${a.what} path enters ${b.id}`);
  }
  if (f.titleCard && !(f.titleCard.t0 < D)) e.push('title after end');
  void L;
  return e;
}
const radiusFrom = (f, id) => f.assembly && f.props[id] ? (f.__r ||= {}, f.__r[id] ??= rOf(f.props[id])) : 6;
const rOf = (s) => { const o = s.opts; return o.diameter ? o.diameter / 2 : o.size ? o.size / 2 : o.length ? Math.min(o.length / 2, 8) : o.height ? o.height * 0.65 : 6; };

async function main() {
  const list = topics(N, SEED);
  let rawValid = 0, fixedValid = 0, compiled = 0, deepOk = 0;
  const fb = {}, failures = [], fixesCount = {};
  const t0 = Date.now();
  const samples = [];
  for (const topic of list) {
    const raw = mockAssemble(topic);
    if (!validate(raw).length) rawValid++;
    const fx = autofix(raw);
    for (const [k, hows] of Object.entries(fx.fallbacks)) for (const h of hows) { (fb[k] ||= {})[h] = (fb[k][h] || 0) + 1; }
    for (const f of fx.fixes) { const k = f.split(':')[0].replace(/\[\d+\]/, '[]'); fixesCount[k] = (fixesCount[k] || 0) + 1; }
    const v2 = validate(fx.json);
    if (!v2.length) fixedValid++;
    let errs = v2.slice();
    try {
      const film = compileFilm(raw);
      compiled++;
      errs = errs.concat(deepCheck(film));
      if (samples.length < BROWSER) samples.push({ topic, json: fx.json });
    } catch (err) { errs.push(`compile threw: ${err.message}`); }
    if (!errs.length) deepOk++; else if (failures.length < 15) failures.push(`- \`${topic}\` → ${errs.slice(0, 3).join('; ')}`);
  }
  let browserLine = '';
  if (BROWSER) {
    const { openFilm, launch } = await import('./_browser.mjs');
    const { startServer } = await import('./serve.mjs');
    const server = await startServer(0), browser = await launch();
    let ok = 0;
    fs.mkdirSync('.tmp/coverage', { recursive: true });
    for (const [i, s] of samples.entries()) {
      const p = `.tmp/coverage/${i}.json`;
      fs.writeFileSync(p, JSON.stringify(s.json));
      try {
        const { page, close } = await openFilm({ film: p, scale: 0.1, quality: 'draft', browser, server, verbose: false });
        await page.evaluate(() => { for (let t = 0; t < window.DURATION; t += window.DURATION / 6) window.seek(t); });
        await close(); ok++;
      } catch (err) { failures.push(`- browser \`${s.topic}\` → ${err.message.slice(0, 160)}`); }
    }
    await browser.close(); server.server.close();
    browserLine = `| built + seeked in Chromium | ${ok} / ${samples.length} |\n`;
  }
  const pct = (x) => `${((100 * x) / N).toFixed(1)} %`;
  const rows = Object.entries(fb).sort().map(([k, h]) => {
    const tot = Object.values(h).reduce((s, x) => s + x, 0), fall = tot - (h.exact || 0) - (h.synonym || 0);
    return `| ${k} | ${tot} | ${((100 * fall) / tot).toFixed(1)} % | ${['exact', 'synonym', 'category', 'fuzzy', 'default'].map((x) => h[x] || 0).join(' / ')} |`;
  });
  const md = `# film.json coverage (phase 1)

${N} synthetic topics (seed ${SEED}) from small en/uz/ru word lists → \`tools/mock-assemble.mjs\` (free words, like a small LLM)
→ \`engine/validate.js\` autofix → validate → \`engine/compile.js\` → structural check. ${((Date.now() - t0) / 1000).toFixed(1)} s.

| check | result |
|---|---|
| raw mock film.json already valid (before autofix) | ${pct(rawValid)} |
| valid after autofix | ${pct(fixedValid)} |
| compiled without throwing | ${pct(compiled)} |
| **valid end-to-end (autofix + compile + deep check)** | **${pct(deepOk)}** |
${browserLine}
## Fallbacks per field

"fallback" = not an exact id and not a listed synonym (category default, fuzzy match or kind default).

| field | values | fallback % | exact / synonym / category / fuzzy / default |
|---|---|---|---|
${rows.join('\n')}

## Most common auto-fixes

${Object.entries(fixesCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Failures

${failures.length ? failures.join('\n') : 'none'}

Sample topics: ${list.slice(0, 5).map((t) => `\`${t}\``).join(' · ')}
`;
  fs.mkdirSync('renders', { recursive: true });
  fs.writeFileSync('renders/coverage.md', md);
  console.log(`coverage: ${pct(deepOk)} valid end-to-end (raw ${pct(rawValid)}, fixed ${pct(fixedValid)}, compiled ${pct(compiled)}) → renders/coverage.md`);
  if (failures.length) console.log(failures.slice(0, 5).join('\n'));
  process.exitCode = deepOk === N ? 0 : 1;
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
