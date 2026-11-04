// engine/audio/sfx.js — synthesized sound effects, scheduled at timeline times.
//   playSfx(ctx, mix, 'bonk', 10.4, { gain: 1 })   — see SFX for the catalogue; unknown names throw.
// Every effect is built from oscillators, seeded noise buffers and filters. No samples.
import { rng } from '../core/rng.js';

const noiseCache = new Map();
/** Seeded white-noise buffer (cached per context+seed). */
export function noiseBuffer(ctx, seconds = 2, seed = 1) {
  const k = `${seconds}:${seed}:${ctx.sampleRate}`;
  if (noiseCache.has(k) && noiseCache.get(k).ctx === ctx) return noiseCache.get(k).buf;
  const n = Math.floor(seconds * ctx.sampleRate), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), r = rng(seed);
  for (let i = 0; i < n; i++) d[i] = r.next() * 2 - 1;
  noiseCache.set(k, { ctx, buf });
  return buf;
}

export const SFX = {
  /** Quiet room ambience: filtered noise bed + faint distant birds/street murmur swells. */
  'room-tone'(ctx, out, t, { dur = 20, level = 1 }) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 4, 99); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.012 * level;
    src.connect(lp).connect(g).connect(out('amb'));
    src.start(t); src.stop(t + dur + 0.5);
  },
};

export function playSfx(ctx, mix, name, t, params = {}) {
  const fn = SFX[name];
  if (!fn) throw new Error(`Unknown sfx "${name}". Known: ${Object.keys(SFX).join(', ')}`);
  fn(ctx, (bus) => mix.bus(bus), Math.max(0, t), params);
}
