// parts/lights/overcast.js — soft, cool daylight from a cloudy sky: big wrap-around fill, a very soft key from
// the window side, no visible shafts, gentle low-contrast grade.
//   overcast({ intensity: 1, tint: '#dfe6f0' })
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { fitShadow } from './golden-hour.js';

export const overcast = definePart({
  name: 'overcast', kind: 'light',
  options: { intensity: 1, tint: '#dfe6f0', dust: 120 },
  build(o, ctx) {
    const root = new THREE.Group();
    const info = ctx.instance('set')?.info || {};
    const n = info.window?.normal || new THREE.Vector3(0, 0, -1);
    const key = new THREE.DirectionalLight(o.tint, 2.2 * o.intensity);
    key.position.copy(n).multiplyScalar(300).add(new THREE.Vector3(80, 260, 0));
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(ctx.quality.shadowMap, ctx.quality.shadowMap);
    key.shadow.radius = 9; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
    root.add(key, key.target);
    fitShadow(key, info.interior || new THREE.Box3(new THREE.Vector3(-150, -75, -80), new THREE.Vector3(150, 150, 200)));
    root.add(new THREE.HemisphereLight('#e6eef8', '#7a6a5a', 1.3 * o.intensity));
    if (o.dust > 0 && info.table) ctx.fx('dust', { box: [[-60, 0, -40], [60, 60, 40]], count: o.dust, seed: ctx.seed, sunlit: false, opacity: 0.25 });
    return {
      root, sun: key, background: '#cfd6de',
      environment: { top: '#e9eef5', horizon: '#d5d9de', bottom: '#6a5a4c', intensity: 1.2, strength: 0.9, panels: [{ dir: [n.x, 0.4, n.z], color: '#ffffff', intensity: 3, size: 0.6 }] },
      ao: { intensity: 1.1, radius: 6 },
      bloom: { strength: 0.15, radius: 0.3, threshold: 2.5 },
      grade: { exposure: 1.0, warmth: -0.08, saturation: 0.98, contrast: 0.98, vignette: 0.25, grain: 0.03, shadowTint: [0, 0.01, 0.025], highlightTint: [0, 0, 0] },
    };
  },
});
export default overcast;
