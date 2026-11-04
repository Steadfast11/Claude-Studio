// parts/props/choynak.js — porcelain teapot in the cobalt-and-gold "paxta" pattern, with tapered spout,
// loop handle, lid and knob; optional steam curling from the spout.
//   choynak({ height: 15, steam: true, ink: '#1d3f9a', gold: '#d6a640' })
// Anchors: spout (tip), lid (top of knob), handle, side (table level beside the spout), back. Action: wobble.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { latheVessel, paxtaTexture } from './_ceramics.js';
import { rockable } from './_prop-actions.js';

/** Tube along a curve whose radius goes r0 → r1. */
export function taperTube(curve, r0, r1, tubular = 40, radial = 16, material) {
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position, p = new THREE.Vector3(), c = new THREE.Vector3();
  for (let j = 0; j < pos.count; j++) {
    const i = Math.floor(j / (radial + 1));
    curve.getPointAt(i / tubular, c);
    p.fromBufferAttribute(pos, j).sub(c).multiplyScalar(r0 + (r1 - r0) * (i / tubular)).add(c);
    pos.setXYZ(j, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export const choynak = definePart({
  name: 'choynak', kind: 'prop',
  options: { height: 15, steam: true, ink: '#1d3f9a', gold: '#d6a640', ground: '#f7f3ea' },
  build(o, ctx) {
    const k = o.height / 15;
    const P = [[0.001, 0.4], [4.6, 0], [4.9, 0.1], [5.0, 0.7], [5.6, 1.4], [6.6, 3], [7.2, 5.2], [7.1, 7.2], [6.4, 9.2], [5.0, 10.8], [3.9, 11.6], [3.8, 12.1], [4.0, 12.3], [3.6, 12.35], [0.001, 12.3]].map(([r, y]) => [r * k, y * k]);
    const { mesh: body } = latheVessel(P, { map: (m) => paxtaTexture({ ink: o.ink, gold: o.gold, ground: o.ground, field: [m[4] + 0.01, m[8]], lines: [m[3], m[10]], band: null, cols: 12, rows: 3 }) });
    const glaze = new THREE.MeshPhysicalMaterial({ color: o.ground, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
    const gold = new THREE.MeshStandardMaterial({ color: o.gold, metalness: 0.85, roughness: 0.3 });
    const ink = new THREE.MeshPhysicalMaterial({ color: o.ink, roughness: 0.25, clearcoat: 0.9 });
    const content = new THREE.Group();
    content.add(body);
    // lid + knob
    const { mesh: lid } = latheVessel([[0.001, 12.3], [3.7, 12.3], [3.6, 12.7], [3.0, 13.4], [1.6, 13.9], [0.6, 14.0], [0.001, 14.0]].map(([r, y]) => [r * k, y * k]), { map: null, color: o.ink });
    content.add(lid);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.85 * k, 24, 16), gold);
    knob.position.y = 14.55 * k; knob.scale.y = 0.9; knob.castShadow = true; content.add(knob);
    // spout (S-curve, tapering) and handle (loop)
    const spoutCurve = new THREE.CatmullRomCurve3([[5.8, 3.6, 0], [8.2, 5.2, 0], [9.6, 8.6, 0], [10.6, 11.4, 0], [11.6, 12.4, 0]].map(([x, y, z]) => new THREE.Vector3(x * k, y * k, z)));
    content.add(taperTube(spoutCurve, 1.35 * k, 0.55 * k, 40, 18, glaze));
    const tip = new THREE.Mesh(new THREE.TorusGeometry(0.56 * k, 0.12 * k, 8, 20), gold);
    tip.position.copy(spoutCurve.getPoint(1)); tip.lookAt(spoutCurve.getPoint(1).add(spoutCurve.getTangent(1))); content.add(tip);
    const handleCurve = new THREE.CatmullRomCurve3([[-5.6, 10.2, 0], [-8.6, 10.6, 0], [-10.1, 8.2, 0], [-9.4, 5.0, 0], [-7.0, 3.2, 0]].map(([x, y, z]) => new THREE.Vector3(x * k, y * k, z)));
    content.add(taperTube(handleCurve, 0.62 * k, 0.5 * k, 32, 12, ink));
    content.traverse((m) => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    const holder = new THREE.Group(), pivot = new THREE.Group();
    pivot.add(content); holder.add(pivot);
    const root = new THREE.Group(); root.add(holder);
    const rock = rockable(ctx, pivot, { sound: 'ceramic-ring', radius: 4.6 * k, pitch: 0.6 });
    const spoutTip = spoutCurve.getPoint(1).add(new THREE.Vector3(0.4 * k, 0.3 * k, 0));
    if (o.steam) ctx.fx('steam', { at: () => root.localToWorld(spoutTip.clone()), rate: 10, life: 2.4, rise: 7, spread: 0.6, size: [1.0, 5.5], opacity: 0.14, seed: ctx.seed });
    return {
      root,
      anchors: { spout: spoutTip, lid: new THREE.Vector3(0, 15.4 * k, 0), handle: new THREE.Vector3(-10 * k, 7 * k, 0), side: new THREE.Vector3(0, 0, 9 * k), back: new THREE.Vector3(0, 0, -9 * k) },
      actions: rock.actions,
      update: (t) => rock.update(t),
    };
  },
  demo: { radius: 55, height: 18, rot: -30 },
});
export default choynak;
