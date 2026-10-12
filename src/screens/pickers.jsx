import { useMemo, useState } from 'preact/hooks';
import { useStore, allExercises, saveCustomExercise } from '../store.js';
import { MUSCLES, MUSCLE_NAME, MUSCLE_FILTERS, EQUIPMENT } from '../data/exercises.js';
import { Icon, Chips, openSheet, toast } from '../ui.jsx';
import { ExThumb } from '../components/preview.jsx';

export function musclesText(ex) {
  return [...ex.primary, ...ex.secondary].slice(0, 3).map((m) => MUSCLE_NAME[m] || m).join(', ');
}

function matches(ex, words) {
  const n = ex.name.toLowerCase();
  return words.every((w) => n.includes(w));
}

export function useExerciseList(q, filter) {
  const s = useStore();
  const exercises = allExercises(s);
  return useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const groups = filter ? (MUSCLE_FILTERS.find((f) => f[0] === filter) || [, []])[1] : null;
    const last = {};
    for (const w of s.workouts) for (const e of w.exercises) last[e.exId] = Math.max(last[e.exId] || 0, w.start);
    const list = Object.values(exercises).filter((ex) => !ex.hidden && matches(ex, words) && (!groups || ex.primary.some((m) => groups.includes(m))));
    list.sort((a, b) => a.name.localeCompare(b.name));
    const recent = !words.length && !groups
      ? Object.keys(last).sort((a, b) => last[b] - last[a]).slice(0, 8).map((id) => exercises[id]).filter(Boolean)
      : [];
    return { list, recent, last };
  }, [exercises, s.workouts, q, filter]);
}

export function ExercisePicker({ close, onPick, multi = true, title = 'Add exercises' }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(null);
  const [sel, setSel] = useState([]);
  const { list, recent } = useExerciseList(q, filter);
  const toggle = (id) => {
    if (!multi) { onPick([id]); close(); return; }
    setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  };
  const row = (ex) => {
    const on = sel.includes(ex.id);
    return (
      <button key={ex.id} class={'pick-row' + (on ? ' on' : '')} onClick={() => toggle(ex.id)} aria-pressed={on}>
        <ExThumb ex={ex} size="sm" />
        <span class="pick-main">
          <span class="pick-name">{ex.name}</span>
          <span class="muted small">{musclesText(ex)}</span>
        </span>
        {multi && <span class={'pick-box' + (on ? ' on' : '')}>{on && <Icon name="check" size={16} stroke={2.6} />}</span>}
      </button>
    );
  };
  return (
    <div class="picker">
      <div class="picker-head">
        <div class="row-between">
          <h3 class="sheet-title">{title}</h3>
          <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
        </div>
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search exercises" value={q} onInput={(e) => setQ(e.target.value)} />
        </label>
        <Chips options={[[null, 'All'], ...MUSCLE_FILTERS.map(([k]) => [k, k])]} value={filter} onChange={setFilter} class="chips-scroll" />
      </div>
      <div class="picker-list">
        {recent.length > 0 && <div class="list-label">Recent</div>}
        {recent.map(row)}
        {recent.length > 0 && <div class="list-label">All exercises</div>}
        {list.map(row)}
        {!list.length && <p class="muted pad-16">No exercise matches “{q}”.</p>}
        <button class="btn btn-ghost full mt-8" onClick={() => openSheet((c) => (
          <ExerciseForm initial={{ name: q }} close={c} onSaved={(id) => { if (multi) setSel((x) => [...x, id]); else { onPick([id]); close(); } }} />
        ), { tall: true })}>
          <Icon name="plus" size={18} /> {q ? `Create “${q}”` : 'Create an exercise'}
        </button>
      </div>
      {multi && (
        <div class="picker-foot">
          <button class="btn btn-primary full" disabled={!sel.length} onClick={() => { onPick(sel); close(); }}>
            {sel.length ? `Add ${sel.length} exercise${sel.length > 1 ? 's' : ''}` : 'Select exercises'}
          </button>
        </div>
      )}
    </div>
  );
}

function MuscleToggles({ value, onChange, exclude = [] }) {
  return (
    <div class="chips wrap">
      {MUSCLES.filter(([k]) => !exclude.includes(k)).map(([k, label]) => {
        const on = value.includes(k);
        return (
          <button key={k} class={'chip' + (on ? ' on' : '')} aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>{label}</button>
        );
      })}
    </div>
  );
}

export function ExerciseForm({ initial = {}, close, onSaved }) {
  const [f, setF] = useState({ name: '', equipment: 'other', kind: 'weight', primary: [], secondary: [], ...initial });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name.trim()) { toast('Give the exercise a name'); return; }
    if (!f.primary.length) { toast('Pick at least one main muscle'); return; }
    const id = saveCustomExercise({ ...f, name: f.name.trim() });
    toast(initial.id ? 'Exercise saved' : 'Exercise created');
    onSaved && onSaved(id);
    close();
  };
  return (
    <div class="sheet-pad form">
      <div class="row-between">
        <h3 class="sheet-title">{initial.id ? 'Edit exercise' : 'New exercise'}</h3>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
      </div>
      <label class="field">
        <span>Name</span>
        <input type="text" value={f.name} onInput={(e) => set('name', e.target.value)} placeholder="e.g. Pec Deck (Machine)" />
      </label>
      <label class="field">
        <span>Equipment</span>
        <select value={f.equipment} onChange={(e) => set('equipment', e.target.value)}>
          {Object.entries(EQUIPMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <div class="field">
        <span>What you log</span>
        <Chips options={[['weight', 'Weight and reps'], ['reps', 'Reps'], ['time', 'Time']]} value={f.kind} onChange={(v) => set('kind', v)} />
      </div>
      <div class="field">
        <span>Main muscles <em class="muted">count a full set</em></span>
        <MuscleToggles value={f.primary} onChange={(v) => setF((x) => ({ ...x, primary: v, secondary: x.secondary.filter((m) => !v.includes(m)) }))} />
      </div>
      <div class="field">
        <span>Helper muscles <em class="muted">count half a set</em></span>
        <MuscleToggles value={f.secondary} onChange={(v) => set('secondary', v)} exclude={f.primary} />
      </div>
      <button class="btn btn-primary full" onClick={save}>{initial.id ? 'Save exercise' : 'Create exercise'}</button>
    </div>
  );
}

export function openPicker(onPick, opts = {}) {
  openSheet((close) => <ExercisePicker close={close} onPick={onPick} {...opts} />, { tall: true });
}
