import { useEffect, useState } from 'preact/hooks';
import { PREVIEW_IDS } from '../data/previews.js';
import { openSheet, Icon, push } from '../ui.jsx';

// Exercise photos and instructions come from free-exercise-db (Unlicense), resized into ex/.
export const hasPreview = (id) => PREVIEW_IDS.has(id);
const src = (id, f) => `ex/${id}-${f}.jpg`;

let guide = null;
let guideP = null;
function loadGuide() {
  if (guide) return Promise.resolve(guide);
  if (!guideP) {
    guideP = fetch('ex/guide.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((g) => (guide = g))
      .catch((e) => { guideP = null; throw e; });
  }
  return guideP;
}

export function ExThumb({ ex, onClick, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  if (!hasPreview(ex.id) || broken) {
    return <span class={'thumb thumb-' + size + ' thumb-empty'} aria-hidden="true">{ex.name.slice(0, 1)}</span>;
  }
  const img = <img src={src(ex.id, 't')} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
  if (!onClick) return <span class={'thumb thumb-' + size}>{img}</span>;
  return (
    <button class={'thumb thumb-' + size} aria-label={`How to do ${ex.name}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {img}
      <span class="thumb-play"><Icon name="play" size={10} fill="currentColor" stroke={0} /></span>
    </button>
  );
}

// Start and end positions, alternating like a two-frame animation
export function ExFrames({ id }) {
  return (
    <div class="frames">
      <img src={src(id, 0)} alt="Start position" decoding="async" />
      <img src={src(id, 1)} alt="End position" decoding="async" class="frame-b" />
    </div>
  );
}

export function ExGuide({ id }) {
  const [steps, setSteps] = useState(guide ? guide[id] || [] : null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (steps) return;
    loadGuide().then((g) => setSteps(g[id] || [])).catch(() => setErr(true));
  }, [id]);
  if (err) return <p class="small muted">Instructions load when you’re online.</p>;
  if (!steps) return <p class="small muted">Loading instructions…</p>;
  if (!steps.length) return null;
  return (
    <ol class="guide">
      {steps.map((t, i) => <li key={i}>{t}</li>)}
    </ol>
  );
}

export function previewSheet(ex) {
  if (!hasPreview(ex.id)) { push('exercise', { id: ex.id }); return; }
  openSheet((close) => (
    <div class="sheet-pad">
      <div class="row-between">
        <h3 class="sheet-title">{ex.name}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <ExFrames id={ex.id} />
      <ExGuide id={ex.id} />
      <button class="btn full mt-16" onClick={() => { close(); push('exercise', { id: ex.id }); }}>History and records</button>
    </div>
  ), { tall: false });
}
