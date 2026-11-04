// parts/music/lazgi-chase.js — a reusable chase cue in the spirit of Khorezm lazgi: rubato dutar + nay intro, a
// one-beat hold, a doira-driven 6/8 groove that ACCELERATES through the chase, a dead stop on the hit, a heartbeat
// over a drone, a freeze, a relieved major chord, a full-tempo climax and a ritardando cadence with chimes.
//   lazgiChase({ bpm: [92, 152], key: 'D' })
// Section times are film markers (by name) with numeric fallbacks — define them once in the film:
//   markers: { hold, chase, hit, tension, freeze, relief, climax, resolve, end }
// Every option may be a number (seconds) or a marker name.
import { definePart } from '../../engine/core/registry.js';
import { tempoMap, steps, play } from '../../engine/audio/sequencer.js';
import { pluck } from '../../engine/audio/instruments/pluck-karplus.js';
import { drum, drumRoll } from '../../engine/audio/instruments/frame-drum.js';
import { flute } from '../../engine/audio/instruments/flute.js';
import { bell } from '../../engine/audio/instruments/bell.js';
import { bass } from '../../engine/audio/instruments/bass.js';
import { pad } from '../../engine/audio/instruments/pad.js';
import { midiOf } from '../../engine/audio/context.js';

const FALLBACK = { hold: 4.4, chase: 5.5, hit: 10.4, tension: 11.5, freeze: 14.2, relief: 15.0, climax: 15.6, resolve: 17.6, end: 20 };

// melodies on a 3-steps-per-beat grid (6/8 feel); bars of 6 steps. Notes are scale degrees in the key (0 = tonic).
const CHASE_TUNE = ['4 . 4 3 4 .', '5 4 3 2 . .', '3 . 3 2 1 .', '2 1 0 0 . .', '4 . 4 3 4 5', '6 5 4 3 . 4', '3 2 1 2 3 1', '0 . 0 . . .'];
const CLIMAX_TUNE = ['7 . 7 8 7 6', '5 . 4 5 6 .', '7 6 5 4 3 .', '4 . 5 4 3 .', '7 . 7 8 9 8', '7 6 5 6 7 .', '8 7 6 5 4 3', '7 . . . . .'];
const DOIRA = ['D.tk.t', 'D.tD.t', 'D.tk.t', 'D.tDtt'];
const MINOR = [0, 2, 3, 5, 7, 8, 10], MAJOR = [0, 2, 4, 5, 7, 9, 11];
const degree = (root, scale, d) => root + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

export const lazgiChase = definePart({
  name: 'lazgi-chase', kind: 'music',
  options: { bpm: [92, 152], key: 'D', hold: 'hold', chase: 'chase', hit: 'hit', tension: 'tension', freeze: 'freeze', relief: 'relief', climax: 'climax', resolve: 'resolve', end: 'end' },
  build(o, ctx) {
    const M = {};
    for (const k of Object.keys(FALLBACK)) M[k] = typeof o[k] === 'number' ? o[k] : ctx.markers?.[o[k]] ?? FALLBACK[k];
    const root = midiOf(o.key + '3');
    return {
      schedule(ac, dest, { t0 = 0, gain = 1 }) {
        const bus = (g, cuts = []) => {
          const n = ac.createGain(); n.gain.value = g * gain; n.connect(dest);
          for (const [a, b] of cuts) { n.gain.setValueAtTime(g * gain, a - 0.006); n.gain.linearRampToValueAtTime(0, a + 0.012); if (b) { n.gain.setValueAtTime(0, b - 0.01); n.gain.linearRampToValueAtTime(g * gain, b); } }
          return n;
        };
        // ---------- 1. intro: rubato dutar arpeggios + drone + nay phrase ----------
        const intro = bus(0.9, [[M.chase - 0.05]]);
        pad(ac, intro, t0 + 0.2, { notes: [root - 12, root - 5], dur: M.chase - t0 - 1.2, vel: 0.22, bright: 0.15, attack: 1.2 });
        const arp = [0, 7, 12, 7, 0, 7, 14, 12, 0, 7, 12, 15, 14, 12, 7, 5];
        let t = t0 + 0.35, i = 0;
        while (t < M.chase - 0.2) {
          const inHold = t > M.hold - 0.15 && t < M.hold + 0.55;
          if (!inHold) pluck(ac, intro, t, { note: root + arp[i % arp.length], vel: 0.5 + 0.2 * Math.sin(i), timbre: 'dutar', pan: -0.25, seed: i });
          t += 0.36 + 0.06 * Math.sin(i * 1.7) + (i % 4 === 3 ? 0.12 : 0); // rubato
          i++;
        }
        const nay = [['A4', 1.0], ['D5', 0.55], ['C5', 0.25], ['D5', 0.3], ['E5', 0.45], ['F5', 0.5], ['E5', 0.85]];
        let tn = t0 + 1.05, prev = null;
        for (const [n, d] of nay) { if (tn + d > M.hold - 0.6) break; flute(ac, intro, tn, { note: n, dur: d, vel: 0.62, from: prev, pan: 0.25, seed: Math.round(tn * 10) }); prev = n; tn += d; }
        bell(ac, intro, M.hold, { note: 'A6', vel: 0.25, kind: 'glass', pan: 0.3 });
        drumRoll(ac, intro, M.chase - 0.7, 0.62, { vel: 0.55, seed: 5 });
        // ---------- 2. chase: accelerating lazgi groove, stops dead on the hit ----------
        const chase = bus(1, [[M.hit]]);
        const tm = tempoMap([{ t: M.chase, bpm: o.bpm[0] }, { t: M.hit, bpm: o.bpm[1], ramp: true }]);
        const endBeat = tm.beatAt(M.hit);
        const groove = (tmap, a, b, out, { tune, scale, octave = 12, jingle = 0.4, full = false }) => {
          for (let bar = Math.floor(a / 2); bar * 2 < b; bar++) {
            const pat = steps(DOIRA[bar % DOIRA.length], { perBeat: 3 });
            play(tmap, pat, Math.max(a, bar * 2), Math.min(b, bar * 2 + 2), (time, e) => {
              const stroke = e.ch === 'D' ? 'dum' : e.ch === 't' ? 'tak' : 'ka';
              drum(ac, out, time, { stroke, vel: stroke === 'dum' ? 0.95 : 0.7, jingle: jingle + (full ? 0.3 : 0), pan: 0.12, seed: bar * 7 + e.i });
            });
            const bt = (x) => tmap.timeAt(bar * 2 + x);
            if (bar * 2 >= a) bass(ac, out, bt(0), { note: root - 12, dur: 0.22, vel: 0.85 });
            if (bar * 2 + 1 < b) bass(ac, out, bt(1), { note: root - 17, dur: 0.22, vel: 0.7 });
            if (tune && bar * 2 >= a + 4 - (full ? 4 : 0)) {
              const line = tune[(bar - Math.floor(a / 2) - (full ? 0 : 2) + 64) % tune.length].split(' ');
              line.forEach((n, s) => {
                const beat = bar * 2 + s / 3;
                if (n === '.' || beat >= b) return;
                const m = degree(root, scale, Number(n)) + octave;
                pluck(ac, out, tmap.timeAt(beat), { note: m, vel: 0.75, timbre: 'rubab', pan: -0.15, seed: bar * 11 + s });
                if (full) pluck(ac, out, tmap.timeAt(beat), { note: m - 12, vel: 0.45, timbre: 'dutar', pan: 0.25, seed: bar * 13 + s });
              });
            }
            if (full && bar * 2 >= a) for (const [k, d] of [[0, 0], [1, 7], [2, 12]]) pluck(ac, out, bt(0) + k * 0.018, { note: root + d, vel: 0.45, timbre: 'dutar', pan: 0.3, seed: bar + k });
          }
        };
        groove(tm, 0, endBeat, chase, { tune: CHASE_TUNE, scale: MINOR, octave: 12, jingle: 0.35 });
        // ---------- 3. tension: heartbeat over a low drone, frozen at the catch ----------
        const tension = bus(1, [[M.freeze]]);
        pad(ac, tension, M.tension, { notes: [root - 12, root - 11], dur: M.freeze - M.tension, vel: 0.3, bright: 0.05, attack: 0.8, release: 0.1 });
        for (let tb = M.tension + 0.2, k = 0; tb < M.freeze - 0.1; k++) {
          drum(ac, tension, tb, { stroke: 'dum', vel: 0.75, jingle: 0, seed: 50 + k });
          drum(ac, tension, tb + 0.17, { stroke: 'dum', vel: 0.5, jingle: 0, seed: 70 + k });
          tb += Math.max(0.42, 0.85 - k * 0.09);
        }
        // ---------- 4. relief: major chord when balance is found ----------
        const relief = bus(0.9);
        pad(ac, relief, M.relief, { notes: [root - 12, root - 5, root + 4, root + 7], dur: M.climax - M.relief + 0.6, vel: 0.45, bright: 0.5, attack: 0.15, release: 0.8 });
        [0, 7, 12, 16, 19].forEach((d, k) => pluck(ac, relief, M.relief + k * 0.03, { note: root + d, vel: 0.6, timbre: 'dutar', seed: 90 + k }));
        bell(ac, relief, M.relief + 0.05, { note: (root + 24 + 4), vel: 0.35, kind: 'chime' });
        // ---------- 5. climax: full lazgi at top tempo, major key ----------
        const climax = bus(1, [[M.resolve - 0.02]]);
        const tm2 = tempoMap([{ t: M.climax, bpm: o.bpm[1] }]);
        drum(ac, climax, M.climax, { stroke: 'dum', vel: 1, jingle: 1, seed: 3 });
        groove(tm2, 0, tm2.beatAt(M.resolve), climax, { tune: CLIMAX_TUNE, scale: MAJOR, octave: 12, jingle: 0.6, full: true });
        pad(ac, climax, M.climax, { notes: [root, root + 4, root + 7, root + 12], dur: M.resolve - M.climax - 0.3, vel: 0.35, bright: 0.6, attack: 0.25 });
        // ---------- 6. resolve: ritardando cadence V → I, doira flourish, chime tail ----------
        const res = bus(1);
        const tm3 = tempoMap([{ t: M.resolve, bpm: o.bpm[1] * 0.7 }, { t: M.resolve + 1.6, bpm: o.bpm[1] * 0.38, ramp: true }]);
        const cad = [[7, [7, 11, 14, 17]], [7, [7, 11, 14, 19]], [0, [0, 4, 7, 12, 16]]];
        cad.forEach(([b, chord], k) => {
          const time = tm3.timeAt(k * 1.5);
          bass(ac, res, time, { note: root - 12 + b, dur: k === 2 ? 1.6 : 0.4, vel: 0.8 });
          chord.forEach((d, j) => pluck(ac, res, time + j * 0.025, { note: root + d, vel: 0.65, timbre: k === 2 ? 'dutar' : 'rubab', pan: (j - 2) * 0.12, seed: 120 + k * 9 + j }));
        });
        const final = tm3.timeAt(3);
        drumRoll(ac, res, final - 0.55, 0.5, { vel: 0.7, seed: 31 });
        drum(ac, res, final, { stroke: 'dum', vel: 1, jingle: 1, seed: 33 });
        pad(ac, res, final, { notes: [root - 12, root, root + 4, root + 7, root + 12], dur: Math.max(0.5, M.end - final - 1.2), vel: 0.4, bright: 0.45, attack: 0.08, release: 1.6 });
        [[24, 0], [28, 0.35], [31, 0.7], [36, 1.1]].forEach(([d, dt]) => bell(ac, res, final + dt, { note: root + d, vel: 0.4, kind: 'chime', pan: (dt - 0.5) * 0.8, decay: 3 }));
      },
    };
  },
});
export default lazgiChase;
