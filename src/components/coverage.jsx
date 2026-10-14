import { useMemo, useState } from 'preact/hooks';
import { MUSCLES, MUSCLE_NAME } from '../data/exercises.js';
import { planCoverage, band, MAJOR } from '../lib/coverage.js';
import { heatLevel, HEAT_LABELS } from '../lib/calc.js';
import { fmtNum } from '../lib/util.js';
import { Icon } from '../ui.jsx';
import { useStore } from '../store.js';
import { BodyFigure } from './body.jsx';
import { Why } from './why.jsx';

const ICON = { gap: 'x', low: 'arrowDown', mod: 'info', high: 'arrowUp', balance: 'swap', info: 'info', ok: 'check' };

export function HeatLegend() {
  return (
    <div class="heat-legend" aria-label="Sets per week">
      <span class="small muted">Sets per week</span>
      <div class="heat-steps">
        {HEAT_LABELS.map((l, i) => (
          <span key={l} class="heat-step"><i style={{ background: `var(--heat-${i})` }} /><span class="small num">{l}</span></span>
        ))}
      </div>
    </div>
  );
}

// Body map and findings for a planned week of training
export function Coverage({ sessions, exercises, sex = 'male', note, children }) {
  const goal = useStore().settings.goal;
  const cov = useMemo(() => planCoverage(sessions, exercises, goal), [sessions, exercises, goal]);
  const [sel, setSel] = useState(null);
  const [all, setAll] = useState(false);
  const levels = Object.fromEntries(MUSCLES.map(([k]) => [k, heatLevel(cov.muscles[k].sets)]));
  const top = (k) => Object.entries(cov.muscles[k].ex).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => (exercises[id] ? exercises[id].name : '')).filter(Boolean);
  const pick = (info) => setSel((x) => (x && x.key === info.key ? null : info));
  return (
    <section class="panel cov" aria-label="Weekly coverage">
      <div class="panel-head">
        <h3 class="cov-title">Weekly coverage</h3>
        <Why id="volume" />
      </div>
      {note && <p class="small muted">{note}</p>}
      {children}
      {!cov.total ? <p class="muted pad-x">Add exercises to see which muscles this trains.</p> : (
        <>
          <div class="bodies">
            <figure><BodyFigure side="front" sex={sex} levels={levels} selected={sel && sel.key} onSelect={pick} /></figure>
            <figure><BodyFigure side="back" sex={sex} levels={levels} selected={sel && sel.key} onSelect={pick} /></figure>
          </div>
          <HeatLegend />
          {sel && (
            <div class="muscle-detail">
              <div class="row-between">
                <strong class="md-name">{sel.label}</strong>
                <button class="icon-btn sm" aria-label="Clear selection" onClick={() => setSel(null)}><Icon name="x" size={18} /></button>
              </div>
              {sel.muscles.map((k) => {
                const st = cov.muscles[k];
                const b = band(st.sets);
                return (
                  <div key={k} class="md-line">
                    {sel.muscles.length > 1 && <span class="md-sub">{MUSCLE_NAME[k]}</span>}
                    <p class="small"><strong class="num">{fmtNum(st.sets)}</strong> sets a week{st.days ? `, main target on ${st.days} day${st.days > 1 ? 's' : ''}` : ''}. <span class={'band b-' + b.key}>{b.label}</span></p>
                    {top(k).length > 0 && <p class="small muted">From {top(k).join(', ')}.</p>}
                  </div>
                );
              })}
            </div>
          )}
          <ul class="findings">
            {cov.findings.map((f, i) => (
              <li key={i} class={'finding f-' + f.kind}>
                <span class="f-ic"><Icon name={ICON[f.kind]} size={15} stroke={2.4} /></span>
                <span class="f-text">
                  <strong>{f.title}</strong>
                  <span class="small muted">{f.body} <Why id={f.why} /></span>
                </span>
              </li>
            ))}
          </ul>
          <button class="link" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Hide' : 'Show'} all muscles <Icon name={all ? 'up' : 'down'} size={16} /></button>
          {all && (
            <table class="m-table">
              <thead><tr><th>Muscle</th><th class="r">Sets/wk</th><th class="r">Days</th><th class="r">Band</th></tr></thead>
              <tbody>
                {MUSCLES.map(([k, n]) => ({ k, n, ...cov.muscles[k] })).sort((a, b) => b.sets - a.sets).map((r) => {
                  const b = band(r.sets);
                  return (
                    <tr key={r.k}>
                      <td><i class="sw" style={{ background: `var(--heat-${levels[r.k]})` }} />{r.n}{!MAJOR.includes(r.k) && <span class="muted small"> *</span>}</td>
                      <td class="r num">{fmtNum(r.sets)}</td>
                      <td class="r num">{r.days || '–'}</td>
                      <td class="r small"><span class={'band b-' + b.key}>{b.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {all && <p class="small muted">* Usually trained indirectly by bigger lifts, so not flagged.</p>}
        </>
      )}
    </section>
  );
}
