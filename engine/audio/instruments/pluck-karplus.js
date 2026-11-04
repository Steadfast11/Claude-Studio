// engine/audio/instruments/pluck-karplus.js — plucked strings by Karplus–Strong, computed sample-by-sample in JS
// (fractional-delay tuned) into AudioBuffers, then shaped by a resonant body. Timbres: 'dutar' (warm, doubled
// silk strings), 'rubab' (bright, snappy), 'harp' (clean).
//   pluck(ctx, out, t, { note: 'D4', vel: 0.8, timbre: 'dutar', decay: 3, pan: -0.2 })
import { freq } from '../context.js';
import { rng } from '../../core/rng.js';

const cache = new Map();
const TIMBRES = {
  dutar: { decay: 3.2, bright: 0.28, pos: 0.22, body: [[210, 5, 2.2], [480, 4, 2.5], [2600, -5, 0.8]], double: 0.0045 },
  rubab: { decay: 2.2, bright: 0.48, pos: 0.12, body: [[320, 4, 2], [1250, 5, 2.5], [3400, 2, 1]], double: 0 },
  harp: { decay: 2.8, bright: 0.4, pos: 0.3, body: [[400, 2, 1]], double: 0 },
};

function ksBuffer(ctx, f, { decay, bright, pos, seed }) {
  const sr = ctx.sampleRate, key = `${f.toFixed(2)}:${decay}:${bright}:${pos}:${seed % 4}:${sr}`;
  if (cache.has(key) && cache.get(key).ctx === ctx) return cache.get(key).buf;
  const dur = Math.min(decay * 1.3, 5), n = Math.floor(dur * sr);
  const buf = ctx.createBuffer(1, n, sr), y = buf.getChannelData(0);
  const L = sr / f - 0.5; // averaging filter adds half a sample of delay
  const Li = Math.floor(L), frac = L - Li, C = (1 - frac) / (1 + frac);
  const g = Math.pow(10, -3 / (f * decay)); // loop gain for a T60 of `decay` seconds
  const S = 0.5 - bright * 0.45;              // 0.5 = darkest
  const r = rng(seed);
  // excitation: lowpassed noise burst, combed at the pluck position
  const exc = new Float32Array(Li + 2);
  let lp = 0;
  for (let i = 0; i < exc.length; i++) { lp += (r.range(-1, 1) - lp) * (0.25 + bright * 0.7); exc[i] = lp; }
  const pp = Math.max(1, Math.round(pos * Li));
  for (let i = exc.length - 1; i >= pp; i--) exc[i] -= exc[i - pp];
  let apX = 0, apY = 0;
  for (let i = 0; i < n; i++) {
    const a = i - Li >= 0 ? y[i - Li] : 0, b = i - Li - 1 >= 0 ? y[i - Li - 1] : 0;
    const avg = (1 - S) * a + S * b;
    const ap = C * avg + apX - C * apY; apX = avg; apY = ap; // fractional delay (allpass)
    y[i] = (i < exc.length ? exc[i] : 0) + g * ap;
  }
  let peak = 0; for (let i = 0; i < Math.min(n, 4000); i++) peak = Math.max(peak, Math.abs(y[i]));
  const k = 0.6 / (peak || 1); for (let i = 0; i < n; i++) y[i] *= k;
  cache.set(key, { ctx, buf });
  return buf;
}

export function pluck(ctx, out, t, { note = 'D4', vel = 0.8, timbre = 'dutar', decay, pan = 0, seed = 1, detune = 0 } = {}) {
  const T = TIMBRES[timbre] || TIMBRES.dutar;
  const f = freq(note) * Math.pow(2, detune / 1200);
  const strings = T.double ? [f * (1 - T.double), f * (1 + T.double)] : [f];
  // resonant body: a chain of peaking filters
  const head = ctx.createGain();
  const tail = T.body.reduce((node, [fr, gain, q]) => {
    const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = fr; b.gain.value = gain; b.Q.value = q;
    node.connect(b);
    return b;
  }, head);
  const g = ctx.createGain(); g.gain.value = vel * 0.5;
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  tail.connect(g).connect(p).connect(out);
  strings.forEach((fs, i) => {
    const src = ctx.createBufferSource();
    src.buffer = ksBuffer(ctx, fs, { decay: decay ?? T.decay, bright: T.bright * (0.7 + vel * 0.5), pos: T.pos, seed: seed + i });
    src.connect(head);
    src.start(t + i * 0.004);
  });
}
