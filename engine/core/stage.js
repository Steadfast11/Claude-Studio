// engine/core/stage.js — builds a film description into a live scene and a timeline; renders any time t.
//   const stage = await createStage(filmDesc, { renderer, quality, width, height });
//   stage.seek(t)        // pure: renders exactly time t
//   stage.timeline       // { events, sfx, markers, shots } — read by the audio engine
// Responsibilities: build parts (set → light → props → cast) with a ctx, place them, resolve anchors,
// compile the action list into motions/clips/events, run the camera director and drive the post stack.
import * as THREE from 'three';
import { toSpec } from './registry.js';
import { rng, seedOf } from './rng.js';
import { Motion } from '../anim/motion.js';
import { keyframes } from '../anim/tracks.js';
import { makeRig, lensToFov } from '../camera/rigs.js';
import { makeFocus } from '../camera/focus.js';
import * as particles from '../fx/particles.js';
import { bindSunUniforms } from '../fx/lightshafts.js';
import { titleCard, loadFonts } from '../fx/text.js';
import { Composer } from '../post/composer.js';
import { proceduralEnvironment } from './renderer.js';

const AUTO_ANCHORS = ['center', 'top', 'base', 'front', 'back', 'left', 'right'];

export async function createStage(desc, { renderer, quality, width = 1920, height = 1080 }) {
  await loadFonts();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.5, 8000);
  const instances = new Map();
  const fx = [];
  const timeline = { duration: desc.duration, fps: desc.fps, events: [], sfx: [...(desc.sfx || [])], markers: { ...(desc.markers || {}) }, shots: desc.shots || [], actors: {} };
  let surfaceFn = () => 0;
  const surface = (x, z) => surfaceFn(x, z);

  // ---------- anchors ----------
  function autoAnchor(box, which) {
    const c = box.getCenter(new THREE.Vector3());
    switch (which) {
      case 'top': return new THREE.Vector3(c.x, box.max.y, c.z);
      case 'base': return new THREE.Vector3(c.x, box.min.y, c.z);
      case 'front': return new THREE.Vector3(c.x, box.min.y, box.max.z);
      case 'back': return new THREE.Vector3(c.x, box.min.y, box.min.z);
      case 'left': return new THREE.Vector3(box.min.x, box.min.y, c.z);
      case 'right': return new THREE.Vector3(box.max.x, box.min.y, c.z);
      default: return c;
    }
  }
  function anchorOf(inst, a, t) {
    if (inst.anchorAt) { const r = inst.anchorAt(a, t); if (r) return r; }
    const loc = inst.anchors?.[a];
    if (typeof loc === 'function') return loc(t);
    if (inst.motion) {
      const s = inst.motion.sample(t);
      const off = loc ? loc.clone() : AUTO_ANCHORS.includes(a) ? autoAnchor(inst.bounds, a) : null;
      if (!off) throw new Error(`Unknown anchor "${inst.name}.${a}"`);
      return off.applyAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw).add(s.pos);
    }
    if (loc) return loc.clone().applyMatrix4(inst.root.matrixWorld);
    if (AUTO_ANCHORS.includes(a)) return autoAnchor(inst.worldBox, a);
    throw new Error(`Unknown anchor "${inst.name}.${a}". Has: ${Object.keys(inst.anchors || {}).concat(AUTO_ANCHORS).join(', ')}`);
  }
  /** Resolve a point spec at time t → world Vector3. */
  function resolve(spec, t = 0) {
    if (spec === undefined || spec === null) throw new Error('resolve: empty point');
    if (spec.isVector3) return spec.clone();
    if (typeof spec === 'function') return spec(t).clone();
    if (Array.isArray(spec)) return spec.length === 2 ? new THREE.Vector3(spec[0], surface(spec[0], spec[1]), spec[1]) : new THREE.Vector3(...spec);
    if (typeof spec === 'string') {
      const [n, ...rest] = spec.split('.');
      const inst = instances.get(n);
      if (!inst) throw new Error(`Unknown instance "${n}" in "${spec}". Known: ${[...instances.keys()].join(', ')}`);
      return anchorOf(inst, rest.join('.') || 'center', t);
    }
    if (typeof spec === 'object') {
      const p = resolve(spec.at, t);
      if (spec.offset) p.add(new THREE.Vector3(...spec.offset));
      p.x += spec.dx || 0; p.y += spec.dy || 0; p.z += spec.dz || 0;
      if (spec.ground) p.y = surface(p.x, p.z) + (spec.dy || 0);
      return p;
    }
    throw new Error('resolve: bad point ' + JSON.stringify(spec));
  }

  /** A memoised point resolved on first use (never during action compilation, so motions are not baked early). */
  const lazy = (spec, t = 0) => { let v = null; return () => (v ||= resolve(spec, t)).clone(); };

  // ---------- building parts ----------
  const addFx = (kind, params = {}) => {
    const f = particles[kind];
    if (!f) throw new Error(`Unknown fx "${kind}". Known: ${Object.keys(particles).join(', ')}`);
    const p = { ...params };
    if (p.at !== undefined && typeof p.at !== 'function') p.at = p.follow ? ((spec) => (t) => resolve(spec, t))(p.at) : lazy(p.at, p.t0 ?? 0);
    if (p.floor === 'surface') p.floor = surface;
    const e = f(p);
    scene.add(e.object);
    fx.push(e);
    return e;
  };
  function makeCtx(name) {
    const seed = seedOf(name, desc.seed ?? 1);
    return {
      THREE, name, seed, rng: rng(seed), quality, duration: desc.duration, fps: desc.fps,
      surface, resolve, fx: addFx, scene,
      instance: (n) => instances.get(n),
      motion: (o = {}) => new Motion({ name, ground: surface, ...o }),
      build: (spec, childName, place) => buildPart(toSpec(spec), childName, place),
    };
  }
  function place(inst, pl) {
    const root = inst.root;
    if (pl) {
      let pos;
      if (pl.pos) pos = resolve(pl.pos);
      else if (pl.on) pos = resolve(pl.on);
      else pos = resolve([pl.x ?? 0, pl.z ?? 0]);
      pos.x += pl.dx || 0; pos.y += pl.dy || 0; pos.z += pl.dz || 0;
      root.position.copy(pos);
      if (pl.rot) root.rotation.y = (pl.rot * Math.PI) / 180;
      if (pl.tilt) root.rotation.x = (pl.tilt * Math.PI) / 180;
    }
    root.updateMatrixWorld(true);
    inst.worldBox = new THREE.Box3().setFromObject(root);
    if (inst.motion) { inst.motion.start.copy(root.position); inst.motion.yaw0 = root.rotation.y; }
  }
  function buildPart(spec, name, placement) {
    if (instances.has(name)) throw new Error(`Duplicate instance name "${name}"`);
    const ctx = makeCtx(name);
    const out = spec.def.build(spec.opts, ctx) || {};
    const inst = { name, spec, kind: spec.kind, root: out.root || new THREE.Group(), ...out };
    inst.root.name = name;
    inst.bounds = out.bounds || new THREE.Box3().setFromObject(inst.root);
    scene.add(inst.root);
    instances.set(name, inst);
    place(inst, placement || spec.place);
    return inst;
  }

  const setInst = desc.set ? buildPart(toSpec(desc.set), 'set') : null;
  if (setInst?.surface) surfaceFn = setInst.surface;
  const lightInst = desc.light ? buildPart(toSpec(desc.light), 'light') : null;
  for (const [n, s] of Object.entries(desc.props || {})) buildPart(toSpec(s), n);
  for (const [n, s] of Object.entries(desc.cast || {})) { const i = buildPart(toSpec(s), n); timeline.actors[n] = i; }

  // environment (image-based ambient) from the light rig
  if (lightInst?.environment) {
    scene.environment = proceduralEnvironment(renderer, lightInst.environment);
    scene.environmentIntensity = lightInst.environment.strength ?? 1;
  }
  scene.background = new THREE.Color(lightInst?.background || '#000000');

  // ---------- actions ----------
  const actions = [...(desc.action || [])].sort((a, b) => a.t - b.t);
  for (const a of actions) {
    const [target, verb] = a.what.split('.');
    const api = {
      t: a.t, self: target, resolve, surface,
      /** lazy point: returns () => Vector3, safe to pass into motions */
      point: (spec, t = a.t) => lazy(spec, t),
      actor: (n) => { const i = instances.get(n); if (!i) throw new Error(`Unknown actor "${n}"`); return i; },
      sfx: (t, name, params = {}) => timeline.sfx.push({ t, name, params, from: target }),
      event: (t, type, data = {}) => timeline.events.push({ t, type, actor: target, ...data }),
      fx: addFx,
      /** time of the next action on the same target (default end of a continuous action) */
      next: () => actions.find((b) => b.t > a.t && b.what.split('.')[0] === target)?.t ?? desc.duration,
    };
    if (target === 'fx') { addFx(verb, { t0: a.t, ...a.params }); continue; }
    const inst = instances.get(target);
    if (!inst) throw new Error(`Action "${a.what}": unknown target "${target}"`);
    const fn = inst.actions?.[verb];
    if (!fn) throw new Error(`Action "${a.what}": ${target} has no "${verb}". Has: ${Object.keys(inst.actions || {}).join(', ')}`);
    fn(a.t, a.params || {}, api);
  }
  // let parts finish compiling (bake gaits, collect footsteps, etc.)
  for (const inst of instances.values()) {
    if (inst.motion) { inst.motion.segs.forEach((_, i) => inst.motion._build(i)); timeline.events.push(...inst.motion.events); }
    inst.compile?.({ timeline, duration: desc.duration, resolve });
  }
  timeline.events.sort((a, b) => a.t - b.t);
  timeline.sfx.sort((a, b) => a.t - b.t);

  // ---------- camera ----------
  const views = { ...(setInst?.views || {}), ...(desc.views || {}) };
  const shots = (desc.shots || []).map((s) => ({ ...s, cam: makeRig(s, resolve, views), focusFn: makeFocus(s, resolve) }));
  const shotAt = (t) => { let s = shots[0]; for (const x of shots) if (x.t0 <= t + 1e-9) s = x; return s; };

  // ---------- title overlay ----------
  const title = desc.titleCard ? titleCard(desc.titleCard) : null;
  if (title) { title.camera.aspect = width / height; title.camera.updateProjectionMatrix(); }

  // ---------- post ----------
  const composer = new Composer(renderer, { width, height, quality });
  const post = desc.post || {};
  const kf = (v) => (Array.isArray(v) && Array.isArray(v[0]) ? keyframes(v) : () => v);
  const gradeTracks = Object.fromEntries(Object.entries({ ...(lightInst?.grade || {}), ...(post.grade || {}) }).map(([k, v]) => [k, Array.isArray(v) && Array.isArray(v[0]) ? keyframes(v) : () => v]));
  const letterbox = kf(post.letterbox ?? 0), fade = kf(post.fade ?? 0), exposure = kf(post.exposure ?? 1);
  const sunlitMats = [];
  scene.traverse((o) => { if (o.material?.uniforms?.tSunShadow) sunlitMats.push(o.material); });
  fx.forEach((e) => { const m = e.object.material; if (m?.uniforms?.tSunShadow && !sunlitMats.includes(m)) sunlitMats.push(m); });
  const sun = lightInst?.sun;
  if (sun) {
    // warm-up: create the shadow map before any material samples it (avoids an unbound shadow sampler on frame 1)
    sun.shadow.updateMatrices(sun);
    const tmp = new THREE.WebGLRenderTarget(4, 4);
    renderer.setRenderTarget(tmp); renderer.render(scene, camera); renderer.setRenderTarget(null); tmp.dispose();
  }
  const toggles = { post: true, dof: true, ao: true, shafts: true };

  function seek(t) {
    for (const inst of instances.values()) inst.update?.(t, { camera, resolve });
    for (const e of fx) e.update(t);
    const shot = shotAt(t);
    if (shot) {
      const c = shot.cam(t);
      camera.position.copy(c.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(c.look);
      if (c.roll) camera.rotateZ(c.roll);
      camera.fov = lensToFov(c.lens, width / height);
      camera.updateProjectionMatrix();
      camera.userData.lens = c.lens;
    }
    camera.updateMatrixWorld(true);
    if (sun) {
      sun.shadow.updateMatrices(sun);
      for (const m of sunlitMats) bindSunUniforms(m.uniforms, sun);
    }
    const pointScale = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const e of fx) if (e.object.material?.uniforms?.pointScale) e.object.material.uniforms.pointScale.value = pointScale;
    title?.update(t);
    const grade = Object.fromEntries(Object.entries(gradeTracks).map(([k, f]) => [k, f(t)]));
    grade.letterbox = letterbox(t); grade.fade = fade(t); grade.exposure = (grade.exposure ?? 1) * exposure(t);
    Object.assign(grade, shot?.grade || {});
    const focus = shot?.focusFn ? shot.focusFn(t, camera.position) : 100;
    const params = {
      time: t,
      dof: { on: toggles.dof && shot?.dof !== false, focus, fstop: shot?.fstop ?? 2.8, focal: camera.userData.lens ?? 50, maxCoc: shot?.maxCoc ?? 22, scale: shot?.dofScale ?? 1 },
      shafts: { ...(lightInst?.shafts || {}), on: toggles.shafts && !!lightInst?.shafts, light: sun },
      ao: { on: toggles.ao, ...(lightInst?.ao || {}) },
      bloom: lightInst?.bloom || {},
      grade,
      overlay: title && t >= title.t0 ? { scene: title.scene, camera: title.camera } : null,
    };
    if (toggles.post) composer.render(scene, camera, params);
    else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  }

  return { scene, camera, instances, timeline, resolve, seek, composer, toggles, duration: desc.duration, fps: desc.fps || 60, desc, shotAt, shots };
}
