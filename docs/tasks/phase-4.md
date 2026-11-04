# Phase 4 — 10,000-topic coverage, QA, docs

## Read only
`docs/tasks/reports/phase-3.md`, `tools/coverage.mjs`, `tools/mock-assemble.mjs`, `docs/ASSEMBLER_PROMPT.md`, `engine/schema.js`. Grep for the rest.

## Build
1. Topics: 10,000 combinatorial topics from the axis lists (setting · time/weather · characters · objects · beats · mood · genre · audience · culture · format) plus a hand list of 100 tricky real ideas (e.g. "photosynthesis explained", "a robot learns to cook samsa", "a ghost afraid of the dark", "Navruz morning", "sneaker sale ad", "the water cycle", "Mars rover finds a flower", "grandma vs. a smart fridge", "a football final in the rain", "how a bill becomes law").
2. `npm run coverage -- --n 10000`: 100 % valid. Report the fallback rate per axis; target < 15 %. Do **one** fix loop: extend data/recipes/tags only where the numbers are worst.
3. `tools/qa.mjs`: ~1 frame per second at low res. Checks: frame not black or blown out, subject in frame, no NaNs, audio not silent or clipping → pass/fail JSON. Run it on 30 random films and tile them into 1–2 stills sheets.
4. If `LLM_URL` is set: 50 topics end-to-end through `npm run assemble`; report the schema pass rate on the first try and after retries. If it isn't set, skip.
5. Rewrite `docs/ASSEMBLER_PROMPT.md` (≤ 1,500 tokens) with the full catalog summary and 8 few-shots.
6. Docs: `docs/CATALOG.md` (auto-generated, one line per item), short `docs/NEW_FILM.md` (idea → film.json → render), README update.
7. ANOR regression: its stills sheet matches the one from before phase 1.
8. 3 example films from wildly different topics in `films/examples/*.json`.

## Done when
`renders/coverage.md` shows 10,000 topics, 100 % valid, fallback per axis and weakest areas; QA passes; docs done; ANOR unchanged.
