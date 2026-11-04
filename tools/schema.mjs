// tools/schema.mjs — npm run schema → docs/film.schema.json (enums from the parts registry and beat templates)
import fs from 'node:fs';
import { buildSchema } from '../engine/schema.js';
fs.writeFileSync('docs/film.schema.json', JSON.stringify(buildSchema(), null, 2) + '\n');
console.log('wrote docs/film.schema.json');
