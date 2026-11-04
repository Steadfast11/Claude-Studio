// parts/characters/archetypes/index.js — preset (compact JSON) → creature design for the shared rig (_rig.js).
//   const design = designFromPreset(preset, opts);  createCreature(design, opts, ctx)
// preset: { archetype, size: real height cm, prop: {body, head, leg, neck, length, height}, palette: {...},
//           pattern, features: [...], accessories: [...hat, 'glasses', 'scarf'...], shape (object-creatures), snout, hair, gait, voice }
// opts:   { fit: 'miniature' | 'world', scale, color, accent, hat, ... }  ('miniature' squashes real sizes into tabletop heights)
import { BODIES } from './bodies.js';
import { addFeatures } from './features.js';
import { paint, pattern, hat, glasses, HATS } from './_kit.js';
import { clamp } from '../../../engine/core/math.js';

/** Real height (cm) → on-screen height (cm) for a film scale. Miniature keeps relative sizes but compresses them (Pista ≈ 10 cm). */
export function heightFor(real = 40, fit = 'miniature') {
  if (fit === 'world') return real;
  return clamp(10 * Math.pow(Math.max(0.1, real) / 40, 0.28), 5.5, 20);
}

export function designFromPreset(preset, o = {}) {
  const pal = { ...(preset.palette || {}) };
  if (o.color && o.color !== preset.palette?.body) pal.body = o.color;
  if (o.accent) pal.accent = o.accent;
  const accessories = [...(preset.accessories || [])];
  if (o.hat !== undefined && o.hat !== '') { for (let i = accessories.length - 1; i >= 0; i--) if (HATS.includes(accessories[i])) accessories.splice(i, 1); if (o.hat !== 'none') accessories.unshift(o.hat); }
  const P = { ...preset, pal, features: preset.features || [], accessories, prop: preset.prop || {} };
  const S = (BODIES[preset.archetype] || BODIES.blob)(P);
  S.apps = S.apps || [];
  addFeatures(S, P);
  const { grid, roles } = paint(S.prims, pal);
  pattern(grid, roles, pal, preset.pattern, (preset.seed ?? 7) + 1);
  const { min, max } = grid.bounds();
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, y0 = min[1];
  const rel = (p) => [p[0] - cx, p[1] - y0, p[2] - cz];
  const w = max[0] - min[0] + 1, h = max[1] - min[1] + 1, d = max[2] - min[2] + 1;
  const L = S.legs || { mode: 'none' };
  const footH = L.mode === 'none' ? 0 : L.footH;
  const tall = heightFor(preset.size ?? 40, o.fit) * (o.scale ?? 1);
  const V = tall / (h + footH);
  const F = S.face;
  const design = {
    voxel: V, w, h, d, body: grid, footH, hover: (S.hover || 0) * V,
    hand: S.hands ? S.hands.grid : L.mode === 'quad' ? L.grid : null,
    foot: L.mode === 'none' ? null : L.grid,
    handY: S.hands ? (S.hands.y - y0) / h : 0.36, handOut: 0.25, footSpread: L.spread ?? 2.6,
    face: {
      eyeY: (F.eyeY - y0) / h, eyeX: F.eyeX ?? 2.55, mouthY: (F.mouthY - y0) / h, blushX: (F.eyeX ?? 2.55) + 1.6, blushY: ((F.blushY ?? (F.eyeY + F.mouthY) / 2) - y0) / h,
      z: F.front - cz + 0.5, mouthZ: F.mouthZ || 0, ...(F.ink ? { ink: F.ink } : {}), ...(F.mouth ? { mouth: F.mouth } : {}), ...(F.rest ? { rest: F.rest } : {}),
      ...(preset.blush ? { blush: preset.blush } : {}),
    },
    gait: {
      mode: S.gait?.mode || 'walk', stepMin: 2 * V, stepK: 0.085, stepMax: Math.max(4, (8 + footH) * V),
      bob: (S.gait?.bob ?? 0.53) * V, lift: (S.gait?.lift ?? 1.47) * V, hopH: (preset.hop ?? 2) * V,
    },
    voice: clamp(10 / tall, 0.55, 1.8) * (preset.voice ?? 1), stepSize: clamp(tall / 10, 0.5, 2.2),
    turnRate: preset.turnRate ?? 9,
  };
  if (S.hands) { design.handX = S.hands.x; design.handZ = 0.08 * d; }
  if (L.mode === 'quad') design.quad = { front: L.front - cz, back: L.back - cz, legX: L.spread };
  // hat (first hat-like accessory) on the head top, with the rig's secondary motion
  const hatName = accessories.find((a) => HATS.includes(a));
  if (hatName) {
    const Hd = hat(hatName, S.head.w, S.head.d, pal);
    if (Hd) {
      const domed = ['beanie', 'cap', 'helmet', 'headscarf', 'turban', 'space-helmet'].includes(hatName);
      design.accessory = { grid: Hd.grid, voxel: V * Hd.fine, y: (domed ? -1.2 : -0.35) * V, tilt: Hd.tilt, height: Hd.height * V, at: rel(S.head.top) };
    }
  }
  // appendages (ears, tails, wings…) + glasses
  design.appendages = S.apps.map((a) => ({ ...a, at: rel(a.at), voxel: V * (a.voxel || 1) }));
  if (accessories.includes('glasses')) design.appendages.push({ grid: glasses(F.eyeX ?? 2.55, pal), at: [0, F.eyeY - y0, F.front - cz + 0.5 + 0.55], voxel: V * 0.5, origin: [0, 0, 0], swing: 0, rest: [0, 0, 0] });
  design.footprint = Math.max(w, d) * V * 0.5 + 1;
  design.height = tall;
  return design;
}
