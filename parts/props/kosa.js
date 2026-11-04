// parts/props/kosa.js — deep glazed ceramic bowl (Rishton-style painting), optionally heaped with fruit.
//   kosa({ diameter: 20, height: 8.5, fill: 'anor' | null, count: 4, glaze: '#1f9aa8' })
// Anchors: rim, pileTop (where one more fruit can sit on the heap), front (table level in front of the bowl).
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { latheVessel, rishtonTexture } from './_ceramics.js';
import { anorModel } from './anor.js';
import { rng } from '../../engine/core/rng.js';

export const kosa = definePart({
  name: 'kosa', kind: 'prop',
  options: { diameter: 20, height: 8.5, glaze: '#1f9aa8', ink: '#123d7a', fill: null, count: 4, fruitSize: 7.5, seed: 2 },
  build(o, ctx) {
    const R = o.diameter / 2, H = o.height, t = 0.45;
    const profile = [[0.001, 0.25], [R * 0.32, 0], [R * 0.36, 0.05], [R * 0.37, 0.6], [R * 0.4, 0.75]];
    for (let i = 1; i <= 10; i++) { const u = i / 10; profile.push([R * (0.4 + 0.6 * Math.sin(u * Math.PI / 2) ** 0.9), 0.75 + (H - 0.75) * u ** 1.25]); }
    profile.push([R + 0.1, H + 0.15], [R - t, H]);
    for (let i = 9; i >= 0; i--) { const u = i / 10; profile.push([(R - t) * (0.05 + 0.95 * Math.sin(u * Math.PI / 2) ** 0.85), 0.75 + t + (H - 0.75 - t) * u ** 1.2]); }
    profile.push([0.001, 0.75 + t]);
    const { mesh } = latheVessel(profile, { map: rishtonTexture({ glaze: o.glaze, ink: o.ink, seed: o.seed }) });
    const root = new THREE.Group();
    root.add(mesh);
    let pileTop = new THREE.Vector3(0, H * 0.7, 0);
    if (o.fill === 'anor') {
      const r = rng(o.seed);
      const fr = o.fruitSize / 2;
      for (let i = 0; i < o.count; i++) {
        const a = (i / o.count) * Math.PI * 2 + 0.4, d = R * 0.42;
        const m = anorModel({ size: o.fruitSize * r.range(0.92, 1.05), seed: o.seed * 10 + i });
        const g = new THREE.Group(); g.add(m.root);
        g.position.set(Math.cos(a) * d, 0.9 + fr * 0.05 + (H * 0.18), Math.sin(a) * d);
        g.rotation.set(r.range(-0.5, 0.5), r.range(0, 6.28), r.range(-0.5, 0.5));
        m.root.position.y = fr;
        root.add(g);
      }
      pileTop = new THREE.Vector3(0, 0.9 + H * 0.18 + fr * 1.15, 0);
    }
    return {
      root,
      anchors: { rim: new THREE.Vector3(0, H, R), pileTop, front: new THREE.Vector3(0, 0, R + 2), side: new THREE.Vector3(R + 2, 0, 0) },
    };
  },
  demo: { opts: { fill: 'anor' }, radius: 45, height: 22 },
});
export default kosa;
