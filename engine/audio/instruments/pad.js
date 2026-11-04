// engine/audio/instruments/pad.js — soft sustained chords: detuned saws through a slowly opening lowpass
// (a bowed-string / harmonium-like bed). pad(ctx, out, t, { notes: ['D3','A3','F4'], dur: 2, vel: 0.5, bright: 0.4 })
import { freq, osc, envelope, filter } from '../context.js';

export function pad(ctx, out, t, { notes = ['D3', 'A3', 'D4'], dur = 2, vel = 0.5, bright = 0.4, attack = 0.6, release = 1.2, pan = 0 } = {}) {
  const stop = t + dur + release * 2;
  const lp = filter(ctx, 'lowpass', 300, 0.6), g = ctx.createGain(), p = ctx.createStereoPanner();
  p.pan.value = pan; lp.connect(g).connect(p).connect(out);
  lp.frequency.setValueAtTime(250, t); lp.frequency.linearRampToValueAtTime(400 + 2600 * bright, t + attack + dur * 0.4);
  notes.forEach((n, i) => {
    for (const det of [-7, 0, 6]) {
      const o = osc(ctx, 'sawtooth', freq(n), t, stop); o.detune.value = det + i * 1.3;
      const og = ctx.createGain(); og.gain.value = 0.06 / notes.length; o.connect(og).connect(lp);
    }
  });
  envelope(g.gain, t, { a: attack, d: 0.5, s: 0.85, r: release, dur, peak: vel });
}
