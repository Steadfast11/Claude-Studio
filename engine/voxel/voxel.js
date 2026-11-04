// engine/voxel/voxel.js — sparse voxel grid model (integer coords, colour + material tag per voxel).
//   const g = new VoxelGrid();  g.set(x, y, z, '#4fb8a8');  g.set(x, y, z, 0xff0000, 'glow');
//   g.bounds() → { min:[x,y,z], max:[x,y,z] }      g.forEach((x, y, z, v) => ...)
// Colours are stored as 0xRRGGBB integers; `tag` selects the material at build time ('base', 'glow', 'gloss', ...).
import * as THREE from 'three';

const K = 1024, OFF = 512;
const key = (x, y, z) => ((x + OFF) * K + (y + OFF)) * K + (z + OFF);
const unkey = (k) => [Math.floor(k / (K * K)) - OFF, (Math.floor(k / K) % K) - OFF, (k % K) - OFF];
const toInt = (c) => (typeof c === 'number' ? c : new THREE.Color(c).getHex());

export class VoxelGrid {
  constructor() { this.map = new Map(); }
  set(x, y, z, color, tag = 'base') { this.map.set(key(x, y, z), { color: toInt(color), tag }); return this; }
  get(x, y, z) { return this.map.get(key(x, y, z)); }
  has(x, y, z) { return this.map.has(key(x, y, z)); }
  delete(x, y, z) { this.map.delete(key(x, y, z)); return this; }
  get size() { return this.map.size; }
  forEach(fn) { for (const [k, v] of this.map) { const [x, y, z] = unkey(k); fn(x, y, z, v); } }
  /** Recolour / retag in place: fn(x,y,z,v) returns {color?, tag?} | null (delete) | undefined (keep). */
  paint(fn) {
    for (const [k, v] of [...this.map]) {
      const [x, y, z] = unkey(k);
      const r = fn(x, y, z, v);
      if (r === null) this.map.delete(k);
      else if (r) this.map.set(k, { color: r.color !== undefined ? toInt(r.color) : v.color, tag: r.tag ?? v.tag });
    }
    return this;
  }
  /** Keep only voxels for which fn(x,y,z,v) is true → new grid. */
  filter(fn) { const g = new VoxelGrid(); this.forEach((x, y, z, v) => fn(x, y, z, v) && g.map.set(key(x, y, z), v)); return g; }
  merge(other, dx = 0, dy = 0, dz = 0) { other.forEach((x, y, z, v) => this.map.set(key(x + dx, y + dy, z + dz), v)); return this; }
  clone() { const g = new VoxelGrid(); g.map = new Map(this.map); return g; }
  bounds() {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    this.forEach((x, y, z) => { min[0] = Math.min(min[0], x); min[1] = Math.min(min[1], y); min[2] = Math.min(min[2], z); max[0] = Math.max(max[0], x); max[1] = Math.max(max[1], y); max[2] = Math.max(max[2], z); });
    return { min, max };
  }
  /** Number of the 26 neighbours that are filled (used for baked ambient occlusion). */
  neighbours26(x, y, z) {
    let n = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) if ((i || j || k) && this.has(x + i, y + j, z + k)) n++;
    return n;
  }
  /** True if all 6 face neighbours are filled (voxel can never be seen). */
  hidden(x, y, z) {
    return this.has(x + 1, y, z) && this.has(x - 1, y, z) && this.has(x, y + 1, z) && this.has(x, y - 1, z) && this.has(x, y, z + 1) && this.has(x, y, z - 1);
  }
}

/** Build a grid from ASCII art: layers[i] is the horizontal slice at y = y0 + i; within a slice, row index = z, char index = x.
 *  legend maps a char → colour (or { color, tag }); chars missing from the legend are empty. */
export function fromLayers(layers, legend, { y0 = 0, x0 = 0, z0 = 0 } = {}) {
  const g = new VoxelGrid();
  layers.forEach((rows, i) => rows.forEach((row, zi) => [...row].forEach((ch, xi) => {
    const v = legend[ch];
    if (v === undefined) return;
    const c = typeof v === 'object' ? v : { color: v };
    g.set(x0 + xi, y0 + i, z0 + zi, c.color, c.tag);
  })));
  return g;
}
