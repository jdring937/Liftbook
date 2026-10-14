import { useMemo, useState } from 'preact/hooks';
import {
  useStore, allExercises, saveTemplate, deleteTemplate, saveProgram, deleteProgram, setActiveProgram, setProgramPos, programNext, TEMPLATE_COLORS,
} from '../store.js';
import { exerciseOf } from '../lib/calc.js';
import { plural, fmtClock } from '../lib/util.js';
import { Icon, Header, Seg, Chips, Stepper, NumInput, push, pop, openSheet, confirmSheet, toast, plateVar, Empty } from '../ui.jsx';
import { openPicker, useExerciseList, musclesText, ExerciseForm } from './pickers.jsx';
import { TemplateRow, templateSheet, begin } from './train.jsx';
import { restSheet, restLabel } from './workout.jsx';
import { MUSCLE_FILTERS } from '../data/exercises.js';
import { ExThumb } from '../components/preview.jsx';
import { Coverage } from '../components/coverage.jsx';
import { programSessions, templateSessions } from '../lib/coverage.js';

const mem = { seg: 'workouts', q: '', filter: null };

function ExerciseLibrary() {
  const [q, setQ] = useState(mem.q);
  const [filter, setFilter] = useState(mem.filter);
  const { list } = useExerciseList(q, filter);
  return (
    <>
      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder={`Search ${list.length} exercises`} value={q} onInput={(e) => { mem.q = e.target.value; setQ(e.target.value); }} />
      </label>
      <Chips options={[[null, 'All'], ...MUSCLE_FILTERS.map(([k]) => [k, k])]} value={filter} onChange={(v) => { mem.filter = v; setFilter(v); }} class="chips-scroll" />
      <button class="btn btn-soft full" onClick={() => openSheet((c) => <ExerciseForm initial={{ name: q }} close={c} />, { tall: true })}>
        <Icon name="plus" size={20} /> Create an exercise
      </button>
      <div class="list">
        {list.map((ex) => (
          <button key={ex.id} class="lib-row" onClick={() => push('exercise', { id: ex.id })}>
            <ExThumb ex={ex} size="sm" />
            <span class="pick-main">
              <span class="pick-name">{ex.name}{ex.custom && <span class="tag">Custom</span>}</span>
              <span class="muted small">{musclesText(ex)}</span>
            </span>
            <Icon name="right" size={18} class="muted" />
          </button>
        ))}
      </div>
    </>
  );
}

export function PlansScreen() {
  const s = useStore();
  const exercises = allExercises(s);
  const [seg, setSeg] = useState(mem.seg);
  return (
    <div class="page">
      <div class="page-head"><h1 class="h-page">Plans</h1></div>
      <Seg options={[['workouts', 'Workouts'], ['programs', 'Programs'], ['exercises', 'Exercises']]} value={seg} onChange={(v) => { mem.seg = v; setSeg(v); }} />
      <div class="stack-12 mt-16">
        {seg === 'workouts' && (
          <>
            <div class="btn-pair">
              <button class="btn btn-soft" onClick={() => push('template', { id: null })}><Icon name="plus" size={20} /> New workout</button>
              <button class="btn btn-soft" onClick={() => push('import')}><Icon name="import" size={20} /> Import</button>
            </div>
            <div class="list">
              {s.templates.map((t) => (
                <TemplateRow key={t.id} t={t} exercises={exercises} workouts={s.workouts} onOpen={() => push('template', { id: t.id })}
                  action={<button class="icon-btn" aria-label={`${t.name} options`} onClick={() => templateSheet(t)}><Icon name="more" /></button>} />
              ))}
            </div>
            {!s.templates.length && <Empty title="No workouts saved" body="A workout is a list of exercises with target sets and reps that you can start any day. Already have routines in Boostcamp? Copy one as text and tap Import." />}
          </>
        )}
        {seg === 'programs' && (
          <>
            <button class="btn btn-soft full" onClick={() => push('programEdit', { id: null })} disabled={!s.templates.length}>
              <Icon name="plus" size={20} /> New program
            </button>
            {!s.templates.length && <p class="small muted">Create a workout first. Programs are built from your workouts.</p>}
            <div class="list">
              {s.programs.map((p) => {
                const n = programNext(p);
                const total = p.days.length * p.weeks;
                return (
                  <button key={p.id} class="prog-row" onClick={() => push('program', { id: p.id })}>
                    <span class="pick-main">
                      <span class="pick-name">{p.name}{s.activeProgram === p.id && <span class="tag on">Active</span>}</span>
                      <span class="small muted">{plural(p.days.length, 'day')} a week for {plural(p.weeks, 'week')}</span>
                    </span>
                    <span class="prog-pct num">{total ? Math.round(((n && n.pos) || 0) / total * 100) : 0}%</span>
                  </button>
                );
              })}
            </div>
            {!s.programs.length && s.templates.length > 0 && (
              <Empty title="No programs yet" body="A program strings your workouts into a weekly rotation and tells you which day is next." />
            )}
          </>
        )}
        {seg === 'exercises' && <ExerciseLibrary />}
      </div>
    </div>
  );
}

// ---------- template editor ----------
export function TemplateEditor({ id }) {
  const s = useStore();
  const exercises = allExercises(s);
  const existing = id && s.templates.find((t) => t.id === id);
  const [t, setT] = useState(() => (existing ? JSON.parse(JSON.stringify(existing)) : { name: '', color: 'blue', note: '', items: [] }));
  const setItem = (i, patch) => setT((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const move = (i, d) => setT((x) => { const a = [...x.items]; [a[i], a[i + d]] = [a[i + d], a[i]]; return { ...x, items: a }; });
  const [perWeek, setPerWeek] = useState(1);
  const sessions = useMemo(() => templateSessions(t, perWeek), [t.items, perWeek]);
  const save = () => {
    if (!t.name.trim()) { toast('Give the workout a name'); return; }
    saveTemplate({ ...t, name: t.name.trim() });
    toast(existing ? 'Workout saved' : 'Workout created');
    pop();
  };
  return (
    <div class="screen-body">
      <Header title={existing ? 'Edit workout' : 'New workout'} onBack={pop} right={<button class="btn btn-primary sm" onClick={save}>Save</button>} />
      <div class="pad-16 stack-16">
        <input class="title-input" placeholder="Workout name" value={t.name} onInput={(e) => setT((x) => ({ ...x, name: e.target.value }))} aria-label="Workout name" />
        <div class="field">
          <span>Color</span>
          <div class="swatches">
            {TEMPLATE_COLORS.map((c) => (
              <button key={c} class={'swatch' + (t.color === c ? ' on' : '')} style={{ background: plateVar(c) }} aria-label={c} aria-pressed={t.color === c}
                onClick={() => setT((x) => ({ ...x, color: c }))} />
            ))}
          </div>
        </div>
        <div class="field">
          <span>Rate effort (RIR/RPE) <em class="muted">default: {s.settings.effortDefault ? 'on' : 'off'}</em></span>
          <Seg options={[['default', 'Default'], ['on', 'On'], ['off', 'Off']]} value={t.effort == null ? 'default' : t.effort ? 'on' : 'off'}
            onChange={(v) => setT((x) => ({ ...x, effort: v === 'default' ? null : v === 'on' }))} />
        </div>
        <div class="stack-12">
          {t.items.map((it, i) => {
            const ex = exerciseOf(exercises, it.exId);
            return (
              <div key={i} class="ti">
                <div class="ti-head">
                  <span class="ti-name">{ex.name}</span>
                  <div class="ti-actions">
                    {i > 0 && <button class="icon-btn sm" aria-label="Move up" onClick={() => move(i, -1)}><Icon name="arrowUp" size={18} /></button>}
                    {i < t.items.length - 1 && <button class="icon-btn sm" aria-label="Move down" onClick={() => move(i, 1)}><Icon name="arrowDown" size={18} /></button>}
                    <button class="icon-btn sm danger" aria-label="Remove" onClick={() => setT((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}><Icon name="trash" size={18} /></button>
                  </div>
                </div>
                <div class="ti-grid">
                  <label class="mini"><span>Sets</span><Stepper value={it.sets} min={1} max={12} onChange={(v) => setItem(i, { sets: v })} label="Sets" /></label>
                  {ex.kind !== 'time' && (
                    <label class="mini"><span>Reps</span>
                      <span class="reps-range">
                        <NumInput decimal={false} value={it.min} label="Minimum reps" onChange={(v) => setItem(i, { min: v })} />
                        <span class="muted">to</span>
                        <NumInput decimal={false} value={it.max} label="Maximum reps" onChange={(v) => setItem(i, { max: v })} />
                      </span>
                    </label>
                  )}
                  <button class="mini rest-pick" onClick={() => restSheet(it.rest, (v) => setItem(i, { rest: v }), { ex, target: it })}>
                    <span>Rest</span><strong class="num">{restLabel(it.rest, ex, it)}</strong>
                  </button>
                </div>
                <input class="ti-note" type="text" placeholder="Note, e.g. RPE 8 or seat 4" value={it.note || ''} aria-label={`Note for ${ex.name}`}
                  onInput={(e) => setItem(i, { note: e.target.value })} />
              </div>
            );
          })}
        </div>
        {!t.items.length && <p class="muted">Add the exercises for this workout. Set a rep range and the app suggests a heavier weight once you hit the top of it on every set.</p>}
        <button class="btn btn-soft full" onClick={() => openPicker((ids) => setT((x) => ({ ...x, items: [...x.items, ...ids.map((exId) => ({ exId, sets: 3, min: 8, max: 12, rest: null }))] })))}>
          <Icon name="plus" size={20} /> Add exercises
        </button>
        {t.items.length > 0 && (
          <Coverage sessions={sessions} exercises={exercises} sex={s.settings.bodySex}>
            <div class="row-between cov-freq">
              <span class="small muted">If you do this workout</span>
              <Stepper value={perWeek} min={1} max={4} onChange={setPerWeek} fmt={(v) => (v === 1 ? 'once a week' : v === 2 ? 'twice a week' : `${v}× a week`)} label="Times per week" />
            </div>
          </Coverage>
        )}
        {existing && (
          <>
            <button class="btn btn-primary full" onClick={() => { saveTemplate({ ...t, name: t.name.trim() || existing.name }); pop(); begin({ template: { ...t, id: existing.id } }); }}>
              <Icon name="play" size={18} fill="currentColor" stroke={0} /> Save and start
            </button>
            <button class="btn btn-ghost danger full" onClick={async () => {
              if (await confirmSheet({ title: `Delete “${existing.name}”?`, body: 'Past sessions stay in your history.', confirm: 'Delete workout', danger: true })) { deleteTemplate(existing.id); pop(); }
            }}>Delete workout</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- program detail ----------
export function ProgramScreen({ id }) {
  const s = useStore();
  const p = s.programs.find((x) => x.id === id);
  if (!p) return <div class="screen-body"><Header title="Program" onBack={pop} /><p class="muted pad-16">This program was deleted.</p></div>;
  const n = programNext(p);
  const pos = (n && n.pos) || 0;
  const tName = (tid) => { const t = s.templates.find((x) => x.id === tid); return t ? t.name : 'Missing workout'; };
  const tColor = (tid) => { const t = s.templates.find((x) => x.id === tid); return t ? t.color : null; };
  const nextT = n && !n.done ? s.templates.find((x) => x.id === n.templateId) : null;
  const isActive = s.activeProgram === p.id;
  return (
    <div class="screen-body">
      <Header title={p.name} onBack={pop} sub={`${plural(p.days.length, 'day')} a week for ${plural(p.weeks, 'week')}`}
        right={<button class="link" onClick={() => push('programEdit', { id: p.id })}>Edit</button>} />
      <div class="pad-16 stack-16">
        {!isActive && <button class="btn full" onClick={() => { setActiveProgram(p.id); toast('Program set as active'); }}>Make this my active program</button>}
        {nextT && (
          <section class="next-card" style={{ '--plate': plateVar(nextT.color) }}>
            <span class="muted small">Up next: week {n.week}, day {n.day}</span>
            <h2 class="next-name">{nextT.name}</h2>
            <button class="btn btn-primary full" onClick={() => { if (!isActive) setActiveProgram(p.id); begin({ template: nextT, programId: p.id, programPos: n.pos }); }}>
              <Icon name="play" size={18} fill="currentColor" stroke={0} /> Start day {n.day}
            </button>
          </section>
        )}
        {n && n.done && <p class="muted">All {n.total} sessions done.</p>}
        <div class="prog-grid" style={{ '--days': p.days.length }}>
          {Array.from({ length: p.weeks }, (_, wk) => (
            <div key={wk} class="pg-week">
              <span class="pg-wl small muted">Week {wk + 1}</span>
              <div class="pg-days">
                {p.days.map((tid, d) => {
                  const k = wk * p.days.length + d;
                  const state = k < pos ? 'done' : k === pos ? 'next' : '';
                  return (
                    <button key={d} class={'pg-cell ' + state} style={{ '--plate': plateVar(tColor(tid)) }}
                      aria-label={`Week ${wk + 1} day ${d + 1}, ${tName(tid)}${state === 'done' ? ', done' : state === 'next' ? ', next' : ''}`}
                      onClick={async () => {
                        if (k === pos) return;
                        if (await confirmSheet({ title: `Move to week ${wk + 1}, day ${d + 1}?`, body: 'Use this to skip ahead or repeat a day. Your logged workouts don’t change.', confirm: 'Move here' })) setProgramPos(p.id, k);
                      }}>
                      {state === 'done' ? <Icon name="check" size={16} stroke={2.6} /> : <span class="num">{d + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <ol class="tpl-list">
          {p.days.map((tid, d) => <li key={d}><span>Day {d + 1}</span><span class="muted">{tName(tid)}</span></li>)}
        </ol>
        <ProgramCoverage p={p} s={s} />
        {pos > 0 && <button class="btn full" onClick={async () => { if (await confirmSheet({ title: 'Restart from week 1?', confirm: 'Restart program' })) setProgramPos(p.id, 0); }}>Restart from week 1</button>}
        {isActive && <button class="btn btn-ghost full" onClick={() => setActiveProgram(null)}>Stop following this program</button>}
        <button class="btn btn-ghost danger full" onClick={async () => {
          if (await confirmSheet({ title: `Delete “${p.name}”?`, body: 'Your logged workouts stay in history.', confirm: 'Delete program', danger: true })) { deleteProgram(p.id); pop(); }
        }}>Delete program</button>
      </div>
    </div>
  );
}

function ProgramCoverage({ p, s }) {
  const exercises = allExercises(s);
  const sessions = useMemo(() => programSessions(p, s.templates), [p.days, s.templates]);
  if (!sessions.length) return null;
  return <Coverage sessions={sessions} exercises={exercises} sex={s.settings.bodySex} note={`One week of this program: ${plural(sessions.length, 'day')}.`} />;
}

function pickTemplate(templates, onPick) {
  openSheet((close) => (
    <div class="sheet-pad">
      <h3 class="sheet-title">Pick a workout</h3>
      <div class="menu">
        {templates.map((t) => (
          <button key={t.id} class="menu-row" onClick={() => { onPick(t.id); close(); }}>
            <span class="tpl-plate sm" style={{ background: plateVar(t.color) }} />{t.name}
          </button>
        ))}
      </div>
    </div>
  ));
}

export function ProgramEditor({ id }) {
  const s = useStore();
  const existing = id && s.programs.find((p) => p.id === id);
  const [p, setP] = useState(() => (existing ? { ...existing, days: [...existing.days] } : { name: '', weeks: 8, days: [] }));
  const tName = (tid) => { const t = s.templates.find((x) => x.id === tid); return t ? t.name : 'Missing workout'; };
  const save = () => {
    if (!p.name.trim()) { toast('Give the program a name'); return; }
    if (!p.days.length) { toast('Add at least one day'); return; }
    const nid = saveProgram({ ...p, name: p.name.trim() });
    toast(existing ? 'Program saved' : 'Program created');
    pop();
    if (!existing) setTimeout(() => push('program', { id: nid }), 30);
  };
  const move = (i, d) => setP((x) => { const a = [...x.days]; [a[i], a[i + d]] = [a[i + d], a[i]]; return { ...x, days: a }; });
  return (
    <div class="screen-body">
      <Header title={existing ? 'Edit program' : 'New program'} onBack={pop} right={<button class="btn btn-primary sm" onClick={save}>Save</button>} />
      <div class="pad-16 stack-16">
        <input class="title-input" placeholder="Program name" value={p.name} onInput={(e) => setP((x) => ({ ...x, name: e.target.value }))} aria-label="Program name" />
        <div class="field row-between">
          <span>Length</span>
          <Stepper value={p.weeks} min={1} max={52} onChange={(v) => setP((x) => ({ ...x, weeks: v }))} fmt={(v) => plural(v, 'week')} label="Weeks" />
        </div>
        <div class="field">
          <span>Days in each week, in order</span>
          <div class="list">
            {p.days.map((tid, i) => (
              <div key={i} class="day-row">
                <span class="day-n num">{i + 1}</span>
                <button class="day-t" onClick={() => pickTemplate(s.templates, (nid) => setP((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? nid : d)) })))}>{tName(tid)}</button>
                {i > 0 && <button class="icon-btn sm" aria-label="Move up" onClick={() => move(i, -1)}><Icon name="arrowUp" size={18} /></button>}
                {i < p.days.length - 1 && <button class="icon-btn sm" aria-label="Move down" onClick={() => move(i, 1)}><Icon name="arrowDown" size={18} /></button>}
                <button class="icon-btn sm danger" aria-label="Remove day" onClick={() => setP((x) => ({ ...x, days: x.days.filter((_, j) => j !== i) }))}><Icon name="trash" size={18} /></button>
              </div>
            ))}
          </div>
        </div>
        <button class="btn btn-soft full" onClick={() => pickTemplate(s.templates, (tid) => setP((x) => ({ ...x, days: [...x.days, tid] })))}>
          <Icon name="plus" size={20} /> Add a day
        </button>
        {existing && <p class="small muted">Changing the days keeps your place in the program.</p>}
        {p.days.length > 0 && <ProgramCoverage p={p} s={s} />}
      </div>
    </div>
  );
}
