# Phase 5 — weather, music styles, babble voice, text layer

## Read only
`docs/tasks/reports/phase-4.md`, `parts/music/lazgi-chase.js`, `engine/audio/` file list (grep inside), `engine/beats.js`, `engine/schema.js`.

## Build
1. **Weather** (stateless particles, data presets): rain, snow, fog, wind with leaves, storm flash, dust, bubbles underwater, stars in space. Works on any place.
2. **Music style tables** (`data/music/*.json`, ~12 styles): folk incl. lazgi, lo-fi, light orchestral, chiptune, jazzy, electronic, epic, spooky, lullaby, march, latin, ad-jingle. Mood drives harmony. Cues are built from sections that **auto-fit any beat list and any duration (5–90 s)**. New synth instruments: FM keys, string pad, brass-ish, lead, kick/snare/hat, marimba.
3. **SFX categories**: impacts by material (wood, ceramic, metal, glass, soft), whooshes, footsteps by surface, magic, mechanical, nature/city ambiences per place, UI blips.
4. **Babble voice**: synthesized speech per character (pitch/timbre/emotion) synced to the `talk` action + speech bubbles/subtitles, so dialogue works in any language.
5. **Text & explain layer**: titles, captions, labels, arrows, counters, simple voxel charts, step numbers, call-to-action end card; Latin + Cyrillic. Formats 16:9 / 9:16 / 1:1 with format-aware framing.
6. **Beats to ~20**: add reveal, want, race, sneak, fall, rescue, build, transform, dance, comfort, surprise, explain-step, countdown, outro-cta.
7. **Gallery**: a "Sound" tab (play each music style at 3 lengths, each SFX, each voice) and a "Weather" switcher on the Places tab. Update schema, tags, coverage (100 % valid).

## Done when
Every option compiles from film.json; music fits any duration; voices and text work; coverage 100 % valid; ANOR unchanged.
