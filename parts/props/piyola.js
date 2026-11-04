// parts/props/piyola.js — handle-less tea bowl in the "paxta" pattern, optionally holding hot green/black tea.
//   piyola({ diameter: 9, tea: true, steam: false, ink: '#1d3f9a' })
// Anchors: rim, front, side, tea (liquid surface). Action: wobble (rocks and rings when bumped).
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { latheVessel, paxtaTexture } from './_ceramics.js';
import { rockable } from './_prop-actions.js';

export const piyola = definePart({
  name: 'piyola', kind: 'prop',
  options: { diameter: 9, height: 5, tea: false, teaColor: '#6e300c', steam: false, ink: '#1d3f9a', gold: '#d6a640', ground: '#f7f3ea' },
  build(o, ctx) {
    const R = o.diameter / 2, H = o.height, w = 0.32;
    const out = [[0.001, 0.25], [R * 0.36, 0], [R * 0.4, 0.05], [R * 0.41, 0.5], [R * 0.46, 0.62]];
    for (let i = 1; i <= 8; i++) { const u = i / 8; out.push([R * (0.46 + 0.54 * Math.sin((u * Math.PI) / 2) ** 0.8), 0.62 + (H - 0.62) * u]); }
    const rimI = out.length;
    out.push([R + 0.08, H + 0.1], [R - w, H]);
    const inner = [];
    for (let i = 7; i >= 0; i--) { const u = i / 8; inner.push([(R - w) * (0.08 + 0.92 * Math.sin((u * Math.PI) / 2) ** 0.75), 0.62 + w + (H - 0.62 - w) * u]); }
    const P = [...out, ...inner, [0.001, 0.62 + w]];
    const { mesh } = latheVessel(P, { map: (m) => paxtaTexture({ ink: o.ink, gold: o.gold, ground: o.ground, field: [m[5], m[rimI - 2]], lines: [m[rimI]], band: [m[rimI + 2], m[rimI + 4]], cols: 9, rows: 2 }) });
    const content = new THREE.Group(); content.add(mesh);
    const teaY = H * 0.68;
    if (o.tea) {
      const rr = (R - w) * (0.08 + 0.92 * Math.sin(((teaY - 0.62 - w) / (H - 0.62 - w)) * Math.PI / 2) ** 0.75);
      const tea = new THREE.Mesh(new THREE.CircleGeometry(rr * 0.99, 40), new THREE.MeshPhysicalMaterial({ color: o.teaColor, roughness: 0.14, clearcoat: 0.4, envMapIntensity: 0.4 }));
      tea.rotation.x = -Math.PI / 2; tea.position.y = teaY; tea.receiveShadow = true; content.add(tea);
    }
    const holder = new THREE.Group(), pivot = new THREE.Group();
    pivot.add(content); holder.add(pivot);
    const root = new THREE.Group(); root.add(holder);
    const rock = rockable(ctx, pivot, { sound: 'ceramic-ring', radius: R * 0.4, pitch: 1.5 * (9 / o.diameter) });
    if (o.steam && o.tea) ctx.fx('steam', { at: () => root.localToWorld(new THREE.Vector3(0, teaY + 0.3, 0)), rate: 9, life: 2.4, rise: 5.5, spread: R * 0.9, size: [1.2, 5.5], opacity: 0.16, seed: ctx.seed });
    return {
      root,
      anchors: { rim: new THREE.Vector3(0, H, R), front: new THREE.Vector3(0, 0, R + 1.5), side: new THREE.Vector3(R + 1.5, 0, 0), tea: new THREE.Vector3(0, teaY, 0) },
      actions: rock.actions,
      update: (t) => rock.update(t),
    };
  },
  demo: { opts: { tea: true, steam: true }, radius: 30, height: 14, action: [[1.0, 'subject.wobble', {}]] },
});
export default piyola;
