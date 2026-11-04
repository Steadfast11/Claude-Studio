// engine/player.js — preview page + render host. Loaded by index.html.
// URL params: film=<name> (films/<name>/film.js) | part=<name> (part demo) · render (no UI, no realtime loop)
//             scale=0.5 (resolution multiplier of 1920×1080) · quality=draft|preview|final · t=<seconds>
// Exposes: window.seek(t), window.DURATION, window.FPS, window.renderAudio() → base64 WAV, window.READY,
//          window.FILM_INFO { name, shots, markers, renderer }.
import { createRenderer, rendererInfo } from './core/renderer.js';
import { createStage } from './core/stage.js';
import { createClock } from './core/clock.js';
import { renderSoundtrack } from './audio/soundtrack.js';
import { partDemoFilm } from './core/demo.js';
import { listParts } from './core/registry.js';
import '../parts/index.js';

const P = new URLSearchParams(location.search);
const RENDER = P.has('render');
const scale = Number(P.get('scale') || (RENDER ? 1 : 0.6667));
const W = Math.round(1920 * scale), H = Math.round(1080 * scale);
const quality = P.get('quality') || (RENDER ? 'final' : 'preview');

async function loadFilm() {
  if (P.get('part')) return partDemoFilm(P.get('part'));
  const name = P.get('film') || 'anor';
  return (await import(`../films/${name}/film.js`)).default;
}

async function main() {
  const desc = await loadFilm();
  const canvas = document.getElementById('view');
  canvas.width = W; canvas.height = H;
  const { renderer, quality: q } = createRenderer({ canvas, width: W, height: H, quality });
  const stage = await createStage(desc, { renderer, quality: q, width: W, height: H });
  window.STAGE = stage;
  window.DURATION = stage.duration;
  window.FPS = stage.fps;
  window.seek = (t) => { stage.seek(t); return true; };
  window.renderAudio = async () => renderSoundtrack(desc, stage.timeline, { base64: true });
  window.PARTS = listParts().map(({ name, kind, options }) => ({ name, kind, options }));
  window.FILM_INFO = { name: desc.name, shots: desc.shots.map(({ t0, t1, rig, name }) => ({ t0, t1, rig, name })), markers: stage.timeline.markers, renderer: rendererInfo(renderer), size: [W, H], quality: q.name };
  stage.seek(Number(P.get('t') || 0));
  window.READY = true;
  if (!RENDER) setupUI(stage, desc);
}

function setupUI(stage, desc) {
  document.body.classList.add('ui');
  const $ = (id) => document.getElementById(id);
  const scrub = $('scrub'), label = $('time'), shotsEl = $('shots');
  let audio = null, audioCtx = null, src = null;
  const show = (t) => {
    stage.seek(t);
    scrub.value = t;
    const s = stage.shotAt(t);
    label.textContent = `t=${t.toFixed(2)}s  frame ${Math.round(t * stage.fps)} / ${Math.round(stage.duration * stage.fps)}  shot ${stage.shots.indexOf(s) + 1}`;
  };
  const clock = createClock({ duration: stage.duration, fps: stage.fps, onTick: (t) => show(t) });
  scrub.max = stage.duration;
  scrub.oninput = () => { stopAudio(); clock.pause(); clock.set(Number(scrub.value)); };
  $('play').onclick = async () => {
    if (clock.playing) { clock.pause(); stopAudio(); $('play').textContent = '▶'; return; }
    $('play').textContent = '❚❚';
    if ($('sound').checked) await startAudio(clock.t);
    clock.play();
  };
  async function startAudio(t) {
    if (!audio) { $('play').textContent = '…'; audio = await renderSoundtrack(desc, stage.timeline, { buffer: true }); $('play').textContent = '❚❚'; }
    audioCtx ||= new AudioContext();
    src = audioCtx.createBufferSource();
    src.buffer = audioCtx.createBuffer(audio.numberOfChannels, audio.length, audio.sampleRate);
    for (let c = 0; c < audio.numberOfChannels; c++) src.buffer.copyToChannel(audio.getChannelData(c), c);
    src.connect(audioCtx.destination);
    src.start(0, t);
  }
  function stopAudio() { try { src?.stop(); } catch { /* already stopped */ } src = null; }
  stage.shots.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1}·${s.name || s.rig || 'shot'} ${s.t0.toFixed(1)}s`;
    b.onclick = () => { clock.pause(); stopAudio(); clock.set(s.t0); };
    shotsEl.appendChild(b);
    const m = document.createElement('i');
    m.style.left = `${(s.t0 / stage.duration) * 100}%`;
    $('marks').appendChild(m);
  });
  for (const k of ['post', 'dof', 'ao', 'shafts']) {
    const el = $('tg-' + k);
    el.checked = stage.toggles[k];
    el.onchange = () => { stage.toggles[k] = el.checked; show(clock.t); };
  }
  $('tg-wire').onchange = (e) => { stage.scene.traverse((o) => { if (o.material && 'wireframe' in o.material) o.material.wireframe = e.target.checked; }); show(clock.t); };
  $('tg-safe').onchange = (e) => document.body.classList.toggle('safe', e.target.checked);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
    if (e.code === 'ArrowRight') clock.set(clock.t + 1 / stage.fps);
    if (e.code === 'ArrowLeft') clock.set(clock.t - 1 / stage.fps);
  });
  show(Number(P.get('t') || 0));
}

main().catch((e) => { console.error(e); window.ERROR = String(e.stack || e); document.body.insertAdjacentHTML('beforeend', `<pre class="err">${e.stack || e}</pre>`); });
