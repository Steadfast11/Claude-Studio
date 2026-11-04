# Phase 1 — film.json assembler (existing parts only)

**Built.** A one-line idea → small `film.json` (no code, no coordinates) → `film()` DSL, using only today's parts.
- `engine/schema.js` + `npm run schema` → `docs/film.schema.json` (enums from the parts registry + beat templates).
- `engine/beats.js` — 8 templates (establish, discover, chase, bonk, catch, celebrate, sad, title) → shots + actions + sfx from existing rig/prop actions, camera rigs (static/crane/push/pull/track) and sfx. New beat = one entry.
- `engine/layout.js` — cast start spots + 12 named prop slots per table (size from the set's own options), no overlaps, routes pushed clear of props.
- `engine/compile.js` — autofix → layout → beats → music markers (lazgi sections land on chase/bonk/catch/celebrate/title) → title card/letterbox. Hooks: `?film-json=path` (player, + `format` 9:16 / 1:1 canvas), `--film-json` in render/stills.
- `engine/resolve.js` + `data/tags.json` — en/uz/ru words → part ids: exact → synonym → category default → fuzzy (edit distance, crude stems) → kind default. Never throws.
- `engine/validate.js` — short errors (`beats[0].who: 'cat' not in cast`) + `autofix` (resolve ids, repair who/target, clamp duration, default story, rescale seconds ≥ 0.9 s).
- `docs/ASSEMBLER_PROMPT.md` (~800 tokens, 4 few-shots en/en/uz/ru) · `tools/assemble.mjs` (OpenAI-compatible, 2 retries with the errors, then autofix; mock when `LLM_URL` is unset).
- `tools/mock-assemble.mjs` (free words, like a small model) · `tools/coverage.mjs` → `renders/coverage.md`.

**Commands**
`npm run assemble -- "a cat chases a pomegranate"` · `LLM_URL=http://host/v1 LLM_MODEL=… npm run assemble -- "idea"`
`npm run coverage -- --n 1000 [--browser 3]` · `npm run schema` · `npm run stills -- --film-json films/<slug>/film.json --scale 0.4`

**Numbers (1,000 topics, seed 1).** Valid end-to-end 100 % (autofix + compile + structural check: actions exist on each part, paths avoid props, shots tile, markers increase, sfx exist); 3/3 sampled films build + seek in Chromium. Raw mock JSON valid 0 % (by design: free words). Fallback (not exact/synonym): cast.part 87.8 % (mostly cat/robot/girl → pista), props.part 62.2 %, format 39.6 % ("vertical" → 9:16), duration 18.3 % (clamped), set/light/beats 0 %. Stills: `renders/a-cat-chases-a-pomegranate-sheet.png`.

**Decisions.** film.json `seconds` are weights. `dasturxon`/`kurpacha` are set dressing, not table props (→ `non`). Every character is `pista` recoloured (repeat casts get a palette). Only `anor` moves; cups/teapot wobble. One music cue, so mood only sets bpm/key. Moving actors use `walk {path, dur}` so positions are known at every beat. 16:9 output is unchanged; 9:16 / 1:1 only resize the canvas (not shot-tested). ANOR untouched.

**Phase 2 should add.** Character archetypes (silhouettes per category: animal/robot/person) so cat ≠ pista; a prop recipe generator so unknown nouns stop collapsing to `non`; framing pass (discover-reaction and celebrate shots are too tight, hero can face away); vertical-aware camera offsets; test with a real ~50B model (only the mock and a fake endpoint were tested).
