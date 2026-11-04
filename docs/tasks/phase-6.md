# Phase 6 — 10,000-topic coverage, QA, showreel, docs

## Read only
`docs/tasks/reports/phase-5.md`, `tools/coverage.mjs`, `tools/mock-assemble.mjs`, `docs/ASSEMBLER_PROMPT.md`, `engine/schema.js`. Grep for the rest.

## Build
1. Topics: 10,000 combinatorial topics from the axis lists (setting · time/weather · characters · objects · beats · mood · genre · audience · culture · format) plus 100 tricky real ideas (e.g. "photosynthesis explained", "a robot learns to cook samsa", "a ghost afraid of the dark", "Navruz morning", "sneaker sale ad", "the water cycle", "Mars rover finds a flower", "grandma vs. a smart fridge", "a football final in the rain", "how a bill becomes law").
2. `npm run coverage -- --n 10000`: 100 % valid; fallback rate per axis, target < 15 %. One fix loop: extend data/tags only where the numbers are worst.
3. `tools/qa.mjs`: ~1 frame/s at low res. Checks: frame not black or blown out, subject in frame with face visible, nothing floating or intersecting, no NaNs, audio not silent or clipping → pass/fail JSON. Run on 30 random films; tile into 1–2 sheets.
4. If `LLM_URL` is set: 50 topics end-to-end through `npm run assemble`; report the schema pass rate. Otherwise skip.
5. `docs/ASSEMBLER_PROMPT.md` (≤ 1,500 tokens): full catalog summary + 8 few-shots.
6. **Showreel**: `films/showreel/film.json` (~30 s) that flies through many places, characters and props; the owner renders it locally.
7. **10 example films** in `films/examples/*.json` from wildly different topics (story, kids, explainer, ad, sport, sci-fi, nature, holiday, comedy, history).
8. Docs: `docs/CATALOG.md` (auto-generated), short `docs/NEW_FILM.md` (idea → film.json → render), README update. ANOR regression: its stills sheet matches the pre-phase-1 one.

## Done when
`renders/coverage.md` shows 10,000 topics, 100 % valid, fallback per axis; QA passes; showreel + 10 examples exist; docs done; ANOR unchanged.
