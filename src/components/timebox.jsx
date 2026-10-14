import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises } from '../store.js';
import { fitToTime, estimateTemplate, calibration } from '../lib/timebox.js';
import { fmtClock, plural } from '../lib/util.js';
import { Icon, Stepper, openSheet } from '../ui.jsx';
import { Why } from './why.jsx';

export const minText = (sec) => `${Math.max(1, Math.round(sec / 60))} min`;

export function useEstimate(items) {
  const s = useStore();
  const exercises = allExercises(s);
  const cal = useMemo(() => calibration(s.workouts, exercises, s.settings), [s.workouts, exercises, s.settings]);
  const sec = useMemo(() => estimateTemplate(items, exercises, s.settings, cal.k), [items, exercises, s.settings, cal.k]);
  return { sec, cal };
}

function TimeboxSheet({ t, close, onStart }) {
  const s = useStore();
  const exercises = allExercises(s);
  const { sec: full, cal } = useEstimate(t.items);
  const fullMin = Math.round(full / 60);
  const [budget, setBudget] = useState(() => Math.max(10, Math.min(90, Math.floor((fullMin - 5) / 5) * 5 || 30)));
  const res = useMemo(() => fitToTime(t.items, exercises, budget, { settings: s.settings, k: cal.k }), [t.items, exercises, budget, s.settings, cal.k]);
  const changed = res.changes.filter((c) => c.dropped || c.sets[0] !== c.sets[1] || c.rest[0] !== c.rest[1]);
  const fitsAlready = full <= budget * 60;
  return (
    <div class="sheet-pad">
      <div class="row-between">
        <h3 class="sheet-title">Fit it into</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <div class="tb-budget">
        <Stepper value={budget} min={10} max={120} step={5} onChange={setBudget} fmt={(v) => `${v} min`} label="Minutes available" />
        <span class="small muted">Full workout: about {minText(full)}{cal.n >= 3 ? `, based on your last ${cal.n} sessions` : ''}</span>
      </div>
      {fitsAlready ? (
        <p class="tb-ok">The full workout already fits in {budget} minutes.</p>
      ) : (
        <>
          <ul class="tb-list">
            {res.changes.map((c) => {
              const setTxt = c.sets[0] !== c.sets[1] ? `${c.sets[0]} → ${c.sets[1]} sets` : plural(c.sets[1], 'set');
              const restTxt = c.rest[0] !== c.rest[1] ? `rest ${fmtClock(c.rest[0])} → ${fmtClock(c.rest[1])}` : '';
              const touched = c.dropped || c.sets[0] !== c.sets[1] || c.rest[0] !== c.rest[1];
              return (
                <li key={c.exId + c.name} class={'tb-row' + (c.dropped ? ' dropped' : '') + (touched ? ' touched' : '')}>
                  <span class="tb-name">{c.name}</span>
                  <span class="tb-what small">{c.dropped ? 'Left out' : [setTxt, restTxt].filter(Boolean).join(', ')}</span>
                </li>
              );
            })}
          </ul>
          <p class={'tb-est' + (res.fits ? '' : ' warn')}>
            {res.fits ? <>New estimate: <strong>about {minText(res.est)}</strong></> : <>The shortest sensible version is about <strong>{minText(res.est)}</strong>.</>}
          </p>
          <p class="small muted">Compound lifts keep their sets longest. Isolation moves get shorter rest, accessories that repeat a muscle you’ve already trained are dropped, and accessory sets are trimmed before compound sets. <Why id="timeEfficient" /></p>
        </>
      )}
      <button class="btn btn-primary full mt-16" disabled={!res.items.length} onClick={() => { close(); onStart(fitsAlready ? t : { ...t, items: res.items }); }}>
        <Icon name="play" size={18} fill="currentColor" stroke={0} /> {fitsAlready ? 'Start the full workout' : `Start the ${budget}-minute version`}
      </button>
      {!fitsAlready && changed.length > 0 && <p class="small muted mt-8">Your saved workout doesn’t change.</p>}
    </div>
  );
}

export function timeboxSheet(t, onStart) {
  openSheet((close) => <TimeboxSheet t={t} close={close} onStart={onStart} />);
}
