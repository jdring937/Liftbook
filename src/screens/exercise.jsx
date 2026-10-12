import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises, exerciseInUse, deleteCustomExercise } from '../store.js';
import { MUSCLE_NAME, EQUIPMENT } from '../data/exercises.js';
import { exerciseHistory, exerciseOf, repRecords, e1rm, RANGES, rangeBounds, buildPRIndex } from '../lib/calc.js';
import { fmtW, fmtNum, fmtDateShort, fmtDateYear, fromKg, plural, wNum, fmtSecs } from '../lib/util.js';
import { Icon, Header, Chips, pop, openSheet, confirmSheet, toast, Empty } from '../ui.jsx';
import { LineChart } from '../components/charts.jsx';
import { ExerciseForm } from './pickers.jsx';
import { hasPreview, hasPhotos, ExVisual, ExGuide } from '../components/preview.jsx';

const mem = { range: 'All' };

function metricsFor(kind) {
  if (kind === 'weight') return [['e1rm', 'Est. 1RM'], ['topW', 'Top weight'], ['bestSetVol', 'Best set'], ['vol', 'Volume'], ['reps', 'Reps']];
  if (kind === 'time') return [['maxTime', 'Longest hold'], ['sets', 'Sets']];
  return [['maxReps', 'Most reps'], ['reps', 'Total reps'], ['sets', 'Sets']];
}

function setText(s, ex, unit) {
  if (ex.kind === 'time') return (s.w ? `${fmtNum(wNum(s.w, unit, 2))}×` : '') + fmtSecs(s.t);
  if (ex.kind === 'reps') return s.w ? `+${fmtNum(wNum(s.w, unit, 2))}×${s.r}` : `${s.r}`;
  return `${fmtNum(wNum(s.w, unit, 2))}×${s.r}`;
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
  const points = hist.map((h) => ({
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
        {hasPreview(id) && (
          <section class="panel">
            <ExVisual ex={ex} />
            {hasPhotos(id) && (
              <details class="how" open={!all.length}>
                <summary>How to do it</summary>
                <ExGuide id={id} />
              </details>
            )}
          </section>
        )}
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
              {metric === 'e1rm' && <p class="small muted">Estimated with the {formula === 'epley' ? 'Epley' : 'Brzycki'} formula from your best set each session. Yellow dots are sessions with a record.</p>}
            </section>

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
                        <td class="r num muted">{r.n <= 20 ? fmtW(e1rm(r.w, r.n, formula), unit) : '–'}</td>
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
                    <div class="sess-sets num">{h.setList.map((st, i) => <span key={i}>{setText(st, ex, unit)}</span>)}</div>
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
