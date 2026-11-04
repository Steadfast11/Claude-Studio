// tools/_browser.mjs — shared headless-Chromium helper for stills.mjs and render.mjs.
//   const { browser, page, info, close } = await openFilm({ film: 'anor', scale: 0.5, quality: 'final' });
//   const png = await grab(page, t);   // Buffer (PNG) of exactly time t
// Uses the GPU on macOS (Metal) / Windows and SwiftShader on GPU-less Linux (cloud). Playwright is pinned to 1.58.2
// (install its browser once with `npx playwright install chromium`); on Linux we fall back to /opt/pw-browsers/chromium.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

export function parseArgs(argv = process.argv.slice(2)) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    a[k.slice(2)] = v;
  }
  return a;
}

/** GPU flags per platform: Metal on macOS, the real GPU on Windows, SwiftShader on GPU-less Linux (cloud).
 *  Override with VS_GL=swiftshader|gpu. HEADED=1 opens a visible window (guaranteed GPU on any desktop). */
function glArgs() {
  const mode = process.env.VS_GL || (process.platform === 'linux' ? 'swiftshader' : 'gpu');
  if (mode === 'swiftshader') return ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'];
  return process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : ['--enable-gpu'];
}

export async function launch() {
  const args = [...glArgs(), '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
  const headless = !process.env.HEADED;
  try { return await chromium.launch({ args, headless }); } catch (e) {
    const fallback = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
    if (!fs.existsSync(fallback)) throw e;
    return chromium.launch({ executablePath: fallback, args, headless });
  }
}

export async function openFilm({ film, part, gallery, per, action, scale = 1, quality = 'final', browser, server, verbose = true, timeout = 600000, view }) {
  const srv = server || (await startServer(0));
  const br = browser || (await launch());
  const W = Math.round(1920 * scale), H = Math.round(1080 * scale);
  const page = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(timeout);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  const q = new URLSearchParams({ render: '', scale: String(scale), quality, ...(film ? (String(film).endsWith('.json') ? { 'film-json': film } : { film }) : gallery ? { gallery, ...(per ? { per: String(per) } : {}), ...(action ? { action } : {}) } : { part }), ...(view ? { view } : {}) });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html?${q}`);
  await page.waitForFunction(() => window.READY || window.ERROR, null, { timeout });
  const err = await page.evaluate(() => window.ERROR);
  if (err) throw new Error(err);
  const info = await page.evaluate(() => ({ ...window.FILM_INFO, duration: window.DURATION, fps: window.FPS }));
  if (verbose) console.log(`WebGL: ${info.renderer}\n${film || part || gallery}: ${info.duration}s @ ${info.fps}fps, ${info.size.join('×')}, quality=${info.quality}`);
  return {
    browser: br, page, info, server: srv,
    close: async () => { await page.close(); if (!browser) await br.close(); if (!server) srv.server.close(); },
  };
}

/** Render time t and return the canvas as an image Buffer (png | jpeg). */
export async function grab(page, t, type = 'png', quality = 0.95) {
  const b64 = await page.evaluate(([t, type, q]) => { window.seek(t); return document.getElementById('view').toDataURL(`image/${type}`, q).split(',')[1]; }, [t, type, quality]);
  return Buffer.from(b64, 'base64');
}
