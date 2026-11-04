// tools/parts-doc.mjs — renders a still of every part's demo into renders/parts/ and regenerates docs/PARTS.md
// from the registry (name, kind, documented default options) and each part file's header comment.
//   npm run parts-doc            (options: --scale 0.4 --quality preview --only piyola,non)
import fs from 'node:fs';
import path from 'node:path';
import { launch, openFilm, grab, parseArgs } from './_browser.mjs';
import { startServer } from './serve.mjs';

const a = parseArgs();
const server = await startServer(0), browser = await launch();
const first = await openFilm({ part: 'studio', scale: 0.25, quality: 'draft', browser, server, verbose: false });
const parts = await first.page.evaluate(() => window.PARTS);
await first.close();
const only = a.only ? String(a.only).split(',') : null;
fs.mkdirSync('renders/parts', { recursive: true });
// map part name → file + header comment
const files = [];
const walk = (d) => fs.readdirSync(d).forEach((f) => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js') && !f.startsWith('_') && f !== 'index.js') files.push(p); });
walk('parts');
const fileOf = (name) => files.find((f) => fs.readFileSync(f, 'utf8').includes(`name: '${name}'`));
const header = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
for (const p of parts) {
  if (only && !only.includes(p.name)) continue;
  if (p.kind === 'music') continue;
  const t0 = Date.now();
  const { page, info, close } = await openFilm({ part: p.name, scale: Number(a.scale || 0.4), quality: a.quality || 'preview', browser, server, verbose: false });
  fs.writeFileSync(`renders/parts/${p.name}.png`, await grab(page, info.duration * 0.62));
  await close();
  console.log(`${p.name.padEnd(14)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
let md = `# Parts catalogue\n\nEvery part is a factory registered with \`definePart\` (see \`engine/core/registry.js\`). Call it with options\n(all optional — the defaults below already look right) and place it with \`.at(...)\`. Stills are regenerated with\n\`npm run parts-doc\`; each comes from the part's own \`demo\`.\n\n`;
const kinds = ['character', 'prop', 'set', 'light', 'music'];
for (const k of kinds) {
  const list = parts.filter((p) => p.kind === k);
  if (!list.length) continue;
  md += `## ${k[0].toUpperCase() + k.slice(1)}s\n\n`;
  for (const p of list) {
    const f = fileOf(p.name);
    md += `### \`${p.name}\` — ${f ? `[${f}](../${f})` : ''}\n\n`;
    if (fs.existsSync(`renders/parts/${p.name}.png`)) md += `![${p.name}](../renders/parts/${p.name}.png)\n\n`;
    if (f) md += '```text\n' + header(f) + '\n```\n\n';
    md += '| option | default |\n|---|---|\n' + Object.entries(p.options).map(([o, v]) => `| \`${o}\` | \`${JSON.stringify(v)}\` |`).join('\n') + '\n\n';
  }
}
fs.writeFileSync('docs/PARTS.md', md);
console.log('wrote docs/PARTS.md');
await browser.close(); server.server.close();
