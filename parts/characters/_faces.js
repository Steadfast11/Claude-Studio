// parts/characters/_faces.js — voxel face sprites shared by every creature built with _rig.js.
// Patterns are rows of chars (top → bottom). Legend: '#' ink, 'o' glint (white), 'r' tongue, 'w' white, '.' empty.
//   EYES[name] / BROWS[name] / MOUTHS[name];  spriteSlot(maxW, maxH, cell) → { mesh, show(rows, colors, scale) }
import * as THREE from 'three';
import { chamferBox } from '../../engine/voxel/build.js';
import { voxelMaterial } from '../../engine/materials/palette.js';

export const EYES = {
  normal: ['.###.', '#o###', '#####', '#####', '.###.'],
  wide: ['.###.', '#oo##', '#o###', '#####', '#####', '.###.'],
  happy: ['.....', '.###.', '#...#', '.....', '.....'],
  blink: ['.....', '.....', '#####', '.....', '.....'],
  dizzy: ['####.', '#..#.', '#.##.', '#...#', '.###.'],
  determined: ['.....', '#o###', '#####', '#####', '.###.'],
  closed: ['.....', '.....', '#...#', '.###.', '.....'],
};
// brows sit above the eye; written for the LEFT eye (mirrored for the right)
export const BROWS = {
  none: [],
  determined: ['##...', '..###'],
  worried: ['..###', '##...'],
  raised: ['.###.', '#...#'],
};
export const MOUTHS = {
  smile: ['#...#', '.###.'],
  flat: ['.....', '.###.'],
  o: ['.###.', '#rrr#', '.###.'],
  small: ['.#.', '#.#', '.#.'],
  laugh: ['#####', '#rrr#', '.###.'],
  grin: ['#####', '.###.'],
  chew: ['.....', '.###.', '.....'],
  wobbly: ['.#.#.', '#.#.#'],
  frown: ['.###.', '#...#'],
  grr: ['#####', '#.#.#', '#####'],
  none: [],
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** A grid of tiny cubes that can display any pattern up to maxW × maxH, centred on its origin, protruding +z. */
export function spriteSlot(maxW, maxH, cell, depth = 0.6) {
  const n = maxW * maxH;
  const mesh = new THREE.InstancedMesh(chamferBox(0.18), voxelMaterial('gloss', { material: { roughness: 0.25 } }), n);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) mesh.setColorAt(i, col);
  let lastKey = '';
  return {
    mesh,
    /** rows: pattern; colors: { '#': hex, ... }; mirror: flip horizontally; scale: overall size multiplier */
    show(rows, colors, { mirror = false, scale = 1, sy = 1 } = {}) {
      const h = rows.length, w = h ? Math.max(...rows.map((r) => r.length)) : 0;
      let i = 0;
      const key = rows.join('|') + mirror + JSON.stringify(colors);
      for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][mirror ? rows[y].length - 1 - x : x];
        if (ch === '.' || ch === ' ' || !colors[ch] || i >= n) continue;
        _p.set((x - (w - 1) / 2) * cell * scale, ((h - 1) / 2 - y) * cell * scale * sy, 0);
        _m.compose(_p, _q, _s.set(cell * scale * 1.02, cell * scale * sy * 1.02, cell * depth));
        mesh.setMatrixAt(i, _m);
        if (key !== lastKey) mesh.setColorAt(i, col.set(colors[ch]));
        i++;
      }
      for (let k = i; k < n; k++) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(k, _m); }
      mesh.instanceMatrix.needsUpdate = true;
      if (key !== lastKey) { mesh.instanceColor.needsUpdate = true; lastKey = key; }
      mesh.visible = i > 0;
    },
  };
}
