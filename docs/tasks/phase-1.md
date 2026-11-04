# Phase 1 — film.json assembler (existing parts only)

## Read only
`README.md`, `docs/ARCHITECTURE.md`, `parts/index.js`, `engine/film.js`, `films/anor/film.js`. Grep for anything else.

## Goal
A cheap ~50B model gets a one-line idea and writes a small `film.json` (no code, no coordinates). We compile it into the existing film DSL using **only the existing parts**. Any input must give a valid film.

## Build
1. `engine/schema.js` + `npm run schema` → `docs/film.schema.json`. Enums come from the parts registry. Fields: `title, duration (5–90), format (16:9|9:16|1:1), set, light, cast[{id, part, params}], props[{id, part, params}], beats[{type, who, target, seconds, mood}], music{cue, mood}`.
2. `engine/beats.js`: 8 beat templates: `establish, discover, chase, bonk, catch, celebrate, sad, title`. Each one creates camera shot + actions + sfx for its time span, built from existing rig actions, camera rigs and sfx. Beat seconds are auto-scaled to `duration`. Adding a new beat = adding one entry.
3. `engine/layout.js`: places props into named slots of the set (no coordinates in JSON, no overlaps, cast paths stay reachable).
4. `engine/compile.js`: film.json → `film()` DSL object. Make `?film-json=path` work in the player and `npm run render -- --film-json path` work.
5. `engine/resolve.js` + `data/tags.json`: words/synonyms (en/uz/ru) → existing part ids. Unknown → nearest category → default. Never throws.
6. `engine/validate.js`: short, human-readable errors (`"beats[2].who: 'cat' not in cast"`) + an auto-fix pass (resolve unknown ids, rescale seconds).
7. `docs/ASSEMBLER_PROMPT.md` (≤ 800 tokens): rules + catalog summary + 4 few-shot examples (idea → film.json).
   `tools/assemble.mjs` + `npm run assemble -- "idea"`: idea → OpenAI-compatible endpoint (`LLM_URL`, `LLM_MODEL`) → validate → max 2 retries → auto-fix → `films/<slug>/film.json`. If `LLM_URL` is unset, use the mock assembler.
8. `tools/mock-assemble.mjs` + `tools/coverage.mjs` + `npm run coverage -- --n 1000`: synthetic topics from small word lists → deterministic film.json → compile + validate all. Write `renders/coverage.md`: valid %, fallback % per field.

## Limits
Only add files, plus small hooks in `engine/film.js`, `tools/render.mjs` and the player if needed. One stills sheet of one compiled film at `--scale 0.4` to prove it draws.

## Done when
`npm run coverage -- --n 1000` → 100 % valid; `npm run assemble -- "a cat chases a pomegranate"` gives a film.json that compiles; the stills sheet shows a sensible film.
