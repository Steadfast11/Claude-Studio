// parts/characters/archetypes/bodies.js — the 10 archetype bodies on the shared creature rig.
//   BODIES[archetype](P) → spec { prims, face, head, legs, hands, apps, gait, hover, anchors }
// All coordinates are body voxels: x centred, y up from the body base (legs are separate grids below it),
// z forward (+z = the face side). P = { prop: proportion multipliers, shape, features, pal, … } from the preset.
// Archetypes: blob · biped · quadruped · bird · fish · insect · snake · robot · person · object
import { gridOf, line } from './_kit.js';
import { shade } from '../../../engine/materials/palette.js';

export const odd = (n) => 2 * Math.round((Math.max(1, n) - 1) / 2) + 1;
const R = Math.round;
const box = (c, size, role, extra = {}) => ({ s: 'box', c, size, role, ...extra });
const rbox = (c, size, r, role, extra = {}) => ({ s: 'rbox', c, size, r, role, ...extra });
const ell = (c, size, role, extra = {}) => ({ s: 'ell', c, size, role, ...extra });
const leg = (w, h, d, pal, role = 'limb', toe = 'dark') => gridOf([box([0, 0, 0], [w, h, d], role), box([0, 0, 0], [w, 1, d], toe)], pal);
const has = (P, f) => P.features.includes(f);
const pp = (P, k, d = 1) => (P.prop && P.prop[k] != null ? P.prop[k] : d);

// ---------- blob: a rounded voxel bean (Pista's family), optional fur, horns, wavy ghost hem ----------
function blob(P) {
  const w = odd(13 * pp(P, 'body')), h = R(11 * pp(P, 'height', pp(P, 'body'))), d = odd(11 * pp(P, 'body'));
  const prims = [rbox([0, 0, 0], [w, h, d], Math.min(3.5, w / 4), 'body')];
  if (P.pattern === 'belly' || has(P, 'belly')) prims.push(ell([0, 1, (d - 1) / 2], [w * 0.62, h * 0.62, 3], 'belly'));
  if (has(P, 'hem')) for (let x = -(w - 1) / 2; x <= (w - 1) / 2; x += 2) prims.push(box([x, 0, 0], [1, 1, d], 'body', { erase: true }));
  const float = has(P, 'float');
  return {
    prims, head: { top: [0, h, 0], w, d, center: [0, h * 0.6, 0] }, back: [0, h * 0.35, -(d - 1) / 2], side: [(w - 1) / 2, h * 0.6, 0],
    face: { front: (d - 1) / 2, eyeY: h * 0.62, mouthY: h * 0.42, eyeX: 2.55 },
    legs: float ? { mode: 'none' } : { mode: 'biped', grid: leg(2, 1, 3, P.pal, 'limb', 'limb'), footH: 1.6, spread: 2.6 },
    hands: { grid: gridOf([box([0, 0, 0], [1, 1, 1], 'limb')], P.pal), x: (w - 1) / 2 + 0.75, y: h * 0.36 },
    gait: { mode: float ? 'float' : P.gait || 'walk' }, hover: float ? 2.2 : 0,
  };
}

// ---------- biped: an upright animal (bear, monkey, alien, dino) — torso + big head ----------
function biped(P) {
  const tw = odd(9 * pp(P, 'body')), th = R(7 * pp(P, 'body')), td = odd(7 * pp(P, 'body'));
  const hw = odd(11 * pp(P, 'head')), hh = R(9 * pp(P, 'head')), hd = odd(9 * pp(P, 'head'));
  const hy = th - 1, prims = [rbox([0, 0, 0], [tw, th, td], 2.4, 'body'), rbox([0, hy, 0], [hw, hh, hd], 2.8, 'head')];
  prims.push(ell([0, 1, (td - 1) / 2], [tw * 0.6, th * 0.7, 2], 'belly'));
  let front = (hd - 1) / 2, mouthZ = 0;
  if (P.snout) { const [sw, sh, sd] = P.snout; prims.push(box([0, hy + 1, front + (sd + 1) / 2], [sw, sh, sd], 'muzzle'), box([0, hy + sh, front + sd], [1, 1, 1], 'nose')); mouthZ = sd; }
  const legH = R(2 * pp(P, 'leg'));
  return {
    prims, head: { top: [0, hy + hh, 0], w: hw, d: hd, center: [0, hy + hh / 2, 0] }, neck: { y: hy - 1, w: tw + 2, d: td + 2, z: 0 },
    back: [0, th * 0.4, -(td - 1) / 2], side: [(tw - 1) / 2, th * 0.8, -1],
    face: { front, eyeY: hy + hh * (P.snout ? 0.66 : 0.6), mouthY: hy + (P.snout ? 1.6 : hh * 0.32), eyeX: Math.min(2.55, hw / 2 - 1.4), mouthZ },
    legs: { mode: 'biped', grid: leg(3, legH, 4, P.pal), footH: legH, spread: Math.max(1.6, tw / 2 - 1.5) },
    hands: { grid: gridOf([box([0, 0, 0], [2, 2, 2], 'limb')], P.pal), x: (tw - 1) / 2 + 1.2, y: th * 0.45 },
    gait: { mode: P.gait || 'walk' },
  };
}

// ---------- quadruped: torso + head on a neck + four legs (front legs double as the 'hands') ----------
function quadruped(P) {
  const tw = odd(9 * pp(P, 'body')), th = R(6 * pp(P, 'body')), td = odd(13 * pp(P, 'length', pp(P, 'body')));
  const hw = odd(9 * pp(P, 'head')), hh = R(8 * pp(P, 'head')), hd = odd(7 * pp(P, 'head'));
  const neck = pp(P, 'neck'), legH = Math.max(1, R(3.5 * pp(P, 'leg')));
  const hy = R(th * 0.4 + 2.2 * neck), hz = (td - 1) / 2 + (hd - 1) / 2 - 2 + R(neck - 1);
  const prims = [rbox([0, 0, 0], [tw, th, td], 2, 'body')];
  if (neck > 1.15) prims.push(rbox([0, th * 0.5, (td - 1) / 2 - 1], [Math.max(3, hw - 4), hy + hh * 0.6 - th * 0.5, 5], 1.2, 'body'));
  prims.push(rbox([0, hy, hz], [hw, hh, hd], 1.8, 'head'));
  const front = hz + (hd - 1) / 2;
  const [sw, sh, sd] = P.snout || [5, 3, 2];
  let mouthZ = 0, mouthY = hy + hh * 0.3;
  if (sd > 0) { prims.push(box([0, hy, front + (sd + 1) / 2], [sw, sh, sd], 'muzzle'), box([0, hy + sh - 1, front + sd], [Math.min(3, sw - 2), 1, 1], 'nose')); mouthZ = sd; mouthY = hy + sh * 0.42; }
  const legX = (tw - 1) / 2 - 1;
  return {
    prims, head: { top: [0, hy + hh, hz], w: hw, d: hd, center: [0, hy + hh / 2, hz] }, neck: { y: hy - 1, w: hw + 1, d: hd + 1, z: hz - 1 },
    back: [0, th - 2, -(td - 1) / 2], side: [(tw - 1) / 2, th - 1, 0], snout: [0, hy + sh / 2, front + sd],
    face: { front, eyeY: hy + hh * 0.66, mouthY, eyeX: Math.min(2.55, hw / 2 - 1.4), mouthZ },
    legs: { mode: 'quad', grid: leg(2, legH, 2, P.pal), footH: legH, spread: legX, front: (td - 1) / 2 - 2, back: -(td - 1) / 2 + 2 },
    gait: { mode: P.gait || 'quad', lift: Math.max(0.6, legH * 0.35) },
  };
}

// ---------- bird: round body, head on top, beak, wings (flap when flying), thin legs ----------
function bird(P) {
  const bw = odd(9 * pp(P, 'body')), bh = R(8 * pp(P, 'body')), bd = odd(9 * pp(P, 'body'));
  const hw = odd(9 * pp(P, 'head')), hh = R(7 * pp(P, 'head')), hd = odd(7 * pp(P, 'head'));
  const tall = has(P, 'upright'); // penguin, owl: head merged into a tall body
  const prims = [tall ? rbox([0, 0, 0], [bw, bh + hh - 2, bd], 3.2, 'body') : ell([0, 0, 0], [bw, bh, bd], 'body')];
  const hy = tall ? bh - 3 : bh - 3, hz = tall ? 0 : 1;
  if (!tall) prims.push(rbox([0, hy, hz], [hw, hh, hd], 2.4, 'head'));
  prims.push(ell([0, 1, (bd - 1) / 2 - 0.5], [bw * 0.6, (tall ? bh + hh : bh) * 0.6, 3], 'belly'));
  const front = tall ? (bd - 1) / 2 : hz + (hd - 1) / 2;
  const eyeY = hy + hh * 0.62, beakY = R(eyeY - 2.4);
  prims.push(box([0, beakY, front + 1], [3, 2, 2], 'beak'), box([0, beakY, front + 2], [1, 1, 1], 'beak'));
  const top = tall ? bh + hh - 2 : hy + hh;
  const legH = R(2 * pp(P, 'leg'));
  return {
    prims, head: { top: [0, top, hz], w: tall ? bw : hw, d: tall ? bd : hd, center: [0, hy + hh / 2, hz] }, neck: { y: hy - 1, w: hw + 1, d: hd + 1, z: hz },
    back: [0, bh * 0.4, -(bd - 1) / 2], side: [(bw - 1) / 2, bh * 0.75, -0.5],
    face: { front, eyeY, mouthY: beakY + 0.5, eyeX: Math.min(2.4, (tall ? bw : hw) / 2 - 1.4), rest: 'none' },
    legs: { mode: 'biped', grid: leg(1, legH, 2, P.pal, 'beak', 'beak'), footH: legH, spread: 1.6 },
    hands: null,
    gait: { mode: P.gait || (tall ? 'waddle' : 'walk') },
  };
}

// ---------- fish / sea creature: a chunky rounded fish that swims a little above the ground ----------
function fish(P) {
  const w = odd(9 * pp(P, 'body')), h = R(9 * pp(P, 'body')), d = odd(11 * pp(P, 'length', pp(P, 'body')));
  const prims = [rbox([0, 0, 0], [w, h, d], 3.4, 'body'), box([0, h, -1], [1, 2, 4], 'accent'), box([0, h + 1, -2], [1, 1, 2], 'accent')];
  prims.push(ell([0, 0, (d - 1) / 2], [w * 0.7, h * 0.5, 3], 'belly'));
  return {
    prims, head: { top: [0, h, 1], w, d: d - 2, center: [0, h / 2, 1] }, back: [0, h * 0.5, -(d - 1) / 2], side: [(w - 1) / 2, h * 0.45, 1],
    face: { front: (d - 1) / 2, eyeY: h * 0.62, mouthY: h * 0.36, eyeX: Math.min(2.55, w / 2 - 1.4) },
    legs: { mode: 'none' }, hands: null, gait: { mode: 'swim' }, hover: 2.4,
  };
}

// ---------- insect: segmented body, big cartoon head, thin legs or wings (bee: always flying) ----------
function insect(P) {
  const fly = has(P, 'flying') || has(P, 'wings-bee');
  const hw = odd(9 * pp(P, 'head')), hh = R(8 * pp(P, 'head')), hd = odd(7 * pp(P, 'head'));
  const prims = [];
  let front;
  if (fly) { // bee: one round banded body, head merged at the front
    const w = odd(9 * pp(P, 'body')), h = R(9 * pp(P, 'body')), d = odd(10 * pp(P, 'body'));
    prims.push(rbox([0, 0, 0], [w, h, d], 3.4, 'body'), box([0, R(h * 0.4), -(d + 1) / 2], [1, 1, 2], 'dark'));
    front = (d - 1) / 2;
    return {
      prims, head: { top: [0, h, 1], w, d, center: [0, h / 2, 0] }, back: [0, h * 0.5, -(d - 1) / 2], side: [(w - 1) / 2 - 1, h - 1, -1],
      face: { front, eyeY: h * 0.6, mouthY: h * 0.36, eyeX: Math.min(2.55, w / 2 - 1.6) },
      legs: { mode: 'none' }, hands: { grid: gridOf([box([0, 0, 0], [1, 1, 1], 'dark')], P.pal), x: (w - 1) / 2 + 0.4, y: h * 0.3 }, gait: { mode: 'fly' }, hover: 3.5,
    };
  }
  const ab = [odd(7 * pp(P, 'body')), R(6 * pp(P, 'body')), odd(8 * pp(P, 'body'))];
  prims.push(ell([0, 0, -6], ab, 'body'), ell([0, 1, -1], [5, 4, 5], 'body'), rbox([0, 0, 4], [hw, hh, hd], 2.4, 'head'));
  front = 4 + (hd - 1) / 2;
  const legH = Math.max(2, R(2.5 * pp(P, 'leg')));
  return {
    prims, head: { top: [0, hh, 4], w: hw, d: hd, center: [0, hh / 2, 4] }, back: [0, 3, -10], side: [2, 4, -1],
    face: { front, eyeY: hh * 0.62, mouthY: hh * 0.3, eyeX: Math.min(2.55, hw / 2 - 1.4) },
    legs: { mode: 'quad', grid: leg(1, legH, 1, P.pal, 'dark', 'dark'), footH: legH, spread: 2.5, front: 3, back: -5 },
    gait: { mode: 'quad', lift: 0.8 },
  };
}

// ---------- snake / slug: a coiled (or flat) body with the head raised at the front; slithers ----------
function snake(P) {
  const shell = has(P, 'shell');
  const hw = odd(9 * pp(P, 'head')), hh = R(6 * pp(P, 'head')), hd = odd(8 * pp(P, 'head'));
  const prims = [];
  let hy, hz;
  if (shell) { // snail: a slug foot, a spiral shell on the back, head up front
    prims.push(rbox([0, 0, -1], [7, 3, 15], 1.4, 'body'), ell([0, 2, -3], [9, 10, 9], 'accent'), ell([0, 4, -3], [5, 6, 9.4], shade(P.pal.accent || '#c08040', 0.75)));
    hy = 2; hz = 6;
    prims.push(rbox([0, 1, 5], [5, 4, 4], 1.2, 'body'));
  } else {
    prims.push({ s: 'ring', c: [0, 0, 0], size: [13, 3, 13], thick: 0.5, role: 'body' }, { s: 'ring', c: [0, 2, -1], size: [9, 3, 9], thick: 0.6, role: 'body' }, ell([0, 4, -1], [5, 2, 5], 'body'));
    prims.push(rbox([0, 0, 4], [4, 9, 4], 1.4, 'body'), ell([0, 1, 6.5], [4, 6, 3], 'belly'));
    hy = 8; hz = 4;
  }
  prims.push(rbox([0, hy, hz], [hw, hh, hd], 2.4, 'head'));
  const front = hz + (hd - 1) / 2;
  return {
    prims, head: { top: [0, hy + hh, hz], w: hw, d: hd, center: [0, hy + hh / 2, hz] }, back: [0, 1, shell ? -8 : -6], side: [5, 3, 0],
    face: { front, eyeY: hy + hh * 0.62, mouthY: hy + hh * 0.26, eyeX: Math.min(2.55, hw / 2 - 1.4) },
    legs: { mode: 'none' }, hands: null, gait: { mode: 'slither' }, hover: 0,
  };
}

// ---------- robot: boxy metal torso, screen-face head, antenna, mitten hands, stompy feet ----------
function robot(P) {
  const tw = odd(11 * pp(P, 'body')), th = R(8 * pp(P, 'body')), td = odd(7 * pp(P, 'body'));
  const hw = odd(11 * pp(P, 'head')), hh = R(9 * pp(P, 'head')), hd = odd(9 * pp(P, 'head'));
  const prims = [box([0, 0, 0], [tw, th, td], 'body', { tag: 'metal' }), box([0, th, 0], [hw, hh, hd], 'body', { tag: 'metal' })];
  prims.push(box([0, R(th * 0.35), (td + 1) / 2], [5, 3, 1], 'accent'), box([-1, R(th * 0.5), (td + 1) / 2], [1, 1, 1], 'glow', { tag: 'glow' }), box([1, R(th * 0.5), (td + 1) / 2], [1, 1, 1], '#ff7a3a', { tag: 'glow' }));
  prims.push(box([0, th + 1, (hd + 1) / 2], [hw - 2, hh - 2, 1], 'dark', { tag: 'gloss' }));
  prims.push(box([-(hw + 1) / 2, th + R(hh / 2), 0], [1, 3, 3], 'accent'), box([(hw + 1) / 2, th + R(hh / 2), 0], [1, 3, 3], 'accent'));
  const front = (hd + 1) / 2;
  return {
    prims, head: { top: [0, th + hh, 0], w: hw, d: hd, center: [0, th + hh / 2, 0] }, neck: { y: th - 1, w: tw + 1, d: td + 1, z: 0 },
    back: [0, th * 0.5, -(td - 1) / 2], side: [(tw - 1) / 2, th - 1, 0],
    face: { front, eyeY: th + hh * 0.58, mouthY: th + hh * 0.3, eyeX: Math.min(2.55, hw / 2 - 1.8), ink: P.pal.glow || '#7ff7ff', mouth: P.pal.glow || '#7ff7ff' },
    legs: { mode: 'biped', grid: leg(3, R(2.4 * pp(P, 'leg')), 4, P.pal, 'accent', 'dark'), footH: R(2.4 * pp(P, 'leg')), spread: Math.max(2, tw / 2 - 2) },
    hands: { grid: gridOf([box([0, 0, 0], [2, 2, 2], 'accent', { tag: 'metal' })], P.pal), x: (tw - 1) / 2 + 1.4, y: th * 0.5 },
    gait: { mode: 'walk', bob: 0.15 },
  };
}

// ---------- person: chibi human — legs, torso (clothes), big head, hair styles, outfits ----------
function person(P) {
  const tw = odd(7 * pp(P, 'body')), th = R(6 * pp(P, 'body')), td = odd(5 * pp(P, 'body'));
  const hw = odd(9 * pp(P, 'head')), hh = R(9 * pp(P, 'head')), hd = odd(9 * pp(P, 'head'));
  const hy = th, prims = [rbox([0, 0, 0], [tw, th, td], 1.2, 'shirt')];
  if (has(P, 'robe') || has(P, 'coat')) prims.push(rbox([0, 0, 0], [tw + 2, th, td + 2], 1.2, has(P, 'coat') ? '#f4f2ec' : 'shirt'), box([0, 1, (td + 1) / 2 + 1], [1, th - 1, 1], has(P, 'coat') ? 'shirt' : 'accent'));
  if (has(P, 'apron')) prims.push(box([0, 0, (td + 1) / 2], [tw - 2, th - 1, 1], 'accent'));
  if (has(P, 'belt')) prims.push(box([0, 1, 0], [tw + 1, 1, td + 1], 'dark'));
  if (has(P, 'backpack')) prims.push(rbox([0, 1, -(td + 3) / 2], [tw - 1, th - 1, 3], 1, 'accent'));
  if (has(P, 'tie')) prims.push(box([0, 2, (td + 1) / 2], [1, th - 2, 1], 'accent'));
  if (has(P, 'suit')) prims.push(rbox([0, 0, 0], [tw + 2, th + 1, td + 2], 1.6, 'shirt'), box([0, th - 3, (td + 3) / 2], [3, 2, 1], 'accent', { tag: 'glow' }));
  if (has(P, 'tail-wisp')) prims.splice(0, 0, ell([0, -3, 0], [tw - 2, 6, td - 1], 'shirt'));
  prims.push(rbox([0, hy, 0], [hw, hh, hd], 1.8, 'skin'));
  const front = (hd - 1) / 2, top = hy + hh;
  const hair = P.hair || 'short';
  const H = (pr) => prims.push({ ...pr, role: 'hair' });
  if (hair !== 'bald' && hair !== 'none') {
    H(rbox([0, top - 3, -0.5], [hw + 1, 4, hd + 1], 1.8)); // cap of hair
    H(box([0, hy + 2, -(hd + 1) / 2], [hw - 1, hh - 3, 1]));
    if (hair === 'short' || hair === 'bun' || hair === 'pigtails' || hair === 'long') H(box([0, top - 2, front], [hw - 2, 1, 1]));
    if (hair === 'long') { H(box([-(hw + 1) / 2, hy, -1], [1, hh - 1, hd - 2])); H(box([(hw + 1) / 2, hy, -1], [1, hh - 1, hd - 2])); H(box([0, hy - 3, -(hd + 1) / 2], [hw - 1, 5, 1])); }
    if (hair === 'bun') H(ell([0, top, -2], [4, 4, 4]));
    if (hair === 'pigtails') { H(ell([-(hw + 3) / 2, hy + 3, -1], [3, 4, 3])); H(ell([(hw + 3) / 2, hy + 3, -1], [3, 4, 3])); }
    if (hair === 'wild') { H(rbox([0, top - 2, -1], [hw + 3, 4, hd + 2], 1.5)); H(box([-(hw + 3) / 2, hy + 3, -1], [1, 4, hd - 2])); H(box([(hw + 3) / 2, hy + 3, -1], [1, 4, hd - 2])); }
    if (hair === 'side') { H(box([-(hw + 1) / 2, hy + 2, 0], [1, hh - 4, hd - 2])); H(box([(hw + 1) / 2, hy + 2, 0], [1, hh - 4, hd - 2])); }
  }
  if (has(P, 'beard')) prims.push(rbox([0, hy - 2, front - 1], [hw - 2, 4, 3], 1, 'hair'), box([0, hy + 2, front + 1], [3, 1, 1], 'hair'));
  if (has(P, 'mustache')) prims.push(box([0, R(hy + hh * 0.36), front + 1], [5, 1, 1], 'hair'));
  const legH = R(3.4 * pp(P, 'leg'));
  const legs = has(P, 'float') || has(P, 'tail-wisp') ? { mode: 'none' } : { mode: 'biped', grid: gridOf([box([0, 0, 0], [2, legH, 3], 'pants'), box([0, 0, 0.5], [2, 1, 4], 'shoe')], P.pal), footH: legH, spread: Math.max(1.4, tw / 2 - 1.6) };
  return {
    prims, head: { top: [0, top, -0.5], w: hw, d: hd, center: [0, hy + hh / 2, 0] }, neck: { y: hy - 1, w: tw + 2, d: td + 2, z: 0 },
    back: [0, th * 0.5, -(td - 1) / 2], side: [(tw - 1) / 2, th - 1, -1],
    face: { front, eyeY: hy + hh * 0.5, mouthY: hy + hh * 0.22, eyeX: Math.min(2.4, hw / 2 - 1.5), blushY: hy + hh * 0.3 },
    legs, hands: { grid: gridOf([box([0, 0, 0], [2, 2, 2], 'skin')], P.pal), x: (tw - 1) / 2 + 1.3, y: th * 0.42 },
    gait: { mode: legs.mode === 'none' ? 'float' : 'walk' }, hover: legs.mode === 'none' ? 2.5 : 0,
  };
}

// ---------- object-creature: a thing with eyes and limbs (teapot, toaster, book, car, rocket, cloud, sun…) ----------
const SHAPES = {
  teapot: () => ({ prims: [rbox([0, 0, 0], [13, 10, 11], 3.4, 'body'), { s: 'cyl', c: [0, 9, 0], size: [7, 1], role: 'accent' }, ell([0, 10, 0], [5, 2, 5], 'accent'), box([0, 12, 0], [1, 1, 1], 'accent'),
    box([-7, 3, 0], [1, 2, 2], 'body'), box([-8, 4, 0], [1, 2, 2], 'body'), box([-9, 5, 0], [1, 2, 1], 'body'), box([7, 3, 0], [1, 5, 1], 'accent'), box([7, 8, 0], [1, 1, 1], 'accent'), box([8, 4, 0], [1, 4, 1], 'accent')], w: 13, h: 10, d: 11, eye: 0.62, mouth: 0.38 }),
  kettle: () => ({ prims: [rbox([0, 0, 0], [11, 11, 11], 3, 'body', { tag: 'metal' }), box([0, 12, 0], [7, 1, 1], 'dark'), box([-3, 10, 0], [1, 2, 1], 'dark'), box([3, 10, 0], [1, 2, 1], 'dark'), box([6, 5, 0], [2, 2, 2], 'body', { tag: 'metal' }), box([8, 6, 0], [1, 2, 1], 'body', { tag: 'metal' })], w: 11, h: 10, d: 11, eye: 0.6, mouth: 0.36 }),
  toaster: () => ({ prims: [rbox([0, 0, 0], [13, 9, 9], 2, 'body', { tag: 'gloss' }), box([-2, 9, 0], [2, 1, 6], 'dark'), box([2, 9, 0], [2, 1, 6], 'dark'), box([-2, 9, 0], [1, 2, 5], '#d8a058'), box([2, 9, 0], [1, 2, 5], '#d8a058'), box([7, 5, 0], [1, 1, 2], 'dark')], w: 13, h: 9, d: 9, eye: 0.6, mouth: 0.32 }),
  book: () => ({ prims: [box([0, 0, 0], [11, 14, 5], 'body'), box([0, 1, 0], [9, 12, 4], '#f6f0de'), box([-5, 0, 0], [1, 14, 5], 'accent'), box([0, 10, 3], [7, 1, 1], 'accent')], w: 11, h: 14, d: 5, eye: 0.58, mouth: 0.36 }),
  car: () => ({ prims: [rbox([0, 0, 0], [11, 5, 17], 1.6, 'body', { tag: 'gloss' }), rbox([0, 4, -1], [9, 5, 9], 1.6, 'body', { tag: 'gloss' }), box([0, 5, 4], [7, 3, 1], '#bfe0f0', { tag: 'gloss' }), box([-3, 1, 8], [2, 1, 1], '#fff4c0', { tag: 'glow' }), box([3, 1, 8], [2, 1, 1], '#fff4c0', { tag: 'glow' }), box([0, 0, 8], [5, 1, 1], 'dark')], w: 11, h: 9, d: 17, eye: 0.69, mouth: 0.22, wheels: true, faceFront: 4, mouthZ: 4 }),
  rocket: () => ({ prims: [rbox([0, 0, 0], [9, 12, 9], 2.6, 'body', { tag: 'gloss' }), { s: 'cone', c: [0, 12, 0], size: [9, 6], role: 'accent', tag: 'gloss' }, box([-5, 0, 0], [1, 4, 3], 'accent'), box([5, 0, 0], [1, 4, 3], 'accent'), box([0, 0, -5], [3, 4, 1], 'accent'), { s: 'cyl', c: [0, 0, 0], size: [5, 1], role: 'dark' }], w: 9, h: 18, d: 9, eye: 0.42, mouth: 0.25, float: true }),
  cloud: () => ({ prims: [ell([0, 0, 0], [15, 8, 9], 'body'), ell([-4, 3, 0], [8, 8, 8], 'body'), ell([3, 4, 0], [9, 9, 8], 'body')], w: 15, h: 12, d: 9, eye: 0.5, mouth: 0.3, float: true }),
  sun: () => ({ prims: [rbox([0, 2, 0], [11, 11, 9], 3.6, 'body', { tag: 'glow' }), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => box([R(Math.cos(i * 0.785) * 7.5), 7 + R(Math.sin(i * 0.785) * 7.5), 0], [2, 2, 2], 'accent', { tag: 'glow' }))], w: 11, h: 15, d: 9, eye: 0.52, mouth: 0.36, float: true, glowFace: true }),
  star: () => ({ prims: (() => { const out = []; for (let x = -7; x <= 7; x++) for (let y = 0; y <= 14; y++) { const ax = x, ay = y - 7, a = Math.atan2(ay, ax), r = Math.hypot(ax, ay); const k = 4.2 + 3.4 * Math.max(0, Math.cos(5 * (a - Math.PI / 2))) ** 2; if (r <= k) out.push(box([x, y, 0], [1, 1, 5], 'body', { tag: 'glow' })); } return out; })(), w: 15, h: 15, d: 5, eye: 0.52, mouth: 0.36, float: true }),
  pomegranate: () => ({ prims: [rbox([0, 0, 0], [11, 10, 11], 3.6, 'body', { tag: 'gloss' }), { s: 'cyl', c: [0, 9, 0], size: [3, 2], role: 'accent' }, box([-1, 11, 0], [1, 1, 1], 'accent'), box([1, 11, 0], [1, 1, 1], 'accent'), box([0, 11, 1], [1, 1, 1], 'accent')], w: 11, h: 10, d: 11, eye: 0.56, mouth: 0.34 }),
  snowman: () => ({ prims: [rbox([0, 0, 0], [13, 10, 13], 4, 'body'), rbox([0, 9, 0], [11, 9, 11], 3.4, 'body'), box([0, 13, 6], [1, 1, 3], '#f08a2c'), box([0, 7, 6], [1, 1, 1], 'dark'), box([0, 4, 6], [1, 1, 1], 'dark')], w: 13, h: 18, d: 13, eye: 0.84, mouth: 0.66, faceFront: 5, mouthZ: 0, float: false, noFeet: true, neck: { y: 9, w: 11, d: 11, z: 0 } }),
};
function object(P) {
  const S = (SHAPES[P.shape] || SHAPES.pomegranate)();
  const { w, h, d } = S;
  const front = S.faceFront ?? (d - 1) / 2;
  const legs = S.wheels ? { mode: 'quad', grid: gridOf([{ s: 'cyl', c: [0, 0, 0], size: [3, 2], axis: 'x', role: '#25232a' }, box([0, 1, 0], [2, 1, 1], '#c0c4cc', { tag: 'metal' })], P.pal), footH: 1.5, spread: (w - 1) / 2, front: 5, back: -5 }
    : S.float || S.noFeet ? { mode: 'none' } : { mode: 'biped', grid: leg(2, 1, 3, P.pal, 'limb', 'limb'), footH: 1.6, spread: Math.min(2.6, w / 4) };
  return {
    prims: S.prims, neck: S.neck, head: { top: [0, h, 0], w: Math.min(w, 11), d: Math.min(d, 9), center: [0, h * 0.6, 0] }, back: [0, h * 0.4, -(d - 1) / 2], side: [(w - 1) / 2, h * 0.55, 0],
    face: { front, eyeY: h * S.eye, mouthY: h * S.mouth, eyeX: Math.min(2.55, w / 2 - 1.6), mouthZ: S.mouthZ ?? 0, ...(S.glowFace ? { ink: '#7a3a10' } : {}) },
    legs, hands: S.wheels ? null : { grid: gridOf([box([0, 0, 0], [1, 1, 1], 'limb')], P.pal), x: (w - 1) / 2 + 0.8, y: h * 0.36 },
    gait: { mode: S.wheels ? 'drive' : S.float ? 'float' : S.noFeet ? 'slither' : 'walk' }, hover: S.float ? 2.6 : S.noFeet ? 0 : 0,
  };
}

export const BODIES = { blob, biped, quadruped, bird, fish, insect, snake, robot, person, object };
export const ARCHETYPES = Object.keys(BODIES);
export const OBJECT_SHAPES = Object.keys(SHAPES);
export { line };
