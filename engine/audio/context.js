// engine/audio/context.js — small Web Audio helpers shared by instruments, SFX and music cues.
//   freq('D4') → 293.66   ·  envelope(gain.gain, t, { a, d, s, r, dur, peak })  ·  noiseBuffer(ctx, sec, seed)
//   out = channel(ctx, dest, { gain, pan })  — a gain → stereo-panner strip feeding `dest`
import { rng } from '../core/rng.js';

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Note name ('A4', 'F#3', 'Bb5') or MIDI number → Hz. */
export function freq(n) {
  if (typeof n === 'number') return 440 * Math.pow(2, (n - 69) / 12);
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error('bad note ' + n);
  const midi = 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
export const midiOf = (n) => (typeof n === 'number' ? n : Math.round(69 + 12 * Math.log2(freq(n) / 440)));
export const transpose = (n, semis) => midiOf(n) + semis;

/** ADSR on an AudioParam. dur = time from note-on to release start. */
export function envelope(param, t, { a = 0.005, d = 0.1, s = 0.5, r = 0.2, dur = 0.3, peak = 1, floor = 0.0001 } = {}) {
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setTargetAtTime(peak * s, t + a, d / 3);
  const rel = t + Math.max(dur, a);
  param.setTargetAtTime(floor, rel, r / 4);
  return rel + r * 1.5;
}
/** Percussive exponential decay envelope (time constant tau). Returns stop time. */
export function decay(param, t, { a = 0.002, peak = 1, tau = 0.1 } = {}) {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setTargetAtTime(0.0001, t + a, tau);
  return t + a + tau * 7;
}

const noiseCache = new WeakMap();
/** Seeded white-noise buffer (cached per context + length + seed). */
export function noiseBuffer(ctx, seconds = 2, seed = 1) {
  let m = noiseCache.get(ctx);
  if (!m) noiseCache.set(ctx, (m = new Map()));
  const k = `${seconds}:${seed}`;
  if (m.has(k)) return m.get(k);
  const n = Math.floor(seconds * ctx.sampleRate), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), r = rng(seed);
  for (let i = 0; i < n; i++) d[i] = r.next() * 2 - 1;
  m.set(k, buf);
  return buf;
}
/** Noise source starting at t (offset into the buffer chosen by seed so repeats differ). */
export function noise(ctx, t, dur, seed = 1) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, 2, 7);
  s.loop = true;
  s.start(t, ((seed * 0.6180339) % 1) * 1.9, dur + 0.05);
  return s;
}
export function channel(ctx, dest, { gain = 1, pan = 0 } = {}) {
  const g = ctx.createGain(); g.gain.value = gain;
  const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(dest);
  return g;
}
export function filter(ctx, type, frequency, Q = 0.7, gain = 0) {
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = Q; f.gain.value = gain; return f;
}
export function osc(ctx, type, frequency, t, stop) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(frequency, t); o.start(t); o.stop(stop); return o;
}
