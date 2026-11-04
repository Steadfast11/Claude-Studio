// engine/anim/easing.js — easing curves u∈[0,1] → [0,1] (some overshoot). ease('outBack')(u) or E.outBack(u).
const c1 = 1.70158, c3 = c1 + 1, c4 = (2 * Math.PI) / 3;
export const E = {
  linear: (u) => u,
  inQuad: (u) => u * u, outQuad: (u) => 1 - (1 - u) * (1 - u), inOutQuad: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
  inCubic: (u) => u ** 3, outCubic: (u) => 1 - (1 - u) ** 3, inOutCubic: (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
  inQuart: (u) => u ** 4, outQuart: (u) => 1 - (1 - u) ** 4, inOutQuart: (u) => (u < 0.5 ? 8 * u ** 4 : 1 - (-2 * u + 2) ** 4 / 2),
  inSine: (u) => 1 - Math.cos((u * Math.PI) / 2), outSine: (u) => Math.sin((u * Math.PI) / 2), inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  inExpo: (u) => (u === 0 ? 0 : 2 ** (10 * u - 10)), outExpo: (u) => (u === 1 ? 1 : 1 - 2 ** (-10 * u)),
  inOutExpo: (u) => (u === 0 ? 0 : u === 1 ? 1 : u < 0.5 ? 2 ** (20 * u - 10) / 2 : (2 - 2 ** (-20 * u + 10)) / 2),
  inBack: (u) => c3 * u ** 3 - c1 * u * u, outBack: (u) => 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2,
  inOutBack: (u) => (u < 0.5 ? ((2 * u) ** 2 * ((c1 * 1.525 + 1) * 2 * u - c1 * 1.525)) / 2 : ((2 * u - 2) ** 2 * ((c1 * 1.525 + 1) * (u * 2 - 2) + c1 * 1.525) + 2) / 2),
  outElastic: (u) => (u === 0 ? 0 : u === 1 ? 1 : 2 ** (-10 * u) * Math.sin((u * 10 - 0.75) * c4) + 1),
  outBounce: (u) => {
    const n = 7.5625, d = 2.75;
    if (u < 1 / d) return n * u * u;
    if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
    if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
    return n * (u -= 2.625 / d) * u + 0.984375;
  },
  /** Smooth "camera with weight": slow start, long settle. */
  weighty: (u) => { const a = u * u * (3 - 2 * u); return a * a * (3 - 2 * a); },
};
export const ease = (name = 'linear') => (typeof name === 'function' ? name : E[name] || E.linear);
