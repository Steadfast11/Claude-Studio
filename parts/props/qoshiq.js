// parts/props/qoshiq.js — a spoon lying on the table (metal or wood): shallow oval bowl + tapered handle.
//   qoshiq({ length: 14, material: 'silver' | 'wood' })
// Anchors: bowl, handle, over. It is an obstacle: characters hop over it, rolling props bump over it.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { woodTexture } from '../../engine/materials/procedural-textures.js';

export const qoshiq = definePart({
  name: 'qoshiq', kind: 'prop',
  options: { length: 14, material: 'silver' },
  build(o) {
    const k = o.length / 14;
    const mat = o.material === 'wood'
      ? new THREE.MeshStandardMaterial({ map: woodTexture({ base: '#a8743f', seed: 6 }).map, roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ color: '#b9b5ac', metalness: 1, roughness: 0.34 });
    mat.side = THREE.DoubleSide;
    // bowl: lower half of a squashed sphere, open on top
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
    bowl.scale.set(2.1 * k, 0.75 * k, 3.0 * k);
    bowl.position.set(0, 0.8 * k, -2.6 * k);
    // handle: a tapered, slightly arched strip
    const shape = new THREE.Shape();
    shape.moveTo(-0.35, 0); shape.lineTo(-0.75, 9.2); shape.quadraticCurveTo(0, 10.2, 0.75, 9.2); shape.lineTo(0.35, 0); shape.closePath();
    const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 12 });
    const hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) { const y = hp.getY(i); hp.setZ(i, hp.getZ(i) + Math.sin((y / 9.6) * Math.PI) * 0.9); }
    hg.computeVertexNormals();
    const handle = new THREE.Mesh(hg, mat);
    handle.rotation.x = -Math.PI / 2; handle.rotation.z = Math.PI; handle.scale.setScalar(k);
    handle.position.set(0, 0.2 * k, 0.2 * k);
    const root = new THREE.Group(); root.add(bowl, handle);
    root.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
    return { root, obstacle: true, anchors: { bowl: new THREE.Vector3(0, 0.8 * k, -2.6 * k), handle: new THREE.Vector3(0, 0.5 * k, 6 * k), over: new THREE.Vector3(0, 3 * k, 1.5 * k) } };
  },
  demo: { radius: 26, height: 12 },
});
export default qoshiq;
