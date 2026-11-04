// engine/beats.js — beat templates: one story beat → camera shot(s) + actions + sfx for its time span [t0, t1].
// Built only from existing rig actions (parts/characters/_rig.js), prop actions (wobble/roll/hop/carry/crack),
// camera rigs (engine/camera/rigs.js) and sfx (engine/audio/sfx.js). Adding a beat = adding one entry to BEATS.
//   BEATS[type] = { weight: default seconds (relative), build(c, b, t0, t1) }
//   c (from compile.js): cap(id), pos(id), set(id,p), r(id), L (layout), rnd(), at(t, 'id.verb', p), shot(t0, t1, o),
//                        sfx(t, name, p), carried / carrying / cracked maps, nearest(id, filter), others(id), title, titleCard()
//   b: { who, target, mood }

const V3 = (p, y) => [p[0], y, p[1]];
const clampCam = (pos) => [pos[0], Math.max(2, Math.min(60, pos[1])), Math.min(115, pos[2])];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lenOf = (pts) => pts.reduce((s, p, i) => s + (i ? dist(p, pts[i - 1]) : 0), 0);
const isActor = (c, id) => c.cap(id) === 'actor';
const canRoll = (c, id) => c.cap(id) === 'mover' && !c.carried[id];
const canWobble = (c, id) => ['mover', 'rockable'].includes(c.cap(id)) && !c.carried[id];
const focusOf = (c, id) => (isActor(c, id) ? `${id}.face` : id);
const gradeOf = (mood) => (mood === 'sad' ? { exposure: 0.8 } : mood === 'tense' ? { exposure: 0.9 } : undefined);
const shake = (mood, base = 0) => (mood === 'tense' || mood === 'epic' ? base + 0.4 : base);

/** Move `id` along pts during [t, t + dur] with the verb its part has (walk for actors, roll for movers). */
function travel(c, id, pts, t, dur) {
  if (pts.length < 2 || lenOf(pts) < 1 || dur < 0.2) return false;
  if (isActor(c, id)) c.at(t, `${id}.walk`, { path: pts.slice(1), dur });
  else if (canRoll(c, id)) c.at(t, `${id}.roll`, { path: pts.slice(1), dur, ease: 'inOutSine' });
  else return false;
  c.set(id, pts[pts.length - 1]);
  return true;
}
// a point next to `id` on the side facing `from`, at contact distance
function beside(c, id, from, extra = 1) {
  const p = c.pos(id), d = Math.max(1e-6, dist(p, from)), k = (c.r(id) + 6 + extra) / d;
  return [p[0] + (from[0] - p[0]) * k, p[1] + (from[1] - p[1]) * k];
}
function moodFace(c, who, mood, t, dur) {
  if (!isActor(c, who)) return;
  if (mood === 'happy' || mood === 'playful') c.at(t, `${who}.smile`, { dur });
  else if (mood === 'sad') c.at(t, `${who}.face`, { eyes: 'normal', brow: 'worried', mouth: 'wobbly', dur });
  else if (mood === 'tense' || mood === 'epic') c.at(t, `${who}.face`, { eyes: 'determined', mouth: 'flat', dur });
}

export const BEATS = {
  establish: {
    weight: 3,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, w = c.pos(who), { hd } = c.L;
      c.shot(t0, t1, { rig: 'crane', ease: 'inOutCubic', lens: 34, fstop: 5.6, focus: who, handheld: shake(mood),
        from: { pos: clampCam([0, 52, hd * 2 + 40]), look: [0, 2, -hd * 0.25] },
        to: { pos: clampCam([w[0] + 8, 15, w[1] + 40]), look: V3(w, 5) } });
      const look = target || c.nearest(who);
      if (isActor(c, who)) {
        if (look) c.at(t0 + D * 0.25, `${who}.look`, { at: look, dur: D * 0.45 });
        if (D > 2.2) c.at(t0 + D * 0.62, `${who}.sniff`);
        moodFace(c, who, mood, t0 + D * 0.75, D * 0.25);
      } else if (canWobble(c, who)) c.at(t0 + D * 0.6, `${who}.wobble`, { dur: Math.min(0.8, D * 0.3), amount: 0.15 });
      c.sfx(t0 + D * 0.3, 'sparkle', { gain: 0.35, count: 6 });
    },
  },
  discover: {
    weight: 2.2,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target || c.nearest(who), w = c.pos(who), tm = t0 + D * 0.5;
      if (tg) {
        const p = c.pos(tg);
        c.shot(t0, tm, { rig: 'static', at: { pos: clampCam([p[0] + 6, 11, p[1] + 28]), look: V3(p, 4) }, lens: 50, focus: tg, fstop: 5.6 });
        if (canWobble(c, tg)) c.at(t0 + D * 0.12, `${tg}.wobble`, { dur: Math.min(0.9, D * 0.35), amount: 0.2 });
        if (isActor(c, who)) c.at(t0, `${who}.look`, { at: tg, dur: D, turn: true });
      }
      c.shot(tg ? tm : t0, t1, { rig: 'static', at: { pos: clampCam([w[0] - 4, 9, w[1] + 24]), look: V3(w, 6) }, lens: 40, focus: focusOf(c, who), fstop: 4, grade: gradeOf(mood) });
      if (isActor(c, who)) {
        if (mood === 'sad' || mood === 'calm') moodFace(c, who, mood, tm, t1 - tm);
        else { c.at(tm + 0.05, `${who}.gasp`); if (t1 - tm > 1.3) c.at(tm + 1.0, `${who}.smile`, { dur: t1 - tm - 1.0 }); }
      }
      c.sfx(t0 + D * 0.08, 'note', { note: 'E6', gain: 0.5 });
    },
  },
  chase: {
    weight: 4,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : null;
      const n = Math.max(1, Math.min(4, Math.round(D / 1.6)));
      const runner = tg && (canRoll(c, tg) || isActor(c, tg)) && !c.carried[tg] ? tg : null;
      let ok = false;
      if (runner) {
        const lead = c.L.wander(c.pos(runner), n, c.rnd, c.r(runner));
        travel(c, runner, lead, t0, D * 0.92);
        const end = lead[lead.length - 1], prev = lead[Math.max(0, lead.length - 2)];
        const back = dist(end, prev) > 1e-3 ? [end[0] + (prev[0] - end[0]) / dist(end, prev) * 13, end[1] + (prev[1] - end[1]) / dist(end, prev) * 13] : [end[0] - 13, end[1]];
        const path = c.L.route(c.pos(who), lead[0], c.r(who)).concat(lead.slice(1, -1), [c.L.clear(back, c.r(who), runner)]);
        ok = travel(c, who, path, t0 + Math.min(0.35, D * 0.1), D * 0.85);
      } else {
        const goal = tg ? beside(c, tg, c.pos(who)) : null;
        const path = c.L.wander(c.pos(who), n, c.rnd, c.r(who));
        const full = goal ? path.concat(c.L.route(path[path.length - 1], goal, c.r(who), tg).slice(1)) : path;
        ok = travel(c, who, full, t0 + 0.1, D * 0.88);
      }
      if (!ok && canWobble(c, who)) c.at(t0, `${who}.wobble`, { dur: Math.min(1.2, D), amount: 0.25 });
      if (isActor(c, who)) c.at(t0 + 0.05, `${who}.face`, { eyes: 'determined', mouth: 'flat', dur: D * 0.9 });
      const tm = t0 + D * 0.5;
      c.shot(t0, tm, { rig: 'track', target: runner || who, offset: [10, 5, 32], lag: 0.3, lens: 32, focus: focusOf(c, who), fstop: 4, handheld: shake(mood, 0.4) });
      c.shot(tm, t1, { rig: 'track', target: who, offset: [-20, 7, 28], lag: 0.25, lens: 35, focus: focusOf(c, who), fstop: 5.6, handheld: shake(mood, 0.5) });
      c.sfx(t0, 'whoosh', { dur: 0.6, gain: 0.45 });
    },
  },
  bonk: {
    weight: 2.4,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, ob = target && target !== who && !c.carried[target] ? target : c.nearest(who, (id) => c.isProp(id)) || c.nearest(who);
      const w0 = c.pos(who);
      let hit = t0 + D * 0.45, spot = w0;
      if (ob) {
        spot = beside(c, ob, w0, -1);
        const path = c.L.route(w0, spot, c.r(who), ob);
        if (!travel(c, who, path, t0 + 0.05, Math.max(0.3, hit - t0 - 0.1))) hit = t0 + Math.min(0.4, D * 0.3);
        if (canWobble(c, ob)) c.at(hit, `${ob}.wobble`, { amount: 0.18, dir: 1 });
      }
      if (isActor(c, who)) {
        const dizzy = Math.max(0.5, Math.min(1.3, (t1 - hit) * 0.55));
        if (!ob) c.at(hit - 0.3, `${who}.skid`, { dur: 0.35 });
        c.at(hit, `${who}.bonk`, { knock: ob ? 4 : 0, dizzy });
        if (t1 - (hit + dizzy + 0.3) > 0.55) c.at(hit + dizzy + 0.3, `${who}.shake`);
        if (ob) { const p = c.pos(who), o = c.pos(ob), d = Math.max(1e-6, dist(p, o)); c.set(who, c.L.clear([p[0] + (p[0] - o[0]) / d * 4, p[1] + (p[1] - o[1]) / d * 4], c.r(who))); }
      } else c.sfx(hit, 'thud', { gain: 0.7 });
      const s = ob ? c.pos(ob) : spot;
      const mid = [(s[0] + spot[0]) / 2, (s[1] + spot[1]) / 2];
      c.shot(t0, t1, { rig: 'static', at: { pos: clampCam([mid[0] + 4, 9, mid[1] + 50]), look: V3(mid, 5) }, lens: 45, focus: who, fstop: 5.6, handheld: shake(mood) });
    },
  },
  catch: {
    weight: 2.6,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : c.nearest(who, (id) => c.cap(id) === 'mover') || c.nearest(who);
      let land = c.pos(who), tc = t0 + D * 0.5;
      if (tg && c.carried[tg] === who) { if (isActor(c, who)) c.at(t0 + 0.1, `${who}.lift`); }
      else if (tg && isActor(c, who)) {
        land = c.L.clear(beside(c, tg, c.pos(who), -2), c.r(who), tg);
        const far = dist(land, c.pos(who)) > 18;
        const dur = Math.min(far ? 1.25 : 0.5, D * 0.5);
        const t = t0 + D * 0.15;
        if (dist(land, c.pos(who)) > 1) c.at(t, `${who}.${far ? 'leap' : 'hop'}`, far ? { to: land, height: 8, dur } : { to: land, height: 5, dur });
        c.set(who, land);
        tc = t + dur;
        if (c.cap(tg) === 'mover' && !c.carried[tg]) {
          c.at(tc, `${who}.catch`); c.at(tc, `${tg}.carry`, { by: who });
          c.carried[tg] = who; c.carrying[who] = tg;
          if (t1 - tc > 1.0) c.at(tc + 0.05, `${who}.balance`, { dur: Math.min(0.8, t1 - tc - 0.2) });
        } else {
          c.at(tc, `${who}.hug`, { until: t1 - 0.05 });
          if (isActor(c, tg)) c.at(tc, `${tg}.smile`, { dur: t1 - tc });
        }
      } else if (tg) {
        const goal = beside(c, tg, c.pos(who));
        travel(c, who, c.L.route(c.pos(who), goal, c.r(who), tg), t0 + 0.1, D * 0.6);
        if (isActor(c, tg)) c.at(t0 + D * 0.7, `${tg}.catch`);
        land = goal;
      }
      moodFace(c, who, mood, Math.min(t1 - 0.3, tc + 0.6), Math.max(0.2, t1 - tc - 0.6));
      c.sfx(Math.min(t1 - 0.1, tc + 0.05), 'sparkle', { gain: 0.45 });
      c.shot(t0, t1, { rig: 'push', ease: 'inOutCubic', lens: 40, focus: who, fstop: 4,
        from: { pos: clampCam([land[0] - 10, 26, land[1] + 78]), look: V3(land, 4) },
        to: { pos: clampCam([land[0] + 6, 9, land[1] + 34]), look: V3(land, 6) } });
    },
  },
  celebrate: {
    weight: 3,
    build(c, { who, mood }, t0, t1) {
      const D = t1 - t0, w = c.pos(who);
      const crew = [who, ...c.others(who).filter((id) => isActor(c, id))].slice(0, 3);
      crew.forEach((id, k) => {
        const t = t0 + 0.1 + k * 0.2;
        if (isActor(c, id)) {
          const held = c.carrying[id];
          if (held) {
            c.at(t, `${id}.lift`);
            if (!c.cracked[held] && D > 1.6) { c.at(t + 0.55, `${held}.crack`, { count: 60 }); c.cracked[held] = true; }
            c.at(t + Math.min(0.9, D * 0.4), `${id}.laugh`, { dur: Math.min(0.8, D * 0.3) });
          } else {
            c.at(t, `${id}.cheer`, { dur: Math.min(1.2, D * 0.45), jumps: 2 });
            if (D > 2.2) c.at(t + D * 0.5, `${id}.laugh`, { dur: Math.min(0.9, D * 0.35) });
          }
        } else if (c.cap(id) === 'mover' && !c.carried[id]) c.at(t, `${id}.hop`, { to: c.pos(id), apex: 5, dur: 0.45 });
      });
      if (!isActor(c, who) && canRoll(c, who)) { c.at(t0 + 0.1, `${who}.hop`, { to: w, apex: 6, dur: 0.5 }); if (D > 1.4) c.at(t0 + 0.8, `${who}.hop`, { to: w, apex: 4, dur: 0.4 }); }
      if (isActor(c, who) && D > 3 && !c.carrying[who]) c.at(t0 + D * 0.8, `${who}.blush`, { dur: D * 0.2 });
      c.sfx(t0 + D * 0.15, 'sparkle', { gain: 0.6 });
      c.sfx(t0 + D * 0.15, 'note', { note: mood === 'sad' ? 'A5' : 'D6', gain: 0.5 });
      c.shot(t0, t1, { rig: 'static', at: { pos: clampCam([w[0] + 4, 4, w[1] + 30]), look: V3(w, 8) }, lens: 30, focus: focusOf(c, who), fstop: 4 });
    },
  },
  sad: {
    weight: 3,
    build(c, { who, target }, t0, t1) {
      const D = t1 - t0, w = c.pos(who);
      if (isActor(c, who)) {
        c.at(t0, `${who}.face`, { eyes: 'normal', brow: 'worried', mouth: 'wobbly', dur: D });
        if (target && target !== who) c.at(t0 + 0.1, `${who}.look`, { at: target, dur: D * 0.5 });
        if (D > 1.8) c.at(t0 + D * 0.35, `${who}.sit`, { dur: D * 0.6, hold: false });
      } else if (canWobble(c, who)) c.at(t0 + D * 0.3, `${who}.wobble`, { dur: Math.min(1, D * 0.4), amount: 0.08 });
      c.sfx(t0 + D * 0.2, 'note', { note: 'A4', gain: 0.4 });
      c.shot(t0, t1, { rig: 'static', at: { pos: clampCam([w[0], 34, w[1] + 38]), look: V3(w, 3) }, lens: 50, focus: who, fstop: 5.6, grade: { exposure: 0.8 } });
    },
  },
  title: {
    weight: 2.6,
    build(c, { who }, t0, t1) {
      const D = t1 - t0, w = c.pos(who), { hd } = c.L;
      c.shot(t0, t1, { rig: 'pull', ease: 'inOutSine', lens: 40, focus: who, fstop: 5.6,
        from: { pos: clampCam([w[0] + 6, 12, w[1] + 40]), look: V3(w, 5) },
        to: { pos: clampCam([w[0] * 0.3, 48, hd * 2.2 + 40]), look: [w[0] * 0.3, 4, 0] } });
      if (isActor(c, who)) c.at(t0 + Math.min(0.3, D * 0.1), `${who}.wave`, { dur: Math.min(1.4, D * 0.5) });
      const tc = t0 + Math.min(0.6, D * 0.2);
      c.titleCard(tc);
      c.sfx(tc, 'note', { note: 'D6', gain: 0.55 });
      c.sfx(tc, 'sparkle', { gain: 0.5 });
    },
  },
};

export const BEAT_TYPES = Object.keys(BEATS);
