// parts/characters/pista.js — PISTA, the hero: a small mint-pistachio voxel creature in a black chust doppi
// (four-cornered skullcap with white pepper-pod motifs). Built on the generic creature rig (_rig.js).
//   pista({ color: '#4fb8a8', belly: '#a6e6d3', doppi: true, scale: 1, surface: 'cloth' })
// Actions (see _rig.js): walk run sprint chase stop turn look face blink smile gasp anticipate jump hop leap land
// skid bonk shake peek sniff catch hug push lift cheer wave eat snap blush laugh sit balance. Hops obstacles by itself.
// Anchors: center, head, face, top, feet, hands (+ auto front/back/left/right).
import { definePart } from '../../engine/core/registry.js';
import { VoxelGrid } from '../../engine/voxel/voxel.js';
import { fill, roundedBox, box } from '../../engine/voxel/shapes.js';
import { mixHex, shade } from '../../engine/materials/palette.js';
import { hash } from '../../engine/core/rng.js';
import { createCreature } from './_rig.js';
import { SOLO_ACTIONS } from './_rig-actions.js';

/** The doppi as a fine voxel grid (16×7×16): black walls, white pepper-pod motif on each side, stitched corners. */
export function doppiGrid({ black = '#17161b', white = '#f3efe4', size = 16 } = {}) {
  const g = new VoxelGrid(), n = size, hi = n - 1;
  const pod = ['................', '......####......', '.....#....##....', '......##...#....', '................'];
  for (let y = 0; y < 5; y++) for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) {
    const edge = x === 0 || z === 0 || x === hi || z === hi;
    if (!edge) { if (y === 4) g.set(x, y, z, black); continue; }
    const along = x === 0 || x === hi ? z : x;
    const row = pod[4 - y];
    const corner = (x === 0 || x === hi) && (z === 0 || z === hi);
    const stitch = y === 4 && (corner || along % 3 === 0);
    g.set(x, y, z, row[along] === '#' || stitch ? white : black);
  }
  for (let x = 1; x < hi; x++) for (let z = 1; z < hi; z++) {
    g.set(x, 5, z, (x === 7 || x === 8) && (z === 7 || z === 8) ? white : black);
    if (x > 2 && x < hi - 2 && z > 2 && z < hi - 2) g.set(x, 6, z, black);
  }
  return g; // buildVoxels(origin: 'base') centres it
}

export function pistaDesign(o) {
  const w = 13, h = 11, d = 11, V = 0.75 * o.scale;
  const body = new VoxelGrid();
  fill(body, roundedBox(w, h, d, 2.7), (x, y, z) => {
    const belly = z >= (d - 1) / 2 - 0.5 && Math.hypot(x / 4.2, (y - 3.6) / 3.4) < 1;
    let c = mixHex(o.color, shade(o.color, 0.82), Math.max(0, (y - 5) / 6) * 0.6);
    if (belly) c = o.belly;
    if (hash(x, y, z, 77) < 0.05) c = mixHex(c, '#ffffff', 0.12);
    return c;
  });
  const limb = shade(o.color, 0.78);
  const hand = fill(new VoxelGrid(), box(0, 0, 0, 1, 1, 1), limb);
  const foot = fill(new VoxelGrid(), box(0, 0, 0, 2, 1, 3), (x, y, z) => (y === 0 ? shade(limb, 0.85) : limb));
  return {
    voxel: V, w, h, d, body, hand, foot, footH: 1.6, handY: 0.36, handOut: 0.25, footSpread: 2.6,
    face: { eyeY: 0.6, eyeX: 2.55, mouthY: 0.4, blushX: 4.2, blushY: 0.46 },
    accessory: o.doppi ? { grid: doppiGrid(), voxel: V * 0.42, y: -0.35, tilt: [-0.05, 0.12], height: 7 * V * 0.42 } : null,
    gait: { stepMin: 1.5 * o.scale, stepK: 0.085, stepMax: 6.5 * o.scale, bob: 0.4 * o.scale, lift: 1.1 * o.scale },
    voice: o.voice, stepSize: o.scale,
  };
}

export const pista = definePart({
  name: 'pista', kind: 'character',
  options: { color: '#4fb8a8', belly: '#a6e6d3', doppi: true, scale: 1, voice: 1, surface: 'cloth' },
  actions: SOLO_ACTIONS,
  build(o, ctx) { return createCreature(pistaDesign(o), o, ctx); },
  demo: { radius: 48, height: 8, lens: 55, fstop: 5.6, duration: 4, action: [[0.5, 'subject.gasp'], [1.6, 'subject.cheer'], [3, 'subject.blush']] },
});
export default pista;
