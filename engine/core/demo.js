// engine/core/demo.js — turns any part into a tiny showcase film (used by ?part=<name> and stills.mjs --part).
// galleryFilm(kind) — a lineup of every part of a kind (?gallery=characters).
// A part can customise its showcase with `demo: { opts, at, radius, height, lens, look, duration, action, set, light }`.
import { film, shot, at } from '../film.js';
import { getPart, listParts } from './registry.js';

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

/** A lineup of every registered part of `kind` (default characters), `per` at a time, one 2 s slot per group:
 *  parts wait off-stage, step onto the table for their slot, turn to camera and smile/wave. ?gallery=characters
 *  Shot names list the parts in each slot (stills.mjs --gallery labels the contact sheet with them). */
export function galleryFilm(kind = 'characters', { per = 6, slot = 2, filter = null, action = null, turntable = false } = {}) {
  const k = kind.replace(/s$/, '');
  const defs = listParts().filter((d) => d.kind === k && (!filter || filter(d)));
  const groups = [];
  for (let i = 0; i < defs.length; i += per) groups.push(defs.slice(i, i + per));
  const dur = Math.max(3, groups.length * slot);
  const desc = { title: `gallery-${kind}`, duration: dur, seed: 5, set: getPart('studio')(), light: getPart('golden-hour')(), props: {}, cast: {}, action: [], shots: [] };
  groups.forEach((g, gi) => {
    const t0 = gi * slot, fp = g.map((d) => d.footprint ?? 6), gap = 5;
    const width = fp.reduce((s, r) => s + 2 * r + gap, -gap);
    let x = -width / 2;
    const hmax = Math.max(...g.map((d) => d.meta?.height ?? 10));
    g.forEach((d, i) => {
      const id = d.name.replace(/[^a-z0-9]/g, '_');
      const park = [-600 + (gi * per + i) * 25, 450], spot = [Math.round((x + fp[i]) * 10) / 10, 0];
      x += 2 * fp[i] + gap;
      desc.cast[id] = getPart(d.name)().at(park);
      desc.action.push(at(t0 + 0.02, `${id}.stop`, { at: spot }), at(t0 + 0.05, `${id}.turn`, { to: 0, dur: 0.3, hold: slot - 0.3 }));
      if (action) desc.action.push(at(t0 + 0.35, `${id}.${action}`, { dur: slot - 0.45 }));
      else desc.action.push(at(t0 + 0.9, `${id}.${i % 2 ? 'wave' : 'smile'}`, { dur: 1 }));
      if (gi < groups.length - 1 || slot < dur) desc.action.push(at(t0 + slot - 0.01, `${id}.stop`, { at: park }));
    });
    const lens = 40, d = Math.max((width + 16) / 0.9 * (40 / lens), hmax * 4.5);
    if (turntable && g.length === 1) { desc.shots.push(shot(t0, gi === groups.length - 1 ? dur : t0 + slot, { name: g[0].name, rig: 'orbit', around: [0, hmax * 0.45, 0], radius: Math.max(26, hmax * 3.2), height: hmax * 0.5 + 4, from: -38, to: 38, ease: 'inOutSine', lens: 40, focus: [0, hmax * 0.5, 0], fstop: 8, handheld: 0 })); return; }
    desc.shots.push(shot(t0, gi === groups.length - 1 ? dur : t0 + slot, { name: g.map((q) => q.name).join(' · ') + (action ? ` — ${action}` : ''), rig: 'static', at: { pos: [d * 0.22, hmax * 0.9 + d * 0.16, d], look: [0, hmax * 0.42, 0] }, lens, focus: [0, hmax * 0.5, 0], fstop: 8, handheld: 0 }));
  });
  desc.views = {};
  return film(desc);
}
