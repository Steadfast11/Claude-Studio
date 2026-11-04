// parts/characters/archetypes/_kit.js — shared voxel kit for character archetypes.
// Bodies are lists of primitives (voxel units, y up from 0, x/z centred) painted by role → palette colour,
// then a pattern (spots, stripes, patch, belly, gradient) is applied to the 'body' role. Appendage and
// accessory grids (ears, tails, wings, hats, glasses…) are built here too, so archetypes stay short.
//   prims: [{ s: 'rbox'|'box'|'ell'|'cyl'|'cone'|'ring', c: [x,y,z] centre (y = bottom for box/rbox/cyl/cone),
//             size: [w,h,d], r, role: 'body'|'belly'|'accent'|'limb'|'dark'|'light'|'#hex', tag }]
import { VoxelGrid } from '../../../engine/voxel/voxel.js';
import { mixHex, shade } from '../../../engine/materials/palette.js';
import { hash } from '../../../engine/core/rng.js';
import { doppiGrid } from '../pista.js';

const INK = '#1b1420';
/** Colour for a role from the palette (falls back sensibly), or a literal hex. */
export function roleColor(role, pal) {
  if (typeof role === 'string' && role.startsWith('#')) return role;
  const b = pal.body || '#b08860';
  const R = {
    body: b, head: pal.head || b, belly: pal.belly || mixHex(b, '#ffffff', 0.45), accent: pal.accent || shade(b, 0.6),
    limb: pal.limb || shade(b, 0.82), dark: pal.dark || shade(b, 0.45), light: pal.light || mixHex(b, '#ffffff', 0.7),
    muzzle: pal.muzzle || pal.belly || mixHex(b, '#ffffff', 0.5), nose: pal.nose || '#3a2a2a', horn: pal.horn || '#efe4c8',
    skin: pal.skin || '#e8b48a', hair: pal.hair || '#3a2a22', shirt: pal.shirt || pal.body || '#3f7fd8', pants: pal.pants || '#3a3f55',
    shoe: pal.shoe || '#2a2228', beak: pal.beak || '#f0a030', metal: pal.metal || '#9aa4b0', glow: pal.glow || '#7ff7ff', white: '#f3efe6', ink: INK,
  };
  return R[role] ?? b;
}

const inside = {
  box: (x, y, z, p) => Math.abs(x - p.c[0]) <= (p.size[0] - 1) / 2 + 1e-6 && y >= p.c[1] && y <= p.c[1] + p.size[1] - 1 && Math.abs(z - p.c[2]) <= (p.size[2] - 1) / 2 + 1e-6,
  rbox(x, y, z, p) {
    const [w, h, d] = p.size, r = p.r ?? 1.5;
    const hx = (w - 1) / 2, hy = (h - 1) / 2, hz = (d - 1) / 2;
    const qx = Math.max(Math.abs(x - p.c[0]) - (hx - r), 0), qy = Math.max(Math.abs(y - (p.c[1] + hy)) - (hy - r), 0), qz = Math.max(Math.abs(z - p.c[2]) - (hz - r), 0);
    return Math.abs(x - p.c[0]) <= hx + 1e-6 && Math.abs(y - (p.c[1] + hy)) <= hy + 1e-6 && Math.abs(z - p.c[2]) <= hz + 1e-6 && qx * qx + qy * qy + qz * qz <= r * r + 0.35;
  },
  ell(x, y, z, p) { const [w, h, d] = p.size; const cy = p.c[1] + (h - 1) / 2; return ((x - p.c[0]) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2 + ((z - p.c[2]) / (d / 2)) ** 2 <= 1.0001; },
  cyl(x, y, z, p) { const [w, h] = p.size; const ax = p.axis || 'y'; const r = w / 2; if (ax === 'y') return y >= p.c[1] && y <= p.c[1] + h - 1 && (x - p.c[0]) ** 2 + (z - p.c[2]) ** 2 <= r * r + 0.3; if (ax === 'z') return Math.abs(z - p.c[2]) <= (h - 1) / 2 + 1e-6 && (x - p.c[0]) ** 2 + (y - p.c[1] - r + 0.5) ** 2 <= r * r + 0.3; return Math.abs(x - p.c[0]) <= (h - 1) / 2 + 1e-6 && (z - p.c[2]) ** 2 + (y - p.c[1] - r + 0.5) ** 2 <= r * r + 0.3; },
  cone(x, y, z, p) { const [w, h] = p.size; if (y < p.c[1] || y > p.c[1] + h - 1) return false; const rr = (w / 2) * (1 - (y - p.c[1]) / h) + 0.3; return (x - p.c[0]) ** 2 + (z - p.c[2]) ** 2 <= rr * rr; },
  ring(x, y, z, p) { const [w, h, d] = p.size; const cy = p.c[1] + (h - 1) / 2; const e = ((x - p.c[0]) / (w / 2)) ** 2 + ((z - p.c[2]) / (d / 2)) ** 2; const t = p.thick ?? 0.45; return Math.abs(y - cy) <= (h - 1) / 2 + 1e-6 && e <= 1.0001 && e >= (1 - t) ** 2; },
};
const extent = (p) => {
  const [w, h, d] = p.size, half = (v) => Math.ceil(v / 2) + 1;
  if (p.s === 'cyl' && p.axis === 'z') return [p.c[0] - half(w), p.c[1] - 1, p.c[2] - half(h), p.c[0] + half(w), p.c[1] + w + 1, p.c[2] + half(h)];
  if (p.s === 'cyl' && p.axis === 'x') return [p.c[0] - half(h), p.c[1] - 1, p.c[2] - half(w), p.c[0] + half(h), p.c[1] + w + 1, p.c[2] + half(w)];
  return [p.c[0] - half(w), p.c[1] - 1, p.c[2] - half(d ?? w), p.c[0] + half(w), p.c[1] + h + 1, p.c[2] + half(d ?? w)];
};

/** Paint primitives into a grid (later prims win). Each voxel remembers its role (for the pattern pass). */
export function paint(prims, pal, { grid = new VoxelGrid(), roles = new Map() } = {}) {
  for (const p of prims) {
    const test = inside[p.s || 'box'];
    const [x0, y0, z0, x1, y1, z1] = extent(p);
    for (let x = Math.floor(x0); x <= x1; x++) for (let y = Math.floor(y0); y <= y1; y++) for (let z = Math.floor(z0); z <= z1; z++) {
      if (!test(x, y, z, p)) continue;
      if (p.cut !== undefined && y < p.cut) continue;
      if (p.erase) { grid.delete(x, y, z); continue; }
      grid.set(x, y, z, roleColor(p.role || 'body', pal), p.tag || 'base');
      roles.set(`${x},${y},${z}`, p.role || 'body');
    }
  }
  return { grid, roles };
}

/** Pattern over 'body' voxels: none | spots | stripes | hstripes | patch | belly | gradient | speckle. */
export function pattern(grid, roles, pal, name = 'none', seed = 1) {
  if (!name || name === 'none') name = 'gradient';
  const { min, max } = grid.bounds();
  const H = max[1] - min[1] + 1, D = max[2] - min[2] + 1;
  const b = pal.body, alt = pal.pattern || shade(b, 0.55), lite = pal.belly || mixHex(b, '#ffffff', 0.5);
  grid.paint((x, y, z, v) => {
    const role = roles.get(`${x},${y},${z}`);
    if (role !== 'body' && !(role === 'head' && !pal.head)) return undefined;
    const fy = (y - min[1]) / Math.max(1, H - 1), fz = (z - min[2]) / Math.max(1, D - 1);
    let c = mixHex(b, shade(b, 0.84), Math.max(0, fy - 0.4) * 0.7); // top a touch darker (ANOR's soft gradient)
    if (name === 'spots' && hash(Math.floor((x + 40) / 3), Math.floor((y + 40) / 3), Math.floor((z + 40) / 3), seed) < 0.22) c = alt;
    else if (name === 'stripes' && Math.floor((z - min[2] + 40) / 2) % 2 === 0 && fy > 0.25) c = alt;
    else if (name === 'hstripes' && Math.floor((y - min[1]) / 2) % 2 === 1) c = alt;
    else if (name === 'patch' && hash(Math.floor((x + 40) / 4), Math.floor((y + 40) / 4), Math.floor((z + 40) / 5), seed) < 0.32) c = alt;
    else if (name === 'belly' && fy < 0.5 && z > (min[2] + max[2]) / 2 + 1) c = lite;
    else if (name === 'speckle' && hash(x, y, z, seed + 9) < 0.18) c = alt;
    if (hash(x, y, z, 77) < 0.05) c = mixHex(c, '#ffffff', 0.12);
    return { color: c };
  });
}

/** Small grid helpers for appendages / accessories (all built in their own voxel space). */
export const gridOf = (prims, pal) => paint(prims, pal).grid;
export function line(pts, role, pal, thick = 1) { // a chain of voxels through integer points (tails, antennae, trunks)
  const g = new VoxelGrid(), c = roleColor(role, pal);
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]], n = Math.max(1, Math.ceil(Math.max(...a.map((v, k) => Math.abs(b[k] - v)))));
    for (let s = 0; s <= n; s++) {
      const p = a.map((v, k) => Math.round(v + (b[k] - v) * (s / n)));
      for (let dx = 0; dx < thick; dx++) for (let dy = 0; dy < thick; dy++) g.set(p[0] + dx, p[1] + dy, p[2], c);
    }
  }
  return g;
}

// ---------- accessories (hats sit on a head top) ----------
/** Hat grid for a head of w × d body voxels. Fine hats use half voxels. Returns { grid, fine, height (body voxels), tilt }. */
export function hat(kind, w, d, pal = {}) {
  const col = (k, dflt) => pal[k] || dflt;
  const P = (prims, fine = 0.5, tilt = [-0.04, 0.08]) => { const grid = gridOf(prims, pal); const b = grid.bounds(); return { grid, fine, height: (b.max[1] - b.min[1] + 1) * fine, tilt }; };
  const W = (w + 1) * 2, D = (d + 1) * 2, w1 = w + 1, d1 = d + 1; // fine units / body units
  const dome = (h, role, tag, grow = 0) => ({ s: 'ell', c: [0, -(h - 1), 0], size: [W + grow, h * 2 - 1, D + grow], role, tag, cut: 0 });
  const hc = col('hat', null), trim = col('hatTrim', null);
  switch (kind) {
    case 'doppi': { const fine = (Math.min(w, d) * 0.92) / 16; const g = doppiGrid({ black: hc || '#17161b', white: trim || '#f3efe4' }); return { grid: g, fine, height: 7 * fine, tilt: [-0.05, 0.12] }; }
    case 'beanie': return P([dome(6, hc || '#c8384a'), { s: 'box', c: [0, 0, 0], size: [W + 1, 2, D + 1], role: trim || '#f3efe6' }, { s: 'ell', c: [0, 5, 0], size: [3, 3, 3], role: trim || '#f3efe6' }]);
    case 'cap': return P([dome(5, hc || '#2f6fcf'), { s: 'box', c: [0, 0, D / 2 + 2], size: [W - 4, 1, 5], role: trim || hc || '#2f6fcf' }, { s: 'box', c: [0, 4, 0], size: [1, 1, 1], role: '#f3efe6' }]);
    case 'guard-cap': return P([{ s: 'cyl', c: [0, 0, 0], size: [W - 1, 3], role: hc || '#2b3550' }, { s: 'ell', c: [0, 3, 0], size: [W + 3, 3, D + 3], role: hc || '#2b3550' }, { s: 'box', c: [0, 0, D / 2 + 1], size: [W - 6, 1, 4], role: '#1a1a22' }, { s: 'box', c: [0, 1, D / 2], size: [3, 2, 1], role: '#e0b040', tag: 'metal' }]);
    case 'crown': return P([{ s: 'ring', c: [0, 0, 0], size: [W - 1, 3, D - 1], thick: 0.22, role: '#e8b830', tag: 'metal' }, ...[0, 1, 2, 3, 4, 5].map((i) => ({ s: 'box', c: [Math.round(Math.cos(i * 1.047 + 0.52) * (W / 2 - 1.5)), 3, Math.round(Math.sin(i * 1.047 + 0.52) * (D / 2 - 1.5))], size: [2, 2, 2], role: '#e8b830', tag: 'metal' })), { s: 'box', c: [0, 1, D / 2 - 1], size: [1, 1, 1], role: '#d8203a', tag: 'glow' }]);
    case 'helmet': return P([dome(6, hc || '#f2c230', 'gloss', 2), { s: 'box', c: [0, 0, 0], size: [W + 4, 1, D + 4], role: hc || '#f2c230', tag: 'gloss' }, { s: 'box', c: [0, 0, 0], size: [2, 6, D + 1], role: shade(hc || '#f2c230', 0.85), tag: 'gloss', cut: 0 }]);
    case 'chef-hat': return P([{ s: 'cyl', c: [0, 0, 0], size: [W - 2, 5], role: '#f6f4ee' }, { s: 'ell', c: [0, 4, 0], size: [W + 2, 6, D + 2], role: '#fbfaf6' }, { s: 'ell', c: [-3, 7, 0], size: [5, 4, 5], role: '#ffffff' }, { s: 'ell', c: [3, 7, 1], size: [5, 4, 5], role: '#ffffff' }]);
    case 'headscarf': return P([dome(6, hc || '#c03050', undefined, 2), { s: 'box', c: [0, -9, -D / 2], size: [W, 10, 2], role: hc || '#c03050' }, { s: 'box', c: [0, 0, 0], size: [W + 3, 1, D + 3], role: trim || '#f2c14e', cut: 0 }], 0.5, [0, 0]);
    case 'wizard-hat': return P([{ s: 'cyl', c: [0, 0, 0], size: [w1 + 6, 1], role: hc || '#3a3a9a' }, { s: 'cone', c: [0, 1, 0], size: [w1 + 1, 10], role: hc || '#3a3a9a' }, { s: 'box', c: [1, 3, Math.floor(d1 / 2) - 1], size: [1, 1, 1], role: '#f2d040', tag: 'glow' }, { s: 'box', c: [-1, 6, 1], size: [1, 1, 1], role: '#f2d040', tag: 'glow' }], 1, [-0.08, 0.14]);
    case 'straw-hat': return P([{ s: 'cyl', c: [0, 0, 0], size: [w1 + 7, 1], role: '#e0c070' }, { s: 'cyl', c: [0, 1, 0], size: [w1 - 1, 3], role: '#d8b860' }, { s: 'cyl', c: [0, 1, 0], size: [w1 - 0.5, 1], role: trim || '#b03a2e' }], 1);
    case 'top-hat': return P([{ s: 'cyl', c: [0, 0, 0], size: [w1 + 3, 1], role: hc || '#1c1a20' }, { s: 'cyl', c: [0, 1, 0], size: [w1 - 2, 6], role: hc || '#1c1a20' }, { s: 'cyl', c: [0, 1, 0], size: [w1 - 1.6, 1], role: trim || '#b03a2e' }], 1);
    case 'turban': return P([dome(7, hc || '#f0e6d0', undefined, 3), { s: 'ring', c: [0, 0, 0], size: [W + 4, 2, D + 4], thick: 0.2, role: shade(hc || '#f0e6d0', 0.85) }, { s: 'box', c: [0, 2, D / 2 + 2], size: [2, 2, 1], role: '#20a0a8', tag: 'glow' }]);
    case 'headband': return P([{ s: 'ring', c: [0, 0, 0], size: [W + 1, 2, D + 1], thick: 0.14, role: hc || '#e03838' }]);
    case 'bow': return P([{ s: 'box', c: [-2, 0, 0], size: [3, 3, 1], role: hc || '#e8508a' }, { s: 'box', c: [2, 0, 0], size: [3, 3, 1], role: hc || '#e8508a' }, { s: 'box', c: [0, 1, 0], size: [1, 1, 1], role: shade(hc || '#e8508a', 0.8) }], 0.5, [0, 0.3]);
    case 'space-helmet': return P([{ s: 'ring', c: [0, -10, 0], size: [W + 6, 12, D + 6], thick: 0.12, role: '#eef0f4', tag: 'gloss' }, dome(4, '#eef0f4', 'gloss', 6), { s: 'box', c: [W / 2 + 3, 0, -2], size: [1, 7, 1], role: '#c0c4cc', tag: 'metal' }, { s: 'box', c: [W / 2 + 3, 7, -2], size: [1, 1, 1], role: '#ff4040', tag: 'glow' }], 0.5, [0, 0]);
    case 'antenna': return P([{ s: 'box', c: [0, 0, 0], size: [1, 3, 1], role: '#9aa4b0', tag: 'metal' }, { s: 'ell', c: [0, 3, 0], size: [2, 2, 2], role: col('glow', '#ff5a5a'), tag: 'glow' }], 1, [0, 0]);
    default: return null;
  }
}
export const HATS = ['doppi', 'beanie', 'cap', 'guard-cap', 'crown', 'helmet', 'chef-hat', 'headscarf', 'wizard-hat', 'straw-hat', 'top-hat', 'turban', 'headband', 'bow', 'space-helmet', 'antenna'];

/** Glasses frames in front of the eyes (fine voxels = V/2). eyeX in body voxels. */
export function glasses(eyeX, pal = {}) {
  const g = new VoxelGrid(), c = pal.glasses || '#2a2228', ex = Math.round(eyeX * 2);
  for (const s of [-1, 1]) for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (Math.abs(x) === 3 || Math.abs(y) === 3) g.set(s * ex + x, y, 0, c, 'gloss');
  for (let x = -ex + 4; x <= ex - 4; x++) g.set(x, 1, 0, c, 'gloss');
  return g;
}

export { INK };
