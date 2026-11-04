// parts/props/anor.js — voxel pomegranate that can wobble, fall, roll (true rolling rotation), be carried,
// and crack open into two halves full of glowing ruby arils (+ seed burst).
//   anor({ size: 8, seed: 1 })                     size = diameter in cm
//   actions: wobble {dur, amount} · fall {to, dur, apex, bounces} · roll {path:[...], speed | dur | keys:[[τ, fraction]...]}
//            carry {by:'hero', anchor:'hands'} · crack {burst:true, count} · hop {to, dur, apex}
// Sounds it emits by itself: wobble creak, landing thuds, rolling rumble (follows its real speed), crack + burst.
import * as THREE from 'three';
import { definePart } from '../../engine/core/registry.js';
import { VoxelGrid } from '../../engine/voxel/voxel.js';
import { buildVoxels } from '../../engine/voxel/build.js';
import { noise3, smoothstep, clamp } from '../../engine/core/math.js';
import { hash } from '../../engine/core/rng.js';
import { ClipSet } from '../../engine/anim/clips.js';
import { E } from '../../engine/anim/easing.js';
import { mixHex } from '../../engine/materials/palette.js';

/** Build the voxel fruit as two halves (left/right, jagged seam) hinged at the back so it opens like a book toward
 *  the viewer, both seed-filled faces turning to camera. Returns { root, halves: [left, right], radius, voxel }. */
export function anorModel({ size = 8, seed = 1, skin = '#a50f26', dark = '#6f0a1b', blush = '#e0704f', crown = '#5e1a12', aril = '#e3173d', pith = '#f2dcb4' } = {}) {
  const N = 13, R = N / 2, voxel = size / N;
  const halves = [new VoxelGrid(), new VoxelGrid()], whole = new VoxelGrid();
  const cy = R;
  for (let x = -7; x <= 7; x++) for (let y = 0; y <= 15; y++) for (let z = -7; z <= 7; z++) {
    const px = x, py = y - cy + 0.5, pz = z;
    const ang = Math.atan2(pz, px);
    const lobe = 1 + 0.035 * Math.cos(6 * ang) + noise3(px * 0.3, py * 0.3, pz * 0.3, seed) * 0.05;
    const d = Math.hypot(px / (R * lobe), (py / (R * 0.94)) * (py > 0 ? 1.04 : 1), pz / (R * lobe));
    let color = null, tag = 'base';
    if (d <= 1) {
      const depth = (1 - d) * R; // voxels from the surface
      if (depth < 1.1) {
        const n = noise3(px * 0.35, py * 0.35, pz * 0.35, seed + 3);
        let c = mixHex(skin, dark, clamp(smoothstep(-0.2, 1, py / R) * 0.65 + n * 0.3, 0, 1));
        if (py < 0) c = mixHex(c, blush, clamp(smoothstep(0.2, 0.9, -py / R) * (0.35 + n * 0.4), 0, 0.6));
        if (hash(x, y, z, seed) < 0.06) c = mixHex(c, '#f39a6b', 0.35);
        color = c; tag = 'gloss';
      } else if (depth < 1.9) color = pith;
      else {
        const membrane = Math.abs(Math.sin(ang * 3 + py * 0.25)) < 0.16 || Math.abs(py + 0.5) < 0.6;
        color = membrane ? pith : mixHex(aril, '#ff4a6a', hash(x, y, z, seed + 1) * 0.5);
        tag = membrane ? 'base' : 'glow';
      }
    } else if (py > R * 0.86 && py < R * 0.86 + 3 && Math.hypot(px, pz) < 2.2 - (py - R * 0.86) * 0.25) {
      // crown (calyx): a short neck with jagged sepals
      const a = Math.atan2(pz, px), tip = Math.cos(a * 6) > 0.2;
      if (py - R * 0.86 < 1.6 || tip) color = mixHex(crown, '#8a3a1a', hash(x, y, z, 9) * 0.6);
    }
    if (color === null) continue;
    const seam = Math.round(noise3(0, py * 0.45, pz * 0.45, seed + 5) * 1.2);
    halves[x < seam ? 0 : 1].set(x, y, z, color, tag); // left half / right half
    whole.set(x, y, z, color, tag);
  }
  const root = new THREE.Group();
  const pivotY = 0; // hinge at the bottom of the fruit
  const parts = halves.map((g) => {
    const b = buildVoxels(g, { size: voxel, origin: [0, pivotY - 0.5, 0], seed, aoGrid: whole, materials: { glow: { emissive: 2.0 }, gloss: { material: { roughness: 0.42 } } } });
    const hinge = new THREE.Group();
    hinge.position.z = -R * voxel; // hinge line runs vertically along the back of the fruit; parent is centred
    b.root.position.set(0, -R * voxel, R * voxel);
    hinge.add(b.root);
    root.add(hinge);
    return hinge;
  });
  return { root, halves: parts, radius: R * voxel, voxel };
}

export const anor = definePart({
  name: 'anor', kind: 'prop',
  options: { size: 8, seed: 1, skin: '#a50f26' },
  build(o, ctx) {
    const model = anorModel(o);
    const r = model.radius;
    const root = new THREE.Group(), rock = new THREE.Group(), squashG = new THREE.Group(), spin = new THREE.Group();
    spin.position.y = r;
    model.root.position.y = 0;
    spin.add(model.root); squashG.add(spin); rock.add(squashG); root.add(rock);
    const glow = new THREE.PointLight('#ff2a46', 0, 22, 2); // the arils' ruby glow once it cracks open
    glow.position.y = r * 0.3; spin.add(glow);
    const motion = ctx.motion({ radius: r, lift: 0, turnRate: 0 });
    const clips = new ClipSet();
        const land = (t, h, api) => {
      const k = clamp(h / 10, 0.25, 1);
      clips.add({ t0: t, dur: 0.35, fadeIn: 0.01, fadeOut: 0.1, fn: (u) => ({ squash: -0.28 * k * Math.exp(-u * 7) * Math.cos(u * 14) }) });
      api.sfx(t, 'thud', { gain: 0.5 + k * 0.6, pitch: 1.1 });
    };
    const actions = {
      wobble(t, { dur = 0.9, amount = 0.22, freq = 3 } = {}, api) {
        clips.add({ t0: t, dur, fadeIn: 0.1, fadeOut: 0.15, fn: (u, tl) => ({ rockX: Math.sin(tl * freq * 6.283) * amount * (0.4 + u), rockZ: Math.sin(tl * freq * 6.283 * 0.7 + 1) * amount * 0.5 * u }) });
        api.sfx(t, 'creak', { dur, gain: 0.5 });
      },
      fall(t, { to, dur = 0.42, apex = 0, bounces = 2 } = {}, api) {
        motion.arc(t, api.point(to), { dur, apex, bounces, restitution: 0.38 });
      },
      hop(t, { to, dur = 0.5, apex = 6 } = {}, api) { motion.arc(t, api.point(to), { dur, apex }); },
      roll(t, { path = [], speed, dur, ease, ramp, keys } = {}, api) {
        motion.path(t, path.map((p) => api.point(p)), keys ? { keys } : speed ? { speed, ramp } : { dur: dur ?? 2, ease: ease || 'inOutSine' });
      },
      carry(t, { by = 'hero', anchor = 'hands', blend = 0.18 } = {}, api) {
        const carrier = api.actor(by);
        motion.attach(t, (tt) => carrier.anchorAt(anchor, tt).add(new THREE.Vector3(0, -r, 0)), { blend });
        clips.add({ t0: t, dur: 0.5, hold: true, fadeIn: 0.45, name: 'upright', fn: () => ({ upright: 1 }) });
      },
      place(t, { to, dur = 0.4, apex = 3 } = {}, api) { motion.arc(t, api.point(to), { dur, apex }); },
      crack(t, { count = 110, burst = true, open = 0.62, speed = [35, 95] } = {}, api) {
        clips.add({ t0: t, dur: 0.6, hold: true, fadeIn: 0.001, name: 'crack', fn: (u) => ({ open: E.outBack(u) * open }) });
        clips.add({ t0: t - 0.25, dur: 0.25, fadeIn: 0.02, fadeOut: 0.02, fn: (u, tl) => ({ shake: Math.sin(tl * 90) * 0.04 * u }) });
        api.sfx(t, 'crack', {}); api.sfx(t + 0.02, 'burst', {});
        if (burst) {
          const at = api.point(api.self + '.center', t);
          api.fx('burst', { t0: t + 0.03, at: () => at().add(new THREE.Vector3(0, r * 0.6, 0)), count, speed, up: 0.85, gravity: 900, floor: 'surface', life: 6, size: 0.55, colors: ['#d0102e', '#e8203f', '#b00d28', '#ff3a5a'], emissive: 1.5, seed: 21 });
          api.fx('sparkles', { t0: t + 0.05, t1: t + 2.2, at: () => at().add(new THREE.Vector3(0, r * 2.5, 0)), radius: 9, count: 28, size: 1.8 });
        }
      },
    };
    const q = new THREE.Quaternion(), qUp = new THREE.Quaternion();
    return {
      root, motion, actions,
      bounds: new THREE.Box3(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, 2 * r, r)),
      anchors: { top: new THREE.Vector3(0, 2 * r + 0.8, 0), center: new THREE.Vector3(0, r, 0) },
      anchorAt(name, t) {
        if (name !== 'center' && name !== 'top') return null;
        const s = motion.sample(t);
        return s.pos.clone().add(new THREE.Vector3(0, name === 'top' ? 2 * r + 0.8 : r, 0));
      },
      compile({ timeline, obstacles = [] }) {
        // bump over low obstacles while rolling
        for (const ob of obstacles) {
          const box = ob.box.clone().expandByVector(new THREE.Vector3(r * 0.5, 0, r * 0.5)), h = ob.box.max.y - ob.box.min.y;
          let inside = -1;
          for (let t = 0; t <= ctx.duration; t += 1 / 120) {
            const s = motion.sample(t), hit = !s.carried && box.containsPoint(new THREE.Vector3(s.pos.x, box.min.y, s.pos.z));
            if (hit && inside < 0) inside = t;
            if (!hit && inside >= 0) {
              const t0 = inside, dur = Math.max(0.12, t - inside);
              clips.add({ t0, dur, fadeIn: 0.001, fadeOut: 0.001, fn: (u) => ({ lift: (h + 0.3) * Math.sin(Math.PI * u) }) });
              timeline.sfx.push({ t: t0, name: 'pop', params: { gain: 0.35, pitch: 0.6 }, from: ctx.name }, { t: t0 + dur, name: 'thud', params: { gain: 0.35, pitch: 1.4 }, from: ctx.name });
              inside = -1;
            }
          }
        }
        for (const e of motion.events) if (e.type === 'land') land(e.t, e.height ?? 4, { sfx: (tt, n, p) => timeline.sfx.push({ t: tt, name: n, params: p, from: ctx.name }) });
        // rolling rumble: sample real ground speed while rolling on the surface
        const samples = []; const step = 1 / 30;
        for (let t = 0; t <= ctx.duration; t += step) { const s = motion.sample(t); samples.push(s.airborne || s.carried ? 0 : s.speed); }
        const runs = []; let start = -1;
        samples.forEach((v, i) => { if (v > 3 && start < 0) start = i; if ((v <= 3 || i === samples.length - 1) && start >= 0) { if (i - start > 3) runs.push([start, i]); start = -1; } });
        for (const [a, b] of runs) timeline.sfx.push({ t: a * step, name: 'roll', params: { speeds: samples.slice(a, b), step, radius: r }, from: ctx.name });
      },
      update(t) {
        const s = motion.sample(t);
        const pose = clips.evaluate(t, { squash: 0, rockX: 0, rockZ: 0, open: 0, upright: 0, shake: 0, lift: 0 });
        root.position.copy(s.pos); root.position.y += pose.lift;
        rock.rotation.set(pose.rockX, 0, pose.rockZ);
        const sy = 1 + pose.squash, k = 1 / Math.sqrt(Math.max(sy, 0.2));
        squashG.scale.set(k, sy, k);
        q.copy(s.quat).slerp(qUp.identity(), clamp(pose.upright));
        spin.quaternion.copy(q);
        spin.position.x = pose.shake * r;
        model.halves[0].rotation.y = -pose.open * 1.25;
        model.halves[1].rotation.y = pose.open * 1.25;
        glow.intensity = 22 * clamp(pose.open / 0.5) * (0.85 + 0.15 * Math.sin(t * 9));
      },
    };
  },
  demo: { radius: 26, height: 8, action: [[0.6, 'subject.wobble', { dur: 0.8 }], [1.8, 'subject.crack', {}]], duration: 3.5 },
});
export default anor;
