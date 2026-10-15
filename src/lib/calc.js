import { MUSCLES } from '../data/exercises.js';
import { weightJump, repsCapacity, beatTop, effLoad } from './progression.js';
import { isAssisted } from './exkind.js';
import { DAY, startOfDay, startOfWeek, startOfMonth, addDays, addMonths } from './util.js';

// Estimated one-rep max. Brzycki: w * 36 / (37 - r). Epley: w * (1 + r / 30).
// Estimates get rougher as reps rise, so only sets of 12 reps or fewer are used.
export const E1RM_MAX_REPS = 12;
export function e1rm(kg, reps, formula = 'brzycki') {
  if (!kg || !reps || reps < 1 || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return kg;
  return formula === 'epley' ? kg * (1 + reps / 30) : (kg * 36) / (37 - reps);
}

export const isWork = (s) => s.done && s.type !== 'w';

// Reps used for estimated 1RM: when reps in reserve were logged, reps + reps left (capped at 5),
// since rep-max formulas assume the set went to failure.
// (only for sets that themselves are within the estimate's range, and never past it)
export const effortReps = (s) => (s.rir != null && s.r && s.r <= E1RM_MAX_REPS ? Math.min(E1RM_MAX_REPS, s.r + Math.min(5, Math.max(0, s.rir))) : s.r);

// Effort labels: stored as reps in reserve; RPE on the RIR-based scale is 10 - RIR
export function effortLabel(rir, scale, short = false) {
  if (rir == null) return '';
  if (scale === 'rpe') return short ? `@${10 - rir}` : `RPE ${10 - rir}`;
  if (short) return rir >= 5 ? '5+ left' : `${rir} left`;
  return rir >= 5 ? '5+ reps left' : `${rir} rep${rir === 1 ? '' : 's'} left`;
}

export function exerciseOf(exercises, exId) {
  return exercises[exId] || { id: exId, name: exId, kind: 'weight', primary: [], secondary: [], equipment: 'other', missing: true };
}

// Stats for one exercise entry (or several entries of the same exercise merged)
export function entryStats(sets, ex, formula) {
  const st = { sets: 0, reps: 0, vol: 0, topW: 0, e1rm: 0, maxReps: 0, maxTime: 0, bestSet: null, bestSetVol: 0 };
  let bestScore = -1;
  for (const s of sets) {
    if (!isWork(s)) continue;
    st.sets++;
    const w = s.w || 0, r = s.r || 0;
    if (ex.kind === 'time') {
      st.maxTime = Math.max(st.maxTime, s.t || 0);
      if ((s.t || 0) > bestScore) { bestScore = s.t || 0; st.bestSet = s; }
      st.topW = Math.max(st.topW, w);
      continue;
    }
    st.reps += r;
    st.vol += w * r;
    st.maxReps = Math.max(st.maxReps, r);
    st.topW = Math.max(st.topW, w);
    st.bestSetVol = Math.max(st.bestSetVol, w * r);
    const est = ex.kind === 'weight' ? e1rm(w, effortReps(s), formula) || 0 : 0;
    st.e1rm = Math.max(st.e1rm, est);
    const score = ex.kind === 'weight' ? w * 1000 + r : r * 1000 + w;
    if (score > bestScore) { bestScore = score; st.bestSet = s; }
  }
  return st;
}

function groupEntries(workout) {
  const map = new Map();
  for (const e of workout.exercises) {
    if (!map.has(e.exId)) map.set(e.exId, []);
    map.get(e.exId).push(...e.sets);
  }
  return map;
}

export function workoutSummary(w, exercises) {
  let sets = 0, reps = 0, vol = 0;
  for (const e of w.exercises) {
    const ex = exerciseOf(exercises, e.exId);
    for (const s of e.sets) {
      if (!isWork(s)) continue;
      sets++;
      if (ex.kind !== 'time') { reps += s.r || 0; vol += (s.w || 0) * (s.r || 0); }
    }
  }
  return { sets, reps, vol, duration: w.end && w.start ? w.end - w.start : null };
}

// Personal records: for every workout, which exercises beat every earlier session.
// The first time an exercise is logged sets the baseline and is not a PR.
export function buildPRIndex(workouts, exercises, formula) {
  const sorted = [...workouts].sort((a, b) => a.start - b.start);
  const best = {};
  const index = {};
  for (const w of sorted) {
    const prs = {};
    let count = 0;
    for (const [exId, sets] of groupEntries(w)) {
      const ex = exerciseOf(exercises, exId);
      const st = entryStats(sets, ex, formula);
      if (!st.sets) continue;
      const b = best[exId];
      if (b) {
        const labels = [];
        const eps = 1e-6;
        if (ex.kind === 'weight') {
          if (st.topW > b.topW + eps) labels.push('Top weight');
          if (st.e1rm > b.e1rm + eps) labels.push('Est. 1RM');
          if (st.vol > b.vol + eps) labels.push('Volume');
        } else if (ex.kind === 'reps') {
          if (st.maxReps > b.maxReps) labels.push('Most reps');
          if (st.topW > 0 && st.topW > b.topW + eps) labels.push('Top weight');
        } else if (st.maxTime > b.maxTime) labels.push('Longest hold');
        if (labels.length) { prs[exId] = labels; count += labels.length; }
        b.topW = Math.max(b.topW, st.topW); b.e1rm = Math.max(b.e1rm, st.e1rm); b.vol = Math.max(b.vol, st.vol);
        b.maxReps = Math.max(b.maxReps, st.maxReps); b.maxTime = Math.max(b.maxTime, st.maxTime);
      } else {
        best[exId] = { topW: st.topW, e1rm: st.e1rm, vol: st.vol, maxReps: st.maxReps, maxTime: st.maxTime };
      }
    }
    index[w.id] = { prs, count };
  }
  return { index, best };
}

// Best-ever numbers per exercise (used for live PR flags during a workout)
export function bestByExercise(workouts, exercises, formula) {
  return buildPRIndex(workouts, exercises, formula).best;
}

// Every session of one exercise, oldest first
export function exerciseHistory(workouts, exId, ex, formula) {
  const out = [];
  for (const w of workouts) {
    const sets = [];
    for (const e of w.exercises) if (e.exId === exId) sets.push(...e.sets);
    if (!sets.length) continue;
    const st = entryStats(sets, ex, formula);
    if (!st.sets) continue;
    const note = [...new Set(w.exercises.filter((e) => e.exId === exId && e.note && e.note.trim()).map((e) => e.note.trim()))].join(' / ');
    out.push({ ...st, t: w.start, workoutId: w.id, workoutName: w.name, setList: sets.filter(isWork), note });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Notes you wrote on an exercise in past sessions, newest first
export function pastNotes(workouts, exId, beforeT = Infinity) {
  const out = [];
  for (const w of workouts) {
    if (w.start >= beforeT) continue;
    const notes = w.exercises.filter((e) => e.exId === exId && e.note && e.note.trim()).map((e) => e.note.trim());
    if (notes.length) out.push({ t: w.start, workoutId: w.id, workoutName: w.name, note: [...new Set(notes)].join(' / ') });
  }
  return out.sort((a, b) => b.t - a.t);
}

// The two most recent sessions of an exercise, newest first
export function lastSessionsFor(workouts, exId, n = 2) {
  const ws = workouts.filter((w) => !w.deload && w.exercises.some((e) => e.exId === exId && e.sets.some(isWork))).sort((a, b) => b.start - a.start).slice(0, n);
  return ws.map((w) => ({ t: w.start, sets: w.exercises.filter((e) => e.exId === exId).flatMap((e) => e.sets.filter(isWork)) }));
}

// Most recent completed sets of an exercise (for the "Previous" column)
// Deload-week sessions are skipped so targets build on normal training
export function lastSetsFor(workouts, exId, beforeT = Infinity) {
  let bestW = null;
  for (const w of workouts) {
    if (w.start >= beforeT || w.deload) continue;
    if (!w.exercises.some((e) => e.exId === exId && e.sets.some(isWork))) continue;
    if (!bestW || w.start > bestW.start) bestW = w;
  }
  if (!bestW) return null;
  const sets = [];
  for (const e of bestW.exercises) if (e.exId === exId) sets.push(...e.sets.filter(isWork));
  return { t: bestW.start, sets };
}

// Targets for today's session from the last time this exercise was done.
// With a rep range (double progression): once every top-weight set reached the top of the
// range, add one increment and drop back to the bottom of the range; otherwise keep the
// weight and add a rep to each set, capped at the top of the range.
// Without a range: keep the weight and beat each set by a rep.
export { weightJump } from './progression.js';

// Session targets. opts.deload: deload week. opts.jumpMode: 'auto' (evidence-based, see
// progression.js) | 'fixed' (classic double progression). opts.prev2: the session before last.
// opts.effort: 'rir' | 'rpe' when effort rating is on, so targets also suggest an effort.
export function sessionTargets(prev, ex, range, incKg, opts = {}) {
  const work = prev ? prev.sets.filter((s) => s.type !== 'w') : [];
  if (!work.length) return null;
  const min = range && range.min ? range.min : null;
  const max = range && range.max ? range.max : null;
  const evidence = opts.jumpMode !== 'fixed';
  // deload week: about half the sets, same weight, 3 fewer reps than last time (holds keep their time)
  if (opts.deload) {
    const half = work.slice(0, Math.max(1, Math.ceil(work.length / 2)));
    const hold = ex.kind === 'time';
    return {
      sets: half.map((s) => ({ w: s.w ?? null, r: hold ? undefined : Math.max(1, (s.r || 0) - 3), t: hold ? s.t : undefined })),
      kind: 'deload', note: hold ? 'Deload: half the sets, same time as last time' : 'Deload: half the sets, same weight, 3 fewer reps than last time',
    };
  }
  // close to failure without going all the way (about 0–3 reps left); suggested when effort rating is on
  const aim = opts.effort === 'rpe' ? 'RPE 7–9' : opts.effort ? '1–3 reps left' : null;
  if (ex.kind === 'time') {
    return { sets: work.map((s) => ({ w: s.w ?? null, t: (s.t || 0) + 5 })), kind: 'more', note: '5 seconds longer than last time' };
  }
  // "top weight" = the heaviest load; on assisted machines that's the least assistance
  const assisted = ex.kind === 'weight' && isAssisted(ex);
  const topEff = Math.max(...work.map((s) => effLoad(s, assisted)));
  const top = Math.abs(topEff);
  const isTop = (s) => effLoad(s, assisted) === topEff;
  const topSets = work.filter(isTop);
  // evidence mode counts reps left (RIR) as reps you could have done; fixed mode uses reps done
  const atTop = max && topSets.every((s) => repsCapacity(s) >= max);
  const pastTop = max && topSets.every((s) => repsCapacity(s) >= max + 1);
  const pastTopBefore = max && opts.prev2 && beatTop(opts.prev2, max, topEff, assisted);
  const atTopDone = max && topSets.every((s) => (s.r || 0) >= max);
  const rated = (sets) => (sets || []).some((s) => s.type !== 'w' && (s.rir || 0) > 0);
  const counting = rated(topSets) || rated(opts.prev2) || !!opts.effort;
  const withLeft = counting ? ', counting reps left' : '';
  const bump = (r) => (max ? Math.min(max, r + 1) : r + 1);
  const moreReps = () => {
    const sets = work.map((s) => ({ w: s.w ?? null, r: Math.max(min || 0, bump(s.r || 0)) }));
    const same = sets.every((t, i) => t.r === work[i].r);
    const raised = sets.some((t, i) => t.r > (work[i].r || 0) + 1);
    return { sets, kind: same ? 'match' : 'more', aim, note: same ? 'Match last time' : raised ? `At least ${min} reps per set (the bottom of your range)` : 'One more rep per set than last time' };
  };
  // one past the top on top-weight sets; lighter back-off sets just add a rep
  const onePast = (pastAlready, what) => ({
    sets: work.map((s) => ({ w: s.w ?? null, r: isTop(s) ? max + 1 : bump(s.r || 0) })), kind: 'more', aim,
    note: (pastAlready ? `Go past ${max} on ${what} again to earn the ${ex.kind === 'reps' ? 'next step' : 'jump'} (two sessions in a row)` : `Go one past ${max} on ${what}`) + withLeft,
  });

  if (ex.kind === 'reps') {
    if (evidence ? pastTop && pastTopBefore : atTopDone) {
      return { sets: work.map((s) => ({ w: s.w ?? null, r: s.r })), kind: 'up', aim, note: `${evidence ? `Past the top of the range two sessions in a row${withLeft}` : 'At the top of the range'}: add weight or a harder variation, then build back up from ${min || max - 4}` };
    }
    if (evidence && atTop) return onePast(pastTop, 'every set');
    return moreReps();
  }

  const jump = assisted ? incKg : weightJump(top, ex, incKg, evidence ? 'auto' : 'fixed');
  const jumpPct = top ? Math.round((jump / top) * 1000) / 10 : 0;
  const jumpNote = evidence && top && !assisted ? (jumpPct > 10 ? ` (+${jumpPct}%, your smallest step)` : ` (+${jumpPct}%)`) : '';
  const heavier = (why) => ({
    sets: work.map((s) => ({ w: isTop(s) ? (assisted ? Math.max(0, top - jump) : top + jump) : s.w, r: min || Math.max(1, max - 4) })),
    kind: 'up', aim, jump, note: `${assisted ? 'Less assistance' : `Heavier${jumpNote}`}: ${why}`,
  });
  if (top > 0 && max) {
    if (evidence) {
      if (pastTop && pastTopBefore) return heavier(`past ${max} on every top-weight set two sessions in a row${withLeft}`);
      if (atTop) return onePast(pastTop, 'every top-weight set');
    } else if (atTopDone) {
      return heavier(`you hit ${max} reps on every top-weight set last time`);
    }
  }
  const t = moreReps();
  if (!max && evidence) t.note += '. Set a rep range to get weight targets';
  return t;
}

// Heaviest weight lifted for exactly N reps (only rep counts you have done)
export function repRecords(history) {
  const best = {};
  for (const h of history) for (const s of h.setList) {
    const n = s.r || 0;
    if (!n || !s.w || n > 30) continue;
    if (!best[n] || s.w > best[n].w) best[n] = { n, w: s.w, t: h.t };
  }
  return Object.values(best).sort((a, b) => a.n - b.n);
}

export const RANGES = [['7D', 7], ['30D', 30], ['90D', 90], ['1Y', 365], ['All', null]];

export function rangeBounds(key, workouts, now = Date.now()) {
  const days = (RANGES.find((r) => r[0] === key) || [])[1];
  const end = now;
  let start;
  if (days) start = startOfDay(addDays(now, -(days - 1)));
  else {
    let first = Infinity;
    for (const w of workouts) first = Math.min(first, w.start);
    start = startOfDay(first === Infinity ? addDays(now, -29) : Math.min(first, addDays(now, -6)));
  }
  return { start, end, weeks: Math.max(1, (end - start) / (7 * DAY)) };
}

export const inRange = (w, b) => w.start >= b.start && w.start <= b.end;

const TREND_METRICS = {
  volume: (s) => s.vol,
  sets: (s) => s.sets,
  reps: (s) => s.reps,
  workouts: () => 1,
  duration: (s) => (s.duration ? s.duration / 60000 : 0),
};

export function bucketFns(group, weekStart) {
  if (group === 'day') return [startOfDay, (t) => addDays(t, 1)];
  if (group === 'month') return [startOfMonth, (t) => addMonths(t, 1)];
  return [(t) => startOfWeek(t, weekStart), (t) => addDays(t, 7)];
}

export function trendSeries(workouts, exercises, { metric, bounds, group, weekStart }) {
  const [bStart, step] = bucketFns(group, weekStart);
  const buckets = [];
  const pos = new Map();
  for (let t = bStart(bounds.start); t <= bounds.end; t = step(t)) {
    pos.set(t, buckets.length);
    buckets.push({ t, value: 0, count: 0 });
  }
  const f = TREND_METRICS[metric];
  let total = 0;
  for (const w of workouts) {
    if (!inRange(w, bounds)) continue;
    const v = f(workoutSummary(w, exercises));
    const i = pos.get(bStart(w.start));
    if (i != null) { buckets[i].value += v; buckets[i].count++; }
    total += v;
  }
  // same-length period immediately before, for comparison
  const len = bounds.end - bounds.start;
  let prev = 0, prevAny = false;
  for (const w of workouts) {
    if (w.start >= bounds.start - len && w.start < bounds.start) {
      prev += f(workoutSummary(w, exercises)); prevAny = true;
    }
  }
  return { buckets, total, prev: prevAny ? prev : null };
}

// Sets per muscle. Main muscles get a full set, helper muscles get half.
export function muscleStats(workouts, exercises, bounds) {
  const res = Object.fromEntries(MUSCLES.map(([k]) => [k, { sets: 0, vol: 0, last: null, ex: {} }]));
  for (const w of workouts) {
    const inside = inRange(w, bounds);
    for (const e of w.exercises) {
      const ex = exerciseOf(exercises, e.exId);
      let n = 0, vol = 0;
      for (const s of e.sets) if (isWork(s)) { n++; vol += (s.w || 0) * (s.r || 0); }
      if (!n) continue;
      for (const m of ex.primary) {
        if (!res[m]) continue;
        res[m].last = Math.max(res[m].last || 0, w.start);
        if (inside) { res[m].sets += n; res[m].vol += vol; res[m].ex[e.exId] = (res[m].ex[e.exId] || 0) + n; }
      }
      for (const m of ex.secondary) {
        if (!res[m]) continue;
        res[m].last = Math.max(res[m].last || 0, w.start);
        if (inside) { res[m].sets += n / 2; res[m].ex[e.exId] = (res[m].ex[e.exId] || 0) + n / 2; }
      }
    }
  }
  return res;
}

// Sets per muscle group without double counting: a set counts once for a group
// when any of its main muscles is in the group, half when only a helper muscle is.
export function groupStats(workouts, exercises, bounds, groups) {
  const out = groups.map(([label]) => ({ label, value: 0 }));
  for (const w of workouts) {
    if (!inRange(w, bounds)) continue;
    for (const e of w.exercises) {
      const ex = exerciseOf(exercises, e.exId);
      const n = e.sets.filter(isWork).length;
      if (!n) continue;
      groups.forEach(([, ms], i) => {
        if (ex.primary.some((m) => ms.includes(m))) out[i].value += n;
        else if (ex.secondary.some((m) => ms.includes(m))) out[i].value += n / 2;
      });
    }
  }
  return out;
}

// Heat level 0-5 from sets per week, on the same bands as the evidence notes:
// under 4 low, 4-9 moderate, 10-20 typical growth range, over 20 diminishing returns
export function heatLevel(perWeek) {
  if (!perWeek) return 0;
  if (perWeek < 4) return 1;
  if (perWeek < 10) return 2;
  if (perWeek < 15) return 3;
  if (perWeek <= 20) return 4;
  return 5;
}
export const HEAT_LABELS = ['0', '1–3', '4–9', '10–14', '15–20', '20+'];

export function niceMax(v) {
  if (!v || v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}
export function niceRange(min, max, ticks = 4) {
  if (min === max) { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
  const span = niceMax((max - min) / (ticks - 1));
  const lo = Math.floor(min / span) * span;
  const hi = Math.ceil(max / span) * span;
  const out = [];
  for (let v = lo; v <= hi + span / 2; v += span) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
