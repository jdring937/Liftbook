// "You moved…" comparisons: total weight lifted (weight x reps) expressed as everyday objects.
// Weights are typical values in kg, rounded; the point is a smile, not precision.
import { workoutSummary } from './calc.js';
import { startOfDay, startOfWeek, startOfMonth } from './util.js';

export const OBJECTS = [
  { kg: 0.118, one: 'banana', many: 'bananas' },
  { kg: 4.5, one: 'house cat', many: 'house cats' },
  { kg: 7, one: 'bowling ball', many: 'bowling balls' },
  { kg: 30, one: 'golden retriever', many: 'golden retrievers' },
  { kg: 160, one: 'silverback gorilla', many: 'silverback gorillas' },
  { kg: 220, one: 'motorcycle', many: 'motorcycles' },
  { kg: 450, one: 'polar bear', many: 'polar bears' },
  { kg: 480, one: 'concert grand piano', many: 'concert grand pianos' },
  { kg: 680, one: 'dairy cow', many: 'dairy cows' },
  { kg: 1300, one: 'compact car', many: 'compact cars' },
  { kg: 1500, one: 'hippo', many: 'hippos' },
  { kg: 2300, one: 'white rhino', many: 'white rhinos' },
  { kg: 6000, one: 'African elephant', many: 'African elephants' },
  { kg: 8000, one: 'T. rex', many: 'T. rexes' },
  { kg: 11000, one: 'school bus', many: 'school buses' },
  { kg: 18000, one: 'fire truck', many: 'fire trucks' },
  { kg: 30000, one: 'humpback whale', many: 'humpback whales' },
  { kg: 150000, one: 'blue whale', many: 'blue whales' },
  { kg: 180000, one: 'jumbo jet (empty)', many: 'jumbo jets (empty)' },
  { kg: 225000, one: 'Statue of Liberty', many: 'Statues of Liberty' },
  { kg: 420000, one: 'International Space Station', many: 'International Space Stations' },
  { kg: 7300000, one: 'Eiffel Tower', many: 'Eiffel Towers' },
];

// Objects that make a readable count for this total: the best fit first, then the rest that give at least 1
export function comparisons(kg) {
  if (!kg || kg <= 0) return [];
  const fits = OBJECTS.filter((o) => kg / o.kg >= 1);
  if (!fits.length) return [];
  // the nicest number is between about 1.5 and 30 of something
  const score = (o) => { const n = kg / o.kg; return n < 1.5 ? 10 + (1.5 - n) : n <= 30 ? Math.abs(Math.log10(n) - 0.6) : 2 + Math.log10(n / 30); };
  return [...fits].sort((a, b) => score(a) - score(b));
}

export function countText(kg, o) {
  const n = kg / o.kg;
  const num = n >= 100 ? Math.round(n).toLocaleString('en-US') : n >= 10 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '');
  return `${num} ${num === '1' ? o.one : o.many}`;
}

export const PERIODS = [
  ['day', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['all', 'All time'],
];
export const PERIOD_PHRASE = { day: 'today', week: 'this week', month: 'this month', year: 'this year', all: 'all time' };

export function periodStart(period, now, weekStart) {
  if (period === 'day') return startOfDay(now);
  if (period === 'week') return startOfWeek(now, weekStart);
  if (period === 'month') return startOfMonth(now);
  if (period === 'year') return new Date(new Date(now).getFullYear(), 0, 1).getTime();
  return 0;
}

export function movedTotals(workouts, exercises, weekStart, now = Date.now()) {
  const starts = Object.fromEntries(PERIODS.map(([k]) => [k, periodStart(k, now, weekStart)]));
  const out = Object.fromEntries(PERIODS.map(([k]) => [k, { kg: 0, workouts: 0 }]));
  for (const w of workouts) {
    const v = workoutSummary(w, exercises).vol;
    for (const [k] of PERIODS) if (w.start >= starts[k]) { out[k].kg += v; out[k].workouts++; }
  }
  return out;
}
