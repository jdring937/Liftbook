import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises } from '../store.js';
import { MUSCLES, MUSCLE_NAME, RADAR_GROUPS } from '../data/exercises.js';
import {
  RANGES, rangeBounds, trendSeries, muscleStats, groupStats, heatLevel, HEAT_LABELS, inRange, exerciseHistory, exerciseOf,
} from '../lib/calc.js';
import { fmtNum, compact, fmtDateShort, fmtMonthShort, daysAgo, fmtW, wNum, plural, fromKg } from '../lib/util.js';
import { Icon, Chips, Seg, push, openSheet, Empty, setTab } from '../ui.jsx';
import { BarChart, Radar, Sparkline } from '../components/charts.jsx';
import { BodyFigure } from '../components/body.jsx';
import { GoalsPanel } from './goals.jsx';
import { Insights } from '../components/insights.jsx';
import { GoalBanner } from '../components/trainingGoal.jsx';

// remembers choices while the app is open
const mem = { seg: null, range: '30D', view: 'body', metric: 'volume', group: 'week' };

function muscleInfo() {
  openSheet((close) => (
    <div class="sheet-pad">
      <h3 class="sheet-title">How sets are counted</h3>
      <p class="sheet-body">Each checked-off set counts as one set for the exercise’s main muscles and half a set for its helper muscles. A seated cable row, for example, adds 1 set to upper back and lats, and half a set to biceps and rear delts.</p>
      <p class="sheet-body">Warm-up sets don’t count. Colors show the average sets per week over the range you picked, so 30 days and 1 year read on the same scale. Many lifters aim for roughly 10 to 20 sets per muscle each week.</p>
      <button class="btn full" onClick={close}>Got it</button>
    </div>
  ));
}

function Muscles({ s, exercises, bounds }) {
  const [view, setView] = useState(mem.view);
  const [sel, setSel] = useState(null);
  const stats = useMemo(() => muscleStats(s.workouts, exercises, bounds), [s.workouts, exercises, bounds.start, bounds.end]);
  const levels = Object.fromEntries(MUSCLES.map(([k]) => [k, heatLevel(stats[k].sets / bounds.weeks)]));
  const total = MUSCLES.reduce((a, [k]) => a + stats[k].sets, 0);
  const pick = (info) => setSel((x) => (x && x.key === info.key ? null : info));
  const topFor = (m) => Object.entries(stats[m].ex).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const ranked = MUSCLES.map(([k, n]) => ({ k, n, ...stats[k] })).sort((a, b) => b.sets - a.sets);

  return (
    <section class="panel">
      <div class="panel-head">
        <Seg options={[['body', 'Body'], ['radar', 'Radar'], ['table', 'Table']]} value={view} onChange={(v) => { mem.view = v; setView(v); }} />
        <button class="icon-btn" aria-label="How sets are counted" onClick={muscleInfo}><Icon name="info" /></button>
      </div>
      {!total && <p class="muted pad-x">No sets in this range yet. The map fills in as you log workouts.</p>}

      {view === 'body' && (
        <>
          <div class="bodies">
            <figure><BodyFigure side="front" sex={s.settings.bodySex} levels={levels} selected={sel && sel.key} onSelect={pick} /><figcaption>Front</figcaption></figure>
            <figure><BodyFigure side="back" sex={s.settings.bodySex} levels={levels} selected={sel && sel.key} onSelect={pick} /><figcaption>Back</figcaption></figure>
          </div>
          <div class="heat-legend" aria-label="Sets per week">
            <span class="small muted">Sets per week</span>
            <div class="heat-steps">
              {HEAT_LABELS.map((l, i) => (
                <span key={l} class="heat-step"><i style={{ background: `var(--heat-${i})` }} /><span class="small num">{l}</span></span>
              ))}
            </div>
          </div>
          <div class="muscle-detail">
            {sel ? (
              <>
                <div class="row-between">
                  <strong class="md-name">{sel.label}</strong>
                  <button class="icon-btn sm" aria-label="Clear selection" onClick={() => setSel(null)}><Icon name="x" size={18} /></button>
                </div>
                {sel.muscles.map((m) => {
                  const st = stats[m];
                  const top = topFor(m);
                  return (
                    <div key={m} class="md-line">
                      {sel.muscles.length > 1 && <span class="md-sub">{MUSCLE_NAME[m]}</span>}
                      <p class="small">
                        <strong class="num">{fmtNum(st.sets)}</strong> sets in this range, <strong class="num">{fmtNum(st.sets / bounds.weeks)}</strong> per week.
                        {' '}{st.last ? `Last trained ${daysAgo(st.last).toLowerCase()}.` : 'Not trained yet.'}
                      </p>
                      {top.length > 0 && <p class="small muted">Mostly from {top.map(([id]) => exerciseOf(exercises, id).name).join(', ')}.</p>}
                    </div>
                  );
                })}
              </>
            ) : (
              <p class="small muted">Tap a muscle for its sets and when you last trained it.</p>
            )}
          </div>
        </>
      )}

      {view === 'radar' && (
        <>
          <Radar axes={groupStats(s.workouts, exercises, bounds, RADAR_GROUPS)} fmt={(v) => fmtNum(v)} />
          <p class="small muted">Sets per muscle group in this range. The outer ring is your most-trained group.</p>
        </>
      )}

      {view === 'table' && (
        <table class="m-table">
          <thead><tr><th>Muscle</th><th class="r">Sets</th><th class="r">Per week</th><th class="r">Last</th></tr></thead>
          <tbody>
            {ranked.map((m) => (
              <tr key={m.k}>
                <td><i class="sw" style={{ background: `var(--heat-${levels[m.k]})` }} />{m.n}</td>
                <td class="r num">{fmtNum(m.sets)}</td>
                <td class="r num">{fmtNum(m.sets / bounds.weeks)}</td>
                <td class="r small muted">{m.last ? daysAgo(m.last) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const METRICS = [['volume', 'Volume'], ['sets', 'Sets'], ['reps', 'Reps'], ['workouts', 'Workouts'], ['duration', 'Time']];

function Trends({ s, exercises, bounds, rangeKey }) {
  const [metric, setMetric] = useState(mem.metric);
  const [group, setGroup] = useState(mem.group);
  const unit = s.settings.unit;
  const { buckets, total, prev } = useMemo(
    () => trendSeries(s.workouts, exercises, { metric, bounds, group, weekStart: s.settings.weekStart }),
    [s.workouts, exercises, metric, bounds.start, bounds.end, group, s.settings.weekStart]
  );
  const conv = (v) => (metric === 'volume' ? fromKg(v, unit) : v);
  const fmt = (v) => {
    if (metric === 'volume') return `${fmtNum(v, 0)} ${unit}`;
    if (metric === 'duration') return `${fmtNum(v, 0)} min`;
    return fmtNum(v, 0);
  };
  const data = buckets.map((b) => ({ ...b, value: conv(b.value) }));
  const groupWord = { day: 'day', week: 'week', month: 'month' }[group];
  const avg = conv(total) / Math.max(1, buckets.length);
  const delta = prev ? (total - prev) / prev : null;
  const xLabel = (d) => (group === 'month' ? fmtMonthShort(d.t) : fmtDateShort(d.t));
  const tipLabel = (d) => (group === 'day' ? fmtDateShort(d.t) : group === 'week' ? `Week of ${fmtDateShort(d.t)}` : new Date(d.t).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
    + (metric !== 'workouts' ? `, ${plural(d.count, 'workout')}` : '');
  return (
    <section class="panel">
      <Chips options={METRICS} value={metric} onChange={(v) => { mem.metric = v; setMetric(v); }} class="chips-scroll" />
      <div class="trend-stats">
        <div>
          <span class="stat-v num">{metric === 'volume' ? compact(conv(total)) : fmtNum(conv(total), 0)}</span>
          <span class="stat-l">Total {metric === 'volume' ? unit : metric === 'duration' ? 'minutes' : metric}</span>
        </div>
        <div>
          <span class="stat-v num">{metric === 'volume' ? compact(avg) : fmtNum(avg, 1)}</span>
          <span class="stat-l">Average per {groupWord}</span>
        </div>
        {rangeKey !== 'All' && (
          <div>
            <span class="stat-v num">{delta == null ? '–' : `${delta >= 0 ? '+' : '−'}${fmtNum(Math.abs(delta) * 100, 0)}%`}</span>
            <span class="stat-l">vs previous {rangeKey}</span>
          </div>
        )}
      </div>
      <div class="row-between mt-8">
        <span class="small muted">{METRICS.find((m) => m[0] === metric)[1]} per {groupWord}</span>
        <Seg options={[['day', 'D'], ['week', 'W'], ['month', 'M']]} value={group} onChange={(v) => { mem.group = v; setGroup(v); }} />
      </div>
      {total > 0
        ? <BarChart data={data} fmt={fmt} fmtAxis={(v) => compact(v)} xLabel={xLabel} tipLabel={tipLabel} />
        : <p class="muted pad-x">Nothing logged in this range.</p>}
    </section>
  );
}

function ExerciseList({ s, exercises, bounds }) {
  const { unit, formula } = s.settings;
  const rows = useMemo(() => {
    const ids = new Set();
    for (const w of s.workouts) if (inRange(w, bounds)) for (const e of w.exercises) ids.add(e.exId);
    return [...ids].map((id) => {
      const ex = exerciseOf(exercises, id);
      const hist = exerciseHistory(s.workouts, id, ex, formula).filter((h) => h.t >= bounds.start);
      const key = ex.kind === 'weight' ? 'e1rm' : ex.kind === 'time' ? 'maxTime' : 'maxReps';
      const vals = hist.map((h) => h[key]);
      return { id, ex, n: hist.length, vals, latest: vals[vals.length - 1], first: vals[0], key };
    }).sort((a, b) => b.n - a.n || a.ex.name.localeCompare(b.ex.name));
  }, [s.workouts, exercises, bounds.start, bounds.end, formula]);
  if (!rows.length) return <Empty title="No exercises in this range" body="Log a workout and each exercise gets its own progress chart here." />;
  const fmtV = (r, v) => (r.key === 'e1rm' ? fmtW(v, unit) : r.key === 'maxTime' ? `${v}s` : `${v} reps`);
  return (
    <section class="panel flush">
      <div class="ex-list-head small muted"><span>Exercise</span><span>{formula === 'epley' ? 'Est. 1RM (Epley)' : 'Est. 1RM (Brzycki)'}</span></div>
      {rows.map((r) => {
        const d = r.n > 1 && r.first ? (r.latest - r.first) / r.first : null;
        return (
          <button key={r.id} class="ex-row" onClick={() => push('exercise', { id: r.id })}>
            <span class="ex-row-main">
              <span class="ex-row-name">{r.ex.name}</span>
              <span class="small muted">{plural(r.n, 'session')}{d != null && Math.abs(d) >= 0.005 ? `, ${d > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(d) * 100, 0)}%` : ''}</span>
            </span>
            <Sparkline values={r.vals} />
            <span class="ex-row-v num">{fmtV(r, r.latest)}</span>
          </button>
        );
      })}
    </section>
  );
}

// open Progress on a given section (used by links from other tabs)
export function openProgress(seg) { mem.seg = seg; setTab('progress'); }

export function ProgressScreen() {
  const s = useStore();
  const exercises = allExercises(s);
  const [seg, setSeg] = useState(mem.seg || (s.goals.length ? 'goals' : 'muscles'));
  const [range, setRange] = useState(mem.range);
  const bounds = useMemo(() => rangeBounds(range, s.workouts), [range, s.workouts]);
  return (
    <div class="page">
      <div class="page-head"><h1 class="h-page">Progress</h1></div>
      <Seg options={[['goals', 'Goals'], ['muscles', 'Muscles'], ['trends', 'Trends'], ['exercises', 'Exercises']]} value={seg} onChange={(v) => { mem.seg = v; setSeg(v); }} />
      {seg !== 'goals' && <Chips options={RANGES.map(([k]) => [k, k])} value={range} onChange={(v) => { mem.range = v; setRange(v); }} class="range-chips" />}
      {seg === 'goals' && <div class="mt-16 stack-12"><GoalBanner /><Insights s={s} exercises={exercises} max={4} /><GoalsPanel s={s} exercises={exercises} /></div>}
      {seg === 'muscles' && <Muscles s={s} exercises={exercises} bounds={bounds} />}
      {seg === 'trends' && <Trends s={s} exercises={exercises} bounds={bounds} rangeKey={range} />}
      {seg === 'exercises' && <ExerciseList s={s} exercises={exercises} bounds={bounds} />}
    </div>
  );
}
