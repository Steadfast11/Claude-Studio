# Voxel Studio — rules for every session

Code-drawn voxel short films. Layers: `engine/` (generic) → `parts/` (reusable library) → `films/` (composition only). Read `docs/ARCHITECTURE.md` only when you need it.

## Autopilot
If the user says anything like "start", "boshla", "davom et", "next", "keyingi bosqich", or pastes a phase prompt:
1. Open `docs/tasks/STATUS.md`, take the **first unchecked phase**, read its file in `docs/tasks/`.
2. Do exactly that phase, nothing more.
3. When it's done: tick it in `STATUS.md`, write `docs/tasks/reports/phase-N.md` (≤ 30 lines: what was built, numbers, commands, decisions, hints for the next phase), commit.
4. Push to `main` if allowed; otherwise push your branch and open a PR to `main`.
5. Final message to the user **in Uzbek**, ≤ 15 lines: what was built, key numbers, commands to try, PR link if any, which phase is next. Then stop.

If every phase is checked, say so in Uzbek and stop.

## Visible results (always)
- Every phase ends with something the owner can **see**: update `gallery.html` and make the phase's contact sheet(s) in `renders/`. In the final message give counts (e.g. "60 characters, 42 actions") and the paths of the sheets.
- One scale standard: 1 unit = 1 cm, every asset carries its real-world size. A film picks `scale: "miniature"` (tiny hero in a real-size world, like ANOR) or `"world"` (characters at life size). Assets must look right in both.
- Quality bar is ANOR: chamfered voxels, per-voxel color jitter, readable silhouettes, faces toward camera. Nothing floating, intersecting or cut by the frame.

## Budget rules (always)
- Read only the files you need; grep before opening; keep tool output short (`| head`, `| tail`).
- No full renders: the cloud has no GPU. Only the stills sheets the phase file asks for, at `--scale 0.4`.
- Prefer generators and compact JSON data over hand-made one-off objects. No new dependencies.
- Don't ask questions; decide and record it in the phase report.
- Never change how ANOR looks or sounds (`films/anor/`, existing parts' behavior).

## Hard rules
Everything is procedural (no downloaded models, textures, samples or HDRIs). Deterministic: seeded RNG, pure functions of `t`. `engine/` stays generic. No real franchises, logos or real people's likenesses; resolve those to generic archetypes.
