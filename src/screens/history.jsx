import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises, deleteWorkout, saveTemplate, templateFromWorkout } from '../store.js';
import { exerciseOf, workoutSummary, buildPRIndex, entryStats } from '../lib/calc.js';
import { startOfMonth, addMonths, addDays, startOfDay, fmtMonth, fmtDateLong, fmtDuration, fmtW, fmtNum, wNum, fmtSecs, plural } from '../lib/util.js';
import { Icon, push, openSheet, confirmSheet, toast, Empty } from '../ui.jsx';
import { newPastWorkout } from './workout.jsx';
import { MovedCard } from '../components/moved.jsx';

export function bestSetText(st, ex, unit) {
  const b = st.bestSet;
  if (!b) return '–';
  if (ex.kind === 'time') return (b.w ? `${fmtNum(wNum(b.w, unit, 2))} ${unit} × ` : '') + fmtSecs(b.t);
  if (ex.kind === 'reps') return b.w ? `+${fmtNum(wNum(b.w, unit, 2))} ${unit} × ${b.r}` : `${b.r}`;
  return `${fmtNum(wNum(b.w, unit, 2))} ${unit} × ${b.r}`;
}

export function WorkoutCard({ w, exercises, unit, formula, pr }) {
  const sum = workoutSummary(w, exercises);
  const groups = [];
  const seen = new Map();
  for (const e of w.exercises) {
    if (!seen.has(e.exId)) { seen.set(e.exId, []); groups.push(e.exId); }
    seen.get(e.exId).push(...e.sets);
  }
  const menu = () => openSheet((close) => (
    <div class="sheet-pad">
      <h3 class="sheet-title">{w.name}</h3>
      <div class="menu">
        <button class="menu-row" onClick={() => { close(); push('editWorkout', { id: w.id }); }}><Icon name="edit" size={20} /> Edit workout</button>
        <button class="menu-row" onClick={() => { close(); saveTemplate(templateFromWorkout(w)); toast('Saved to your workouts'); }}><Icon name="copy" size={20} /> Save as a reusable workout</button>
        <button class="menu-row danger" onClick={async () => {
          close();
          if (await confirmSheet({ title: 'Delete this workout?', body: 'It will be removed from history and progress charts.', confirm: 'Delete workout', danger: true })) { deleteWorkout(w.id); toast('Workout deleted'); }
        }}><Icon name="trash" size={20} /> Delete workout</button>
      </div>
    </div>
  ));
  return (
    <article class="w-card" id={'w-' + w.id}>
      <div class="w-head">
        <button class="w-title" onClick={() => push('editWorkout', { id: w.id })}>
          <span class="w-date">{fmtDateLong(w.start)}</span>
          <span class="w-name">{w.name}</span>
        </button>
        <button class="icon-btn" aria-label="Workout options" onClick={menu}><Icon name="more" /></button>
      </div>
      <div class="w-stats small">
        {sum.duration ? <span>{fmtDuration(sum.duration)}</span> : null}
        <span>{fmtW(sum.vol, unit)}</span>
        <span>{plural(sum.sets, 'set')}</span>
        {pr && pr.count > 0 && <span class="w-pr"><Icon name="medal" size={15} class="pr-ic" /> {plural(pr.count, 'PR')}</span>}
      </div>
      <table class="w-table">
        <thead><tr><th>Exercise</th><th class="r">Sets</th><th class="r">Best set</th></tr></thead>
        <tbody>
          {groups.map((exId) => {
            const ex = exerciseOf(exercises, exId);
            const st = entryStats(seen.get(exId), ex, formula);
            const labels = pr && pr.prs[exId];
            return (
              <tr key={exId}>
                <td>
                  <button class="cell-link" onClick={() => push('exercise', { id: exId })}>{ex.name}</button>
                  {labels && <span class="pr-tag"><Icon name="medal" size={14} class="pr-ic" />{labels.join(', ')}</span>}
                </td>
                <td class="r num">{st.sets}</td>
                <td class="r num nowrap">{bestSetText(st, ex, unit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}

function Calendar({ month, setMonth, byDay, prDays, weekStart, onDay }) {
  const first = startOfMonth(month);
  const lead = (new Date(first).getDay() - weekStart + 7) % 7;
  const daysIn = new Date(new Date(first).getFullYear(), new Date(first).getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 0; d < daysIn; d++) cells.push(addDays(first, d));
  const today = startOfDay(Date.now());
  const heads = Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 1 + ((i + weekStart) % 7)).toLocaleDateString('en-US', { weekday: 'short' }));
  return (
    <div class="cal">
      <div class="cal-nav">
        <button class="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(first, -1))}><Icon name="left" /></button>
        <h2 class="cal-title">{fmtMonth(first)}</h2>
        <button class="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(first, 1))}><Icon name="right" /></button>
      </div>
      <div class="cal-grid">
        {heads.map((h) => <div key={h} class="cal-h">{h}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={'e' + i} />;
          const n = byDay.get(d) || 0;
          const pr = prDays.has(d);
          return (
            <button key={d} class={'cal-d' + (n ? ' on' : '') + (pr ? ' pr' : '') + (d === today ? ' today' : '') + (d > today ? ' future' : '')}
              onClick={() => onDay(d, n)} aria-label={`${new Date(d).toDateString()}${n ? `, ${n} workout${n > 1 ? 's' : ''}` : ''}${pr ? ', personal record' : ''}`}>
              <span class="num">{new Date(d).getDate()}</span>
              {pr && <Icon name="medal" size={13} class="cal-medal" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HistoryScreen() {
  const s = useStore();
  const exercises = allExercises(s);
  const { unit, formula, weekStart } = s.settings;
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const prIdx = useMemo(() => buildPRIndex(s.workouts, exercises, formula).index, [s.workouts, exercises, formula]);
  const { byDay, prDays } = useMemo(() => {
    const byDay = new Map(), prDays = new Set();
    for (const w of s.workouts) {
      const d = startOfDay(w.start);
      byDay.set(d, (byDay.get(d) || 0) + 1);
      if (prIdx[w.id] && prIdx[w.id].count) prDays.add(d);
    }
    return { byDay, prDays };
  }, [s.workouts, prIdx]);
  const end = addMonths(month, 1);
  const list = s.workouts.filter((w) => w.start >= month && w.start < end).sort((a, b) => b.start - a.start);
  const tot = list.reduce((a, w) => { const x = workoutSummary(w, exercises); a.sets += x.sets; a.vol += x.vol; return a; }, { sets: 0, vol: 0 });

  const onDay = (d, n) => {
    if (n) {
      const w = list.find((x) => startOfDay(x.start) === d);
      const el = w && document.getElementById('w-' + w.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (d > Date.now()) return;
    const t = new Date(d); t.setHours(17, 0, 0, 0);
    confirmSheet({ title: `Log a workout on ${fmtDateLong(d)}?`, confirm: 'Log a workout' })
      .then((ok) => ok && push('editWorkout', { draft: newPastWorkout(t.getTime()) }));
  };

  return (
    <div class="page">
      <div class="page-head">
        <h1 class="h-page">History</h1>
        <button class="link" onClick={() => push('editWorkout', { draft: newPastWorkout() })}><Icon name="plus" size={18} /> Log past</button>
      </div>
      <Calendar month={month} setMonth={setMonth} byDay={byDay} prDays={prDays} weekStart={weekStart} onDay={onDay} />
      {list.length > 0 && (
        <p class="month-sum">
          <strong>{plural(list.length, 'workout')}</strong>, <strong>{plural(tot.sets, 'set')}</strong>, <strong>{fmtW(tot.vol, unit)}</strong> lifted in {new Date(month).toLocaleDateString('en-US', { month: 'long' })}
        </p>
      )}
      {s.workouts.length > 0 && <MovedCard workouts={s.workouts} exercises={exercises} unit={unit} weekStart={weekStart} />}
      <div class="stack-12 mt-16">
        {list.map((w) => <WorkoutCard key={w.id} w={w} exercises={exercises} unit={unit} formula={formula} pr={prIdx[w.id]} />)}
      </div>
      {!list.length && (
        <Empty title={s.workouts.length ? 'No workouts this month' : 'Your log starts here'}
          body={s.workouts.length ? 'Pick another month, or log a session you did without the app.' : 'Finished workouts show up here with best sets and personal records. Tap a past day on the calendar to back-fill one.'} />
      )}
    </div>
  );
}
