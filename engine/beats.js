// engine/beats.js — beat templates: one story beat → actions + sfx for its time span [t0, t1]; cameras come from the
// director (engine/director.js + data/director/presets.json, ANOR's camera language) through c.cam(t0, t1, type, o).
// Built only from existing rig actions (parts/characters/_rig.js + _rig-actions.js), prop actions (wobble/roll/hop/carry/
// crack) and sfx (engine/audio/sfx.js). Adding a beat = adding one entry to BEATS (+ presets for its type).
//   BEATS[type] = { weight: default seconds (relative), needs?: 'movable', build(c, b, t0, t1) }
//   c (from compile.js): cap(id), pos(id), set(id,p,t), move(id,pts,t,dur), turn(id,yaw,t,hold), posAt/yawAt(id,t), r(id), h(id), L,
//                        rnd(), at(t,'id.verb',p), cam(t0,t1,type,o), sfx(t,name,p), carried/carrying/cracked, nearest(id,filter), others(id), titleCard()
//   b: { who, target, mood, action }
// Director rules kept here: reaction beats (discover, surprise, sad, talk) frame who AND target; a prop alone is only an
// insert ≤ 0.8 s; still characters turn to a camera-friendly heading first so their face can be seen.

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lenOf = (pts) => pts.reduce((s, p, i) => s + (i ? dist(p, pts[i - 1]) : 0), 0);
const isActor = (c, id) => c.cap(id) === 'actor';
const canRoll = (c, id) => c.cap(id) === 'mover' && !c.carried[id];
const canWobble = (c, id) => ['mover', 'rockable'].includes(c.cap(id)) && !c.carried[id];
const focusOf = (c, id) => (isActor(c, id) ? `${id}.face` : id);
const shake = (mood, base = 0) => (mood === 'tense' || mood === 'epic' ? base + 0.4 : base);
const DEG = Math.PI / 180;
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
export const MOVABLE = ['actor', 'mover'];

/** Move `id` along pts during [t, t + dur] with the verb its part has (walk for actors, roll for movers). */
function travel(c, id, pts, t, dur, verb = 'walk') {
  if (pts.length < 2 || lenOf(pts) < 1 || dur < 0.2) return false;
  if (isActor(c, id)) c.at(t, `${id}.${verb}`, { path: pts.slice(1), dur });
  else if (canRoll(c, id)) c.at(t, `${id}.roll`, { path: pts.slice(1), dur, ease: 'inOutSine' });
  else return false;
  c.move(id, pts, t, dur);
  return true;
}
// a point next to `id` on the side facing `from`, at contact distance
function beside(c, id, from, extra = 1) {
  const p = c.pos(id), d = Math.max(1e-6, dist(p, from)), k = (c.r(id) + 6 + extra) / d;
  return [p[0] + (from[0] - p[0]) * k, p[1] + (from[1] - p[1]) * k];
}
/** Still actor: if it faces away from the set's front, turn it to a 3/4 heading first (the face must read). */
function faceFront(c, id, t, hold) {
  if (!isActor(c, id)) return;
  const y = c.yawAt(id, t);
  // turn just before the cut (when there is time), so the new shot opens on the face
  if (Math.abs(wrap(y)) > 50 * DEG) { const ts = t >= 0.4 ? t - 0.35 : t; c.turn(id, Math.sign(wrap(y) || 1) * 30 * DEG, ts, hold + (t - ts)); }
}
/** Turn `id` toward `tg` (heading clamped to ±100° of the front so a camera can still see the face) and look at it. */
function faceToward(c, id, tg, t, dur) {
  if (!isActor(c, id) || !tg) return;
  const p = c.posAt(id, t), q = c.posAt(tg, t);
  let y = Math.atan2(q[0] - p[0], q[1] - p[1]);
  if (Math.abs(y) > 100 * DEG) y = Math.sign(y) * 100 * DEG;
  if (Math.abs(wrap(y - c.yawAt(id, t))) > 12 * DEG) c.turn(id, y, t, dur);
  c.at(t + 0.05, `${id}.look`, { at: tg, dur: Math.max(0.3, dur - 0.1) });
}
/** Reaction beats need who and target in one readable frame: if they are far apart, who first walks closer. → time it arrives */
function closeIn(c, who, tg, t, maxDur) {
  if (!tg || !isActor(c, who) || c.carried[tg] || maxDur < 0.6) return t;
  const p = c.pos(who), q = c.pos(tg), d = dist(p, q), want = c.h(who) * 2.2 + c.r(who) + c.r(tg);
  if (d <= want + 4) return t;
  const goal = c.L.clear([q[0] + (p[0] - q[0]) * (want / d), q[1] + (p[1] - q[1]) * (want / d)], c.r(who), tg);
  const path = c.L.route(p, goal, c.r(who), tg), dur = Math.min(maxDur, Math.max(0.5, lenOf(path) / 30));
  return travel(c, who, path, t, dur, 'run') ? t + dur : t;
}
/** While who walks closer (until ta), follow it; returns when the reaction framing should start. */
function walkShot(c, who, tg, t, ta) {
  if (ta - t < 0.45) return t;
  c.cam(t, ta, 'approach', { who, target: tg, only: ['follow-3q'], focus: focusOf(c, who) });
  return ta;
}
function moodFace(c, who, mood, t, dur) {
  if (!isActor(c, who)) return;
  if (mood === 'happy' || mood === 'playful') c.at(t, `${who}.smile`, { dur });
  else if (mood === 'sad') c.at(t, `${who}.face`, { eyes: 'normal', brow: 'worried', mouth: 'wobbly', dur });
  else if (mood === 'tense' || mood === 'epic') c.at(t, `${who}.face`, { eyes: 'determined', mouth: 'flat', dur });
}
const MOOD_ACTION = { happy: 'dance', playful: 'dance-spin', calm: 'dance-sway', sad: 'cry', tense: 'scared', epic: 'cheer' };

export const BEATS = {
  establish: {
    weight: 3,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0;
      faceFront(c, who, t0, D);
      const look = target || c.nearest(who);
      if (isActor(c, who)) {
        if (look) c.at(t0 + D * 0.25, `${who}.look`, { at: look, dur: D * 0.45 });
        if (D > 2.2) c.at(t0 + D * 0.62, `${who}.sniff`);
        moodFace(c, who, mood, t0 + D * 0.75, D * 0.25);
      } else if (canWobble(c, who)) c.at(t0 + D * 0.6, `${who}.wobble`, { dur: Math.min(0.8, D * 0.3), amount: 0.15 });
      c.sfx(t0 + D * 0.3, 'sparkle', { gain: 0.35, count: 6 });
      c.cam(t0, t1, 'establish', { who, focus: focusOf(c, who), shake: shake(mood) });
    },
  },
  discover: {
    weight: 2.2,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target || c.nearest(who);
      // an insert of a prop target: never longer than the director's insertMax (0.8 s)
      const ins = tg && !isActor(c, tg) && D >= 1.8 ? Math.min(0.8, D * 0.3) : 0, tm = t0 + ins;
      if (tg && canWobble(c, tg)) c.at(t0 + Math.min(0.12, D * 0.1), `${tg}.wobble`, { dur: Math.min(0.9, D * 0.35), amount: 0.2 });
      const ta = closeIn(c, who, tg, t0 + 0.05, D * 0.35);
      faceToward(c, who, tg, ta, t1 - ta);
      if (!tg) faceFront(c, who, t0, D);
      if (ins) c.cam(t0, tm, 'discover', { who, target: tg, only: ['insert'], focus: tg });
      const tw = walkShot(c, who, tg, tm, ta);
      c.cam(tw, t1, 'discover', { who, target: tg, skip: ['insert'], focus: focusOf(c, who), pullFrom: tg, grade: mood === 'sad' ? { exposure: 0.8 } : undefined });
      if (isActor(c, who)) {
        const tr = t0 + Math.max(ins, D * 0.3);
        if (mood === 'sad' || mood === 'calm') moodFace(c, who, mood, tr, t1 - tr);
        else { c.at(tr + 0.05, `${who}.gasp`); if (t1 - tr > 1.3) c.at(tr + 1.0, `${who}.smile`, { dur: t1 - tr - 1.0 }); }
      }
      c.sfx(t0 + D * 0.08, 'note', { note: 'E6', gain: 0.5 });
    },
  },
  surprise: {
    weight: 2,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target || c.nearest(who);
      const ta = closeIn(c, who, tg, t0 + 0.05, D * 0.3);
      faceToward(c, who, tg, ta, t1 - ta);
      if (!tg) faceFront(c, who, t0, D);
      if (tg && isActor(c, tg)) c.at(t0 + 0.1, `${tg}.jump`, { height: 3 });
      else if (tg && canRoll(c, tg)) c.at(t0 + 0.1, `${tg}.hop`, { to: c.pos(tg), apex: 4, dur: 0.4 });
      else if (tg && canWobble(c, tg)) c.at(t0 + 0.1, `${tg}.wobble`, { amount: 0.25 });
      if (isActor(c, who)) {
        c.at(ta + 0.15, `${who}.gasp`);
        if (t1 - ta > 1.6) c.at(ta + 0.9, `${who}.${mood === 'tense' || mood === 'sad' ? 'scared' : mood === 'happy' || mood === 'playful' ? 'laugh' : 'think'}`, { dur: Math.min(1.4, t1 - ta - 1.0) });
      }
      c.sfx(t0 + 0.25, 'note', { note: 'G6', gain: 0.5 });
      c.cam(walkShot(c, who, tg, t0, ta), t1, 'surprise', { who, target: tg, focus: focusOf(c, who), pullFrom: tg, shake: shake(mood) });
    },
  },
  chase: {
    weight: 4, needs: 'movable',
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : null;
      const n = Math.max(1, Math.min(4, Math.round(D / 1.6)));
      const runner = tg && (canRoll(c, tg) || isActor(c, tg)) && !c.carried[tg] ? tg : null;
      let ok = false;
      if (runner) {
        const lead = c.L.wander(c.pos(runner), n, c.rnd, c.r(runner));
        travel(c, runner, lead, t0, D * 0.92, isActor(c, runner) ? 'walk' : 'roll');
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
      // one tracking shot per ~1.6 s leg, cut where the direction changes; the camera leads on the face side
      const m = Math.max(1, Math.min(3, Math.floor(D / 1.6)));
      for (let i = 0; i < m; i++) {
        const a = t0 + (D * i) / m, b = t0 + (D * (i + 1)) / m;
        c.cam(a, b, 'chase', { who, runner, prefer: i === 0 && runner ? 'chase-low' : 'chase-front', focus: focusOf(c, who), shake: shake(mood) });
      }
      c.sfx(t0, 'whoosh', { dur: 0.6, gain: 0.45 });
    },
  },
  race: {
    weight: 4, needs: 'movable',
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who && !c.carried[target] ? target : null;
      const side = c.pos(who)[0] > 0 ? -1 : 1, goalX = side * 0.72 * c.L.hw;
      const lane = (id, dz) => c.L.route(c.pos(id), c.L.clear([goalX, Math.max(-0.3, Math.min(0.6, c.pos(id)[1] / c.L.hd + dz)) * c.L.hd], c.r(id), id), c.r(id));
      travel(c, who, lane(who, 0), t0 + 0.2, D * 0.62, 'sprint');
      if (tg) travel(c, tg, lane(tg, 0.25), t0 + 0.2, D * 0.74, isActor(c, tg) ? 'run' : 'roll');
      if (isActor(c, who)) {
        c.at(t0, `${who}.anticipate`, { dur: 0.2 });
        c.at(t0 + 0.2, `${who}.face`, { eyes: 'determined', mouth: 'grin', dur: D * 0.6 });
        c.at(t0 + D * 0.84, `${who}.cheer`, { dur: Math.min(1, D * 0.15), jumps: 1 });
      }
      const tm = t0 + D * 0.82;
      c.cam(t0, tm, 'race', { who, focus: focusOf(c, who), shake: shake(mood, 0.2) });
      faceFront(c, who, tm, t1 - tm);
      c.cam(tm, t1, 'celebrate', { who, target: tg || undefined, focus: focusOf(c, who) });
      c.sfx(t0 + 0.2, 'whoosh', { dur: 0.7, gain: 0.5 });
    },
  },
  approach: {
    weight: 3,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : c.nearest(who);
      const verb = mood === 'tense' ? 'sneak' : 'walk';
      let arrive = t0;
      if (tg) {
        const path = c.L.route(c.pos(who), beside(c, tg, c.pos(who)), c.r(who), tg);
        const dur = Math.min(D * 0.6, Math.max(0.6, lenOf(path) / (verb === 'sneak' ? 7 : 14)));
        if (travel(c, who, path, t0 + 0.1, dur, verb)) arrive = t0 + 0.1 + dur;
      } else travel(c, who, c.L.wander(c.pos(who), 1, c.rnd, c.r(who)), t0 + 0.1, D * 0.6, verb);
      if (isActor(c, who) && tg) {
        faceToward(c, who, tg, arrive, t1 - arrive);
        if (t1 - arrive > 1.2) c.at(arrive + 0.3, `${who}.sniff`);
        if (t1 - arrive > 2) c.at(arrive + 1.0, `${who}.${mood === 'sad' ? 'think' : 'smile'}`, { dur: t1 - arrive - 1.1 });
      }
      const cut = arrive + 0.3 >= t0 + 0.9 && t1 - (arrive + 0.3) >= 0.9 ? arrive + 0.3 : t1;
      c.cam(t0, cut, 'approach', { who, target: tg, focus: focusOf(c, who) });
      if (cut < t1) c.cam(cut, t1, 'discover', { who, target: tg, skip: ['insert'], focus: focusOf(c, who) });
    },
  },
  bonk: {
    weight: 2.4,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, ob = target && target !== who && !c.carried[target] ? target : c.nearest(who, (id) => c.isProp(id)) || c.nearest(who);
      const w0 = c.pos(who);
      let hit = t0 + D * 0.45;
      if (ob) {
        const spot = beside(c, ob, w0, -1);
        const path = c.L.route(w0, spot, c.r(who), ob);
        if (!travel(c, who, path, t0 + 0.05, Math.max(0.3, hit - t0 - 0.1))) hit = t0 + Math.min(0.4, D * 0.3);
        if (canWobble(c, ob)) c.at(hit, `${ob}.wobble`, { amount: 0.18, dir: 1 });
      }
      if (isActor(c, who)) {
        const dizzy = Math.max(0.5, Math.min(1.3, (t1 - hit) * 0.55));
        if (!ob) c.at(hit - 0.3, `${who}.skid`, { dur: 0.35 });
        c.at(hit, `${who}.bonk`, { knock: ob ? 4 : 0, dizzy });
        if (t1 - (hit + dizzy + 0.3) > 0.55) c.at(hit + dizzy + 0.3, `${who}.shake`);
        if (ob) { const p = c.pos(who), o = c.pos(ob), d = Math.max(1e-6, dist(p, o)); c.set(who, c.L.clear([p[0] + (p[0] - o[0]) / d * 4, p[1] + (p[1] - o[1]) / d * 4], c.r(who)), hit + 0.35); }
      } else c.sfx(hit, 'thud', { gain: 0.7 });
      c.cam(t0, t1, 'bonk', { who, target: ob || undefined, focus: focusOf(c, who), shake: shake(mood) });
    },
  },
  catch: {
    weight: 2.6, needs: 'movable',
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : c.nearest(who, (id) => c.cap(id) === 'mover') || c.nearest(who);
      let land = c.pos(who), tc = t0 + D * 0.5;
      if (tg && c.carried[tg] === who) { if (isActor(c, who)) c.at(t0 + 0.1, `${who}.lift`); }
      else if (tg && isActor(c, who)) {
        land = c.L.clear(beside(c, tg, c.pos(who), -2), c.r(who), tg);
        const far = dist(land, c.pos(who)) > 18;
        const dur = Math.min(far ? 1.25 : 0.5, D * 0.5);
        const t = t0 + D * 0.15;
        if (dist(land, c.pos(who)) > 1) { c.at(t, `${who}.${far ? 'leap' : 'hop'}`, far ? { to: land, height: 8, dur } : { to: land, height: 5, dur }); c.move(who, [c.pos(who), land], t, dur); }
        tc = t + dur;
        if (c.cap(tg) === 'mover' && !c.carried[tg]) {
          c.at(tc, `${who}.catch`); c.at(tc, `${tg}.carry`, { by: who });
          c.carried[tg] = who; c.carrying[who] = tg;
          if (t1 - tc > 1.0) c.at(tc + 0.05, `${who}.balance`, { dur: Math.min(0.8, t1 - tc - 0.2) });
        } else {
          c.at(tc, `${who}.hug`, { until: t1 - 0.05 });
          if (isActor(c, tg)) c.at(tc, `${tg}.smile`, { dur: t1 - tc });
        }
        if (t1 - tc > 0.8) faceFront(c, who, tc + 0.1, t1 - tc - 0.1);
      } else if (tg) {
        const goal = beside(c, tg, c.pos(who));
        travel(c, who, c.L.route(c.pos(who), goal, c.r(who), tg), t0 + 0.1, D * 0.6);
        if (isActor(c, tg)) c.at(t0 + D * 0.7, `${tg}.catch`);
        land = goal;
      }
      moodFace(c, who, mood, Math.min(t1 - 0.3, tc + 0.6), Math.max(0.2, t1 - tc - 0.6));
      c.sfx(Math.min(t1 - 0.1, tc + 0.05), 'sparkle', { gain: 0.45 });
      c.cam(t0, t1, 'catch', { who, target: tg && !c.carried[tg] ? tg : undefined, focus: who });
    },
  },
  celebrate: {
    weight: 3,
    build(c, { who, mood }, t0, t1) {
      const D = t1 - t0, w = c.pos(who);
      faceFront(c, who, t0, D);
      const crew = [who, ...c.others(who).filter((id) => isActor(c, id))].slice(0, 3);
      crew.forEach((id, k) => {
        const t = t0 + 0.1 + k * 0.2;
        if (isActor(c, id)) {
          if (id !== who) faceFront(c, id, t0, D);
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
      c.cam(t0, t1, 'celebrate', { who, target: crew[1], focus: focusOf(c, who) });
    },
  },
  sad: {
    weight: 3,
    build(c, { who, target }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : null;
      if (tg) faceToward(c, who, tg, t0, D * 0.5); else faceFront(c, who, t0, D);
      if (isActor(c, who)) {
        c.at(t0, `${who}.face`, { eyes: 'normal', brow: 'worried', mouth: 'wobbly', dur: D });
        if (D > 1.8) c.at(t0 + D * 0.35, `${who}.sit`, { dur: D * 0.6, hold: false });
      } else if (canWobble(c, who)) c.at(t0 + D * 0.3, `${who}.wobble`, { dur: Math.min(1, D * 0.4), amount: 0.08 });
      c.sfx(t0 + D * 0.2, 'note', { note: 'A4', gain: 0.4 });
      c.cam(t0, t1, 'sad', { who, target: tg || undefined, focus: focusOf(c, who) });
    },
  },
  perform: {
    weight: 3,
    build(c, { who, target, mood, action }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : null;
      if (tg) faceToward(c, who, tg, t0, Math.min(1, D * 0.3)); else faceFront(c, who, t0, D);
      const verb = action || MOOD_ACTION[mood] || 'dance';
      if (isActor(c, who)) c.at(t0 + Math.min(0.4, D * 0.15), `${who}.${verb}`, { dur: Math.max(0.6, D * 0.75), ...(tg && ['point', 'talk', 'look-at', 'throw'].includes(verb) ? { at: tg } : {}) });
      else if (canWobble(c, who)) c.at(t0 + 0.2, `${who}.wobble`, { dur: Math.min(1.2, D * 0.5), amount: 0.2 });
      c.cam(t0, t1, 'perform', { who, target: tg || undefined, focus: focusOf(c, who) });
    },
  },
  talk: {
    weight: 3,
    build(c, { who, target, mood }, t0, t1) {
      const D = t1 - t0, tg = target && target !== who ? target : c.others(who)[0] || c.nearest(who);
      const ta = closeIn(c, who, tg, t0 + 0.05, D * 0.3);
      faceToward(c, who, tg, ta, t1 - ta);
      if (tg && isActor(c, tg)) faceToward(c, tg, who, t0 + 0.1, D);
      if (isActor(c, who)) c.at(t0 + 0.3, `${who}.talk`, { dur: D * 0.42, ...(mood === 'happy' || mood === 'playful' ? { eyes: 'happy' } : {}) });
      if (tg && isActor(c, tg)) { c.at(t0 + D * 0.5, `${tg}.nod`); if (D > 2.6) c.at(t0 + D * 0.62, `${tg}.talk`, { dur: D * 0.3 }); }
      else if (isActor(c, who) && D > 2.4) c.at(t0 + D * 0.6, `${who}.think`, { dur: D * 0.35 });
      c.cam(walkShot(c, who, tg, t0, ta), t1, 'talk', { who, target: tg || undefined, focus: focusOf(c, who) });
    },
  },
  title: {
    weight: 2.6,
    build(c, { who }, t0, t1) {
      const D = t1 - t0;
      faceFront(c, who, t0, D);
      if (isActor(c, who)) c.at(t0 + Math.min(0.3, D * 0.1), `${who}.wave`, { dur: Math.min(1.4, D * 0.5) });
      const tc = t0 + Math.min(0.6, D * 0.2);
      c.titleCard(tc);
      c.sfx(tc, 'note', { note: 'D6', gain: 0.55 });
      c.sfx(tc, 'sparkle', { gain: 0.5 });
      c.cam(t0, t1, 'title', { who, focus: who });
    },
  },
};

export const BEAT_TYPES = Object.keys(BEATS);
