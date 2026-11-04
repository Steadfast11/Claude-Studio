// films/_engine-test/film.js — engine smoke test: a voxel sphere (anor) and a lathe bowl under golden light.
import { film, shot, at } from '../../engine/film.js';
import { studio } from '../../parts/sets/studio.js';
import { goldenHour } from '../../parts/lights/golden-hour.js';
import { anor } from '../../parts/props/anor.js';
import { kosa } from '../../parts/props/kosa.js';

export default film({
  title: 'engine-test', duration: 4, seed: 2,
  set: studio(), light: goldenHour(),
  props: { bowl: kosa({ fill: 'anor' }).at([-12, 0]) },
  cast: { fruit: anor().at([12, 6]) },
  shots: [
    shot(0, 2, { rig: 'static', at: 'wide', focus: 'bowl', fstop: 5.6 }),
    shot(2, 4, { rig: 'orbit', around: 'fruit.center', radius: 34, height: 10, from: -30, to: 20, lens: 60, focus: 'fruit', fstop: 2.8 }),
  ],
  action: [at(2.4, 'fruit.wobble'), at(3.2, 'fruit.crack')],
});
