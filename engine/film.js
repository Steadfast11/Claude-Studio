// engine/film.js — the film DSL. A film script is plain data built with these helpers:
//   export default film({ title, duration, fps, seed, set, light, props, cast, views, shots: [shot(...)],
//                         action: [at(...)], music: [music(...)], sfx: [sfx(...)], post, markers,
//                         titleCard: { t0, text, sub, credit } });
//   shot(t0, t1, { rig, from, to, at, lens, focus, fstop, handheld, grade, shafts })   camera (engine/camera/rigs.js);
//                                         grade / shafts are per-shot overrides of the light rig's look
//   at(t, 'actor.verb', params)                                                any part action, or 'fx.<emitter>'
//   sfx(t, 'name', params)                                                      one-shot sound (engine/audio/sfx.js)
//   music(t, cueSpec, { gain })                                                 a music cue starting at t
//   post: { letterbox, fade, exposure: number | [[t, v], ...] keyframes, dofScale (default 0.4), grade: {...} }
// The same film object drives both the picture (stage.js) and the soundtrack (audio/soundtrack.js).

export function film(d) {
  const f = { fps: 60, seed: 1, duration: 10, props: {}, cast: {}, shots: [], action: [], sfx: [], music: [], post: {}, markers: {}, ...d };
  if (f.music && !Array.isArray(f.music)) f.music = [music(0, f.music)];
  f.name = d.name || d.title || 'untitled';
  f.shots.forEach((s, i) => { if (!(s.t1 > s.t0)) throw new Error(`shot ${i} has t1 <= t0`); });
  return f;
}
export const shot = (t0, t1, opts = {}) => ({ t0, t1, ...opts });
export const at = (t, what, params = {}) => ({ t, what, params });
export const sfx = (t, name, params = {}) => ({ t, name, params });
export const music = (t, cue, opts = {}) => ({ t, cue, ...opts });
