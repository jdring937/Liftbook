import { useMemo } from 'preact/hooks';
import { useStore, getState, allExercises, startWorkout, programNext, deleteTemplate, saveTemplate } from '../store.js';
import { exerciseOf, workoutSummary } from '../lib/calc.js';
import { startOfWeek, addDays, startOfDay, daysAgo, fmtW, fmtTime, plural } from '../lib/util.js';
import { Icon, push, openSheet, confirmSheet, toast, plateVar } from '../ui.jsx';
import { unlockAudio } from './workout.jsx';
import { timeboxSheet, useEstimate, minText } from '../components/timebox.jsx';
import { Insights } from '../components/insights.jsx';
import { GoalsSummary } from './goals.jsx';
import { openProgress } from './progress.jsx';

export function begin(opts) {
  unlockAudio();
  const s = getState();
  if (s.active) {
    confirmSheet({
      title: 'A workout is already running',
      body: `Finish or discard “${s.active.name}” before starting another.`,
      confirm: 'Open current workout', cancel: 'Close',
    }).then((ok) => ok && push('workout'));
    return;
  }
  startWorkout(opts);
  push('workout');
}

function lastDone(workouts, templateId) {
  let t = 0;
  for (const w of workouts) if (w.templateId === templateId) t = Math.max(t, w.start);
  return t || null;
}

export function TemplateRow({ t, exercises, workouts, onOpen, action }) {
  const names = t.items.map((i) => exerciseOf(exercises, i.exId).name);
  const last = lastDone(workouts, t.id);
  return (
    <div class="tpl-row">
      <button class="tpl-main" onClick={onOpen}>
        <span class="tpl-plate" style={{ background: plateVar(t.color) }} />
        <span class="tpl-text">
          <span class="tpl-name">{t.name}</span>
          <span class="muted small clamp">{names.length ? names.join(', ') : 'No exercises yet'}</span>
          <span class="tpl-meta small">{plural(t.items.length, 'exercise')}{last ? `, last done ${daysAgo(last).toLowerCase()}` : ''}</span>
        </span>
      </button>
      {action}
    </div>
  );
}

export function templateSheet(t) {
  openSheet((close) => <TemplateSheet t={t} close={close} />);
}
function TemplateSheet({ t, close }) {
  const s = useStore();
  const exercises = allExercises(s);
  const { sec } = useEstimate(t.items);
  return (
    <div class="sheet-pad">
      <h3 class="sheet-title">{t.name}</h3>
      {t.items.length > 0 && <p class="small muted tpl-est"><Icon name="timer" size={15} /> About {minText(sec)}</p>}
      <ol class="tpl-list">
        {t.items.map((i, k) => (
          <li key={k}>
            <span>{exerciseOf(exercises, i.exId).name}</span>
            <span class="muted num">{i.sets} × {i.min && i.min !== i.max ? `${i.min}–${i.max}` : i.max || i.min || '–'}</span>
          </li>
        ))}
      </ol>
      <div class="stack-8">
        <button class="btn btn-primary" onClick={() => { close(); begin({ template: t }); }}><Icon name="play" size={18} fill="currentColor" stroke={0} /> Start workout</button>
        {t.items.length > 0 && <button class="btn" onClick={() => { close(); timeboxSheet(t, (tt) => begin({ template: tt })); }}><Icon name="timer" size={18} /> Short on time? Fit it in</button>}
        <button class="btn" onClick={() => { close(); push('template', { id: t.id }); }}>Edit</button>
        <button class="btn" onClick={() => { saveTemplate({ ...t, id: null, name: t.name + ' copy', createdAt: null }); toast('Workout duplicated'); close(); }}>Duplicate</button>
        <button class="btn btn-ghost danger" onClick={async () => {
          close();
          if (await confirmSheet({ title: `Delete “${t.name}”?`, body: 'Past sessions stay in your history.', confirm: 'Delete workout', danger: true })) { deleteTemplate(t.id); toast('Workout deleted'); }
        }}>Delete</button>
      </div>
    </div>
  );
}

function WeekStrip({ workouts, weekStart, unit, exercises }) {
  const now = Date.now();
  const ws = startOfWeek(now, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const trained = new Set(workouts.filter((w) => w.start >= ws).map((w) => startOfDay(w.start)));
  const thisWeek = workouts.filter((w) => w.start >= ws);
  const sum = thisWeek.reduce((a, w) => { const x = workoutSummary(w, exercises); a.sets += x.sets; a.vol += x.vol; return a; }, { sets: 0, vol: 0 });
  const today = startOfDay(now);
  return (
    <div class="week">
      <div class="week-days">
        {days.map((d) => (
          <div key={d} class={'wd' + (trained.has(d) ? ' on' : '') + (d === today ? ' today' : '')}>
            <span class="wd-l">{new Date(d).toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
            <span class="wd-dot" />
          </div>
        ))}
      </div>
      <p class="week-sum">
        {thisWeek.length
          ? <>This week: <strong>{plural(thisWeek.length, 'workout')}</strong>, <strong>{plural(sum.sets, 'set')}</strong>, <strong>{fmtW(sum.vol, unit)}</strong></>
          : 'Nothing logged this week yet.'}
      </p>
    </div>
  );
}

export function TrainScreen() {
  const s = useStore();
  const exercises = allExercises(s);
  const program = s.programs.find((p) => p.id === s.activeProgram);
  const next = program ? programNext(program) : null;
  const nextT = next && !next.done ? s.templates.find((t) => t.id === next.templateId) : null;
  const sorted = useMemo(() => [...s.templates], [s.templates]);

  return (
    <div class="page">
      <div class="page-head">
        <h1 class="h-page">Train</h1>
        <button class="icon-btn" aria-label="Settings" onClick={() => push('settings')}><Icon name="gear" size={24} /></button>
      </div>

      {s.active && (
        <button class="resume" onClick={() => push('workout')}>
          <span class="resume-dot" />
          <span class="resume-text">
            <span class="resume-name">{s.active.name}</span>
            <span class="small">In progress since {fmtTime(s.active.start)}</span>
          </span>
          <span class="resume-go">Resume</span>
        </button>
      )}

      {program && (
        <section class="next-card" style={{ '--plate': plateVar(nextT && nextT.color) }}>
          <div class="next-top">
            <button class="next-prog" onClick={() => push('program', { id: program.id })}>{program.name}</button>
            {next && !next.done && <span class="muted small num">Week {next.week} of {program.weeks}, day {next.day} of {program.days.length}</span>}
          </div>
          {next && next.done ? (
            <>
              <h2 class="next-name">Program complete</h2>
              <p class="muted">You finished all {next.total} sessions. Restart it or pick another program.</p>
              <button class="btn" onClick={() => push('program', { id: program.id })}>Open program</button>
            </>
          ) : nextT ? (
            <>
              <h2 class="next-name">{nextT.name}</h2>
              <p class="muted small clamp">{nextT.items.map((i) => exerciseOf(exercises, i.exId).name).join(', ')}</p>
              <button class="btn btn-primary full" onClick={() => begin({ template: nextT, programId: program.id, programPos: next.pos })}>
                <Icon name="play" size={18} fill="currentColor" stroke={0} /> Start day {next.day}
              </button>
              <button class="link next-fit" onClick={() => timeboxSheet(nextT, (tt) => begin({ template: tt, programId: program.id, programPos: next.pos }))}>
                <Icon name="timer" size={17} /> Short on time? Fit it in
              </button>
            </>
          ) : (
            <p class="muted">The workout for this day was deleted. Edit the program to pick another.</p>
          )}
        </section>
      )}

      <Insights s={s} exercises={exercises} max={1} onMore={() => openProgress('goals')} />
      <WeekStrip workouts={s.workouts} weekStart={s.settings.weekStart} unit={s.settings.unit} exercises={exercises} />

      <div class="sec-head">
        <h2 class="h-sec">Your workouts</h2>
        <button class="link" onClick={() => push('template', { id: null })}><Icon name="plus" size={18} /> New</button>
      </div>
      <div class="list">
        {sorted.map((t) => (
          <TemplateRow key={t.id} t={t} exercises={exercises} workouts={s.workouts} onOpen={() => templateSheet(t)}
            action={<button class="play" aria-label={`Start ${t.name}`} onClick={() => begin({ template: t })}><Icon name="play" size={18} fill="currentColor" stroke={0} /></button>} />
        ))}
      </div>
      {!sorted.length && (
        <div class="pad-16">
          <p class="muted">Build a workout once, then start it here in one tap.</p>
          <button class="link" onClick={() => push('import')}><Icon name="import" size={18} /> Import workouts from Boostcamp</button>
        </div>
      )}
      <button class="btn btn-soft full mt-16" onClick={() => begin({})}><Icon name="plus" size={20} /> Start an empty workout</button>
      <GoalsSummary s={s} exercises={exercises} />
    </div>
  );
}
