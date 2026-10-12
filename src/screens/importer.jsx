import { useMemo, useRef, useState } from 'preact/hooks';
import { useStore, allExercises, saveTemplate, saveProgram, saveCustomExercise, TEMPLATE_COLORS, getState } from '../store.js';
import { parseWorkoutText, matchExercise, guessExercise, exerciseUsage, normName } from '../lib/importText.js';
import { plural } from '../lib/util.js';
import { MUSCLE_NAME } from '../data/exercises.js';
import { Icon, Header, Toggle, Stepper, pop, openSheet, toast, plateVar } from '../ui.jsx';
import { openPicker, ExerciseForm } from './pickers.jsx';
import { ExThumb, previewSheet } from '../components/preview.jsx';
import { Coverage } from '../components/coverage.jsx';

// Import workouts pasted as text (built for workouts copied out of Boostcamp)
const mem = { text: '' };
const EXAMPLE = '(M) Upper Pull 1\nLat Pulldown (Neutral Grip)\n3 x 8\nFace Pull\n3 x 12-15';

const repsText = (r) => (r.secs ? `${r.secs} sec` : r.amrap ? 'AMRAP' : r.min && r.max && r.min !== r.max ? `${r.min}–${r.max}` : r.max || r.min || '–');

function buildPlan(parsed, s) {
  const exercises = allExercises(s);
  const usage = exerciseUsage(s.workouts);
  const taken = new Set(s.templates.map((t) => t.color));
  const free = TEMPLATE_COLORS.filter((c) => !taken.has(c));
  const palette = free.length ? free : TEMPLATE_COLORS;
  return parsed.map((w, wi) => {
    const existing = s.templates.find((t) => t.name.trim().toLowerCase() === w.name.trim().toLowerCase());
    return {
      key: wi,
      name: w.name,
      color: existing ? existing.color : palette[wi % palette.length],
      existingId: existing ? existing.id : null,
      replace: !!existing,
      rows: w.exercises.map((e, i) => {
        const m = matchExercise(e.name, exercises, usage);
        const note = [e.secs ? `${e.secs} sec` : '', e.amrap ? 'AMRAP' : '', e.note].filter(Boolean).join(', ');
        return {
          key: i, src: e.name, exId: m ? m.id : null, how: m ? m.how : 'new',
          guess: m ? null : guessExercise(e.name, e.secs), skip: false,
          sets: e.sets, min: e.min, max: e.max, secs: e.secs, amrap: e.amrap, note,
        };
      }),
    };
  });
}

function PasteStep({ text, setText, parsed, onNext }) {
  const nEx = parsed.reduce((a, w) => a + w.exercises.length, 0);
  const canPaste = typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText;
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t || !t.trim()) { toast('The clipboard is empty'); return; }
      mem.text = t; setText(t);
    } catch {
      toast('Couldn’t read the clipboard. Press and hold the box, then tap Paste.');
    }
  };
  return (
    <div class="pad-16 stack-16">
      <p class="muted">Copy a workout as text from Boostcamp (or a note) and paste it here. You can paste several workouts at once. Each exercise needs a line like <strong>3 x 8</strong> under it.</p>
      <textarea class="paste-box" rows={12} placeholder={EXAMPLE} value={text} aria-label="Workout text"
        onInput={(e) => { mem.text = e.target.value; setText(e.target.value); }} />
      <div class="row-between">
        {canPaste
          ? <button class="btn sm" onClick={paste}><Icon name="copy" size={18} /> Paste</button>
          : <span />}
        {text && <button class="link" onClick={() => { mem.text = ''; setText(''); }}>Clear</button>}
      </div>
      <p class={'small ' + (parsed.length ? 'imp-found' : 'muted')} role="status">
        {!text.trim() ? 'Nothing pasted yet.'
          : parsed.length ? `Found ${plural(parsed.length, 'workout')} with ${plural(nEx, 'exercise')}.`
            : 'No exercises found yet. Put a sets line such as 3 x 8 under each exercise name.'}
      </p>
      <button class="btn btn-primary full" disabled={!parsed.length} onClick={onNext}>
        {parsed.length ? `Review ${plural(parsed.length, 'workout')}` : 'Review'}
      </button>
    </div>
  );
}

function ImportRow({ row, ex, onChange, onFix }) {
  let status;
  if (row.skip) status = <span class="muted">Left out</span>;
  else if (!ex) {
    const muscles = row.guess.primary.map((m) => MUSCLE_NAME[m]).join(', ');
    status = <span class="imp-new">New exercise{muscles ? ` · ${muscles}` : ' · pick its muscles'}</span>;
  } else if (row.how === 'close') status = <span class="imp-close">Closest match for “{row.src}”</span>;
  else if (row.how === 'picked' && normName(ex.name) !== normName(row.src)) status = <span class="muted">Swapped in for “{row.src}”</span>;
  else status = <span class="muted">{row.note || 'In your library'}</span>;
  return (
    <div class={'imp-row' + (row.skip ? ' skip' : '')}>
      {ex ? <ExThumb ex={ex} size="sm" onClick={() => previewSheet(ex)} />
        : <span class="thumb thumb-sm thumb-empty" aria-hidden="true">+</span>}
      <button class="imp-main" onClick={onFix} aria-label={`Change ${ex ? ex.name : row.src}`}>
        <span class="pick-name">{ex ? ex.name : row.src}</span>
        <span class="small">{status}</span>
      </button>
      <span class="imp-sets num">{row.sets} × {repsText(row)}</span>
      <button class="icon-btn sm" aria-label={`Options for ${ex ? ex.name : row.src}`} onClick={onFix}><Icon name="more" size={18} /></button>
    </div>
  );
}

export function ImportScreen() {
  const s = useStore();
  const exercises = allExercises(s);
  const [text, setText] = useState(mem.text);
  const parsed = useMemo(() => parseWorkoutText(text), [text]);
  const [plan, setPlan] = useState(null);
  const [prog, setProg] = useState({ on: false, name: '', weeks: 8 });
  const made = useRef(new Set()); // exercises created from this screen

  const setW = (wi, patch) => setPlan((p) => p.map((w, i) => (i === wi ? { ...w, ...patch } : w)));
  const setRow = (wi, ri, patch) => setPlan((p) => p.map((w, i) => (i === wi ? { ...w, rows: w.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : w)));
  // the same new exercise can appear in several workouts; resolve all of them together
  const setAllSrc = (src, patch) => setPlan((p) => p.map((w) => ({ ...w, rows: w.rows.map((r) => (!r.exId && normName(r.src) === normName(src) ? { ...r, ...patch } : r)) })));

  const editNew = (wi, ri, row) => openSheet((c) => (
    <ExerciseForm close={c} initial={{ name: row.src, ...(row.guess || guessExercise(row.src, row.secs)) }}
      onSaved={(id) => { made.current.add(id); setAllSrc(row.src, { exId: id, how: 'exact', guess: null }); setRow(wi, ri, { exId: id, how: 'exact', guess: null }); }} />
  ), { tall: true });

  const fix = (wi, ri) => {
    const row = plan[wi].rows[ri];
    const ex = row.exId && exercises[row.exId];
    openSheet((close) => (
      <div class="sheet-pad">
        <h3 class="sheet-title">{row.src}</h3>
        <p class="small muted mb-8">{row.sets} sets × {repsText(row)}{row.note && !row.secs && !row.amrap ? ` · ${row.note}` : ''}</p>
        <div class="menu">
          <button class="menu-row" onClick={() => {
            close();
            openPicker(([id]) => setRow(wi, ri, { exId: id, how: 'picked', guess: null, skip: false }),
              { multi: false, title: 'Pick the exercise', query: row.src.replace(/\(.*?\)/g, '').trim() });
          }}><Icon name="swap" size={20} /> {ex ? 'Swap for a different exercise' : 'Pick one from the library'}</button>
          <button class="menu-row" onClick={() => { close(); editNew(wi, ri, row); }}>
            <Icon name="edit" size={20} /> {ex ? `Create “${row.src}” as a new exercise` : 'Set up the new exercise'}
          </button>
          {ex && <button class="menu-row" onClick={() => { close(); previewSheet(ex); }}><Icon name="play" size={20} /> Preview {ex.name}</button>}
          <button class="menu-row danger" onClick={() => { close(); setRow(wi, ri, { skip: !row.skip }); }}>
            <Icon name={row.skip ? 'plus' : 'trash'} size={20} /> {row.skip ? 'Put it back' : 'Leave it out'}
          </button>
        </div>
      </div>
    ));
  };

  const doImport = () => {
    const live = plan.filter((w) => w.rows.some((r) => !r.skip));
    if (!live.length) { toast('Nothing left to import'); return; }
    for (const w of live) if (!w.name.trim()) { toast('Give every workout a name'); return; }
    const missing = [];
    for (const w of live) for (const r of w.rows) if (!r.skip && !r.exId && !r.guess.primary.length) missing.push(r);
    if (missing.length) {
      toast(`Pick the muscles for “${missing[0].src}”`);
      const wi = plan.findIndex((w) => w.rows.includes(missing[0]));
      editNew(wi, plan[wi].rows.indexOf(missing[0]), missing[0]);
      return;
    }
    const created = {};
    const ids = [];
    for (const w of live) {
      const items = [];
      for (const r of w.rows) {
        if (r.skip) continue;
        let exId = r.exId;
        if (!exId) {
          const k = normName(r.src);
          if (!created[k]) {
            created[k] = saveCustomExercise({ name: r.src.trim(), equipment: r.guess.equipment, kind: r.guess.kind, primary: r.guess.primary, secondary: r.guess.secondary });
            made.current.add(created[k]);
          }
          exId = created[k];
        }
        items.push({ exId, sets: Math.max(1, Math.min(12, r.sets)), min: r.min, max: r.max, rest: null, ...(r.note ? { note: r.note } : {}) });
      }
      const existing = w.replace && w.existingId ? getState().templates.find((t) => t.id === w.existingId) : null;
      ids.push(saveTemplate(existing
        ? { ...existing, name: w.name.trim(), color: w.color, items }
        : { name: w.name.trim(), color: w.color, note: '', items }));
    }
    if (prog.on && ids.length > 1) saveProgram({ name: prog.name.trim() || 'Imported program', weeks: prog.weeks, days: ids });
    mem.text = '';
    const nNew = made.current.size;
    toast(`Imported ${plural(ids.length, 'workout')}${nNew ? `, ${plural(nNew, 'new exercise')}` : ''}${prog.on && ids.length > 1 ? ' and a program' : ''}`);
    pop();
  };

  if (!plan) {
    return (
      <div class="screen-body">
        <Header title="Import workouts" onBack={pop} />
        <PasteStep text={text} setText={setText} parsed={parsed} onNext={() => setPlan(buildPlan(parsed, s))} />
      </div>
    );
  }

  const live = plan.filter((w) => w.rows.some((r) => !r.skip));
  // coverage of what would be imported, using guessed muscles for exercises not created yet
  const covEx = { ...exercises };
  const covSessions = live.map((w) => ({
    name: w.name,
    items: w.rows.filter((r) => !r.skip).map((r) => {
      if (r.exId) return { exId: r.exId, sets: r.sets };
      const id = 'new:' + normName(r.src);
      covEx[id] = { id, name: r.src, ...r.guess };
      return { exId: id, sets: r.sets };
    }),
  }));
  const unsure = plan.reduce((a, w) => a + w.rows.filter((r) => !r.skip && (r.how === 'close' || !r.exId)).length, 0);
  return (
    <div class="screen-body">
      <Header title="Check the import" onBack={() => setPlan(null)} sub={`${plural(plan.length, 'workout')}`} />
      <div class="pad-16 stack-16">
        <p class="small muted">
          {unsure
            ? 'Tap an exercise to swap it. Yellow ones are the closest match in your library, and new ones are added to your exercises.'
            : 'Everything matched your exercise library. Tap any exercise to swap it.'}
          {' '}You can fine-tune sets and reps after importing.
        </p>
        {plan.map((w, wi) => (
          <section key={w.key} class="imp-card" style={{ '--plate': plateVar(w.color) }}>
            <input class="title-input imp-name" value={w.name} aria-label="Workout name" onInput={(e) => setW(wi, { name: e.target.value })} />
            <div class="swatches sm">
              {TEMPLATE_COLORS.map((c) => (
                <button key={c} class={'swatch' + (w.color === c ? ' on' : '')} style={{ background: plateVar(c) }} aria-label={c} aria-pressed={w.color === c}
                  onClick={() => setW(wi, { color: c })} />
              ))}
            </div>
            {w.existingId && (
              <label class="imp-replace">
                <span class="small">
                  <strong>Replace your existing “{w.name}”</strong>
                  <span class="muted"> {w.replace ? 'Its history stays linked.' : 'Off: adds a second copy.'}</span>
                </span>
                <Toggle on={w.replace} onChange={(v) => setW(wi, { replace: v })} label={`Replace existing ${w.name}`} />
              </label>
            )}
            <div class="imp-rows">
              {w.rows.map((r, ri) => (
                <ImportRow key={r.key} row={r} ex={r.exId ? exercises[r.exId] : null} onFix={() => fix(wi, ri)} />
              ))}
            </div>
          </section>
        ))}
        <Coverage sessions={covSessions} exercises={covEx} sex={s.settings.bodySex}
          note={live.length > 1 ? `If you do each of these ${live.length} workouts once a week.` : 'If you do this workout once a week.'} />
        {plan.length > 1 && (
          <section class="panel stack-12">
            <label class="row-between">
              <span>
                <strong>Also make a program</strong>
                <span class="small muted block">Runs these {plan.length} workouts in order as one week.</span>
              </span>
              <Toggle on={prog.on} onChange={(v) => setProg((x) => ({ ...x, on: v }))} label="Also make a program" />
            </label>
            {prog.on && (
              <>
                <input type="text" placeholder="Program name" value={prog.name} aria-label="Program name" onInput={(e) => setProg((x) => ({ ...x, name: e.target.value }))} />
                <div class="row-between">
                  <span class="muted">Length</span>
                  <Stepper value={prog.weeks} min={1} max={52} onChange={(v) => setProg((x) => ({ ...x, weeks: v }))} fmt={(v) => plural(v, 'week')} label="Weeks" />
                </div>
              </>
            )}
          </section>
        )}
        <button class="btn btn-primary full" disabled={!live.length} onClick={doImport}>
          <Icon name="import" size={20} /> Import {plural(live.length, 'workout')}
        </button>
      </div>
    </div>
  );
}
