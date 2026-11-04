# Phase 2 — director fix + 60 characters + animation library + gallery

## Read only
`docs/PHASE1.md`, `engine/beats.js`, `engine/layout.js`, `parts/characters/_rig.js`, `parts/characters/pista.js`, `films/anor/film.js`, `engine/resolve.js`, `engine/schema.js`. Grep for the rest.

## Step 0 — director learned from ANOR (do first)
1. Extract ANOR's camera language into `data/director/presets.json`: one preset per beat type (lens, height, angle, distance, move, focus pull, hold time), taken from ANOR's real shots. `engine/beats.js` uses these presets instead of ad-hoc cameras.
2. Rules: the camera stays in the character's **front half-space** (facing vs camera ≤ 70°). Reaction beats (discover, surprise, sad) frame **both** who and target; never a prop alone for > 0.8 s. chase/race/catch need a **movable** target, otherwise autofix swaps the beat.
3. Framing check per shot (start/mid/end): subject in frame, ≥ 12 % of frame height, not cut by the edge, face visible; on failure try the next preset.
4. Re-assemble `"robot somsa pishirishni o'rganadi"`, render one stills sheet, and confirm the face is visible in every character shot.

## Build
1. **Archetypes** on the existing rig (`parts/characters/archetypes/`): blob, biped, quadruped, bird, fish/sea, insect, snake, robot, humanoid person, object-creature (any prop + eyes + limbs). Add quadruped, flying and swimming gaits. Pista must not change.
2. **60 named characters** as compact presets in `data/characters/*.json` (archetype + proportions + palette + pattern + features + accessories): ~25 animals (cat, dog, sheep, horse, camel, donkey, cow, rooster, sparrow, dove, owl, fish, turtle, frog, bee, ant, snail, hedgehog, rabbit, fox, bear, lion, elephant, monkey, penguin), ~15 people/roles (child, grandma, grandpa, chef, teacher, doctor, farmer, builder, police-style guard, athlete, musician, scientist, astronaut, shopkeeper, student), ~10 fantasy (dragon, ghost, alien, wizard-style, fairy, monster, dino, unicorn-style, genie, snowman), ~10 robots/object-creatures (teapot-creature, kettle, toaster, book, car-buddy, rocket, cloud, sun, star, pomegranate-buddy). Cultural headwear/costume options as accessories (doppi, beanie, cap, crown, helmet, chef hat, scarf, glasses…).
3. **Animation library (≥ 40 actions)** shared by every archetype, adapted per gait: idle, walk, run, sneak, jump, hop, fall, get-up, sit, lie-down, sleep, wake, wave, point, clap, cheer, dance (3 styles), eat, drink, carry, push, pull, throw, catch, kick, climb, swim, fly-takeoff, fly, land, bonk, dizzy, cry, laugh, angry, scared, shy, think, talk (mouth flap), look-at, nod, shake-head. Expose all in the schema.
4. **Gallery** `gallery.html` (+ `npm run gallery`): a grid of every character with a live turntable and a dropdown to play any action; filters by archetype/tag. Also `npm run stills -- --gallery characters --scale 0.4` → one contact sheet of all 60.
5. Register everything in the registry, `data/tags.json` (en/uz/ru synonyms) and the schema; re-run `npm run coverage -- --n 1000` and keep 100 % valid.

## Done when
Director rules hold on the re-check sheet; 60 characters build and play all 40+ actions; the gallery opens; coverage 100 % valid; ANOR unchanged.
