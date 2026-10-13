// Trend checks on each lift's estimated 1RM: declining, stalled or improving.
// Cut-offs are rules of thumb (see evidence "trend"): sessions are noisy, so a lift is only
// flagged when the pattern holds for several sessions.
import { entryStats, exerciseOf } from './calc.js';
import { DAY } from './util.js';

const WINDOW = 12 * 7 * DAY;

// Best estimated 1RM per session for weight exercises, oldest first
export function e1rmSeries(workouts, exercises, formula, since = 0) {
  const by = {};
  for (const w of workouts) {
    if (w.start < since) continue;
    const seen = {};
    for (const e of w.exercises) {
      const ex = exerciseOf(exercises, e.exId);
      if (ex.kind !== 'weight') continue;
      (seen[e.exId] = seen[e.exId] || []).push(...e.sets);
    }
    for (const [exId, sets] of Object.entries(seen)) {
      const st = entryStats(sets, exerciseOf(exercises, exId), formula);
      if (st.e1rm > 0) (by[exId] = by[exId] || []).push({ t: w.start, v: st.e1rm });
    }
  }
  for (const k of Object.keys(by)) by[k].sort((a, b) => a.t - b.t);
  return by;
}

// One lift's status from its series
export function liftStatus(series, now = Date.now()) {
  const pts = series.filter((p) => p.t >= now - WINDOW);
  if (pts.length < 4) return { status: 'new' };
  const last = pts[pts.length - 1];
  if (now - last.t > 21 * DAY) return { status: 'idle' };
  // declining: the last 3 sessions all sit 3%+ below the best of the 6 weeks before them
  const last3 = pts.slice(-3);
  const before = pts.filter((p) => p.t < last3[0].t && p.t >= last3[0].t - 42 * DAY);
  if (before.length) {
    const peak = Math.max(...before.map((p) => p.v));
    if (last3.every((p) => p.v <= peak * 0.97)) {
      return { status: 'declining', peak, last: last.v, drop: 1 - last.v / peak, since: last3[0].t };
    }
  }
  // stalled: no new best (by more than 1%) for 4+ weeks over 4+ sessions
  let best = pts[0];
  for (const p of pts) if (p.v > best.v * 1.01) best = p;
  const after = pts.filter((p) => p.t > best.t);
  if (now - best.t >= 28 * DAY && after.length >= 3) {
    return { status: 'stalled', best: best.v, bestT: best.t, weeks: Math.floor((now - best.t) / (7 * DAY)) };
  }
  const first = pts[0].v;
  return { status: last.v > first * 1.02 ? 'improving' : 'steady', change: last.v / first - 1 };
}

// Consecutive weeks with at least one workout, counting back from this week
export function trainingStreakWeeks(workouts, now = Date.now()) {
  const weeks = new Set(workouts.map((w) => Math.floor((now - w.start) / (7 * DAY))));
  let n = 0;
  while (weeks.has(n)) n++;
  return n;
}

export function insights(state, exercises, now = Date.now()) {
  const series = e1rmSeries(state.workouts, exercises, state.settings.formula, now - WINDOW);
  const lifts = Object.entries(series).map(([exId, s]) => ({ exId, name: exerciseOf(exercises, exId).name, ...liftStatus(s, now) }));
  const declining = lifts.filter((l) => l.status === 'declining').sort((a, b) => b.drop - a.drop);
  const stalled = lifts.filter((l) => l.status === 'stalled');
  const improving = lifts.filter((l) => l.status === 'improving');
  const streak = trainingStreakWeeks(state.workouts, now);
  const recentDeload = state.settings.lastDeload && now - state.settings.lastDeload < 21 * DAY;
  const deloading = state.settings.deloadUntil && state.settings.deloadUntil > now;
  const suggestDeload = !deloading && !recentDeload && (declining.length >= 2 || (declining.length === 1 && streak >= 6));
  return { lifts, declining, stalled, improving, streak, suggestDeload, deloading, series };
}

// Pain-monitoring model checks (Silbernagel et al. 2007): up to 5/10 during exercise,
// settled by next morning, not increasing week to week.
export function painHistory(workouts, exId) {
  const out = [];
  for (const w of workouts) for (const e of w.exercises) if (e.exId === exId && e.pain != null) out.push({ t: w.start, v: e.pain });
  return out.sort((a, b) => a.t - b.t);
}
export function painCheck(hist, now = Date.now()) {
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  const wk = (from, to) => hist.filter((p) => p.t >= now - from * 7 * DAY && p.t < now - to * 7 * DAY).map((p) => p.v);
  const thisWeek = wk(1, 0), lastWeek = wk(2, 1);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rising = thisWeek.length && lastWeek.length && avg(thisWeek) > avg(lastWeek) + 0.5;
  return { last, over: last.v > 5, rising: !!rising };
}
