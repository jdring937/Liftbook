import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises, addBody, deleteBody } from '../store.js';
import { smoothTrend, fitLine, weightRateCheck, SITES, SITE_NAME, fromCm, toCm, lenUnit } from '../lib/goals.js';
import { fromKg, toKg, round, fmtDateShort, fmtDateYear, DAY, plural } from '../lib/util.js';
import { Icon, Seg, Chips, NumInput, confirmSheet, toast } from '../ui.jsx';
import { LineChart } from '../components/charts.jsx';
import { Why } from '../components/why.jsx';
import { GoalCard, goalEditor } from './goals.jsx';
import { PhotosPanel } from './photos.jsx';
import { goalProfile } from '../lib/trainingGoal.js';

const mem = { seg: 'weight', site: 'waist', range: 90 };
const RANGE_OPTS = [[30, '30D'], [90, '90D'], [365, '1Y'], [0, 'All']];
const todayInput = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const inputToT = (v) => { const now = new Date(); const d = new Date(v + 'T00:00:00'); d.setHours(now.getHours(), now.getMinutes()); return d.getTime(); };

function AddRow({ label, unit, onAdd }) {
  const [v, setV] = useState(null);
  const [day, setDay] = useState(todayInput());
  return (
    <div class="body-add">
      <label class="body-add-v"><span class="small muted">{label} ({unit})</span>
        <span class="body-add-in"><NumInput value={v} label={label} placeholder={unit} onChange={setV} onEnter={() => { if (v) { onAdd(v, inputToT(day)); setV(null); } }} /></span>
      </label>
      <label class="body-add-d"><span class="small muted">Date</span>
        <input type="date" value={day} max={todayInput()} onChange={(e) => setDay(e.target.value || todayInput())} aria-label="Date" />
      </label>
      <button class="btn btn-primary" disabled={!v} onClick={() => { onAdd(v, inputToT(day)); setV(null); }}>Log</button>
    </div>
  );
}

function History({ rows, fmt, onDelete }) {
  const [all, setAll] = useState(false);
  const list = [...rows].reverse();
  return (
    <section>
      <h2 class="h-sec">History</h2>
      <div class="list body-hist">
        {(all ? list : list.slice(0, 8)).map((r) => (
          <div key={r.id} class="body-row">
            <span class="small muted">{fmtDateYear(r.t)}</span>
            <span class="num">{fmt(r.v)}</span>
            <button class="icon-btn sm" aria-label={`Delete entry from ${fmtDateShort(r.t)}`} onClick={async () => {
              if (await confirmSheet({ title: 'Delete this entry?', confirm: 'Delete', danger: true })) onDelete(r.id);
            }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
      {list.length > 8 && <button class="link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
    </section>
  );
}

function WeightPanel({ s, exercises }) {
  const unit = s.settings.unit;
  const rows = s.body.filter((b) => b.kind === 'weight');
  const trend = useMemo(() => smoothTrend(rows.map((r) => ({ t: r.t, v: r.v }))), [s.body]);
  const [range, setRange] = useState(mem.range);
  const now = Date.now();
  const since = range ? now - range * DAY : 0;
  const pts = trend.filter((p) => p.t >= since);
  const fit = useMemo(() => fitLine(trend.map((p) => ({ t: p.t, v: p.v })), now, 28), [trend]);
  const last = trend[trend.length - 1];
  const ago = (days) => { const p = [...trend].reverse().find((x) => x.t <= now - days * DAY); return p && last ? last.v - p.v : null; };
  const d7 = ago(7), d30 = ago(30);
  const rate = fit && last ? weightRateCheck(fit.b * 7, last.v, goalProfile(s.settings.goal).pace) : null;
  const goal = s.goals.find((g) => g.type === 'bodyweight');
  const f = (kg) => `${round(fromKg(kg, unit), 1)} ${unit}`;
  const delta = (kg) => (kg == null ? '–' : `${kg >= 0 ? '+' : '−'}${round(Math.abs(fromKg(kg, unit)), 1)}`);
  return (
    <div class="stack-16">
      <section class="panel">
        <AddRow label="Bodyweight" unit={unit} onAdd={(v, t) => { addBody({ t, kind: 'weight', v: toKg(v, unit) }); toast('Weight logged'); }} />
      </section>
      {rows.length > 0 && (
        <section class="panel">
          <div class="stat-row">
            <div><span class="stat-v num">{last ? round(fromKg(last.v, unit), 1) : '–'}</span><span class="stat-l">Trend {unit}</span></div>
            <div><span class="stat-v num">{delta(d7)}</span><span class="stat-l">7 days</span></div>
            <div><span class="stat-v num">{delta(d30)}</span><span class="stat-l">30 days</span></div>
          </div>
          <Chips options={RANGE_OPTS} value={range} onChange={(v) => { mem.range = v; setRange(v); }} class="range-chips" />
          {pts.length > 0
            ? <LineChart points={pts.map((p) => ({ x: p.t, y: fromKg(p.v, unit), label: fmtDateShort(p.t) }))} raw={pts.map((p) => ({ x: p.t, y: fromKg(p.raw, unit) }))}
              fmt={(v) => `${round(v, 1)} ${unit}`} fmtAxis={(v) => round(v, 0)} tipLabel={(p) => `Trend, ${fmtDateShort(p.x)}`} />
            : <p class="muted pad-x">No weigh-ins in this range.</p>}
          <p class="small muted">Dots are weigh-ins; the line is the smoothed trend. <Why id="weighTrend" /></p>
          {rate && (
            <p class={'small rate-inline ' + (rate.ok ? 'ok' : 'warn')}>
              Last 4 weeks: {rate.pct >= 0 ? '+' : '−'}{round(Math.abs(rate.pct), 2)}% of bodyweight a week, {rate.label}. <Why id="weightRate" />
            </p>
          )}
        </section>
      )}
      {goal ? <GoalCard goal={goal} s={s} exercises={exercises} /> : (
        <button class="btn btn-soft full" onClick={() => goalEditor(null, { type: 'bodyweight' })}><Icon name="plus" size={20} /> Set a bodyweight goal</button>
      )}
      {rows.length > 0 && <History rows={rows} fmt={f} onDelete={deleteBody} />}
      {!rows.length && <p class="muted">Log your weight a few times a week, ideally at the same time of day. The trend line smooths out day-to-day water swings.</p>}
    </div>
  );
}

function MeasurePanel({ s, exercises }) {
  const unit = s.settings.unit;
  const lu = lenUnit(unit);
  const [site, setSite] = useState(mem.site);
  const rows = s.body.filter((b) => b.kind === site);
  const f = (cm) => `${round(fromCm(cm, unit), 1)} ${lu}`;
  const latest = SITES.map(([k, n]) => {
    const r = s.body.filter((b) => b.kind === k);
    return r.length ? { k, n, last: r[r.length - 1], first: r[0] } : null;
  }).filter(Boolean);
  const goal = s.goals.find((g) => g.type === 'measure' && g.site === site);
  return (
    <div class="stack-16">
      {latest.length > 0 && (
        <table class="m-table panel-table">
          <thead><tr><th>Site</th><th class="r">Latest</th><th class="r">Change</th><th class="r">Date</th></tr></thead>
          <tbody>
            {latest.map((r) => {
              const d = fromCm(r.last.v - r.first.v, unit);
              return (
                <tr key={r.k} onClick={() => { mem.site = r.k; setSite(r.k); }} class={r.k === site ? 'sel' : ''}>
                  <td>{r.n}</td><td class="r num">{f(r.last.v)}</td>
                  <td class="r num muted">{r.last === r.first ? '–' : `${d >= 0 ? '+' : '−'}${round(Math.abs(d), 1)}`}</td>
                  <td class="r small muted">{fmtDateShort(r.last.t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Chips options={SITES} value={site} onChange={(v) => { mem.site = v; setSite(v); }} class="chips-scroll" />
      <section class="panel">
        <AddRow label={SITE_NAME[site]} unit={lu} onAdd={(v, t) => { addBody({ t, kind: site, v: toCm(v, unit) }); toast(`${SITE_NAME[site]} logged`); }} />
        {rows.length > 1 && (
          <LineChart points={rows.map((r) => ({ x: r.t, y: fromCm(r.v, unit), label: fmtDateShort(r.t) }))} fmt={(v) => `${round(v, 1)} ${lu}`} fmtAxis={(v) => round(v, 1)} tipLabel={(p) => fmtDateShort(p.x)} />
        )}
        <p class="small muted mt-8">Measure at the same spot and time of day each time, with the tape snug but not tight.</p>
      </section>
      {goal ? <GoalCard goal={goal} s={s} exercises={exercises} /> : (
        <button class="btn btn-soft full" onClick={() => goalEditor(null, { type: 'measure', site })}><Icon name="plus" size={20} /> Set a {SITE_NAME[site].toLowerCase()} goal</button>
      )}
      {rows.length > 0 && <History rows={rows} fmt={f} onDelete={deleteBody} />}
    </div>
  );
}

export function BodyScreen() {
  const s = useStore();
  const exercises = allExercises(s);
  const [seg, setSeg] = useState(mem.seg);
  return (
    <div class="page">
      <div class="page-head"><h1 class="h-page">Body</h1></div>
      <Seg options={[['weight', 'Weight'], ['measure', 'Measurements'], ['photos', 'Photos']]} value={seg} onChange={(v) => { mem.seg = v; setSeg(v); }} />
      <div class="mt-16">
        {seg === 'weight' && <WeightPanel s={s} exercises={exercises} />}
        {seg === 'measure' && <MeasurePanel s={s} exercises={exercises} />}
        {seg === 'photos' && <PhotosPanel s={s} />}
      </div>
    </div>
  );
}
