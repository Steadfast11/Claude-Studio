// engine/audio/sequencer.js — musical time: tempo maps with accelerando, step patterns, swing.
//   const tm = tempoMap([{ t: 5.5, bpm: 92 }, { t: 10.4, bpm: 152, ramp: true }]);   // linear accelerando
//   tm.timeAt(beat) / tm.beatAt(t)   (beat 0 = first point's time; analytic, no drift)
//   steps('D..t.tD.tt.k', { perBeat: 3 }) → [{ beat: 0, ch: 'D' }, ...]       ('.' = rest)
//   play(tm, events, fromBeat, toBeat, (time, ev, beat) => ...) schedules a looping pattern over a beat range
// Swing delays every odd step by `swing` × step length.

export function tempoMap(points) {
  const P = [...points].sort((a, b) => a.t - b.t);
  // cumulative beats at each point; bpm is linear in *time* across a segment whose end point has ramp: true
  const segs = [];
  let beats = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[i + 1];
    const b0 = a.bpm, b1 = b && b.ramp ? b.bpm : a.bpm, dt = b ? b.t - a.t : Infinity;
    segs.push({ t0: a.t, t1: b ? b.t : Infinity, b0, b1, beat0: beats });
    if (b) beats += ((b0 + b1) / 2) * dt / 60;
  }
  const bpmAt = (s, t) => (s.t1 === Infinity ? s.b0 : s.b0 + (s.b1 - s.b0) * (t - s.t0) / (s.t1 - s.t0));
  return {
    points: P,
    bpmAt: (t) => { const s = segs.find((x) => t < x.t1) || segs[segs.length - 1]; return bpmAt(s, Math.max(t, s.t0)); },
    beatAt(t) {
      if (t <= segs[0].t0) return (t - segs[0].t0) * segs[0].b0 / 60;
      const s = segs.find((x) => t < x.t1) || segs[segs.length - 1], d = t - s.t0;
      return s.beat0 + (s.b0 * d + 0.5 * (bpmAt(s, t) - s.b0) * d) / 60;
    },
    timeAt(beat) {
      if (beat <= 0) return segs[0].t0 + beat * 60 / segs[0].b0;
      let s = segs[segs.length - 1];
      for (let i = 0; i < segs.length - 1; i++) if (beat < segs[i + 1].beat0) { s = segs[i]; break; }
      const db = (beat - s.beat0) * 60; // beat-minutes → solve b0·d + ½k·d² = db, k = (b1−b0)/(t1−t0)
      const k = s.t1 === Infinity ? 0 : (s.b1 - s.b0) / (s.t1 - s.t0);
      if (Math.abs(k) < 1e-9) return s.t0 + db / s.b0;
      return s.t0 + (-s.b0 + Math.sqrt(s.b0 * s.b0 + 2 * k * db)) / k;
    },
  };
}

/** Step string → events. perBeat steps per beat; chars other than '.'/' ' are events (meaning is up to the caller). */
export function steps(pattern, { perBeat = 4, swing = 0 } = {}) {
  const out = [];
  [...pattern.replace(/\s|\|/g, '')].forEach((ch, i) => { if (ch !== '.') out.push({ beat: (i + (i % 2 ? swing : 0)) / perBeat, ch, i }); });
  return { events: out, length: pattern.replace(/\s|\|/g, '').length / perBeat };
}

/** Loop a pattern from beat a (inclusive) to b (exclusive), calling fn(time, event, absoluteBeat). */
export function play(tm, pat, a, b, fn) {
  for (let base = a; base < b; base += pat.length) for (const e of pat.events) {
    const beat = base + e.beat;
    if (beat >= a && beat < b) fn(tm.timeAt(beat), e, beat);
  }
}
