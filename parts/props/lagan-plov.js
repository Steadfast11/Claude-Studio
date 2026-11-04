// parts/props/lagan-plov.js — a large painted lagan (serving plate) heaped with plov: golden rice dome,
// julienned yellow and orange carrots, chickpeas, raisins, lamb pieces and a whole garlic head on top. Steams.
//   laganPlov({ diameter: 40, mound: 15, steam: true, seed: 3 })
// Anchors: top (garlic), rim (front rim point), front (table level in front), side.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { latheVessel, rishtonTexture } from './_ceramics.js';
import { canvasTexture } from '../../engine/materials/procedural-textures.js';
import { rng } from '../../engine/core/rng.js';

function riceTexture(seed) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#c98a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const tone = r.next();
      g.fillStyle = tone < 0.15 ? '#a8641f' : tone < 0.6 ? '#e2b36a' : tone < 0.9 ? '#f0cd8c' : '#fbe6b6';
      g.save(); g.translate(r.next() * w, r.next() * h); g.rotate(r.next() * Math.PI);
      g.beginPath(); g.ellipse(0, 0, 7, 2.6, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }, { key: 'rice' + seed, repeat: [3, 2] });
}

export const laganPlov = definePart({
  name: 'lagan-plov', kind: 'prop',
  options: { diameter: 40, mound: 15, height: 10, steam: true, seed: 3, glaze: '#2a6fb0', ink: '#14306e' },
  build(o, ctx) {
    const R = o.diameter / 2, r = rng(o.seed);
    const plate = [[0.001, 0.6], [R * 0.45, 0], [R * 0.48, 0.1], [R * 0.5, 0.8], [R * 0.75, 1.5], [R * 0.95, 2.6], [R, 2.9], [R - 0.4, 2.85], [R * 0.9, 2.2], [R * 0.7, 1.45], [R * 0.45, 1.1], [0.001, 1.1]];
    const { mesh: lagan } = latheVessel(plate, { map: rishtonTexture({ glaze: '#f1e7cf', ink: o.ink, accent: '#d89a2b', leaf: o.glaze, cream: '#f6efe0', outer: [0.05, 0.42], rim: 0.55, inner: [0.62, 0.9], seed: o.seed, petals: 16 }) });
    const root = new THREE.Group(); root.add(lagan);
    // rice mound: smooth dome with grain texture
    const M = o.mound, Hm = o.height, base = 1.1;
    const heightAt = (rad) => (rad >= M ? 0 : Hm * Math.pow(Math.cos((rad / M) * Math.PI / 2), 1.3));
    const prof = [];
    for (let i = 0; i <= 24; i++) { const rad = M * (1 - i / 24); prof.push(new THREE.Vector2(Math.max(rad, 0.001), base + heightAt(rad))); }
    prof.unshift(new THREE.Vector2(M + 0.6, base));
    const dome = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), new THREE.MeshStandardMaterial({ map: riceTexture(o.seed), roughness: 0.45, bumpMap: riceTexture(o.seed), bumpScale: 0.6 }));
    dome.castShadow = dome.receiveShadow = true; root.add(dome);
    const onMound = (rad, a, lift = 0) => new THREE.Vector3(Math.cos(a) * rad, base + heightAt(rad) + lift, Math.sin(a) * rad);
    const scatter = (geo, mat, n, fn) => {
      const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { fn(m4, i); im.setMatrixAt(i, m4); }
      im.castShadow = im.receiveShadow = true; root.add(im); return im;
    };
    const Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3();
    // carrots: thin batons, yellow + orange, lying on the surface
    for (const [col, n] of [['#f0a020', 170], ['#e8661c', 110]]) {
      scatter(new THREE.BoxGeometry(0.3, 0.3, 2.6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), n, (m4) => {
        const rad = Math.sqrt(r.next()) * M * 0.95, a = r.next() * 6.283;
        const p = onMound(rad, a, 0.15);
        const slope = Math.atan2(heightAt(rad - 0.5) - heightAt(rad + 0.5), 1);
        E.set(r.range(-0.3, 0.3), r.next() * 6.283, slope * 0.8); Q.setFromEuler(E);
        m4.compose(p, Q, S.set(1, 1, r.range(0.6, 1.2)));
      });
    }
    scatter(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({ color: '#d9b77a', roughness: 0.6 }), 36, (m4) => { const rad = Math.sqrt(r.next()) * M * 0.9, a = r.next() * 6.283; m4.compose(onMound(rad, a, 0.35), Q.identity(), S.set(1, 0.9, 1)); });
    scatter(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: '#2a1410', roughness: 0.35 }), 40, (m4) => { const rad = Math.sqrt(r.next()) * M * 0.9, a = r.next() * 6.283; m4.compose(onMound(rad, a, 0.2), Q.identity(), S.set(1.3, 0.7, 1)); });
    // lamb pieces on the crown
    const meatGeo = new THREE.BoxGeometry(2.4, 1.5, 1.9, 3, 3, 3);
    const mp = meatGeo.attributes.position;
    for (let i = 0; i < mp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(mp, i); v.multiplyScalar(1 - 0.25 * (Math.abs(v.x) * Math.abs(v.z) + Math.abs(v.y) * 0.5)); mp.setXYZ(i, v.x, v.y, v.z); }
    meatGeo.computeVertexNormals();
    scatter(meatGeo, new THREE.MeshStandardMaterial({ color: '#7d4a2c', roughness: 0.5 }), 9, (m4, i) => { const rad = 2.8 + (i % 3) * 1.2, a = i * 0.75 + r.next() * 0.3; E.set(r.range(-0.3, 0.3), a, r.range(-0.3, 0.3)); m4.compose(onMound(rad, a, 0.6), Q.setFromEuler(E), S.set(1, 1, 1)); });
    // garlic head on top
    const garlicProf = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; garlicProf.push(new THREE.Vector2(Math.max(0.001, Math.sin(u * Math.PI) * 2.2 * (1 - 0.35 * u)), u * 3.2)); }
    garlicProf.push(new THREE.Vector2(0.25, 3.5), new THREE.Vector2(0.001, 3.6));
    const gg = new THREE.LatheGeometry(garlicProf, 32), gp = gg.attributes.position;
    for (let i = 0; i < gp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(gp, i); const a = Math.atan2(v.z, v.x); const k = 1 + 0.07 * Math.cos(a * 8); gp.setXYZ(i, v.x * k, v.y, v.z * k); }
    gg.computeVertexNormals();
    const garlic = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: '#efe2cf', roughness: 0.5 }));
    garlic.position.set(0, base + Hm - 0.6, 0); garlic.castShadow = true; root.add(garlic);
    if (o.steam) {
      ctx.fx('steam', { at: () => root.localToWorld(new THREE.Vector3(-3, base + Hm, 2)), rate: 9, life: 2.8, rise: 8, spread: 6, size: [2, 8], opacity: 0.1, seed: ctx.seed });
      ctx.fx('steam', { at: () => root.localToWorld(new THREE.Vector3(4, base + Hm * 0.7, -3)), rate: 7, life: 2.6, rise: 7, spread: 5, size: [2, 7], opacity: 0.09, seed: ctx.seed + 1 });
    }
    return { root, anchors: { top: new THREE.Vector3(0, base + Hm + 3, 0), rim: new THREE.Vector3(0, 2.9, R), front: new THREE.Vector3(0, 0, R + 2), side: new THREE.Vector3(R + 2, 0, 0) } };
  },
  demo: { radius: 75, height: 35 },
});
export default laganPlov;
