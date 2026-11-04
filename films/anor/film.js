// films/anor/film.js — ANOR (Анор): Pista chases a runaway pomegranate across a golden-hour dasturxon.
// Composition only: every look, motion and sound comes from the parts library. See storyboard.md.
import { film, shot, at } from '../../engine/film.js';
import { uzbekRoom } from '../../parts/sets/uzbek-room.js';
import { goldenHour } from '../../parts/lights/golden-hour.js';
import { pista } from '../../parts/characters/pista.js';
import { anor } from '../../parts/props/anor.js';
import { kosa } from '../../parts/props/kosa.js';
import { choynak } from '../../parts/props/choynak.js';
import { piyola } from '../../parts/props/piyola.js';
import { non } from '../../parts/props/non.js';
import { laganPlov } from '../../parts/props/lagan-plov.js';
import { qoshiq } from '../../parts/props/qoshiq.js';
import { lazgiChase } from '../../parts/music/lazgi-chase.js';

// story beats (seconds) — shared by picture and music
const M = { hold: 4.4, chase: 5.5, hit: 10.4, tension: 11.5, freeze: 14.2, relief: 15.0, climax: 15.6, resolve: 17.6, end: 20 };

// the runaway route: off the kosa, over the spoon, under the choynak's spout, a wide loop around the bonk cup, to the edge
const ROUTE = [[0, 0], [-8, 2], [-18, 4], [-30, 6], [-37, 12], [-37, 22], [-31, 29], [-20, 31], [-9, 28], [-3, 20], [2, 12], [10, 14], [18, 22], [25, 29], [28, 33.6]];

export default film({
  title: 'ANOR', duration: M.end, fps: 60, seed: 7, markers: M,
  set: uzbekRoom({ sun: [14, 8] }),
  light: goldenHour({ dust: 520 }),
  props: {
    plov: laganPlov({ diameter: 30, mound: 11, height: 8 }).at([-38, -18]),
    bread: non({ stack: 2, seed: 2 }).at([-12, -18]),
    bowl: kosa({ fill: 'anor', count: 4, fruitSize: 7 }).at([20, -17]),
    teapot: choynak({ height: 15 }).at([-46, 1]),
    cup1: piyola({ tea: true, steam: true }).at([-20, 16]),
    cup2: piyola().at([31, 1]),
    cup3: piyola({ tea: true }).at([0, 30.5]),
    spoon: qoshiq().at([-8, 1], { rot: 0 }),
    seat: non({ stack: 1, seed: 9 }).at([40, 10]),
  },
  cast: {
    hero: pista({ color: '#4fb8a8' }).at([-12, -31]),
    fruit: anor({ size: 7 }).at({ on: 'bowl.pileTop' }),
  },
  views: {
    window: { pos: [6, 62, -20], look: [-143, 140, -640], lens: 32 },
    'table-mid': { pos: [6, 15, 28], look: [-8, 5, -22], lens: 40 },
  },
  shots: [
    shot(0, 3.0, { name: 'crane', rig: 'crane', from: 'window', to: 'table-mid', ease: 'inOutCubic', focus: [{ t: 0, on: 400 }, { t: 1.4, on: 'hero', pull: 1.0 }], fstop: 5.6 }),
    shot(3.0, 4.3, { name: 'kosa', rig: 'static', at: { pos: [2, 14, 18], look: [20, 8, -16] }, lens: 55, focus: 'fruit', fstop: 5.6 }),
    shot(4.3, 5.5, { name: 'gasp', rig: 'static', at: { pos: [-2, 9, 22], look: [2.4, 6, -28] }, lens: 35, focus: [{ t: 4.3, on: 'fruit' }, { t: 4.42, on: 'hero.face', pull: 0.35 }], fstop: 4 }),
    shot(5.5, 7.8, { name: 'chase-low', rig: 'track', target: 'fruit', offset: [8, 3, 30], lag: 0.3, lens: 32, focus: 'hero', fstop: 4, handheld: 0.4 }),
    shot(7.8, 9.9, { name: 'chase-front', rig: 'track', target: 'hero', offset: [-22, 6, 26], lag: 0.25, lens: 35, focus: 'hero.face', fstop: 5.6, handheld: 0.5 }),
    shot(9.9, 11.5, { name: 'bonk', rig: 'static', at: { pos: [-20, 9, 72], look: [-21, 6, 18] }, lens: 45, focus: 'cup1', fstop: 5.6 }),
    shot(11.5, 12.7, { name: 'wide', rig: 'static', at: { pos: [2, 42, 96], look: [2, 2, 12] }, lens: 35, focus: 'fruit', fstop: 8 }),
    shot(12.7, 15.0, { name: 'leap', rig: 'push', from: { pos: [2, 30, 90], look: [10, 4, 22] }, to: { pos: [20, 8, 56], look: [24, 6, 30] }, ease: 'inOutCubic', lens: 40, focus: 'hero', fstop: 4 }),
    shot(15.0, 17.5, { name: 'hero', rig: 'static', at: { pos: [24, 3, 56], look: [22, 9, 28] }, lens: 30, focus: 'hero.face', fstop: 4, grade: { exposure: 0.72 }, shafts: { density: 0.0011 } }),
    shot(17.5, 20, { name: 'outro', rig: 'pull', from: { pos: [30, 12, 50], look: [37, 5, 12] }, to: { pos: [12, 50, 118], look: [12, 4, 0] }, ease: 'inOutSine', lens: 40, focus: 'hero', fstop: 5.6 }),
  ],
  action: [
    // opening: hiding behind the bread, the hero peeks over it, sniffs, smiles
    at(0, 'hero.sit', { dur: 1.3, hold: false }),
    at(1.5, 'hero.look', { at: 'plov', dur: 0.8 }), at(2.1, 'hero.sniff'), at(2.6, 'hero.look', { at: 'bowl', dur: 1.2, face: 'happy' }),
    // the top pomegranate wobbles, falls and lands
    at(3.15, 'fruit.wobble', { dur: 0.75, amount: 0.25 }),
    at(3.9, 'fruit.fall', { to: [8, -6], dur: 0.42, bounces: 2 }),
    at(4.4, 'hero.gasp'),
    // chase: the fruit rolls away (keyed timing: accelerates, then creeps to the edge), the hero runs it down
    at(5.5, 'fruit.roll', { path: ROUTE, keys: [[0, 0], [0.6, 0.025], [1.6, 0.13], [2.6, 0.3], [3.6, 0.48], [4.3, 0.6], [4.8, 0.66], [5.9, 0.78], [7.0, 0.89], [8.0, 0.965], [8.7, 1]] }),
    at(5.5, 'hero.sprint', { path: [[4, -30], [4, -12]] }),
    at(6.3, 'hero.chase', { target: 'fruit', gap: [9, 30], until: 9.8, blend: 0.45 }),
    at(8.6, 'hero.skid', { dur: 0.4 }),
    // the shortcut… straight into the cup
    at(9.95, 'hero.sprint', { path: [{ at: 'cup1', offset: [-7.7, 0, 5.4] }], dur: 0.42 }),
    at(10.4, 'hero.bonk', { knock: 5, dizzy: 1.3 }), at(10.4, 'cup1.wobble', { amount: 0.18, dir: 1 }),
    // shake it off, sprint, slow-motion leap, catch at the very edge, wobble… balanced
    at(11.85, 'hero.shake'),
    at(12.35, 'hero.sprint', { path: [[0, 22], [12, 24]] }),
    at(12.95, 'hero.leap', { to: [21.5, 29.8], height: 9, dur: 1.25 }),
    at(14.2, 'hero.catch'), at(14.2, 'fruit.carry', { by: 'hero' }),
    at(14.2, 'hero.balance', { dur: 0.8 }),
    at(14.75, 'hero.turn', { to: 0, dur: 0.35 }),
    // triumph: lift, crack, ruby seeds in the sunbeams, a taste, a blush
    at(15.05, 'hero.lift'),
    at(15.6, 'fruit.crack', { count: 80 }),
    at(15.95, 'hero.laugh', { dur: 0.6 }),
    at(16.55, 'hero.snap'),
    at(17.1, 'hero.blush', { dur: 2.9 }),
    at(17.2, 'hero.hug'),
    // rest on a bread, title
    at(17.6, 'hero.hop', { to: 'seat.top', height: 5 }),
    at(18.1, 'hero.turn', { to: 20, dur: 0.5 }),
    at(18.15, 'hero.sit', { hold: true }),
  ],
  music: lazgiChase({ bpm: [92, 152], key: 'D' }),
  titleCard: { t0: 18.0, text: 'ANOR', sub: 'Анор', credit: 'Made with Voxel Studio', color: '#c8102e', edge: '#f2c14e' },
  post: { letterbox: [[17.4, 0], [18.3, 1]], fade: [[0, 1], [0.6, 0], [19.4, 0], [20, 0.55]] },
});
