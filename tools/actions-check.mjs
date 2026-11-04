// tools/actions-check.mjs — every character × every action, built and posed in Chromium (no rendering, fast).
//   npm run actions-check            → prints a table; exit code 1 on any error
// Each character gets its own film: all actions back to back (params filled for the ones that need a target/path),
// the stage compiles motions/clips, then every instance is posed at 4 times per action.
import { openFilm } from './_browser.mjs';
import { startServer } from './serve.mjs';

const server = await startServer(0);
const { page, close } = await openFilm({ gallery: 'characters', per: 1, scale: 0.1, quality: 'draft', server, verbose: false });
const res = await page.evaluate(async () => {
  const { film, at } = await import('/engine/film.js');
  const { getPart, listParts } = await import('/engine/core/registry.js');
  const { createStage } = await import('/engine/core/stage.js');
  const { ACTIONS } = await import('/parts/characters/_rig-actions.js');
  const P = { walk: { path: [[20, 0]], dur: 1 }, run: { path: [[0, 0]] }, sprint: { path: [[20, 10]] }, sneak: { path: [[10, 10]], dur: 1 }, chase: { target: 'ball', until: 0 },
    stop: {}, turn: { to: 90 }, look: { at: 'ball' }, 'look-at': { at: 'ball' }, hop: { to: [5, 5] }, leap: { to: [-10, 5], dur: 1 }, point: { at: 'ball' }, talk: { at: 'ball' },
    climb: { to: 'ball.top' }, swim: { path: [[0, 10]], dur: 1 }, fly: { path: [[10, 0]], dur: 1 }, pull: { dur: 0.8 } };
  const out = { chars: 0, actions: ACTIONS.length, errors: [] };
  for (const d of listParts().filter((x) => x.kind === 'character')) {
    const step = 1.2, list = ACTIONS;
    const action = list.map((v, i) => at(0.2 + i * step, `hero.${v}`, v === 'chase' ? { ...P.chase, until: 0.2 + i * step + 1 } : P[v] || {}));
    action.push(at(0.1, 'ball.roll', { path: [[-20, 10], [20, 20]], dur: list.length * step }));
    const desc = film({ title: d.name, duration: 0.6 + list.length * step, seed: 2, set: getPart('studio')(), light: getPart('golden-hour')(), props: {}, cast: { hero: getPart(d.name)().at([0, 0]), ball: getPart('anor')().at([-20, 10]) }, action, shots: [] });
    try {
      const st = await createStage(desc, { ...window.RENDER_CTX, width: 64, height: 36 });
      for (let t = 0; t < desc.duration; t += step / 4) for (const inst of st.instances.values()) inst.update?.(t, { camera: st.camera, resolve: st.resolve });
      out.chars++;
    } catch (e) { out.errors.push(`${d.name}: ${String(e.message || e).slice(0, 160)}`); }
  }
  return out;
});
console.log(`actions-check: ${res.chars} characters × ${res.actions} actions posed without errors${res.errors.length ? `; ${res.errors.length} failed:\n` + res.errors.join('\n') : ''}`);
await close(); server.server.close();
process.exitCode = res.errors.length ? 1 : 0;
