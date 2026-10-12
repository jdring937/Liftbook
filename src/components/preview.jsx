import { useEffect, useState } from 'preact/hooks';
import { PREVIEW_IDS } from '../data/previews.js';
import { MOVES } from '../data/moves.js';
import { MoveAnim } from './anim.jsx';
import { openSheet, Icon, push, Seg } from '../ui.jsx';

// Previews: animated figures drawn by the app (data/moves.js), plus photos and instructions
// from free-exercise-db (Unlicense) resized into ex/.
export const hasPhotos = (id) => PREVIEW_IDS.has(id);
export const hasMove = (id) => !!MOVES[id];
export const hasPreview = (id) => hasPhotos(id) || hasMove(id);
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
  let inner;
  if (hasPhotos(ex.id) && !broken) inner = <img src={src(ex.id, 't')} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
  else if (hasMove(ex.id)) inner = <MoveAnim move={MOVES[ex.id]} muscles={ex.primary} at={0.55} label="" />;
  else return <span class={'thumb thumb-' + size + ' thumb-empty'} aria-hidden="true">{ex.name.slice(0, 1)}</span>;
  if (!onClick) return <span class={'thumb thumb-' + size}>{inner}</span>;
  return (
    <button class={'thumb thumb-' + size} aria-label={`How to do ${ex.name}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {inner}
      <span class="thumb-play"><Icon name="play" size={10} fill="currentColor" stroke={0} /></span>
    </button>
  );
}

// Start and end positions, alternating like a two-frame flipbook
export function ExFrames({ id }) {
  return (
    <div class="frames">
      <img src={src(id, 0)} alt="Start position" decoding="async" />
      <img src={src(id, 1)} alt="End position" decoding="async" class="frame-b" />
    </div>
  );
}

const pref = { view: 'move' };
// Animation first when there is one, photos one tap away
export function ExVisual({ ex, compact = false }) {
  const both = hasMove(ex.id) && hasPhotos(ex.id);
  const [view, setView] = useState(hasMove(ex.id) ? pref.view : 'photo');
  const v = !hasMove(ex.id) ? 'photo' : !hasPhotos(ex.id) ? 'move' : view;
  return (
    <div class={'ex-visual' + (compact ? ' compact' : '')}>
      {v === 'move'
        ? <MoveAnim move={MOVES[ex.id]} muscles={ex.primary} label={`${ex.name} animation`} />
        : <ExFrames id={ex.id} />}
      {both && (
        <div class="ex-visual-toggle">
          <Seg options={[['move', 'Animation'], ['photo', 'Photos']]} value={v} onChange={(x) => { pref.view = x; setView(x); }} />
        </div>
      )}
      {v === 'move' && !compact && <p class="small muted anim-note">Highlighted: the main muscles worked.</p>}
    </div>
  );
}

export function ExGuide({ id }) {
  const [steps, setSteps] = useState(guide ? guide[id] || [] : null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (steps || !hasPhotos(id)) return;
    loadGuide().then((g) => setSteps(g[id] || [])).catch(() => setErr(true));
  }, [id]);
  if (!hasPhotos(id)) return null;
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
      <ExVisual ex={ex} />
      <ExGuide id={ex.id} />
      <button class="btn full mt-16" onClick={() => { close(); push('exercise', { id: ex.id }); }}>History and records</button>
    </div>
  ));
}
