import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, addPhoto, deletePhoto, photoBlob, getState } from '../store.js';
import { loadImage, drawScaled, makeVersions } from '../lib/image.js';
import { makeZip, readZip } from '../lib/zip.js';
import { fromKg, round, fmtDateShort, fmtDateYear, DAY, plural } from '../lib/util.js';
import { Icon, Header, Seg, Chips, push, pop, openSheet, confirmSheet, toast } from '../ui.jsx';
import { unlockAudio } from './workout.jsx';

export const POSES = [['front', 'Front'], ['side', 'Side'], ['back', 'Back']];
const POSE_NAME = Object.fromEntries(POSES);
const ASPECT = 3 / 4;
const mem = { pose: 'all', cmpPose: 'front', mode: 'slider', ghost: 0.35, timer: 0, facing: 'user' };

// object URL for a stored photo, released when the component goes away
export function usePhotoURL(id, thumb = false) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u = null, live = true;
    if (!id) { setUrl(null); return undefined; }
    photoBlob(id, thumb).then((b) => { if (b && live) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => {});
    // release a little later so an <img> that is being swapped out never points at a dead URL
    return () => { live = false; if (u) setTimeout(() => URL.revokeObjectURL(u), 3000); };
  }, [id, thumb]);
  return url;
}

function Thumb({ p, onClick, sel }) {
  const url = usePhotoURL(p.id, true);
  return (
    <button class={'ph-thumb' + (sel ? ' sel' : '')} onClick={onClick} aria-label={`${POSE_NAME[p.pose] || 'Photo'}, ${fmtDateShort(p.t)}`}>
      {url ? <img src={url} alt="" /> : <span class="ph-ph" />}
      <span class="ph-tag">{POSE_NAME[p.pose] || ''}</span>
    </button>
  );
}

// Hand photos to the iPhone share sheet, where "Save Image" puts them in the Photos app.
// A web app can't write to the Photos library directly.
export async function saveToPhotos(photos) {
  const files = [];
  for (const p of photos) {
    const b = await photoBlob(p.id);
    if (b) files.push(new File([b], `swellness-${new Date(p.t).toISOString().slice(0, 10)}-${p.pose}.jpg`, { type: 'image/jpeg' }));
  }
  if (!files.length) return;
  try {
    if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files }); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  // fallback: download each file
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

function bodyweightNear(t) {
  const w = getState().body.filter((b) => b.kind === 'weight' && Math.abs(b.t - t) < 4 * DAY);
  if (!w.length) return null;
  return w.sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0].v;
}

function viewer(p) {
  openSheet((close) => <Viewer p={p} close={close} />, { tall: true });
}
function Viewer({ p, close }) {
  const url = usePhotoURL(p.id);
  const s = useStore();
  const bw = bodyweightNear(p.t);
  return (
    <div class="form-sheet">
      <div class="form-head row-between">
        <h3 class="sheet-title">{POSE_NAME[p.pose]}, {fmtDateYear(p.t)}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <div class="form-body">
        <div class="ph-full">{url && <img src={url} alt={`${POSE_NAME[p.pose]} progress photo from ${fmtDateYear(p.t)}`} />}</div>
        {bw && <p class="small muted">Bodyweight that week: {round(fromKg(bw, s.settings.unit), 1)} {s.settings.unit}</p>}
        <div class="stack-8">
          <button class="btn" onClick={() => saveToPhotos([p])}><Icon name="share" size={18} /> Save to Photos app</button>
          <button class="btn" onClick={() => { close(); push('compare', { after: p.id }); }}><Icon name="swap" size={18} /> Compare with another photo</button>
          <button class="btn btn-ghost danger" onClick={async () => {
            if (await confirmSheet({ title: 'Delete this photo?', body: 'It’s removed from this phone for good.', confirm: 'Delete photo', danger: true })) { await deletePhoto(p.id); close(); toast('Photo deleted'); }
          }}>Delete photo</button>
        </div>
      </div>
    </div>
  );
}

// import from the photo library (or the camera on devices without live camera access)
async function importFiles(files, pose) {
  let n = 0;
  for (const f of files) {
    try {
      const img = await loadImage(f);
      const c = drawScaled(img, img.naturalWidth, img.naturalHeight, { max: 1440 });
      URL.revokeObjectURL(img.src);
      const v = await makeVersions(c);
      const t = f.lastModified && f.lastModified < Date.now() + DAY ? f.lastModified : Date.now();
      await addPhoto({ t, pose, w: v.w, h: v.h }, v.full, v.thumb);
      n++;
    } catch (e) { console.error(e); }
  }
  if (n) toast(`Added ${plural(n, 'photo')}`);
  else toast('That image couldn’t be read');
}

export function PhotosPanel({ s }) {
  const [pose, setPose] = useState(mem.pose);
  const list = [...s.photos].filter((p) => pose === 'all' || p.pose === pose).sort((a, b) => b.t - a.t);
  const days = [];
  for (const p of list) {
    const k = new Date(p.t).toDateString();
    const last = days[days.length - 1];
    if (last && last.k === k) last.items.push(p); else days.push({ k, t: p.t, items: [p] });
  }
  const canCompare = POSES.some(([k]) => s.photos.filter((p) => p.pose === k).length >= 2);
  return (
    <div class="stack-16">
      <div class="btn-pair">
        <button class="btn btn-primary" onClick={() => { unlockAudio(); push('camera'); }}><Icon name="plus" size={20} /> Take photos</button>
        <button class="btn" disabled={!canCompare} onClick={() => push('compare', {})}><Icon name="swap" size={20} /> Compare</button>
      </div>
      {s.photos.length > 0 && <Chips options={[['all', 'All'], ...POSES]} value={pose} onChange={(v) => { mem.pose = v; setPose(v); }} />}
      {days.map((d) => (
        <section key={d.k}>
          <div class="row-between ph-day-head">
            <h2 class="h-sec ph-day">{fmtDateYear(d.t)}</h2>
            <button class="link small" onClick={() => saveToPhotos(d.items)}><Icon name="share" size={15} /> Save to Photos</button>
          </div>
          <div class="ph-grid">{d.items.map((p) => <Thumb key={p.id} p={p} onClick={() => viewer(p)} />)}</div>
        </section>
      ))}
      {!s.photos.length && (
        <div class="empty">
          <div class="empty-title">No progress photos yet</div>
          <p class="muted">Take front, side and back photos every few weeks in the same spot and light. When you take a new one, the camera shows a faint outline of your last photo so you can line up the same pose.</p>
        </div>
      )}
      <p class="small muted">Photos are kept privately inside Swellness on this phone, not in your Photos app or iCloud. Tap “Save to Photos” on any day or photo to copy it there. They aren’t in the regular backup; export them in Settings, and note that removing the app from your Home Screen deletes them.</p>
    </div>
  );
}

// ---------- camera with ghost overlay ----------
export function CameraScreen() {
  const s = useStore();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [pose, setPose] = useState('front');
  const [facing, setFacing] = useState(mem.facing);
  const [ghost, setGhost] = useState(mem.ghost);
  const [timer, setTimer] = useState(mem.timer);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState(null);
  const [shot, setShot] = useState(null); // { canvas, url }
  const [session, setSession] = useState([]); // photos taken on this screen
  const lastSame = [...s.photos].filter((p) => p.pose === pose).sort((a, b) => b.t - a.t)[0];
  const ghostUrl = usePhotoURL(lastSame && lastSame.id);
  const takenToday = s.photos.filter((p) => new Date(p.t).toDateString() === new Date().toDateString()).map((p) => p.pose);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setErr(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setErr('unsupported'); return; }
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (cancelled) { st.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = st;
        if (videoRef.current) { videoRef.current.srcObject = st; videoRef.current.play().catch(() => {}); }
      } catch (e) { setErr(e && e.name === 'NotAllowedError' ? 'denied' : 'failed'); }
    }
    start();
    return () => { cancelled = true; if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [facing]);

  const beep = (f = 880) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.12);
      setTimeout(() => ctx.close(), 400);
    } catch (e) { /* no sound */ }
  };
  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = drawScaled(v, v.videoWidth, v.videoHeight, { max: 1440, aspect: ASPECT, mirror: facing === 'user' });
    setShot({ canvas: c, url: c.toDataURL('image/jpeg', 0.8) });
  };
  const shutter = () => {
    if (!timer) { capture(); return; }
    let n = timer;
    setCount(n);
    const tick = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(tick); setCount(0); beep(1320); capture(); } else { setCount(n); beep(); }
    }, 1000);
    beep();
  };
  const save = async () => {
    const v = await makeVersions(shot.canvas);
    const id = await addPhoto({ t: Date.now(), pose, w: v.w, h: v.h }, v.full, v.thumb);
    setSession((x) => [...x, { id, t: Date.now(), pose }]);
    toast(`${POSE_NAME[pose]} photo saved in Swellness`);
    setShot(null);
    const next = POSES.map(([k]) => k).find((k) => k !== pose && !takenToday.includes(k));
    if (next) setPose(next);
  };

  return (
    <div class="screen-body cam">
      <Header title="Progress photos" onBack={pop} />
      <div class="pad-16 stack-12">
        <Seg options={POSES} value={pose} onChange={setPose} />
        <div class="cam-frame">
          {!err && <video ref={videoRef} playsInline muted autoPlay class={facing === 'user' ? 'mirror' : ''} />}
          {shot ? <img class="cam-shot" src={shot.url} alt="Captured photo" /> : (
            <>
              {err && (
                <div class="cam-err">
                  <p>{err === 'denied' ? 'Camera access is off for this app.' : 'The live camera isn’t available here.'}</p>
                  <p class="small muted">You can still take or choose a photo below{err === 'denied' ? ', or allow the camera in your phone’s settings' : ''}.</p>
                </div>
              )}
              {ghostUrl && ghost > 0 && <img class="cam-ghost" src={ghostUrl} alt="" style={{ opacity: ghost }} />}
              {!lastSame && !err && <div class="cam-guide" aria-hidden="true" />}
              {count > 0 && <div class="cam-count num" aria-live="assertive">{count}</div>}
            </>
          )}
        </div>
        {shot ? (
          <div class="btn-pair">
            <button class="btn" onClick={() => setShot(null)}>Retake</button>
            <button class="btn btn-primary" onClick={save}>Save {POSE_NAME[pose].toLowerCase()} photo</button>
          </div>
        ) : (
          <>
            <div class="cam-controls">
              <button class="icon-btn" aria-label="Switch camera" disabled={!!err} onClick={() => { const f = facing === 'user' ? 'environment' : 'user'; mem.facing = f; setFacing(f); }}><Icon name="swap" /></button>
              <button class="shutter" aria-label="Take photo" disabled={!!err || count > 0} onClick={shutter}><span /></button>
              <button class="icon-btn" aria-label="Choose from library" onClick={() => fileRef.current && fileRef.current.click()}><Icon name="import" /></button>
            </div>
            <div class="cam-opts">
              <label class="cam-opt">
                <span class="small muted">Self-timer</span>
                <Chips options={[[0, 'Off'], [3, '3s'], [10, '10s']]} value={timer} onChange={(v) => { mem.timer = v; setTimer(v); }} />
              </label>
              {lastSame && (
                <label class="cam-opt">
                  <span class="small muted">Outline of your {fmtDateShort(lastSame.t)} photo</span>
                  <input type="range" min="0" max="0.7" step="0.05" value={ghost} aria-label="Outline strength"
                    onInput={(e) => { const g = +e.target.value; mem.ghost = g; setGhost(g); }} />
                </label>
              )}
            </div>
            {session.length > 0 && (
              <button class="btn full" onClick={() => saveToPhotos(session)}><Icon name="share" size={18} /> Also save {session.length === 1 ? 'this photo' : `these ${session.length} photos`} to your Photos app</button>
            )}
            <p class="small muted">Same spot, same light, same distance each time. Line yourself up with the outline, then use the timer and prop the phone up.</p>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" class="sr" onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; if (f.length) importFiles(f, pose); }} />
      </div>
    </div>
  );
}

// ---------- compare ----------
function useImg(id) { return usePhotoURL(id); }

function Picker({ list, value, onPick, label }) {
  return (
    <div class="cmp-pick">
      <span class="small muted">{label}</span>
      <div class="cmp-strip">
        {list.map((p) => <Thumb key={p.id} p={p} sel={p.id === value} onClick={() => onPick(p.id)} />)}
      </div>
    </div>
  );
}

export function CompareScreen({ after: afterId0, before: beforeId0 }) {
  const s = useStore();
  const p0 = afterId0 && s.photos.find((p) => p.id === afterId0);
  const [pose, setPose] = useState(p0 ? p0.pose : mem.cmpPose);
  const list = s.photos.filter((p) => p.pose === pose).sort((a, b) => a.t - b.t);
  const [beforeId, setBefore] = useState(beforeId0 || null);
  const [afterId, setAfter] = useState(afterId0 || null);
  const before = list.find((p) => p.id === beforeId) || list[0];
  const after = list.find((p) => p.id === afterId) || list[list.length - 1];
  const [mode, setMode] = useState(mem.mode);
  const [pos, setPos] = useState(50);
  const [fade, setFade] = useState(50);
  const bUrl = useImg(before && before.id);
  const aUrl = useImg(after && after.id);
  const frame = useRef(null);
  const unit = s.settings.unit;
  const drag = (e) => {
    const r = frame.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };
  const weeks = before && after ? Math.round((after.t - before.t) / (7 * DAY)) : 0;
  const bwB = before && bodyweightNear(before.t), bwA = after && bodyweightNear(after.t);
  return (
    <div class="screen-body">
      <Header title="Compare" onBack={pop} />
      <div class="pad-16 stack-12">
        <Seg options={POSES} value={pose} onChange={(v) => { mem.cmpPose = v; setPose(v); setBefore(null); setAfter(null); }} />
        {list.length < 2 ? <p class="muted">Take at least two {POSE_NAME[pose].toLowerCase()} photos to compare them.</p> : (
          <>
            <div class="cmp-meta">
              <span><strong>{fmtDateShort(before.t)}</strong>{bwB ? ` · ${round(fromKg(bwB, unit), 1)} ${unit}` : ''}</span>
              <span class="muted small">{weeks ? plural(weeks, 'week') : 'Same week'}</span>
              <span><strong>{fmtDateShort(after.t)}</strong>{bwA ? ` · ${round(fromKg(bwA, unit), 1)} ${unit}` : ''}</span>
            </div>
            <Seg options={[['slider', 'Slider'], ['fade', 'Fade'], ['side', 'Side by side']]} value={mode} onChange={(v) => { mem.mode = v; setMode(v); }} />
            {mode === 'side' ? (
              <div class="cmp-side">
                <div class="cmp-img">{bUrl && <img src={bUrl} alt={`Before, ${fmtDateShort(before.t)}`} />}</div>
                <div class="cmp-img">{aUrl && <img src={aUrl} alt={`After, ${fmtDateShort(after.t)}`} />}</div>
              </div>
            ) : (
              <div class="cmp-stack" ref={frame}
                onPointerDown={(e) => { if (mode === 'slider') { e.currentTarget.setPointerCapture(e.pointerId); drag(e); } }}
                onPointerMove={(e) => { if (mode === 'slider' && e.buttons) drag(e); }}>
                {bUrl && <img src={bUrl} alt={`Before, ${fmtDateShort(before.t)}`} />}
                {aUrl && <img src={aUrl} alt={`After, ${fmtDateShort(after.t)}`} class="cmp-after"
                  style={mode === 'slider' ? { clipPath: `inset(0 0 0 ${pos}%)` } : { opacity: fade / 100 }} />}
                {mode === 'slider' && <div class="cmp-handle" style={{ left: `${pos}%` }}><span><Icon name="swap" size={16} /></span></div>}
                {mode === 'slider' && <><span class="cmp-l">Before</span><span class="cmp-r">After</span></>}
              </div>
            )}
            {mode === 'slider' && <input type="range" min="0" max="100" value={pos} onInput={(e) => setPos(+e.target.value)} aria-label="Before and after divider" />}
            {mode === 'fade' && <input type="range" min="0" max="100" value={fade} onInput={(e) => setFade(+e.target.value)} aria-label="Blend between before and after" />}
            <Picker list={list} value={before.id} onPick={setBefore} label="Before" />
            <Picker list={list} value={after.id} onPick={setAfter} label="After" />
          </>
        )}
      </div>
    </div>
  );
}

// ---------- export / import ----------
export async function exportPhotosZip() {
  const st = getState();
  const files = [];
  const manifest = [];
  for (const p of st.photos) {
    const b = await photoBlob(p.id);
    if (!b) continue;
    const data = new Uint8Array(await b.arrayBuffer());
    const name = `photos/${new Date(p.t).toISOString().slice(0, 10)}-${p.pose}-${p.id}.jpg`;
    files.push({ name, data });
    manifest.push({ ...p, file: name });
  }
  files.unshift({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ app: 'swellness-photos', version: 1, photos: manifest }, null, 1)) });
  return { blob: makeZip(files), count: manifest.length };
}

export async function importPhotosZip(file) {
  const entries = readZip(await file.arrayBuffer());
  if (!entries['manifest.json']) throw new Error('This isn’t a Swellness photo export.');
  const m = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
  const have = new Set(getState().photos.map((p) => p.id));
  let n = 0;
  for (const p of m.photos || []) {
    if (have.has(p.id) || !entries[p.file]) continue;
    const full = new Blob([entries[p.file]], { type: 'image/jpeg' });
    const img = await loadImage(full);
    const tc = drawScaled(img, img.naturalWidth, img.naturalHeight, { max: 360 });
    URL.revokeObjectURL(img.src);
    const thumb = await new Promise((res) => tc.toBlob(res, 'image/jpeg', 0.78));
    await addPhoto({ id: p.id, t: p.t, pose: p.pose, w: p.w, h: p.h }, full, thumb);
    n++;
  }
  return n;
}
