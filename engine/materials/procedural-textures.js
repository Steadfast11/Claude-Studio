// engine/materials/procedural-textures.js — canvas-drawn textures; no image files anywhere.
//   const { map, bump } = woodTexture({ base: '#8a5a33', seed: 2 });
//   const tex = ikatTexture({ colors: ['#b31b2c', '#f2c14e', '#1f3c88', '#f7efe0'], seed: 4 });
//   const tile = motifTexture({ bg: '#fff', cols: 6, rows: 3, draw: (g, w, h, r) => { ... } });
// All generators are deterministic (seeded rng). Colour maps are tagged sRGB, data maps (bump/rough) linear.
import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { fbm2, noise2 } from '../core/math.js';

const texCache = new Map();

/** Create a texture by drawing on a canvas. key (optional) caches the result. */
export function canvasTexture(w, h, draw, { srgb = true, repeat = [1, 1], key, wrap = THREE.RepeatWrapping } = {}) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (key) texCache.set(key, t);
  return t;
}

/** Per-pixel painter: fn(u, v) → [r,g,b] in 0..255 (or a single grey value). */
export function pixelTexture(w, h, fn, opts) {
  return canvasTexture(w, h, (g) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      if (typeof c === 'number') { img.data[i] = img.data[i + 1] = img.data[i + 2] = c; }
      else { img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; }
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, opts);
}

/** Tileable-ish fractal noise (grey). */
export function noiseTexture({ size = 256, scale = 8, octaves = 4, seed = 1, contrast = 1, srgb = false } = {}) {
  return pixelTexture(size, size, (u, v) => 128 + 127 * Math.max(-1, Math.min(1, fbm2(u * scale, v * scale, seed, octaves) * 1.8 * contrast)),
    { srgb, key: `noise${size}-${scale}-${octaves}-${seed}-${contrast}` });
}

const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; };
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Wood: stretched ring noise. Returns { map, bump }. u runs along the grain. */
export function woodTexture({ base = '#8b5a35', dark = '#4e2c17', light = '#b07a4a', size = 512, rings = 7, planks = 4, seed = 1 } = {}) {
  const B = rgb(base), D = rgb(dark), L = rgb(light);
  const f = (u, v) => {
    const plank = Math.floor(v * planks), pv = v * planks - plank;
    const w = pv * rings + plank * 3.7 + fbm2(u * 1.3 + plank * 5, pv * 2, seed + plank, 4) * 0.55 + Math.sin(u * 6.283 * 2 + plank) * 0.15;
    const ring = Math.abs(((w % 1) + 1) % 1 - 0.5) * 2; // 0 at ring centre
    const fiber = noise2(u * 4 + plank * 9, v * 220, seed + 9) * 0.5 + 0.5;
    const seam = Math.min(pv, 1 - pv) * size / planks < 1.2 ? 1 : 0;
    const tone = noise2(plank * 3.1, 0.5, seed + 2) * 0.25;
    return { k: Math.pow(ring, 4), fiber, seam, tone };
  };
  const map = pixelTexture(size, size, (u, v) => { const { k, fiber, seam, tone } = f(u, v); const c = mixRGB(mixRGB(mixRGB(L, B, 0.45 + fiber * 0.55 + tone), D, k * 0.55), [20, 10, 5], seam * 0.7); return c; }, { key: `wood${base}${seed}${rings}${planks}` });
  const bump = pixelTexture(size, size, (u, v) => { const { k, fiber, seam } = f(u, v); return 190 - k * 50 - fiber * 40 - seam * 150; }, { srgb: false, key: `woodb${seed}${rings}${planks}` });
  return { map, bump };
}

/** Plain cloth weave (over-under threads). Returns { map, bump }. */
export function weaveTexture({ warp = '#d8cfc0', weft = '#c9bca8', threads = 64, size = 256, seed = 1 } = {}) {
  const A = rgb(warp), B = rgb(weft);
  const cell = (x, y) => {
    const tx = Math.floor(x * threads), ty = Math.floor(y * threads);
    const fx = x * threads - tx, fy = y * threads - ty;
    const over = (tx + ty) % 2 === 0;
    const prof = over ? Math.sin(Math.PI * fy) : Math.sin(Math.PI * fx);
    return { over, prof, n: noise2(tx * 0.7, ty * 0.7, seed) };
  };
  const map = pixelTexture(size, size, (u, v) => { const c = cell(u, v); return mixRGB(c.over ? A : B, [0, 0, 0], 0.25 * (1 - c.prof) - c.n * 0.05); }, { key: `weave${warp}${weft}${threads}${seed}` });
  const bump = pixelTexture(size, size, (u, v) => 60 + cell(u, v).prof * 160, { srgb: false, key: `weaveb${threads}${seed}` });
  return { map, bump };
}

/**
 * Ikat-style resist-dyed cloth: vertical bands of zig-zag "flame" shapes whose edges are feathered and
 * misregistered thread-by-thread (the signature blur of ikat). colors[0] is the ground.
 */
export function ikatTexture({ colors = ['#f4ead8', '#b3122e', '#f2b632', '#1f3f8f', '#2c7a4b'], bands = 5, size = 512, seed = 1, zig = 6, sharp = 0.6 } = {}) {
  const C = colors.map(rgb);
  const r = rng(seed);
  const bandDefs = Array.from({ length: bands }, () => ({ c: 1 + r.int(0, C.length - 2), c2: 1 + r.int(0, C.length - 2), w: r.range(0.55, 0.95), phase: r.next(), z: r.int(Math.max(2, zig - 2), zig + 2) }));
  return pixelTexture(size, size, (u, v, px, py) => {
    const thread = Math.floor(py / 2); // misregistration per weft thread
    const jit = noise2(thread * 0.37, 1.3, seed) * 0.0175;
    const x = u * bands + jit;
    const bi = Math.floor(x), fx = x - bi;
    const b = bandDefs[((bi % bands) + bands) % bands];
    const tri = Math.abs(((v * b.z + b.phase) % 1) - 0.5) * 2; // zig-zag 0..1
    const width = b.w * (0.35 + 0.65 * tri);
    const d = Math.abs(fx - 0.5) * 2; // 0 at band centre
    const inner = d < width * 0.45 ? 1 : 0;
    const edge = 1 / (1 + Math.exp(-(width - d) * 40 * sharp));
    let col = mixRGB(C[0], C[b.c], edge);
    if (inner) col = mixRGB(col, C[b.c2], 0.85);
    const grain = noise2(px * 0.9, py * 0.15, seed + 5) * 10;
    return [col[0] + grain, col[1] + grain, col[2] + grain];
  }, { key: `ikat${colors.join()}${bands}${seed}${zig}` });
}

/** Repeating motif on a (optionally half-drop) lattice. draw(g, cellW, cellH, rand, col, row) draws one cell centred at 0,0. */
export function motifTexture({ w = 1024, h = 512, bg = '#ffffff', cols = 8, rows = 4, halfDrop = true, draw, seed = 1, key } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows, r = rng(seed);
    for (let row = -1; row <= rows; row++) for (let col = -1; col <= cols; col++) {
      g.save();
      g.translate((col + 0.5) * cw, (row + 0.5 + (halfDrop && col % 2 ? 0.5 : 0)) * ch);
      draw(g, cw, ch, r, col, row);
      g.restore();
    }
  }, { key });
}

/** Eight-point star lattice (girih-like), useful as a bump map for carved plaster or as a tile pattern. */
export function starLatticeTexture({ size = 512, cells = 4, line = 0.06, bg = 0, fg = 255, srgb = false, key } = {}) {
  return canvasTexture(size, size, (g) => {
    g.fillStyle = typeof bg === 'number' ? `rgb(${bg},${bg},${bg})` : bg;
    g.fillRect(0, 0, size, size);
    const c = size / cells;
    g.strokeStyle = typeof fg === 'number' ? `rgb(${fg},${fg},${fg})` : fg;
    g.lineWidth = c * line; g.lineJoin = 'round';
    for (let i = 0; i <= cells; i++) for (let j = 0; j <= cells; j++) {
      const cx = i * c, cy = j * c, R = c * 0.42, r2 = R * 0.62;
      g.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 + Math.PI / 8; const rr = k % 2 ? r2 : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(cx + R, cy); g.lineTo(cx + c - R, cy); g.moveTo(cx, cy + R); g.lineTo(cx, cy + c - R); g.stroke();
      g.beginPath(); g.arc(cx + c / 2, cy + c / 2, c * 0.12, 0, Math.PI * 2); g.stroke();
    }
  }, { srgb, key: key || `star${size}${cells}${line}${bg}${fg}` });
}
