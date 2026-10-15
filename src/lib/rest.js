// Evidence-based rest between sets. One table of rules drives the timer, the "why" sheet,
// the settings text and the science page, so what the app says and does can't drift apart.
// The rule depends on your main goal, the type of exercise and, for strength, your experience.
// Get stronger programs compound lifts heavy (3–6 reps), which is what ACSM's longer rest is for,
// so every compound work set gets the strength rest rather than guessing set by set.
// Warm-up sets get a short rest of the app's own choosing.
import { isCompound } from './exkind.js';

export const REST_RULES = [
  {
    id: 'growth', sec: 90, floor: 75, short: 'for growth',
    when: 'Main goal is anything other than Get stronger (every work set)',
    because: 'For muscle growth, resting longer than about 60 seconds helps a little, and past about 90 seconds there’s no clear extra benefit (Singer 2024). ACSM recommends 1–2 minutes in beginner and intermediate muscle-building programs; it says advanced lifters may use 2–3 minutes on heavy core lifts, but the newer meta-analysis found no clear benefit past 90 seconds.',
  },
  {
    id: 'assist', sec: 90, floor: 75, short: 'assistance',
    when: 'Get stronger: isolation exercises and timed holds',
    because: 'ACSM: for assistance exercises, 1–2 minutes may be enough.',
  },
  {
    id: 'coreNew', sec: 120, floor: 120, short: 'strength lift',
    when: 'Get stronger: compound lifts, lifting less than a year',
    because: 'ACSM recommends at least 2–3 minutes for core lifts in strength training, and a review found 60–120 seconds enough for beginners to get the most strength (Grgic 2018). 2:00 meets both.',
  },
  {
    id: 'core', sec: 180, floor: 150, short: 'strength lift',
    when: 'Get stronger: compound lifts, lifting a year or more',
    because: 'ACSM recommends at least 2–3 minutes for core lifts in strength training, and experienced lifters need more than 2 minutes between sets to get the most strength (Grgic 2018).',
  },
  {
    id: 'warmup', sec: 60, floor: 45, short: 'warm-up',
    when: 'Warm-up sets (any goal)',
    because: 'The app’s own choice: the research above is about work sets, not warm-ups.',
  },
];
export const RULE = Object.fromEntries(REST_RULES.map((r) => [r.id, r]));

export function pickRestRule({ ex, set, settings }) {
  if (set && set.type === 'w') return RULE.warmup;
  if (settings.goal !== 'strong') return RULE.growth;
  if (!ex || ex.kind === 'time' || !isCompound(ex)) return RULE.assist;
  return settings.experience === 'trained' ? RULE.core : RULE.coreNew;
}

// Seconds of rest after a set. A rest set on the exercise always wins (0 = off); with evidence-based
// rest off, the fixed timer from Settings is used.
export function restAfter({ rest, ex, set, settings }) {
  if (rest != null) return { sec: rest, rule: null };
  if (settings.restMode === 'fixed') return { sec: settings.rest, rule: null };
  const rule = pickRestRule({ ex, set, settings });
  return { sec: rule.sec, rule };
}
export const plannedRest = restAfter;

export function restRangeLabel(ex, settings) {
  const r = pickRestRule({ ex, settings });
  const m = Math.floor(r.sec / 60), s = r.sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export const restIsAuto = (rest, settings) => rest == null && settings.restMode !== 'fixed';

// One-line summary for the goal sheet and settings
export function restSummary(settings) {
  if (settings.restMode === 'fixed') return 'Same rest after every set';
  if (settings.goal !== 'strong') return '1:30 after every work set';
  return settings.experience === 'trained'
    ? 'Compound lifts 3:00, isolation and holds 1:30'
    : 'Compound lifts 2:00, isolation and holds 1:30';
}
