// engine/audio/instruments/flute.js — nay (end-blown flute): breathy tone with delayed vibrato, breath noise
// and gentle portamento from the previous note.
//   flute(ctx, out, t, { note: 'A4', dur: 0.8, vel: 0.7, from: 'G4', vibrato: 1, pan: 0.2 })
import { freq, noise, filter, envelope } from '../context.js';

export function flute(ctx, out, t, { note = 'A4', dur = 0.6, vel = 0.7, from = null, vibrato = 1, pan = 0, seed = 1, breath = 1 } = {}) {
  const f = freq(note), stop = t + dur + 0.6;
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  const lp = filter(ctx, 'lowpass', 3200, 0.5);
  const amp = ctx.createGain();
  lp.connect(amp).connect(p).connect(out);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sine'; o2.type = 'triangle';
  const f0 = from ? freq(from) : f;
  for (const [o, k] of [[o1, 1], [o2, 2]]) {
    o.frequency.setValueAtTime(f0 * k, t);
    o.frequency.exponentialRampToValueAtTime(f * k, t + (from ? 0.09 : 0.001));
  }
  const vib = ctx.createOscillator(), vibG = ctx.createGain();
  vib.frequency.value = 5.2; vibG.gain.setValueAtTime(0, t); vibG.gain.linearRampToValueAtTime(f * 0.012 * vibrato, t + Math.min(0.45, dur * 0.7));
  vib.connect(vibG); vibG.connect(o1.frequency);
  const g2 = ctx.createGain(); g2.gain.value = 0.18;
  o1.connect(lp); o2.connect(g2).connect(lp);
  const br = noise(ctx, t, dur + 0.6, seed), brG = ctx.createGain();
  br.connect(filter(ctx, 'bandpass', f * 1.5, 1.4)).connect(brG).connect(lp);
  envelope(brG.gain, t, { a: 0.04, d: 0.2, s: 0.35, r: 0.25, dur, peak: 0.55 * breath });
  envelope(amp.gain, t, { a: from ? 0.03 : 0.11, d: 0.3, s: 0.8, r: 0.28, dur, peak: 0.42 * vel });
  for (const o of [o1, o2, vib]) { o.start(t); o.stop(stop); }
}
