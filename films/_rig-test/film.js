// films/_rig-test/film.js — exercises the creature rig: locomotion speeds, chase, hop, bonk, catch, lift, cheer.
import { film, shot, at } from '../../engine/film.js';
import { studio } from '../../parts/sets/studio.js';
import { goldenHour } from '../../parts/lights/golden-hour.js';
import { pista } from '../../parts/characters/pista.js';
import { anor } from '../../parts/props/anor.js';
import { kosa } from '../../parts/props/kosa.js';

export default film({
  title: 'rig-test', duration: 10, seed: 4,
  set: studio(), light: goldenHour(),
  props: { bowl: kosa().at([30, -10]) },
  cast: { hero: pista().at([-40, 20], { rot: 90 }), fruit: anor().at([-20, 10]) },
  shots: [
    shot(0, 3, { rig: 'static', at: { pos: [-10, 18, 75], look: [-25, 4, 10] }, lens: 40, focus: 'hero', fstop: 5.6 }),
    shot(3, 6.5, { rig: 'track', target: 'hero', offset: [0, 7, 34], lag: 0.3, lens: 45, focus: 'hero', fstop: 5.6 }),
    shot(6.5, 10, { rig: 'static', at: { pos: [10, 12, 55], look: [10, 6, 0] }, lens: 50, focus: 'hero', fstop: 5.6 }),
  ],
  action: [
    at(0.3, 'hero.walk', { path: [[-30, 20]] }),
    at(1.2, 'hero.gasp'),
    at(2.2, 'fruit.roll', { path: [[0, 12], [20, 18], [35, 22]], speed: [15, 45] }),
    at(2.4, 'hero.chase', { target: 'fruit', gap: 11, until: 4.6 }),
    at(3.6, 'hero.jump', { height: 3.5 }),
    at(4.6, 'hero.hop', { to: [12, 28], height: 4 }),
    at(5.2, 'hero.sprint', { path: [[24, 10]] }),
    at(5.85, 'hero.bonk', { knock: 4 }),
    at(7.3, 'hero.shake'),
    at(7.9, 'fruit.roll', { path: [[16, 22]], dur: 0.8 }),
    at(7.9, 'hero.walk', { path: [[16, 15]], speed: 18 }),
    at(8.6, 'hero.catch'), at(8.6, 'fruit.carry', { by: 'hero' }),
    at(9.0, 'hero.lift'),
    at(9.5, 'hero.cheer'),
  ],
});
