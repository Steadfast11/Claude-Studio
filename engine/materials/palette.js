// engine/materials/palette.js — shared colour helpers and the voxel material set (one material per voxel tag).
//   voxelMaterial('glow', { emissive: 2.5 })   // per-instance colour also drives emission
//   jitterColor(0x4fb8a8, rand, 0.04)          // ±4 % hand-made variation
import * as THREE from 'three';

const cache = new Map();

/** Material for a voxel tag. Tags: base (matte), gloss (glazed), metal, glow (self-lit from instance colour), cloth (very rough). */
export function voxelMaterial(tag = 'base', opts = {}) {
  const k = tag + JSON.stringify(opts);
  if (cache.has(k)) return cache.get(k);
  const presets = {
    base: { roughness: 0.62, metalness: 0 },
    gloss: { roughness: 0.22, metalness: 0 },
    metal: { roughness: 0.3, metalness: 0.9 },
    cloth: { roughness: 0.9, metalness: 0 },
    glow: { roughness: 0.4, metalness: 0 },
  };
  const m = new THREE.MeshStandardMaterial({ ...(presets[tag] || presets.base), ...(opts.material || {}) });
  if (tag === 'glow') {
    const strength = opts.emissive ?? 1.6;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${strength.toFixed(3)};`);
    };
    m.customProgramCacheKey = () => 'glow' + strength;
  }
  cache.set(k, m);
  return m;
}

/** Scale brightness by ±amount and nudge hue slightly — deterministic given `r` in [0,1). */
export function jitterColor(hex, r, amount = 0.04, out = new THREE.Color()) {
  out.setHex(hex);
  const hsl = {}; out.getHSL(hsl);
  const k = (r - 0.5) * 2;
  out.setHSL(hsl.h + k * amount * 0.08, hsl.s * (1 + k * amount * 0.5), hsl.l * (1 + k * amount));
  return out;
}

/** Linear blend of two hex colours → hex. */
export function mixHex(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
export function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); }
