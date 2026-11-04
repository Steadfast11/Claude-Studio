// engine/voxel/shapes.js — solid shapes as inside-tests, sampled at voxel centres, plus combinators.
//   const body = union(ellipsoid(6, 5, 5), translate(sphere(2), 0, 6, 0));
//   fill(grid, body, (x, y, z) => y > 3 ? '#6cc' : '#4aa', 'base');
// A shape is a function (x, y, z) → boolean with a .box = [minX, minY, minZ, maxX, maxY, maxZ] (inclusive, voxel units).

const shape = (fn, box) => Object.assign(fn, { box });

export const sphere = (r) => ellipsoid(r, r, r);
export const ellipsoid = (rx, ry, rz) => shape((x, y, z) => (x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz) <= 1.0001,
  [-Math.ceil(rx), -Math.ceil(ry), -Math.ceil(rz), Math.ceil(rx), Math.ceil(ry), Math.ceil(rz)]);
/** Axis-aligned box from (x0,y0,z0) to (x1,y1,z1) inclusive. */
export const box = (x0, y0, z0, x1, y1, z1) => shape((x, y, z) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1, [x0, y0, z0, x1, y1, z1]);
/** Box of size w×h×d starting at y=0, centred in x/z, with corners rounded by radius r (superellipse-ish). */
export function roundedBox(w, h, d, r = 1) {
  const hx = (w - 1) / 2, hz = (d - 1) / 2;
  return shape((x, y, z) => {
    if (y < 0 || y > h - 1 || Math.abs(x) > hx + 1e-6 || Math.abs(z) > hz + 1e-6) return false;
    const yy = y < r ? r - y : y > h - 1 - r ? y - (h - 1 - r) : 0;
    const xx = Math.max(0, Math.abs(x) - (hx - r)), zz = Math.max(0, Math.abs(z) - (hz - r));
    return xx * xx + yy * yy + zz * zz <= r * r + 0.35;
  }, [-Math.ceil(hx), 0, -Math.ceil(hz), Math.ceil(hx), h - 1, Math.ceil(hz)]);
}
/** Vertical cylinder radius r from y=0 to y=h-1. */
export const cylinder = (r, h) => shape((x, y, z) => y >= 0 && y < h && x * x + z * z <= r * r + 0.3, [-Math.ceil(r), 0, -Math.ceil(r), Math.ceil(r), h - 1, Math.ceil(r)]);
/** Vertical cone, base radius r at y=0, apex at y=h. */
export const cone = (r, h) => shape((x, y, z) => { if (y < 0 || y >= h) return false; const rr = r * (1 - y / h); return x * x + z * z <= rr * rr + 0.3; },
  [-Math.ceil(r), 0, -Math.ceil(r), Math.ceil(r), h - 1, Math.ceil(r)]);
/** Torus in the XZ plane. */
export const torus = (R, r) => shape((x, y, z) => { const q = Math.hypot(x, z) - R; return q * q + y * y <= r * r + 0.2; },
  [-Math.ceil(R + r), -Math.ceil(r), -Math.ceil(R + r), Math.ceil(R + r), Math.ceil(r), Math.ceil(R + r)]);

export const translate = (s, dx, dy, dz) => shape((x, y, z) => s(x - dx, y - dy, z - dz), [s.box[0] + dx, s.box[1] + dy, s.box[2] + dz, s.box[3] + dx, s.box[4] + dy, s.box[5] + dz]);
export const scaleShape = (s, k) => shape((x, y, z) => s(x / k, y / k, z / k), s.box.map((v) => Math.round(v * k)));
const boxUnion = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])];
export const union = (...ss) => shape((x, y, z) => ss.some((s) => s(x, y, z)), ss.map((s) => s.box).reduce(boxUnion));
export const subtract = (a, ...bs) => shape((x, y, z) => a(x, y, z) && !bs.some((b) => b(x, y, z)), a.box);
export const intersect = (a, ...bs) => shape((x, y, z) => a(x, y, z) && bs.every((b) => b(x, y, z)), a.box);
/** Arbitrary predicate with explicit box. */
export const custom = (fn, box) => shape(fn, box);

/** Fill every voxel inside `s`. color: value or fn(x,y,z) → value (return null to skip). */
export function fill(grid, s, color, tag = 'base') {
  const [x0, y0, z0, x1, y1, z1] = s.box;
  for (let x = Math.floor(x0); x <= x1; x++) for (let y = Math.floor(y0); y <= y1; y++) for (let z = Math.floor(z0); z <= z1; z++) {
    if (!s(x, y, z)) continue;
    const c = typeof color === 'function' ? color(x, y, z) : color;
    if (c === null || c === undefined) continue;
    if (typeof c === 'object' && c.color !== undefined) grid.set(x, y, z, c.color, c.tag ?? tag);
    else grid.set(x, y, z, c, tag);
  }
  return grid;
}
