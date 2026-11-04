// parts/props/_ceramics.js — shared helpers for glazed ceramics (not a part itself).
//   const { mesh, regions } = latheVessel(profile, { texture, segments });   profile: [[r, y], ...] outside → rim → inside
//   paxtaTexture({ ground, ink, gold })     cobalt "paxta" cotton-boll lattice (Uzbek tea-set pattern)
//   rishtonTexture({ glaze, ink, accent })  turquoise/cobalt Rishton-style bowl painting with a central rosette
// Textures are painted in lathe UV space: u = around, v = along the profile (0 = outer foot, 1 = inner centre).
import * as THREE from 'three';
import { canvasTexture } from '../../engine/materials/procedural-textures.js';
import { rng } from '../../engine/core/rng.js';

/** Resample a polyline profile to evenly spaced points so lathe UVs are not stretched. Returns { points, vAt(i) }. */
function resample(profile, n = 90) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); seg.push(d); L += d; }
  const out = [], marks = [0]; let acc = 0;
  for (let i = 0; i < seg.length; i++) { acc += seg[i]; marks.push(acc / L); }
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * L; let i = 0, a = 0;
    while (i < seg.length - 1 && a + seg[i] < s) { a += seg[i]; i++; }
    out.push(pts[i].clone().lerp(pts[i + 1], Math.min(1, (s - a) / Math.max(seg[i], 1e-9))));
  }
  return { points: out, marks };
}

/** Lathe a vessel. Returns { mesh, marks } where marks[i] is the v coordinate of input profile point i. */
export function latheVessel(profile, { map, color = '#ffffff', segments = 72, roughness = 0.28, clearcoat = 0.9, bumpMap = null } = {}) {
  const { points, marks } = resample(profile);
  const geo = new THREE.LatheGeometry(points, segments);
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color, map, roughness, clearcoat, clearcoatRoughness: 0.12, bumpMap, bumpScale: 0.3, envMapIntensity: 1.2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, marks };
}

// ---------- pattern painters ----------
const vy = (h, v) => (1 - v) * h; // lathe v → canvas y

/** One stylised cotton boll: three/four lobes on a calyx with a tiny leaf. */
function boll(g, s, ink, white, gold) {
  g.save();
  g.fillStyle = ink;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(0, 0, s * 0.62, s * 0.62, 0, k * Math.PI / 2 - 0.5, k * Math.PI / 2 + 0.5); g.lineTo(0, 0); g.fill(); }
  g.fillStyle = white;
  for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * 0.85; g.beginPath(); g.arc(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, s * 0.27, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = gold; g.beginPath(); g.arc(0, s * 0.18, s * 0.09, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Cobalt net with white cotton bolls and gold rim lines (the classic "paxta" pattern). bands: [v0, v1] of the field. */
export function paxtaTexture({ ground = '#f7f3ea', ink = '#1d3f9a', gold = '#d6a640', field = [0.12, 0.46], inner = [0.54, 0.6], cols = 10, rows = 3, seed = 1, key } = {}) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = ground; g.fillRect(0, 0, w, h);
    const y0 = vy(h, field[1]), y1 = vy(h, field[0]);
    // cobalt lattice
    g.fillStyle = ink; g.fillRect(0, y0, w, y1 - y0);
    const cw = w / cols, ch = (y1 - y0) / rows;
    g.strokeStyle = '#4f74c8'; g.lineWidth = 3;
    for (let i = -rows; i <= cols + rows; i++) { g.beginPath(); g.moveTo(i * cw, y0); g.lineTo((i + rows) * cw, y1); g.stroke(); g.beginPath(); g.moveTo(i * cw, y1); g.lineTo((i + rows) * cw, y0); g.stroke(); }
    for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
      g.save(); g.translate((c + (r % 2) * 0.5) * cw, y0 + (r + 0.5) * ch); boll(g, Math.min(cw, ch) * 0.62, '#16307a', '#ffffff', gold); g.restore();
    }
    // gold lines framing the field + rim band
    g.fillStyle = gold;
    for (const v of [field[0], field[1]]) g.fillRect(0, vy(h, v) - 4, w, 8);
    g.fillRect(0, vy(h, 0.5) - 10, w, 20);
    // inside: a narrow blue border just under the rim
    g.fillStyle = ink; g.fillRect(0, vy(h, inner[1]), w, vy(h, inner[0]) - vy(h, inner[1]));
    g.fillStyle = gold; g.fillRect(0, vy(h, inner[1]) - 3, w, 6);
  }, { key: key || `paxta${ground}${ink}${gold}${field}${inner}${cols}${rows}${seed}` });
}

/** Rishton-style: turquoise glaze, cobalt/green brush motifs on the outer wall, radial petals inside, a rosette centre. */
export function rishtonTexture({ glaze = '#1f9aa8', ink = '#123d7a', accent = '#e6b04a', leaf = '#2f7d3c', cream = '#f4ead2', outer = [0.08, 0.46], rim = 0.5, inner = [0.54, 0.86], seed = 1, petals = 12, key } = {}) {
  const r = rng(seed);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = cream; g.fillRect(0, 0, w, h);
    // outer wall: turquoise with almond (bodom) motifs
    g.fillStyle = glaze; g.fillRect(0, vy(h, outer[1]), w, vy(h, outer[0]) - vy(h, outer[1]));
    const n = 9, oy = (vy(h, outer[1]) + vy(h, outer[0])) / 2, oh = vy(h, outer[0]) - vy(h, outer[1]);
    for (let i = 0; i < n; i++) {
      g.save(); g.translate((i + 0.5) * (w / n), oy); g.rotate(0.35);
      g.fillStyle = cream; g.beginPath(); g.ellipse(0, 0, oh * 0.18, oh * 0.33, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink; g.beginPath(); g.ellipse(0, oh * 0.03, oh * 0.11, oh * 0.24, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = cream; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -oh * 0.33); g.quadraticCurveTo(oh * 0.25, -oh * 0.5, oh * 0.18, -oh * 0.2); g.stroke();
      g.restore();
      g.fillStyle = leaf; g.beginPath(); g.ellipse((i + 1) * (w / n), oy, oh * 0.06, oh * 0.16, 0.8, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = ink;
    g.fillRect(0, vy(h, outer[1]) - 6, w, 12); g.fillRect(0, vy(h, outer[0]) - 4, w, 8);
    // rim
    g.fillStyle = '#7a4a22'; g.fillRect(0, vy(h, rim + 0.025), w, vy(h, rim - 0.025) - vy(h, rim + 0.025));
    // inner wall: radial petals (repeat in u)
    const iy0 = vy(h, inner[1]), iy1 = vy(h, inner[0]);
    g.fillStyle = glaze; g.fillRect(0, iy0, w, iy1 - iy0);
    for (let i = 0; i < petals; i++) {
      const x = (i + 0.5) * (w / petals), pw = w / petals;
      g.fillStyle = ink; g.beginPath(); g.moveTo(x - pw * 0.42, iy1); g.quadraticCurveTo(x, iy1 - (iy1 - iy0) * 1.25, x + pw * 0.42, iy1); g.fill();
      g.fillStyle = cream; g.beginPath(); g.moveTo(x - pw * 0.22, iy1); g.quadraticCurveTo(x, iy1 - (iy1 - iy0) * 0.8, x + pw * 0.22, iy1); g.fill();
      g.fillStyle = accent; g.beginPath(); g.arc(x, iy1 - (iy1 - iy0) * 0.25, pw * 0.08, 0, Math.PI * 2); g.fill();
      g.fillStyle = leaf; g.beginPath(); g.arc(x + pw / 2, iy0 + (iy1 - iy0) * 0.3, pw * 0.07 + r.next() * 2, 0, Math.PI * 2); g.fill();
    }
    // centre rosette (v → 1 converges to the centre point)
    const cy0 = 0, cy1 = vy(h, inner[1]);
    g.fillStyle = cream; g.fillRect(0, cy0, w, cy1);
    for (let i = 0; i < petals; i++) {
      const x = (i + 0.5) * (w / petals), pw = w / petals;
      g.fillStyle = ink; g.beginPath(); g.moveTo(x - pw * 0.5, cy1); g.lineTo(x, cy0); g.lineTo(x + pw * 0.5, cy1); g.fill();
      g.fillStyle = accent; g.beginPath(); g.moveTo(x - pw * 0.25, cy1); g.lineTo(x, cy1 * 0.35); g.lineTo(x + pw * 0.25, cy1); g.fill();
    }
    g.fillStyle = '#7a1420'; g.fillRect(0, 0, w, cy1 * 0.12);
  }, { key: key || `rishton${glaze}${ink}${accent}${seed}${petals}${outer}${inner}` });
}
