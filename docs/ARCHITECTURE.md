# Voxel Studio — Architecture

> Status: plan (milestone 1). Updated as milestones land.

## Goal

Expensive once, nearly free forever: the engine and the parts library are built once;
every film is a single declarative `films/<name>/film.js` (≤ 200 lines) rendered with one command.

## Layers (strict dependency direction)

```
films/<name>/film.js   composes ───────────────┐
parts/ (characters, props, sets, lights, music) │  know nothing about any film's story
engine/ (core, voxel, materials, anim, camera,  │  knows nothing about Uzbekistan or any film
         fx, post, audio, film DSL, player)  ◄──┘
```

## The time contract

* **One clock.** Everything visible or audible is a pure function of film time `t` (seconds).
  `window.seek(t)` renders exactly time `t`; frames can be rendered in any order, by any number of workers.
* **No accumulated per-frame state.** Anything path-dependent (distance travelled → gait phase, rolling
  rotation of a ball) is *pre-simulated once from t = 0 with a fixed step* at build time and cached in
  tables that are then sampled (`engine/anim/motion.js`).
* **Seeded randomness only**: `rng(seed)` / `hash(...)` from `engine/core/rng.js`. `Math.random` is never used.
* The page exposes `window.seek(t)`, `window.DURATION`, `window.FPS`, `window.renderAudio()`
  (→ base64 WAV). With `?render` the realtime loop is off and the canvas is sized to the requested resolution.

## Data flow

```
film.js ── film() ──► Film description (set, light, cast, props, shots, action, music, sfx)
                         │
              engine/core/stage.js  builds parts via registry → THREE scene
                         │            compiles action list → per-actor motion tracks + clips
                         ▼
                 Timeline (events, markers, footsteps, contacts)
              ┌──────────┴───────────┐
   picture: seek(t)                 audio: renderAudio()
   parts.update(t) → camera(t)      OfflineAudioContext; music cue + SFX scheduled
   → post composer → canvas         from the same timeline events → mix → WAV
```

## Units & conventions

* 1 world unit = 1 cm. +Y up. Table tops are at a known height exposed by the set (`set.surfaceY(x,z)`).
* Parts are factories registered with `definePart({ name, kind, options, build })`. `build` returns
  `{ root, update?(t, state), anchors, bounds, actions? }`. Anchors are named points (static `Vector3`
  in part space or functions of `t`) resolved to world space by the stage: `'choynak.spout'`.
* Lenses are given in mm (full-frame 36 mm sensor); DOF uses a thin-lens CoC with an f-stop.

## Rendering decisions

* `WebGLRenderer`, PBR materials, AgX tone mapping (applied in our own final grade pass), sRGB output,
  `PCFSoftShadowMap`, 4096² key-light shadow map whose camera is fitted to the set.
* Voxels: `RoundedBoxGeometry` cubes in one `InstancedMesh` per model, per-voxel color jitter and
  baked per-voxel ambient occlusion (neighbour count) multiplied into the instance color.
* Environment light: PMREM of a procedurally generated room (`RoomEnvironment`) — no HDRI files.
* Post stack (`engine/post/composer.js`), custom because we need depth access everywhere:
  MSAA HalfFloat scene target → GTAO → volumetric sun shafts (ray-marched through the key light's
  shadow map, so the window mullions cut real beams) → transparent/FX layer → thin-lens bokeh DOF
  (single-pass golden-angle gather, half res) → bloom → grade (AgX, lift/gamma/gain, warmth,
  split-tone, vignette, chromatic aberration, grain, letterbox) → screen. Overlay layer (titles) after.
* Headless rendering runs on SwiftShader (no GPU in the cloud container); every effect has a
  quality knob and `--scale` for cheap previews.

## Audio decisions

* 100 % Web Audio synthesis, offline (`OfflineAudioContext`, 48 kHz stereo).
* Karplus–Strong plucks are computed sample-by-sample in JS into `AudioBuffer`s (Web Audio's
  delay-in-a-loop has a 128-sample minimum which would cap pitch at 375 Hz); everything else is
  oscillator/noise graphs.
* Sequencer works in beats; a tempo map (piecewise constant/linear BPM, i.e. accelerando) converts
  beats ↔ seconds analytically, so music sections land exactly on film markers.
* Master: buses → generated-IR convolution reverb → compressor → limiter; the rendered buffer is then
  loudness-normalised to ≈ −16 LUFS (BS.1770 K-weighted integrated loudness measured in JS) with a
  −1 dBFS ceiling.

## Render pipeline

`tools/render.mjs` launches Playwright Chromium (`--use-angle=swiftshader --enable-unsafe-swiftshader`),
opens `?render&film=<name>&scale=<s>`, splits the frame range across `--workers N` browser processes,
each piping PNG frames into its own `ffmpeg` (libx264, crf 16, yuv420p), concatenates the segments,
renders audio in the page and muxes AAC 192 k with `+faststart`.
