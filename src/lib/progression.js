// Evidence-based progression (ACSM 2009): increase load 2-10% when you can do 1-2 reps over the
// desired number on two consecutive sessions, a lower percent for small muscle mass exercises and
// a higher percent for large. The app treats the top of your rep range as the desired number.
// This table is shown on the science page; the logic below follows it step by step.
import { isCompound } from './exkind.js';

export const PROGRESSION_RULES = [
  {
    when: 'Below the top of your rep range',
    does: 'One more rep per set than last time, at the same weight',
    because: 'You build reps at a weight until you can do 1–2 more than your target, which is when ACSM adds load.',
  },
  {
    when: 'Every set at your top weight reached the top of the range',
    does: 'Next target: one rep past the top',
    because: 'ACSM adds load once you can do 1–2 reps over your target. The app treats the top of your rep range as that target.',
  },
  {
    when: 'Every set at your top weight went past the top, two sessions in a row',
    does: 'Add about 5% for compound lifts or 2.5% for isolation exercises (never under 2%), rounded to your smallest step, and start again at the bottom of the range',
    because: 'ACSM: increase load 2–10% when you can do 1–2 reps over the target on two consecutive sessions, a lower percent for small muscle mass exercises and a higher percent for large. 5% and 2.5% are the app’s picks inside that range.',
  },
  {
    when: 'Your smallest step is more than 10% of the weight',
    does: 'Use one step anyway, and say so on the target',
    because: 'You can’t load less than your smallest step. A smaller step in Settings avoids it for light lifts.',
  },
  {
    when: 'You rated effort on a set',
    does: 'Reps you had left count as reps you could have done',
    because: 'Reps in reserve estimates how many more reps you could do (Zourdos 2016). People tend to underestimate it by about one rep (Halperin 2022), so counting it is conservative.',
  },
  {
    when: 'Bodyweight exercises past the top, two sessions in a row',
    does: 'Suggest adding weight or a harder variation',
    because: 'The same ACSM trigger; bodyweight can’t go up in small steps.',
  },
  {
    when: 'Assisted machines (e.g. assisted pull-ups)',
    does: 'The same triggers, but the target takes one step off the assistance',
    because: 'Less assistance means more of your bodyweight lifted. A percent of the counterweight doesn’t match the load you actually lift, so the app uses one step.',
  },
  {
    when: 'Timed holds',
    does: '5 seconds more than last time',
    because: 'The app’s own choice; the cited research doesn’t cover holds.',
  },
];

// Load increase: 5% for compound (large muscle mass) and 2.5% for isolation (small muscle mass),
// rounded to the smallest step, never under 2% and never less than one step. Fixed mode: the step itself.
export function weightJump(top, ex, stepKg, mode = 'fixed') {
  if (mode !== 'auto' || !top) return stepKg;
  const pct = isCompound(ex) ? 0.05 : 0.025;
  // never below ACSM's 2% floor, never below one step
  return Math.max(1, Math.round((top * pct) / stepKg), Math.ceil((top * 0.02) / stepKg - 1e-9)) * stepKg;
}

// Reps a set shows you could do: reps done plus reps you had left, when rated
export const repsCapacity = (s) => (s.r || 0) + (s.rir != null ? s.rir : 0);

// Load of a set for comparing sets: on assisted machines, less assistance counts as heavier
export const effLoad = (s, assisted) => (assisted ? -(s.w || 0) : s.w || 0);

// Every top-weight set of a session went past the top of the range, at this load or heavier
export function beatTop(sets, max, atLeast = -Infinity, assisted = false) {
  const work = (sets || []).filter((s) => s.type !== 'w');
  if (!work.length || !max) return false;
  const top = Math.max(...work.map((s) => effLoad(s, assisted)));
  if (top + 1e-6 < atLeast) return false;
  return work.filter((s) => effLoad(s, assisted) === top).every((s) => repsCapacity(s) >= max + 1);
}
