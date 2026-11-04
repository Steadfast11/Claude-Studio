// films/_set-test/film.js — layout test for the Uzbek room with all tabletop props.
import { film, shot } from '../../engine/film.js';
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

export default film({
  title: 'set-test', duration: 4, seed: 7,
  set: uzbekRoom(), light: goldenHour(),
  props: {
    plov: laganPlov().at([-18, -10]), bowl: kosa({ fill: 'anor' }).at([30, -18]), teapot: choynak().at([22, 8], { rot: -150 }),
    cup1: piyola({ tea: true, steam: true }).at([6, 18]), cup2: piyola().at([38, 20]), bread: non({ stack: 2 }).at([-38, 20]), spoon: qoshiq().at([-8, 22], { rot: 70 }),
  },
  cast: { hero: pista().at([-30, 30], { rot: 30 }), fruit: anor().at({ on: 'bowl.pileTop' }) },
  shots: [
    shot(0, 1, { rig: 'static', at: 'wide-window', focus: 'plov', fstop: 8 }),
    shot(1, 2, { rig: 'static', at: 'wide', focus: 'plov', fstop: 5.6 }),
    shot(2, 3, { rig: 'static', at: 'table', focus: 'teapot', fstop: 5.6 }),
    shot(3, 4, { rig: 'static', at: { pos: [-10, 6, 60], look: [10, 6, -20] }, lens: 30, focus: 'hero', fstop: 4 }),
  ],
});
