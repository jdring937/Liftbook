// Rest between sets, in Evidence mode, keyed to how heavy the set is (its rep target):
// - 6 reps or fewer (heavy loading): 3:00. ACSM 2009 recommends 3-5 min for heavy loading, and
//   Grgic et al. 2018 found rest over 2 min is needed to maximize strength in trained lifters.
// - Everything else: 1:30. ACSM 2009 recommends 1-2 min for hypertrophy-style training, and
//   Singer et al. 2024 found a small benefit over 60 s and no clear extra benefit past ~90 s.
// - Timed holds: 1:00, the app's own choice (no specific evidence).
// A rest set on the exercise (in a saved workout or this session) always wins; 0 means off.
export const HEAVY_REPS = 6;
const topReps = (target) => (target ? target.max || target.min || null : null);
export const isHeavyTarget = (target) => { const r = topReps(target); return !!r && r <= HEAVY_REPS; };

export function autoRest(ex, target) {
  if (ex && ex.kind === 'time') return 60;
  return isHeavyTarget(target) ? 180 : 90;
}
export function autoRestWhy(ex, target) {
  if (ex && ex.kind === 'time') return 'timed hold';
  return isHeavyTarget(target) ? `heavy, ${HEAVY_REPS} reps or fewer` : 'muscle-building sets';
}
export function restFor(rest, ex, target, settings) {
  if (rest != null) return rest;
  return settings.restMode === 'fixed' ? settings.rest : autoRest(ex, target);
}
export const restIsAuto = (rest, settings) => rest == null && settings.restMode !== 'fixed';
