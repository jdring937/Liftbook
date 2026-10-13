import { useMemo } from 'preact/hooks';
import { startDeload, endDeload, dismiss } from '../store.js';
import { insights, painHistory, painCheck } from '../lib/insights.js';
import { fmtDate, DAY } from '../lib/util.js';
import { Icon, push, toast } from '../ui.jsx';
import { Why } from './why.jsx';

const pct = (x) => `${Math.round(x * 100)}%`;
const weekKey = (now) => Math.floor(now / (7 * DAY));
const listNames = (a) => (a.length <= 2 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

function Card({ kind, icon, title, children, actions, onDismiss }) {
  return (
    <section class={'insight i-' + kind}>
      <div class="insight-top">
        <span class="insight-ic"><Icon name={icon} size={17} stroke={2.2} /></span>
        <strong class="insight-title">{title}</strong>
        {onDismiss && <button class="icon-btn sm" aria-label="Dismiss" onClick={onDismiss}><Icon name="x" size={16} /></button>}
      </div>
      <div class="insight-body small">{children}</div>
      {actions && <div class="insight-actions">{actions}</div>}
    </section>
  );
}

// Deload, decline, stall and pain nudges
export function Insights({ s, exercises, max = 3 }) {
  const now = Date.now();
  const ins = useMemo(() => insights(s, exercises, now), [s.workouts, exercises, s.settings.formula, s.settings.deloadUntil, s.settings.lastDeload]);
  const dis = s.meta.dismissed || {};
  const isDismissed = (k, days) => dis[k] && now - dis[k] < days * DAY;
  const cards = [];

  if (ins.deloading) {
    cards.push(
      <Card key="deloading" kind="deload" icon="timer" title={`Deload week until ${fmtDate(s.settings.deloadUntil)}`}
        actions={<><button class="btn sm" onClick={() => { endDeload(); toast('Deload ended'); }}>End early</button><Why id="deload" /></>}>
        Workouts start with about half the sets. Keep your usual weights and stop 3–4 reps short of failure.
      </Card>,
    );
  } else if (ins.suggestDeload && !isDismissed('deload:' + weekKey(now), 7)) {
    const names = ins.declining.slice(0, 3).map((l) => `${l.name} (−${pct(l.drop)})`);
    cards.push(
      <Card key="deload" kind="warn" icon="arrowDown" title="Time for a lighter week?" onDismiss={() => dismiss('deload:' + weekKey(now))}
        actions={<><button class="btn btn-primary sm" onClick={() => { startDeload(7); toast('Deload week started'); }}>Start a deload week</button><Why id="deload" /></>}>
        {ins.declining.length >= 2
          ? <>{listNames(names)} have trended down for 3 sessions. Several lifts dropping together often points to accumulated fatigue rather than lost strength.</>
          : <>{names[0]} has trended down for 3 sessions, and you’ve trained {ins.streak} weeks straight.</>}
      </Card>,
    );
  } else {
    for (const l of ins.declining) {
      if (isDismissed('decl:' + l.exId, 14)) continue;
      cards.push(
        <Card key={'d' + l.exId} kind="warn" icon="arrowDown" title={`${l.name} has dipped`} onDismiss={() => dismiss('decl:' + l.exId)}
          actions={<><button class="link" onClick={() => push('exercise', { id: l.exId })}>See trend</button><Why id="trend" /></>}>
          Estimated 1RM is {pct(l.drop)} below its recent best for 3 sessions. One lift sliding is often sleep, stress or a bad day; if others follow, a lighter week can help.
        </Card>,
      );
    }
  }
  for (const l of ins.stalled) {
    if (isDismissed('stall:' + l.exId, 30)) continue;
    cards.push(
      <Card key={'s' + l.exId} kind="info" icon="info" title={`${l.name} has stalled`} onDismiss={() => dismiss('stall:' + l.exId)}
        actions={<><button class="link" onClick={() => push('exercise', { id: l.exId })}>See trend</button><Why id="variation" /></>}>
        No new best in {l.weeks} weeks. Trying a different rep range or a close variation for a few weeks is a common fix.
      </Card>,
    );
  }
  // pain flags from the last two weeks
  const painIds = new Set();
  for (const w of s.workouts) if (w.start > now - 14 * DAY) for (const e of w.exercises) if (e.pain != null) painIds.add(e.exId);
  for (const id of painIds) {
    const pc = painCheck(painHistory(s.workouts, id), now);
    if (!pc || !(pc.over || pc.rising) || isDismissed('pain:' + id, 7)) continue;
    const ex = exercises[id];
    cards.push(
      <Card key={'p' + id} kind="pain" icon="flame" title={`Pain on ${ex ? ex.name : 'an exercise'}`} onDismiss={() => dismiss('pain:' + id)}
        actions={<><button class="link" onClick={() => push('exercise', { id })}>See history</button><Why id="pain" /></>}>
        {pc.over ? `Last logged at ${pc.last.v}/10, above the 5/10 limit used in the pain-monitoring model.` : 'Pain is creeping up week to week.'} Consider easing the load or range, and see a clinician if it persists.
      </Card>,
    );
  }
  if (!cards.length) return null;
  return <div class="insights">{cards.slice(0, max)}</div>;
}
