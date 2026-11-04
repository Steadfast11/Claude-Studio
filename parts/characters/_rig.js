// parts/characters/_rig.js — generic voxel creature rig. A character part supplies a *design* (body grid,
// limbs, face layout, accessory) and gets locomotion, gait, faces, secondary motion, sounds and ~30 actions free.
//
//   const inst = createCreature(design, opts, ctx);   // inside a part's build(); returns the part instance
//
// Locomotion is track-driven: actions only give positions over time (walk/run/sprint/chase/hop/leap...).
// The rig faces the direction of travel (smoothed), picks idle/walk/run/sprint from speed, generates the gait
// (feet, bob, lean into acceleration, banking in turns, arm swing) and emits footstep events for the audio.
// Low props flagged `obstacle` are hopped over automatically (see compile). One-shot actions are ClipSet layers: squash & stretch (volume-preserving), anticipation, overshoot/settle,
// secondary motion on the accessory. Everything is a pure function of t (gait phase is baked from t = 0).
import * as THREE from 'three';
import { buildVoxels } from '../../engine/voxel/build.js';
import { ClipSet } from '../../engine/anim/clips.js';
import { E } from '../../engine/anim/easing.js';
import { clamp, smoothstep, ring, TAU, noise1, wrapAngle } from '../../engine/core/math.js';
import { rng } from '../../engine/core/rng.js';
import { EYES, BROWS, MOUTHS, spriteSlot } from './_faces.js';

const HAND_VERBS = ['catch', 'lift', 'push', 'eat', 'wave', 'cheer', 'drop', 'hug'];
const SPEEDS = { walk: 14, run: 32, sprint: 60 };

/** Slow-motion arc timing: fast take-off, lingering apex, fast landing. */
const slowMo = (k = 0.3) => (u) => { const w = 2 * u - 1; return 0.5 + 0.5 * (k * w + (1 - k) * w * w * w); };

export function createCreature(design, o, ctx) {
  const V = design.voxel;
  const W = design.w * V, H = design.h * V, D = design.d * V, FH = design.footH * V;
  const seed = ctx.seed;

  // ---------- scene graph ----------
  const root = new THREE.Group();          // position + yaw
  const lean = new THREE.Group();          // pitch / bank about the feet
  const squashG = new THREE.Group();       // scale about the body bottom
  const body = new THREE.Group();          // bob / jump / sit offsets
  root.add(lean); lean.add(squashG); squashG.add(body);
  squashG.position.y = FH;
  const bodyMesh = buildVoxels(design.body, { size: V, seed, origin: 'base' }).root;
  body.add(bodyMesh);
  // limbs
  const mk = (grid) => buildVoxels(grid, { size: V, seed: seed + 7, origin: 'center' }).root;
  const handL = mk(design.hand), handR = mk(design.hand), footL = mk(design.foot), footR = mk(design.foot);
  body.add(handL, handR); lean.add(footL, footR);
  const handRest = (s) => new THREE.Vector3(s * (W / 2 + design.handOut * V), design.handY * H, D * 0.08);
  const footRest = (s) => new THREE.Vector3(s * design.footSpread * V, FH / 2, 0);
  // face
  const cell = V * 0.5, fz = D / 2 + cell * 0.25;
  const face = new THREE.Group(); face.position.z = fz; body.add(face);
  const eyeL = spriteSlot(6, 9, cell), eyeR = spriteSlot(6, 9, cell), mouth = spriteSlot(6, 4, cell), blushL = spriteSlot(3, 2, cell), blushR = spriteSlot(3, 2, cell);
  const eyeY = design.face.eyeY * H, eyeX = design.face.eyeX * V;
  [eyeL, eyeR, mouth, blushL, blushR].forEach((s) => face.add(s.mesh));
  blushL.mesh.position.set(-design.face.blushX * V, design.face.blushY * H, -cell * 0.1);
  blushR.mesh.position.set(design.face.blushX * V, design.face.blushY * H, -cell * 0.1);
  mouth.mesh.position.set(0, design.face.mouthY * H, 0);
  const ink = design.face.ink || '#1b1420';
  const eyeColors = { '#': ink, o: '#ffffff' };
  const mouthColors = { '#': design.face.mouth || '#3b1621', r: '#e0607a' };
  // accessory with secondary motion
  const acc = new THREE.Group(); acc.position.y = H; body.add(acc);
  if (design.accessory) {
    const a = buildVoxels(design.accessory.grid, { size: design.accessory.voxel, seed: seed + 3, origin: 'base' }).root;
    a.position.y = design.accessory.y || 0;
    acc.add(a);
  }
  const appendages = (design.appendages || []).map((ap) => {
    const g = new THREE.Group(); g.position.set(...ap.at.map((v) => v * V)); body.add(g);
    const m = buildVoxels(ap.grid, { size: ap.voxel || V, seed: seed + 11, origin: ap.origin || 'base' }).root; g.add(m);
    return { g, ap };
  });
  // anchors (objects whose world position is read after posing)
  const A = {};
  const anchorObj = (name, parent, pos) => { const g = new THREE.Object3D(); g.position.copy(pos); parent.add(g); A[name] = g; };
  anchorObj('center', body, new THREE.Vector3(0, H / 2, 0));
  anchorObj('head', body, new THREE.Vector3(0, H + (design.accessory ? 2.2 : 0.6), 0));
  anchorObj('face', body, new THREE.Vector3(0, eyeY, fz));
  anchorObj('top', acc, new THREE.Vector3(0, (design.accessory?.height || 0) + 0.2, 0));
  anchorObj('feet', root, new THREE.Vector3(0, 0, 0));
  const handsMid = new THREE.Object3D(); body.add(handsMid); A.hands = handsMid;
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  // ---------- motion, gait, clips ----------
  const motion = ctx.motion({ lift: 0, radius: 0, turnRate: design.turnRate ?? 9 });
  const clips = new ClipSet();
  const impulses = []; // { t, amp } secondary-motion kicks for the accessory
  const blinks = [];
  const G = { n: 0, phase: [], speed: [], dt: 1 / 240 };
  const g = design.gait;
  const stepLen = (s) => clamp(g.stepMin + s * g.stepK, g.stepMin, g.stepMax);
  function gaitEnsure(t) {
    const need = Math.ceil(Math.max(0, t) / G.dt) + 2;
    if (G.n >= need) return;
    motion.ensure(t);
    const T = motion.T;
    while (G.n < need && G.n < T.n) {
      const i = G.n;
      if (i === 0) { G.phase.push(0); G.speed.push(0); G.n++; continue; }
      const dx = T.pos[i * 3] - T.pos[(i - 1) * 3], dz = T.pos[i * 3 + 2] - T.pos[(i - 1) * 3 + 2];
      const sRaw = Math.hypot(dx, dz) / G.dt;
      const s = G.speed[i - 1] + (sRaw - G.speed[i - 1]) * (1 - Math.exp(-G.dt * 14)); // smoothed
      G.speed.push(s);
      G.phase.push(G.phase[i - 1] + (T.air[i] || T.carried[i] ? 0 : (s / stepLen(s)) * G.dt));
      G.n++;
    }
  }
  const gaitAt = (t) => {
    gaitEnsure(t);
    const f = Math.max(0, t) / G.dt, i = Math.min(Math.floor(f), G.n - 2), u = f - i;
    return { phase: G.phase[i] + (G.phase[i + 1] - G.phase[i]) * u, speed: G.speed[i] + (G.speed[i + 1] - G.speed[i]) * u };
  };

  /** Locomotion pose (no clips) — also used for the accessory's lagged secondary motion. */
  function basePose(t) {
    const m = motion.sample(t);
    const { phase: p, speed: s } = gaitAt(t);
    const move = smoothstep(1.5, 8, s), sprint = smoothstep(35, 70, s);
    const c = p / 2, L = stepLen(s);
    const fwd = new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
    const accF = m.accel.x * fwd.x + m.accel.z * fwd.z;
    const yawRate = wrapAngle(motion.yawAt(t + 0.03) - motion.yawAt(Math.max(0, t - 0.03))) / 0.06;
    const air = m.airborne;
    const lift = g.lift * (0.7 + 0.6 * sprint) * move;
    const pose = {
      pos: m.pos, yaw: m.yaw, speed: s, airborne: air, carried: m.carried,
      bob: move * g.bob * (1 + sprint) * (1 - Math.abs(Math.cos(Math.PI * p))) + (1 - move) * Math.sin(t * TAU / 2.4) * 0.06,
      squash: -0.06 * move * Math.abs(Math.cos(Math.PI * p)) ** 8 + (1 - move) * Math.sin(t * TAU / 2.4) * 0.012,
      lean: clamp(0.0055 * s + 0.0012 * accF, -0.3, 0.42),
      bank: clamp(yawRate * s * -0.0035, -0.35, 0.35),
      spin: 0, jump: 0, sit: 0, sx: 0,
      footL: [0, Math.max(0, Math.sin(TAU * c)) * lift, -Math.cos(TAU * c) * L / 2 * move],
      footR: [0, Math.max(0, Math.sin(TAU * c + Math.PI)) * lift, -Math.cos(TAU * c + Math.PI) * L / 2 * move],
      handL: [0, Math.abs(Math.sin(TAU * c)) * 0.4 * sprint, Math.cos(TAU * c) * (0.5 + 1.3 * sprint) * move],
      handR: [0, Math.abs(Math.sin(TAU * c)) * 0.4 * sprint, -Math.cos(TAU * c) * (0.5 + 1.3 * sprint) * move],
      lookX: 0, lookY: 0, eyeScale: 0, blush: 0, accX: 0, accZ: 0,
    };
    if (air) {
      const vy = m.vel.y;
      pose.squash += clamp(vy * 0.0035, -0.18, 0.28);
      pose.footL = [0, 0.9, 0.4]; pose.footR = [0, 0.9, 0.4];
      pose.handL = [0, 1.6, 0.4]; pose.handR = [0, 1.6, 0.4];
      pose.lean = clamp(-vy * 0.002, -0.3, 0.3) + 0.1;
    }
    return pose;
  }

  function pose(t) {
    const P = clips.evaluate(t, basePose(t));
    // accessory secondary motion: lags behind lean/bank changes + rings from impacts
    const prev = basePose(Math.max(0, t - 0.09));
    let ax = -(P.lean - prev.lean) * 1.8 - P.lean * 0.25 + P.accX, az = -(P.bank - prev.bank) * 1.8 + P.accZ;
    for (const k of impulses) if (t >= k.t && t < k.t + 1.5) { ax += ring(t - k.t, 3.2, 4.5, k.amp); az += ring(t - k.t, 2.6, 4.5, k.amp * 0.5 * k.side); }
    P.accX = ax; P.accZ = az;
    return P;
  }

  function apply(t, resolve) {
    const P = pose(t);
    root.position.copy(P.pos);
    root.rotation.y = P.yaw + P.spin;
    lean.rotation.set(P.lean, 0, P.bank);
    lean.position.y = P.jump; // in-place jumps lift the whole creature (feet included)
    const sy = 1 + P.squash, k = 1 / Math.sqrt(Math.max(sy, 0.3));
    squashG.scale.set(k * (1 + P.sx), sy, k);
    body.position.set(P.offX || 0, P.bob + P.sit, 0);
    handL.position.copy(handRest(-1)).add(new THREE.Vector3(...P.handL).multiply(new THREE.Vector3(-1, 1, 1)));
    handR.position.copy(handRest(1)).add(new THREE.Vector3(...P.handR));
    handsMid.position.copy(handL.position).add(handR.position).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, 1.2));
    footL.position.copy(footRest(-1)).add(new THREE.Vector3(...P.footL));
    footR.position.copy(footRest(1)).add(new THREE.Vector3(...P.footR));
    acc.rotation.set((design.accessory?.tilt?.[0] || 0) + P.accX, 0, (design.accessory?.tilt?.[1] || 0) + P.accZ);
    for (const { g: ag, ap } of appendages) ag.rotation.set((ap.rest?.[0] || 0) - P.lean * ap.swing + Math.sin(t * 3 + 1) * 0.05 * ap.swing, Math.sin(t * 2.2) * 0.25 * ap.swing + (P.bank * ap.swing), ap.rest?.[2] || 0);
    // face
    let eye = P.face || 'normal';
    if (['normal', 'determined', 'wide'].includes(eye) && blinks.some((b) => t >= b && t < b + 0.12)) eye = 'blink';
    const brow = BROWS[P.brow || (eye === 'determined' ? 'determined' : 'none')] || [];
    if (P.lookAt && resolve) {
      const w = resolve(P.lookAt, t);
      const local = root.worldToLocal(w.clone());
      P.lookX += clamp(Math.atan2(local.x, Math.max(local.z, 0.1)) / 0.9, -1, 1);
      P.lookY += clamp(Math.atan2(local.y - FH - eyeY, Math.hypot(local.x, local.z)) / 0.9, -1, 1);
    }
    const es = 1 + P.eyeScale + (eye === 'wide' ? 0.15 : 0);
    const eyeRows = [...brow.map((r) => r), ...(brow.length ? ['.....'] : []), ...EYES[eye]];
    eyeL.show(eyeRows, eyeColors, { scale: es });
    eyeR.show(eyeRows, eyeColors, { scale: es, mirror: true });
    const lx = clamp(P.lookX, -1.2, 1.2) * cell * 1.1, ly = clamp(P.lookY, -1, 1) * cell * 0.9;
    const browShift = brow.length ? cell * 1.5 * es : 0;
    eyeL.mesh.position.set(-eyeX + lx, eyeY + ly + browShift, 0);
    eyeR.mesh.position.set(eyeX + lx, eyeY + ly + browShift, 0);
    let mo = P.mouth || design.face.rest || 'smile';
    if (mo === 'chew') mo = Math.sin(t * TAU * 4) > 0 ? 'chew' : 'small';
    mouth.show(MOUTHS[mo] || MOUTHS.smile, mouthColors, { scale: 1 });
    mouth.mesh.position.x = lx * 0.5;
    const b = clamp(P.blush);
    blushL.show(b > 0.02 ? ['ppp', 'ppp'] : [], { p: design.face.blush || '#ff7f95' }, { scale: b, sy: 0.7 });
    blushR.show(b > 0.02 ? ['ppp', 'ppp'] : [], { p: design.face.blush || '#ff7f95' }, { scale: b, sy: 0.7 });
    root.updateMatrixWorld(true);
    return P;
  }

  // ---------- actions ----------
  // pose conventions: hand offsets [x, y, z] in cm with +x = outward for both hands; feet +x = right.
  const voice = { pitch: design.voice ?? 1 };
  const add = (c) => clips.add(c);
  const until = (t, p, api, dflt) => (p.until ?? (p.hold ? api.nextOf(HAND_VERBS) : t + (p.dur ?? dflt)));
  const anticipation = (t, depth = 0.16, dur = 0.14) => add({ t0: t - dur, dur, fadeIn: 0.03, fadeOut: 0.02, fn: (u) => ({ squash: -depth * E.inOutSine(u), lean: -0.08 * u }) });
  const landSquash = (t, k = 1) => {
    add({ t0: t, dur: 0.4, fadeIn: 0.005, fadeOut: 0.1, fn: (u) => ({ squash: -0.26 * k * Math.exp(-u * 6) * Math.cos(u * 11) }) });
    impulses.push({ t, amp: 0.35 * k, side: 1 });
  };
  const lazyTarget = (api, spec) => api.point(spec);
  const actions = {
    walk: (t, p, api) => motion.path(t, (p.path || [p.to]).map((q) => lazyTarget(api, q)), p.dur && !p.speed ? { dur: p.dur, ease: p.ease } : { speed: p.speed ?? SPEEDS.walk, ramp: p.ramp ?? 0.25 }),
    run: (t, p, api) => actions.walk(t, { speed: SPEEDS.run, ...p }, api),
    sprint: (t, p, api) => actions.walk(t, { speed: SPEEDS.sprint, ramp: 0.35, ...p }, api),
    chase(t, p, api) {
      const end = p.until ?? api.next();
      motion.follow(t, api.actor(p.target).motion, { gap: p.gap ?? 12, blend: p.blend ?? 0.4, until: end, side: p.side ?? 0 });
      add({ t0: t, dur: end - t, fadeIn: 0.15, fadeOut: 0.2, fn: () => ({ face: 'determined', mouth: 'flat' }) });
    },
    stop: (t, p, api) => motion.hold(t, p.at ? lazyTarget(api, p.at) : undefined),
    turn(t, p, api) {
      const dur = p.dur ?? 0.4;
      motion.face(t, t + dur + (p.hold ?? 0.2), typeof p.to === 'number' ? (p.to * Math.PI) / 180 : lazyTarget(api, p.to));
    },
    look(t, p, api) {
      add({ t0: t, dur: p.dur ?? 1, fadeIn: 0.12, fadeOut: 0.2, fn: () => ({ lookAt: p.at, ...(p.face ? { face: p.face } : {}) }) });
      if (p.turn) actions.turn(t, { to: p.at, dur: 0.35, hold: p.dur ?? 1 }, api);
    },
    face: (t, p) => add({ t0: t, dur: p.dur ?? 1, fadeIn: 0.05, fadeOut: 0.1, hold: !!p.hold, fn: () => ({ ...(p.eyes ? { face: p.eyes } : {}), ...(p.mouth ? { mouth: p.mouth } : {}), ...(p.brow ? { brow: p.brow } : {}) }) }),
    blink: (t) => blinks.push(t),
    smile: (t, p) => add({ t0: t, dur: p.dur ?? 1, fadeIn: 0.05, fadeOut: 0.15, fn: () => ({ face: 'happy', mouth: 'grin' }) }),
    gasp(t, p, api) {
      const dur = p.dur ?? 0.9;
      add({ t0: t, dur, fadeIn: 0.02, fadeOut: 0.25, fn: (u, tl) => ({
        squash: tl < 0.08 ? -0.12 * (tl / 0.08) : 0.14 * Math.exp(-(tl - 0.08) * 7) * Math.cos((tl - 0.08) * 16),
        jump: 1.2 * Math.max(0, Math.sin(Math.min(1, (tl - 0.06) / 0.3) * Math.PI)) * (tl > 0.06 ? 1 : 0),
        lean: -0.15, face: 'wide', mouth: 'o', eyeScale: 0.25, handL: [-0.6, 2.2, 1.2], handR: [-0.6, 2.2, 1.2],
      }) });
      impulses.push({ t: t + 0.08, amp: 0.3, side: 1 });
      api.sfx(t, 'gasp', voice);
    },
    anticipate: (t, p) => add({ t0: t, dur: p.dur ?? 0.3, fadeIn: 0.08, fadeOut: 0.06, fn: (u) => ({ squash: -0.17 * E.outCubic(Math.min(1, u * 2)), lean: -0.12 }) }),
    jump(t, p, api) {
      const h = p.height ?? 4, dur = p.dur ?? 0.38;
      anticipation(t, 0.14, 0.1);
      add({ t0: t, dur, fadeIn: 0.001, fadeOut: 0.001, fn: (u) => ({ jump: 4 * h * u * (1 - u), squash: 0.16 * Math.cos(u * Math.PI), footL: [0, 0.8, 0.3], footR: [0, 0.8, 0.3] }) });
      landSquash(t + dur, 0.7);
      api.sfx(t, 'hop', voice); api.sfx(t + dur, 'land', { gain: 0.6 });
      impulses.push({ t, amp: -0.25, side: -1 });
    },
    hop(t, p, api) {
      const dur = p.dur ?? 0.45;
      anticipation(t, 0.16, 0.12);
      motion.arc(t, lazyTarget(api, p.to), { dur, apex: p.height ?? 5 });
      landSquash(t + dur, 0.8);
      api.sfx(t, 'hop', voice);
      impulses.push({ t, amp: -0.3, side: -1 });
    },
    leap(t, p, api) {
      const dur = p.dur ?? 1.4;
      anticipation(t, 0.22, 0.22);
      motion.arc(t, lazyTarget(api, p.to), { dur, apex: p.height ?? 9, timeEase: p.slow === false ? undefined : slowMo(p.slowK ?? 0.28) });
      add({ t0: t, dur, fadeIn: 0.05, fadeOut: 0.12, fn: (u) => ({ face: 'determined', mouth: 'o', handL: [0.4, 1.2, 3.2 * Math.sin(u * Math.PI)], handR: [-0.4, 1.2, 3.2 * Math.sin(u * Math.PI)], lean: 0.25 * Math.sin(u * Math.PI) }) });
      landSquash(t + dur, 1);
      api.sfx(t, 'whoosh', { dur: dur * 0.9, gain: 0.8 }); api.sfx(t, 'hop', voice);
    },
    land: (t, p) => landSquash(t, p.amount ?? 1),
    skid(t, p, api) {
      const dur = p.dur ?? 0.45;
      add({ t0: t, dur, fadeIn: 0.04, fadeOut: 0.2, fn: (u) => ({ lean: -0.38 * Math.sin(Math.PI * Math.min(1, u * 1.3)), squash: -0.1, footL: [0, 0, 1.6], footR: [0, 0, 1.6], handL: [-0.8, 1.2, -0.5], handR: [-0.8, 1.2, -0.5], face: 'wide', mouth: 'wobbly' }) });
      impulses.push({ t, amp: 0.5, side: 1 });
      api.sfx(t, 'skid', { dur });
      api.fx('burst', { t0: t, at: api.point(api.self + '.feet', t), count: 14, speed: [10, 30], up: 0.6, gravity: 60, voxel: false, colors: ['#e8d2b0'], size: 1.4, life: 0.9, floorY: -1e4, seed: Math.round(t * 100) });
    },
    bonk(t, p, api) {
      const dizzy = p.dizzy ?? 1.3;
      add({ t0: t, dur: 0.35, fadeIn: 0.005, fadeOut: 0.15, fn: (u) => ({ squash: -0.3 * Math.exp(-u * 5), sx: 0.25 * Math.exp(-u * 5), lean: -0.45 * Math.sin(Math.PI * Math.min(1, u * 1.5)), face: 'blink', mouth: 'o' }) });
      add({ t0: t + 0.25, dur: dizzy, fadeIn: 0.08, fadeOut: 0.3, fn: (u, tl) => ({ face: 'dizzy', mouth: 'wobbly', bank: Math.sin(tl * 9) * 0.22 * (1 - u * 0.6), spin: Math.sin(tl * 4.5) * 0.35 * (1 - u), lean: -0.05 }) });
      impulses.push({ t, amp: 0.8, side: 1 });
      if (p.knock !== 0) {
        const k = p.knock ?? 4;
        motion.arc(t + 0.02, () => {
          const a = motion.rawPos(t), b = motion.rawPos(t - 0.06);
          const dir = a.clone().sub(b).setY(0);
          if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
          return a.addScaledVector(dir.normalize(), -k);
        }, { dur: 0.32, apex: 2.5 });
      }
      api.sfx(t, 'bonk', voice);
      api.fx('orbitStars', { t0: t + 0.1, t1: t + 0.25 + dizzy, at: (tt) => inst.anchorAt('head', tt), radius: W * 0.55, height: 0.6, size: V * 0.42, seed: Math.round(t * 10) });
    },
    shake(t, p, api) {
      const dur = p.dur ?? 0.55;
      add({ t0: t, dur, fadeIn: 0.04, fadeOut: 0.12, fn: (u, tl) => ({ spin: Math.sin(tl * TAU * 7) * 0.42 * (1 - u), bank: Math.sin(tl * TAU * 7 + 1) * 0.1, face: 'closed', mouth: 'flat' }) });
      for (let k = 0; k < 4; k++) impulses.push({ t: t + k * 0.12, amp: 0.25, side: k % 2 ? 1 : -1 });
      api.sfx(t, 'shake', { dur, ...voice });
    },
    peek(t, p) {
      const dur = p.dur ?? 1.2, side = p.side ?? 1;
      add({ t0: t, dur, fadeIn: 0.3, fadeOut: 0.3, fn: () => ({ bank: -0.32 * side, offX: 1.2 * side, lookX: 0.3 * side, eyeScale: 0.1 }) });
    },
    sniff(t, p, api) {
      const n = p.count ?? 3;
      add({ t0: t, dur: n * 0.18 + 0.2, fadeIn: 0.05, fadeOut: 0.1, fn: (u, tl) => ({ squash: Math.max(0, Math.sin(tl * TAU * 5.5)) * 0.05, lean: 0.06, face: 'closed', mouth: 'small', lookY: 0.4 }) });
      api.sfx(t, 'sniff', { count: n, ...voice });
    },
    hug(t, p, api) {
      const end = until(t, { hold: true, ...p }, api, 1);
      add({ t0: t, dur: end - t, fadeIn: 0.25, fadeOut: 0.2, fn: () => ({ handL: [-0.6, -0.9, 3.4], handR: [-0.6, -0.9, 3.4] }) });
    },
    catch(t, p, api) {
      const end = until(t, { hold: true, ...p }, api, 1);
      add({ t0: t - 0.15, dur: end - t + 0.15, fadeIn: 0.12, fadeOut: 0.15, fn: (u, tl) => ({ handL: [-0.6, -0.9, 3.4], handR: [-0.6, -0.9, 3.4], lean: tl < 0.4 ? 0.2 * Math.sin(tl / 0.4 * Math.PI) : 0, face: tl < 0.35 ? 'determined' : 'normal' }) });
      landSquash(t, 0.45);
      api.sfx(t, 'catch', {});
    },
    push(t, p, api) {
      const end = until(t, p, api, 0.8);
      add({ t0: t, dur: end - t, fadeIn: 0.15, fadeOut: 0.2, fn: (u, tl) => ({ lean: 0.35, handL: [-0.5, 0.4, 3], handR: [-0.5, 0.4, 3], face: 'determined', squash: Math.sin(tl * 12) * 0.03 }) });
    },
    lift(t, p, api) {
      const end = until(t, { hold: true, ...p }, api, 1.5);
      const up = p.height ?? H * 0.9;
      add({ t0: t, dur: end - t, fadeIn: 0.08, fadeOut: 0.2, fn: (u, tl) => { const k = E.outBack(clamp(tl / (p.rise ?? 0.55))); return { handL: [-0.6 - 0.5 * k, -0.9 + (up + 0.9) * k, 3.4 - 3.0 * k], handR: [-0.6 - 0.5 * k, -0.9 + (up + 0.9) * k, 3.4 - 3.0 * k], squash: 0.08 * k - 0.1 * (1 - clamp(tl / 0.15)), face: 'happy', mouth: 'grin', lookY: 0.6 * k }; } });
      impulses.push({ t: t + 0.2, amp: -0.3, side: 1 });
      api.sfx(t, 'lift', voice);
    },
    cheer(t, p, api) {
      const dur = p.dur ?? 1.0, n = p.jumps ?? 2;
      add({ t0: t, dur, fadeIn: 0.06, fadeOut: 0.2, fn: (u, tl) => { const ph = (tl / dur) * n; const f = ph % 1; return { jump: ph < n ? 3 * 4 * f * (1 - f) : 0, handL: [-0.4, 3.6, 0], handR: [-0.4, 3.6, 0], face: 'happy', mouth: 'laugh', squash: 0.06 * Math.cos(f * TAU) }; } });
      api.sfx(t, 'cheer', voice);
    },
    wave(t, p) {
      const dur = p.dur ?? 1.2;
      add({ t0: t, dur, fadeIn: 0.15, fadeOut: 0.2, fn: (u, tl) => ({ handR: [0.6 + Math.sin(tl * TAU * 3) * 0.8, 3.4, 0.4], bank: 0.06, face: 'happy', mouth: 'grin' }) });
    },
    eat(t, p, api) {
      const dur = p.dur ?? 1.3;
      add({ t0: t, dur, fadeIn: 0.12, fadeOut: 0.2, fn: (u, tl) => ({ handR: [-W / 2 + 0.2, eyeY - design.handY * H - 1.4, D * 0.5 + 0.6], face: tl > 0.25 ? 'happy' : 'normal', mouth: tl > 0.25 ? 'chew' : 'o', squash: tl > 0.25 ? Math.sin(tl * TAU * 4) * 0.02 : 0 }) });
      for (let k = 0; k < 3; k++) api.sfx(t + 0.3 + k * 0.25, 'munch', voice);
    },
    snap(t, p, api) { // snatch something falling out of the air with the mouth (hands stay busy), then chew
      const dur = p.dur ?? 1.2;
      add({ t0: t, dur, fadeIn: 0.06, fadeOut: 0.2, fn: (u, tl) => ({
        lookY: tl < 0.3 ? 0.9 : 0.2, lean: tl < 0.3 ? -0.12 : 0.04, jump: tl < 0.3 ? 1.4 * Math.sin((tl / 0.3) * Math.PI) : 0,
        face: tl < 0.18 ? 'wide' : 'happy', mouth: tl < 0.2 ? 'o' : 'chew', squash: tl > 0.3 ? Math.sin(tl * TAU * 4) * 0.025 : 0 }) });
      api.sfx(t + 0.2, 'pop', { gain: 0.5, pitch: 1.4 });
      for (let k = 0; k < 3; k++) api.sfx(t + 0.38 + k * 0.22, 'munch', voice);
    },
    blush: (t, p) => add({ t0: t, dur: p.dur ?? 1.5, fadeIn: 0.3, fadeOut: 0.4, hold: !!p.hold, fn: () => ({ blush: 1, face: 'happy', mouth: 'smile' }) }),
    laugh(t, p, api) {
      const dur = p.dur ?? 1.0;
      add({ t0: t, dur, fadeIn: 0.05, fadeOut: 0.2, fn: (u, tl) => ({ squash: Math.abs(Math.sin(tl * TAU * 3.2)) * 0.09, lean: -0.12, face: 'closed', mouth: 'laugh', handL: [-0.6, 0.8, 1], handR: [-0.6, 0.8, 1] }) });
      api.sfx(t, 'giggle', { dur, ...voice });
    },
    sit(t, p) {
      add({ t0: t, dur: p.dur ?? 3, hold: p.hold ?? true, fadeIn: 0.25, fadeOut: 0.3, fn: (u, tl) => ({ sit: -FH * 0.85, squash: -0.05 - 0.12 * Math.exp(-tl * 8), footL: [-0.3, 0.2, 1.8], footR: [0.3, 0.2, 1.8] }) });
      impulses.push({ t: t + 0.25, amp: 0.3, side: 1 });
    },
    balance(t, p, api) {
      const dur = p.dur ?? 1.6;
      add({ t0: t, dur, fadeIn: 0.05, fadeOut: 0.3, fn: (u, tl) => ({
        bank: Math.sin(tl * TAU * 1.9) * 0.3 * Math.exp(-tl * 1.6), lean: 0.22 * Math.sin(tl * TAU * 1.3 + 1) * Math.exp(-tl * 1.8),
        footR: [0, 1.4 * (1 - smoothstep(0.7, 1, u)), -0.6], handL: [1.4, 2.0 + Math.sin(tl * 14) * 0.6, 0], handR: [1.4, 2.0 + Math.sin(tl * 14 + 2) * 0.6, 0],
        face: u < 0.6 ? 'wide' : 'happy', mouth: u < 0.6 ? 'wobbly' : 'smile',
      }) });
      for (let k = 0; k < 3; k++) impulses.push({ t: t + k * 0.35, amp: 0.3, side: k % 2 ? 1 : -1 });
      api.sfx(t, 'teeter', { dur });
    },
  };

  // ---------- part instance ----------
  const inst = {
    root, motion, actions,
    bounds: new THREE.Box3(new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(W / 2, FH + H, D / 2)),
    anchors: {},
    anchorAt(name, t) {
      if (!A[name]) return null;
      apply(t);
      return A[name].getWorldPosition(new THREE.Vector3());
    },
    compile({ timeline, duration, obstacles = [] }) {
      // hop over low obstacles crossed while walking/running (anticipation, stretch, landing, sounds)
      const jumps = [];
      const reach = Math.max(W, D) * 0.45;
      for (const ob of obstacles) {
        const box = ob.box.clone().expandByVector(new THREE.Vector3(reach, 0, reach));
        let inside = -1;
        for (let t = 0; t <= duration; t += 1 / 120) {
          const s = motion.sample(t), hit = !s.airborne && !s.carried && box.containsPoint(new THREE.Vector3(s.pos.x, box.min.y, s.pos.z)) && s.speed > 3;
          if (hit && inside < 0) inside = t;
          if (!hit && inside >= 0) { jumps.push({ t0: inside, t1: t, h: ob.box.max.y - ob.box.min.y + 1.8 }); inside = -1; }
        }
      }
      for (const j of jumps) {
        const t0 = j.t0 - 0.06, dur = Math.max(0.3, j.t1 - j.t0 + 0.12);
        anticipation(t0, 0.12, 0.09);
        add({ t0, dur, fadeIn: 0.001, fadeOut: 0.001, fn: (u) => ({ jump: 4 * j.h * u * (1 - u), squash: 0.14 * Math.cos(u * Math.PI), footL: [0, 0.8, 0.4], footR: [0, 0.8, 0.4], handL: [0, 1.4, 0], handR: [0, 1.4, 0] }) });
        landSquash(t0 + dur, 0.6);
        timeline.sfx.push({ t: t0, name: 'hop', params: { ...voice, gain: 0.8 }, from: ctx.name }, { t: t0 + dur, name: 'land', params: { gain: 0.5 }, from: ctx.name });
      }
      // auto blinks every 2–4.5 s (skipped while another face is showing)
      const r = rng(seed + 5);
      for (let t = r.range(0.6, 2); t < duration; t += r.range(2, 4.5)) if (!clips.evaluate(t, {}).face) blinks.push(t);
      // footsteps from the gait: a contact every time the phase crosses an integer (alternating feet)
      gaitEnsure(duration);
      for (let i = 1; i < G.n; i++) {
        const a = G.phase[i - 1], b = G.phase[i];
        const t = i * G.dt;
        if (Math.floor(b) > Math.floor(a) && G.speed[i] > 2 && !jumps.some((j) => t > j.t0 - 0.08 && t < j.t1 + 0.1)) {
          timeline.events.push({ t, type: 'step', actor: ctx.name, foot: Math.floor(b) % 2 ? 'L' : 'R', speed: G.speed[i] });
          timeline.sfx.push({ t, name: 'step', params: { speed: G.speed[i], size: design.stepSize ?? 1, surface: o.surface || 'cloth', foot: Math.floor(b) % 2 }, from: ctx.name });
        }
      }
      for (const e of motion.events) {
        if (e.type === 'land') { landSquash(e.t, e.small ? 0.4 : 0.9); timeline.sfx.push({ t: e.t, name: 'land', params: { gain: e.small ? 0.4 : 0.8 }, from: ctx.name }); }
      }
    },
    update(t, { resolve }) { apply(t, resolve); },
  };
  return inst;
}
