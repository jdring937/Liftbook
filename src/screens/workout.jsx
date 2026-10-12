import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  useStore, getState, allExercises, updateActive, finishActive, discardActive, saveWorkout, deleteWorkout,
  newEntry, newSet, startRest, adjustRest, stopRest, saveTemplate, templateFromWorkout,
} from '../store.js';
import { exerciseOf, lastSetsFor, bestByExercise, e1rm, isWork, workoutSummary, buildPRIndex } from '../lib/calc.js';
import { toKg, wNum, fmtW, fmtClock, fmtTime, toLocalInput, fmtDuration, fmtNum, uid, plural, fmtSecs } from '../lib/util.js';
import { Icon, NumInput, openSheet, confirmSheet, toast, push, pop, removeScreen, setTab } from '../ui.jsx';
import { openPicker, musclesText } from './pickers.jsx';

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
          <span class="small">{left <= 0 ? 'Next set' : `Rest ${fmtClock(r.total)}`}</span>
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

// ---------- one set row ----------
function SetRow({ set, label, prev, ex, unit, target, isPR, onChange, onDone, onMenu }) {
  const prevW = prev && prev.w != null ? wNum(prev.w, unit, 2) : null;
  const prevR = prev ? prev.r : null;
  const prevT = prev ? prev.t : null;
  const repsPh = prevR ?? (target && (target.max || target.min)) ?? null;
  const prevText = prev
    ? ex.kind === 'time' ? `${prev.w ? fmtNum(prevW) + ' × ' : ''}${fmtSecs(prev.t)}`
      : ex.kind === 'reps' && !prev.w ? `${prev.r} reps` : `${fmtNum(prevW)} × ${prev.r}`
    : '–';
  const fillPrev = () => {
    if (!prev) return;
    onChange({ ...set, w: prev.w ?? set.w, r: prev.r ?? set.r, t: prev.t ?? set.t });
  };
  const toggle = () => {
    if (set.done) { onChange({ ...set, done: false }); return; }
    const next = { ...set };
    if (next.w == null && prevW != null && ex.kind === 'weight') next.w = toKg(prevW, unit);
    if (ex.kind === 'time') { if (next.t == null) next.t = prevT; if (next.t == null) return; }
    else { if (next.r == null) next.r = repsPh; if (next.r == null) return; }
    if (ex.kind === 'weight' && next.w == null) return;
    next.done = true;
    onChange(next);
    onDone(next);
  };
  return (
    <div class={'set-row' + (set.done ? ' done' : '') + (set.type !== 'n' ? ' t-' + set.type : '')}>
      <button class="set-num num" onClick={onMenu} aria-label={`Set ${label} options`}>{label}</button>
      <button class="set-prev num" onClick={fillPrev} disabled={!prev}>
        {isPR ? <Icon name="medal" size={15} class="pr-ic" /> : null}{prevText}
      </button>
      <NumInput label="Weight" value={set.w == null ? null : wNum(set.w, unit, 2)} placeholder={ex.kind === 'weight' ? prevW : (prevW || '')}
        onChange={(v) => onChange({ ...set, w: toKg(v, unit) })} />
      {ex.kind === 'time'
        ? <NumInput label="Seconds" decimal={false} value={set.t} placeholder={prevT} onChange={(v) => onChange({ ...set, t: v })} />
        : <NumInput label="Reps" decimal={false} value={set.r} placeholder={repsPh} onChange={(v) => onChange({ ...set, r: v })} />}
      <button class={'set-check' + (set.done ? ' on' : '')} aria-pressed={set.done} aria-label={set.done ? 'Mark set not done' : 'Mark set done'} onClick={toggle}>
        <Icon name="check" size={20} stroke={2.6} />
      </button>
    </div>
  );
}

// ---------- one exercise block ----------
function ExerciseBlock({ entry, idx, count, ex, unit, prev, best, formula, mode, incr, onChange, onRemove, onMove, onReplace, onSetDone }) {
  const work = prev ? prev.sets : [];
  let normal = 0;
  const labels = entry.sets.map((s) => (s.type === 'n' ? String(++normal) : TYPE_LABEL[s.type]));

  // double progression: every work set reached the top of the rep range last time
  let suggest = null;
  if (ex.kind === 'weight' && entry.target && entry.target.max && work.length) {
    const top = Math.max(...work.map((s) => s.w || 0));
    const topSets = work.filter((s) => s.type !== 'w' && s.w === top);
    if (top > 0 && topSets.length && topSets.every((s) => (s.r || 0) >= entry.target.max)) {
      const next = wNum(top, unit, 2) + incr;
      if (!entry.sets.some((s) => s.w != null && wNum(s.w, unit, 2) >= next)) suggest = next;
    }
  }

  const setSet = (i, ns) => onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? ns : s)) });
  const addSet = () => {
    const last = entry.sets[entry.sets.length - 1];
    onChange({ ...entry, sets: [...entry.sets, newSet({ w: last ? last.w : null, type: last && last.type === 'w' ? 'n' : 'n' })] });
  };
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
          <button class="menu-row" onClick={() => { close(); push('exercise', { id: ex.id }); }}><Icon name="progress" size={20} /> History and records</button>
          <button class="menu-row" onClick={() => { close(); onReplace(); }}><Icon name="swap" size={20} /> Replace exercise</button>
          <button class="menu-row" onClick={() => { close(); noteSheet(entry.note, (note) => onChange({ ...entry, note })); }}><Icon name="note" size={20} /> {entry.note ? 'Edit note' : 'Add note'}</button>
          {mode === 'active' && (
            <button class="menu-row" onClick={() => { close(); restSheet(entry.rest, (rest) => onChange({ ...entry, rest })); }}>
              <Icon name="timer" size={20} /> Rest timer <span class="muted ml-auto">{entry.rest == null ? 'Default' : entry.rest ? fmtClock(entry.rest) : 'Off'}</span>
            </button>
          )}
          {idx > 0 && <button class="menu-row" onClick={() => { onMove(-1); close(); }}><Icon name="arrowUp" size={20} /> Move up</button>}
          {idx < count - 1 && <button class="menu-row" onClick={() => { onMove(1); close(); }}><Icon name="arrowDown" size={20} /> Move down</button>}
          <button class="menu-row danger" onClick={() => { onRemove(); close(); }}><Icon name="trash" size={20} /> Remove exercise</button>
        </div>
      </div>
    ));
  };

  const wHead = ex.kind === 'weight' ? unit : `+${unit}`;
  const rHead = ex.kind === 'time' ? 'Sec' : 'Reps';
  return (
    <section class="ex-block">
      <div class="ex-head">
        <button class="ex-name" onClick={() => push('exercise', { id: ex.id })}>
          <span>{ex.name}</span>
          <span class="muted small">{entry.target && entry.target.max ? `${entry.target.min && entry.target.min !== entry.target.max ? entry.target.min + '–' : ''}${entry.target.max} reps` : musclesText(ex)}</span>
        </button>
        <button class="icon-btn" aria-label={`${ex.name} options`} onClick={menu}><Icon name="more" /></button>
      </div>
      {entry.note && <p class="ex-note">{entry.note}</p>}
      {suggest != null && (
        <button class="suggest" onClick={() => onChange({ ...entry, sets: entry.sets.map((s) => (s.type === 'w' || s.done ? s : { ...s, w: toKg(suggest, unit) })) })}>
          <Icon name="arrowUp" size={16} stroke={2.4} />
          <span>You hit {entry.target.max} reps on every set last time. Use {fmtNum(suggest, 2)} {unit}</span>
        </button>
      )}
      <div class="set-head">
        <span>Set</span><span>Previous</span><span>{wHead}</span><span>{rHead}</span><span class="sr">Done</span>
      </div>
      {entry.sets.map((s, i) => {
        const p = work[i] || null;
        let isPR = false;
        if (s.done && s.type !== 'w' && best && ex.kind === 'weight') {
          const est = e1rm(s.w, s.r, formula) || 0;
          isPR = (s.w || 0) > best.topW + 1e-6 || est > best.e1rm + 1e-6;
        }
        return (
          <SetRow key={s.id} set={s} label={labels[i]} prev={p} ex={ex} unit={unit} target={entry.target} isPR={isPR}
            onChange={(ns) => setSet(i, ns)} onDone={(ns) => onSetDone(entry, ns)} onMenu={() => setMenu(i)} />
        );
      })}
      <button class="add-set" onClick={addSet}><Icon name="plus" size={18} /> Add set</button>
    </section>
  );
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
export function restSheet(value, onSave) {
  openSheet((close) => (
    <div class="sheet-pad">
      <h3 class="sheet-title">Rest timer</h3>
      <div class="menu">
        {REST_OPTIONS.map((v) => (
          <button key={String(v)} class={'menu-row' + (value === v ? ' on' : '')} onClick={() => { onSave(v); close(); }}>
            {v == null ? `Default (${fmtClock(getState().settings.rest)})` : v === 0 ? 'Off' : fmtClock(v)}
            {value === v && <Icon name="check" size={18} class="ml-auto" />}
          </button>
        ))}
      </div>
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
    const sec = entry.rest == null ? s.settings.rest : entry.rest;
    if (sec > 0) startRest(sec);
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
          return (
            <ExerciseBlock key={e.id} entry={e} idx={i} count={w.exercises.length} ex={ex} unit={unit} formula={formula} incr={incr}
              prev={prev} best={best[e.exId]} mode={mode}
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
