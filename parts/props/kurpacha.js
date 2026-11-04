// parts/props/kurpacha.js — padded floor mattress (kurpacha) or cushion (yostiq) in khan-atlas ikat silk,
// with quilting seams.
//   kurpacha({ length: 180, width: 55, thickness: 8, kind: 'mattress' | 'cushion', colors: [...] })
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { ikatTexture, canvasTexture } from '../../engine/materials/procedural-textures.js';

const quilting = (lines) => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#303030'; g.lineWidth = 3;
  for (let i = 1; i < lines; i++) { g.beginPath(); g.moveTo(0, (i / lines) * h); g.lineTo(w, (i / lines) * h); g.stroke(); }
}, { key: 'quilt' + lines, srgb: false });

/** Puffy box: thinner toward the edges like a stuffed cushion. */
export function puffMesh(L, Wd, T, material, puff = 0.45) {
  const geo = new THREE.BoxGeometry(L, T, Wd, 24, 6, 12), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = (p.getX(i) / L) * 2, ny = (p.getY(i) / T) * 2, nz = (p.getZ(i) / Wd) * 2;
    const edge = Math.max(Math.abs(nx) ** 6, Math.abs(nz) ** 6);
    p.setY(i, p.getY(i) * (1 - puff * edge) + T / 2);
    p.setX(i, p.getX(i) * (1 - 0.04 * Math.abs(ny)));
    p.setZ(i, p.getZ(i) * (1 - 0.06 * Math.abs(ny)));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function kurpachaMesh({ length = 180, width = 55, thickness = 8, kind = 'mattress', colors = ['#f6e6c8', '#c4122f', '#f2b632', '#1f3f8f', '#2f8a4e'], seed = 1 } = {}) {
  const tex = ikatTexture({ colors, bands: kind === 'cushion' ? 3 : 6, seed });
  tex.repeat.set(kind === 'cushion' ? 1 : 2, 1);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, bumpMap: quilting(kind === 'cushion' ? 3 : 5), bumpScale: 0.6 });
  return kind === 'cushion' ? puffMesh(length, width, thickness, mat, 0.7) : puffMesh(length, width, thickness, mat, 0.45);
}

export const kurpacha = definePart({
  name: 'kurpacha', kind: 'prop',
  options: { length: 180, width: 55, thickness: 8, kind: 'mattress', seed: 1, colors: ['#f6e6c8', '#c4122f', '#f2b632', '#1f3f8f', '#2f8a4e'] },
  build(o) { const root = new THREE.Group(); root.add(kurpachaMesh(o)); return { root }; },
  demo: { radius: 230, height: 110 },
});
export default kurpacha;
