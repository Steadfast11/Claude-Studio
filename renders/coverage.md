# film.json coverage (phase 1)

1000 synthetic topics (seed 1) from small en/uz/ru word lists → `tools/mock-assemble.mjs` (free words, like a small LLM)
→ `engine/validate.js` autofix → validate → `engine/compile.js` → structural check. 26.8 s.

| check | result |
|---|---|
| raw mock film.json already valid (before autofix) | 0.0 % |
| valid after autofix | 100.0 % |
| compiled without throwing | 100.0 % |
| **valid end-to-end (autofix + compile + deep check)** | **100.0 %** |
| built + seeked in Chromium | 3 / 3 |

## Fallbacks per field

"fallback" = not an exact id and not a listed synonym (category default, fuzzy match or kind default).

| field | values | fallback % | exact / synonym / category / fuzzy / default |
|---|---|---|---|
| beats.mood | 2256 | 0.0 % | 297 / 1959 / 0 / 0 / 0 |
| beats.target | 5145 | 0.0 % | 5145 / 0 / 0 / 0 / 0 |
| beats.type | 5145 | 0.0 % | 5145 / 0 / 0 / 0 / 0 |
| beats.who | 5145 | 0.0 % | 5145 / 0 / 0 / 0 / 0 |
| cast.part | 1979 | 87.8 % | 74 / 168 / 958 / 187 / 592 |
| duration | 1000 | 18.3 % | 817 / 0 / 0 / 183 / 0 |
| format | 1000 | 39.6 % | 604 / 0 / 0 / 396 / 0 |
| light | 1000 | 0.0 % | 0 / 1000 / 0 / 0 / 0 |
| music.cue | 1000 | 0.0 % | 1000 / 0 / 0 / 0 / 0 |
| music.mood | 1000 | 0.0 % | 528 / 472 / 0 / 0 / 0 |
| props.part | 2283 | 62.2 % | 64 / 800 / 657 / 138 / 624 |
| set | 1000 | 0.0 % | 0 / 1000 / 0 / 0 / 0 |
| title | 1000 | 0.0 % | 1000 / 0 / 0 / 0 / 0 |

## Most common auto-fixes

- props[].part: 2219
- cast[].part: 1905
- set: 1000
- light: 1000
- format: 396
- duration: 183
- beats: 80

## Failures

none

Sample topics: `грустный an astronaut finds choynak in space during a storm` · `g'amgin a white rabbit dances around мяч in space during a storm 45 soniya square` · `cozy кот rescues a rocket at the office kechasi 45 soniya` · `quvnoq a white rabbit hugs a snowman underwater in the rain 90s vertical` · `epic two friends hugs a cup of tea bozorda ночью 90s vertical`
