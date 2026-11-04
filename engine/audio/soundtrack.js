// engine/audio/soundtrack.js — renders a film's whole soundtrack offline from the same timeline as the picture.
//   const b64 = await renderSoundtrack(filmDesc, stage.timeline, { base64: true });   // WAV for muxing
//   const buf = await renderSoundtrack(filmDesc, stage.timeline, { buffer: true });   // AudioBuffer for preview
// Sources: music cues (film.music → part.schedule), explicit sfx (film.sfx + sfx emitted by part actions),
// and timeline events (footsteps, landings) mapped to sounds by the parts that emitted them.
import { encodeWav, toBase64 } from './wav.js';
import { createMix, normalizeLoudness } from './mix.js';
import { playSfx } from './sfx.js';
import { toSpec } from '../core/registry.js';

export const SAMPLE_RATE = 48000;

export async function renderSoundtrack(desc, timeline, { base64 = false, buffer = false, targetLufs = -16 } = {}) {
  const dur = desc.duration + 0.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * SAMPLE_RATE), SAMPLE_RATE);
  const mix = createMix(ctx, { seed: desc.seed ?? 1, room: desc.audio?.room });
  // music
  for (const m of desc.music || []) {
    const spec = toSpec(m.cue);
    const cue = spec.def.build(spec.opts, { seed: desc.seed ?? 1, markers: timeline.markers, duration: desc.duration });
    cue.schedule(ctx, mix.bus('music'), { t0: m.t, gain: m.gain ?? 1, timeline });
  }
  // sound effects (explicit + emitted by parts)
  for (const s of timeline.sfx) playSfx(ctx, mix, s.name, s.t, { seed: desc.seed ?? 1, ...s.params });
  // room tone / ambience bed
  if (desc.audio?.roomTone !== false) playSfx(ctx, mix, 'room-tone', 0, { dur: desc.duration, level: desc.audio?.roomToneLevel ?? 1 });
  const rendered = await ctx.startRendering();
  normalizeLoudness(rendered, targetLufs, -1);
  if (buffer) return rendered;
  const bytes = encodeWav(rendered);
  return base64 ? toBase64(bytes) : bytes;
}
