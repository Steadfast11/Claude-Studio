// parts/props/non.js — round flatbread: thick glazed rim, thin centre stamped with a chekich dot pattern,
// sprinkled with sesame and nigella seeds. Can be stacked.
//   non({ diameter: 22, stack: 1, seed: 1, color: '#d79a4b' })
// Anchors: top (centre of the top bread), behind (table level behind the stack), front, side.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { canvasTexture } from '../../engine/materials/procedural-textures.js';
import { rng } from '../../engine/core/rng.js';
import { noise2 } from '../../engine/core/math.js';

/** Top-down (planar) bread textures: texture spans [-E, E] cm; rr = distance from centre in cm (for diameter 22). */
function breadTextures(seed, color) {
  const E = 11.5;
  const paint = (bump) => (g, w, h) => {
    const img = g.createImageData(w, h);
    const base = new THREE.Color(color), rim = new THREE.Color('#a8682a'), pale = new THREE.Color('#efcf98'), c = new THREE.Color();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = (x / w * 2 - 1) * E, pz = (y / h * 2 - 1) * E, rr = Math.hypot(px, pz), i = (y * w + x) * 4;
      const rimK = Math.exp(-(((rr - 9.1) / 1.6) ** 2));
      const n = noise2(px * 0.9, pz * 0.9, seed) * 0.5 + noise2(px * 3.5, pz * 3.5, seed + 1) * 0.25;
      c.copy(base).lerp(pale, rr < 6.8 ? 0.75 : 0).lerp(rim, Math.min(1, rimK * 0.85 + n * 0.2));
      const k = 1 + n * 0.14;
      const b = 150 + n * 60 + rimK * 50;
      img.data[i] = bump ? b : c.r * 255 * k; img.data[i + 1] = bump ? b : c.g * 255 * k; img.data[i + 2] = bump ? b : c.b * 255 * k; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const toPx = (cm) => ((cm / E + 1) / 2) * w;
    // chekich stamp: concentric rings of pricks and a radial star in the flat centre
    g.fillStyle = bump ? 'rgb(30,30,30)' : 'rgba(125,72,30,0.8)';
    for (let ring = 1; ring <= 5; ring++) {
      const rad = ring * 1.15, n = ring * 9;
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + ring * 0.3; g.beginPath(); g.arc(toPx(Math.cos(a) * rad), toPx(Math.sin(a) * rad), w * 0.006, 0, Math.PI * 2); g.fill(); }
    }
    g.strokeStyle = bump ? 'rgb(60,60,60)' : 'rgba(150,90,40,0.45)'; g.lineWidth = w * 0.006;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(toPx(Math.cos(a) * 0.6), toPx(Math.sin(a) * 0.6)); g.lineTo(toPx(Math.cos(a) * 6.2), toPx(Math.sin(a) * 6.2)); g.stroke(); }
    if (!bump) {
      const r = rng(seed);
      for (let k = 0; k < 220; k++) {
        const a = r.next() * Math.PI * 2, rad = Math.sqrt(r.next()) * 6.4;
        g.fillStyle = r.next() < 0.55 ? '#1c1714' : '#f2e3c4';
        g.beginPath(); g.ellipse(toPx(Math.cos(a) * rad), toPx(Math.sin(a) * rad), w * 0.0035, w * 0.0055, r.next() * 3, 0, Math.PI * 2); g.fill();
      }
    }
  };
  return {
    map: canvasTexture(1024, 1024, paint(false), { key: `non${seed}${color}`, wrap: THREE.ClampToEdgeWrapping }),
    bump: canvasTexture(512, 512, paint(true), { key: `nonb${seed}`, srgb: false, wrap: THREE.ClampToEdgeWrapping }),
    E,
  };
}

export function nonMesh({ diameter = 22, seed = 1, color = '#d79a4b' } = {}) {
  const k = diameter / 22;
  const P = [[0.001, 0], [9.5, 0], [10.6, 0.35], [11, 1.4], [10.8, 2.6], [10.1, 3.5], [9.1, 3.75], [8.1, 3.4], [7.3, 2.4], [6.6, 1.55], [5, 1.35], [2, 1.25], [0.001, 1.3]];
  const pts = P.map(([r, y]) => new THREE.Vector2(r * k, y * k));
  const geo = new THREE.LatheGeometry(pts, 64);
  // organic irregularity: wobble radius and height with noise around the circumference
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x), rr = Math.hypot(v.x, v.z);
    const s = 1 + noise2(Math.cos(a) * 1.5, Math.sin(a) * 1.5, seed) * 0.035;
    pos.setXYZ(i, v.x * s, v.y * (1 + noise2(Math.cos(a) * 3, Math.sin(a) * 3, seed + 4) * 0.12 * (rr / (11 * k))), v.z * s);
  }
  geo.computeVertexNormals();
  const { map, bump, E } = breadTextures(seed, color);
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) / k / E + 1) / 2, 1 - (pos.getZ(i) / k / E + 1) / 2); // planar top-down UVs
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.62 }));
  mesh.castShadow = mesh.receiveShadow = true;
  // sesame on the rim top
  const r = rng(seed + 9), n = 90;
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16 * k, 6, 4), new THREE.MeshStandardMaterial({ color: '#f1dfb8', roughness: 0.5 }), n);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 0.5, 1.7);
  for (let i = 0; i < n; i++) { const a = r.next() * Math.PI * 2, rad = r.range(8.2, 10) * k; Q.setFromEuler(new THREE.Euler(0, r.next() * 6, 0)); M.compose(new THREE.Vector3(Math.cos(a) * rad, 3.55 * k, Math.sin(a) * rad), Q, S); seeds.setMatrixAt(i, M); }
  seeds.castShadow = true;
  const g = new THREE.Group(); g.add(mesh, seeds);
  return { group: g, height: 3.75 * k, radius: 11 * k, centreY: 1.3 * k };
}

export const non = definePart({
  name: 'non', kind: 'prop',
  options: { diameter: 22, stack: 1, seed: 1, color: '#dba65e' },
  build(o, ctx) {
    const root = new THREE.Group(), r = rng(o.seed);
    let y = 0, last = null;
    for (let i = 0; i < o.stack; i++) {
      const b = nonMesh({ diameter: o.diameter * r.range(0.96, 1.03), seed: o.seed + i * 7, color: o.color });
      b.group.position.set(r.range(-0.8, 0.8), y, r.range(-0.8, 0.8));
      b.group.rotation.set(r.range(-0.02, 0.02), r.next() * 6.28, r.range(-0.02, 0.02));
      root.add(b.group);
      last = b; y += b.height * 0.62;
    }
    const top = y - last.height * 0.62 + last.centreY;
    const R = last.radius;
    return { root, anchors: { top: new THREE.Vector3(0, top, 0), behind: new THREE.Vector3(0, 0, -R - 3), front: new THREE.Vector3(0, 0, R + 2), side: new THREE.Vector3(R + 2, 0, 0) } };
  },
  demo: { opts: { stack: 2 }, radius: 50, height: 22 },
});
export default non;
