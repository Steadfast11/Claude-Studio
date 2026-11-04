// parts/sets/studio.js — neutral tabletop studio: wooden table, plaster room, one window with a cross mullion
// and a painted gradient sky outside. Generic stage for part demos and quick tests.
//   studio({ wall: '#e6d9c4', table: '#8b5a35', sky: ['#ffcf8a', '#f08a5d', '#6a5a8c'] })
// Exposes: surface(x, z), views (wide, close, window), info { window, interior, table } for light rigs.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { woodTexture, noiseTexture, canvasTexture } from '../../engine/materials/procedural-textures.js';

export function skyTexture(colors, { sun = 0.5, sunY = 0.62, key } = {}) {
  return canvasTexture(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    colors.forEach((c, i) => gr.addColorStop(i / (colors.length - 1), c));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sg = g.createRadialGradient(w * sun, h * (1 - sunY), 0, w * sun, h * (1 - sunY), h * 0.5);
    sg.addColorStop(0, 'rgba(255,250,225,1)'); sg.addColorStop(0.06, 'rgba(255,236,190,0.9)'); sg.addColorStop(0.25, 'rgba(255,200,130,0.35)'); sg.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
  }, { key: key || 'sky' + colors.join() + sun + sunY, wrap: THREE.ClampToEdgeWrapping });
}

export const studio = definePart({
  name: 'studio', kind: 'set',
  options: { wall: '#e6d9c4', table: '#8b5a35', sky: ['#f6c58a', '#f3a070', '#c77a7a', '#5b5a8a'], tableSize: [180, 110], windowSize: [60, 58], windowY: 55 },
  build(o) {
    const root = new THREE.Group();
    const [TW, TD] = o.tableSize;
    const wood = woodTexture({ base: o.table, seed: 4 });
    wood.map.repeat.set(1.5, 1); wood.bump.repeat.set(1.5, 1);
    const table = new THREE.Mesh(new THREE.BoxGeometry(TW, 4, TD), new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 0.6, roughness: 0.55 }));
    table.position.y = -2; table.castShadow = table.receiveShadow = true; root.add(table);
    const plaster = new THREE.MeshStandardMaterial({ color: o.wall, roughness: 0.95, bumpMap: noiseTexture({ scale: 24, seed: 8 }), bumpScale: 1.2 });
    const wallZ = -70, floorY = -75, H = 230, [ww, wh] = o.windowSize, wy = o.windowY;
    const box = (w, h, d, x, y, z, m = plaster) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; root.add(b); return b; };
    const side = (400 - ww) / 2;
    box(side, H, 8, -(ww / 2 + side / 2), floorY + H / 2, wallZ - 4);
    box(side, H, 8, ww / 2 + side / 2, floorY + H / 2, wallZ - 4);
    box(ww, wy - wh / 2 - floorY, 8, 0, (floorY + wy - wh / 2) / 2, wallZ - 4);
    box(ww, floorY + H - (wy + wh / 2), 8, 0, (wy + wh / 2 + floorY + H) / 2, wallZ - 4);
    box(400, 8, 400, 0, floorY + H + 4, 130); // ceiling
    box(400, 2, 400, 0, floorY - 1, 130, new THREE.MeshStandardMaterial({ color: '#5a3a26', roughness: 0.8 })); // floor
    const frame = new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.6 });
    box(ww, 2.2, 3, 0, wy, wallZ - 4, frame); box(2.2, wh, 3, 0, wy, wallZ - 4, frame);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(900, 450), new THREE.MeshBasicMaterial({ map: skyTexture(o.sky), toneMapped: false }));
    sky.position.set(0, 80, -420); sky.material.color.setScalar(2.2); sky.castShadow = false; root.add(sky);
    const surface = (x, z) => (Math.abs(x) <= TW / 2 && Math.abs(z) <= TD / 2 ? 0 : floorY);
    return {
      root, surface,
      views: {
        wide: { pos: [0, 48, 150], look: [0, 6, 0], lens: 35 },
        close: { pos: [0, 16, 62], look: [0, 6, 0], lens: 50 },
        window: { pos: [0, 62, 110], look: [0, 55, -70], lens: 35 },
      },
      info: {
        window: { center: new THREE.Vector3(0, wy, wallZ), normal: new THREE.Vector3(0, 0, -1), size: [ww, wh] },
        interior: new THREE.Box3(new THREE.Vector3(-200, floorY, wallZ), new THREE.Vector3(200, floorY + H, 220)),
        table: new THREE.Box3(new THREE.Vector3(-TW / 2, 0, -TD / 2), new THREE.Vector3(TW / 2, 0, TD / 2)),
      },
    };
  },
  demo: { shot: { rig: 'static', at: 'wide', focus: [0, 6, 0], fstop: 8 } },
});
export default studio;
