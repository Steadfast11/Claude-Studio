// parts/lights/golden-hour.js — low warm sun through the set's window, volumetric shafts with dust, warm fill,
// cool sky bounce, warm table bounce, generated IBL with a bright window "soft box", and a warm grade.
//   goldenHour({ sunAngle: 'auto' | degrees, sunAzimuth: 'auto' | degrees, sunIntensity: 7, shafts: 1, dust: 450 })
// Reads the set's `info.window` / `info.interior` / `info.sun` (any set can provide them); falls back to defaults.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { DEG } from '../../engine/core/math.js';

/** Fit a directional light's orthographic shadow camera tightly around a world box (in light space). */
export function fitShadow(light, box, pad = 4) {
  const cam = light.shadow.camera;
  light.updateMatrixWorld();
  const view = new THREE.Matrix4().lookAt(light.position, light.target.position, new THREE.Vector3(0, 1, 0));
  const inv = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(view)).invert();
  const lb = new THREE.Box3();
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    lb.expandByPoint(p.sub(light.position).applyMatrix4(inv));
  }
  Object.assign(cam, { left: lb.min.x - pad, right: lb.max.x + pad, bottom: lb.min.y - pad, top: lb.max.y + pad, near: Math.max(0.5, -lb.max.z - pad), far: -lb.min.z + pad });
  cam.updateProjectionMatrix();
}

export const goldenHour = definePart({
  name: 'golden-hour', kind: 'light',
  options: {
    sunAngle: 'auto', sunAzimuth: 'auto', sunColor: '#ffb066', sunIntensity: 5.5, shadowSoftness: 3,
    fill: 0.55, fillSky: '#ffe2c4', fillGround: '#6b3f2a', skyBounce: 0.5, tableBounce: 0.35,
    shafts: 1, shaftColor: '#ffbe7a', dust: 450, envStrength: 0.55, exposure: 1.0,
  },
  build(o, ctx) {
    const root = new THREE.Group();
    const info = ctx.instance('set')?.info || {};
    const win = info.window || { center: new THREE.Vector3(0, 60, -80), normal: new THREE.Vector3(0, 0, -1), size: [60, 60] };
    const interior = info.interior || new THREE.Box3(new THREE.Vector3(-150, -75, -80), new THREE.Vector3(150, 150, 200));
    const table = info.table || new THREE.Box3(new THREE.Vector3(-80, 0, -50), new THREE.Vector3(80, 0, 50));
    const tc = table.getCenter(new THREE.Vector3());
    // sun direction: the set's own sun (so the painted sky matches) unless overridden; otherwise out through the
    // window, rotated by azimuth and elevated so the beam lands on the table
    let dir;
    if (info.sun?.dir && o.sunAngle === 'auto' && o.sunAzimuth === 'auto') dir = info.sun.dir.clone();
    else {
      const az = o.sunAzimuth === 'auto' ? 18 : o.sunAzimuth;
      const horiz = win.normal.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), az * DEG);
      const elev = o.sunAngle === 'auto' ? Math.atan2(win.center.y - tc.y, Math.hypot(win.center.x - tc.x, win.center.z - tc.z)) : o.sunAngle * DEG;
      dir = horiz.multiplyScalar(Math.cos(elev)).setY(Math.sin(elev)).normalize();
    }
    const sun = new THREE.DirectionalLight(o.sunColor, o.sunIntensity);
    sun.target.position.copy(win.center).addScaledVector(dir, -60);
    sun.position.copy(sun.target.position).addScaledVector(dir, 600);
    sun.castShadow = true;
    sun.shadow.mapSize.set(ctx.quality.shadowMap, ctx.quality.shadowMap);
    sun.shadow.radius = o.shadowSoftness;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    root.add(sun, sun.target);
    const lit = interior.clone().expandByPoint(win.center.clone().addScaledVector(win.normal, 10));
    fitShadow(sun, lit);
    const hemi = new THREE.HemisphereLight(o.fillSky, o.fillGround, o.fill);
    root.add(hemi);
    const sky = new THREE.DirectionalLight('#9dbdff', o.skyBounce);
    sky.position.copy(win.center).addScaledVector(win.normal, 200).add(new THREE.Vector3(0, 120, 0));
    sky.target.position.copy(tc);
    root.add(sky, sky.target);
    const bounce = new THREE.DirectionalLight('#ff9a62', o.tableBounce);
    bounce.position.set(tc.x, tc.y - 100, tc.z + 80);
    bounce.target.position.copy(tc).add(new THREE.Vector3(0, 20, 0));
    root.add(bounce, bounce.target);
    if (o.dust > 0) ctx.fx('dust', { box: [[interior.min.x * 0.6, table.min.y - 5, win.center.z + 5], [interior.max.x * 0.6, win.center.y + win.size[1] / 2 + 10, table.max.z + 30]], count: o.dust, seed: ctx.seed });
    return {
      root, sun,
      background: '#1a1310',
      environment: {
        top: '#c7a688', horizon: '#d9a87a', bottom: '#4a2c1e', intensity: 0.9, strength: o.envStrength,
        panels: [{ dir: [win.normal.x, 0.35, win.normal.z], color: '#ffd29a', intensity: 7, size: 0.45 }, { dir: [-win.normal.x * 0.3 + 0.7, 0.6, -win.normal.z], color: '#ffe8cc', intensity: 1.2, size: 0.8 }],
      },
      shafts: { color: o.shaftColor, density: 0.0028 * o.shafts, g: 0.62, noise: 0.55, box: [interior.min.toArray(), interior.max.toArray()] },
      ao: { intensity: 0.85, radius: 5 },
      bloom: { strength: 0.22, radius: 0.15, threshold: 1.6 },
      grade: { exposure: o.exposure, warmth: 0.14, saturation: 1.12, contrast: 1.06, vignette: 0.34, grain: 0.032 },
    };
  },
});
export default goldenHour;
