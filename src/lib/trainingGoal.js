// The user's main training goal, and the evidence-based defaults it changes.
// Most guidance is the same for every goal (train each muscle 2+ days a week, sets close to failure,
// progressive overload). Goals differ in load (rep ranges), rest for strength work, how weekly
// volume is described, and the pace of bodyweight change the app checks against.
import { isCompound } from './exkind.js';

export const TRAINING_GOALS = [
  { key: 'lose', label: 'Lose weight', desc: 'Drop body fat while keeping your muscle' },
  { key: 'general', label: 'General well-being', desc: 'Functional strength and muscle for everyday life' },
  { key: 'ripped', label: 'Get ripped', desc: 'A lean, defined physique' },
  { key: 'big', label: 'Get big', desc: 'Build as much muscle as you can' },
  { key: 'bigripped', label: 'Get big and ripped', desc: 'Build muscle and lean out, in phases' },
  { key: 'strong', label: 'Get stronger', desc: 'Lift heavier: maximal strength' },
];
export const GOAL_LABEL = Object.fromEntries(TRAINING_GOALS.map((g) => [g.key, g.label]));

const PROFILES = {
  lose: { reps: { compound: [8, 12], isolation: [10, 15] }, pace: 'loss', volume: 'general' },
  general: { reps: { compound: [8, 12], isolation: [10, 15] }, pace: null, volume: 'general' },
  ripped: { reps: { compound: [8, 12], isolation: [10, 15] }, pace: 'loss', volume: 'growth' },
  big: { reps: { compound: [6, 10], isolation: [10, 15] }, pace: 'gain', volume: 'growth' },
  bigripped: { reps: { compound: [6, 10], isolation: [10, 15] }, pace: 'either', volume: 'growth' },
  strong: { reps: { compound: [3, 6], isolation: [8, 12] }, pace: null, volume: 'strength', strengthRest: true },
};
// No goal yet behaves like "General well-being"
export const goalProfile = (goal) => PROFILES[goal] || PROFILES.general;

// Rep range for an exercise added to a workout
export function defaultReps(ex, goal) {
  const p = goalProfile(goal);
  const [min, max] = ex && ex.kind !== 'time' && isCompound(ex) ? p.reps.compound : p.reps.isolation;
  return { min, max };
}

// What the goal changes, for the goal sheet and the science page
export function goalChanges(goal) {
  const p = goalProfile(goal);
  const rows = [
    { why: 'load', text: `New exercises start at ${p.reps.compound[0]}–${p.reps.compound[1]} reps for compound lifts and ${p.reps.isolation[0]}–${p.reps.isolation[1]} for isolation exercises.` },
    {
      why: 'rest',
      text: p.strengthRest
        ? 'Evidence rest: compound lifts 2:30, or 3:00 at 6 reps or fewer; isolation exercises 1:30; timed holds 1:00.'
        : 'Evidence rest: 3:00 for heavy sets (6 reps or fewer), 1:30 for everything else, 1:00 for timed holds.',
    },
    {
      why: 'volume',
      text: p.volume === 'strength' ? 'Weekly coverage treats 4–9 sets a muscle as plenty for strength; more mainly adds size.'
        : p.volume === 'growth' ? 'Weekly coverage aims for 10–20 sets per muscle, a common target for growth; more can still help, with diminishing returns.'
          : 'Weekly coverage treats 4–9 sets a muscle as solid for general strength and muscle, with 10+ for more growth.',
    },
  ];
  if (p.pace === 'loss') rows.push({ why: 'weightRate', text: 'Bodyweight pace is checked against losing 0.5–1% of your weight a week.' });
  else if (p.pace === 'gain') rows.push({ why: 'weightRate', text: 'Bodyweight pace is checked against gaining 0.25–0.5% of your weight a week.' });
  else if (p.pace === 'either') rows.push({ why: 'weightRate', text: 'Bodyweight pace is checked against 0.25–0.5% a week when building and 0.5–1% when leaning out.' });
  return rows;
}

// Goal types worth suggesting after picking a training goal
export function suggestedGoals(goal) {
  const p = goalProfile(goal);
  if (p.pace === 'loss') return [{ type: 'bodyweight', label: 'A bodyweight goal' }, { type: 'measure', site: 'waist', label: 'A waist goal' }];
  if (p.pace === 'gain') return [{ type: 'bodyweight', label: 'A bodyweight goal' }, { type: 'lift', label: 'A lift goal' }];
  if (p.pace === 'either') return [{ type: 'bodyweight', label: 'A bodyweight goal' }, { type: 'measure', site: 'waist', label: 'A waist goal' }];
  if (goal === 'strong') return [{ type: 'lift', label: 'A lift goal' }];
  return [{ type: 'consistency', label: 'A workouts-per-week goal' }];
}
