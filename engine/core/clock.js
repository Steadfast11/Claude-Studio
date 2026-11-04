// engine/core/clock.js — the film clock. Film time is the only time: frames are frame/fps, nothing else.
//   const clock = createClock({ duration: 20, fps: 60, onTick: (t) => stage.seek(t) });
//   clock.play(); clock.pause(); clock.set(t); clock.frame(t) → integer frame; clock.time(frame) → seconds
// The realtime loop (preview only) maps wall-clock to film time; renders never use it (?render disables it).

export function createClock({ duration, fps = 60, onTick, loop = true }) {
  let playing = false, t = 0, wall0 = 0, t0 = 0, raf = 0;
  const frame = (x) => Math.round(x * fps);
  const time = (f) => f / fps;
  const tick = () => {
    if (!playing) return;
    t = t0 + (performance.now() - wall0) / 1000;
    if (t >= duration) { if (loop) { t0 = 0; wall0 = performance.now(); t = 0; } else { t = duration; playing = false; } }
    onTick(t, true);
    raf = requestAnimationFrame(tick);
  };
  return {
    get t() { return t; }, get playing() { return playing; }, duration, fps, frame, time,
    play() { if (playing) return; playing = true; t0 = t; wall0 = performance.now(); raf = requestAnimationFrame(tick); },
    pause() { playing = false; cancelAnimationFrame(raf); },
    set(x) { t = Math.max(0, Math.min(duration, x)); t0 = t; wall0 = performance.now(); onTick(t, false); },
  };
}
