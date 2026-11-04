// engine/fx/particles.js — stateless particle emitters: every particle is a pure function of t (no simulation).
//   steam({ at, rate, life, rise, spread, size })          soft sprites rising and curling (optionally sun-lit)
//   dust({ box, count })                                    motes drifting in a volume, glittering only in sunbeams
//   burst({ t0, at, count, speed, gravity, floorY, voxel }) ballistic burst with floor bounces (voxel cubes or sprites)
//   sparkles({ t0, t1, at, radius, count })                twinkling star glints
//   orbitStars({ t0, t1, at: (t) => Vector3, count })      cartoon "dizzy" voxel stars circling a point
//   confetti({ t0, at, count, colors })                     fluttering voxel flakes
// Each returns { object: THREE.Object3D, update(t, ctx) }. The stage adds them to the scene and calls update.
import * as THREE from 'three';
import { hash } from '../core/rng.js';
import { noise1, smoothstep, clamp, TAU } from '../core/math.js';
import { ballisticFloor } from '../anim/physics-fake.js';
import { canvasTexture } from '../materials/procedural-textures.js';
import { SUNLIT_GLSL, sunUniforms } from './lightshafts.js';
import { chamferBox } from '../voxel/build.js';
import { voxelMaterial } from '../materials/palette.js';

const V3 = (p) => (p && p.isVector3 ? p : new THREE.Vector3(...(p || [0, 0, 0])));
const pointAt = (at, t) => (typeof at === 'function' ? at(t) : V3(at));

function softSprite(kind) {
  return canvasTexture(128, 128, (g, w) => {
    if (kind === 'star') {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(62, 4, 4, 120); g.fillRect(4, 62, 120, 4);
      return;
    }
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    const soft = kind === 'puff';
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(soft ? 0.35 : 0.25, `rgba(255,255,255,${soft ? 0.55 : 0.8})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, { key: 'sprite-' + kind, srgb: false, wrap: THREE.ClampToEdgeWrapping });
}

/** Points renderer shared by sprite emitters. */
function spritePoints(count, { sprite = 'puff', blending = 'normal', sunlit = false, sunBoost = 3 } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
    defines: sunlit ? { SUNLIT: 1 } : {},
    uniforms: { map: { value: softSprite(sprite) }, pointScale: { value: 500 }, sunBoost: { value: sunBoost }, ...sunUniforms() },
    vertexShader: /* glsl */ `
      attribute float size; attribute float alpha; attribute vec3 color;
      uniform float pointScale, sunBoost; varying float vA; varying vec3 vC;
      ${SUNLIT_GLSL}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(size * pointScale / -mv.z, 512.0);
        float lit = 1.0;
        #ifdef SUNLIT
          lit = 0.25 + sunBoost * sunVisibility((modelMatrix * vec4(position, 1.0)).xyz);
        #endif
        vA = alpha; vC = color * lit;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying float vA; varying vec3 vC;
      void main() { float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.002) discard; gl_FragColor = vec4(vC, a); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 10;
  pts.userData.sunlit = sunlit;
  return pts;
}

function writeSprite(pts, i, p, size, alpha, color) {
  const a = pts.geometry.attributes;
  a.position.setXYZ(i, p.x, p.y, p.z); a.size.setX(i, size); a.alpha.setX(i, alpha); a.color.setXYZ(i, color.r, color.g, color.b);
}
function flush(pts) { for (const k of ['position', 'size', 'alpha', 'color']) pts.geometry.attributes[k].needsUpdate = true; }

/** Rising steam / smoke. `at` may be a function of t. Births run from t = -life so the plume is already flowing at 0. */
export function steam({ at, rate = 14, life = 2.6, rise = 9, spread = 1.6, curl = 3.5, size = [1.5, 7], opacity = 0.16, color = '#ffffff', seed = 1, t0 = -Infinity, t1 = Infinity, sunlit = true, wind = [0.6, 0, 0] } = {}) {
  const pool = Math.ceil(rate * life) + 2;
  const pts = spritePoints(pool, { sprite: 'puff', sunlit, sunBoost: 2.5 });
  const col = new THREE.Color(color), p = new THREE.Vector3(), w = V3(wind);
  return {
    object: pts,
    update(t) {
      for (let j = 0; j < pool; j++) {
        const n = Math.floor((t * rate - j) / pool) * pool + j;
        const birth = n / rate, age = t - birth;
        if (age < 0 || age > life || birth < t0 || birth > t1) { writeSprite(pts, j, p.set(0, -1e5, 0), 0, 0, col); continue; }
        const k = age / life, h1 = hash(n, seed), h2 = hash(n, seed, 7);
        const base = pointAt(at, birth);
        const y = rise * (age - 0.25 * age * age / life);
        const sx = noise1(age * 0.9 + h1 * 37, seed) * curl * k + (h1 - 0.5) * spread;
        const sz = noise1(age * 0.9 + h2 * 37, seed + 9) * curl * k + (h2 - 0.5) * spread;
        p.set(base.x + sx + w.x * age, base.y + y, base.z + sz + w.z * age);
        const a = smoothstep(0, 0.18, k) * (1 - smoothstep(0.45, 1, k)) * opacity * (0.7 + 0.6 * h2);
        writeSprite(pts, j, p, size[0] + (size[1] - size[0]) * Math.sqrt(k), a, col);
      }
      flush(pts);
    },
  };
}

/** Dust motes in a box drifting slowly (wrap-around); with sunlit they only glitter inside light shafts. */
export function dust({ box = [[-50, 0, -50], [50, 60, 50]], count = 300, size = 0.35, drift = 2.5, opacity = 0.8, color = '#fff2d8', seed = 3, sunlit = true } = {}) {
  const pts = spritePoints(count, { sprite: 'dot', blending: 'add', sunlit, sunBoost: 1 });
  const lo = V3(box[0]), hi = V3(box[1]), ext = hi.clone().sub(lo), col = new THREE.Color(color), p = new THREE.Vector3();
  const wrap = (x, a, e) => a + (((x - a) % e) + e) % e;
  return {
    object: pts,
    update(t) {
      for (let i = 0; i < count; i++) {
        const hx = hash(i, seed, 1), hy = hash(i, seed, 2), hz = hash(i, seed, 3), hs = hash(i, seed, 4);
        p.set(
          wrap(lo.x + hx * ext.x + noise1(t * 0.15 + i, seed) * drift * 4 + t * 0.6, lo.x, ext.x),
          wrap(lo.y + hy * ext.y + noise1(t * 0.12 + i * 1.7, seed + 1) * drift * 3 - t * 0.25, lo.y, ext.y),
          wrap(lo.z + hz * ext.z + noise1(t * 0.15 + i * 2.3, seed + 2) * drift * 4, lo.z, ext.z));
        const tw = 0.55 + 0.45 * Math.sin(t * (2 + hs * 4) + hs * 40);
        writeSprite(pts, i, p, size * (0.5 + hs), opacity * tw, col);
      }
      flush(pts);
    },
  };
}

/** Instanced voxel cubes for voxel-mode particles. */
function voxelSwarm(count, { tag = 'glow', emissive = 2 } = {}) {
  const mesh = new THREE.InstancedMesh(chamferBox(0.16), voxelMaterial(tag, { emissive }), count);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < count; i++) mesh.setColorAt(i, new THREE.Color(1, 1, 1));
  return mesh;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

/** Ballistic burst. speed [min,max] cm/s, up: upward bias 0..1, gravity cm/s². voxel: true → glowing cubes. */
export function burst({ t0 = 0, at = [0, 0, 0], count = 60, speed = [40, 120], up = 0.7, gravity = 600, floorY = 0, floor = null, life = 6, size = 0.7, colors = ['#c3102f', '#e0213f', '#ff4d6d'], voxel = true, emissive = 1.6, restitution = 0.35, seed = 11, spin = 8, sunlit = false } = {}) {
  const cols = colors.map((c) => new THREE.Color(c));
  const obj = voxel ? voxelSwarm(count, { emissive }) : spritePoints(count, { sprite: 'dot', blending: 'add', sunlit });
  if (voxel) for (let i = 0; i < count; i++) obj.setColorAt(i, cols[Math.floor(hash(i, seed, 9) * cols.length)]);
  const p0 = new THREE.Vector3(), v0 = new THREE.Vector3(), out = new THREE.Vector3();
  return {
    object: obj,
    update(t) {
      const tt = t - t0;
      const base = pointAt(at, t0);
      for (let i = 0; i < count; i++) {
        const h1 = hash(i, seed, 1), h2 = hash(i, seed, 2), h3 = hash(i, seed, 3), h4 = hash(i, seed, 4);
        const visible = tt >= 0 && tt < life;
        const sp = speed[0] + (speed[1] - speed[0]) * h1;
        const az = h2 * TAU, el = Math.asin(clamp(up + (1 - up) * (h3 * 2 - 1), -1, 1));
        v0.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(sp);
        p0.copy(base).addScaledVector(v0, 0.004);
        const fy = floor ? floor(p0.x + v0.x * 0.3, p0.z + v0.z * 0.3) : floorY;
        const { pos, bounces } = ballisticFloor(p0, v0, gravity, Math.max(0, tt), fy + size * 0.5, restitution, 0.55, out);
        const k = visible ? 1 - smoothstep(life * 0.7, life, tt) : 0;
        const sc = size * (0.6 + 0.6 * h4) * k * smoothstep(0, 0.06, tt);
        if (voxel) {
          const spinK = bounces ? 0.3 : 1;
          _e.set(tt * spin * (h1 - 0.5) * spinK, tt * spin * (h2 - 0.5) * spinK, tt * spin * (h3 - 0.5) * spinK);
          _m.compose(pos, _q.setFromEuler(_e), _s.setScalar(Math.max(sc, 1e-4)));
          obj.setMatrixAt(i, _m);
        } else writeSprite(obj, i, pos, sc * 3, k, cols[i % cols.length]);
      }
      if (voxel) obj.instanceMatrix.needsUpdate = true; else flush(obj);
    },
  };
}

/** Twinkling glints scattered around a point during [t0, t1]. */
export function sparkles({ t0 = 0, t1 = 1, at = [0, 0, 0], radius = 8, count = 24, size = 1.6, color = '#fff6d0', seed = 5, rise = 3 } = {}) {
  const pts = spritePoints(count, { sprite: 'star', blending: 'add' });
  const col = new THREE.Color(color), p = new THREE.Vector3();
  return {
    object: pts,
    update(t) {
      const c = pointAt(at, t);
      for (let i = 0; i < count; i++) {
        const h = [1, 2, 3, 4, 5].map((k) => hash(i, seed, k));
        const life = 0.5 + h[3] * 0.6, period = life + h[4] * 0.8;
        const local = t - t0 - h[4] * period;
        const k = ((local % period) + period) % period / life;
        const on = t >= t0 && t <= t1 && local >= 0 && k <= 1;
        p.set(c.x + (h[0] - 0.5) * 2 * radius, c.y + (h[1] - 0.2) * radius + k * rise, c.z + (h[2] - 0.5) * 2 * radius);
        writeSprite(pts, i, p, size * Math.sin(Math.PI * Math.min(k, 1)) * (0.6 + h[3]), on ? 1 : 0, col);
      }
      flush(pts);
    },
  };
}

/** Five-pointed voxel stars orbiting a (moving) point — cartoon dizziness. */
export function orbitStars({ t0 = 0, t1 = 2, at, count = 5, radius = 6, height = 0, size = 0.55, speed = 1.6, color = '#ffd84a', seed = 2 } = {}) {
  // each star = 5 small cubes in a plus/star shape
  const shape = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const mesh = voxelSwarm(count * shape.length, { emissive: 1.4 });
  const col = new THREE.Color(color);
  for (let i = 0; i < count * shape.length; i++) mesh.setColorAt(i, col);
  const pos = new THREE.Vector3();
  return {
    object: mesh,
    update(t) {
      const c = at(t);
      const vis = smoothstep(t0, t0 + 0.15, t) * (1 - smoothstep(t1 - 0.3, t1, t));
      for (let s = 0; s < count; s++) {
        const a = (s / count) * TAU + (t - t0) * speed * TAU;
        const bob = Math.sin(a * 2 + seed) * 0.8;
        pos.set(c.x + Math.cos(a) * radius, c.y + height + bob, c.z + Math.sin(a) * radius * 0.75);
        _q.setFromEuler(_e.set(0, -a, Math.sin((t - t0) * 9 + s) * 0.5));
        shape.forEach(([dx, dy], k) => {
          const o = new THREE.Vector3(dx * size, dy * size, 0).applyQuaternion(_q);
          _m.compose(o.add(pos), _q, _s.setScalar(Math.max(size * vis, 1e-4)));
          mesh.setMatrixAt(s * shape.length + k, _m);
        });
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Confetti: flat voxel flakes that pop up and flutter down. */
export function confetti({ t0 = 0, at = [0, 0, 0], count = 80, colors = ['#f2b632', '#c3102f', '#1f6fbf', '#2c9a5b', '#ffffff'], speed = [60, 140], gravity = 220, floorY = 0, life = 5, size = 0.9, seed = 17 } = {}) {
  const cols = colors.map((c) => new THREE.Color(c));
  const mesh = voxelSwarm(count, { tag: 'base' });
  for (let i = 0; i < count; i++) mesh.setColorAt(i, cols[i % cols.length]);
  const p = new THREE.Vector3();
  return {
    object: mesh,
    update(t) {
      const tt = Math.max(0, t - t0), base = pointAt(at, t0);
      for (let i = 0; i < count; i++) {
        const h = [1, 2, 3, 4].map((k) => hash(i, seed, k));
        const sp = speed[0] + (speed[1] - speed[0]) * h[0], az = h[1] * TAU;
        const vy = sp * (0.7 + 0.3 * h[2]), vh = sp * 0.35;
        const drag = 2.2, s = (1 - Math.exp(-drag * tt)) / drag; // velocity decays: flutter
        const yv = vy * s - (gravity / drag) * (tt - s);
        p.set(base.x + Math.cos(az) * vh * s + Math.sin(tt * 6 + h[3] * 9) * 1.5, Math.max(floorY + 0.1, base.y + yv), base.z + Math.sin(az) * vh * s);
        const vis = t >= t0 && tt < life ? 1 - smoothstep(life * 0.7, life, tt) : 0;
        _q.setFromEuler(_e.set(tt * 7 * h[1], tt * 5 * h[2], tt * 6 * h[3]));
        _m.compose(p, _q, _s.set(size * vis + 1e-4, size * 0.18 * vis + 1e-4, size * 0.7 * vis + 1e-4));
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
