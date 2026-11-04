// parts/sets/uzbek-room.js — a traditional room at golden hour: a wooden tapchan (raised platform) with a low
// xontaxta table under a dasturxon, ikat kurpachas and cushions, thick plaster walls with a carved ganch frieze,
// arched niches holding ceramics, a suzani hanging, and an arched window with a girih lattice (it casts patterned
// light) looking out on a painted Samarkand skyline — turquoise domes and minarets against the setting sun.
//   uzbekRoom({ table: [110, 72], cloth: '#b3122e', sun: [14, 8] /* azimuth°, elevation° */, window: { width: 74, sill: 6, top: 108 } })
// Table-top surface is y = 0. Exposes surface(x, z), views, and info { window, interior, table, sun } for lights.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { woodTexture, noiseTexture, canvasTexture, starLatticeTexture } from '../../engine/materials/procedural-textures.js';
import { rng } from '../../engine/core/rng.js';
import { DEG } from '../../engine/core/math.js';
import { dasturxonMesh } from '../props/dasturxon.js';
import { kurpachaMesh } from '../props/kurpacha.js';
import { latheVessel, rishtonTexture } from '../props/_ceramics.js';

/** Pointed (Islamic) arch outline: rectangle (x0..x1, y0..spring) topped by two curves meeting at apex. */
function archPath(path, x0, x1, y0, spring, apex) {
  const xm = (x0 + x1) / 2, a = (x1 - x0) / 2, h = apex - spring;
  path.moveTo(x0, y0); path.lineTo(x1, y0); path.lineTo(x1, spring);
  path.bezierCurveTo(x1, spring + h * 0.55, xm + a * 0.28, apex - h * 0.12, xm, apex);
  path.bezierCurveTo(xm - a * 0.28, apex - h * 0.12, x0, spring + h * 0.55, x0, spring);
  path.lineTo(x0, y0);
  return path;
}

/** Painted sunset sky with a Samarkand skyline. sunUV = [u, v] of the sun in the canvas (v from top). */
function skylineTexture({ sunUV, seed, colors }) {
  return canvasTexture(2048, 1024, (g, w, h) => {
    const r = rng(seed), hy = h * 0.66;
    const sky = g.createLinearGradient(0, 0, 0, hy);
    colors.forEach((c, i) => sky.addColorStop(i / (colors.length - 1), c));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const [su, sv] = sunUV, sx = su * w, sy = sv * h;
    let gl = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.7);
    gl.addColorStop(0, 'rgba(255,240,200,0.9)'); gl.addColorStop(0.08, 'rgba(255,214,150,0.6)'); gl.addColorStop(0.35, 'rgba(255,170,100,0.22)'); gl.addColorStop(1, 'rgba(255,150,90,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, h);
    // thin cloud streaks lit from below
    for (let i = 0; i < 14; i++) {
      const y = r.range(h * 0.12, hy * 0.85), x = r.range(-200, w), len = r.range(200, 700);
      g.fillStyle = `rgba(255,${Math.round(r.range(150, 205))},${Math.round(r.range(120, 160))},${r.range(0.08, 0.22)})`;
      g.beginPath(); g.ellipse(x + len / 2, y, len / 2, r.range(3, 9), 0, 0, 7); g.fill();
    }
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(sx, sy, h * 0.028, 0, 7); g.fill();
    // distant haze band
    const hz = g.createLinearGradient(0, hy - h * 0.12, 0, hy + 10);
    hz.addColorStop(0, 'rgba(255,190,140,0)'); hz.addColorStop(1, 'rgba(240,160,130,0.55)');
    g.fillStyle = hz; g.fillRect(0, hy - h * 0.12, w, h * 0.12 + 10);
    const sil = '#4a3560', rim = 'rgba(255,190,120,0.85)', teal = '#3d7d8f';
    const dome = (x, base, R, H, ribbed = true) => {
      g.fillStyle = teal;
      g.beginPath(); g.moveTo(x - R, base); g.bezierCurveTo(x - R * 1.15, base - H * 0.75, x - R * 0.35, base - H, x, base - H * 1.12); g.bezierCurveTo(x + R * 0.35, base - H, x + R * 1.15, base - H * 0.75, x + R, base); g.fill();
      if (ribbed) { g.strokeStyle = 'rgba(20,40,60,0.35)'; g.lineWidth = 2; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(x + k * R * 0.28, base); g.quadraticCurveTo(x + k * R * 0.22, base - H * 0.8, x, base - H * 1.1); g.stroke(); } }
      g.strokeStyle = rim; g.lineWidth = 3; g.beginPath(); g.moveTo(x + R * 0.1, base - H * 1.1); g.bezierCurveTo(x + R * 0.5, base - H, x + R * 1.1, base - H * 0.7, x + R, base); g.stroke();
      g.fillStyle = sil; g.fillRect(x - R * 0.9, base, R * 1.8, h * 0.05); // drum
      g.fillStyle = '#d9a64a'; g.fillRect(x - 2, base - H * 1.12 - 18, 4, 18);
    };
    const minaret = (x, base, H, wd) => {
      g.fillStyle = sil; g.beginPath(); g.moveTo(x - wd, base); g.lineTo(x - wd * 0.7, base - H); g.lineTo(x + wd * 0.7, base - H); g.lineTo(x + wd, base); g.fill();
      g.fillRect(x - wd * 1.1, base - H - 10, wd * 2.2, 10);
      g.fillStyle = teal; g.beginPath(); g.arc(x, base - H - 10, wd * 0.8, Math.PI, 0); g.fill();
      g.strokeStyle = rim; g.lineWidth = 2; g.beginPath(); g.moveTo(x + wd * 0.7, base - H); g.lineTo(x + wd, base); g.stroke();
    };
    const portal = (x, base, W2, H) => {
      g.fillStyle = sil; g.fillRect(x - W2, base - H, W2 * 2, H);
      g.fillStyle = '#2f2346';
      g.beginPath(); g.moveTo(x - W2 * 0.55, base); g.lineTo(x - W2 * 0.55, base - H * 0.62); g.quadraticCurveTo(x, base - H * 0.95, x + W2 * 0.55, base - H * 0.62); g.lineTo(x + W2 * 0.55, base); g.fill();
      g.fillStyle = 'rgba(80,150,170,0.5)'; g.fillRect(x - W2, base - H, W2 * 2, 6);
    };
    const base = hy;
    // Registan-like ensemble left of centre, a great dome on the right, smaller domes scattered
    portal(w * 0.3, base, 70, 170); minaret(w * 0.3 - 95, base, 230, 13); minaret(w * 0.3 + 95, base, 230, 13); dome(w * 0.3 + 165, base - 40, 70, 95);
    portal(w * 0.46, base, 95, 210); dome(w * 0.46, base - 210, 80, 105); minaret(w * 0.46 - 125, base, 260, 15); minaret(w * 0.46 + 125, base, 260, 15);
    portal(w * 0.62, base, 70, 170); minaret(w * 0.62 - 95, base, 230, 13); minaret(w * 0.62 + 95, base, 230, 13);
    dome(w * 0.8, base - 30, 120, 150); portal(w * 0.8 - 160, base, 50, 150);
    for (let i = 0; i < 9; i++) dome(r.range(0, w), base - r.range(0, 20), r.range(25, 45), r.range(30, 55), false);
    // low city mass fading into dusk, with a scatter of warm lit windows
    g.fillStyle = '#3a2a48';
    for (let x = 0; x < w; x += r.range(30, 80)) g.fillRect(x, base - r.range(10, 45), r.range(40, 110), 60);
    const city = g.createLinearGradient(0, base, 0, h);
    city.addColorStop(0, '#47304f'); city.addColorStop(0.35, '#2f2038'); city.addColorStop(1, '#1d1424');
    g.fillStyle = city; g.fillRect(0, base, w, h - base);
    for (let i = 0; i < 260; i++) {
      const y = base + Math.pow(r.next(), 1.6) * (h - base) * 0.8, s = 2 + (y - base) / 60;
      g.fillStyle = `rgba(255,${Math.round(r.range(170, 215))},${Math.round(r.range(90, 140))},${r.range(0.45, 0.9)})`;
      g.fillRect(r.range(0, w), y, s * 1.4, s);
    }
  }, { key: `skyline${sunUV}${seed}${colors}`, wrap: THREE.ClampToEdgeWrapping });
}

/** Near silhouette layer (rooftops and poplars) with transparency, for parallax through the window. */
function nearLayerTexture(seed) {
  return canvasTexture(2048, 512, (g, w, h) => {
    const r = rng(seed);
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#2b1c22';
    for (let x = 0; x < w; x += r.range(60, 160)) { const ht = r.range(40, 120); g.fillRect(x, h - ht, r.range(80, 180), ht); }
    for (let i = 0; i < 18; i++) { const x = r.range(0, w), ht = r.range(150, 330); g.beginPath(); g.ellipse(x, h - ht / 2, r.range(14, 26), ht / 2, 0, 0, 7); g.fill(); }
  }, { key: 'near' + seed, wrap: THREE.ClampToEdgeWrapping });
}

/** Window: girih lattice in the arch (star-shaped openings), open casement below with a cross of mullions;
 *  transparent outside the arch outline. Alpha-tested, so it casts patterned light. */
function latticeTexture({ wd, ht, spring, seed }) {
  const ppc = 10;
  return canvasTexture(Math.round(wd * ppc), Math.round(ht * ppc), (g, w, h) => {
    const X = (cm) => cm * ppc, springY = h - X(spring);
    const outline = archPath(new Path2D(), 0, w, h, springY, 0); // canvas y grows down: base at h, apex at 0
    g.save(); g.clip(outline);
    g.fillStyle = '#5a3419'; g.fillRect(0, 0, w, springY + X(1));
    g.globalCompositeOperation = 'destination-out';
    const cell = X(9.5);
    for (let y = cell * 0.5; y < springY; y += cell) for (let x = w / 2 - Math.ceil(w / cell) * cell; x < w + cell; x += cell) {
      g.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 + Math.PI / 8; const rr = k % 2 ? cell * 0.26 : cell * 0.43; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.fill();
      g.beginPath(); g.arc(x + cell / 2, y + cell / 2, cell * 0.16, 0, 7); g.fill();
    }
    g.restore();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#4a2a14'; g.lineWidth = X(2.6); g.stroke(outline);
    g.lineWidth = X(1.8); g.beginPath(); g.moveTo(0, springY); g.lineTo(w, springY); g.moveTo(w / 2, springY); g.lineTo(w / 2, h);
    g.moveTo(0, springY + (h - springY) * 0.45); g.lineTo(w, springY + (h - springY) * 0.45); g.stroke();
  }, { key: `lattice2${wd}${ht}${spring}${seed}`, wrap: THREE.ClampToEdgeWrapping });
}

function suzaniTexture(seed) {
  return canvasTexture(1024, 1400, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#efe0c2'; g.fillRect(0, 0, w, h);
    const flower = (x, y, R) => {
      for (let ring = 3; ring >= 1; ring--) { g.fillStyle = ['', '#8e1023', '#c8263a', '#e07a2f'][ring]; g.beginPath(); for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, rr = R * (ring / 3) * (k % 2 ? 0.82 : 1); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
      g.fillStyle = '#20305e'; g.beginPath(); g.arc(x, y, R * 0.22, 0, 7); g.fill();
    };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) flower(w * (0.2 + 0.3 * i), h * (0.14 + 0.24 * j), r.range(95, 125));
    g.strokeStyle = '#3d6b3a'; g.lineWidth = 10;
    for (let i = 0; i < 30; i++) { g.beginPath(); const x = r.range(0, w), y = r.range(0, h); g.moveTo(x, y); g.quadraticCurveTo(x + r.range(-80, 80), y + r.range(-80, 80), x + r.range(-120, 120), y + r.range(-120, 120)); g.stroke(); }
    g.strokeStyle = '#8e1023'; g.lineWidth = 40; g.strokeRect(20, 20, w - 40, h - 40);
  }, { key: 'suzani' + seed });
}

export const uzbekRoom = definePart({
  name: 'uzbek-room', kind: 'set',
  options: {
    table: [110, 72], cloth: '#b3122e', clothField: '#dcc29a', wall: '#eadcc4', sun: [14, 8], seed: 5,
    window: { width: 74, sill: 6, top: 108, spring: 78 },
    sky: ['#3d3470', '#8a4a78', '#d86f6a', '#f6a25c', '#ffd08a'],
  },
  build(o) {
    const root = new THREE.Group();
    const [TW, TD] = o.table;
    const WALL_Z = -64, FLOOR = -75, TAP = -36, CEIL = 195, X0 = -170, X1 = 170;
    const add = (m, cast = true) => { m.traverse?.((c) => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = true; } }); root.add(m); return m; };
    const box = (w, h, d, x, y, z, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); return add(b); };
    // materials
    const darkWood = woodTexture({ base: '#6e4024', dark: '#3a1d0e', light: '#8a5732', seed: 2, planks: 6 });
    const warmWood = woodTexture({ base: '#8e5631', dark: '#4b2511', light: '#b07644', seed: 3, planks: 3 });
    const wood = (tex, rep = [2, 1]) => { const m = new THREE.MeshStandardMaterial({ map: tex.map.clone(), bumpMap: tex.bump, bumpScale: 0.5, roughness: 0.6 }); m.map.repeat.set(...rep); m.map.needsUpdate = true; return m; };
    const plaster = new THREE.MeshStandardMaterial({ color: o.wall, roughness: 0.95, bumpMap: noiseTexture({ scale: 30, seed: 11 }), bumpScale: 1.5 });
    // tapchan platform and xontaxta table (top under the cloth sits at y = -0.25)
    box(250, 6, 200, 0, TAP - 3, 30, wood(darkWood, [3, 2]));
    box(250, FLOOR - (TAP - 6), 6, 0, (TAP - 6 + FLOOR) / 2, 128, wood(darkWood, [3, 1]));
    box(TW, 3.6, TD, 0, -2.05, 0, wood(warmWood, [1.5, 1]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(5, 32, 5, sx * (TW / 2 - 6), TAP + 16, sz * (TD / 2 - 6), wood(warmWood));
    const cloth = dasturxonMesh({ width: TW + 0.6, depth: TD + 0.6, overhang: 15, color: o.cloth, field: o.clothField, seed: o.seed });
    cloth.position.y = 0; add(cloth);
    // rails on the tapchan sides (turned posts + top rail)
    const railMat = wood(darkWood);
    for (const sx of [-1, 1]) {
      box(4, 4, 190, sx * 123, TAP + 30, 30, railMat);
      for (let z = -60; z <= 120; z += 18) { const p = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 30, 10), railMat); p.position.set(sx * 123, TAP + 15, z); add(p); }
    }
    // kurpachas + cushions
    const seat = (len, x, z, rot, seed) => { const k = kurpachaMesh({ length: len, width: 52, thickness: 8, seed }); k.position.set(x, TAP, z); k.rotation.y = rot; add(k); };
    seat(180, -92, 25, Math.PI / 2, 1); seat(180, 92, 25, Math.PI / 2, 2); seat(170, 0, 92, 0, 3);
    for (const [x, z, ry, s] of [[-112, -20, Math.PI / 2, 4], [-112, 50, Math.PI / 2, 5], [112, -20, -Math.PI / 2, 6], [112, 50, -Math.PI / 2, 7]]) {
      const c = kurpachaMesh({ length: 52, width: 18, thickness: 34, kind: 'cushion', seed: s });
      c.position.set(x, TAP + 7, z); c.rotation.set(0, ry, 0); c.rotation.z = 0; add(c);
    }
    // floor
    box(X1 - X0, 2, 400, 0, FLOOR - 1, 120, new THREE.MeshStandardMaterial({ color: '#4a2c1c', roughness: 0.8 }));
    // back wall with an arched window and two arched niches (extruded so the reveals are thick)
    const win = { w: o.window.width, sill: o.window.sill, top: o.window.top, spring: o.window.spring };
    const wallShape = new THREE.Shape();
    wallShape.moveTo(X0, FLOOR); wallShape.lineTo(X1, FLOOR); wallShape.lineTo(X1, CEIL); wallShape.lineTo(X0, CEIL); wallShape.lineTo(X0, FLOOR);
    wallShape.holes.push(archPath(new THREE.Path(), -win.w / 2, win.w / 2, win.sill, win.spring, win.top));
    const niches = [[-110, 30, 70, 95], [110, 30, 70, 95]];
    for (const [nx, y0, sp, ap] of niches) wallShape.holes.push(archPath(new THREE.Path(), nx - 20, nx + 20, y0, sp, ap));
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 16, bevelEnabled: false, curveSegments: 24 });
    const wallMesh = new THREE.Mesh(wallGeo, plaster); wallMesh.position.z = WALL_Z - 16; add(wallMesh);
    for (const [nx, y0, sp, ap] of niches) {
      box(44, ap - y0 + 4, 3, nx, (y0 + ap) / 2, WALL_Z - 13, plaster);
      const shelf = box(42, 1.5, 14, nx, y0 + 0.75, WALL_Z - 8, wood(warmWood));
      shelf.castShadow = true;
      const { mesh: plate } = latheVessel([[0.001, 0.5], [6, 0], [12, 1.2], [13, 2], [12.3, 1.9], [6, 0.9], [0.001, 1.2]], { map: rishtonTexture({ seed: nx > 0 ? 2 : 3, glaze: nx > 0 ? '#1f9aa8' : '#2a6fb0' }) });
      plate.rotation.x = Math.PI / 2 - 0.25; plate.position.set(nx, y0 + 14, WALL_Z - 10); add(plate);
    }
    // side walls, ceiling with beams
    box(10, CEIL - FLOOR, 400, X0 - 5, (CEIL + FLOOR) / 2, 120, plaster);
    box(10, CEIL - FLOOR, 400, X1 + 5, (CEIL + FLOOR) / 2, 120, plaster);
    box(X1 - X0 + 20, 6, 400, 0, CEIL + 3, 120, wood(darkWood, [4, 4]));
    for (let z = -50; z < 300; z += 34) box(X1 - X0, 9, 10, 0, CEIL - 4.5, z, railMat);
    // carved ganch frieze along the back and side walls
    const ganchBump = starLatticeTexture({ size: 512, cells: 4, line: 0.09 });
    const ganch = new THREE.MeshStandardMaterial({ color: '#f1e6d2', roughness: 0.9, bumpMap: ganchBump, bumpScale: 3 });
    ganchBump.repeat.set(18, 1);
    const frieze = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 22), ganch); frieze.position.set(0, 140, WALL_Z + 0.2); add(frieze, false);
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(400, 22), ganch); f.rotation.y = -sx * Math.PI / 2; f.position.set(sx * (X1 - 0.2), 140, 120); add(f, false); }
    // suzani hanging on the left wall
    const suz = new THREE.Mesh(new THREE.PlaneGeometry(90, 123), new THREE.MeshStandardMaterial({ map: suzaniTexture(o.seed), roughness: 0.9 }));
    suz.rotation.y = Math.PI / 2; suz.position.set(X0 + 0.5, 60, 40); add(suz, false);
    // window lattice (alpha-tested so it casts patterned shadows / light shafts)
    const lattice = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.top - win.sill), new THREE.MeshStandardMaterial({ map: latticeTexture({ wd: win.w, ht: win.top - win.sill, spring: win.spring - win.sill, seed: o.seed }), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }));
    lattice.position.set(0, (win.sill + win.top) / 2, WALL_Z - 6); add(lattice);
    // sun direction (shared with light rigs through info.sun) and the painted outside
    const [az, el] = o.sun;
    const sunDir = new THREE.Vector3(-Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG)).normalize();
    const winC = new THREE.Vector3(0, (win.sill + win.top) / 2, WALL_Z);
    const SKY_Z = -640, SW = 1700, SH = 850, horizonY = 40, horizonV = 0.66, skyCY = horizonY + (horizonV - 0.5) * SH;
    const sunHit = winC.clone().addScaledVector(sunDir, (WALL_Z - SKY_Z) / -sunDir.z);
    const sunUV = [(sunHit.x + SW / 2) / SW, 1 - ((sunHit.y - (skyCY - SH / 2)) / SH)];
    const skyMat = new THREE.MeshBasicMaterial({ map: skylineTexture({ sunUV, seed: o.seed, colors: o.sky }) });
    skyMat.color.setScalar(1.35);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), skyMat); sky.position.set(0, skyCY, SKY_Z); root.add(sky);
    const nearMat = new THREE.MeshBasicMaterial({ map: nearLayerTexture(o.seed), transparent: true }); nearMat.color.setScalar(1.0);
    const near = new THREE.Mesh(new THREE.PlaneGeometry(900, 225), nearMat); near.position.set(0, -45, -300); root.add(near);

    const surface = (x, z) => (Math.abs(x) <= TW / 2 && Math.abs(z) <= TD / 2 ? 0 : Math.abs(x) < 125 && z > -62 && z < 130 ? TAP : FLOOR);
    return {
      root, surface,
      views: {
        'wide-window': { pos: [0, 150, 170], look: [0, 70, WALL_Z], lens: 30 },
        wide: { pos: [0, 75, 150], look: [0, 2, 0], lens: 32 },
        table: { pos: [0, 26, 75], look: [0, 4, 0], lens: 40 },
        low: { pos: [0, 4, 60], look: [0, 5, 0], lens: 35 },
      },
      info: {
        window: { center: winC, normal: new THREE.Vector3(0, 0, -1), size: [win.w, win.top - win.sill] },
        interior: new THREE.Box3(new THREE.Vector3(X0, FLOOR, WALL_Z), new THREE.Vector3(X1, CEIL, 180)),
        table: new THREE.Box3(new THREE.Vector3(-TW / 2, 0, -TD / 2), new THREE.Vector3(TW / 2, 0, TD / 2)),
        sun: { dir: sunDir },
      },
    };
  },
  demo: { shot: { rig: 'static', at: 'wide', focus: [0, 0, 0], fstop: 8 } },
});
export default uzbekRoom;
