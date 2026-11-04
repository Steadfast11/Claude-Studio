# Phase 2 — character archetypes + prop recipe generator

## Read only
`docs/tasks/reports/phase-1.md`, `parts/characters/_rig.js`, `parts/characters/pista.js`, `engine/resolve.js`, `engine/schema.js`, one existing prop (e.g. `parts/props/piyola.js`). Grep for the rest.

## Goal
Variety from generators, not hand-made parts: one archetype or recipe file should yield hundreds of distinct, good-looking variants.

## Build
1. **Character archetypes** on the existing rig (`parts/characters/archetypes/`): blob, biped, quadruped, bird, fish/sea creature, insect, snake, robot, humanoid person (roles/costumes), object-creature (any prop + eyes + limbs). Params: proportions, size, palette, pattern, ears/horns/tail/wings/beak/fins, accessories (hats incl. cultural headwear, glasses, bags, tools). Extend the rig with quadruped, flying and swimming gaits. Faces stay shared. Pista must not change.
2. **Voxel recipe DSL** (`engine/voxel/recipe.js`, JSON): primitives (box, sphere, cylinder, cone, torus, lathe profile, extrude) + ops (union, subtract, mirror, repeat, scatter) + material/pattern slots + anchors.
3. **~150 recipes** in `data/recipes/*.json` (a few lines each) across: food, kitchen, furniture, tools, vehicles, nature, buildings, tech, sport, musical instruments, school, medical, toys, signs, shop/money, space, cartoon gear (no gore).
4. **Fallback**: unknown object → nearest category generic (gadget, box-with-label, food-blob, plant, vehicle-blob…) + color from a name hash + optional floating label.
5. Register everything in the registry, `data/tags.json` (en/uz/ru synonyms) and the schema enums. Film.json may now use `{"archetype": "...", "params": {...}}` and `{"recipe": "..."}`.
6. Re-run `npm run coverage -- --n 1000` (topics now draw from the new categories); keep 100 % valid and report the fallback rates.

## Limits
One stills sheet at `--scale 0.4`: a grid of ~12 archetype variants + ~24 recipes.

## Done when
Archetypes walk/fly/swim; 150 recipes build; coverage 100 % valid; ANOR unchanged.
