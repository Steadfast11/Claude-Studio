// engine/audio/sfx.js — synthesized sound effects, scheduled at timeline times. No samples.
//   playSfx(ctx, mix, 'bonk', 10.4, { pitch: 1 })     unknown names throw (list: Object.keys(SFX))
// Buses: 'foley' (steps, cloth), 'sfx' (cartoon hits, voices), 'amb' (room tone, birds, steam).
// `pitch` scales creature voices; `gain` scales level; all randomness is seeded from the event time.
import { noise, filter, decay, envelope, osc, freq } from './context.js';
import { bell } from './instruments/bell.js';
import { rng } from '../core/rng.js';

const seedOf = (t, k = 0) => Math.round(t * 1000) * 7 + k;
const pan = (ctx, dest, v) => { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, v)); p.connect(dest); return p; };
const gainNode = (ctx, dest, v = 1) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; };
/** A filtered noise burst. */
function burstNoise(ctx, dest, t, { type = 'bandpass', f = 1000, q = 1, peak = 0.5, tau = 0.05, a = 0.002, sweepTo, seed = 1 } = {}) {
  const n = noise(ctx, t, tau * 8 + 0.1, seed), fl = filter(ctx, type, f, q), g = ctx.createGain();
  if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + tau * 4);
  n.connect(fl).connect(g).connect(dest);
  decay(g.gain, t, { a, peak, tau });
}
/** A tone with a pitch glide and exponential decay (squeaks, boings, pops). */
function chirp(ctx, dest, t, { type = 'sine', f0 = 600, f1 = 1200, glide = 0.1, peak = 0.3, tau = 0.08, a = 0.004, vib = 0, vibRate = 18 } = {}) {
  const o = osc(ctx, type, f0, t, t + glide + tau * 8 + 0.1), g = ctx.createGain();
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + glide);
  if (vib) { const l = osc(ctx, 'sine', vibRate, t, t + glide + tau * 8), lg = ctx.createGain(); lg.gain.setValueAtTime(vib, t); lg.gain.setTargetAtTime(0, t, tau * 2); l.connect(lg).connect(o.frequency); }
  o.connect(g).connect(dest);
  decay(g.gain, t, { a, peak, tau });
}
/** Cartoon voice syllable: band-limited buzz with formant + pitch contour (cute creature squeaks). */
function voice(ctx, dest, t, { f0 = 700, f1 = 900, dur = 0.12, peak = 0.25, formant = 1800, vib = 0.04 } = {}) {
  const o = osc(ctx, 'sawtooth', f0, t, t + dur + 0.2);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const l = osc(ctx, 'sine', 9, t, t + dur + 0.2), lg = ctx.createGain(); lg.gain.value = f0 * vib; l.connect(lg).connect(o.frequency);
  const fl = filter(ctx, 'bandpass', formant, 3), lp = filter(ctx, 'lowpass', 4200), g = ctx.createGain();
  o.connect(fl).connect(lp).connect(g).connect(dest);
  envelope(g.gain, t, { a: 0.012, d: 0.05, s: 0.8, r: 0.05, dur, peak });
}

export const SFX = {
  // ---------- ambience ----------
  'room-tone'(ctx, out, t, { dur = 20, level = 1, birds = true, seed = 3 }) {
    const n = noise(ctx, t, dur + 0.5, 99), lp = filter(ctx, 'lowpass', 650), g = gainNode(ctx, out('amb'), 0.016 * level);
    n.connect(lp).connect(g);
    if (!birds) return;
    const r = rng(seed); // distant sparrows / swifts outside the window
    for (let tt = t + r.range(0.3, 1.5); tt < t + dur; tt += r.range(0.8, 2.6)) {
      const p = pan(ctx, out('amb'), r.range(-0.8, 0.8)), base = r.range(3200, 5200), count = r.int(1, 4);
      for (let k = 0; k < count; k++) chirp(ctx, p, tt + k * r.range(0.07, 0.12), { f0: base, f1: base * r.range(0.6, 1.3), glide: 0.05, peak: 0.012 * level, tau: 0.03 });
    }
  },
  steam(ctx, out, t, { dur = 20, level = 1 }) {
    const n = noise(ctx, t, dur, 41), hp = filter(ctx, 'highpass', 5000), g = gainNode(ctx, out('amb'), 0.006 * level);
    n.connect(hp).connect(g);
  },
  // ---------- foley ----------
  step(ctx, out, t, { speed = 20, size = 1, foot = 0, gain = 1 }) {
    const k = Math.min(1, 0.35 + speed / 90) * gain, s = seedOf(t, foot), r = rng(s);
    const p = pan(ctx, out('foley'), foot ? 0.08 : -0.08);
    burstNoise(ctx, p, t, { type: 'lowpass', f: 900 + speed * 12 + r.range(-150, 150), q: 0.8, peak: 0.38 * k, tau: 0.018 + 0.01 / size, seed: s });
    chirp(ctx, p, t, { f0: 150 / size + r.range(-15, 15), f1: 90 / size, glide: 0.03, peak: 0.28 * k, tau: 0.025 });
  },
  land(ctx, out, t, { gain = 1 }) {
    const p = out('foley');
    chirp(ctx, p, t, { f0: 140, f1: 60, glide: 0.06, peak: 0.6 * gain, tau: 0.06 });
    burstNoise(ctx, p, t, { type: 'lowpass', f: 1100, peak: 0.45 * gain, tau: 0.04, seed: seedOf(t) });
  },
  thud(ctx, out, t, { gain = 1, pitch = 1 }) {
    chirp(ctx, out('foley'), t, { f0: 110 * pitch, f1: 55 * pitch, glide: 0.08, peak: 0.75 * gain, tau: 0.08 });
    burstNoise(ctx, out('foley'), t, { type: 'lowpass', f: 600, peak: 0.5 * gain, tau: 0.05, seed: seedOf(t) });
  },
  /** Rolling voxel fruit: low rumble following real speed + a tiny clack each time a facet rolls over. */
  roll(ctx, out, t, { speeds = [], step = 1 / 30, radius = 4, facets = 12, gain = 1 }) {
    if (!speeds.length) return;
    const dur = speeds.length * step, n = noise(ctx, t, dur + 0.2, seedOf(t)), lp = filter(ctx, 'lowpass', 300, 1.5), g = ctx.createGain();
    n.connect(lp).connect(g).connect(out('foley'));
    g.gain.setValueAtTime(0, t);
    speeds.forEach((v, i) => { const tt = t + i * step; g.gain.linearRampToValueAtTime(Math.min(1, v / 60) * 0.35 * gain, tt); lp.frequency.linearRampToValueAtTime(180 + v * 9, tt); });
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    const facet = (2 * Math.PI * radius) / facets;
    let dist = 0, next = facet;
    speeds.forEach((v, i) => {
      dist += v * step;
      while (dist >= next) { const tt = t + i * step; burstNoise(ctx, out('foley'), tt, { f: 2200, q: 2, peak: 0.12 * Math.min(1, v / 40) * gain, tau: 0.008, seed: Math.round(next) }); next += facet; }
    });
  },
  skid(ctx, out, t, { dur = 0.45, gain = 1 }) {
    const n = noise(ctx, t, dur + 0.2, seedOf(t)), bp = filter(ctx, 'bandpass', 2600, 4), g = ctx.createGain();
    bp.frequency.setValueAtTime(3200, t); bp.frequency.linearRampToValueAtTime(1600, t + dur);
    n.connect(bp).connect(g).connect(out('foley'));
    envelope(g.gain, t, { a: 0.02, d: 0.1, s: 0.7, r: 0.1, dur, peak: 0.5 * gain });
    chirp(ctx, out('sfx'), t, { type: 'triangle', f0: 1900, f1: 1300, glide: dur, peak: 0.07 * gain, tau: dur * 0.5, vib: 120, vibRate: 30 });
  },
  creak(ctx, out, t, { dur = 0.9, gain = 1 }) {
    const o = osc(ctx, 'sawtooth', 95, t, t + dur + 0.2), bp = filter(ctx, 'bandpass', 900, 6), g = ctx.createGain();
    for (let k = 0; k < 6; k++) o.frequency.setValueAtTime(85 + ((k * 37) % 40), t + (k / 6) * dur);
    o.connect(bp).connect(g).connect(out('foley'));
    envelope(g.gain, t, { a: 0.05, d: 0.2, s: 0.6, r: 0.15, dur, peak: 0.18 * gain });
  },
  catch(ctx, out, t, { gain = 1 }) {
    burstNoise(ctx, out('foley'), t, { type: 'lowpass', f: 1400, peak: 0.5 * gain, tau: 0.03, seed: seedOf(t) });
    chirp(ctx, out('foley'), t, { f0: 220, f1: 120, glide: 0.04, peak: 0.4 * gain, tau: 0.04 });
  },
  // ---------- cartoon hits ----------
  hop(ctx, out, t, { pitch = 1, gain = 1 }) {
    chirp(ctx, pan(ctx, out('sfx'), 0.1), t, { type: 'sine', f0: 260 * pitch, f1: 720 * pitch, glide: 0.11, peak: 0.22 * gain, tau: 0.09, vib: 60 * pitch, vibRate: 22 });
  },
  bonk(ctx, out, t, { pitch = 1, gain = 1 }) {
    const s = out('sfx');
    chirp(ctx, s, t, { type: 'triangle', f0: 1050, f1: 230, glide: 0.09, peak: 0.6 * gain, tau: 0.09 });
    chirp(ctx, s, t, { type: 'square', f0: 340, f1: 180, glide: 0.05, peak: 0.12 * gain, tau: 0.05 });
    burstNoise(ctx, s, t, { f: 1800, q: 1.2, peak: 0.6 * gain, tau: 0.02, seed: seedOf(t) });
    // dizzy "tweety" warble after the hit
    for (let k = 0; k < 3; k++) chirp(ctx, pan(ctx, s, k % 2 ? 0.4 : -0.4), t + 0.25 + k * 0.22, { f0: 2400 * pitch, f1: 3100 * pitch, glide: 0.08, peak: 0.05 * gain, tau: 0.06, vib: 200, vibRate: 30 });
  },
  'ceramic-ring'(ctx, out, t, { pitch = 1, gain = 1, size = 4 }) {
    bell(ctx, out('sfx'), t, { hz: 1650 * pitch * (4 / Math.max(size, 1)) ** 0.3, kind: 'cup', vel: 0.9 * gain, pan: 0.15 });
    burstNoise(ctx, out('sfx'), t, { type: 'highpass', f: 3500, peak: 0.3 * gain, tau: 0.01, seed: seedOf(t) });
  },
  'slide-whistle'(ctx, out, t, { from = 1300, to = 380, dur = 0.5, gain = 1 }) {
    const o = osc(ctx, 'sine', from, t, t + dur + 0.2), g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const l = osc(ctx, 'sine', 6, t, t + dur), lg = ctx.createGain(); lg.gain.value = 25; l.connect(lg).connect(o.frequency);
    o.connect(g).connect(out('sfx'));
    envelope(g.gain, t, { a: 0.03, d: 0.1, s: 0.8, r: 0.08, dur, peak: 0.13 * gain });
  },
  whoosh(ctx, out, t, { dur = 0.8, gain = 1, rise = true }) {
    const n = noise(ctx, t, dur + 0.3, seedOf(t)), bp = filter(ctx, 'bandpass', rise ? 300 : 2500, 1.3), g = ctx.createGain(), p = ctx.createStereoPanner();
    bp.frequency.exponentialRampToValueAtTime(rise ? 2800 : 300, t + dur);
    p.pan.setValueAtTime(-0.6, t); p.pan.linearRampToValueAtTime(0.6, t + dur);
    n.connect(bp).connect(g).connect(p).connect(out('sfx'));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * gain, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
  },
  sparkle(ctx, out, t, { gain = 1, count = 9, seed }) {
    const r = rng(seed ?? seedOf(t));
    for (let k = 0; k < count; k++) bell(ctx, out('sfx'), t + k * r.range(0.04, 0.09), { hz: r.range(2400, 5200), kind: 'glass', vel: 0.35 * gain * (1 - k / (count + 2)), pan: r.range(-0.7, 0.7), decay: 1 });
  },
  crack(ctx, out, t, { gain = 1 }) {
    const s = out('sfx');
    burstNoise(ctx, s, t, { type: 'highpass', f: 2500, peak: 0.9 * gain, tau: 0.012, seed: seedOf(t) });
    burstNoise(ctx, s, t + 0.012, { f: 1100, q: 3, peak: 0.6 * gain, tau: 0.035, seed: seedOf(t, 1) });
    burstNoise(ctx, s, t + 0.03, { f: 1800, q: 6, peak: 0.35 * gain, tau: 0.09, sweepTo: 500, seed: seedOf(t, 2) }); // juicy squelch
  },
  burst(ctx, out, t, { gain = 1 }) {
    burstNoise(ctx, out('sfx'), t, { type: 'lowpass', f: 900, peak: 0.6 * gain, tau: 0.12, seed: seedOf(t) });
    chirp(ctx, out('sfx'), t, { f0: 180, f1: 70, glide: 0.15, peak: 0.4 * gain, tau: 0.12 });
    SFX.sparkle(ctx, out, t + 0.05, { gain: 1.2 * gain, count: 16, seed: seedOf(t, 3) });
  },
  pop(ctx, out, t, { gain = 1, pitch = 1 }) { chirp(ctx, out('sfx'), t, { f0: 1300 * pitch, f1: 320 * pitch, glide: 0.03, peak: 0.35 * gain, tau: 0.03 }); },
  teeter(ctx, out, t, { dur = 1.4, gain = 1 }) {
    const o = osc(ctx, 'sine', 820, t, t + dur + 0.2), g = ctx.createGain(), l = osc(ctx, 'sine', 3.2, t, t + dur), lg = ctx.createGain();
    lg.gain.setValueAtTime(160, t); lg.gain.linearRampToValueAtTime(20, t + dur); l.connect(lg).connect(o.frequency);
    o.connect(g).connect(out('sfx'));
    envelope(g.gain, t, { a: 0.05, d: 0.2, s: 0.7, r: 0.2, dur, peak: 0.06 * gain });
  },
  // ---------- creature voice ----------
  gasp(ctx, out, t, { pitch = 1, gain = 1 }) {
    burstNoise(ctx, out('sfx'), t, { f: 2600, q: 1.5, peak: 0.25 * gain, tau: 0.06, a: 0.03, seed: seedOf(t) }); // inhale
    voice(ctx, out('sfx'), t + 0.03, { f0: 620 * pitch, f1: 1350 * pitch, dur: 0.16, peak: 0.24 * gain, formant: 2200 });
  },
  sniff(ctx, out, t, { count = 3, gain = 1 }) {
    for (let k = 0; k < count; k++) burstNoise(ctx, out('sfx'), t + k * 0.17, { f: 3200 + k * 300, q: 2, peak: 0.22 * gain, tau: 0.035, a: 0.02, seed: seedOf(t, k) });
  },
  giggle(ctx, out, t, { dur = 1, pitch = 1, gain = 1 }) {
    const n = Math.max(3, Math.round(dur * 6));
    for (let k = 0; k < n; k++) voice(ctx, out('sfx'), t + k * (dur / n), { f0: (980 - k * 40) * pitch, f1: (1180 - k * 50) * pitch, dur: 0.07, peak: 0.16 * gain * (1 - k / (n * 1.6)), formant: 2400 });
  },
  cheer(ctx, out, t, { pitch = 1, gain = 1 }) {
    voice(ctx, out('sfx'), t, { f0: 700 * pitch, f1: 1000 * pitch, dur: 0.12, peak: 0.22 * gain, formant: 1900 });
    voice(ctx, out('sfx'), t + 0.15, { f0: 1100 * pitch, f1: 1500 * pitch, dur: 0.22, peak: 0.25 * gain, formant: 2300 });
  },
  lift(ctx, out, t, { pitch = 1, gain = 1 }) {
    voice(ctx, out('sfx'), t, { f0: 520 * pitch, f1: 560 * pitch, dur: 0.14, peak: 0.15 * gain, formant: 1500 });
    voice(ctx, out('sfx'), t + 0.2, { f0: 800 * pitch, f1: 1250 * pitch, dur: 0.2, peak: 0.2 * gain, formant: 2200 });
  },
  munch(ctx, out, t, { gain = 1 }) {
    burstNoise(ctx, out('foley'), t, { f: 1500, q: 0.8, peak: 0.3 * gain, tau: 0.03, seed: seedOf(t) });
    burstNoise(ctx, out('foley'), t + 0.04, { f: 900, q: 3, peak: 0.2 * gain, tau: 0.05, sweepTo: 400, seed: seedOf(t, 1) });
  },
  shake(ctx, out, t, { dur = 0.55, pitch = 1, gain = 1 }) {
    const o = osc(ctx, 'sawtooth', 210 * pitch, t, t + dur + 0.1), am = osc(ctx, 'square', 28, t, t + dur), amg = ctx.createGain(), g = ctx.createGain();
    amg.gain.value = 0.5; am.connect(amg).connect(g.gain);
    o.connect(filter(ctx, 'bandpass', 900, 2)).connect(g).connect(out('sfx'));
    envelope(g.gain, t, { a: 0.02, d: 0.1, s: 0.8, r: 0.08, dur, peak: 0.14 * gain });
  },
  note(ctx, out, t, { note = 'A5', gain = 1, kind = 'chime' }) { bell(ctx, out('sfx'), t, { hz: freq(note), kind, vel: 0.6 * gain }); },
};

export function playSfx(ctx, mix, name, t, params = {}) {
  const fn = SFX[name];
  if (!fn) throw new Error(`Unknown sfx "${name}". Known: ${Object.keys(SFX).join(', ')}`);
  fn(ctx, (bus) => mix.bus(bus), Math.max(0, t), params);
}
