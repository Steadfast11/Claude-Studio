# Phase 2 — character archetypes + prop recipe generator

## Read only
`docs/PHASE1.md`, `engine/beats.js`, `engine/layout.js`, `parts/characters/_rig.js`, `parts/characters/pista.js`, `engine/resolve.js`, `engine/schema.js`, one existing prop (e.g. `parts/props/piyola.js`). Grep for the rest.

## Goal
Variety from generators, not hand-made parts: one archetype or recipe file should yield hundreds of distinct, good-looking variants.

## Step 0 — fix the auto-director first (`engine/beats.js`, `engine/layout.js`, `engine/compile.js`)
A phase-1 film (`npm run assemble -- "robot somsa pishirishni o'rganadi"`) showed:
- The hero faces away from camera in most shots. Rule: every shot that features a character puts the camera in its **front half-space** (angle between the character's facing and the direction to the camera ≤ 70°), using the facing at that moment; for a moving actor, frame from ahead or 3/4 front.
- The `discover` shot showed only a prop for 1.3 s with no hero. Rule: reaction beats (discover, surprise, sad) frame **both** who and target (or cut hero → target → hero), never a prop alone for > 0.8 s.
- `chase` targeted a static prop (non), so nothing moved. Rule: chase/race/catch need a **movable target** (roll/hop/fly action, or a character); otherwise autofix swaps the beat (chase → discover + walk-to) or picks a movable prop.
- Framing check: project the subject's bounding box each shot (sample start/mid/end); it must be in frame, ≥ 12 % of frame height, not cut by the edge, and its face visible. If a check fails, try the next camera option; the validator reports what it changed.
Re-assemble that same idea, render one stills sheet, and confirm the face is visible in every character shot before moving on.

## Build
1. **Character archetypes** on the existing rig (`parts/characters/archetypes/`): blob, biped, quadruped, bird, fish/sea creature, insect, snake, robot, humanoid person (roles/costumes), object-creature (any prop + eyes + limbs). Params: proportions, size, palette, pattern, ears/horns/tail/wings/beak/fins, accessories (hats incl. cultural headwear, glasses, bags, tools). Extend the rig with quadruped, flying and swimming gaits. Faces stay shared. Pista must not change.
2. **Voxel recipe DSL** (`engine/voxel/recipe.js`, JSON): primitives (box, sphere, cylinder, cone, torus, lathe profile, extrude) + ops (union, subtract, mirror, repeat, scatter) + material/pattern slots + anchors.
3. **~150 recipes** in `data/recipes/*.json` (a few lines each) across: food, kitchen, furniture, tools, vehicles, nature, buildings, tech, sport, musical instruments, school, medical, toys, signs, shop/money, space, cartoon gear (no gore).
4. **Fallback**: unknown object → nearest category generic (gadget, box-with-label, food-blob, plant, vehicle-blob…) + color from a name hash + optional floating label.
5. Register everything in the registry, `data/tags.json` (en/uz/ru synonyms) and the schema enums. Film.json may now use `{"archetype": "...", "params": {...}}` and `{"recipe": "..."}`.
6. Re-run `npm run coverage -- --n 1000` (topics now draw from the new categories); keep 100 % valid and report the fallback rates.

## Limits
Two stills sheets at `--scale 0.4`: the Step 0 re-check, and a grid of ~12 archetype variants + ~24 recipes.

## Done when
Step 0 rules hold (face visible, no empty reaction shots, chases move); archetypes walk/fly/swim; 150 recipes build; coverage 100 % valid; ANOR unchanged.
