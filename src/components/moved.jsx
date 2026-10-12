import { useMemo, useState } from 'preact/hooks';
import { movedTotals, comparisons, countText, PERIODS, PERIOD_PHRASE } from '../lib/moved.js';
import { fmtW, plural } from '../lib/util.js';

const mem = { period: 'week', k: 0 };

// Total weight moved over a few time frames, shown as everyday objects (tap for another one)
export function MovedCard({ workouts, exercises, unit, weekStart }) {
  const totals = useMemo(() => movedTotals(workouts, exercises, weekStart), [workouts, exercises, weekStart]);
  const [period, setPeriod] = useState(mem.period);
  const [k, setK] = useState(mem.k);
  const t = totals[period];
  const opts = comparisons(t.kg);
  const o = opts.length ? opts[k % opts.length] : null;
  return (
    <section class="moved" aria-label="Weight moved">
      <div class="moved-top">
        <span class="moved-l">Weight moved</span>
        <div class="moved-periods" role="tablist">
          {PERIODS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={period === key} class={period === key ? 'on' : ''}
              onClick={() => { mem.period = key; mem.k = 0; setPeriod(key); setK(0); }}>{label}</button>
          ))}
        </div>
      </div>
      <div class="moved-v num">{fmtW(t.kg, unit)}</div>
      {o ? (
        <button class="moved-cmp" onClick={() => { mem.k = k + 1; setK(k + 1); }} aria-label={`That's about ${countText(t.kg, o)}. Tap for another comparison.`}>
          <span>That’s about <strong>{countText(t.kg, o)}</strong></span>
          {opts.length > 1 && <span class="moved-more">Another</span>}
        </button>
      ) : (
        <p class="moved-cmp muted">{t.workouts ? 'Lift something heavier than a banana to unlock comparisons.' : `Nothing logged ${PERIOD_PHRASE[period]} yet.`}</p>
      )}
      {t.workouts > 0 && <p class="small muted">{plural(t.workouts, 'workout')} {PERIOD_PHRASE[period]}</p>}
    </section>
  );
}

// One line for the workout summary
export function movedLine(kg, seed = '') {
  const opts = comparisons(kg);
  if (!opts.length) return null;
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return countText(kg, opts[h % Math.min(3, opts.length)]);
}
