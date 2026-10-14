// Rest between sets.
// Evidence-based mode follows ACSM 2009 (2-3 min for core multi-joint lifts with heavier loads,
// 1-2 min for assistance exercises) and Singer et al. 2024 (more than ~60 s helps growth a little,
// no clear extra benefit past ~90 s). The exact numbers are the app's rule built on those ranges.
import { isCompound } from './exkind.js';

export function autoRest(ex, target) {
  if (!ex) return 120;
  if (ex.kind === 'time') return 60;
  const top = target ? target.max || target.min : null;
  if (isCompound(ex)) return top && top <= 6 ? 180 : 120;
  return 90;
}
export function autoRestWhy(ex, target) {
  if (!ex) return '';
  if (ex.kind === 'time') return 'timed hold';
  const top = target ? target.max || target.min : null;
  if (isCompound(ex)) return top && top <= 6 ? 'heavy compound' : 'compound';
  return 'isolation';
}
// A rest set on the exercise (in a saved workout or this session) always wins; 0 means off
export function restFor(rest, ex, target, settings) {
  if (rest != null) return rest;
  return settings.restMode === 'fixed' ? settings.rest : autoRest(ex, target);
}
export const restIsAuto = (rest, settings) => rest == null && settings.restMode !== 'fixed';
