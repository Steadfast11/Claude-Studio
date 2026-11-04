// parts/props/dasturxon.js — the tablecloth spread over a low table: ivory field with tiny embroidered
// rosettes, a crimson border with gold medallions and indigo rules, draped over the edges with folds.
//   dasturxon({ width: 110, depth: 72, overhang: 14, color: '#b3122e' })   (usually built by a set)
// The cloth's top surface is at y = 0 of the part; its footprint is width × depth.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { canvasTexture, weaveTexture } from '../../engine/materials/procedural-textures.js';
import { noise2 } from '../../engine/core/math.js';
import { rng } from '../../engine/core/rng.js';

function clothTexture({ W, D, ov, color, field, gold, indigo, seed }) {
  const TW = W + 2 * ov, TD = D + 2 * ov, ppc = 12; // pixels per cm
  return canvasTexture(Math.round(TW * ppc / 2) * 2, Math.round(TD * ppc / 2) * 2, (g, w, h) => {
    const r = rng(seed), X = (cm) => cm * ppc;
    g.fillStyle = field; g.fillRect(0, 0, w, h);
    // tiny rosettes scattered on the field
    for (let i = 0; i < 70; i++) {
      const x = X(ov + 10 + r.next() * (W - 20)), y = X(ov + 10 + r.next() * (D - 20));
      g.globalAlpha = 0.35;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.fillStyle = k % 2 ? color : gold; g.beginPath(); g.arc(x + Math.cos(a) * X(0.5), y + Math.sin(a) * X(0.5), X(0.32), 0, 7); g.fill(); }
      g.globalAlpha = 1;
    }
    const bw = X(ov + 7); // border reaches 7 cm onto the table top
    g.fillStyle = color;
    g.fillRect(0, 0, w, bw); g.fillRect(0, h - bw, w, bw); g.fillRect(0, 0, bw, h); g.fillRect(w - bw, 0, bw, h);
    g.strokeStyle = gold; g.lineWidth = X(0.5);
    g.strokeRect(bw, bw, w - 2 * bw, h - 2 * bw);
    g.strokeStyle = indigo; g.lineWidth = X(0.35);
    g.strokeRect(bw - X(1.2), bw - X(1.2), w - 2 * bw + X(2.4), h - 2 * bw + X(2.4));
    // gold medallions along the border band (on top and on the drop)
    const medal = (x, y, s) => {
      g.fillStyle = gold; g.beginPath(); for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = k % 2 ? s * 0.6 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
      g.fillStyle = indigo; g.beginPath(); g.arc(x, y, s * 0.42, 0, 7); g.fill();
      g.fillStyle = field; g.beginPath(); g.arc(x, y, s * 0.18, 0, 7); g.fill();
    };
    const step = X(11), s = X(2.3);
    for (const yy of [bw - X(4), h - bw + X(4)]) for (let x = step / 2; x < w; x += step) medal(x, yy, s);
    for (const xx of [bw - X(4), w - bw + X(4)]) for (let y = step / 2 + bw; y < h - bw; y += step) medal(xx, y, s);
    // fringe-ish dark hem
    g.fillStyle = '#5a0a18'; g.fillRect(0, 0, w, X(0.8)); g.fillRect(0, h - X(0.8), w, X(0.8)); g.fillRect(0, 0, X(0.8), h); g.fillRect(w - X(0.8), 0, X(0.8), h);
  }, { key: `cloth${W}${D}${ov}${color}${seed}`, wrap: THREE.ClampToEdgeWrapping });
}

export function dasturxonMesh({ width = 110, depth = 72, overhang = 14, color = '#b3122e', field = '#f3e7cf', gold = '#e0a93b', indigo = '#22306e', seed = 1 } = {}) {
  const W = width, D = depth, ov = overhang;
  const geo = new THREE.PlaneGeometry(W + 2 * ov, D + 2 * ov, Math.round((W + 2 * ov) / 2), Math.round((D + 2 * ov) / 2));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), z = pos.getZ(i);
    const dx = Math.max(0, Math.abs(x) - W / 2), dz = Math.max(0, Math.abs(z) - D / 2);
    let y = noise2(x * 0.08, z * 0.08, seed) * 0.08;
    if (dx > 0 || dz > 0) {
      const d = Math.hypot(dx, dz), along = dx > dz ? z : x;
      const fold = Math.sin(along * 0.45 + noise2(along * 0.1, 3, seed) * 2) * 0.35 * Math.min(1, d / 6);
      // hang: horizontal overhang turns into vertical drop, slight outward bulge
      const sx = Math.sign(x), sz = Math.sign(z);
      const out = 0.6 * Math.min(1, d / 3) + fold;
      if (dx > 0) x = sx * (W / 2 + out * (dx / d));
      if (dz > 0) z = sz * (D / 2 + out * (dz / d));
      y = -d * (dx > 0 && dz > 0 ? 0.85 : 1);
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const weave = weaveTexture({ threads: 220, seed });
  const mat = new THREE.MeshStandardMaterial({ map: clothTexture({ W, D, ov, color, field, gold, indigo, seed }), bumpMap: weave.bump, bumpScale: 0.25, roughness: 0.92, side: THREE.DoubleSide });
  weave.bump.repeat.set(4, 3);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true; m.castShadow = true;
  return m;
}

export const dasturxon = definePart({
  name: 'dasturxon', kind: 'prop',
  options: { width: 110, depth: 72, overhang: 14, color: '#b3122e', field: '#f3e7cf', gold: '#e0a93b', indigo: '#22306e', seed: 1 },
  build(o) { const root = new THREE.Group(); root.add(dasturxonMesh(o)); return { root }; },
  demo: { opts: { width: 70, depth: 46, overhang: 0 }, radius: 95, height: 70 },
});
export default dasturxon;
