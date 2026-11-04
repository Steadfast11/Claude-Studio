// tools/probe.mjs — blocking helper: prints where actors are over time (no rendering), so you can time actions
// to positions (e.g. "when does the hero reach the cup?").
//   npm run probe -- --film anor --actors hero,fruit --from 5 --to 11 --step 0.25
//   --near cup1,spoon   also prints the distance from each actor to those instances
import { openFilm, parseArgs } from './_browser.mjs';

const a = parseArgs();
const { page, close } = await openFilm({ film: a.film, scale: 0.1, quality: 'draft', verbose: false });
const rows = await page.evaluate(({ actors, from, to, step, near }) => {
  const S = window.STAGE, out = [];
  for (let t = from; t <= to + 1e-9; t += step) {
    const row = { t: +t.toFixed(3) };
    for (const n of actors) {
      const inst = S.instances.get(n), p = S.resolve(n, t);
      const s = inst.motion ? inst.motion.sample(t) : null;
      row[n] = `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})${s ? ` v=${s.speed.toFixed(0)}${s.airborne ? ' air' : ''}` : ''}`;
      for (const m of near) row[`${n}→${m}`] = S.resolve(m, t).setY(0).distanceTo(p.clone().setY(0)).toFixed(1);
    }
    out.push(row);
  }
  return out;
}, { actors: String(a.actors || 'hero').split(','), from: Number(a.from || 0), to: Number(a.to || 5), step: Number(a.step || 0.25), near: a.near ? String(a.near).split(',') : [] });
console.table(rows);
await close();
