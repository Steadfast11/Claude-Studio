// engine/audio/mix.js — mixer: buses → generated-IR reverb → glue compressor → limiter, plus offline loudness
// normalisation (ITU-R BS.1770 K-weighted, gated integrated loudness) with a look-ahead peak limiter.
//   const mix = createMix(ctx, { seed });  src.connect(mix.bus('sfx'));   // buses: music, sfx, foley, amb, dry
//   normalizeLoudness(audioBuffer, -16, -1);                             // in place
import { rng } from '../core/rng.js';

const SENDS = { music: 0.22, sfx: 0.16, foley: 0.08, amb: 0.3, dry: 0 };

/** Stereo impulse response: sparse early reflections + exponentially decaying, darkening noise tail. */
export function makeImpulse(ctx, { seconds = 1.8, decay = 2.6, damping = 0.9, seed = 1 } = {}) {
  const sr = ctx.sampleRate, n = Math.floor(seconds * sr), ir = ctx.createBuffer(2, n, sr), r = rng(seed);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, env = Math.pow(1 - t / seconds, decay) * Math.exp(-t * 1.5);
      const k = 0.08 + (1 - damping * Math.min(1, t / seconds * 1.4)) * 0.9; // tail gets darker over time
      lp += (r.range(-1, 1) - lp) * k;
      d[i] = lp * env;
    }
    for (let e = 0; e < 9; e++) { const at = Math.floor(sr * (0.007 + e * 0.011 + r.range(0, 0.006))); if (at < n) d[at] += r.range(0.2, 0.5) * (1 - e / 10) * (r.next() < 0.5 ? -1 : 1); }
  }
  return ir;
}

export function createMix(ctx, { seed = 1, room = {} } = {}) {
  const master = ctx.createGain(); master.gain.value = 0.8;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18; glue.ratio.value = 2.5; glue.knee.value = 8; glue.attack.value = 0.015; glue.release.value = 0.25;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.ratio.value = 20; limiter.knee.value = 0; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  master.connect(glue).connect(limiter).connect(ctx.destination);
  const verb = ctx.createConvolver();
  verb.buffer = makeImpulse(ctx, { seed, ...room });
  const verbOut = ctx.createGain(); verbOut.gain.value = room.wet ?? 1;
  const verbHP = ctx.createBiquadFilter(); verbHP.type = 'highpass'; verbHP.frequency.value = 180;
  verbHP.connect(verb).connect(verbOut).connect(master);
  const buses = {};
  const bus = (name) => {
    if (buses[name]) return buses[name];
    const g = ctx.createGain();
    g.connect(master);
    const s = ctx.createGain(); s.gain.value = SENDS[name] ?? 0.15;
    g.connect(s).connect(verbHP);
    return (buses[name] = g);
  };
  return { master, bus, ctx };
}

// ---------- loudness ----------
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
/** K-weighting coefficients for any sample rate (BS.1770-4 pre-filter + RLB high-pass). */
function kCoefs(fs) {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan((Math.PI * f0) / fs);
  a0 = 1 + K / Q + K * K;
  const hp = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  return { shelf, hp };
}
export function integratedLoudness(buffer) {
  const fs = buffer.sampleRate, { shelf, hp } = kCoefs(fs);
  const chans = [...Array(buffer.numberOfChannels)].map((_, c) => { const y = biquad(buffer.getChannelData(c), ...shelf); return biquad(y, ...hp); });
  const block = Math.round(0.4 * fs), step = Math.round(0.1 * fs), blocks = [];
  for (let s = 0; s + block <= buffer.length; s += step) {
    let z = 0;
    for (const y of chans) { let acc = 0; for (let i = s; i < s + block; i++) acc += y[i] * y[i]; z += acc / block; }
    blocks.push(z);
  }
  const L = (z) => -0.691 + 10 * Math.log10(Math.max(z, 1e-12));
  let g = blocks.filter((z) => L(z) > -70);
  if (!g.length) return -70;
  const rel = L(g.reduce((a, b) => a + b, 0) / g.length) - 10;
  g = g.filter((z) => L(z) > rel);
  return L(g.reduce((a, b) => a + b, 0) / g.length);
}
/** Look-ahead peak limiter (in place): gain envelope reaches the needed reduction before each peak. */
function limit(buffer, ceilLin) {
  const n = buffer.length, sr = buffer.sampleRate, look = Math.round(0.004 * sr), rel = Math.exp(-1 / (0.08 * sr));
  const ch = [...Array(buffer.numberOfChannels)].map((_, c) => buffer.getChannelData(c));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) { let p = 0; for (const d of ch) p = Math.max(p, Math.abs(d[i])); need[i] = p > ceilLin ? ceilLin / p : 1; }
  // backward min over look-ahead window, then smooth release forward
  const g = new Float32Array(n); let m = 1;
  for (let i = n - 1; i >= 0; i--) { m = Math.min(need[i], m + (1 - m) * (1 / look)); g[i] = m; }
  let cur = 1;
  for (let i = 0; i < n; i++) { cur = g[i] < cur ? g[i] : g[i] + (cur - g[i]) * rel; for (const d of ch) d[i] *= cur; }
}
export function normalizeLoudness(buffer, targetLufs = -16, ceilDb = -1) {
  const ceil = Math.pow(10, ceilDb / 20);
  for (let pass = 0; pass < 3; pass++) {
    const l = integratedLoudness(buffer);
    const gain = Math.pow(10, (targetLufs - l) / 20);
    if (Math.abs(targetLufs - l) < 0.2 && pass > 0) break;
    for (let c = 0; c < buffer.numberOfChannels; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= gain; }
    limit(buffer, ceil * 0.98);
  }
  return integratedLoudness(buffer);
}
