// parts/characters/_rig-actions.js — the shared action library every creature gets on top of _rig.js's core verbs,
// plus the non-biped gaits and the flight model. Pure functions of t (clips + motions), like the rest of the rig.
//   extraActions(K) → { idle, sneak, fall, 'get-up', 'lie-down', sleep, wake, point, clap, dance, 'dance-bounce', 'dance-spin',
//                       'dance-sway', drink, carry, pull, throw, kick, climb, swim, 'fly-takeoff', fly, dizzy, cry, angry, scared,
//                       shy, think, talk, 'look-at', nod, 'shake-head' }
//   gaitPose(mode, pose, k) — quad (trot; front legs = hands) · hop · waddle · slither · swim · fly · float · drive
//   flightModel()          — hover height over time from fly-takeoff / fly / land
// Hand offsets follow _rig.js: [x, y, z] cm, +x outward for both hands. Feet: +x right.
import { E } from '../../engine/anim/easing.js';
import { clamp, smoothstep, TAU } from '../../engine/core/math.js';
import { hash } from '../../engine/core/rng.js';

/** Every verb a character understands (core rig + this library). Exposed in the film.json schema (beats[].action). */
export const ACTIONS = ['idle', 'walk', 'run', 'sprint', 'sneak', 'chase', 'stop', 'turn', 'look', 'look-at', 'face', 'blink', 'smile', 'gasp', 'anticipate',
  'jump', 'hop', 'leap', 'land', 'skid', 'fall', 'get-up', 'sit', 'lie-down', 'sleep', 'wake', 'wave', 'point', 'clap', 'cheer', 'dance', 'dance-bounce',
  'dance-spin', 'dance-sway', 'eat', 'snap', 'drink', 'carry', 'push', 'pull', 'throw', 'catch', 'hug', 'lift', 'kick', 'climb', 'swim', 'fly-takeoff', 'fly',
  'bonk', 'dizzy', 'shake', 'cry', 'laugh', 'angry', 'scared', 'shy', 'think', 'talk', 'nod', 'shake-head', 'peek', 'sniff', 'blush', 'balance'];
/** Actions a character can play with no parameters (just { dur }) — what film.json beats[].action may name. */
export const SOLO_ACTIONS = ACTIONS.filter((a) => !['walk', 'run', 'sprint', 'chase', 'stop', 'turn', 'look', 'look-at', 'hop', 'leap', 'face', 'blink', 'anticipate', 'land'].includes(a));

export function flightModel() {
  const F = [];
  const up = (f, t) => E.inOutSine(clamp((t - f.t0) / f.rise));
  const down = (f, t) => (f.t1 === Infinity ? 0 : E.inOutSine(clamp((t - f.t1) / f.fall)));
  return {
    list: F,
    active: (t) => F.find((f) => t >= f.t0 && t < f.t1 + f.fall),
    takeoff(t, h, rise = 0.7) { const f = { t0: t, rise, h, t1: Infinity, fall: 0.6 }; F.push(f); F.sort((a, b) => a.t0 - b.t0); return f; },
    landAt(t, fall = 0.6) { const f = [...F].reverse().find((x) => x.t0 <= t && x.t1 === Infinity); if (!f) return null; f.t1 = Math.max(t, f.t0 + f.rise * 0.5); f.fall = fall; return f.t1 + fall; },
    h: (t) => F.reduce((s, f) => (t < f.t0 ? s : s + f.h * up(f, t) * (1 - down(f, t))), 0),
    k: (t) => F.reduce((k, f) => (t < f.t0 ? k : Math.max(k, Math.min(1, up(f, t) * 1.6) * (1 - down(f, t)))), 0),
  };
}

export function gaitPose(mode, pose, k) {
  const { p, s, c, L, move, lift, t, fk, hover, V, g, quad } = k;
  const ph = Math.PI * p;
  if (mode === 'quad') {
    pose.handL = [0, Math.max(0, Math.sin(TAU * c + Math.PI)) * lift, -Math.cos(TAU * c + Math.PI) * (L / 2) * move];
    pose.handR = [0, Math.max(0, Math.sin(TAU * c)) * lift, -Math.cos(TAU * c) * (L / 2) * move];
    pose.bob *= 0.6;
  } else if (mode === 'hop') {
    const hp = Math.abs(Math.sin(ph));
    pose.bob = move * (g.hopH || 2) * hp + (1 - move) * pose.bob;
    pose.squash = 0.1 * Math.cos(2 * ph) * move + (1 - move) * pose.squash;
    pose.footL = [0, hp * lift * 0.5 * move, -0.5 * move]; pose.footR = pose.footL.slice();
    if (quad) { pose.handL = [0, hp * lift * 0.5 * move, 0.6 * move]; pose.handR = pose.handL.slice(); }
    pose.lean = clamp(pose.lean + 0.12 * move * Math.cos(ph), -0.3, 0.42);
  } else if (mode === 'waddle') {
    pose.bank += Math.sin(ph) * 0.17 * move; pose.lean *= 0.4;
    pose.handL = [0.5 * move + Math.max(0, Math.sin(ph)) * 0.4 * move, 0.3 * move, 0]; pose.handR = [0.5 * move + Math.max(0, -Math.sin(ph)) * 0.4 * move, 0.3 * move, 0];
  } else if (mode === 'slither') {
    pose.offX = Math.sin(ph) * V * 1.1 * move; pose.spin = Math.cos(ph) * 0.16 * move; pose.bob = 0; pose.lean *= 0.25;
    pose.squash = 0.045 * Math.sin(2 * ph) * move + Math.sin(t * TAU / 2.4) * 0.012;
  } else if (mode === 'swim') {
    pose.spin = Math.sin(ph) * 0.16 * move + Math.sin(t * TAU / 2.1) * 0.05; pose.bob = Math.sin(t * TAU / 1.8) * 0.7 * V; pose.lean *= 0.35; pose.wag = 0.6 + move;
  } else if (mode === 'fly') {
    pose.bob = Math.sin(t * TAU * 1.1) * 0.9 * V; pose.lean = 0.16 * move; pose.bank *= 0.5; pose.flap = 1;
  } else if (mode === 'float') {
    pose.bob = Math.sin(t * TAU / 2.4) * 0.8 * V; pose.bank += Math.sin(t * TAU / 3.1) * 0.05; pose.lean = 0.14 * move + pose.lean * 0.3;
  } else if (mode === 'drive') {
    pose.bob = 0.05 * Math.sin(t * TAU * 9) * move; pose.footL = [0, 0, 0]; pose.footR = [0, 0, 0]; pose.handL = [0, 0, 0]; pose.handR = [0, 0, 0]; pose.lean *= 0.3;
  }
  pose.hover = hover;
  if (fk > 0) { // flying: tuck the feet, flap, glide forward
    const tuck = (a) => a.map((v, i) => v * (1 - fk) + [0, 0.9, 0.5][i] * fk);
    pose.footL = tuck(pose.footL); pose.footR = tuck(pose.footR);
    pose.flap = Math.max(pose.flap || 0, fk);
    pose.bob += Math.sin(t * TAU * 1.3) * 0.6 * V * fk;
    pose.lean += 0.14 * fk * smoothstep(2, 10, s);
  }
}

export function extraActions(K) {
  const { add, anticipation, landSquash, impulses, motion, flights, actions, until, voice, W, H, D, FH, V, eyeY, HOVER, MODE } = K;
  const A = {};
  const endOf = (t, p, api, verbs, dflt) => p.until ?? (p.dur != null ? t + p.dur : Math.min(api.nextOf(verbs), t + (dflt ?? 30)));
  const handX = W / 2 + 0.25 * V; // reach to the body centre line
  const mouthAt = [-W / 2 + 0.2, eyeY - H * 0.36 - 1.4, D * 0.5 + 0.6];
  const lieClip = (t, p, api, { rise, face, mouth, verbs }) => {
    const side = p.side ?? 1, end = Math.max(t + rise + 0.3, endOf(t, p, api, verbs, 30) + 0.5);
    add({ t0: t, dur: end - t, fadeIn: 0.001, fadeOut: 0.5, fn: (u, tl) => {
      const k = tl < rise ? (rise < 0.5 ? E.inQuad(tl / rise) : E.inOutSine(tl / rise)) : 1;
      return { lie: side * (k + (rise < 0.5 && tl > rise ? 0.08 * Math.exp(-(tl - rise) * 9) * Math.sin((tl - rise) * 30) : 0)), face: face(tl), mouth: mouth(tl), footL: [0, 0.4 * k, 0.6], footR: [0, 0.2 * k, -0.4] };
    } });
    return end;
  };

  A.idle = (t, p) => { const d = p.dur ?? 2.4; add({ t0: t, dur: d, fadeIn: 0.3, fadeOut: 0.3, fn: (u, tl) => ({ squash: Math.sin(tl * TAU / 1.7) * 0.025, lookX: Math.sin((tl / d) * TAU) * 0.55, lookY: Math.sin((tl / d) * TAU * 2) * 0.15, bank: Math.sin(tl * TAU / 3.2) * 0.03 }) }); };
  A.sneak = (t, p, api) => {
    if (p.path || p.to) actions.walk(t, { speed: 6, ramp: 0.35, ...p }, api);
    const d = p.dur ?? Math.min(4, api.next() - t);
    add({ t0: t, dur: Math.max(0.4, d), fadeIn: 0.3, fadeOut: 0.3, fn: (u, tl) => ({ squash: -0.12, lean: 0.2, handL: [-0.3, 1.0, 1.6], handR: [-0.3, 1.0, 1.6], face: 'determined', mouth: 'small', lookX: Math.sin(tl * 2.4) * 0.45 }) });
  };
  A.fall = (t, p, api) => {
    lieClip(t, p, api, { rise: 0.32, face: (tl) => (tl < 0.4 ? 'wide' : 'dizzy'), mouth: () => 'o', verbs: ['get-up', 'wake', 'jump', 'hop', 'walk', 'run', 'sprint'] });
    anticipation(t, 0.1, 0.08);
    impulses.push({ t: t + 0.32, amp: 0.7, side: 1 });
    api.sfx(t, 'gasp', voice); api.sfx(t + 0.32, 'thud', { gain: 0.6 });
  };
  A['get-up'] = (t, p, api) => {
    add({ t0: t, dur: 0.7, fadeIn: 0.05, fadeOut: 0.2, fn: (u) => ({ squash: -0.14 * Math.sin(Math.PI * u), handL: [0, -0.6, 1.2], handR: [0, -0.6, 1.2], face: u < 0.6 ? 'closed' : 'normal', mouth: 'flat' }) });
    landSquash(t + 0.55, 0.4); api.sfx(t + 0.2, 'lift', voice);
  };
  A['lie-down'] = (t, p, api) => { lieClip(t, { side: -1, ...p }, api, { rise: 0.9, face: () => p.eyes || 'happy', mouth: () => 'smile', verbs: ['get-up', 'wake', 'jump', 'hop', 'walk', 'run', 'sprint', 'sit'] }); };
  A.sleep = (t, p, api) => {
    const end = endOf(t, p, api, ['wake', 'get-up', 'jump', 'walk', 'run', 'sprint', 'hop'], 30);
    if (p.lie) lieClip(t, { side: -1, ...p, until: end }, api, { rise: 0.9, face: () => 'closed', mouth: () => 'small', verbs: [] });
    else add({ t0: t, dur: end - t, fadeIn: 0.5, fadeOut: 0.4, fn: () => ({ sit: -FH * 0.6 - HOVER, lean: 0.12, squash: -0.05 }) });
    add({ t0: t, dur: end - t, fadeIn: 0.4, fadeOut: 0.3, fn: (u, tl) => ({ face: 'closed', mouth: 'small', squash: Math.sin(tl * TAU / 3) * 0.04, lookY: -0.4 }) });
    for (let k = t + 1.2; k < end - 0.5; k += 3) api.sfx(k, 'sniff', { count: 1, gain: 0.3, pitch: 0.7 });
  };
  A.wake = (t, p, api) => {
    const d = p.dur ?? 1.3;
    add({ t0: t, dur: d, fadeIn: 0.1, fadeOut: 0.3, fn: (u) => ({ handL: [0.4, 3.4 * Math.sin(Math.PI * Math.min(1, u * 1.4)), 0], handR: [0.4, 3.4 * Math.sin(Math.PI * Math.min(1, u * 1.4)), 0], squash: 0.12 * Math.sin(Math.PI * u), lean: -0.12 * Math.sin(Math.PI * u), face: u < 0.45 ? 'closed' : 'wide', mouth: u < 0.5 ? 'o' : 'smile' }) });
    api.sfx(t + 0.1, 'gasp', { ...voice, gain: 0.4 });
  };
  A.point = (t, p, api) => {
    const d = p.dur ?? 1.3;
    if (p.at) actions.turn(t, { to: p.at, dur: 0.3, hold: d }, api);
    add({ t0: t, dur: d, fadeIn: 0.12, fadeOut: 0.25, fn: () => ({ handR: [-0.4, 1.6, 3.4], lean: 0.08, face: 'wide', mouth: 'o', ...(p.at ? { lookAt: p.at } : {}) }) });
  };
  A.clap = (t, p, api) => {
    const n = p.count ?? 4, per = 0.28, d = n * per + 0.2;
    add({ t0: t, dur: d, fadeIn: 0.08, fadeOut: 0.15, fn: (u, tl) => { const k = 0.5 + 0.5 * Math.cos((tl / per) * TAU); return { handL: [-handX * (1 - 0.35 * k) + 0.3, 1.4, 2.2], handR: [-handX * (1 - 0.35 * k) + 0.3, 1.4, 2.2], face: 'happy', mouth: 'grin', squash: 0.02 * k }; } });
    for (let i = 0; i < n; i++) api.sfx(t + (i + 0.5) * per, 'pop', { gain: 0.35, pitch: 1.9 });
  };
  const dance = (style) => (t, p, api) => {
    const d = p.dur ?? 2.4, bpm = p.bpm ?? 116, f = bpm / 60;
    const st = p.style || style;
    add({ t0: t, dur: d, fadeIn: 0.15, fadeOut: 0.3, fn: (u, tl) => {
      const b = tl * f, side = Math.floor(b) % 2 ? 1 : -1, hb = Math.abs(Math.sin(Math.PI * b));
      if (st === 'spin') { const turn = Math.floor(b / 2), w = (b / 2) % 1; return { spin: TAU * (turn + E.inOutSine(w)), jump: 0.8 * hb, handL: [1.6, 1.4, 0], handR: [1.6, 1.4, 0], face: 'happy', mouth: 'grin', wag: 1 }; }
      if (st === 'sway') return { bank: Math.sin(Math.PI * b) * 0.22, offX: Math.sin(Math.PI * b) * V * 1.2, handL: [0.4, 2.6 + Math.sin(Math.PI * b) * 0.8, 0.6], handR: [0.4, 2.6 - Math.sin(Math.PI * b) * 0.8, 0.6], face: 'closed', mouth: 'smile', squash: 0.03 * hb, wag: 1 };
      return { jump: 1.6 * hb, squash: 0.1 * Math.cos(TAU * b), bank: side * 0.12, handL: [0.2, side < 0 ? 3.2 : 0.6, 0.4], handR: [0.2, side > 0 ? 3.2 : 0.6, 0.4], face: 'happy', mouth: 'laugh', wag: 1 };
    } });
    api.sfx(t, 'cheer', { ...voice, gain: 0.4 });
  };
  A.dance = dance('bounce'); A['dance-bounce'] = dance('bounce'); A['dance-spin'] = dance('spin'); A['dance-sway'] = dance('sway');
  A.drink = (t, p, api) => {
    const d = p.dur ?? 1.4;
    add({ t0: t, dur: d, fadeIn: 0.15, fadeOut: 0.25, fn: (u, tl) => ({ handR: [mouthAt[0], mouthAt[1] + 0.8, mouthAt[2] + 0.2], lookY: 0.55, lean: -0.15, face: tl > 0.3 ? 'closed' : 'normal', mouth: 'small', squash: tl > 0.3 ? Math.sin(tl * TAU * 2.5) * 0.02 : 0 }) });
    for (let k = 0; k < 3; k++) api.sfx(t + 0.4 + k * 0.3, 'pop', { gain: 0.3, pitch: 0.55 });
  };
  A.carry = (t, p, api) => { const end = until(t, { hold: true, ...p }, api, 2); add({ t0: t, dur: end - t, fadeIn: 0.2, fadeOut: 0.2, fn: () => ({ handL: [-0.6, 0.6, 3.0], handR: [-0.6, 0.6, 3.0], lean: -0.06 }) }); };
  A.pull = (t, p, api) => {
    const end = until(t, p, api, 1.2);
    if (p.path || p.to) actions.walk(t, { speed: 5, ...p }, api);
    add({ t0: t, dur: end - t, fadeIn: 0.15, fadeOut: 0.2, fn: (u, tl) => ({ lean: -0.32, handL: [-0.5, 0.6, 3], handR: [-0.5, 0.6, 3], footL: [0, 0, 1.4], footR: [0, 0, 1.0], face: 'determined', mouth: 'flat', squash: Math.sin(tl * 10) * 0.03 }) });
    api.sfx(t, 'creak', { gain: 0.4, dur: Math.min(1.2, end - t) });
  };
  A.throw = (t, p, api) => {
    const d = p.dur ?? 0.75, rel = d * 0.45;
    anticipation(t, 0.1, 0.1);
    add({ t0: t, dur: d, fadeIn: 0.06, fadeOut: 0.2, fn: (u, tl) => { const k = tl < rel ? E.outCubic(tl / rel) : 1 - E.outCubic((tl - rel) / (d - rel)) * 0.3; const fwd = tl > rel; return { handR: fwd ? [-0.2, 2.6, 3.4 * k] : [0.4, 2.2 * k, -2 * k], lean: fwd ? 0.25 : -0.15 * k, spin: fwd ? -0.2 : 0.25 * k, face: 'determined', mouth: fwd ? 'o' : 'flat' }; } });
    api.sfx(t + rel, 'whoosh', { dur: 0.35, gain: 0.5 });
  };
  A.kick = (t, p, api) => {
    const d = p.dur ?? 0.6;
    add({ t0: t, dur: d, fadeIn: 0.05, fadeOut: 0.15, fn: (u) => { const k = Math.sin(Math.PI * Math.min(1, u * 1.3)); return { footR: [0, 1.6 * k, 2.8 * k], lean: -0.18 * k, handL: [0.8, 1.2 * k, 0], handR: [0.8, 1.2 * k, 0], face: 'determined', mouth: 'grin' }; } });
    api.sfx(t + d * 0.38, 'thud', { gain: 0.6 });
  };
  A.climb = (t, p, api) => {
    const d = p.dur ?? 1.4;
    if (p.to) motion.arc(t + 0.1, api.point(p.to), { dur: d - 0.1, apex: p.height ?? 2 });
    add({ t0: t, dur: d, fadeIn: 0.1, fadeOut: 0.2, fn: (u, tl) => { const a = Math.sin(tl * TAU * 2.2); return { handL: [-0.2, 2.4 + a, 1.6], handR: [-0.2, 2.4 - a, 1.6], footL: [0, 0.6 + Math.max(0, -a) * 0.8, 0.6], footR: [0, 0.6 + Math.max(0, a) * 0.8, 0.6], lean: 0.1, face: 'determined', mouth: 'flat', squash: 0.04 * a }; } });
    if (p.to) landSquash(t + d, 0.4);
    api.sfx(t, 'lift', voice);
  };
  A.swim = (t, p, api) => {
    if (p.path || p.to) actions.walk(t, { speed: 12, ...p }, api);
    if (MODE === 'swim') return;
    const d = p.dur ?? Math.min(4, api.next() - t);
    add({ t0: t, dur: Math.max(0.5, d), fadeIn: 0.3, fadeOut: 0.3, fn: (u, tl) => { const a = tl * TAU * 1.4; return { lean: 1.2, jump: D * 0.35 + 0.4, handL: [0.2, Math.sin(a) * 1.4, Math.cos(a) * 2.4], handR: [0.2, Math.sin(a + Math.PI) * 1.4, Math.cos(a + Math.PI) * 2.4], footL: [0, 0.6 + Math.sin(a * 2) * 0.4, -0.6], footR: [0, 0.6 - Math.sin(a * 2) * 0.4, -0.6], face: 'determined', mouth: 'small', lookY: 0.9 }; } });
  };
  A['fly-takeoff'] = (t, p, api) => {
    const rise = p.dur ?? 0.8;
    anticipation(t, 0.18, 0.15);
    flights.takeoff(t, p.height ?? Math.max(H * 0.9, 5), rise);
    add({ t0: t, dur: rise + 0.3, fadeIn: 0.05, fadeOut: 0.3, fn: (u) => ({ handL: [0.8, 2.4, -0.4], handR: [0.8, 2.4, -0.4], face: 'wide', mouth: 'o', squash: 0.1 * Math.sin(Math.PI * u) }) });
    api.sfx(t, 'whoosh', { dur: rise, gain: 0.6 }); api.sfx(t, 'hop', voice);
  };
  A.fly = (t, p, api) => {
    if (!flights.active(t)) flights.takeoff(t, p.height ?? Math.max(H * 0.9, 5), 0.5);
    if (p.path || p.to) actions.walk(t, { speed: p.speed ?? 26, ...p }, api);
    const d = p.dur ?? Math.min(6, api.next() - t);
    add({ t0: t, dur: Math.max(0.4, d), fadeIn: 0.2, fadeOut: 0.3, fn: (u, tl) => ({ handL: [0.9, 1.8 + Math.sin(tl * TAU * 4) * 0.8, 0], handR: [0.9, 1.8 + Math.sin(tl * TAU * 4) * 0.8, 0], face: 'happy', mouth: 'grin', wag: 0.5 }) });
    api.sfx(t, 'whoosh', { dur: Math.min(1.2, d), gain: 0.4 });
  };
  A.dizzy = (t, p, api) => {
    const d = p.dur ?? 1.4;
    add({ t0: t, dur: d, fadeIn: 0.1, fadeOut: 0.3, fn: (u, tl) => ({ face: 'dizzy', mouth: 'wobbly', bank: Math.sin(tl * 9) * 0.2 * (1 - u * 0.5), spin: Math.sin(tl * 4.5) * 0.3 * (1 - u), lean: -0.05 }) });
    api.sfx(t, 'teeter', { dur: d * 0.8, gain: 0.5 });
    api.fx('orbitStars', { t0: t, t1: t + d, at: (tt) => K.inst().anchorAt('head', tt), radius: W * 0.55, height: 0.6, size: V * 0.42, seed: Math.round(t * 10) + 3 });
  };
  A.cry = (t, p, api) => {
    const d = p.dur ?? 2;
    add({ t0: t, dur: d, fadeIn: 0.15, fadeOut: 0.3, fn: (u, tl) => ({ face: 'closed', brow: 'worried', mouth: 'wobbly', squash: Math.abs(Math.sin(tl * TAU * 2.4)) * 0.035 - 0.03, lean: 0.1, handL: [mouthAt[0] + 0.4, mouthAt[1] + 1.8, mouthAt[2]], handR: [mouthAt[0] + 0.4, mouthAt[1] + 1.8, mouthAt[2]] }) });
    for (let k = 0; k < d - 0.3; k += 0.5) api.fx('burst', { t0: t + k + 0.2, at: api.point(api.self + '.face', t + k), count: 6, speed: [6, 14], up: 0.4, gravity: 60, voxel: false, colors: ['#8fd0ff', '#c8ecff'], size: V * 0.5, life: 0.8, floorY: -1e4, seed: Math.round((t + k) * 100) });
    for (let k = 0; k < d; k += 0.7) api.sfx(t + k, 'sniff', { count: 2, ...voice, gain: 0.5 });
  };
  A.angry = (t, p, api) => {
    const d = p.dur ?? 1.6, n = p.stomps ?? 3;
    add({ t0: t, dur: d, fadeIn: 0.08, fadeOut: 0.25, fn: (u, tl) => { const ph = (tl / d) * n, f = ph % 1; return { jump: ph < n ? 0.9 * 4 * f * (1 - f) : 0, squash: -0.06 + 0.06 * Math.cos(f * TAU), face: 'normal', brow: 'determined', mouth: 'grr', handL: [-0.4, -0.6, 0.8], handR: [-0.4, -0.6, 0.8], lean: 0.1, bank: Math.sin(tl * 30) * 0.02 }; } });
    for (let i = 1; i <= n; i++) api.sfx(t + (i / n) * d - 0.02, 'thud', { gain: 0.5, pitch: 0.8 });
  };
  A.scared = (t, p, api) => {
    const d = p.dur ?? 1.5;
    add({ t0: t, dur: d, fadeIn: 0.05, fadeOut: 0.3, fn: (u, tl) => ({ bank: Math.sin(tl * TAU * 11) * 0.05, lean: -0.2, squash: -0.09, face: 'wide', brow: 'worried', mouth: 'wobbly', eyeScale: 0.2, handL: [-0.6, 2.4, 1.6], handR: [-0.6, 2.4, 1.6] }) });
    api.sfx(t, 'gasp', voice);
  };
  A.shy = (t, p, api) => {
    const d = p.dur ?? 1.8;
    add({ t0: t, dur: d, fadeIn: 0.3, fadeOut: 0.4, fn: (u, tl) => ({ blush: 1, face: 'happy', mouth: 'small', lookX: -0.6, lookY: -0.5, handL: [-handX * 0.6, -0.6, 1.4], handR: [-handX * 0.6, -0.6, 1.4], bank: Math.sin(tl * TAU / 1.6) * 0.07, spin: -0.25 * smoothstep(0, 0.2, u) }) });
  };
  A.think = (t, p, api) => {
    const d = p.dur ?? 1.8;
    add({ t0: t, dur: d, fadeIn: 0.2, fadeOut: 0.3, fn: (u, tl) => ({ handR: [mouthAt[0] + 0.6, mouthAt[1] - 0.6, mouthAt[2] - 0.2], lookY: 0.7, lookX: 0.45, face: 'normal', brow: 'raised', mouth: 'flat', bank: 0.08 * smoothstep(0, 0.3, u) }) });
    if (p.idea !== false) api.fx('sparkles', { t0: t + d * 0.75, t1: t + d + 0.4, at: api.point(api.self + '.head', t + d * 0.75), radius: W * 0.35, count: 10, size: V * 0.7, seed: Math.round(t * 10) + 5 });
  };
  A.talk = (t, p, api) => {
    const d = p.dur ?? 1.6, rate = p.rate ?? 7, seq = ['o', 'small', 'flat', 'smile', 'grin', 'o', 'small'];
    if (p.at || p.to) actions.look(t, { at: p.at || p.to, dur: d, turn: !!p.turn }, api);
    add({ t0: t, dur: d, fadeIn: 0.05, fadeOut: 0.12, fn: (u, tl) => { const syl = Math.floor(tl * rate); const open = (tl * rate) % 1 < 0.7; return { mouth: open ? seq[Math.floor(hash(syl, 17) * seq.length)] : 'flat', lean: Math.sin(tl * TAU * 2.2) * 0.04, handR: [0.3, 1 + Math.max(0, Math.sin(tl * TAU * 0.9)) * 1.2, 1.2], face: p.eyes || 'normal' }; } });
  };
  A['look-at'] = (t, p, api) => actions.look(t, { turn: true, ...p }, api);
  A.nod = (t, p, api) => { const d = p.dur ?? 0.9, n = p.count ?? 2; add({ t0: t, dur: d, fadeIn: 0.05, fadeOut: 0.15, fn: (u, tl) => ({ lean: 0.16 * Math.max(0, Math.sin((tl / d) * n * TAU)), lookY: -0.25, face: 'happy', mouth: 'smile' }) }); };
  A['shake-head'] = (t, p, api) => { const d = p.dur ?? 0.9; add({ t0: t, dur: d, fadeIn: 0.05, fadeOut: 0.15, fn: (u, tl) => ({ spin: Math.sin(tl * TAU * 3) * 0.32 * (1 - u * 0.5), face: 'closed', mouth: 'flat', brow: 'worried' }) }); };
  return A;
}
