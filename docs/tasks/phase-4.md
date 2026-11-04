# Phase 4 — 300 props + variant/skin system + prop actions

## Read only
`docs/tasks/reports/phase-3.md`, one existing prop (`parts/props/piyola.js`), `parts/props/_prop-actions.js`, `engine/resolve.js`, `engine/schema.js`. Grep for the rest.

## Build
1. **Voxel recipe DSL** (`engine/voxel/recipe.js`, JSON): primitives (box, sphere, cylinder, cone, torus, lathe profile, extrude) + ops (union, subtract, mirror, repeat, scatter) + material/pattern slots + anchors + real-world size in cm.
2. **300 prop recipes** in `data/recipes/<category>/*.json` (a few lines each), ~20 per category: food, kitchen, furniture, tools, vehicles, nature (trees, rocks, flowers), buildings/street furniture, tech/devices, sport, musical instruments (incl. dutar, doira, karnay), school/office, medical, toys, signs, shop/money, space, garden/farm, clothing/bags, bathroom, party/holiday.
3. **Variant/skin system**: every prop × palette × culture style (uzbek, japanese, nordic, african, latin, arabic, indian, chinese, european, futuristic, generic) × wear (new/used/old) × season. One recipe gives dozens of looks.
4. **Prop actions** (generic, by tag): open/close (doors, lids, books, boxes), drive/roll (vehicles, balls, fruit), sway (plants, flags), spin (wheels, fans), pour, light on/off, ring/vibrate, break/burst into voxels, bounce. Movable props are flagged so chases always have a target.
5. **Fallback**: unknown object → nearest category generic + color from a name hash + optional floating label.
6. **Gallery**: a "Props" tab (category filter, skin switcher, action buttons) and `npm run stills -- --gallery props --scale 0.4` → contact sheets (≤ 3 images).
7. Register in registry, tags (en/uz/ru), schema; coverage 100 % valid; report fallback per field.

## Done when
300 recipes build at a consistent scale; skins and actions work; gallery tab + sheets exist; coverage 100 % valid; ANOR unchanged.
