import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises, exerciseInUse, deleteCustomExercise } from '../store.js';
import { MUSCLE_NAME, EQUIPMENT } from '../data/exercises.js';
import { exerciseHistory, exerciseOf, repRecords, e1rm, RANGES, rangeBounds, buildPRIndex } from '../lib/calc.js';
import { fmtW, fmtNum, fmtDateShort, fmtDateYear, fromKg, plural, wNum, fmtSecs } from '../lib/util.js';
import { Icon, Header, Chips, pop, openSheet, confirmSheet, toast, Empty } from '../ui.jsx';
import { LineChart } from '../components/charts.jsx';
import { ExerciseForm } from './pickers.jsx';
import { hasPhotos, ExVisual, ExGuide, AddedPreviewPanel } from '../components/preview.jsx';
import { liftStatus, painHistory, painCheck } from '../lib/insights.js';
import { Sparkline } from '../components/charts.jsx';
import { Why } from '../components/why.jsx';

const STATUS = {
  improving: ['Improving', 'up'], steady: ['Holding steady', 'flat'], declining: ['Trending down', 'down'], stalled: ['Stalled', 'flat'],
};
function TrendLine({ st }) {
  if (!STATUS[st.status]) return null;
  const [label, cls] = STATUS[st.status];
  const detail = st.status === 'declining' ? `${Math.round(st.drop * 100)}% below its recent best for 3 sessions`
    : st.status === 'stalled' ? `no new best in ${st.weeks} weeks`
      : `${st.change >= 0 ? '+' : ''}${Math.round(st.change * 100)}% est. 1RM over the last 12 weeks`;
  return (
    <div class={'trend-line t-' + cls}>
      <span><strong>{label}</strong> <span class="muted">· {detail}</span></span>
      <Why id={st.status === 'stalled' ? 'variation' : 'trend'} />
    </div>
  );
}
function PainPanel({ hist }) {
  const pc = painCheck(hist);
  if (!pc) return null;
  return (
    <section class="panel">
      <div class="panel-head"><h2 class="h-sec m0">Pain log</h2><Why id="pain" /></div>
      <div class="row-between">
        <span><strong class="num pain-last">{pc.last.v}/10</strong> <span class="small muted">last logged {fmtDateShort(pc.last.t)}</span></span>
        <Sparkline values={hist.slice(-12).map((p) => p.v)} width={110} height={34} color={pc.over ? 'var(--red)' : 'var(--yellow)'} />
      </div>
      <ul class="pain-checks small">
        <li class={pc.over ? 'bad' : 'good'}>{pc.over ? 'Above' : 'Within'} 5/10 during exercise</li>
        <li class={pc.rising ? 'bad' : 'good'}>{pc.rising ? 'Higher this week than last week' : 'Not rising week to week'}</li>
        <li class="ask">Settled by the next morning? Only you can tell.</li>
      </ul>
      <p class="small muted">These are the three checks of the pain-monitoring model used in tendon rehab. Persistent or worsening pain is worth a clinician’s opinion.</p>
    </section>
  );
}

const mem = { range: 'All' };

function metricsFor(kind) {
  if (kind === 'weight') return [['e1rm', 'Est. 1RM'], ['topW', 'Top weight'], ['bestSetVol', 'Best set'], ['vol', 'Volume'], ['reps', 'Reps']];
  if (kind === 'time') return [['maxTime', 'Longest hold'], ['sets', 'Sets']];
  return [['maxReps', 'Most reps'], ['reps', 'Total reps'], ['sets', 'Sets']];
}

function setText(s, ex, unit, scale = 'rir') {
  const eff = s.rir != null ? ` ${scale === 'rpe' ? `@${10 - s.rir}` : `(${s.rir >= 5 ? '5+' : s.rir} left)`}` : '';
  if (ex.kind === 'time') return (s.w ? `${fmtNum(wNum(s.w, unit, 2))}×` : '') + fmtSecs(s.t);
  if (ex.kind === 'reps') return (s.w ? `+${fmtNum(wNum(s.w, unit, 2))}×${s.r}` : `${s.r}`) + eff;
  return `${fmtNum(wNum(s.w, unit, 2))}×${s.r}${eff}`;
}

export function ExerciseScreen({ id }) {
  const s = useStore();
  const exercises = allExercises(s);
  const ex = exerciseOf(exercises, id);
  const { unit, formula } = s.settings;
  const metrics = metricsFor(ex.kind);
  const [metric, setMetric] = useState(metrics[0][0]);
  const [range, setRange] = useState(mem.range);
  const all = useMemo(() => exerciseHistory(s.workouts, id, ex, formula), [s.workouts, id, ex, formula]);
  const prIdx = useMemo(() => buildPRIndex(s.workouts, exercises, formula).index, [s.workouts, exercises, formula]);
  const bounds = useMemo(() => rangeBounds(range, s.workouts), [range, s.workouts]);
  const hist = all.filter((h) => h.t >= bounds.start);
  const isW = ['e1rm', 'topW', 'bestSetVol', 'vol'].includes(metric);
  const points = hist.filter((h) => metric !== 'e1rm' || h.e1rm > 0).map((h) => ({
    x: h.t, y: isW ? fromKg(h[metric], unit) : h[metric], label: fmtDateShort(h.t),
    pr: !!(prIdx[h.workoutId] && prIdx[h.workoutId].prs[id]),
  }));
  const fmt = (v) => (isW ? `${fmtNum(v, 1)} ${unit}` : metric === 'maxTime' ? `${fmtNum(v, 0)}s` : fmtNum(v, 0));

  const rec = useMemo(() => {
    const r = { e1rm: null, topW: null, bestSetVol: null, vol: null, maxReps: null, maxTime: null };
    for (const h of all) for (const k of Object.keys(r)) if (h[k] && (!r[k] || h[k] > r[k].v)) r[k] = { v: h[k], t: h.t };
    return r;
  }, [all]);
  const reps = useMemo(() => (ex.kind === 'weight' ? repRecords(all) : []), [all, ex.kind]);

  const editMenu = ex.custom ? () => openSheet((close) => (
    <div class="sheet-pad">
      <h3 class="sheet-title">{ex.name}</h3>
      <div class="menu">
        <button class="menu-row" onClick={() => { close(); openSheet((c) => <ExerciseForm initial={ex} close={c} />, { tall: true }); }}><Icon name="edit" size={20} /> Edit exercise</button>
        <button class="menu-row danger" onClick={async () => {
          close();
          if (exerciseInUse(id)) { toast('It’s used in a workout or your history, so it stays'); return; }
          if (await confirmSheet({ title: `Delete “${ex.name}”?`, confirm: 'Delete exercise', danger: true })) { deleteCustomExercise(id); pop(); }
        }}><Icon name="trash" size={20} /> Delete exercise</button>
      </div>
    </div>
  )) : null;

  const tile = (label, r, f) => (
    <div class="rec">
      <span class="rec-l">{label}</span>
      <span class="rec-v num">{r ? f(r.v) : '–'}</span>
      <span class="rec-d small muted">{r ? fmtDateYear(r.t) : 'Not logged yet'}</span>
    </div>
  );

  return (
    <div class="screen-body">
      <Header title={ex.name} onBack={pop}
        sub={[EQUIPMENT[ex.equipment] || '', ex.primary.map((m) => MUSCLE_NAME[m]).join(', ')].filter(Boolean).join(', ')}
        right={editMenu && <button class="icon-btn" aria-label="Exercise options" onClick={editMenu}><Icon name="more" /></button>} />
      <div class="pad-16 stack-16">
        {hasPhotos(id) ? (
          <section class="panel">
            <ExVisual ex={ex} />
            <details class="how" open={!all.length}>
              <summary>How to do it</summary>
              <ExGuide ex={ex} />
            </details>
          </section>
        ) : <AddedPreviewPanel ex={ex} openSteps={!all.length} />}
        {!all.length ? (
          <Empty title="No sessions yet" body="Once you log this exercise, its chart, records and history show up here." />
        ) : (
          <>
            <section class="panel">
              <Chips options={metrics} value={metric} onChange={setMetric} class="chips-scroll" />
              <Chips options={RANGES.map(([k]) => [k, k])} value={range} onChange={(v) => { mem.range = v; setRange(v); }} class="range-chips" />
              {points.length
                ? <LineChart points={points} fmt={fmt} fmtAxis={(v) => fmtNum(v, 0)} tipLabel={(p) => fmtDateYear(p.x) + (p.pr ? ', PR' : '')} zero={metric === 'reps' || metric === 'sets'} />
                : <p class="muted pad-x">No sessions in this range.</p>}
              {metric === 'e1rm' && <p class="small muted">Estimated with the {formula === 'epley' ? 'Epley' : 'Brzycki'} formula from your best set of 12 reps or fewer each session{all.some((h) => h.setList.some((x) => x.rir != null)) ? '; sets with effort logged use reps + reps left' : ''}. Yellow dots are sessions with a record. <Why id={all.some((h) => h.setList.some((x) => x.rir != null)) ? 'effort' : 'e1rm'} /></p>}
            </section>

            {ex.kind === 'weight' && <TrendLine st={liftStatus(all.filter((h) => h.e1rm > 0).map((h) => ({ t: h.t, v: h.e1rm })))} />}
            <PainPanel hist={painHistory(s.workouts, id)} />
            <section>
              <h2 class="h-sec">Records</h2>
              <div class="rec-grid">
                {ex.kind === 'weight' && <>
                  {tile('Est. 1RM', rec.e1rm, (v) => fmtW(v, unit))}
                  {tile('Heaviest weight', rec.topW, (v) => fmtW(v, unit))}
                  {tile('Best set volume', rec.bestSetVol, (v) => fmtW(v, unit))}
                  {tile('Best session volume', rec.vol, (v) => fmtW(v, unit))}
                </>}
                {ex.kind === 'reps' && <>
                  {tile('Most reps in a set', rec.maxReps, (v) => `${v}`)}
                  {rec.topW && tile('Heaviest added weight', rec.topW, (v) => fmtW(v, unit))}
                </>}
                {ex.kind === 'time' && tile('Longest hold', rec.maxTime, (v) => fmtSecs(v))}
              </div>
            </section>

            {reps.length > 0 && (
              <section>
                <h2 class="h-sec">Best weight by reps</h2>
                <table class="m-table panel-table">
                  <thead><tr><th>Reps</th><th class="r">Weight</th><th class="r">Est. 1RM</th><th class="r">Date</th></tr></thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.n}>
                        <td class="num">{r.n}</td>
                        <td class="r num">{fmtW(r.w, unit)}</td>
                        <td class="r num muted">{e1rm(r.w, r.n, formula) ? fmtW(e1rm(r.w, r.n, formula), unit) : '–'}</td>
                        <td class="r small muted">{fmtDateShort(r.t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p class="small muted mt-8">Heaviest weight you’ve lifted for exactly that many reps.</p>
              </section>
            )}

            <section>
              <h2 class="h-sec">Sessions</h2>
              <div class="sess-list">
                {[...all].reverse().slice(0, 30).map((h) => (
                  <div key={h.workoutId} class="sess">
                    <div class="row-between">
                      <span class="sess-d">{fmtDateYear(h.t)}</span>
                      <span class="small muted">{plural(h.setList.length, 'set')}</span>
                    </div>
                    <div class="sess-sets num">{h.setList.map((st, i) => <span key={i}>{setText(st, ex, unit, s.settings.effortScale)}</span>)}</div>
                    {h.note && <p class="sess-note small">{h.note}</p>}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
