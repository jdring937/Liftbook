// Goals and forecasts.
// Trend goals (lift, reps, bodyweight, measurement) fit a weighted line to recent data and
// project it forward with an uncertainty band. Strength forecasts slow down over time
// (gains taper as you get stronger), so they never extend a straight line indefinitely.
import { exerciseOf, e1rm, entryStats, isWork } from './calc.js';
import { e1rmSeries } from './insights.js';
import { DAY, startOfWeek, fromKg } from './util.js';
import { RADAR_GROUPS } from '../data/exercises.js';

export const GOAL_TYPES = [
  ['lift', 'Lift', 'Hit a weight on a lift'],
  ['reps', 'Reps', 'More reps in one set, like pull-ups'],
  ['bodyweight', 'Bodyweight', 'Reach a bodyweight'],
  ['measure', 'Measurement', 'Waist, arms and so on'],
  ['consistency', 'Consistency', 'Workouts per week'],
  ['volume', 'Muscle sets', 'Weekly sets for a muscle group'],
];
export const SITES = [['waist', 'Waist'], ['chest', 'Chest'], ['hips', 'Hips'], ['arm', 'Arm'], ['thigh', 'Thigh'], ['calf', 'Calf'], ['neck', 'Neck']];
export const SITE_NAME = Object.fromEntries(SITES);
export const VOLUME_GROUPS = RADAR_GROUPS;

const TAU = 26 * 7; // days: strength gains slow with a ~6-month time constant

// ---------- unit helpers (kg and cm stored; lb and inches shown when unit is lb) ----------
export const cmToIn = (cm) => cm / 2.54;
export const lenUnit = (unit) => (unit === 'lb' ? 'in' : 'cm');
export const fromCm = (cm, unit) => (unit === 'lb' ? cmToIn(cm) : cm);
export const toCm = (v, unit) => (unit === 'lb' ? v * 2.54 : v);

// time-weighted moving average for bodyweight: each weigh-in pulls the trend toward it,
// more strongly the longer since the last one (about a week's memory)
export function smoothTrend(points, days = 7) {
  const out = [];
  let tr = null, lastT = null;
  for (const p of points) {
    if (tr == null) tr = p.v;
    else { const a = 1 - Math.exp(-((p.t - lastT) / DAY) / days); tr += (p.v - tr) * Math.max(a, 0.1); }
    lastT = p.t;
    out.push({ t: p.t, v: tr, raw: p.v });
  }
  return out;
}

// ---------- series per goal type ----------
export function goalSeries(goal, state, exercises) {
  const { workouts, body } = state;
  if (goal.type === 'lift') {
    const s = e1rmSeries(workouts, exercises, state.settings.formula)[goal.exId] || [];
    return s;
  }
  if (goal.type === 'reps') {
    const out = [];
    for (const w of workouts) {
      let best = 0;
      for (const e of w.exercises) if (e.exId === goal.exId) for (const st of e.sets) if (isWork(st)) best = Math.max(best, st.r || 0);
      if (best) out.push({ t: w.start, v: best });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  if (goal.type === 'bodyweight') {
    return smoothTrend(body.filter((b) => b.kind === 'weight').map((b) => ({ t: b.t, v: b.v })));
  }
  if (goal.type === 'measure') {
    return body.filter((b) => b.kind === goal.site).map((b) => ({ t: b.t, v: b.v }));
  }
  return [];
}

// weekly buckets for consistency / volume goals (oldest first, current week last)
export function weeklySeries(goal, state, exercises, weeks = 12, now = Date.now()) {
  const ws = state.settings.weekStart;
  const thisWeek = startOfWeek(now, ws);
  const buckets = Array.from({ length: weeks }, (_, i) => ({ t: thisWeek - (weeks - 1 - i) * 7 * DAY, v: 0 }));
  const idx = (t) => Math.floor((startOfWeek(t, ws) - buckets[0].t) / (7 * DAY) + 0.01);
  const group = goal.type === 'volume' ? (VOLUME_GROUPS.find((g) => g[0] === goal.group) || [null, []])[1] : null;
  for (const w of state.workouts) {
    const i = idx(w.start);
    if (i < 0 || i >= weeks) continue;
    if (goal.type === 'consistency') { buckets[i].v++; continue; }
    for (const e of w.exercises) {
      const ex = exerciseOf(exercises, e.exId);
      const n = e.sets.filter(isWork).length;
      if (!n) continue;
      if (ex.primary.some((m) => group.includes(m))) buckets[i].v += n;
      else if (ex.secondary.some((m) => group.includes(m))) buckets[i].v += n / 2;
    }
  }
  return buckets;
}

// ---------- fitting ----------
// Weighted least squares on recent points; recent points count more.
export function fitLine(points, now = Date.now(), windowDays = 56) {
  const pts = points.filter((p) => p.t >= now - windowDays * DAY);
  if (pts.length < 3) return null;
  const span = (pts[pts.length - 1].t - pts[0].t) / DAY;
  if (span < 10) return null;
  let sw = 0, sx = 0, sy = 0;
  const xs = pts.map((p) => (p.t - now) / DAY);
  const wts = xs.map((x) => Math.exp(x / windowDays)); // x <= 0, so older points weigh less
  pts.forEach((p, i) => { sw += wts[i]; sx += wts[i] * xs[i]; sy += wts[i] * p.v; });
  const mx = sx / sw, my = sy / sw;
  let sxx = 0, sxy = 0;
  pts.forEach((p, i) => { sxx += wts[i] * (xs[i] - mx) ** 2; sxy += wts[i] * (xs[i] - mx) * (p.v - my); });
  if (!sxx) return null;
  const b = sxy / sxx;
  const a = my - b * mx; // value at "now" (x = 0)
  let rss = 0;
  pts.forEach((p, i) => { rss += wts[i] * (p.v - (a + b * xs[i])) ** 2; });
  const n = pts.length;
  const sigma = Math.sqrt(rss / sw * (n / Math.max(1, n - 2)));
  const seB = sigma / Math.sqrt(sxx);
  return { a, b, seB, sigma, n, span };
}

// value after d days from now, given slope b per day (damped for strength)
const proj = (a, b, d, damped) => (damped ? a + b * TAU * (1 - Math.exp(-d / TAU)) : a + b * d);
function daysTo(a, b, target, damped) {
  const need = target - a;
  if (!b || Math.sign(need) !== Math.sign(b)) return null;
  if (!damped) return need / b;
  const frac = need / (b * TAU);
  if (frac >= 0.999) return null;
  return -TAU * Math.log(1 - frac);
}

export function forecast(goal, series, now = Date.now()) {
  const damped = goal.type === 'lift' || goal.type === 'reps';
  const fit = fitLine(series, now, goal.type === 'bodyweight' ? 42 : 56);
  if (!fit) return null;
  const { a, b, seB } = fit;
  const eta = daysTo(a, b, goal.target, damped);
  const fast = daysTo(a, b + Math.sign(b || 1) * seB, goal.target, damped);
  const slowB = b - Math.sign(b || 1) * seB;
  const slow = Math.sign(slowB) === Math.sign(b) ? daysTo(a, slowB, goal.target, damped) : null;
  return {
    ...fit, damped,
    at: (t) => proj(a, b, (t - now) / DAY, damped),
    band: (t) => {
      const d = (t - now) / DAY;
      const v1 = proj(a, b - seB, d, damped), v2 = proj(a, b + seB, d, damped);
      return [Math.min(v1, v2), Math.max(v1, v2)];
    },
    eta: eta == null ? null : now + eta * DAY,
    etaFast: fast == null ? null : now + fast * DAY,
    etaSlow: slow == null ? null : now + slow * DAY,
    perWeek: b * 7,
  };
}

// ---------- status ----------
export function goalStatus(goal, state, exercises, now = Date.now()) {
  if (goal.type === 'consistency' || goal.type === 'volume') {
    const weeks = weeklySeries(goal, state, exercises, 12, now);
    const done = weeks.slice(0, -1);
    const last4 = done.slice(-4);
    const avg4 = last4.reduce((x, w) => x + w.v, 0) / Math.max(1, last4.length);
    let streak = 0;
    for (let i = done.length - 1; i >= 0 && done[i].v >= goal.target; i--) streak++;
    const cur = weeks[weeks.length - 1].v;
    const hit4 = last4.filter((w) => w.v >= goal.target).length;
    return {
      kind: 'weekly', weeks, current: cur, avg4, streak, hit4,
      pct: Math.min(1, cur / goal.target),
      status: cur >= goal.target ? 'done' : avg4 >= goal.target ? 'ontrack' : hit4 >= 2 ? 'close' : 'behind',
    };
  }
  const series = goalSeries(goal, state, exercises);
  const last = series.length ? series[series.length - 1] : null;
  const start = goal.start ?? (series.length ? series[0].v : null);
  const current = last ? last.v : start;
  const dir = start == null || goal.target >= start ? 1 : -1;
  const span = start == null ? 0 : goal.target - start;
  const pct = current == null ? 0 : span ? Math.max(0, Math.min(1, (current - start) / span)) : (dir > 0 ? (current >= goal.target ? 1 : 0) : (current <= goal.target ? 1 : 0));
  const reached = last && (dir > 0 ? current >= goal.target : current <= goal.target);
  const fc = reached ? null : forecast(goal, series, now);
  let status = 'nodata';
  if (reached) status = 'done';
  else if (fc) {
    if (Math.sign(fc.b) !== dir || Math.abs(fc.b) < 1e-9) status = 'away';
    else if (!fc.eta) status = 'far';
    else if (goal.date) status = fc.eta <= goal.date + 7 * DAY ? 'ontrack' : 'behind';
    else status = 'ontrack';
  }
  const daysLeft = goal.date ? Math.max(0, (goal.date - now) / DAY) : null;
  const needPerWeek = goal.date && daysLeft > 0 && current != null ? ((goal.target - current) / daysLeft) * 7 : null;
  return { kind: 'trend', series, current, pct, status, fc, reached, dir, daysLeft, needPerWeek };
}

// Current value for a new goal's starting point
export function currentValue(goal, state, exercises) {
  if (goal.type === 'consistency' || goal.type === 'volume') return 0;
  const s = goalSeries(goal, state, exercises);
  return s.length ? s[s.length - 1].v : null;
}

// Bodyweight rate check against evidence-based ranges (% of bodyweight per week)
export function weightRateCheck(perWeekKg, bwKg) {
  if (!perWeekKg || !bwKg) return null;
  const pct = (perWeekKg / bwKg) * 100;
  if (pct < 0) return { pct, ok: pct >= -1, label: pct < -1 ? 'faster than the 0.5–1% a week usually advised for keeping muscle' : pct > -0.5 ? 'gentle (under 0.5% a week)' : 'within the 0.5–1% a week range' };
  return { pct, ok: pct <= 0.5, label: pct > 0.5 ? 'faster than the 0.25–0.5% a week usually advised to limit fat gain' : pct < 0.25 ? 'gentle (under 0.25% a week)' : 'within the 0.25–0.5% a week range' };
}

export function goalTitle(goal, exercises, unit) {
  const fmt = (kg) => `${Math.round(fromKg(kg, unit) * 10) / 10} ${unit}`;
  if (goal.type === 'lift') return `${exerciseOf(exercises, goal.exId).name}: ${fmt(goal.targetW)}${goal.reps > 1 ? ` × ${goal.reps}` : ''}`;
  if (goal.type === 'reps') return `${exerciseOf(exercises, goal.exId).name}: ${goal.target} reps`;
  if (goal.type === 'bodyweight') return `Bodyweight: ${fmt(goal.target)}`;
  if (goal.type === 'measure') return `${SITE_NAME[goal.site]}: ${Math.round(fromCm(goal.target, unit) * 10) / 10} ${lenUnit(unit)}`;
  if (goal.type === 'consistency') return `${goal.target} workouts a week`;
  if (goal.type === 'volume') return `${goal.group}: ${goal.target} sets a week`;
  return 'Goal';
}

export const liftTarget = (w, reps, formula) => (reps > 1 ? e1rm(w, reps, formula) : w);
export { entryStats };
