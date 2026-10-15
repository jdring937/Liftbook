// Fit a workout into a time budget.
// Estimate: each set takes its working time plus rest, plus a little setup per exercise,
// scaled by how long your past sessions actually took compared with the same estimate.
// Loosely informed by Iversen et al. 2021 (prioritise multi-joint lifts). The trimming order is an
// app heuristic: shorten rest down to each rest rule's floor (rest.js), drop accessories that
// repeat a muscle, then trim accessory sets before compound sets.
import { isWork } from './calc.js';
import { isCompound } from './exkind.js';
import { plannedRest } from './rest.js';

export { isCompound } from './exkind.js';

const SETUP = 45; // seconds to set up / move between exercises

function workSec(ex, reps) {
  if (ex && ex.kind === 'time') return 45;
  return 15 + 3 * (reps || 10);
}
// rest the session will actually use; a timer that's off still means some rest (about a minute)
const planned = (rest, ex, target, settings) => plannedRest({ rest, ex, settings });
const restOf = (rest, ex, target, settings) => { const r = planned(rest, ex, target, settings).sec; return r === 0 ? 60 : r; };

// raw estimate in seconds for [{ sets, rest, reps, ex }]
function rawEstimate(rows) {
  let t = 0;
  rows.forEach((r) => { if (r.sets > 0) t += SETUP + r.sets * workSec(r.ex, r.reps) + (r.sets - 1) * r.rest + r.rest; });
  return Math.max(0, t - (rows.length ? rows[rows.length - 1].rest : 0));
}

// How long past sessions really took versus the same estimate (median ratio, needs 3+ sessions)
export function calibration(workouts, exercises, settings) {
  const ratios = [];
  const recent = [...workouts].filter((w) => w.end && w.start).sort((a, b) => b.start - a.start).slice(0, 15);
  for (const w of recent) {
    const dur = (w.end - w.start) / 1000;
    if (dur < 600 || dur > 3 * 3600) continue;
    const rows = w.exercises.map((e) => {
      const done = e.sets.filter((s) => s.done || isWork(s));
      const reps = done.length ? done.reduce((a, s) => a + (s.r || 0), 0) / done.length : 10;
      return { sets: done.length, rest: restOf(e.rest, exercises[e.exId], e.target, settings), reps, ex: exercises[e.exId] };
    }).filter((r) => r.sets);
    const est = rawEstimate(rows);
    if (est > 300) ratios.push(dur / est);
  }
  if (ratios.length < 3) return { k: 1, n: ratios.length };
  ratios.sort((a, b) => a - b);
  const k = Math.min(1.6, Math.max(0.7, ratios[Math.floor(ratios.length / 2)]));
  return { k, n: ratios.length };
}

function rowsFor(items, exercises, settings) {
  return items.map((it, i) => ({
    i, exId: it.exId, ex: exercises[it.exId], sets: it.sets || 0, origSets: it.sets || 0,
    rest: restOf(it.rest, exercises[it.exId], it, settings), origRest: restOf(it.rest, exercises[it.exId], it, settings), reps: it.max || it.min || 10,
    // how low fit-to-time may cut this rest: the evidence rule's floor (none for a rest you picked)
    floor: (planned(it.rest, exercises[it.exId], it, settings).rule || { floor: Infinity }).floor,
    compound: isCompound(exercises[it.exId]), dropped: false, item: it,
  }));
}

export function estimateTemplate(items, exercises, settings, k = 1) {
  return rawEstimate(rowsFor(items, exercises, settings)) * k;
}

export function fitToTime(items, exercises, budgetMin, { settings, k = 1 } = {}) {
  const rows = rowsFor(items, exercises, settings);
  const budget = budgetMin * 60;
  const live = () => rows.filter((r) => !r.dropped && r.sets > 0);
  const est = () => rawEstimate(live()) * k;
  const fits = () => est() <= budget;
  const full = est();

  // trim one set at a time from the matching exercise with the most sets above its floor (later exercises first)
  const trimTo = (pred, floor) => {
    while (!fits()) {
      const c = live().filter((r) => pred(r) && r.sets > floor);
      if (!c.length) return;
      c.sort((a, b) => b.sets - a.sets || b.i - a.i);
      c[0].sets--;
    }
  };
  const dropFromEnd = (pred) => {
    for (const r of [...live()].reverse()) {
      if (fits()) return;
      if (live().length <= 1) return;
      if (pred(r)) r.dropped = true;
    }
  };
  const iso = (r) => !r.compound;
  const comp = (r) => r.compound;

  // shorten rest one exercise at a time, last exercise first, only as far as needed
  // shorten rest one exercise at a time, last first, never below each rule's floor; a rest the user
  // picked for an exercise is left alone
  const capRest = () => {
    for (const r of [...live()].reverse()) {
      if (fits()) return;
      if (r.item.rest == null && r.rest > r.floor) r.rest = r.floor;
    }
  };
  capRest();
  // accessories whose main muscles an earlier exercise already trains as a main muscle
  dropFromEnd((r) => iso(r) && r.ex && r.ex.primary.every((m) => live().some((o) => o.i < r.i && o.ex && o.ex.primary.includes(m))));
  trimTo(iso, 2);
  trimTo(comp, 3);
  trimTo(iso, 1);
  trimTo(comp, 2);
  dropFromEnd(iso);
  trimTo(comp, 1);
  dropFromEnd(() => true);

  const kept = rows.filter((r) => !r.dropped && r.sets > 0);
  const newItems = kept.map((r) => ({ ...r.item, sets: r.sets, rest: r.rest !== r.origRest ? r.rest : r.item.rest }));
  const changes = rows.map((r) => ({
    exId: r.exId, name: r.ex ? r.ex.name : 'Exercise', compound: r.compound,
    dropped: r.dropped || r.sets === 0, sets: [r.origSets, r.sets], rest: [r.origRest, r.rest],
  }));
  return { items: newItems, changes, full, est: est(), fits: fits(), budget };
}
