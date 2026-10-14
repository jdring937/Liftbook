import { useState } from 'preact/hooks';
import { useStore, setTrainingGoal, markGoalAsked } from '../store.js';
import { TRAINING_GOALS, GOAL_LABEL, goalChanges, suggestedGoals } from '../lib/trainingGoal.js';
import { Icon, openSheet } from '../ui.jsx';
import { Why } from './why.jsx';
import { goalEditor } from '../screens/goals.jsx';

function GoalSheet({ close, first }) {
  const s = useStore();
  const [picked, setPicked] = useState(null); // shows what changed once a goal is picked
  const goal = s.settings.goal;
  return (
    <div class="form-sheet">
      <div class="form-head row-between">
        <h3 class="sheet-title">{picked ? `${GOAL_LABEL[picked]}: what changes` : 'What’s your main goal?'}</h3>
        <button class="icon-btn" aria-label="Close" onClick={() => { if (first) markGoalAsked(); close(); }}><Icon name="x" /></button>
      </div>
      <div class="form-body">
        {!picked ? (
          <>
            <p class="small muted">Your goal sets evidence-based defaults like rep ranges, rest and the pace of weight change. Change it any time in Settings or Goals.</p>
            <div class="tg-list" role="radiogroup" aria-label="Main goal">
              {TRAINING_GOALS.map((g) => (
                <button key={g.key} role="radio" aria-checked={goal === g.key} class={'tg-opt' + (goal === g.key ? ' on' : '')}
                  onClick={() => { setTrainingGoal(g.key); setPicked(g.key); }}>
                  <strong>{g.label}</strong><span class="small">{g.desc}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <ul class="tg-changes">
              {goalChanges(picked).map((c, i) => (
                <li key={i}><Icon name="check" size={16} stroke={2.4} /><span>{c.text} <Why id={c.why} /></span></li>
              ))}
            </ul>
            <p class="small muted">Workouts you’ve already saved keep their rep ranges. Everything else here applies right away.</p>
            <div class="stack-8">
              <span class="small muted">Want to track it?</span>
              {suggestedGoals(picked).map((sg) => (
                <button key={sg.label} class="btn btn-soft" onClick={() => { close(); goalEditor(null, sg.site ? { type: sg.type, site: sg.site } : { type: sg.type }); }}>
                  <Icon name="plus" size={18} /> {sg.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div class="picker-foot">
        {picked
          ? <button class="btn btn-primary full" onClick={close}>Done</button>
          : first ? <button class="btn btn-ghost full" onClick={() => { markGoalAsked(); close(); }}>Skip for now</button> : null}
      </div>
    </div>
  );
}

export function openGoalSheet(first = false) {
  openSheet((close) => <GoalSheet close={close} first={first} />, { tall: true, onClose: () => first && markGoalAsked() });
}

// Shown at the top of Progress -> Goals
export function GoalBanner() {
  const s = useStore();
  const goal = s.settings.goal;
  return (
    <button class={'tg-banner' + (goal ? '' : ' empty')} onClick={() => openGoalSheet(false)}>
      <span class="tg-banner-l">
        <span class="small muted">Main goal</span>
        <strong>{goal ? GOAL_LABEL[goal] : 'Not set yet'}</strong>
      </span>
      <span class="link">{goal ? 'Change' : 'Choose'} <Icon name="right" size={16} /></span>
    </button>
  );
}
