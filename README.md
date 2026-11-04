# Voxel Studio

A JavaScript construction kit for code-drawn voxel short films: an engine (Three.js), a library of
reusable parts, a declarative film-script DSL and a deterministic render pipeline (picture + fully
synthesized Web Audio soundtrack → MP4).

*Work in progress — see `docs/ARCHITECTURE.md`.*

```bash
npm install
npm run dev            # preview at http://localhost:5173/?film=anor
npm run gallery        # character gallery at http://localhost:5173/gallery.html (turntables, any action)
```

## Render ANOR on a Mac

Needs Node 20+ and ffmpeg (`brew install node ffmpeg`).

```bash
npm install
npm run setup                      # downloads Playwright's Chromium once
npm run render -- --film anor      # → renders/anor.mp4 (1920×1080, 60 fps, AAC audio)
```

Headless Chromium uses the Mac's GPU through Metal. If the render log's `WebGL:` line says SwiftShader (software),
run it with a visible browser window instead: `HEADED=1 npm run render -- --film anor`.
Faster checks: `--scale 0.5`, `--from 9 --to 12`, `--quality preview`. Preview in the browser: `npm run dev`.
