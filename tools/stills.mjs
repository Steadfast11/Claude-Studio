// tools/stills.mjs — review without rendering the whole film: a labelled contact sheet of chosen times.
//   npm run stills -- --film anor --at shots            # start / middle / end of every shot → renders/anor-sheet.png
//   npm run stills -- --film anor --at 3.2,4.4,10.5      # specific times
//   npm run stills -- --film-json films/<slug>/film.json # a compiled film.json
//   npm run stills -- --part piyola                      # one still of a part demo → renders/parts/piyola.png
//   npm run stills -- --gallery characters --scale 0.4   # contact sheet of every character → renders/gallery-characters-sheet.png
//   options: --scale 0.5 (default)  --quality preview|final|draft  --cols 3  --out file.png  --single (no sheet, one PNG per time)
//            --view plan (top-down layout check: every still from the same camera)
import fs from 'node:fs';
import path from 'node:path';
import { openFilm, grab, parseArgs } from './_browser.mjs';

const a = parseArgs();
const scale = Number(a.scale || 0.5);
const quality = a.quality || 'preview';
const t0 = Date.now();
const { page, info, close } = await openFilm({ film: a.film || a['film-json'], part: a.part, gallery: a.gallery, per: a.per, action: a.action, scale, quality, view: a.view });

let times;
if (a.part && !a.at) times = [Number(a.t || info.duration * 0.6)];
else if (a.gallery && !a.at) times = info.shots.map((s) => s.t0 + Math.min(1.6, (s.t1 - s.t0) * 0.8));
else if (!a.at || a.at === 'shots') times = info.shots.flatMap((s) => [s.t0 + 0.02, (s.t0 + s.t1) / 2, s.t1 - 0.03]);
else if (a.at === 'all') times = [...Array(Math.floor(info.duration * 2) + 1)].map((_, i) => i / 2);
else times = String(a.at).split(',').map(Number);
times = times.map((t) => Math.min(Math.max(0, t), info.duration - 1 / info.fps));

const name = a['film-json'] ? path.basename(path.dirname(path.resolve(a['film-json']))) : a.gallery ? `gallery-${a.gallery}${a.action ? '-' + a.action : ''}` : a.film || a.part;
const outDir = a.part ? 'renders/parts' : 'renders';
fs.mkdirSync(outDir, { recursive: true });
const shots = [];
for (const t of times) {
  const s = Date.now();
  shots.push({ t, png: await grab(page, t) });
  console.log(`  t=${t.toFixed(2)}s  ${((Date.now() - s) / 1000).toFixed(1)}s`);
}
if (a.single || shots.length === 1) {
  shots.forEach(({ t, png }, i) => {
    const out = shots.length === 1 ? a.out || path.join(outDir, `${name}.png`) : path.join(outDir, `${name}-t${t.toFixed(2)}.png`);
    fs.writeFileSync(out, png); console.log('wrote', out);
  });
} else {
  const cols = Number(a.cols || 3);
  const sheet = await page.evaluate(async ([imgs, cols, title]) => {
    const load = (b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
    const ims = await Promise.all(imgs.map((x) => load(x.b64)));
    const w = ims[0].width, h = ims[0].height, pad = 8, lab = 26, head = 40;
    const rows = Math.ceil(ims.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * (w + pad) + pad; c.height = head + rows * (h + lab + pad) + pad;
    const g = c.getContext('2d');
    g.fillStyle = '#16120f'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#f0e2c8'; g.font = '600 22px sans-serif'; g.fillText(title, pad + 4, 28);
    ims.forEach((im, i) => {
      const x = pad + (i % cols) * (w + pad), y = head + Math.floor(i / cols) * (h + lab + pad);
      g.drawImage(im, x, y + lab);
      g.fillStyle = '#e0a84a'; g.font = '16px monospace'; g.fillText(imgs[i].label, x + 2, y + 18);
    });
    return c.toDataURL('image/png').split(',')[1];
  }, [shots.map(({ t, png }) => ({ b64: png.toString('base64'), label: a.gallery ? info.shots.find((s) => t >= s.t0 && t < s.t1)?.name || '' : `t=${t.toFixed(2)}s  f${Math.round(t * info.fps)}  shot ${1 + info.shots.findIndex((s) => t >= s.t0 && t < s.t1)}` })), cols, `${name} — ${info.size.join('×')} ${info.quality}`]);
  const out = a.out || path.join(outDir, `${name}${a.view ? '-' + a.view : ''}-sheet.png`);
  fs.writeFileSync(out, Buffer.from(sheet, 'base64'));
  console.log('wrote', out);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await close();
