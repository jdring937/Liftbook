import { useEffect, useRef, useState } from 'preact/hooks';
import { PREVIEW_IDS } from '../data/previews.js';
import { openSheet, Icon, push, toast } from '../ui.jsx';
import { setMedia } from '../store.js';
import { libImg, loadLibrary, searchLibrary, fetchSteps, parseYouTube, ytThumb, ytWatch, ytEmbed, ytLink } from '../lib/media.js';

// Previews: photos and instructions from free-exercise-db (Unlicense). Built-in exercises have theirs
// resized into ex/. Exercises without one can get photos found in the same library (loaded from the
// source and cached once viewed) and/or a YouTube video.
export const hasPhotos = (id) => PREVIEW_IDS.has(id);
const media = (ex) => (ex && ex.media) || {};
export const hasPreview = (ex) => !!ex && (hasPhotos(ex.id) || !!media(ex).src || !!media(ex).yt);
// Built-in photos win; added media is only offered for exercises without them
const photoSrc = (ex) => (hasPhotos(ex.id) ? (f) => `ex/${ex.id}-${f}.jpg` : media(ex).src ? (f) => libImg(media(ex).src, f) : null);
const remote = (ex) => !hasPhotos(ex.id) && !!media(ex).src;

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
  const photos = photoSrc(ex);
  const m = media(ex);
  let inner = null;
  if (photos && !broken) inner = <img src={photos(remote(ex) ? 0 : 't')} alt="" loading="lazy" decoding="async" crossorigin={remote(ex) ? 'anonymous' : undefined} onError={() => setBroken(true)} />;
  else if (m.yt && !broken) inner = <img src={ytThumb(m.yt)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
  else if (m.yt) inner = <span class="thumb-yt"><Icon name="video" size={20} /></span>;
  if (!inner) return <span class={'thumb thumb-' + size + ' thumb-empty'} aria-hidden="true">{ex.name.slice(0, 1)}</span>;
  if (!onClick) return <span class={'thumb thumb-' + size}>{inner}</span>;
  return (
    <button class={'thumb thumb-' + size} aria-label={`How to do ${ex.name}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {inner}
      <span class="thumb-play"><Icon name="play" size={10} fill="currentColor" stroke={0} /></span>
    </button>
  );
}

// Start and end positions, alternating like a two-frame flipbook
export function ExFrames({ src, cors = false }) {
  const [err, setErr] = useState(false);
  if (err) return <div class="frames frames-off"><p class="small muted">Photos load when you’re online.</p></div>;
  const co = cors ? 'anonymous' : undefined;
  return (
    <div class="frames">
      <img src={src(0)} alt="Start position" decoding="async" crossorigin={co} onError={() => setErr(true)} />
      <img src={src(1)} alt="End position" decoding="async" crossorigin={co} class="frame-b" />
    </div>
  );
}

// YouTube: nothing loads from YouTube except the poster until you tap play
export function YouTubeView({ m, title }) {
  const [play, setPlay] = useState(false);
  const [offline, setOffline] = useState(false);
  const [noPoster, setNoPoster] = useState(false);
  return (
    <div class="yt-wrap">
      <div class={'yt' + (m.ytTall ? ' yt-tall' : '')}>
        {play
          ? <iframe src={ytEmbed(m)} title={`${title} video`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerpolicy="strict-origin-when-cross-origin" />
          : (
            <button class="yt-poster" aria-label={`Play video for ${title}`} onClick={() => (navigator.onLine === false ? setOffline(true) : setPlay(true))}>
              {!noPoster && <img src={ytThumb(m.yt)} alt="" decoding="async" onError={() => setNoPoster(true)} />}
              <span class="yt-play"><Icon name="play" size={26} fill="currentColor" stroke={0} /></span>
            </button>
          )}
      </div>
      <div class="yt-foot small">
        <span class="muted">{offline ? 'Videos play when you’re online.' : 'YouTube video'}</span>
        <a href={ytWatch(m)} target="_blank" rel="noopener noreferrer">Open in YouTube <Icon name="external" size={14} /></a>
      </div>
    </div>
  );
}

export function ExVisual({ ex, compact = false }) {
  const photos = photoSrc(ex);
  const m = media(ex);
  return (
    <div class={'ex-visual' + (compact ? ' compact' : '')}>
      {photos && <ExFrames key={ex.id + (m.src || '')} src={photos} cors={remote(ex)} />}
      {m.yt && <YouTubeView key={m.yt} m={m} title={ex.name} />}
    </div>
  );
}

export function ExGuide({ ex }) {
  const builtIn = hasPhotos(ex.id);
  const [steps, setSteps] = useState(builtIn ? (guide ? guide[ex.id] || [] : null) : media(ex).steps || []);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!builtIn) { setSteps(media(ex).steps || []); return; }
    if (steps) return;
    loadGuide().then((g) => setSteps(g[ex.id] || [])).catch(() => setErr(true));
  }, [ex.id, media(ex).steps]);
  if (err) return <p class="small muted">Instructions load when you’re online.</p>;
  if (!steps) return <p class="small muted">Loading instructions…</p>;
  if (!steps.length) return null;
  return (
    <ol class="guide">
      {steps.map((t, i) => <li key={i}>{t}</li>)}
    </ol>
  );
}
export const hasSteps = (ex) => hasPhotos(ex.id) || !!(media(ex).steps && media(ex).steps.length);

export function previewSheet(ex) {
  if (!hasPreview(ex)) { push('exercise', { id: ex.id }); return; }
  openSheet((close) => (
    <div class="sheet-pad">
      <div class="row-between">
        <h3 class="sheet-title">{ex.name}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <ExVisual ex={ex} />
      <ExGuide ex={ex} />
      <button class="btn full mt-16" onClick={() => { close(); push('exercise', { id: ex.id }); }}>History and records</button>
    </div>
  ));
}

// ---------- finding a preview in the library ----------
function LibraryRow({ r, open, onToggle, onUse }) {
  const [broken, setBroken] = useState(false);
  return (
    <div class={'pick-item' + (open ? ' open' : '')}>
      <div class="pick-row">
        <span class="thumb thumb-sm">
          {!broken ? <img src={libImg(r.id, 0)} alt="" loading="lazy" decoding="async" crossorigin="anonymous" onError={() => setBroken(true)} /> : null}
        </span>
        <button class="pick-main" onClick={onToggle} aria-expanded={open}>
          <span class="pick-name">{r.name}</span>
          <span class="muted small">{[r.equipment, r.muscles].filter(Boolean).join(' · ')}</span>
        </button>
      </div>
      {open && (
        <div class="peek">
          <ExFrames src={(f) => libImg(r.id, f)} cors />
          {r.ours && <p class="small muted">Swellness already has this one built in. You can still use its photos here.</p>}
          <button class="btn btn-primary sm full" onClick={onUse}>Use this preview</button>
        </div>
      )}
    </div>
  );
}

export function LibrarySearch({ query = '', close, onPick }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState(query);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadLibrary().then(setRows).catch(() => setErr(true)); }, []);
  const hits = rows ? searchLibrary(rows, q) : [];
  const use = async (r) => {
    setBusy(true);
    let steps = [];
    try { steps = await fetchSteps(r.id); } catch { /* photos still work; steps are optional */ }
    setBusy(false);
    onPick({ src: r.id, srcName: r.name, steps });
    close();
  };
  return (
    <div class="picker">
      <div class="picker-head">
        <div class="row-between">
          <h3 class="sheet-title">Find a preview</h3>
          <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
        </div>
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search the exercise library" value={q} onInput={(e) => { setQ(e.target.value); setOpen(null); }} aria-label="Search the exercise library" />
        </label>
      </div>
      <div class="picker-list">
        <p class="pick-hint small muted">Photos and steps from free-exercise-db, a free library of {rows ? rows.length : 'about 870'} exercises. Pick the closest match.</p>
        {err && <p class="muted pad-16">The library needs an internet connection. Try again when you’re online.</p>}
        {!rows && !err && <p class="muted pad-16">Loading the library…</p>}
        {hits.map((r) => <LibraryRow key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} onUse={() => !busy && use(r)} />)}
        {rows && !hits.length && <p class="muted pad-16">Nothing in the library matches “{q}”. Try fewer or different words, or add a YouTube video instead.</p>}
      </div>
    </div>
  );
}
export function openLibrary(query, onPick) {
  openSheet((close) => <LibrarySearch query={query} close={close} onPick={onPick} />, { tall: true });
}

// ---------- editing an exercise's added preview ----------
// Fields for the exercise form and the preview sheet. value: the media object (or null).
export function MediaFields({ name, value, onChange }) {
  const m = value || {};
  const cur = useRef(m);
  cur.current = m;
  const [yt, setYt] = useState(ytLink(m));
  const parsed = parseYouTube(yt);
  const find = () => openLibrary(name, (picked) => onChange({ ...cur.current, ...picked }));
  return (
    <>
      <div class="field">
        <span>Photos and steps <em class="muted">from a free exercise library</em></span>
        {m.src ? (
          <div class="media-pick">
            <span class="thumb thumb-sm"><img src={libImg(m.src, 0)} alt="" crossorigin="anonymous" /></span>
            <span class="media-pick-name">{m.srcName}</span>
            <button class="btn sm" onClick={find}>Change</button>
            <button class="icon-btn" aria-label="Remove photos" onClick={() => onChange({ ...m, src: null, srcName: null, steps: null })}><Icon name="x" size={20} /></button>
          </div>
        ) : (
          <button class="btn sm media-find" onClick={find}><Icon name="search" size={16} /> Find a preview</button>
        )}
      </div>
      <label class="field">
        <span>YouTube video</span>
        <input type="url" inputmode="url" autocomplete="off" placeholder="Paste a YouTube link" value={yt} aria-label="YouTube link"
          onInput={(e) => {
            const v = e.target.value;
            setYt(v);
            const p = parseYouTube(v);
            onChange({ ...cur.current, yt: p ? p.id : null, ytStart: p ? p.start : 0, ytTall: p ? p.tall : false });
          }} />
        {yt.trim() && !parsed && <em class="field-err">That doesn’t look like a YouTube link.</em>}
        {parsed && <em class="field-ok">Video found{parsed.start ? `, starts at ${Math.floor(parsed.start / 60)}:${String(parsed.start % 60).padStart(2, '0')}` : ''}.</em>}
      </label>
    </>
  );
}

const clean = (m) => (m && (m.src || m.yt) ? Object.fromEntries(Object.entries(m).filter(([, v]) => v != null && v !== '')) : null);
export const cleanMedia = clean;

export function openMediaSheet(ex) {
  openSheet((close) => <MediaSheet ex={ex} close={close} />, { tall: true });
}
function MediaSheet({ ex, close }) {
  const [m, setM] = useState(ex.media || null);
  return (
    <div class="form-sheet">
      <div class="form-head row-between">
        <h3 class="sheet-title">Preview for {ex.name}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <div class="form-body">
        <MediaFields name={ex.name} value={m} onChange={setM} />
      </div>
      <div class="picker-foot">
        <button class="btn btn-primary full" onClick={() => { setMedia(ex.id, clean(m)); toast(clean(m) ? 'Preview saved' : 'Preview removed'); close(); }}>Save preview</button>
      </div>
    </div>
  );
}

// Exercise page panel for exercises without built-in photos
export function AddedPreviewPanel({ ex, openSteps }) {
  if (!hasPreview(ex)) {
    return (
      <section class="panel media-empty">
        <p class="small muted">No preview for this exercise yet.</p>
        <div class="media-actions">
          <button class="btn sm" onClick={() => openLibrary(ex.name, (picked) => { setMedia(ex.id, clean({ ...(ex.media || {}), ...picked })); toast('Preview added'); })}>
            <Icon name="search" size={16} /> Find a preview
          </button>
          <button class="btn sm" onClick={() => openMediaSheet(ex)}><Icon name="video" size={16} /> Add a video</button>
        </div>
      </section>
    );
  }
  return (
    <section class="panel">
      <ExVisual ex={ex} />
      {hasSteps(ex) && (
        <details class="how" open={openSteps}>
          <summary>How to do it</summary>
          <ExGuide ex={ex} />
        </details>
      )}
      <div class="media-meta small">
        <span class="muted">{media(ex).src ? `Photos: ${media(ex).srcName}` : ''}</span>
        <button class="link-btn" onClick={() => openMediaSheet(ex)}>Change preview</button>
      </div>
    </section>
  );
}
