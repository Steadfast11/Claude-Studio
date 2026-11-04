// engine/audio/instruments/bell.js — struck metal / ceramic: inharmonic partials with individual decays.
//   bell(ctx, out, t, { note: 'D6', vel: 0.6, kind: 'chime' | 'cup' | 'glass', decay: 2.5, pan })
import { freq, osc, decay as dec } from '../context.js';

const KINDS = {
  chime: { partials: [[1, 1, 1], [2.0, 0.5, 0.7], [2.76, 0.45, 0.55], [5.4, 0.25, 0.35], [8.93, 0.12, 0.2]], decay: 2.6 },
  cup: { partials: [[1, 1, 1], [2.32, 0.6, 0.6], [4.25, 0.35, 0.4], [6.63, 0.2, 0.25]], decay: 1.1 },
  glass: { partials: [[1, 1, 1], [2.7, 0.3, 0.5], [5.1, 0.15, 0.3]], decay: 1.8 },
};

export function bell(ctx, out, t, { note = 'D6', hz, vel = 0.6, kind = 'chime', decay, pan = 0, beat = 1.5 } = {}) {
  const K = KINDS[kind] || KINDS.chime, f = hz || freq(note), D = decay ?? K.decay;
  const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(out);
  for (const [ratio, amp, dk] of K.partials) {
    for (const det of [-beat, beat]) { // two slightly detuned copies → slow beating shimmer
      const o = osc(ctx, 'sine', f * ratio + det * ratio * 0.5, t, t + D * dk * 4 + 0.2), g = ctx.createGain();
      o.connect(g).connect(p);
      dec(g.gain, t, { a: 0.002, peak: 0.12 * vel * amp, tau: D * dk * 0.45 });
    }
  }
}
