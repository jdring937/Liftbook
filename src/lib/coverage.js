// Planned weekly sets per muscle for a workout or program, before you run it.
// Counting matches the muscle tracker: 1 set for main muscles, 0.5 for helpers.
import { MUSCLES, MUSCLE_NAME } from '../data/exercises.js';

export const MAJOR = ['chest', 'lats', 'upperBack', 'sideDelts', 'rearDelts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];
const PUSH = ['chest', 'frontDelts', 'triceps'];
const PULL = ['lats', 'upperBack', 'rearDelts', 'biceps'];

export function band(sets) {
  if (!sets) return { key: 'none', label: 'None' };
  if (sets < 4) return { key: 'low', label: 'Low' };
  if (sets < 10) return { key: 'mod', label: 'Moderate' };
  if (sets <= 20) return { key: 'good', label: 'Typical range' };
  return { key: 'high', label: 'Diminishing returns' };
}

const names = (ms) => ms.map((m) => MUSCLE_NAME[m]).join(', ');
const r1 = (n) => Math.round(n * 10) / 10;

// sessions: [{ name, items: [{ exId, sets }] }] making up one week.
// exercises: id -> exercise (anything with primary/secondary works, so unsaved guesses can be passed in)
export function planCoverage(sessions, exercises) {
  const m = Object.fromEntries(MUSCLES.map(([k]) => [k, { sets: 0, days: 0, ex: {} }]));
  let push = 0, pull = 0, total = 0;
  for (const sess of sessions) {
    const hit = new Set();
    for (const it of sess.items) {
      const ex = exercises[it.exId];
      const n = it.sets || 0;
      if (!ex || !n) continue;
      total += n;
      for (const k of ex.primary) if (m[k]) { m[k].sets += n; m[k].ex[it.exId] = (m[k].ex[it.exId] || 0) + n; hit.add(k); }
      for (const k of ex.secondary) if (m[k]) { m[k].sets += n / 2; m[k].ex[it.exId] = (m[k].ex[it.exId] || 0) + n / 2; }
      if (ex.primary.some((k) => PUSH.includes(k))) push += n; else if (ex.secondary.some((k) => PUSH.includes(k))) push += n / 2;
      if (ex.primary.some((k) => PULL.includes(k))) pull += n; else if (ex.secondary.some((k) => PULL.includes(k))) pull += n / 2;
    }
    for (const k of hit) m[k].days++;
  }
  const findings = [];
  if (!total) return { muscles: m, findings, push, pull, total };
  const gaps = MAJOR.filter((k) => !m[k].sets);
  const low = MAJOR.filter((k) => m[k].sets > 0 && m[k].sets < 4);
  const mod = MAJOR.filter((k) => m[k].sets >= 4 && m[k].sets < 10);
  const high = MUSCLES.map(([k]) => k).filter((k) => m[k].sets > 20);
  if (gaps.length) findings.push({ kind: 'gap', title: `Not trained: ${names(gaps)}`, body: 'No sets for these muscles in a typical week.', why: 'volume' });
  if (low.length) findings.push({ kind: 'low', title: `Low: ${names(low)}`, body: 'Under 4 sets a week. This is where each added hard set helps most.', why: 'volume' });
  if (mod.length) findings.push({ kind: 'mod', title: `Moderate: ${names(mod)}`, body: '4–9 sets a week. Enough to build muscle and strength; 10 or more tends to give more growth.', why: 'volume' });
  if (high.length) findings.push({ kind: 'high', title: `High: ${high.map((k) => `${MUSCLE_NAME[k]} (${r1(m[k].sets)})`).join(', ')}`, body: 'Over 20 sets a week. Gains tend to taper off past this, so these sets may be better spent elsewhere.', why: 'volume' });
  const ratio = (a, b) => (b ? a / b : Infinity);
  if (push + pull >= 6) {
    if (ratio(push, pull) > 2) findings.push({ kind: 'balance', title: `More pushing than pulling (${r1(push)} vs ${r1(pull)} sets)`, body: 'Upper-body pushing gets over twice the sets of pulling. A rule of thumb, not a proven ratio.', why: 'balance' });
    else if (ratio(pull, push) > 2) findings.push({ kind: 'balance', title: `More pulling than pushing (${r1(pull)} vs ${r1(push)} sets)`, body: 'Upper-body pulling gets over twice the sets of pushing. A rule of thumb, not a proven ratio.', why: 'balance' });
  }
  const q = m.quads.sets, h = m.hamstrings.sets;
  if (q && h && q + h >= 6) {
    if (q / h > 2) findings.push({ kind: 'balance', title: `Quads well ahead of hamstrings (${r1(q)} vs ${r1(h)} sets)`, body: 'The front of the thigh gets over twice the sets of the back. A rule of thumb, not a proven ratio.', why: 'balance' });
    else if (h / q > 2) findings.push({ kind: 'balance', title: `Hamstrings well ahead of quads (${r1(h)} vs ${r1(q)} sets)`, body: 'The back of the thigh gets over twice the sets of the front. A rule of thumb, not a proven ratio.', why: 'balance' });
  }
  if (sessions.length > 1) {
    const once = MAJOR.filter((k) => m[k].sets >= 10 && m[k].days === 1);
    if (once.length) findings.push({ kind: 'info', title: `All in one day: ${names(once)}`, body: 'These get all their weekly sets in a single session. Splitting them over two days is a practical default, though total weekly sets matter more.', why: 'frequency' });
  }
  if (!findings.length) findings.push({ kind: 'ok', title: 'Every major muscle is in the typical range', body: 'Nothing missing or out of balance in a typical week.', why: 'volume' });
  return { muscles: m, findings, push, pull, total };
}

// One week of sessions from a program (each day in order once), or a workout repeated n times
export function programSessions(program, templates) {
  return program.days.map((tid) => templates.find((t) => t.id === tid)).filter(Boolean).map((t) => ({ name: t.name, items: t.items }));
}
export function templateSessions(t, perWeek = 1) {
  return Array.from({ length: perWeek }, () => ({ name: t.name, items: t.items }));
}
