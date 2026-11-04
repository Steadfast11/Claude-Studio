# Phase 3 — 40 places: modular rooms & worlds + light presets

## Read only
`docs/tasks/reports/phase-2.md`, `parts/sets/uzbek-room.js`, `parts/sets/studio.js`, `parts/lights/golden-hour.js`, `engine/layout.js`, `engine/schema.js`. Grep for the rest.

## Build
1. **Modular kit** (`parts/sets/kit/`): floor, wall (plain/tiled/brick/wood/ganch), window, door, arch, stairs, ceiling, columns, railings, fences, ground tiles (grass, sand, snow, stone, water, road), sky/backdrop, terrain hills. Kit pieces are generators with params, not one-offs.
2. **Place recipes** in `data/places/*.json` (compact): pieces + furniture/dressing + **named slots** (for props and characters) + **camera spots** (wide, mid, close, low) + default light + ambient sound tag. Every place works in both scale modes (miniature hero on a tabletop, or full-size world).
3. **40 places** (at least): home — kitchen, living room, bedroom, kids room, bathroom, balcony, garage, yard with tandir; uzbek — chaikhana, bazaar, mahalla street, courtyard with ayvan; city — street, square, bus stop, shop, café, office, rooftop, park, playground; school — classroom, library, gym; work — hospital room, lab, factory, farm/barn, construction site, kitchen of a restaurant; fun — stadium, stage/theater, museum, circus tent; nature — forest, mountains, desert, beach, river, snowy field, cave, underwater; fantasy/sci-fi — space station, moon surface, castle hall, pirate ship deck.
4. **Light presets** (data): dawn, day, golden, dusk, night, neon, candle, studio, overcast — any place × any preset works.
5. **Gallery**: add a "Places" tab (live fly-through camera per place, light preset switch) and `npm run stills -- --gallery places --scale 0.4` → one sheet of all 40.
6. Register in registry, tags (en/uz/ru), schema; layout uses the place slots; coverage 100 % valid.

## Done when
40 places build with slots + camera spots; every light preset works on every place; gallery tab + sheet exist; coverage 100 % valid; ANOR unchanged.
