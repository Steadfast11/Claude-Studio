// engine/audio/instruments/bass.js — round plucked bass (sine body + soft octave, lowpassed).
//   bass(ctx, out, t, { note: 'D2', dur: 0.4, vel: 0.8 })
import { freq, osc, envelope, filter } from '../context.js';

export function bass(ctx, out, t, { note = 'D2', dur = 0.35, vel = 0.8, pan = 0 } = {}) {
  const f = freq(note), stop = t + dur + 0.5;
  const lp = filter(ctx, 'lowpass', 900, 0.8), g = ctx.createGain(), p = ctx.createStereoPanner();
  p.pan.value = pan; lp.connect(g).connect(p).connect(out);
  const a = osc(ctx, 'sine', f, t, stop), b = osc(ctx, 'triangle', f * 2, t, stop), bg = ctx.createGain();
  bg.gain.value = 0.22; a.connect(lp); b.connect(bg).connect(lp);
  lp.frequency.setValueAtTime(1400, t); lp.frequency.setTargetAtTime(500, t, 0.08);
  envelope(g.gain, t, { a: 0.006, d: 0.18, s: 0.55, r: 0.12, dur, peak: 0.55 * vel });
}
