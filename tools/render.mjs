// tools/render.mjs — frame-accurate film render: headless Chromium seeks every frame, PNGs are piped into ffmpeg
// (libx264 crf 16, yuv420p), the soundtrack is rendered offline in the page and muxed as AAC 192k.
//   npm run render -- --film anor                      # → renders/anor.mp4 (1920×1080, film fps)
//   options: --scale 0.5  --quality final|preview|draft  --from 3 --to 8 (seconds)  --workers 3
//            --out path.mp4  --audio-only (→ .wav)  --no-audio  --crf 16  --preset medium
// Workers are separate browser processes, each encoding its own frame range; segments are concatenated losslessly.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { launch, openFilm, grab, parseArgs } from './_browser.mjs';
import { startServer } from './serve.mjs';

const a = parseArgs();
const film = a.film;
if (!film) { console.error('usage: npm run render -- --film <name> [--scale 0.5] [--workers 2]'); process.exit(1); }
const scale = Number(a.scale || 1), quality = a.quality || 'final', workers = Math.max(1, Number(a.workers || 1));
const tmp = path.join('.tmp', `render-${film}`);
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync('renders', { recursive: true });
const out = a.out || path.join('renders', `${film}${scale !== 1 ? `-${scale}x` : ''}.mp4`);
const t0 = Date.now();
const server = await startServer(0);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const fmt = (s) => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;

// probe the film (duration, fps, renderer) and render the audio in one page
const probeBrowser = await launch();
const probe = await openFilm({ film, scale: 0.25, quality: 'draft', browser: probeBrowser, server });
const { duration, fps } = probe.info;
const from = Number(a.from || 0), to = Math.min(Number(a.to || duration), duration);
const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
let wav = null;
if (!a['no-audio']) {
  const ta = Date.now();
  const b64 = await probe.page.evaluate(() => window.renderAudio());
  wav = path.join(tmp, `${film}.wav`);
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  console.log(`audio rendered in ${((Date.now() - ta) / 1000).toFixed(1)}s → ${wav}`);
}
await probe.close(); await probeBrowser.close();
if (a['audio-only']) {
  const dst = a.out || path.join('renders', `${film}.wav`);
  fs.copyFileSync(wav, dst); console.log('wrote', dst); server.server.close(); process.exit(0);
}

// split frames across workers
const total = f1 - f0, per = Math.ceil(total / workers);
let done = 0;
const progress = () => {
  const el = (Date.now() - t0) / 1000, rate = done / Math.max(el, 1e-3);
  process.stdout.write(`\r  frames ${done}/${total}  ${rate.toFixed(2)} fps  elapsed ${fmt(el)}  eta ${fmt((total - done) / Math.max(rate, 1e-6))}   `);
};
async function work(w) {
  const a0 = f0 + w * per, a1 = Math.min(f1, a0 + per);
  if (a1 <= a0) return null;
  const seg = path.join(tmp, `seg${w}.mp4`);
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', a.preset || 'medium', '-crf', String(a.crf || 16), '-pix_fmt', 'yuv420p', '-r', String(fps), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  const browser = await launch();
  const { page, close } = await openFilm({ film, scale, quality, browser, server, verbose: w === 0 });
  for (let f = a0; f < a1; f++) {
    const png = await grab(page, f / fps);
    if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once('drain', r));
    done++; progress();
  }
  enc.stdin.end();
  await finished; await close(); await browser.close();
  return seg;
}
const segs = (await Promise.all([...Array(workers)].map((_, w) => work(w)))).filter(Boolean);
process.stdout.write('\n');
const list = path.join(tmp, 'segments.txt');
fs.writeFileSync(list, segs.map((s) => `file '${path.resolve(s)}'`).join('\n'));
const video = path.join(tmp, 'video.mp4');
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
const mux = ['-y', '-loglevel', 'error', '-i', video];
if (wav) mux.push('-ss', String(from), '-t', String(to - from), '-i', wav, '-c:a', 'aac', '-b:a', '192k', '-map', '0:v', '-map', '1:a');
mux.push('-c:v', 'copy', '-movflags', '+faststart', out);
execFileSync(ffmpeg, mux);
server.server.close();
const secs = (Date.now() - t0) / 1000;
console.log(`wrote ${out}  (${total} frames in ${fmt(secs)}, ${(secs / total).toFixed(2)} s/frame)`);
