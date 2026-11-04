// engine/audio/instruments/frame-drum.js — doira (frame drum with metal jingle rings), fully synthesized.
//   drum(ctx, out, t, { stroke: 'dum' | 'tak' | 'ka' | 'jingle' | 'slap', vel: 0.9, jingle: 0.5, pan: 0, seed })
//   drumRoll(ctx, out, t, dur, { vel, rate })
// Strokes: dum = low centre hit with pitch drop; tak = bright edge; ka = muted ghost; slap = sharp open slap;
// jingle = the rings alone (shake). Every stroke also excites the jingles by `jingle` amount.
import { noise, filter, decay, osc } from '../context.js';

function jingles(ctx, out, t, amt, seed) {
  if (amt <= 0) return;
  const hp = filter(ctx, 'highpass', 4200, 0.8);
  hp.connect(out);
  // several rings strike a few ms apart; each is a cluster of inharmonic partials rattling
  for (let k = 0; k < 3; k++) {
    const tk = t + k * 0.009 + ((seed * 13 + k * 7) % 5) * 0.002;
    for (const [f, a] of [[5230, 1], [6710, 0.8], [8120, 0.7], [9430, 0.5], [11050, 0.4]]) {
      const o = osc(ctx, 'square', f * (1 + ((seed + k) % 7) * 0.003), tk, tk + 0.5);
      const e = ctx.createGain(); o.connect(e).connect(hp);
      decay(e.gain, tk, { peak: 0.035 * a * amt, tau: 0.045 + 0.02 * k });
    }
    const n = noise(ctx, tk, 0.3, seed + k), ne = ctx.createGain();
    n.connect(filter(ctx, 'bandpass', 7800, 1.2)).connect(ne).connect(hp);
    decay(ne.gain, tk, { peak: 0.25 * amt, tau: 0.05 });
  }
}

export function drum(ctx, out, t, { stroke = 'dum', vel = 0.9, jingle = 0.45, pan = 0, seed = 1 } = {}) {
  const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(out);
  const bus = ctx.createGain(); bus.gain.value = vel; bus.connect(p);
  if (stroke === 'dum') {
    const o = osc(ctx, 'sine', 120, t, t + 0.8);
    o.frequency.setTargetAtTime(62, t, 0.05);
    const e = ctx.createGain(); o.connect(e).connect(bus);
    decay(e.gain, t, { peak: 1.0, tau: 0.16 });
    const n = noise(ctx, t, 0.2, seed), ne = ctx.createGain();
    n.connect(filter(ctx, 'lowpass', 600)).connect(ne).connect(bus);
    decay(ne.gain, t, { peak: 0.5, tau: 0.03 });
    jingles(ctx, bus, t, jingle * 0.6, seed);
  } else if (stroke === 'tak' || stroke === 'ka' || stroke === 'slap') {
    const soft = stroke === 'ka' ? 0.45 : 1, bright = stroke === 'slap' ? 1.6 : 1;
    const n = noise(ctx, t, 0.2, seed), ne = ctx.createGain();
    n.connect(filter(ctx, 'bandpass', 2400 * bright, 1.1)).connect(ne).connect(bus);
    decay(ne.gain, t, { peak: 0.9 * soft, tau: stroke === 'ka' ? 0.018 : 0.035 });
    const o = osc(ctx, 'triangle', 430, t, t + 0.3), e = ctx.createGain();
    o.frequency.setTargetAtTime(380, t, 0.02);
    o.connect(e).connect(bus);
    decay(e.gain, t, { peak: 0.35 * soft, tau: 0.04 });
    jingles(ctx, bus, t, jingle * soft, seed);
  } else if (stroke === 'jingle') jingles(ctx, bus, t, 1, seed);
}

export function drumRoll(ctx, out, t, dur, { vel = 0.7, rate = 18, pan = 0, seed = 1 } = {}) {
  const n = Math.floor(dur * rate);
  for (let i = 0; i < n; i++) drum(ctx, out, t + i / rate, { stroke: i % 2 ? 'ka' : 'tak', vel: vel * (0.35 + 0.65 * (i / n)), jingle: 0.8, pan, seed: seed + i });
}
