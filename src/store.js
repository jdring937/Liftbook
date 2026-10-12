import { useEffect, useState } from 'preact/hooks';
import { BUILTIN_EXERCISES } from './data/exercises.js';
import { uid, startOfDay } from './lib/util.js';
import { isWork } from './lib/calc.js';

const DB_NAME = 'liftbook';
const KEY = 'state';
const LS_KEY = 'liftbook-state';
export const SCHEMA = 1;

export const TEMPLATE_COLORS = ['red', 'blue', 'yellow', 'green', 'white'];

function tpl(name, color, items) {
  return {
    id: uid(), name, color, note: '', createdAt: Date.now(),
    items: items.map(([exId, sets = 3, min = 8, max = 12]) => ({ exId, sets, min, max, rest: null })),
  };
}

// Starter workouts taken from the user's current library (the parts that were visible)
function seedTemplates() {
  return [
    tpl('(W) Upper Push + Pull 1', 'blue', [
      ['bench-press-dumbbell'], ['dumbbell-row'], ['incline-bench-press-dumbbell'],
    ]),
    tpl('(Th) Shoulders and Tris', 'green', [
      ['tricep-rope-push-down-cable', 3, 10, 15], ['lateral-raise-cable', 3, 12, 15], ['shoulder-external-rotation-cable', 3, 12, 15],
    ]),
    tpl('(F) Arms and Back', 'red', [
      ['seated-row-cable', 3, 10, 15], ['lat-pulldown-neutral-grip'], ['bicep-curl-dumbbell'], ['decline-crunch', 3, 15, 20],
    ]),
  ];
}

export function defaultState() {
  return {
    schema: SCHEMA,
    settings: {
      unit: 'lb', rest: 120, formula: 'brzycki', weekStart: 0, theme: 'system',
      keepAwake: true, incLb: 5, incKg: 2.5, sound: true, lastBackup: null,
    },
    custom: {},
    templates: seedTemplates(),
    programs: [],
    activeProgram: null,
    workouts: [],
    active: null,
    rest: null,
    meta: { created: Date.now(), seeded: true },
  };
}

let state = null;
const listeners = new Set();

export const getState = () => state;
export function setState(next) {
  state = next;
  listeners.forEach((l) => l());
  scheduleSave();
}
export function update(fn) { setState(fn(state)); }
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return state;
}

// ---------- persistence (IndexedDB, with localStorage as a fallback) ----------
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function idbGet(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const q = d.transaction('kv', 'readonly').objectStore('kv').get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function idbSet(key, val) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

function migrate(s) {
  const d = defaultState();
  return {
    ...d, ...s,
    settings: { ...d.settings, ...(s.settings || {}) },
    custom: s.custom || {},
    templates: s.templates || [],
    programs: s.programs || [],
    workouts: s.workouts || [],
    meta: { ...d.meta, ...(s.meta || {}) },
    schema: SCHEMA,
  };
}

export let storageMode = 'indexeddb';
export async function loadState() {
  let s = null;
  try { s = await idbGet(KEY); } catch (e) { storageMode = 'localstorage'; }
  if (!s) {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* ignore */ }
  }
  state = s ? migrate(s) : defaultState();
  if (!s) saveNow();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ignore */ }
  return state;
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
export async function saveNow() {
  clearTimeout(saveTimer);
  const snap = state;
  if (!snap) return;
  try {
    if (storageMode === 'indexeddb') await idbSet(KEY, snap);
    else localStorage.setItem(LS_KEY, JSON.stringify(snap));
  } catch (e) {
    try { storageMode = 'localstorage'; localStorage.setItem(LS_KEY, JSON.stringify(snap)); } catch (e2) { console.error('save failed', e2); }
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('pagehide', () => saveNow());
}

// ---------- exercises ----------
let exCache = { custom: null, merged: null };
export function allExercises(s = state) {
  if (exCache.custom !== s.custom) exCache = { custom: s.custom, merged: { ...BUILTIN_EXERCISES, ...s.custom } };
  return exCache.merged;
}
export function saveCustomExercise(ex) {
  const id = ex.id || 'c-' + uid();
  update((s) => ({ ...s, custom: { ...s.custom, [id]: { ...ex, id, custom: true } } }));
  return id;
}
export function exerciseInUse(id, s = state) {
  return s.workouts.some((w) => w.exercises.some((e) => e.exId === id))
    || s.templates.some((t) => t.items.some((i) => i.exId === id))
    || (s.active && s.active.exercises.some((e) => e.exId === id));
}
export function deleteCustomExercise(id) {
  update((s) => { const c = { ...s.custom }; delete c[id]; return { ...s, custom: c }; });
}

// ---------- settings ----------
export function setSettings(patch) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

// ---------- workouts ----------
export function newSet(src = {}) {
  return { id: uid(), w: src.w ?? null, r: src.r ?? null, t: src.t ?? null, done: false, type: src.type || 'n' };
}
export function newEntry(exId, opts = {}) {
  const n = opts.sets || 3;
  return {
    id: uid(), exId, note: '', rest: opts.rest ?? null,
    target: opts.min || opts.max ? { min: opts.min, max: opts.max } : null,
    sets: Array.from({ length: n }, () => newSet()),
  };
}

export function startWorkout({ template = null, programId = null, programPos = null } = {}) {
  const w = {
    id: uid(),
    name: template ? template.name : 'Workout',
    templateId: template ? template.id : null,
    programId, programPos,
    start: Date.now(), end: null, note: '',
    exercises: template ? template.items.map((i) => newEntry(i.exId, i)) : [],
  };
  update((s) => ({ ...s, active: w, rest: null }));
  return w;
}

export function updateActive(fn) {
  update((s) => (s.active ? { ...s, active: fn(s.active) } : s));
}

// Clean a workout before saving: drop empty sets and exercises
export function cleanWorkout(w, keepUnchecked) {
  const exercises = w.exercises
    .map((e) => ({
      ...e,
      sets: e.sets
        .map((st) => (keepUnchecked && !st.done && (st.r != null || st.t != null) ? { ...st, done: true } : st))
        .filter((st) => st.done),
    }))
    .filter((e) => e.sets.length);
  return { ...w, exercises };
}

export function finishActive(keepUnchecked) {
  let saved = null;
  update((s) => {
    if (!s.active) return s;
    const w = cleanWorkout({ ...s.active, end: Date.now() }, keepUnchecked);
    saved = w;
    if (!w.exercises.length) return { ...s, active: null, rest: null };
    let programs = s.programs;
    if (w.programId) {
      programs = programs.map((p) => (p.id === w.programId
        ? { ...p, pos: Math.max(p.pos || 0, (w.programPos ?? p.pos ?? 0) + 1), log: [...(p.log || []), { pos: w.programPos, workoutId: w.id }] }
        : p));
    }
    return { ...s, workouts: [...s.workouts, w], programs, active: null, rest: null };
  });
  return saved;
}

export function discardActive() {
  update((s) => ({ ...s, active: null, rest: null }));
}

export function saveWorkout(w) {
  const clean = cleanWorkout(w, false);
  update((s) => {
    const exists = s.workouts.some((x) => x.id === w.id);
    const workouts = exists ? s.workouts.map((x) => (x.id === w.id ? clean : x)) : [...s.workouts, clean];
    return { ...s, workouts: workouts.filter((x) => x.exercises.length) };
  });
}
export function deleteWorkout(id) {
  update((s) => ({
    ...s,
    workouts: s.workouts.filter((w) => w.id !== id),
    programs: s.programs.map((p) => ({ ...p, log: (p.log || []).filter((l) => l.workoutId !== id) })),
  }));
}

// ---------- templates ----------
export function saveTemplate(t) {
  const id = t.id || uid();
  update((s) => {
    const exists = s.templates.some((x) => x.id === id);
    const nt = { ...t, id, createdAt: t.createdAt || Date.now() };
    return { ...s, templates: exists ? s.templates.map((x) => (x.id === id ? nt : x)) : [...s.templates, nt] };
  });
  return id;
}
export function deleteTemplate(id) {
  update((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
}
export function templateFromWorkout(w) {
  const seen = new Map();
  for (const e of w.exercises) {
    if (seen.has(e.exId)) continue;
    const work = e.sets.filter(isWork);
    const reps = work.map((s) => s.r).filter(Boolean);
    seen.set(e.exId, {
      exId: e.exId, sets: Math.max(1, work.length || e.sets.length),
      min: reps.length ? Math.min(...reps) : 8, max: reps.length ? Math.max(...reps) : 12, rest: e.rest ?? null,
    });
  }
  return { name: w.name, color: 'blue', note: '', items: [...seen.values()] };
}

// ---------- programs ----------
export function saveProgram(p) {
  const id = p.id || uid();
  update((s) => {
    const exists = s.programs.some((x) => x.id === id);
    const np = { pos: 0, log: [], ...p, id };
    return {
      ...s,
      programs: exists ? s.programs.map((x) => (x.id === id ? np : x)) : [...s.programs, np],
      activeProgram: s.activeProgram || id,
    };
  });
  return id;
}
export function deleteProgram(id) {
  update((s) => ({ ...s, programs: s.programs.filter((p) => p.id !== id), activeProgram: s.activeProgram === id ? null : s.activeProgram }));
}
export function setActiveProgram(id) {
  update((s) => ({ ...s, activeProgram: id }));
}
export function setProgramPos(id, pos) {
  update((s) => ({ ...s, programs: s.programs.map((p) => (p.id === id ? { ...p, pos } : p)) }));
}
export function programNext(p) {
  const n = p.days.length;
  if (!n) return null;
  const total = n * p.weeks;
  const pos = p.pos || 0;
  if (pos >= total) return { done: true, pos, total };
  return { pos, total, week: Math.floor(pos / n) + 1, day: (pos % n) + 1, templateId: p.days[pos % n] };
}

// ---------- rest timer ----------
export function startRest(sec) {
  update((s) => ({ ...s, rest: { endsAt: Date.now() + sec * 1000, total: sec } }));
}
export function adjustRest(delta) {
  update((s) => {
    if (!s.rest) return s;
    const endsAt = Math.max(Date.now(), s.rest.endsAt + delta * 1000);
    return { ...s, rest: { endsAt, total: Math.max(1, s.rest.total + delta) } };
  });
}
export function stopRest() {
  update((s) => ({ ...s, rest: null }));
}

// ---------- backup ----------
export function exportJSON() {
  return JSON.stringify({ app: 'liftbook', exported: new Date().toISOString(), ...state, rest: null }, null, 1);
}
export function importJSON(text) {
  const obj = JSON.parse(text);
  if (!obj || !Array.isArray(obj.workouts) || !Array.isArray(obj.templates)) throw new Error('This file is not a Liftbook backup.');
  delete obj.app; delete obj.exported;
  setState(migrate(obj));
  saveNow();
}
export function eraseAll() {
  const d = defaultState();
  d.templates = [];
  setState(d);
  saveNow();
}

export function exportCSV(exercises) {
  const unit = state.settings.unit;
  const rows = [['date', 'workout', 'exercise', 'set', 'type', `weight_${unit}`, 'reps', 'seconds', 'duration_min']];
  const conv = (kg) => (kg == null ? '' : Math.round((unit === 'lb' ? kg / 0.45359237 : kg) * 100) / 100);
  const sorted = [...state.workouts].sort((a, b) => a.start - b.start);
  for (const w of sorted) {
    const dur = w.end ? Math.round((w.end - w.start) / 60000) : '';
    for (const e of w.exercises) {
      const ex = exercises[e.exId];
      e.sets.forEach((s, i) => {
        if (!s.done) return;
        rows.push([new Date(w.start).toISOString(), w.name, ex ? ex.name : e.exId, i + 1,
          { n: 'normal', w: 'warmup', d: 'drop', f: 'failure' }[s.type] || 'normal', conv(s.w), s.r ?? '', s.t ?? '', dur]);
      });
    }
  }
  return rows.map((r) => r.map((c) => {
    const v = String(c);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',')).join('\n');
}

export function workoutsOnDay(t) {
  const d = startOfDay(t);
  return state.workouts.filter((w) => startOfDay(w.start) === d);
}
