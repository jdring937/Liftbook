import { RULE } from '../lib/rest.js';
import { fmtClock } from '../lib/util.js';
import { Icon, openSheet, push } from '../ui.jsx';
import { Why } from './why.jsx';

// Tapping the rest timer explains exactly which rule picked this rest and why
export function restWhySheet(ruleId, sec) {
  const r = RULE[ruleId];
  if (!r) return;
  openSheet((close) => (
    <div class="sheet-pad">
      <div class="row-between">
        <h3 class="sheet-title">Why {fmtClock(sec)}?</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <div class="rw-rule">
        <span class="small muted">The rule that applied</span>
        <strong>{r.when}</strong>
      </div>
      <p class="ev-summary mt-8">{r.because}</p>
      <div class="row-between mt-16">
        <Why id="rest" label="All the rest rules and sources" />
        <button class="link small" onClick={() => { close(); push('settings'); }}>Settings</button>
      </div>
    </div>
  ));
}
