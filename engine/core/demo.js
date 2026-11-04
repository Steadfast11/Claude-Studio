// engine/core/demo.js — turns any part into a tiny showcase film (used by ?part=<name> and stills.mjs --part).
// A part can customise its showcase with `demo: { opts, at, radius, height, lens, look, duration, action, set, light }`.
import { film, shot, at } from '../film.js';
import { getPart } from './registry.js';

export function partDemoFilm(name) {
  const f = getPart(name);
  const d = f.def.demo || {};
  const kind = f.def.kind;
  const dur = d.duration ?? 3;
  const desc = {
    title: name, duration: dur, seed: 3,
    set: kind === 'set' ? f(d.opts || {}) : getPart(d.set || 'studio')(),
    light: kind === 'light' ? f(d.opts || {}) : getPart(d.light || 'golden-hour')(),
    props: {}, cast: {},
    action: (d.action || []).map(([t, what, p]) => at(t, what, p)),
  };
  if (kind === 'prop') desc.props.subject = f(d.opts || {}).at(d.at || [0, 0], { rot: d.rot || 0 });
  if (kind === 'character') desc.cast.subject = f(d.opts || {}).at(d.at || [0, 0], { rot: d.rot || 0 });
  if (kind === 'light') desc.props = { a: getPart('kosa')({ fill: 'anor' }).at([-8, 0]), b: getPart('anor')().at([10, 4]) };
  const look = d.look || (kind === 'set' || kind === 'light' ? [0, 6, 0] : { at: 'subject.center' });
  desc.shots = [shot(0, dur, d.shot || { rig: 'orbit', around: look, radius: d.radius ?? 40, height: d.height ?? 12, from: -20, to: 20, lens: d.lens ?? 50, ease: 'inOutSine', focus: d.focus ?? look, fstop: d.fstop ?? 4 })];
  return film(desc);
}
