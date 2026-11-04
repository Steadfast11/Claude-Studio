// parts/characters/archetypes/features.js — features & accessories added to any archetype body by name.
//   addFeatures(spec, P)  — mutates spec.prims / spec.apps from P.features and P.accessories (unknown names are ignored)
// Appendages are separate grids on the rig (they swing, wag, flap): { grid, at: [x,y,z] body voxels, origin, rest, swing, flap, wag, side }.
import { VoxelGrid } from '../../../engine/voxel/voxel.js';
import { gridOf, line, roleColor } from './_kit.js';
import { hash } from '../../../engine/core/rng.js';

const R = Math.round;
const box = (c, size, role, extra = {}) => ({ s: 'box', c, size, role, ...extra });
const ell = (c, size, role, extra = {}) => ({ s: 'ell', c, size, role, ...extra });

function earGrid(kind, pal, len = 1) {
  const g = new VoxelGrid(), b = roleColor('head', pal), ic = pal.innerEar || roleColor('belly', pal);
  if (kind === 'pointy') { for (let x = -1; x <= 1; x++) g.set(x, 0, 0, b); g.set(-1, 1, 0, b); g.set(0, 1, 0, b); g.set(0, 2, 0, b); g.set(0, 0, 1, ic); }
  else if (kind === 'round') { for (let x = -1; x <= 1; x++) for (let y = 0; y <= 2; y++) if (!(Math.abs(x) === 1 && y === 2)) g.set(x, y, 0, b); g.set(0, 1, 1, ic); }
  else if (kind === 'long') { const n = R(6 * len); for (let y = 0; y < n; y++) { g.set(0, y, 0, b); g.set(1, y, 0, b); if (y > 0 && y < n - 1) g.set(0, y, 1, ic); } }
  else if (kind === 'floppy') { for (let y = 0; y < 4; y++) for (let z = 0; z < 3; z++) if (!(y === 0 && z === 2)) g.set(0, -y, z - 1, b); }
  else if (kind === 'big') { for (let y = 0; y < 7; y++) for (let z = 0; z < 6; z++) if (Math.hypot(y - 3, z - 2.5) < 3.6) g.set(0, -y, -z, b); }
  return g;
}

export function addFeatures(S, P) {
  const pal = P.pal, f = new Set(P.features || []);
  const apps = (S.apps ||= []);
  const H = S.head, top = H.top, hw = H.w;
  const back = S.back, side = S.side;
  const app = (grid, at, o = {}) => apps.push({ grid, at, origin: o.origin ?? 'base', rest: o.rest || [0, 0, 0], swing: o.swing ?? 0.3, flap: o.flap || 0, wag: o.wag || 0, side: o.side || 1, voxel: o.voxel || 1, flapHz: o.flapHz, wagHz: o.wagHz });
  const pair = (fn) => { fn(-1); fn(1); };
  // ears
  if (f.has('ears-pointy')) pair((s) => app(earGrid('pointy', pal), [s * (hw / 2 - 1.8), top[1] - 0.4, top[2] - 0.5], { swing: 0.35, rest: [0, 0, -s * 0.12] }));
  if (f.has('ears-round')) pair((s) => app(earGrid('round', pal), [s * (hw / 2 - 1.2), top[1] - 0.5, top[2] - 0.5], { swing: 0.25 }));
  if (f.has('ears-long')) pair((s) => app(earGrid('long', pal, P.prop?.ear ?? 1), [s * (hw / 2 - 2.2), top[1] - 0.4, top[2] - 0.5], { swing: 0.6, rest: [-0.12, 0, -s * 0.16] }));
  if (f.has('ears-floppy')) pair((s) => app(earGrid('floppy', pal), [s * (hw / 2 + 0.5), top[1] - 1, top[2]], { origin: [0, 0, 0], swing: 0.5, rest: [0, 0, s * 0.18] }));
  if (f.has('ears-big')) pair((s) => app(earGrid('big', pal), [s * (hw / 2 + 0.5), top[1] - 0.5, top[2] + 1], { origin: [0, 0, 0], swing: 0.4, rest: [0, s * 0.3, s * 0.1] }));
  // horns
  if (f.has('horns')) pair((s) => app(gridOf([box([0, 0, 0], [1, 2, 1], 'horn'), box([s, 2, 0], [1, 1, 1], 'horn')], pal), [s * (hw / 2 - 1.5), top[1] - 0.3, top[2]], { swing: 0 }));
  if (f.has('horns-big')) pair((s) => app(gridOf([box([0, 0, 0], [2, 2, 2], 'horn'), box([0, 2, -0.5], [1, 2, 1], 'horn'), box([0, 4, -1], [1, 1, 1], 'horn')], pal), [s * (hw / 2 - 2), top[1] - 0.3, top[2] - 1], { swing: 0, rest: [-0.25, 0, -s * 0.25] }));
  if (f.has('horn')) app(gridOf([box([0, 0, 0], [2, 2, 2], '#f2d26a', { tag: 'glow' }), box([0, 2, 0], [1, 2, 1], '#f8e9a8', { tag: 'glow' }), box([0, 4, 0], [1, 1, 1], '#ffffff', { tag: 'glow' })], pal), [0, top[1] - 0.4, top[2] + H.d / 2 - 1.5], { swing: 0, rest: [0.35, 0, 0] });
  if (f.has('antennae')) pair((s) => app(gridOf([box([0, 0, 0], [1, 3, 1], 'dark'), box([s, 3, 0], [1, 1, 1], 'dark'), ell([s * 1.5, 4, 0], [2, 2, 2], 'accent', { tag: 'glow' })], pal), [s * 1.8, top[1] - 0.3, top[2]], { swing: 0.8 }));
  if (f.has('comb')) S.prims.push(box([0, top[1], top[2]], [1, 2, 3], '#d8302a'), box([0, top[1] + 2, top[2] - 0.5], [1, 1, 1], '#d8302a'), box([0, R(S.face.eyeY - 4), S.face.front + 1], [1, 2, 1], '#d8302a'));
  if (f.has('mane')) S.prims.splice(0, 0, { s: 'rbox', c: [0, R(H.center[1] - H.d / 2 - 1), H.center[2] - 1.5], size: [hw + 5, H.d + 5, H.d - 2], r: 2.5, role: 'accent' });
  if (f.has('mane-ridge')) S.prims.push(box([0, top[1] - 1, top[2] - (H.d - 1) / 2 - 1], [1, 3, 5], 'accent'), box([0, top[1], top[2] + 1], [3, 1, 2], 'accent'));
  if (f.has('hump')) S.prims.push(ell([0, R(side[1]), -1], [R(hw * 0.7), 5, 7], 'body'));
  if (f.has('shell')) S.prims.push(ell([0, 1, back[2] / 2 + 0.5], [R(side[0] * 2 + 3), R(side[1] + 4), R(-back[2] * 2 + 1)], 'accent'), box([0, R(side[1] + 3.5), back[2] / 2 + 0.5], [3, 1, 3], 'dark'));
  if (f.has('wool')) for (const [x, y, z] of [[-2, 3, -3], [2, 3, -3], [0, 4, 0], [-2, 3, 3], [2, 3, 3], [0, 2, -5], [0, 2, 5], [-3, 1, 0], [3, 1, 0]]) S.prims.push(ell([x, y + R(side[1] - 4), z], [5, 5, 5], 'body'));
  if (f.has('spikes')) {
    const W = side[0] * 2 + 3, D = -back[2] * 2 + 2;
    S.prims.push(ell([0, 0, back[2] / 2], [W, R(side[1] + 3), D], 'dark'));
    for (let x = -W / 2; x <= W / 2; x += 2) for (let z = back[2] - 1; z <= 2; z += 2) if (hash(R(x), R(z), 3) < 0.7) { const y = R((side[1] + 2) * Math.sqrt(Math.max(0, 1 - (x / (W / 2)) ** 2 - ((z - back[2] / 2) / (D / 2)) ** 2))); S.prims.push(box([R(x), y, R(z)], [1, 2, 1], 'dark')); }
  }
  if (f.has('spikes-ridge')) for (let z = back[2] + 1; z <= top[2] - 1; z += 2) S.prims.push(box([0, R(side[1] + 1), z], [1, 2, 1], 'accent'));
  if (f.has('trunk')) app(line([[0, 0, 0], [0, -2, 1], [0, -4, 1], [0, -5, 2]], 'head', pal, 2), [-0.5, S.face.eyeY - 2.8, S.face.front + 0.5], { origin: [0, 0, 0], swing: 0.5, rest: [0, 0, 0] });
  if (f.has('tusks')) pair((s) => S.prims.push(box([s * 2, R(S.face.eyeY - 4), S.face.front + 1], [1, 1, 2], '#f6f0de')));
  // tails (back[2] = rear surface)
  const tb = [back[0], back[1], back[2] - 0.5];
  if (f.has('tail')) app(line([[0, 0, 0], [0, 1, -2], [0, 3, -3], [0, 5, -3]], 'body', pal), tb, { origin: [0, 0, 0], wag: 0.4, swing: 0.4 });
  if (f.has('tail-fluffy')) app(gridOf([ell([0, 0, -3], [3, 3, 6], 'body'), ell([0, 1, -6], [3, 3, 2], 'light')], pal), tb, { origin: [0, 0, 0], wag: 0.35, swing: 0.4, rest: [-0.4, 0, 0] });
  if (f.has('tail-short')) app(gridOf([ell([0, 0, 0], [3, 3, 2], pal.tail || 'light')], pal), tb, { origin: [0, 0, 0], wag: 0.25 });
  if (f.has('tail-long')) app(gridOf([box([0, 0, -1], [3, 3, 3], 'body'), box([0, 0, -4], [3, 2, 3], 'body'), box([0, 0, -6.5], [1, 2, 2], 'body'), box([0, 0, -8], [1, 1, 1], 'body')], pal), [0, back[1] - 1, back[2] + 1], { origin: [0, 0, 0], wag: 0.25, swing: 0.25, rest: [0.15, 0, 0] });
  if (f.has('tail-tuft')) app(gridOf([box([0, 0, 0], [1, 1, 2], 'body'), box([0, -1, -2], [1, 2, 1], 'body'), box([0, -4, -2], [2, 2, 2], 'dark')], pal), tb, { origin: [0, 0, 0], wag: 0.5 });
  if (f.has('tail-feathers')) app([line([[0, 0, 0], [0, 3, -2], [0, 6, -2]], 'accent', pal), line([[1, 0, 0], [2, 3, -2], [2, 5, -1]], 'dark', pal), line([[-1, 0, 0], [-2, 3, -2], [-2, 5, -1]], 'dark', pal)].reduce((acc, g) => acc.merge(g), new VoxelGrid()), tb, { origin: [0, 0, 0], wag: 0.15 });
  if (f.has('tail-fin')) app(gridOf([box([0, -1, -1], [1, 3, 2], 'accent'), box([0, -3, -3], [1, 3, 2], 'accent'), box([0, 1, -3], [1, 3, 2], 'accent')], pal), [0, back[1], back[2]], { origin: [0, 0, 0], wag: 0.55, wagHz: 2.6 });
  if (f.has('fins')) pair((s) => app(gridOf([box([0, 0, 0], [1, 2, 3], 'accent')], pal), [s * (side[0] + 0.5), side[1], side[2]], { origin: [0, 1, 1], flap: 0.5, side: s, rest: [0, 0, s * 0.3] }));
  // wings: big flappy slabs at the sides (rest folded), flap when flying
  const wing = (len, role, extra) => gridOf([box([0, 0, 0], [1, 1, len], role, extra), box([0, -1, -0.5], [1, 1, len - 1], role, extra), box([0, -2, -1], [1, 1, len - 2], role, extra), box([0, -3, -1.5], [1, 1, Math.max(1, len - 4)], role, extra)], pal);
  if (f.has('wings')) pair((s) => app(wing(5, 'accent'), [s * (side[0] + 0.4), side[1], side[2]], { origin: [0, 0, 0], flap: 1, side: s, rest: [0, 0, s * 0.12], swing: 0.1 }));
  if (f.has('wings-big')) pair((s) => app(gridOf([box([s * 2, 0, 0], [5, 1, 7], 'accent'), box([s * 4, 1, -2], [3, 1, 4], 'accent'), box([s * 6, 2, -3], [1, 1, 2], 'dark')], pal), [s * (side[0] - 0.5), side[1] + 0.5, side[2] - 1], { origin: [0, 0, 0], flap: 0.8, side: s, rest: [0, 0, s * 0.35], swing: 0.1 }));
  if (f.has('wings-fairy')) pair((s) => app(gridOf([ell([s * 2, 0, 0], [4, 6, 1], '#d8f4ff', { tag: 'glow' }), ell([s * 1.5, -4, 0], [3, 3, 1], '#f4d8ff', { tag: 'glow' })], pal), [s * 0.8, side[1] + 1, back[2] - 0.5], { origin: [0, 0, 0], flap: 0.7, side: s, flapHz: 9, swing: 0 }));
  if (f.has('wings-bee')) pair((s) => app(gridOf([ell([s * 2, 0, 0], [4, 1, 5], '#e8f6ff', { tag: 'gloss' })], pal), [s * 1.5, top[1] - 0.5, -1], { origin: [0, 0, 0], flap: 0.6, side: s, flapHz: 14, swing: 0 }));
  // accessories (hats are placed by index.js; these are body-level)
  const acc = new Set(P.accessories || []);
  if (acc.has('scarf') && S.neck) { const n = S.neck; S.prims.push({ s: 'ring', c: [0, n.y, n.z], size: [n.w + 1, 2, n.d + 1], thick: 0.34, role: pal.scarf || '#d8402e' }, box([n.w / 4, n.y - 3, n.z + (n.d + 1) / 2], [2, 3, 1], pal.scarf || '#d8402e')); }
  if (acc.has('bowtie') && S.neck) S.prims.push(box([0, S.neck.y + 1, S.neck.z + (S.neck.d + 1) / 2 - 1], [3, 1, 1], pal.bowtie || '#c8102e'));
  if (acc.has('cape')) S.prims.push(box([0, 0, back[2] - 1], [R(side[0] * 2 + 2), R(side[1] + 1), 1], pal.cape || '#9a2030'));
}
