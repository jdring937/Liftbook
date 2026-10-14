import { useState } from 'preact/hooks';
import { EVIDENCE, EVIDENCE_ORDER } from '../data/evidence.js';
import { Icon, Header, openSheet, pop } from '../ui.jsx';
import { useStore } from '../store.js';
import { RestSetting, JumpSetting, EffortSetting } from '../screens/settings.jsx';
import { GoalBanner } from './trainingGoal.jsx';

const SETTING = { rest: RestSetting, progression: JumpSetting, effort: EffortSetting, goal: GoalBanner };
function SettingInline({ which }) {
  const s = useStore();
  const C = SETTING[which];
  return (
    <div class="ev-setting">
      <strong>Your setting</strong>
      <div class="group">{C && <C st={s.settings} why={false} />}</div>
    </div>
  );
}

function EvidenceBody({ e }) {
  return (
    <>
      <p class="ev-summary">{e.summary}</p>
      {e.app && (
        <div class="ev-app">
          <strong>In Swellness</strong>
          <p>{e.app}</p>
          {e.where && <p class="ev-where"><span>Where you’ll see it:</span> {e.where}</p>}
        </div>
      )}
      {e.setting && <SettingInline which={e.setting} />}
      <div class="ev-refs">
        <span class="small muted">Sources</span>
        <ol>
          {e.refs.map((r) => (
            <li key={r.url + r.cite}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.cite}</a></li>
          ))}
        </ol>
      </div>
    </>
  );
}

export function whySheet(id) {
  const e = EVIDENCE[id];
  if (!e) return;
  openSheet((close) => (
    <div class="sheet-pad">
      <div class="row-between">
        <h3 class="sheet-title">{e.title}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <EvidenceBody e={e} />
    </div>
  ));
}

// Small "Why?" link next to a recommendation
export function Why({ id, label = 'Why?' }) {
  return (
    <button class="why" onClick={(ev) => { ev.stopPropagation(); whySheet(id); }} aria-label={`${label}: ${EVIDENCE[id] ? EVIDENCE[id].title : ''}`}>
      <Icon name="info" size={15} /> {label}
    </button>
  );
}

export function EvidenceScreen() {
  const [open, setOpen] = useState(null);
  return (
    <div class="screen-body">
      <Header title="The science" onBack={pop} />
      <div class="pad-16 stack-12">
        <p class="muted">What the research says behind each recommendation, what the app does with it, and where you’ll see it. Topics marked <span class="ev-badge">Setting</span> have a setting you can change right there.</p>
        <div class="list">
          {EVIDENCE_ORDER.map((id) => {
            const e = EVIDENCE[id];
            const on = open === id;
            return (
              <div key={id} class={'ev-item' + (on ? ' open' : '')}>
                <button class="ev-head" aria-expanded={on} onClick={() => setOpen(on ? null : id)}>
                  <span>{e.title}{e.setting && <span class="ev-badge">Setting</span>}</span><Icon name={on ? 'up' : 'down'} size={18} class="muted" />
                </button>
                {on && <div class="ev-body"><EvidenceBody e={e} /></div>}
              </div>
            );
          })}
        </div>
        <p class="small muted">This is general training information, not medical advice. Citations were checked in October 2026.</p>
      </div>
    </div>
  );
}
