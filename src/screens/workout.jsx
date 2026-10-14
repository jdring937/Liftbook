import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import {
  useStore, getState, allExercises, updateActive, finishActive, discardActive, saveWorkout, deleteWorkout,
  newEntry, newSet, startRest, adjustRest, stopRest, saveTemplate, templateFromWorkout,
} from '../store.js';
import { exerciseOf, lastSetsFor, bestByExercise, e1rm, isWork, workoutSummary, buildPRIndex, sessionTargets, pastNotes, effortReps, effortLabel } from '../lib/calc.js';
import { movedLine } from '../components/moved.jsx';
import { toKg, wNum, fmtW, fmtClock, fmtTime, toLocalInput, fmtDuration, fmtNum, uid, plural, fmtSecs, fmtDateShort, daysAgo } from '../lib/util.js';
import { Icon, NumInput, Toggle, openSheet, confirmSheet, toast, push, pop, removeScreen, setTab } from '../ui.jsx';
import { openPicker, musclesText } from './pickers.jsx';
import { ExThumb, previewSheet, hasPreview } from '../components/preview.jsx';
import { Why } from '../components/why.jsx';
import { restFor, restIsAuto, autoRest, autoRestWhy } from '../lib/rest.js';
const WhyLink = () => <Why id="pain" />;

const TYPE_LABEL = { w: 'W', d: 'D', f: 'F' };
const TYPE_NAME = { n: 'Normal', w: 'Warm-up', d: 'Drop set', f: 'Failure' };

// ---------- audio for the rest timer ----------
let actx = null;
export function unlockAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { /* ignore */ }
}
function beep() {
  try {
    if (!actx || !getState().settings.sound) return;
    const t = actx.currentTime;
    [0, 0.22, 0.44].forEach((d, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
      o.connect(g); g.connect(actx.destination);
      o.start(t + d); o.stop(t + d + 0.2);
    });
    navigator.vibrate && navigator.vibrate([120, 80, 120]);
  } catch (e) { /* ignore */ }
}

function useTick(ms = 1000) {
  const [, f] = useState(0);
  useEffect(() => { const i = setInterval(() => f((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}

function Elapsed({ start }) {
  useTick(1000);
  return <span class="num">{fmtClock((Date.now() - start) / 1000)}</span>;
}

export function RestBar() {
  const s = useStore();
  useTick(250);
  const fired = useRef(null);
  const r = s.rest;
  if (!r) return null;
  const left = (r.endsAt - Date.now()) / 1000;
  if (left <= 0 && fired.current !== r.endsAt) {
    fired.current = r.endsAt;
    beep();
    setTimeout(() => { const st = getState(); if (st.rest && st.rest.endsAt === r.endsAt) stopRest(); }, 3500);
  }
  const frac = Math.max(0, Math.min(1, left / r.total));
  return (
    <div class={'rest-bar' + (left <= 0 ? ' over' : '')} role="timer" aria-live="off">
      <div class="rest-fill" style={{ transform: `scaleX(${frac})` }} />
      <div class="rest-row">
        <button class="rest-btn" onClick={() => adjustRest(-15)}>−15</button>
        <div class="rest-time">
          <span class="num">{left <= 0 ? 'Rest done' : fmtClock(Math.ceil(left))}</span>
          <span class="small">{left <= 0 ? 'Next set' : `Rest ${fmtClock(r.total)}${r.why ? ` · ${r.why}` : ''}`}</span>
        </div>
        <button class="rest-btn" onClick={() => adjustRest(15)}>+15</button>
        <button class="rest-btn skip" onClick={stopRest}>Skip</button>
      </div>
    </div>
  );
}

function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock = null, alive = true;
    const req = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ } };
    const vis = () => { if (document.visibilityState === 'visible' && alive) req(); };
    req();
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; document.removeEventListener('visibilitychange', vis); try { lock && lock.release(); } catch (e) { /* ignore */ } };
  }, [on]);
}

// ---------- placeholders ----------
// Each set's grey values: a weight you changed on the set above carries down; otherwise today's
// target, then the same set last time, then the set above. Tapping the check accepts them.
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-6;
function placeholders(entry, work, targets) {
  const out = [];
  let k = 0;
  let above = null;
  for (const s of entry.sets) {
    if (s.type === 'w') { out.push({ w: null, r: null, t: null }); continue; }
    const tg = targets ? targets.sets[Math.min(k, targets.sets.length - 1)] : null;
    const last = work[k] || null;
    const ph = {};
    for (const f of ['w', 'r', 't']) {
      const mine = above && above.set[f] != null && !near(above.set[f], above.ph[f]);
      if (mine && (f === 'w' || !tg)) ph[f] = above.set[f];
      else ph[f] = tg?.[f] ?? last?.[f] ?? (above ? above.set[f] ?? above.ph[f] : null) ?? null;
    }
    if (ph.r == null && entry.target) ph.r = entry.target.max || entry.target.min || null;
    out.push(ph);
    above = { set: s, ph };
    k++;
  }
  return out;
}

function setText(v, ex, unit) {
  if (!v) return '–';
  const w = v.w != null ? fmtNum(wNum(v.w, unit, 2)) : null;
  if (ex.kind === 'time') return `${w && v.w ? w + ' × ' : ''}${fmtSecs(v.t)}`;
  if (ex.kind === 'reps') return v.w ? `+${w} × ${v.r}` : `${v.r} reps`;
  return `${w} × ${v.r}`;
}

function targetSummary(tg, ex, unit) {
  const sets = tg.sets;
  const same = sets.every((t) => near(t.w, sets[0].w) || (t.w == null && sets[0].w == null)) && sets.every((t) => t.r === sets[0].r && t.t === sets[0].t);
  if (!same) {
    const oneW = sets.every((t) => near(t.w, sets[0].w));
    if (oneW && ex.kind === 'weight') return `${fmtW(sets[0].w, unit)} × ${sets.map((t) => t.r).join(', ')}`;
    return sets.map((t) => setText(t, ex, unit).replace(' reps', '')).join(', ');
  }
  const t = sets[0];
  if (ex.kind === 'time') return `${sets.length} × ${fmtSecs(t.t)}${t.w ? ` at +${fmtW(t.w, unit)}` : ''}`;
  if (ex.kind === 'reps') return `${sets.length} × ${t.r} reps${t.w ? ` at +${fmtW(t.w, unit)}` : ''}`;
  return `${sets.length} × ${t.r} at ${fmtW(t.w, unit)}`;
}

// ---------- one set row ----------
function SetRow({ set, label, ph, last, ex, unit, isPR, current, scale, onChange, onDone, onMenu }) {
  const wRef = useRef(null), rRef = useRef(null);
  const phW = ph.w != null ? wNum(ph.w, unit, 2) : null;
  const fillLast = () => { if (last) onChange({ ...set, w: last.w ?? set.w, r: last.r ?? set.r, t: last.t ?? set.t }); };
  const toggle = () => {
    if (set.done) { onChange({ ...set, done: false }); return; }
    const next = { ...set };
    if (next.w == null && ph.w != null) next.w = ph.w;
    if (ex.kind === 'time') {
      if (next.t == null) next.t = ph.t;
      if (next.t == null) { rRef.current && rRef.current.focus(); return; }
    } else {
      if (next.r == null) next.r = ph.r;
      if (next.r == null) { rRef.current && rRef.current.focus(); return; }
    }
    if (ex.kind === 'weight' && next.w == null) { wRef.current && wRef.current.focus(); return; }
    next.done = true;
    onChange(next);
    onDone(next);
  };
  return (
    <div class={'set-row' + (set.done ? ' done' : '') + (current ? ' cur' : '') + (set.type !== 'n' ? ' t-' + set.type : '')}>
      <button class={'set-num num' + (set.rir != null ? ' has-eff' : '')} onClick={onMenu} aria-label={`Set ${label} options${set.rir != null ? `, ${effortLabel(set.rir, scale)}` : ''}`}>
        {label}{set.rir != null && <span class="set-eff">{effortLabel(set.rir, scale, true)}</span>}
      </button>
      <button class="set-prev num" onClick={fillLast} disabled={!last}>
        {isPR ? <Icon name="medal" size={15} class="pr-ic" /> : null}{last ? setText(last, ex, unit) : '–'}
      </button>
      <NumInput label="Weight" inputRef={wRef} value={set.w == null ? null : wNum(set.w, unit, 2)} placeholder={phW}
        onChange={(v) => onChange({ ...set, w: toKg(v, unit) })} />
      {ex.kind === 'time'
        ? <NumInput label="Seconds" inputRef={rRef} decimal={false} value={set.t} placeholder={ph.t} onChange={(v) => onChange({ ...set, t: v })} />
        : <NumInput label="Reps" inputRef={rRef} decimal={false} value={set.r} placeholder={ph.r} onChange={(v) => onChange({ ...set, r: v })} />}
      <button class={'set-check' + (set.done ? ' on' : '')} aria-pressed={set.done} aria-label={set.done ? 'Mark set not done' : 'Mark set done'} onClick={toggle}>
        <Icon name="check" size={20} stroke={2.6} />
      </button>
    </div>
  );
}

// ---------- one exercise block ----------
function ExerciseBlock({ entry, idx, count, ex, unit, prev, best, targets, formula, mode, notes = [], effort = false, scale = 'rir', rateFor, setRateFor, onChange, onRemove, onMove, onReplace, onSetDone }) {
  const work = prev ? prev.sets.filter((s) => s.type !== 'w') : [];
  let normal = 0;
  const labels = entry.sets.map((s) => (s.type === 'n' ? String(++normal) : TYPE_LABEL[s.type]));
  const phs = placeholders(entry, work, targets);
  const lastFor = [];
  { let k = 0; for (const s of entry.sets) lastFor.push(s.type === 'w' ? null : work[k++] || null); }
  const current = entry.sets.findIndex((s) => !s.done);

  const setSet = (i, ns) => onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? ns : s)) });
  const addSet = () => onChange({ ...entry, sets: [...entry.sets, newSet()] });
  const setMenu = (i) => {
    openSheet((close) => (
      <div class="sheet-pad">
        <h3 class="sheet-title">Set {labels[i]}</h3>
        <div class="menu">
          {Object.entries(TYPE_NAME).map(([k, v]) => (
            <button key={k} class={'menu-row' + (entry.sets[i].type === k ? ' on' : '')} onClick={() => { setSet(i, { ...entry.sets[i], type: k }); close(); }}>
              <span class="type-badge">{TYPE_LABEL[k] || '1'}</span>{v}
              {entry.sets[i].type === k && <Icon name="check" size={18} class="ml-auto" />}
            </button>
          ))}
          {entry.sets[i].type !== 'w' && ex.kind !== 'time' && (
            <button class="menu-row" onClick={() => { close(); setRateFor(entry.sets[i].id); }}>
              <Icon name="flame" size={20} /> {entry.sets[i].rir != null ? `Effort: ${effortLabel(entry.sets[i].rir, scale)}` : 'Rate effort'}
            </button>
          )}
          <button class="menu-row danger" onClick={() => { onChange({ ...entry, sets: entry.sets.filter((_, j) => j !== i) }); close(); }}>
            <Icon name="trash" size={20} /> Delete set
          </button>
        </div>
      </div>
    ));
  };
  const menu = () => {
    openSheet((close) => (
      <div class="sheet-pad">
        <h3 class="sheet-title">{ex.name}</h3>
        <div class="menu">
          {hasPreview(ex.id) && <button class="menu-row" onClick={() => { close(); previewSheet(ex); }}><Icon name="play" size={20} /> How to do it</button>}
          <button class="menu-row" onClick={() => { close(); push('exercise', { id: ex.id }); }}><Icon name="progress" size={20} /> History and records</button>
          <button class="menu-row" onClick={() => { close(); onReplace(); }}><Icon name="swap" size={20} /> Replace exercise</button>
          <button class="menu-row" onClick={() => { close(); noteSheet(entry.note, (note) => onChange({ ...entry, note })); }}><Icon name="note" size={20} /> {entry.note ? 'Edit note' : 'Add note'}</button>
          <button class="menu-row" onClick={() => { close(); painSheet(entry.pain, (pain) => onChange({ ...entry, pain })); }}><Icon name="flame" size={20} /> Pain or discomfort {entry.pain != null && <span class="muted ml-auto">{entry.pain}/10</span>}</button>
          {notes.length > 0 && <button class="menu-row" onClick={() => { close(); notesSheet(ex, notes, unit); }}><Icon name="note" size={20} /> Past notes <span class="muted ml-auto">{notes.length}</span></button>}
          {mode === 'active' && (
            <button class="menu-row" onClick={() => { close(); restSheet(entry.rest, (rest) => onChange({ ...entry, rest }), { ex, target: entry.target }); }}>
              <Icon name="timer" size={20} /> Rest timer <span class="muted ml-auto">{restLabel(entry.rest, ex, entry.target)}</span>
            </button>
          )}
          {idx > 0 && <button class="menu-row" onClick={() => { onMove(-1); close(); }}><Icon name="arrowUp" size={20} /> Move up</button>}
          {idx < count - 1 && <button class="menu-row" onClick={() => { onMove(1); close(); }}><Icon name="arrowDown" size={20} /> Move down</button>}
          <button class="menu-row danger" onClick={() => { onRemove(); close(); }}><Icon name="trash" size={20} /> Remove exercise</button>
        </div>
      </div>
    ));
  };

  const range = entry.target && entry.target.max
    ? `${entry.target.min && entry.target.min !== entry.target.max ? entry.target.min + '–' : ''}${entry.target.max} reps`
    : null;
  const wHead = ex.kind === 'weight' ? unit : `+${unit}`;
  const rHead = ex.kind === 'time' ? 'Sec' : 'Reps';
  return (
    <section class="ex-block">
      <div class="ex-head">
        <ExThumb ex={ex} onClick={() => previewSheet(ex)} />
        <button class="ex-name" onClick={() => push('exercise', { id: ex.id })}>
          <span>{ex.name}</span>
          <span class="muted small">{range || musclesText(ex)}</span>
        </button>
        <button class="icon-btn" aria-label={`${ex.name} options`} onClick={menu}><Icon name="more" /></button>
      </div>
      {entry.note && <p class="ex-note">{entry.note}</p>}
      {entry.pain != null && (
        <button class={'pain-pill ' + (entry.pain > 5 ? 'hi' : entry.pain > 2 ? 'mid' : 'lo')} onClick={() => painSheet(entry.pain, (pain) => onChange({ ...entry, pain }))}>
          Pain {entry.pain}/10{entry.pain > 5 ? ' · above 5/10' : ''}
        </button>
      )}
      {notes.length > 0 && notes[0].note !== entry.note && (
        <button class="last-note" onClick={() => notesSheet(ex, notes, unit)}>
          <Icon name="note" size={16} />
          <span class="last-note-t"><span class="muted">{daysAgo(notes[0].t)}:</span> {notes[0].note}</span>
          {notes.length > 1 && <span class="last-note-n small">+{notes.length - 1}</span>}
        </button>
      )}
      {targets && (
        <div class={'target t-' + targets.kind}>
          <Icon name={targets.kind === 'up' ? 'arrowUp' : targets.kind === 'deload' ? 'arrowDown' : 'flame'} size={17} stroke={2.2} />
          <span>
            <strong class="num">Target {targetSummary(targets, ex, unit)}</strong>
            <span class="small">{targets.note}</span>
            {targets.aim && <span class="small target-aim">Finish each set with {targets.aim}</span>}
          </span>
        </div>
      )}
      <div class="set-head">
        <span>Set</span><span>Last time</span><span>{wHead}</span><span>{rHead}</span><span class="sr">Done</span>
      </div>
      {entry.sets.map((s, i) => {
        let isPR = false;
        if (s.done && s.type !== 'w' && best && ex.kind === 'weight') {
          const est = e1rm(s.w, effortReps(s), formula) || 0;
          isPR = (s.w || 0) > best.topW + 1e-6 || est > best.e1rm + 1e-6;
        }
        return (
          <Fragment key={s.id}>
            <SetRow set={s} label={labels[i]} ph={phs[i]} last={lastFor[i]} ex={ex} unit={unit} isPR={isPR} scale={scale}
              current={mode === 'active' && i === current}
              onChange={(ns) => setSet(i, ns)}
              onDone={(ns) => { onSetDone(entry, ns); if (effort && ns.type !== 'w' && ex.kind !== 'time') setRateFor(ns.id); }}
              onMenu={() => setMenu(i)} />
            {rateFor === s.id && <EffortPicker value={s.rir} scale={scale} onPick={(rir) => { setSet(i, { ...s, rir }); setRateFor(null); }} onClose={() => setRateFor(null)} />}
          </Fragment>
        );
      })}
      <button class="add-set" onClick={addSet}><Icon name="plus" size={18} /> Add set</button>
    </section>
  );
}

const RIR_OPTS = [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']];
const RPE_OPTS = [[4, '6'], [3, '7'], [2.5, '7.5'], [2, '8'], [1.5, '8.5'], [1, '9'], [0.5, '9.5'], [0, '10']];
// Inline effort rating that opens under a set right after you check it; ignore it and it goes away
function EffortPicker({ value, scale, onPick, onClose }) {
  const opts = scale === 'rpe' ? RPE_OPTS : RIR_OPTS;
  return (
    <div class="effort-pick" role="group" aria-label={scale === 'rpe' ? 'How hard was that set, RPE' : 'Reps left in reserve'}>
      <span class="eff-l">{scale === 'rpe' ? 'RPE' : 'Reps left'}</span>
      <div class="eff-opts">
        {opts.map(([rir, label]) => (
          <button key={label} class={'eff' + (value === rir ? ' on' : '')} aria-pressed={value === rir} onClick={() => onPick(rir)}>{label}</button>
        ))}
      </div>
      <button class="icon-btn sm eff-x" aria-label={value != null ? 'Clear effort' : 'Skip rating'} onClick={() => (value != null ? onPick(null) : onClose())}><Icon name="x" size={16} /></button>
    </div>
  );
}

function notesSheet(ex, notes) {
  openSheet((close) => (
    <div class="sheet-pad">
      <div class="row-between">
        <h3 class="sheet-title">Notes on {ex.name}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <div class="notes-list">
        {notes.map((n) => (
          <div key={n.workoutId} class="notes-item">
            <span class="small muted">{fmtDateShort(n.t)}, {n.workoutName}</span>
            <p>{n.note}</p>
          </div>
        ))}
      </div>
    </div>
  ));
}

export function painSheet(value, onSave) {
  openSheet((close) => (
    <div class="sheet-pad">
      <div class="row-between">
        <h3 class="sheet-title">Pain or discomfort</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <p class="small muted mb-8">How much did this exercise hurt, from 0 (none) to 10 (worst imaginable)?</p>
      <div class="pain-grid" role="group" aria-label="Pain from 0 to 10">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} class={'pain-n' + (value === n ? ' on' : '') + (n > 5 ? ' hi' : n > 2 ? ' mid' : ' lo')} aria-pressed={value === n}
            onClick={() => { onSave(n); close(); }}>{n}</button>
        ))}
      </div>
      <p class="small muted mt-16">
        A common rehab guide: up to 5/10 during exercise can be acceptable if it settles by the next morning and isn’t getting worse week to week. <WhyLink />
      </p>
      {value != null && <button class="btn btn-ghost full mt-8" onClick={() => { onSave(null); close(); }}>Clear pain rating</button>}
    </div>
  ));
}

function noteSheet(value, onSave) {
  openSheet((close) => <NoteForm value={value} close={close} onSave={onSave} />);
}
function NoteForm({ value, close, onSave }) {
  const [v, setV] = useState(value || '');
  return (
    <div class="sheet-pad form">
      <h3 class="sheet-title">Note</h3>
      <textarea rows="4" value={v} onInput={(e) => setV(e.target.value)} placeholder="Seat height, grip, how it felt" />
      <button class="btn btn-primary full" onClick={() => { onSave(v.trim()); close(); }}>Save note</button>
    </div>
  );
}
const REST_OPTIONS = [null, 0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
// What the rest button shows: an exercise's own setting, or the automatic / default value
export function restLabel(rest, ex, target) {
  const st = getState().settings;
  if (rest != null) return rest ? fmtClock(rest) : 'Off';
  return restIsAuto(rest, st) ? `Auto ${fmtClock(autoRest(ex, target))}` : `Default ${st.rest ? fmtClock(st.rest) : 'off'}`;
}
// opts.ex / opts.target describe the exercise so the automatic option can show its value;
// opts.noDefault hides the "use default" option (for the fixed timer in Settings)
export function restSheet(value, onSave, opts = {}) {
  const st = getState().settings;
  const auto = st.restMode !== 'fixed';
  const options = opts.noDefault ? REST_OPTIONS.filter((v) => v != null) : REST_OPTIONS;
  openSheet((close) => (
    <div class="sheet-pad">
      <h3 class="sheet-title">Rest timer</h3>
      <div class="menu">
        {options.map((v) => (
          <button key={String(v)} class={'menu-row' + (value === v ? ' on' : '')} onClick={() => { onSave(v); close(); }}>
            {v == null
              ? (auto
                ? <span>Auto{opts.ex ? ` (${fmtClock(autoRest(opts.ex, opts.target))}, ${autoRestWhy(opts.ex, opts.target)})` : ''}<span class="small muted block">Evidence-based: compound lifts 2:00 (3:00 at 6 reps or fewer), isolation 1:30</span></span>
                : `Default (${st.rest ? fmtClock(st.rest) : 'off'})`)
              : v === 0 ? 'Off' : fmtClock(v)}
            {value === v && <Icon name="check" size={18} class="ml-auto" />}
          </button>
        ))}
      </div>
      {auto && !opts.noDefault && <p class="small muted mt-8">Picking a time here fixes it for this exercise. <Why id="rest" /></p>}
    </div>
  ));
}

// ---------- the editor ----------
export function WorkoutEditor({ mode, workoutId, draft }) {
  const s = useStore();
  const exercises = allExercises(s);
  const { unit, formula } = s.settings;
  const incr = unit === 'lb' ? s.settings.incLb : s.settings.incKg;
  const [local, setLocal] = useState(() => {
    if (mode !== 'edit') return null;
    if (draft) return draft;
    const w = s.workouts.find((x) => x.id === workoutId);
    return w ? JSON.parse(JSON.stringify(w)) : null;
  });
  const isActive = mode === 'active';
  const w = isActive ? s.active : local;
  const [rateFor, setRateFor] = useState(null);
  const scale = s.settings.effortScale || 'rir';
  const setW = isActive ? updateActive : (fn) => setLocal((x) => fn(x));
  useWakeLock(isActive && s.settings.keepAwake);

  // history before this workout, for "Previous" and live PR flags
  const others = useMemo(() => s.workouts.filter((x) => x.id !== (w && w.id) && (!w || x.start < w.start)), [s.workouts, w && w.id, w && w.start]);
  const best = useMemo(() => bestByExercise(others, exercises, formula), [others, exercises, formula]);

  if (!w) {
    return (
      <div class="screen-body pad-16">
        <p class="muted">This workout is no longer here.</p>
        <button class="btn" onClick={pop}>Go back</button>
      </div>
    );
  }

  const setEntries = (fn) => setW((x) => ({ ...x, exercises: fn(x.exercises) }));
  const addExercises = () => openPicker((ids) => setEntries((list) => [...list, ...ids.map((id) => {
    const e = newEntry(id, { sets: 3 });
    if (!isActive) e.sets = e.sets.map((st) => ({ ...st }));
    return e;
  })]));

  const onSetDone = (entry, set) => {
    unlockAudio();
    if (!isActive) return;
    const ex = exerciseOf(exercises, entry.exId);
    const sec = restFor(entry.rest, ex, entry.target, s.settings);
    if (sec > 0) startRest(sec, restIsAuto(entry.rest, s.settings) ? autoRestWhy(ex, entry.target) : null);
  };

  const finish = async () => {
    const pending = w.exercises.reduce((n, e) => n + e.sets.filter((x) => !x.done && (x.r != null || x.t != null)).length, 0);
    const doneCount = w.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
    let keep = false;
    if (pending) {
      const ans = await confirmSheet({
        title: `${plural(pending, 'set')} not checked off`,
        body: 'Sets with reps filled in but not checked can be logged as done or left out.',
        confirm: 'Log them as done', alt: 'Leave them out', cancel: 'Keep training',
      });
      if (!ans) return;
      keep = ans === true;
    } else if (!doneCount) {
      const ans = await confirmSheet({
        title: 'No sets logged yet', body: 'Check off at least one set, or discard this workout.',
        confirm: 'Discard workout', danger: true, cancel: 'Keep training',
      });
      if (ans) { discardActive(); removeScreen('workout'); }
      return;
    }
    const saved = finishActive(keep);
    removeScreen('workout');
    if (saved && saved.exercises.length) showSummary(saved.id);
  };

  const discard = async () => {
    if (await confirmSheet({ title: 'Discard this workout?', body: 'Logged sets from this session will be lost.', confirm: 'Discard workout', danger: true })) {
      discardActive(); removeScreen('workout');
    }
  };

  const saveEdit = () => {
    saveWorkout(w);
    toast('Workout saved');
    pop();
  };
  const del = async () => {
    if (await confirmSheet({ title: 'Delete this workout?', body: 'It will be removed from history and progress charts.', confirm: 'Delete workout', danger: true })) {
      deleteWorkout(w.id); toast('Workout deleted'); pop();
    }
  };
  const isNew = !isActive && !s.workouts.some((x) => x.id === w.id);
  const durMin = w.end ? Math.round((w.end - w.start) / 60000) : 60;

  return (
    <div class={'editor' + (isActive && s.rest ? ' has-rest' : '')}>
      <header class="editor-head">
        {isActive
          ? <button class="icon-btn" aria-label="Minimize workout" onClick={() => removeScreen('workout')}><Icon name="down" size={24} /></button>
          : <button class="icon-btn" aria-label="Back" onClick={pop}><Icon name="left" size={24} /></button>}
        <div class="editor-clock">
          {isActive ? <><Elapsed start={w.start} /><span class="muted small">Started {fmtTime(w.start)}</span></> : <span class="muted">{isNew ? 'Log a past workout' : 'Edit workout'}</span>}
        </div>
        {isActive
          ? <button class="btn btn-primary sm" onClick={finish}>Finish</button>
          : <button class="btn btn-primary sm" onClick={saveEdit}>Save</button>}
      </header>
      <div class="editor-body">
        <input class="title-input" value={w.name} aria-label="Workout name" onInput={(e) => setW((x) => ({ ...x, name: e.target.value }))} />
        {!isActive && (
          <div class="edit-when">
            <label class="field">
              <span>Started</span>
              <input type="datetime-local" value={toLocalInput(w.start)} onChange={(e) => {
                const t = new Date(e.target.value).getTime();
                if (!isNaN(t)) setW((x) => ({ ...x, start: t, end: t + (x.end ? x.end - x.start : 3600000) }));
              }} />
            </label>
            <label class="field">
              <span>Minutes</span>
              <NumInput decimal={false} value={durMin} label="Duration in minutes" onChange={(v) => setW((x) => ({ ...x, end: x.start + (v || 0) * 60000 }))} />
            </label>
          </div>
        )}
        {w.exercises.map((e, i) => {
          const ex = exerciseOf(exercises, e.exId);
          const prev = lastSetsFor(others, e.exId);
          const notes = pastNotes(others, e.exId, isActive ? Infinity : w.start);
          const targets = isActive && s.settings.targets
            ? sessionTargets(prev, ex, e.target, toKg(incr, unit), { deload: w.deload, jumpMode: s.settings.jumpMode, effort: w.effort ? scale : null })
            : null;
          return (
            <ExerciseBlock key={e.id} entry={e} idx={i} count={w.exercises.length} ex={ex} unit={unit} formula={formula}
              prev={prev} best={best[e.exId]} targets={targets} mode={mode} notes={notes}
              effort={!!w.effort} scale={scale} rateFor={rateFor} setRateFor={setRateFor}
              onChange={(ne) => setEntries((list) => list.map((x) => (x.id === e.id ? ne : x)))}
              onRemove={() => setEntries((list) => list.filter((x) => x.id !== e.id))}
              onMove={(d) => setEntries((list) => { const a = [...list]; const j = i + d; [a[i], a[j]] = [a[j], a[i]]; return a; })}
              onReplace={() => openPicker(([id]) => setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, exId: id } : x))), { multi: false, title: 'Replace with' })}
              onSetDone={onSetDone} />
          );
        })}
        {!w.exercises.length && (
          <div class="empty">
            <div class="empty-title">No exercises yet</div>
            <p class="muted">Add the first exercise to start logging sets.</p>
          </div>
        )}
        <button class="btn btn-soft full" onClick={addExercises}><Icon name="plus" size={20} /> Add exercises</button>
        <label class="effort-toggle">
          <span><span>Rate effort after each set</span><span class="small muted">{scale === 'rpe' ? 'RPE' : 'Reps left in reserve'}, optional for every set. <Why id="effort" /></span></span>
          <Toggle on={!!w.effort} onChange={(v) => { setW((x) => ({ ...x, effort: v })); if (!v) setRateFor(null); }} label="Rate effort after each set" />
        </label>
        {isActive && <button class="btn btn-ghost danger full mt-8" onClick={discard}>Discard workout</button>}
        {!isActive && !isNew && <button class="btn btn-ghost danger full mt-8" onClick={del}>Delete workout</button>}
      </div>
      {isActive && <RestBar />}
    </div>
  );
}

export function newPastWorkout(t) {
  const start = t || Date.now() - 3600000;
  return { id: uid(), name: 'Workout', templateId: null, start, end: start + 3600000, note: '', exercises: [] };
}

// ---------- summary after finishing ----------
export function showSummary(workoutId) {
  openSheet((close) => <Summary id={workoutId} close={close} />);
}
function Summary({ id, close }) {
  const s = useStore();
  const exercises = allExercises(s);
  const w = s.workouts.find((x) => x.id === id);
  const prIdx = useMemo(() => buildPRIndex(s.workouts, exercises, s.settings.formula).index, [s.workouts, exercises, s.settings.formula]);
  if (!w) return null;
  const sum = workoutSummary(w, exercises);
  const pr = prIdx[w.id] || { prs: {}, count: 0 };
  const inLib = s.templates.some((t) => t.id === w.templateId);
  return (
    <div class="sheet-pad">
      <p class="muted small">Workout saved</p>
      <h3 class="sheet-title big">{w.name}</h3>
      <div class="stat-row">
        <div><span class="stat-v num">{fmtDuration(sum.duration)}</span><span class="stat-l">Time</span></div>
        <div><span class="stat-v num">{fmtW(sum.vol, s.settings.unit)}</span><span class="stat-l">Volume</span></div>
        <div><span class="stat-v num">{sum.sets}</span><span class="stat-l">Sets</span></div>
      </div>
      {movedLine(sum.vol, w.id) && <p class="moved-sum">You moved about <strong>{movedLine(sum.vol, w.id)}</strong>.</p>}
      {(() => {
        const rs = w.exercises.flatMap((e) => e.sets.filter((x) => isWork(x) && x.rir != null).map((x) => x.rir));
        if (!rs.length) return null;
        const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
        return <p class="moved-sum">Average effort: <strong>{s.settings.effortScale === 'rpe' ? `RPE ${fmtNum(10 - avg, 1)}` : `${fmtNum(avg, 1)} reps left`}</strong> across {plural(rs.length, 'rated set')}.</p>;
      })()}
      {pr.count > 0 && (
        <div class="pr-list">
          <div class="pr-title"><Icon name="medal" size={20} class="pr-ic" /> {plural(pr.count, 'personal record')}</div>
          {Object.entries(pr.prs).map(([exId, labels]) => (
            <div key={exId} class="pr-item"><span>{exerciseOf(exercises, exId).name}</span><span class="muted small">{labels.join(', ')}</span></div>
          ))}
        </div>
      )}
      <div class="stack-8 mt-16">
        <button class="btn btn-primary" onClick={() => { close(); setTab('history'); }}>See it in history</button>
        {!inLib && <button class="btn" onClick={() => { saveTemplate(templateFromWorkout(w)); toast('Saved to your workouts'); close(); }}>Save as a reusable workout</button>}
        <button class="btn btn-ghost" onClick={close}>Done</button>
      </div>
    </div>
  );
}
