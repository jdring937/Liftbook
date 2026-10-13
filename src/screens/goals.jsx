import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises, saveGoal, deleteGoal, addBody, getState } from '../store.js';
import {
  GOAL_TYPES, SITES, SITE_NAME, VOLUME_GROUPS, goalStatus, currentValue, goalTitle, liftTarget, weightRateCheck,
  fromCm, toCm, lenUnit,
} from '../lib/goals.js';
import { exerciseOf } from '../lib/calc.js';
import { fromKg, toKg, round, fmtDateYear, fmtDateShort, DAY, plural } from '../lib/util.js';
import { Icon, Header, Chips, Stepper, NumInput, push, pop, openSheet, confirmSheet, toast } from '../ui.jsx';
import { ForecastChart, BarChart } from '../components/charts.jsx';
import { openPicker } from './pickers.jsx';
import { Why } from '../components/why.jsx';

// ---------- display helpers ----------
export function goalUnits(goal, unit) {
  if (goal.type === 'lift' || goal.type === 'bodyweight') return { conv: (v) => fromKg(v, unit), u: unit, d: 1 };
  if (goal.type === 'measure') return { conv: (v) => fromCm(v, unit), u: lenUnit(unit), d: 1 };
  if (goal.type === 'reps') return { conv: (v) => v, u: 'reps', d: 0 };
  if (goal.type === 'volume') return { conv: (v) => v, u: 'sets', d: 1 };
  return { conv: (v) => v, u: 'workouts', d: 0 };
}
const fmtVal = (goal, unit) => { const { conv, u, d } = goalUnits(goal, unit); return (v) => `${round(conv(v), d).toLocaleString('en-US')} ${u}`; };
const signed = (n, d = 1) => `${n >= 0 ? '+' : '−'}${round(Math.abs(n), d)}`;
const when = (t) => (t - Date.now() > 300 * DAY ? fmtDateYear(t) : fmtDateShort(t));

export function statusText(goal, st, unit) {
  const f = fmtVal(goal, unit);
  const { conv, u, d } = goalUnits(goal, unit);
  if (st.kind === 'weekly') {
    if (st.status === 'done') return { tone: 'good', text: `Done this week: ${round(st.current, 1)} of ${goal.target}.` };
    const avg = `Averaging ${round(st.avg4, 1)} a week over the last 4 weeks`;
    return { tone: st.status === 'ontrack' ? 'good' : st.status === 'close' ? 'warn' : 'bad', text: `${round(st.current, 1)} of ${goal.target} so far this week. ${avg}${st.streak ? `, ${plural(st.streak, 'week')} in a row on target` : ''}.` };
  }
  if (st.status === 'done') return { tone: 'good', text: `Reached: ${f(st.current)}.` };
  if (st.status === 'nodata') return { tone: 'muted', text: goal.type === 'bodyweight' || goal.type === 'measure' ? 'Log a few entries over 10+ days for a forecast.' : 'Log 3+ sessions over 10+ days for a forecast.' };
  const fc = st.fc;
  const rate = `${signed(conv(fc.perWeek) - conv(0), d === 0 ? 1 : 1)} ${u} a week lately`;
  if (st.status === 'away') return { tone: 'bad', text: `Moving away from the goal lately (${rate}).` };
  if (st.status === 'far') return { tone: 'warn', text: `Progress is slowing; at this rate it’s more than a year out (${rate}).` };
  const range = fc.etaFast && fc.etaSlow && fc.etaSlow - fc.etaFast >= 3 * DAY ? ` (likely ${when(fc.etaFast)} – ${when(fc.etaSlow)})` : '';
  if (st.status === 'behind') {
    const late = Math.round((fc.eta - goal.date) / (7 * DAY));
    const need = st.needPerWeek != null ? ` Needs ${signed(conv(st.needPerWeek) - conv(0))} ${u} a week; you’re at ${rate.replace(' lately', '')}.` : '';
    return { tone: 'warn', text: `Behind plan: expected around ${when(fc.eta)}${range}, about ${plural(late, 'week')} late.${need}` };
  }
  return { tone: 'good', text: `${goal.date ? 'On track: expected' : 'At this rate: about'} ${when(fc.eta)}${range}. ${rate[0].toUpperCase() + rate.slice(1)}.` };
}

function ProgressBar({ pct, tone }) {
  return <div class={'gbar g-' + tone} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${Math.max(2, pct * 100)}%` }} /></div>;
}

export function GoalCard({ goal, s, exercises, compact = false }) {
  const st = useMemo(() => goalStatus(goal, s, exercises), [goal, s.workouts, s.body, exercises]);
  const unit = s.settings.unit;
  const f = fmtVal(goal, unit);
  const tx = statusText(goal, st, unit);
  return (
    <button class={'goal-card' + (compact ? ' compact' : '')} onClick={() => push('goal', { id: goal.id })}>
      <div class="row-between">
        <span class="goal-name">{goalTitle(goal, exercises, unit)}</span>
        <span class="goal-pct num">{Math.round(st.pct * 100)}%</span>
      </div>
      <ProgressBar pct={st.pct} tone={tx.tone} />
      {!compact && st.kind === 'trend' && (
        <div class="goal-nums small muted num">
          <span>Start {f(goal.start ?? st.current)}</span><span>Now {f(st.current)}</span>{goal.date && <span>By {fmtDateShort(goal.date)}</span>}
        </div>
      )}
      <p class={'goal-status small t-' + tx.tone}>{tx.text}</p>
    </button>
  );
}

// ---------- goal detail ----------
export function GoalScreen({ id }) {
  const s = useStore();
  const exercises = allExercises(s);
  const goal = s.goals.find((g) => g.id === id);
  const st = useMemo(() => (goal ? goalStatus(goal, s, exercises) : null), [goal, s.workouts, s.body, exercises]);
  if (!goal) return <div class="screen-body"><Header title="Goal" onBack={pop} /><p class="muted pad-16">This goal was deleted.</p></div>;
  const unit = s.settings.unit;
  const { conv, u } = goalUnits(goal, unit);
  const f = fmtVal(goal, unit);
  const tx = statusText(goal, st, unit);
  const bw = s.body.filter((b) => b.kind === 'weight');
  const rate = goal.type === 'bodyweight' && st.needPerWeek != null && bw.length ? weightRateCheck(st.needPerWeek, st.current) : null;
  return (
    <div class="screen-body">
      <Header title={goalTitle(goal, exercises, unit)} onBack={pop}
        sub={goal.date ? `By ${fmtDateYear(goal.date)}` : 'No deadline'}
        right={<button class="link" onClick={() => goalEditor(goal)}>Edit</button>} />
      <div class="pad-16 stack-16">
        <section class="panel">
          <div class="goal-hero">
            <div><span class="stat-v num">{st.kind === 'weekly' ? round(st.current, 1) : f(st.current)}</span><span class="stat-l">{st.kind === 'weekly' ? 'This week' : 'Now'}</span></div>
            <div><span class="stat-v num">{st.kind === 'weekly' ? goal.target : f(goal.target)}</span><span class="stat-l">Goal</span></div>
            <div><span class="stat-v num">{Math.round(st.pct * 100)}%</span><span class="stat-l">Progress</span></div>
          </div>
          <ProgressBar pct={st.pct} tone={tx.tone} />
          <p class={'goal-status t-' + tx.tone}>{tx.text}</p>
          {st.kind === 'trend' && st.series.length > 0 && (
            <ForecastChart series={st.series} raw={goal.type === 'bodyweight' ? st.series.map((p) => ({ t: p.t, v: p.raw })) : null}
              goal={{ ...goal, start: goal.start ?? st.series[0].v, startT: goal.startT || goal.createdAt }} fc={st.fc}
              conv={conv} fmt={(v) => `${round(conv(v), 1)}`} />
          )}
          {st.kind === 'weekly' && (
            <BarChart data={st.weeks.map((w) => ({ t: w.t, value: w.v }))} fmt={(v) => `${round(v, 1)} ${u}`} fmtAxis={(v) => `${round(v, 1)}`}
              xLabel={(d) => fmtDateShort(d.t)} tipLabel={(d) => `Week of ${fmtDateShort(d.t)}`} target={goal.target} />
          )}
        </section>
        {rate && (
          <section class={'panel rate-check ' + (rate.ok ? 'ok' : 'warn')}>
            <strong>Pace needed: {signed(rate.pct, 2)}% of bodyweight a week</strong>
            <p class="small muted">That’s {rate.label}. <Why id="weightRate" /></p>
          </section>
        )}
        <section class="panel how-forecast small muted">
          {st.kind === 'trend' ? (
            <p>
              The forecast fits a line to your last {goal.type === 'bodyweight' ? '6' : '8'} weeks, weighting recent data more, and the shaded band shows the likely range.
              {goal.type === 'lift' || goal.type === 'reps' ? ' Strength gains slow as you get stronger, so the forecast curves off instead of extending a straight line.' : ''}
              {' '}<Why id={goal.type === 'bodyweight' ? 'weighTrend' : goal.type === 'lift' ? 'e1rm' : 'progression'} />
            </p>
          ) : (
            <p>Weeks run {s.settings.weekStart ? 'Monday' : 'Sunday'} to {s.settings.weekStart ? 'Sunday' : 'Saturday'}. {goal.type === 'volume' ? 'Sets count 1 for main muscles and 0.5 for helpers, like the muscle tracker.' : ''} <Why id={goal.type === 'volume' ? 'volume' : 'frequency'} /></p>
          )}
        </section>
        <button class="btn btn-ghost danger full" onClick={async () => {
          if (await confirmSheet({ title: 'Delete this goal?', confirm: 'Delete goal', danger: true })) { deleteGoal(goal.id); pop(); }
        }}>Delete goal</button>
      </div>
    </div>
  );
}

// ---------- editor ----------
const DATE_CHOICES = [[null, 'No date'], [28, '4 weeks'], [56, '8 weeks'], [84, '12 weeks'], [182, '6 months'], [365, '1 year']];

function GoalForm({ initial, preset, close }) {
  const s = useStore();
  const exercises = allExercises(s);
  const unit = s.settings.unit;
  const [g, setG] = useState(() => initial ? { ...initial } : { type: 'lift', reps: 1, date: null, ...(preset || {}), ...(preset && preset.type === 'consistency' ? { target: 3 } : {}), ...(preset && preset.type === 'volume' ? { target: 10 } : {}) });
  const [dateKey, setDateKey] = useState(initial && initial.date ? 'custom' : null);
  const [now0, setNow0] = useState(null); // current bodyweight / measurement when none logged yet
  const set = (patch) => setG((x) => ({ ...x, ...patch }));
  const cur = useMemo(() => (g.type && (g.exId || !['lift', 'reps'].includes(g.type)) ? currentValue({ ...g }, s, exercises) : null), [g.type, g.exId, g.site, s.workouts, s.body]);
  const needsNow = (g.type === 'bodyweight' || g.type === 'measure') && cur == null;
  const ex = g.exId ? exerciseOf(exercises, g.exId) : null;

  const disp = (v) => (v == null ? null : g.type === 'measure' ? round(fromCm(v, unit), 1) : round(fromKg(v, unit), 1));
  const fromDisp = (v) => (v == null ? null : g.type === 'measure' ? toCm(v, unit) : toKg(v, unit));

  // live pace check for bodyweight goals
  let pace = null;
  if (g.type === 'bodyweight' && g.target && g.date) {
    const start = cur ?? fromDisp(now0);
    if (start) pace = weightRateCheck(((g.target - start) / Math.max(1, (g.date - Date.now()) / DAY)) * 7, start);
  }

  const save = () => {
    const out = { ...g };
    if ((g.type === 'lift' || g.type === 'reps') && !g.exId) { toast('Pick an exercise'); return; }
    if (g.type === 'lift') {
      if (!g.targetW) { toast('Enter a target weight'); return; }
      out.target = liftTarget(g.targetW, g.reps || 1, s.settings.formula);
    }
    if (!out.target) { toast('Enter a target'); return; }
    if (g.type === 'measure' && !g.site) { toast('Pick a measurement'); return; }
    if (g.type === 'volume' && !g.group) { toast('Pick a muscle group'); return; }
    if (needsNow) {
      if (!now0) { toast(g.type === 'bodyweight' ? 'Enter your current weight' : 'Enter your current measurement'); return; }
      addBody({ t: Date.now(), kind: g.type === 'bodyweight' ? 'weight' : g.site, v: fromDisp(now0) });
    }
    if (!initial) {
      const st = getState();
      out.start = currentValue(out, st, allExercises(st)) ?? (needsNow ? fromDisp(now0) : null);
      out.startT = Date.now();
    }
    saveGoal(out);
    toast(initial ? 'Goal saved' : 'Goal added');
    close();
  };

  return (
    <div class="form-sheet">
      <div class="form-head row-between">
        <h3 class="sheet-title">{initial ? 'Edit goal' : 'New goal'}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <div class="form-body">
        {!initial && (
          <div class="goal-types">
            {GOAL_TYPES.map(([k, label, hint]) => (
              <button key={k} class={'goal-type' + (g.type === k ? ' on' : '')} aria-pressed={g.type === k}
                onClick={() => setG({ type: k, reps: 1, date: g.date, targetW: undefined, target: k === 'consistency' ? 3 : k === 'volume' ? 10 : undefined })}>
                <strong>{label}</strong><span class="small">{hint}</span>
              </button>
            ))}
          </div>
        )}

        {(g.type === 'lift' || g.type === 'reps') && (
          <div class="field">
            <span>Exercise</span>
            <button class="pick-ex" onClick={() => openPicker(([id]) => set({ exId: id }), { multi: false, title: 'Pick the exercise' })}>
              {ex ? ex.name : 'Choose an exercise'} <Icon name="right" size={18} class="muted" />
            </button>
            {ex && cur != null && <span class="small muted">{g.type === 'lift' ? `Current estimated 1RM: ${round(fromKg(cur, unit), 1)} ${unit}` : `Best recent set: ${cur} reps`}</span>}
          </div>
        )}
        {g.type === 'lift' && (
          <div class="field">
            <span>Target</span>
            <div class="goal-lift">
              <NumInput value={g.targetW == null ? null : round(fromKg(g.targetW, unit), 2)} label={`Target weight in ${unit}`} placeholder={unit}
                onChange={(v) => set({ targetW: toKg(v, unit) })} />
              <span class="muted">{unit} for</span>
              <Stepper value={g.reps || 1} min={1} max={12} onChange={(v) => set({ reps: v })} fmt={(v) => plural(v, 'rep')} label="Reps" />
            </div>
            {g.reps > 1 && g.targetW && <span class="small muted">Tracked as an estimated 1RM of {round(fromKg(liftTarget(g.targetW, g.reps, s.settings.formula), unit), 1)} {unit}.</span>}
          </div>
        )}
        {g.type === 'reps' && (
          <label class="field"><span>Reps in one set</span>
            <NumInput decimal={false} value={g.target} label="Target reps" onChange={(v) => set({ target: v })} />
          </label>
        )}
        {g.type === 'measure' && (
          <div class="field"><span>Measurement</span>
            <Chips options={SITES} value={g.site} onChange={(v) => set({ site: v })} class="wrap" />
          </div>
        )}
        {(g.type === 'bodyweight' || (g.type === 'measure' && g.site)) && (
          <>
            {needsNow && (
              <label class="field"><span>Current {g.type === 'bodyweight' ? 'weight' : SITE_NAME[g.site].toLowerCase()} ({g.type === 'bodyweight' ? unit : lenUnit(unit)})</span>
                <NumInput value={now0} label="Current value" onChange={setNow0} />
              </label>
            )}
            {!needsNow && cur != null && <p class="small muted">Now: {disp(cur)} {g.type === 'bodyweight' ? unit : lenUnit(unit)}{g.type === 'bodyweight' ? ' (trend)' : ''}</p>}
            <label class="field"><span>Target ({g.type === 'bodyweight' ? unit : lenUnit(unit)})</span>
              <NumInput value={disp(g.target)} label="Target" onChange={(v) => set({ target: fromDisp(v) })} />
            </label>
          </>
        )}
        {g.type === 'consistency' && (
          <div class="field row-between"><span>Workouts a week</span>
            <Stepper value={g.target || 3} min={1} max={7} onChange={(v) => set({ target: v })} label="Workouts per week" />
          </div>
        )}
        {g.type === 'volume' && (
          <>
            <div class="field"><span>Muscle group</span>
              <Chips options={VOLUME_GROUPS.map(([k]) => [k, k])} value={g.group} onChange={(v) => set({ group: v, target: g.target || 10 })} class="wrap" />
            </div>
            <div class="field row-between"><span>Sets a week</span>
              <Stepper value={g.target || 10} min={2} max={30} onChange={(v) => set({ target: v })} label="Sets per week" />
            </div>
            <p class="small muted">Around 10–20 weekly sets is a common target for growth. <Why id="volume" /></p>
          </>
        )}
        {!['consistency', 'volume'].includes(g.type) && (
          <div class="field"><span>By when</span>
            <Chips options={[...DATE_CHOICES, ['custom', 'Pick a date']]} value={dateKey} class="wrap"
              onChange={(v) => { setDateKey(v); if (v === null) set({ date: null }); else if (v !== 'custom') set({ date: Date.now() + v * DAY }); }} />
            {dateKey === 'custom' && (
              <input type="date" value={g.date ? new Date(g.date).toISOString().slice(0, 10) : ''} aria-label="Target date"
                onChange={(e) => { const t = new Date(e.target.value + 'T12:00:00').getTime(); if (!isNaN(t)) set({ date: t }); }} />
            )}
          </div>
        )}
        {pace && (
          <p class={'small rate-inline ' + (pace.ok ? 'ok' : 'warn')}>
            That pace is {signed(pace.pct, 2)}% of bodyweight a week: {pace.label}. <Why id="weightRate" />
          </p>
        )}
      </div>
      <div class="picker-foot">
        <button class="btn btn-primary full" onClick={save}>{initial ? 'Save goal' : 'Add goal'}</button>
      </div>
    </div>
  );
}

export function goalEditor(initial = null, preset = null) {
  openSheet((close) => <GoalForm initial={initial} preset={preset} close={close} />, { tall: true });
}

export function GoalsPanel({ s, exercises }) {
  return (
    <div class="stack-12">
      {s.goals.map((g) => <GoalCard key={g.id} goal={g} s={s} exercises={exercises} />)}
      {!s.goals.length && (
        <div class="empty">
          <div class="empty-title">No goals yet</div>
          <p class="muted">Set a lift, bodyweight, measurement, consistency or muscle-volume goal and the app forecasts when you’ll get there from your actual progress.</p>
        </div>
      )}
      <button class="btn btn-soft full" onClick={() => goalEditor()}><Icon name="plus" size={20} /> Add a goal</button>
    </div>
  );
}

export function GoalsSummary({ s, exercises }) {
  if (!s.goals.length) return null;
  return (
    <section class="goals-sum">
      <div class="sec-head"><h2 class="h-sec">Goals</h2><button class="link" onClick={() => push('goals')}>All goals <Icon name="right" size={16} /></button></div>
      <div class="stack-8">
        {s.goals.slice(0, 3).map((g) => <GoalCard key={g.id} goal={g} s={s} exercises={exercises} compact />)}
      </div>
    </section>
  );
}

export function GoalsScreen() {
  const s = useStore();
  const exercises = allExercises(s);
  return (
    <div class="screen-body">
      <Header title="Goals" onBack={pop} />
      <div class="pad-16"><GoalsPanel s={s} exercises={exercises} /></div>
    </div>
  );
}
