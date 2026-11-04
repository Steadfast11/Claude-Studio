// engine/schema.js — the film.json contract (what a small LLM writes: no code, no coordinates).
// Enums come from the parts registry (engine/resolve.js idsFor) and the beat templates (engine/beats.js).
//   npm run schema  → docs/film.schema.json
import { idsFor, tags } from './resolve.js';
import { BEATS } from './beats.js';
import { listParts } from './core/registry.js';

export const FORMATS = ['16:9', '9:16', '1:1'];
export const FORMAT_ASPECT = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 };
export const LIMITS = { duration: [5, 90], cast: 4, props: 8, beats: 12, minBeat: 0.9 };
export const moods = () => Object.keys(tags.moods);
/** Every action some character part declares (def.actions) — what beats[].action may name. */
export const actions = () => [...new Set(listParts().filter((d) => d.kind === 'character').flatMap((d) => d.actions || []))];

/** Compact catalogue: what exists right now (used by the schema, the validator and the assembler prompt). */
export function catalog() {
  return {
    sets: idsFor('set'), lights: idsFor('light'), music: idsFor('music'),
    cast: idsFor('cast'), props: idsFor('prop'), beats: Object.keys(BEATS), moods: moods(), formats: FORMATS, actions: actions(),
  };
}

export function buildSchema() {
  const c = catalog();
  const part = (ids) => ({ type: 'object', required: ['id', 'part'], additionalProperties: false, properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,23}$' }, part: { enum: ids }, params: { type: 'object' } } });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'voxel-studio/film.schema.json',
    title: 'Voxel Studio film.json',
    description: 'A short film as data. Compiled by engine/compile.js into the film() DSL using existing parts only. Unknown words are resolved to the closest part (engine/resolve.js).',
    type: 'object', additionalProperties: false,
    required: ['title', 'duration', 'set', 'cast', 'beats'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 40 },
      duration: { type: 'number', minimum: LIMITS.duration[0], maximum: LIMITS.duration[1] },
      format: { enum: c.formats, default: '16:9' },
      set: { enum: c.sets }, light: { enum: c.lights },
      cast: { type: 'array', minItems: 1, maxItems: LIMITS.cast, items: part(c.cast) },
      props: { type: 'array', maxItems: LIMITS.props, items: part(c.props) },
      beats: { type: 'array', minItems: 1, maxItems: LIMITS.beats, items: { type: 'object', required: ['type'], additionalProperties: false, properties: {
        type: { enum: c.beats }, who: { type: 'string', description: 'cast id' }, target: { type: 'string', description: 'cast or prop id' },
        seconds: { type: 'number', exclusiveMinimum: 0, description: 'relative weight; rescaled to duration' }, mood: { enum: c.moods },
        action: { enum: c.actions, description: 'optional character action played by who during the beat (perform: the main action)' } } } },
      music: { type: 'object', additionalProperties: false, properties: { cue: { enum: c.music }, mood: { enum: c.moods } } },
    },
  };
}
