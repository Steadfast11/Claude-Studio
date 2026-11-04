// parts/lights/night-lamp.js — evening interior: a hanging lantern pours a warm cone onto the table (volumetric,
// with shadows), cool moonlight leaks through the window, deep blue ambient.
//   nightLamp({ at: [0, 70, 0], target: [0, 0, 0], color: '#ffb35a', intensity: 900, angle: 38, moon: 0.35 })
// Works with any set; reads info.window (moon direction) and info.interior (shaft volume) when present.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';

export const nightLamp = definePart({
  name: 'night-lamp', kind: 'light',
  options: { at: [0, 70, 0], target: [0, 0, 0], color: '#ffb35a', intensity: 26000, angle: 40, penumbra: 0.55, moon: 0.35, lantern: true, shafts: 1, dust: 250 },
  build(o, ctx) {
    const root = new THREE.Group();
    const info = ctx.instance('set')?.info || {};
    const lamp = new THREE.SpotLight(o.color, o.intensity, 0, (o.angle * Math.PI) / 180, o.penumbra, 2);
    lamp.position.set(...o.at); lamp.target.position.set(...o.target);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(ctx.quality.shadowMap, ctx.quality.shadowMap);
    lamp.shadow.camera.near = 5; lamp.shadow.camera.far = 400; lamp.shadow.radius = 4; lamp.shadow.bias = -0.0003;
    root.add(lamp, lamp.target);
    const fill = new THREE.PointLight(o.color, o.intensity * 0.04, 0, 2); fill.position.set(o.at[0], o.at[1] + 6, o.at[2]); root.add(fill);
    if (o.lantern) {
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 9, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#ffcf80', emissive: '#ffb050', emissiveIntensity: 6, side: THREE.DoubleSide, roughness: 0.4 }));
      glass.position.set(o.at[0], o.at[1] + 5.5, o.at[2]);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(5.5, 4, 8), new THREE.MeshStandardMaterial({ color: '#3a2a1a', metalness: 0.7, roughness: 0.4 }));
      cap.position.set(o.at[0], o.at[1] + 11.5, o.at[2]);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 200, 6), cap.material);
      chain.position.set(o.at[0], o.at[1] + 113, o.at[2]);
      root.add(glass, cap, chain);
    }
    root.add(new THREE.HemisphereLight('#2a3760', '#120c10', 0.35));
    if (o.moon > 0 && info.window) {
      const moon = new THREE.DirectionalLight('#9fb6ff', o.moon * 2);
      moon.position.copy(info.window.center).addScaledVector(info.window.normal, 300).add(new THREE.Vector3(40, 160, 0));
      moon.target.position.copy(info.window.center).addScaledVector(info.window.normal, -120);
      root.add(moon, moon.target);
    }
    const box = info.interior || new THREE.Box3(new THREE.Vector3(-150, -75, -80), new THREE.Vector3(150, 150, 200));
    if (o.dust > 0) ctx.fx('dust', { box: [[o.target[0] - 40, o.target[1], o.target[2] - 40], [o.target[0] + 40, o.at[1], o.target[2] + 40]], count: o.dust, seed: ctx.seed, color: '#ffe0b0' });
    return {
      root, sun: lamp, background: '#07080d',
      environment: { top: '#1a2236', horizon: '#2a2230', bottom: '#120c0c', intensity: 0.5, strength: 0.35, panels: [{ dir: [0, 1, 0], color: o.color, intensity: 3, size: 0.25 }] },
      shafts: { color: o.color, density: 0.0035 * o.shafts, g: 0.45, noise: 0.5, box: [box.min.toArray(), box.max.toArray()] },
      ao: { intensity: 1, radius: 5 },
      bloom: { strength: 0.35, radius: 0.3, threshold: 1.4 },
      grade: { exposure: 1.1, warmth: 0.05, saturation: 1.05, contrast: 1.08, vignette: 0.45, grain: 0.04, shadowTint: [-0.02, 0.0, 0.04] },
    };
  },
});
export default nightLamp;
