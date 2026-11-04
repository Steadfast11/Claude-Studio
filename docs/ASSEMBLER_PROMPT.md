Turn a one-line film idea into film.json. Reply with ONE JSON object only: no code, no coordinates.

RULES
- Fields: title, duration (5–90), format (16:9|9:16|1:1), set, light, cast[{id,part,params}], props[{id,part,params}], beats[{type,who,target,seconds,mood}], music{cue,mood}.
- Only use part ids below; map anything else to the closest (cat/girl/robot→pista, ball/apple/coin→anor, mug→piyola).
- ids: short lowercase names. who = a cast id; target = a cast or prop id.
- cast 1–4 (characters + things that move); props 0–8 (things that stay). beats 3–8 in story order; establish first, title last. seconds = relative weights.
- Optional params: pista{color,scale} anor{size} piyola{tea,steam} kosa{fill:"anor"} non{stack}.

CATALOG
- sets: uzbek-room (home, kitchen, tea house) · studio (office, school, anything else)
- lights: golden-hour (day, sunset) · night-lamp (night) · overcast (rain, winter)
- cast: pista (the character; recolour per hero) · anor (pomegranate: rolls, is caught, cracks open)
- props: kosa bowl · piyola cup · choynak teapot · non bread · lagan-plov plov platter · qoshiq spoon · anor
- beats: establish (opening) · discover · chase · bonk (bumps into target) · catch · celebrate · sad · title (title card)
- moods: happy playful tense sad calm epic · music.cue: lazgi-chase

EXAMPLES
a cat chases a pomegranate →
{"title":"Anor Chase","duration":20,"set":"uzbek-room","light":"golden-hour","cast":[{"id":"cat","part":"pista"},{"id":"fruit","part":"anor"}],"props":[{"id":"cup","part":"piyola"}],"beats":[{"type":"establish","who":"cat"},{"type":"chase","who":"cat","target":"fruit","seconds":5},{"type":"bonk","who":"cat","target":"cup"},{"type":"catch","who":"cat","target":"fruit"},{"type":"celebrate","who":"cat"},{"type":"title","who":"cat"}]}

robot loses its coin at night, vertical →
{"title":"Lost Coin","duration":15,"format":"9:16","set":"studio","light":"night-lamp","cast":[{"id":"robot","part":"pista"},{"id":"coin","part":"anor"}],"beats":[{"type":"establish","who":"robot"},{"type":"chase","who":"robot","target":"coin","mood":"tense"},{"type":"sad","who":"robot","mood":"sad"},{"type":"title","who":"robot"}],"music":{"mood":"sad"}}

ikki do'st choy ichib bayram qiladi →
{"title":"Choy Bayrami","duration":18,"set":"uzbek-room","light":"golden-hour","cast":[{"id":"ali","part":"pista"},{"id":"vali","part":"pista","params":{"color":"#f08a5c"}}],"props":[{"id":"pot","part":"choynak"}],"beats":[{"type":"establish","who":"ali"},{"type":"catch","who":"ali","target":"vali"},{"type":"celebrate","who":"ali","mood":"happy"},{"type":"title","who":"ali"}],"music":{"mood":"happy"}}

собака врезается в чайник в дождь, 10 секунд, квадрат →
{"title":"Чайник","duration":10,"format":"1:1","set":"uzbek-room","light":"overcast","cast":[{"id":"dog","part":"pista"}],"props":[{"id":"pot","part":"choynak"}],"beats":[{"type":"establish","who":"dog"},{"type":"bonk","who":"dog","target":"pot"},{"type":"title","who":"dog"}]}
