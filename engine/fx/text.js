// engine/fx/text.js — titles: a 5×7 voxel font that assembles itself, plus crisp canvas-text lines.
//   const card = titleCard({ t0: 17.8, text: 'ANOR', sub: 'Анор', credit: 'Made with Voxel Studio' });
//   card.scene / card.camera are rendered as the overlay layer; card.update(t) animates it.
// Fonts are bundled from npm (@fontsource) and loaded with loadFonts() before the first frame.
import * as THREE from 'three';
import { hash } from '../core/rng.js';
import { smoothstep, clamp } from '../core/math.js';
import { E } from '../anim/easing.js';
import { chamferBox } from '../voxel/build.js';

// 5×7 glyphs: rows top→bottom, '#' = voxel. Latin caps, digits, a few marks, and common Cyrillic caps.
const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'], J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'], '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  'Б': ['#####', '#....', '#....', '####.', '#...#', '#...#', '####.'], 'Г': ['#####', '#....', '#....', '#....', '#....', '#....', '#....'],
  'Д': ['.###.', '.#.#.', '.#.#.', '.#.#.', '.#.#.', '#####', '#...#'], 'Ж': ['#.#.#', '#.#.#', '.###.', '..#..', '.###.', '#.#.#', '#.#.#'],
  'З': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'], 'И': ['#...#', '#...#', '#..##', '#.#.#', '##..#', '#...#', '#...#'],
  'Л': ['..###', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#', '#...#'], 'П': ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#...#'],
  'У': ['#...#', '#...#', '#...#', '.####', '....#', '#...#', '.###.'], 'Ф': ['..#..', '.###.', '#.#.#', '#.#.#', '.###.', '..#..', '..#..'],
  'Ч': ['#...#', '#...#', '#...#', '.####', '....#', '....#', '....#'], 'Ш': ['#.#.#', '#.#.#', '#.#.#', '#.#.#', '#.#.#', '#.#.#', '#####'],
  'Э': ['.###.', '#...#', '....#', '.####', '....#', '#...#', '.###.'], 'Я': ['.####', '#...#', '#...#', '.####', '..#.#', '.#..#', '#...#'],
};
const ALIAS = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'Ў': 'У', 'Қ': 'K', 'Ғ': 'Г', 'Ҳ': 'X' };

/** Voxel positions (x right, y up, glyph-cell units) for a string, centred at the origin. */
export function textVoxels(text, { spacing = 1, depth = 2 } = {}) {
  const out = [];
  const chars = [...text.toUpperCase()];
  const width = chars.length * (5 + spacing) - spacing;
  chars.forEach((ch, ci) => {
    const g = G[ch] || G[ALIAS[ch]] || G[' '];
    g.forEach((row, ry) => [...row].forEach((c, rx) => {
      if (c !== '#') return;
      for (let z = 0; z < depth; z++) out.push({ x: ci * (5 + spacing) + rx - (width - 1) / 2, y: 3 - ry, z: -z, glyph: ci, row: ry });
    }));
  });
  return out;
}

let fontsReady = null;
/** Load the bundled fonts (FontFace API). Families: 'VS Serif' (Playfair Display), 'VS Sans' (Nunito). */
export function loadFonts(base = '/node_modules/@fontsource') {
  if (fontsReady) return fontsReady;
  const defs = [
    ['VS Serif', 'playfair-display/files/playfair-display', ['latin', 'cyrillic'], [400, 700]],
    ['VS Sans', 'nunito/files/nunito', ['latin', 'cyrillic'], [400, 800]],
  ];
  const ranges = { latin: 'U+0000-00FF,U+2000-206F', cyrillic: 'U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' };
  const faces = [];
  for (const [fam, path, subsets, weights] of defs) for (const s of subsets) for (const w of weights) {
    faces.push(new FontFace(fam, `url(${base}/${path}-${s}-${w}-normal.woff2)`, { weight: String(w), unicodeRange: ranges[s] }));
  }
  fontsReady = Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)))).catch((e) => console.warn('font load failed', e));
  return fontsReady;
}

/** A plane showing one line of canvas text (sRGB, premultiplied fade via opacity). */
export function textPlane(str, { font = 'VS Serif', weight = 700, px = 120, color = '#f6e7c8', letterSpacing = 0, height = 1 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${weight} ${px}px "${font}"`;
  if ('letterSpacing' in g) g.letterSpacing = `${letterSpacing}px`;
  const w = Math.ceil(g.measureText(str).width + px * 0.6), h = Math.ceil(px * 1.5);
  c.width = w; c.height = h;
  g.font = `${weight} ${px}px "${font}"`;
  if ('letterSpacing' in g) g.letterSpacing = `${letterSpacing}px`;
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(str, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry((w / h) * height, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  return m;
}

/**
 * Title card overlay: voxel letters rise into place column by column (staggered, overshoot, a little spin), a glint
 * sweeps across, then subtitle and credit fade up. Returns { scene, camera, update(t), t0 }.
 */
export function titleCard({ t0 = 0, text = 'TITLE', sub = '', credit = '', color = '#c8102e', edge = '#f2c14e', y = 0.18, size = 0.03, seed = 3, depth = 2, subFont = 'VS Serif', creditFont = 'VS Sans', fly = 0.9, stagger = 0.035 } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 10);
  scene.add(new THREE.HemisphereLight('#fff1dc', '#3a2a40', 1.4));
  const key = new THREE.DirectionalLight('#ffe2b0', 3.2); key.position.set(-3, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#9fc8ff', 1.4); rim.position.set(4, -1, -3); scene.add(rim);
  const vox = textVoxels(text, { depth });
  const H = 2 * 10 * Math.tan((20 * Math.PI) / 360); // visible height at z=0
  const cell = H * size;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.15 });
  const mesh = new THREE.InstancedMesh(chamferBox(0.09), mat, vox.length);
  mesh.frustumCulled = false;
  const base = new THREE.Color(color), rimC = new THREE.Color(edge), cc = new THREE.Color();
  scene.add(mesh);
  const lines = [];
  if (sub) { const p = textPlane(sub, { font: subFont, weight: 400, height: H * 0.065, color: '#f6e9cf' }); p.position.y = H * (y - 0.165); scene.add(p); lines.push({ m: p, at: t0 + fly + 0.45 }); }
  if (credit) { const p = textPlane(credit, { font: creditFont, weight: 400, height: H * 0.028, color: '#e9d8b8', letterSpacing: 6 }); p.position.y = H * (y - 0.225); scene.add(p); lines.push({ m: p, at: t0 + fly + 0.9 }); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Eu = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const maxX = Math.max(...vox.map((v) => v.x));
  return {
    scene, camera, t0,
    update(t) {
      vox.forEach((v, i) => {
        const h1 = hash(i, seed, 1), h2 = hash(i, seed, 2), h3 = hash(i, seed, 3);
        const start = t0 + (v.x + maxX) * stagger + (3 - v.y) * 0.02 + h1 * 0.08;
        const u = clamp((t - start) / (fly * (0.75 + 0.25 * h2)));
        const k = E.outBack(u);
        const target = new THREE.Vector3(v.x * cell, v.y * cell + H * y, v.z * cell);
        const from = P.set(target.x + (h1 - 0.5) * 3 * cell, target.y - (5 + h2 * 5) * cell, target.z + (1 + h3 * 3) * cell);
        P.lerpVectors(from, target, k);
        Eu.set((1 - k) * (h1 - 0.5) * 4, (1 - k) * (h2 - 0.5) * 4, (1 - k) * (h3 - 0.5) * 3);
        const s = u > 0 ? cell * Math.min(1, E.outCubic(u * 2)) : 1e-5;
        M.compose(P, Q.setFromEuler(Eu), S.setScalar(s));
        mesh.setMatrixAt(i, M);
        // glint sweep after assembly; front face = base colour, back layer = gold edge
        const sweep = Math.exp(-(((t - t0 - fly - 0.2) * 2.2 - (v.x + maxX) / (2 * maxX) * 1.6) ** 2) * 30);
        cc.copy(v.z < 0 ? rimC : base).multiplyScalar(1 + sweep * 2.5 + (1 - smoothstep(0.6, 1, u)) * 0.6);
        mesh.setColorAt(i, cc);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      for (const l of lines) { const a = smoothstep(l.at, l.at + 0.6, t); l.m.material.opacity = a; l.m.position.z = (1 - a) * 0.5; l.m.visible = a > 0.001; }
    },
  };
}
