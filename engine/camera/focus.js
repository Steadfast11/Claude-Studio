// engine/camera/focus.js — focus distance over a shot, with eased focus pulls between subjects.
//   focus: 'hero'                                  // follow-focus on the hero all shot long
//   focus: [{ t: 3.0, on: 'fruit' }, { t: 4.3, on: 'hero', pull: 0.35 }]   // rack focus at 4.3 s over 0.35 s
//   focus: 42                                      // fixed distance (cm)
// makeFocus(shot, resolve) → (t, camPos) → distance in world units.
import { E } from '../anim/easing.js';

export function makeFocus(shot, resolve) {
  const f = shot.focus;
  if (f === undefined || f === null) return (t, cam) => resolve(shot.look ?? shot.target ?? [0, 0, 0], t).distanceTo(cam);
  if (typeof f === 'number') return () => f;
  const keys = (Array.isArray(f) ? f : [{ t: shot.t0, on: f }]).map((k) => ({ pull: 0.4, ...k })).sort((a, b) => a.t - b.t);
  const dist = (k, t, cam) => (typeof k.on === 'number' ? k.on : resolve(k.on, t).distanceTo(cam));
  return (t, cam) => {
    let i = 0;
    for (let j = 0; j < keys.length; j++) if (keys[j].t <= t) i = j;
    const cur = keys[i];
    const d = dist(cur, t, cam);
    if (i === 0) return d;
    const u = Math.min(1, (t - cur.t) / Math.max(cur.pull, 1e-6));
    if (u >= 1) return d;
    return dist(keys[i - 1], t, cam) + (d - dist(keys[i - 1], t, cam)) * E.inOutCubic(u);
  };
}
