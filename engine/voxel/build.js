// engine/voxel/build.js — VoxelGrid → THREE.Group of InstancedMesh (one per material tag) of chamfered cubes.
//   const { root, meshes } = buildVoxels(grid, { size: 0.8, seed: 3, origin: 'base' });
// Hidden voxels are culled; every visible voxel gets ±jitter colour variation and a baked AO tint from its
// 26-neighbourhood (crevices darker, convex edges slightly brighter). Chamfers make the seams catch light.
import * as THREE from 'three';
import { hash } from '../core/rng.js';
import { voxelMaterial, jitterColor } from '../materials/palette.js';

const geoCache = new Map();

/** Unit cube with chamfered edges (44 triangles) and smoothed bevel normals. */
export function chamferBox(bevel = 0.1) {
  const ck = bevel.toFixed(3);
  if (geoCache.has(ck)) return geoCache.get(ck);
  const h = 0.5, b = bevel, pos = [], nrm = [], idx = [];
  const vid = new Map(); // corner signs + face axis → vertex index
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx, sy, sz]);
  const v = (c, a) => {
    const k = c.join(',') + a;
    if (vid.has(k)) return vid.get(k);
    const p = c.map((s) => s * (h - b)); p[a] = c[a] * h;
    const n = [0, 0, 0]; n[a] = c[a];
    vid.set(k, pos.length / 3); pos.push(...p); nrm.push(...n);
    return vid.get(k);
  };
  const center = (ids) => ids.reduce((acc, i) => [acc[0] + pos[i * 3], acc[1] + pos[i * 3 + 1], acc[2] + pos[i * 3 + 2]], [0, 0, 0]);
  const tri = (a, b2, c) => {
    // orient outward: the triangle normal must point away from the cube centre
    const p = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const n = new THREE.Vector3().subVectors(p(b2), p(a)).cross(new THREE.Vector3().subVectors(p(c), p(a)));
    const m = new THREE.Vector3(...center([a, b2, c]));
    if (n.dot(m) < 0) idx.push(a, c, b2); else idx.push(a, b2, c);
  };
  const quad = (a, b2, c, d) => { tri(a, b2, c); tri(a, c, d); };
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const cs = corners.filter((c) => c[a] === s);
    const [u, w] = [0, 1, 2].filter((i) => i !== a);
    const ord = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sw]) => cs.find((c) => c[u] === su && c[w] === sw));
    quad(...ord.map((c) => v(c, a)));
  }
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const c1 = corners[i], c2 = corners[j];
    const diff = [0, 1, 2].filter((k) => c1[k] !== c2[k]);
    if (diff.length !== 1) continue;
    const [a, bb] = [0, 1, 2].filter((k) => k !== diff[0]);
    quad(v(c1, a), v(c2, a), v(c2, bb), v(c1, bb));
  }
  for (const c of corners) tri(v(c, 0), v(c, 1), v(c, 2));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  // soften: bevel vertices get a normal blended toward the corner diagonal so edges read rounded
  const n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < n.count; i++) {
    const d = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const nn = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)).lerp(d, 0.35).normalize();
    n.setXYZ(i, nn.x, nn.y, nn.z);
  }
  g.computeBoundingSphere();
  geoCache.set(ck, g);
  return g;
}

/**
 * @param grid VoxelGrid
 * @param o.size     world size of one voxel (cm)
 * @param o.origin   'base' (centre x/z, bottom at y=0) | 'center' | 'none' | [x,y,z] voxel-space pivot
 * @param o.jitter   colour variation amount (0.04 = ±4 %)
 * @param o.ao       baked AO strength (0 disables)
 * @param o.aoGrid   grid used for AO neighbour counts (default: grid) — pass the whole object when building a piece of it
 * @param o.bevel    chamfer size as fraction of voxel
 * @param o.materials per-tag material option overrides, e.g. { glow: { emissive: 3 } }
 * @returns { root: Group, meshes: {tag: InstancedMesh}, voxels: {tag: [{x,y,z,color}]}, pivot: Vector3 (voxel space), size }
 */
export function buildVoxels(grid, o = {}) {
  const size = o.size ?? 1, jitter = o.jitter ?? 0.045, aoK = o.ao ?? 1, seed = o.seed ?? 1;
  const { min, max } = grid.bounds();
  let pivot;
  if (Array.isArray(o.origin)) pivot = new THREE.Vector3(...o.origin);
  else if (o.origin === 'none') pivot = new THREE.Vector3(0, 0, 0);
  else if (o.origin === 'center') pivot = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  else pivot = new THREE.Vector3((min[0] + max[0]) / 2, min[1] - 0.5, (min[2] + max[2]) / 2);

  const byTag = {};
  grid.forEach((x, y, z, v) => {
    if (o.cull !== false && grid.hidden(x, y, z)) return;
    (byTag[v.tag] ||= []).push({ x, y, z, color: v.color });
  });
  const root = new THREE.Group();
  const meshes = {};
  const geo = chamferBox(o.bevel ?? 0.12);
  const M = new THREE.Matrix4(), col = new THREE.Color();
  for (const [tag, list] of Object.entries(byTag)) {
    const mesh = new THREE.InstancedMesh(geo, voxelMaterial(tag, (o.materials || {})[tag]), list.length);
    list.forEach((vx, i) => {
      M.makeScale(size, size, size).setPosition((vx.x - pivot.x) * size, (vx.y - pivot.y) * size, (vx.z - pivot.z) * size);
      mesh.setMatrixAt(i, M);
      jitterColor(vx.color, hash(vx.x, vx.y, vx.z, seed), jitter, col);
      if (aoK > 0) {
        const n = (o.aoGrid || grid).neighbours26(vx.x, vx.y, vx.z);
        const ao = n > 17 ? 1 - Math.min(0.42, (n - 17) * 0.05) * aoK : 1 + (17 - n) * 0.008 * aoK;
        col.multiplyScalar(ao);
      }
      mesh.setColorAt(i, col);
    });
    mesh.castShadow = o.castShadow ?? true;
    mesh.receiveShadow = o.receiveShadow ?? true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = `voxels:${tag}`;
    root.add(mesh);
    meshes[tag] = mesh;
  }
  return { root, meshes, voxels: byTag, pivot, size };
}

/** Local-space position (cm) of a voxel coordinate in a model built with `pivot`/`size`. */
export const voxelToLocal = (x, y, z, pivot, size) => new THREE.Vector3((x - pivot.x) * size, (y - pivot.y) * size, (z - pivot.z) * size);
