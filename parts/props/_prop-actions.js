// parts/props/_prop-actions.js — reusable behaviours for static props (not a part itself).
//   const rock = rockable(ctx, pivotGroup, { sound: 'ceramic-ring', radius: 4 });
//   return { ..., actions: { ...rock.actions }, update: (t) => rock.update(t) };
// wobble {dur, amount, dir}: rocks on its base like a struck cup (with an optional ring/creak sound) and settles.
// Expected graph: root → holder → pivot → content (rockable moves holder (slide), pivot (rotation) and content).
import { ClipSet } from '../../engine/anim/clips.js';
import { ring } from '../../engine/core/math.js';

export function rockable(ctx, pivot, { sound = 'ceramic-ring', radius = 4, pitch = 1 } = {}) {
  const clips = new ClipSet();
  return {
    actions: {
      wobble(t, { dur = 1.2, amount = 0.22, dir = 1, freq = 3.4, gain = 1 } = {}, api) {
        clips.add({ t0: t, dur, fadeIn: 0.001, fadeOut: 0.2, fn: (u, tl) => ({ rx: ring(tl, freq, 3.2, amount) * dir, rz: ring(tl, freq * 0.8, 3.6, amount * 0.35), slide: (1 - Math.exp(-tl * 9)) * 0.6 * dir }) });
        if (sound) api.sfx(t, sound, { gain, pitch, size: radius });
      },
    },
    update(t) {
      const p = clips.evaluate(t, { rx: 0, rz: 0, slide: 0 });
      const side = p.rx >= 0 ? 1 : -1; // rock about the base rim on the side it tips toward (continuous at rx = 0)
      pivot.position.set(0, 0, side * radius);
      pivot.children[0].position.set(0, 0, -side * radius);
      pivot.rotation.set(p.rx, 0, p.rz);
      pivot.parent.position.z = p.slide;
    },
  };
}
