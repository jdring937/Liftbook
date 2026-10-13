import { MUSCLES } from '../data/exercises.js';
import { DAY, startOfDay, startOfWeek, startOfMonth, addDays, addMonths } from './util.js';

// Estimated one-rep max. Brzycki: w * 36 / (37 - r). Epley: w * (1 + r / 30).
// Estimates above 20 reps are not meaningful, so they are skipped.
export function e1rm(kg, reps, formula = 'brzycki') {
  if (!kg || !reps || reps < 1 || reps > 20) return null;
  if (reps === 1) return kg;
  return formula === 'epley' ? kg * (1 + reps / 30) : (kg * 36) / (37 - reps);
}

export const isWork = (s) => s.done && s.type !== 'w';

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
    const est = ex.kind === 'weight' ? e1rm(w, r, formula) || 0 : 0;
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

// Most recent completed sets of an exercise (for the "Previous" column)
export function lastSetsFor(workouts, exId, beforeT = Infinity) {
  let bestW = null;
  for (const w of workouts) {
    if (w.start >= beforeT) continue;
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
export function sessionTargets(prev, ex, range, incKg, opts = {}) {
  const work = prev ? prev.sets.filter((s) => s.type !== 'w') : [];
  if (!work.length) return null;
  const min = range && range.min ? range.min : null;
  const max = range && range.max ? range.max : null;
  // deload week: about half the sets, same weight, easier reps
  if (opts.deload) {
    const half = work.slice(0, Math.max(1, Math.ceil(work.length / 2)));
    return {
      sets: half.map((s) => ({ w: s.w ?? null, r: ex.kind === 'time' ? undefined : (min || s.r), t: ex.kind === 'time' ? s.t : undefined })),
      kind: 'deload', note: 'Deload: same weight, stop 3–4 reps short of failure',
    };
  }
  if (ex.kind === 'time') {
    return { sets: work.map((s) => ({ w: s.w ?? null, t: (s.t || 0) + 5 })), kind: 'more', note: '5 seconds longer than last time' };
  }
  if (ex.kind === 'reps') {
    return { sets: work.map((s) => ({ w: s.w ?? null, r: (s.r || 0) + 1 })), kind: 'more', note: 'One more rep per set than last time' };
  }
  const top = Math.max(...work.map((s) => s.w || 0));
  const topSets = work.filter((s) => (s.w || 0) === top);
  if (top > 0 && max && topSets.every((s) => (s.r || 0) >= max)) {
    return {
      sets: work.map((s) => ({ w: (s.w || 0) === top ? top + incKg : s.w, r: min || Math.max(1, max - 4) })),
      kind: 'up',
      note: `Heavier: you hit ${max} reps on every set last time`,
    };
  }
  const sets = work.map((s) => {
    let r = (s.r || 0) + 1;
    if (max) r = Math.min(max, r);
    if (min) r = Math.max(min, r);
    return { w: s.w, r };
  });
  const same = sets.every((t, i) => t.r === work[i].r);
  const jump = sets.some((t, i) => t.r - (work[i].r || 0) > 1);
  const note = same ? 'Match last time' : jump ? (min === max ? `Aim for ${max} reps` : `Work up to ${min}–${max} reps`) : 'One more rep per set than last time';
  return { sets, kind: same ? 'match' : 'more', note };
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

// Heat level 0-5 from average sets per week
export function heatLevel(perWeek) {
  if (!perWeek) return 0;
  if (perWeek < 5) return 1;
  if (perWeek < 10) return 2;
  if (perWeek < 15) return 3;
  if (perWeek < 20) return 4;
  return 5;
}
export const HEAT_LABELS = ['0', '1–4', '5–9', '10–14', '15–19', '20+'];

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
