# Phase 3 — sets, weather, music styles, voice, text layer

## Read only
`docs/tasks/reports/phase-2.md`, `parts/sets/uzbek-room.js`, `parts/lights/golden-hour.js`, `parts/music/lazgi-chase.js`, `engine/beats.js`, `engine/schema.js`. Grep for the rest.

## Build
1. **Set generator** (`parts/sets/world.js` + `data/sets/*.json`): tabletop miniature, room, street, market, field, forest, desert, mountains, snow, beach, underwater, space, rooftop city, stage, abstract studio/void. Scale modes: tabletop-mini or full world. Layout presets with named slots.
2. **Culture styles** as data (palette + patterns + architecture hints): uzbek, japanese, chinese, indian, arabic, african, latin, nordic, european, american, futuristic, generic.
3. **Light / time / weather**: dawn, day, golden, dusk, night, neon, candle, studio; rain, snow, fog, wind with leaves, storm flash, dust (stateless particles).
4. **Music style tables** (`data/music/*.json`, ~12 styles): folk incl. lazgi, lo-fi, light orchestral, chiptune, jazzy, electronic, epic, spooky, lullaby, march, latin, ad-jingle. Mood drives harmony. Cues are built from sections that **auto-fit any beat list and any duration (5–90 s)**. Add synth instruments: FM keys, string pad, brass-ish, lead, kick/snare/hat, marimba.
5. **SFX categories**: impacts by material (wood, ceramic, metal, glass, soft), whooshes, footsteps by surface, magic, mechanical, nature ambiences, UI blips.
6. **Babble voice**: synthesized speech per character (pitch/timbre/emotion) + speech bubbles/subtitles, so dialogue works in any language.
7. **Text & explain layer**: titles, captions, labels, arrows, counters, simple voxel charts, step numbers, call-to-action end card; Latin + Cyrillic. Formats 16:9 / 9:16 / 1:1.
8. **Beats to ~20**: add reveal, want, race, sneak, fall, rescue, build, transform, dance, comfort, surprise, explain-step, countdown, outro-cta.
9. Update schema, tags and coverage; keep 100 % valid.

## Limits
One stills sheet at `--scale 0.4`: 12 tiles mixing sets × times × weather × formats.

## Done when
Every new option compiles from film.json; music fits any duration; coverage 100 % valid; ANOR unchanged.
