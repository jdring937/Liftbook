import { useEffect, useState } from 'preact/hooks';
import { BUILTIN_EXERCISES } from './data/exercises.js';
import { uid, startOfDay } from './lib/util.js';
import { isWork } from './lib/calc.js';

const DB_NAME = 'swellness';
const KEY = 'state';
const LS_KEY = 'swellness-state';
// The app was called Liftbook before; data saved under the old names is copied over once
const OLD_DB_NAME = 'liftbook';
const OLD_LS_KEY = 'liftbook-state';
export const SCHEMA = 1;

export const TEMPLATE_COLORS = ['red', 'blue', 'yellow', 'green', 'white'];

// Workouts that early builds pre-loaded. Removed on load if they are still untouched.
const OLD_SEEDS = {
  '(W) Upper Push + Pull 1': ['bench-press-dumbbell', 'dumbbell-row', 'incline-bench-press-dumbbell'],
  '(Th) Shoulders and Tris': ['tricep-rope-push-down-cable', 'lateral-raise-cable', 'shoulder-external-rotation-cable'],
  '(F) Arms and Back': ['seated-row-cable', 'lat-pulldown-neutral-grip', 'bicep-curl-dumbbell', 'decline-crunch'],
};
function isUntouchedSeed(t, programs) {
  const ids = OLD_SEEDS[t.name];
  if (!ids || t.items.length !== ids.length || t.items.some((it, i) => it.exId !== ids[i])) return false;
  return !programs.some((p) => p.days.includes(t.id));
}

export function defaultState() {
  return {
    schema: SCHEMA,
    settings: {
      unit: 'lb', rest: 120, formula: 'brzycki', weekStart: 0, theme: 'system',
      keepAwake: true, incLb: 5, incKg: 2.5, sound: true, targets: true, bodySex: 'male', lastBackup: null,
      deloadUntil: null, lastDeload: null, effortDefault: false, effortScale: 'rir',
    },
    custom: {},
    templates: [],
    programs: [],
    activeProgram: null,
    workouts: [],
    goals: [],
    body: [],
    photos: [],
    active: null,
    rest: null,
    meta: { created: Date.now(), seedCleaned: true, dismissed: {} },
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
export async function idbDel(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('kv', 'readwrite');
    tx.objectStore('kv').delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function idbGet(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const q = d.transaction('kv', 'readonly').objectStore('kv').get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
export async function idbSet(key, val) {
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
  if (s.meta && s.meta.seeded && !s.meta.seedCleaned) {
    const programs = s.programs || [];
    s = { ...s, templates: (s.templates || []).filter((t) => !isUntouchedSeed(t, programs)), meta: { ...s.meta, seedCleaned: true } };
  }
  return {
    ...d, ...s,
    settings: { ...d.settings, ...(s.settings || {}) },
    custom: s.custom || {},
    templates: s.templates || [],
    programs: s.programs || [],
    workouts: s.workouts || [],
    goals: s.goals || [],
    body: s.body || [],
    photos: s.photos || [],
    meta: { ...d.meta, ...(s.meta || {}), dismissed: { ...((s.meta && s.meta.dismissed) || {}) } },
    schema: SCHEMA,
  };
}

// Open the old database only if it exists (aborting the upgrade means a missing one isn't created)
function openOldDb() {
  return new Promise((res) => {
    let r;
    try { r = indexedDB.open(OLD_DB_NAME, 1); } catch (e) { res(null); return; }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* ignore */ } };
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
    r.onblocked = () => res(null);
  });
}
// Copy everything (state and photo images) from the old database into the new one
async function copyOldData() {
  const old = await openOldDb();
  if (!old) return null;
  try {
    if (!old.objectStoreNames.contains('kv')) return null;
    const rows = await new Promise((res, rej) => {
      const out = [];
      const req = old.transaction('kv', 'readonly').objectStore('kv').openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
      req.onerror = () => rej(req.error);
    });
    const st = rows.find(([k]) => k === KEY);
    if (!st) return null;
    for (const [k, v] of rows) if (k !== KEY) await idbSet(k, v);
    return st[1];
  } catch (e) {
    return null;
  } finally {
    old.close();
  }
}

export let storageMode = 'indexeddb';
export async function loadState() {
  let s = null;
  try { s = await idbGet(KEY); } catch (e) { storageMode = 'localstorage'; }
  if (!s && storageMode === 'indexeddb') s = await copyOldData();
  if (!s) {
    try {
      const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(OLD_LS_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }
  state = s ? migrate(s) : defaultState();
  saveNow();
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
    id: uid(), exId, note: opts.note || '', rest: opts.rest ?? null,
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
    exercises: template ? template.items.map((i) => newEntry(i.exId, deloadActive() ? { ...i, sets: Math.max(1, Math.ceil((i.sets || 3) / 2)) } : i)) : [],
    deload: deloadActive() || undefined,
    effort: template && template.effort != null ? template.effort : !!state.settings.effortDefault,
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
// Photos are kept out of the JSON backup (they have their own export) so backups stay small
export function exportJSON() {
  return JSON.stringify({ app: 'swellness', exported: new Date().toISOString(), ...state, photos: undefined, rest: null }, null, 1);
}
export function importJSON(text) {
  const obj = JSON.parse(text);
  if (!obj || !Array.isArray(obj.workouts) || !Array.isArray(obj.templates)) throw new Error('This file is not a Swellness backup.');
  delete obj.app; delete obj.exported;
  obj.photos = state.photos;
  setState(migrate(obj));
  saveNow();
}
export function eraseAll() {
  const photos = state.photos || [];
  const d = defaultState();
  d.templates = [];
  setState(d);
  saveNow();
  for (const p of photos) { idbDel('ph:' + p.id).catch(() => {}); idbDel('pt:' + p.id).catch(() => {}); }
}

// ---------- deload week ----------
export const deloadActive = (s = state) => !!(s.settings.deloadUntil && s.settings.deloadUntil > Date.now());
export function startDeload(days = 7) {
  const until = startOfDay(Date.now()) + days * 86400000 + 86399999;
  update((s) => ({ ...s, settings: { ...s.settings, deloadUntil: until, lastDeload: Date.now() } }));
}
export function endDeload() {
  update((s) => ({ ...s, settings: { ...s.settings, deloadUntil: null } }));
}
export function dismiss(key) {
  update((s) => ({ ...s, meta: { ...s.meta, dismissed: { ...s.meta.dismissed, [key]: Date.now() } } }));
}

// ---------- goals ----------
export function saveGoal(g) {
  const id = g.id || uid();
  update((s) => {
    const ng = { createdAt: Date.now(), ...g, id };
    const exists = s.goals.some((x) => x.id === id);
    return { ...s, goals: exists ? s.goals.map((x) => (x.id === id ? ng : x)) : [...s.goals, ng] };
  });
  return id;
}
export function deleteGoal(id) {
  update((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
}

// ---------- body log: bodyweight (kg) and measurements (cm) ----------
export function addBody(entry) {
  const id = entry.id || uid();
  update((s) => ({ ...s, body: [...s.body.filter((b) => b.id !== id), { ...entry, id }].sort((a, b) => a.t - b.t) }));
  return id;
}
export function deleteBody(id) {
  update((s) => ({ ...s, body: s.body.filter((b) => b.id !== id) }));
}

// ---------- progress photos (images live in IndexedDB under ph:<id> and pt:<id>) ----------
export async function addPhoto(meta, full, thumb) {
  const id = meta.id || uid();
  await idbSet('ph:' + id, full);
  await idbSet('pt:' + id, thumb);
  update((s) => ({ ...s, photos: [...s.photos.filter((p) => p.id !== id), { ...meta, id }].sort((a, b) => a.t - b.t) }));
  return id;
}
export async function deletePhoto(id) {
  update((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
  await idbDel('ph:' + id).catch(() => {});
  await idbDel('pt:' + id).catch(() => {});
}
export function updatePhoto(id, patch) {
  update((s) => ({ ...s, photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}
export const photoBlob = (id, thumb = false) => idbGet((thumb ? 'pt:' : 'ph:') + id);

export function exportCSV(exercises) {
  const unit = state.settings.unit;
  const rows = [['date', 'workout', 'exercise', 'set', 'type', `weight_${unit}`, 'reps', 'seconds', 'reps_in_reserve', 'duration_min']];
  const conv = (kg) => (kg == null ? '' : Math.round((unit === 'lb' ? kg / 0.45359237 : kg) * 100) / 100);
  const sorted = [...state.workouts].sort((a, b) => a.start - b.start);
  for (const w of sorted) {
    const dur = w.end ? Math.round((w.end - w.start) / 60000) : '';
    for (const e of w.exercises) {
      const ex = exercises[e.exId];
      e.sets.forEach((s, i) => {
        if (!s.done) return;
        rows.push([new Date(w.start).toISOString(), w.name, ex ? ex.name : e.exId, i + 1,
          { n: 'normal', w: 'warmup', d: 'drop', f: 'failure' }[s.type] || 'normal', conv(s.w), s.r ?? '', s.t ?? '', s.rir ?? '', dur]);
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
