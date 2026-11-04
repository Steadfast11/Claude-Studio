// tools/assemble.mjs — one-line idea → film.json → films/<slug>/film.json
//   npm run assemble -- "a cat chases a pomegranate"
//   LLM_URL=http://localhost:8000/v1 LLM_MODEL=qwen2.5-32b-instruct [LLM_KEY=...] npm run assemble -- "idea"
// With LLM_URL: OpenAI-compatible /chat/completions, system prompt = docs/ASSEMBLER_PROMPT.md; the reply is validated
// (engine/validate.js) and sent back with the errors up to 2 times; then the auto-fix pass makes it valid regardless.
// Without LLM_URL: the deterministic mock assembler (tools/mock-assemble.mjs). Compiles the result as a final check.
import fs from 'node:fs';
import path from 'node:path';
import { validate, autofix } from '../engine/validate.js';
import { compileFilm, slugOf } from '../engine/compile.js';
import { mockAssemble } from './mock-assemble.mjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outArg = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
const idea = args.join(' ').trim();
if (!idea) { console.error('usage: npm run assemble -- "a cat chases a pomegranate" [--out films/x/film.json]'); process.exit(1); }

const jsonOf = (text) => { const m = String(text).match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

async function askLLM(messages) {
  const base = process.env.LLM_URL.replace(/\/+$/, '');
  const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.LLM_KEY ? { Authorization: `Bearer ${process.env.LLM_KEY}` } : {}) },
    body: JSON.stringify({ model: process.env.LLM_MODEL || 'default', messages, temperature: 0.2, max_tokens: 900 }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).choices?.[0]?.message?.content ?? '';
}

let raw, source = 'mock', tries = 0;
if (process.env.LLM_URL) {
  source = process.env.LLM_MODEL || 'llm';
  const messages = [{ role: 'system', content: fs.readFileSync('docs/ASSEMBLER_PROMPT.md', 'utf8') }, { role: 'user', content: idea }];
  for (tries = 1; tries <= 3; tries++) {
    let reply = '';
    try { reply = await askLLM(messages); } catch (e) { console.warn(`  try ${tries}: ${e.message}`); if (tries === 3) break; continue; }
    raw = jsonOf(reply) ?? reply;
    const errs = validate(raw);
    console.log(`  try ${tries}: ${errs.length ? `${errs.length} error(s): ${errs.slice(0, 3).join('; ')}` : 'valid'}`);
    if (!errs.length || tries === 3) break;
    messages.push({ role: 'assistant', content: typeof raw === 'string' ? raw : JSON.stringify(raw) }, { role: 'user', content: `Fix these and reply with the full JSON only:\n- ${errs.slice(0, 12).join('\n- ')}` });
  }
  if (raw === undefined) { console.warn('  LLM unavailable → mock assembler'); raw = mockAssemble(idea); source = 'mock'; }
} else raw = mockAssemble(idea);

const { json, fixes } = autofix(raw);
const errs = validate(json);
const film = compileFilm(json); // throws only on an engine bug
const out = outArg || path.join('films', slugOf(json.title), 'film.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(json, null, 2) + '\n');
console.log(`${source}${tries ? ` (${tries} tr${tries > 1 ? 'ies' : 'y'})` : ''}: "${idea}" → ${out}`);
console.log(`  ${json.duration}s ${json.format} · ${json.set} · ${json.light} · cast ${json.cast.map((c) => `${c.id}:${c.part}`).join(' ')} · props ${json.props.map((p) => p.part).join(' ') || '-'}`);
console.log(`  beats: ${json.beats.map((b) => `${b.type}(${b.seconds}s)`).join(' → ')}`);
console.log(`  compiled: ${film.shots.length} shots, ${film.action.length} actions, ${film.sfx.length} sfx · ${errs.length ? 'INVALID: ' + errs.join('; ') : 'valid'}${fixes.length ? ` · ${fixes.length} auto-fixes` : ''}`);
console.log(`  preview: npm run dev → http://localhost:5173/?film-json=${out}`);
