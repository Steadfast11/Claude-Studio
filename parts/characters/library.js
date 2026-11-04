// parts/characters/library.js — the character library: every preset in data/characters/*.json becomes a part
// (archetype generator → design → shared creature rig). Pista (pista.js) stays its own hand-made part.
//   getPart('cat')({ color: '#888', hat: 'doppi', fit: 'miniature' | 'world', scale: 1 })
// Options: color (body), accent, hat (any of HATS or 'none'), fit, scale, voice, surface. Every character plays every
// rig action (see _rig.js + _rig-actions.js; list in ACTIONS). def.meta = { archetype, size, tags, group } for the gallery.
import { definePart } from '../../engine/core/registry.js';
import { createCreature } from './_rig.js';
import { designFromPreset } from './archetypes/index.js';
import animals from '../../data/characters/animals.json' with { type: 'json' };
import people from '../../data/characters/people.json' with { type: 'json' };
import fantasy from '../../data/characters/fantasy.json' with { type: 'json' };
import objects from '../../data/characters/objects.json' with { type: 'json' };

import { ACTIONS, SOLO_ACTIONS } from './_rig-actions.js';
export { ACTIONS };
export const CHARACTER_GROUPS = { animals, people, fantasy, objects };
export const CHARACTERS = {};
for (const [group, file] of Object.entries(CHARACTER_GROUPS)) {
  for (const [name, preset] of Object.entries(file.characters)) {
    const options = { color: preset.palette?.body || '#b08860', accent: preset.palette?.accent || '', hat: '', fit: 'miniature', scale: 1, voice: 1, surface: 'cloth' };
    const d0 = designFromPreset(preset, options);
    const r = Math.max(14, d0.height * 2.6 + 8);
    CHARACTERS[name] = definePart({
      name, kind: 'character', options, actions: SOLO_ACTIONS,
      footprint: d0.footprint,
      meta: { group, archetype: preset.archetype, size: preset.size, height: d0.height, tags: preset.tags || [], gait: d0.gait.mode },
      build(o, ctx) { return createCreature(designFromPreset(preset, o), o, ctx); },
      demo: { radius: r, height: d0.height * 0.7 + 3, lens: 50, fstop: 5.6, duration: 4, action: [[0.5, 'subject.gasp'], [1.6, 'subject.cheer'], [3, 'subject.blush']] },
    });
  }
}
export const characterIds = Object.keys(CHARACTERS);
