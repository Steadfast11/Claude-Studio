// engine/core/registry.js — the part contract.
//
//   export const piyola = definePart({
//     name: 'piyola', kind: 'prop',                 // prop | character | set | light | music | fx
//     options: { color: '#1d4f9c', scale: 1 },      // documented defaults (every option has one)
//     build(opts, ctx) { return { root, update?(t, state), anchors?, bounds?, actions? }; },
//     demo: { at: 0, camera: {...} },               // optional: how stills.mjs --part shoots it
//   });
//
// Calling the factory returns a PartSpec (nothing is built yet): piyola({ color: '#c00' }).at([10, 0, 5])
// The stage builds specs with ctx (see stage.js). Parts can also be looked up by name: getPart('piyola').

const registry = new Map();

export class PartSpec {
  constructor(def, opts) {
    this.def = def;
    this.name = def.name;
    this.kind = def.kind;
    this.opts = opts;
    this.place = null; // placement: [x,y,z] | [x,z] (on surface) | { on: 'anchor', x, z, dx, dy, dz, rot }
  }
  /** Place the part. Arrays: [x, z] sits on the set surface, [x, y, z] is absolute. Object: { on, dx, dy, dz, rot, x, z }. */
  at(place, extra = {}) {
    this.place = typeof place === 'string' ? { on: place, ...extra } : Array.isArray(place) ? { pos: place, ...extra } : place;
    return this;
  }
}

export function definePart(def) {
  if (!def.name || !def.kind || typeof def.build !== 'function') throw new Error('definePart needs name, kind, build');
  def.options = def.options || {};
  const factory = (opts = {}) => new PartSpec(def, { ...def.options, ...opts });
  factory.def = def;
  registry.set(def.name, factory);
  return factory;
}

export const getPart = (name) => {
  const f = registry.get(name);
  if (!f) throw new Error(`Unknown part "${name}". Known: ${[...registry.keys()].join(', ')}`);
  return f;
};
export const listParts = () => [...registry.values()].map((f) => f.def);
/** Accept a PartSpec, a factory, or 'name' / 'name:{"opt":1}'-free string; return a PartSpec. */
export function toSpec(x, opts) {
  if (x instanceof PartSpec) return x;
  if (typeof x === 'function' && x.def) return x(opts);
  if (typeof x === 'string') return getPart(x)(opts);
  throw new Error('Not a part: ' + x);
}
