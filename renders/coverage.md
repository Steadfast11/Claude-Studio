# film.json coverage (phase 2)

1000 synthetic topics (seed 1) from small en/uz/ru word lists → `tools/mock-assemble.mjs` (free words, like a small LLM)
→ `engine/validate.js` autofix → validate → `engine/compile.js` → structural check. 37.9 s.

| check | result |
|---|---|
| raw mock film.json already valid (before autofix) | 0.0 % |
| valid after autofix | 100.0 % |
| compiled without throwing | 100.0 % |
| **valid end-to-end (autofix + compile + deep check)** | **100.0 %** |
| built + seeked in Chromium | 3 / 3 |
| director shots passing the framing check (start/mid/end: in frame, ≥ 12 % height, not cut, face visible) | 5727 / 5966 (96.0 %) |

Director: most used presets crane-in 1000 · outro-pull 1000 · gasp-two-shot 920 · hero-low 775 · follow-3q 447 · chase-front 403 · high-lonely 322 · kosa-insert 255.
Remaining framing misses (kept best effort): N% of frame height ×180 · face away (N°) ×120 · cut by frame edge ×18.

## Fallbacks per field

"fallback" = not an exact id and not a listed synonym (category default, fuzzy match or kind default).

| field | values | fallback % | exact / synonym / category / fuzzy / default |
|---|---|---|---|
| beats.action | 206 | 0.0 % | 0 / 206 / 0 / 0 / 0 |
| beats.mood | 2184 | 0.0 % | 292 / 1892 / 0 / 0 / 0 |
| beats.target | 5052 | 0.0 % | 5052 / 0 / 0 / 0 / 0 |
| beats.type | 5052 | 0.0 % | 5052 / 0 / 0 / 0 / 0 |
| beats.who | 5052 | 0.0 % | 5052 / 0 / 0 / 0 / 0 |
| cast.part | 2074 | 33.0 % | 790 / 600 / 156 / 177 / 351 |
| duration | 1000 | 18.3 % | 817 / 0 / 0 / 183 / 0 |
| format | 1000 | 39.6 % | 604 / 0 / 0 / 396 / 0 |
| light | 1000 | 0.0 % | 0 / 1000 / 0 / 0 / 0 |
| music.cue | 1000 | 0.0 % | 1000 / 0 / 0 / 0 / 0 |
| music.mood | 1000 | 0.0 % | 528 / 472 / 0 / 0 / 0 |
| props.part | 2233 | 59.3 % | 64 / 845 / 691 / 110 / 523 |
| set | 1000 | 0.0 % | 0 / 1000 / 0 / 0 / 0 |
| title | 1000 | 0.0 % | 1000 / 0 / 0 / 0 / 0 |

## Most common auto-fixes

- props[].part: 2169
- cast[].part: 1284
- set: 1000
- light: 1000
- format: 396
- duration: 183
- beats[].type: 105
- beats: 56

## Failures

none

Sample topics: `грустный an astronaut finds choynak in space during a storm` · `g'amgin a white rabbit dances around мяч in space during a storm 45 soniya square` · `cozy кот rescues a rocket at the office kechasi 45 soniya` · `quvnoq a white rabbit hugs a snowman underwater in the rain 90s vertical` · `epic two friends hugs a cup of tea bozorda ночью 90s vertical`
