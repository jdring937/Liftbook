// Parse workouts copied as text (Boostcamp's copied workouts and similar lists):
//
//   (M) Upper Pull 1          <- workout name: a line that isn't followed by a sets line
//   Lat Pulldown (Neutral Grip)
//   3 x 8  -                  <- sets x reps, then anything after the dash (weight, RPE, %) as a note
//   Meadow Row
//   3 x 8-12  -
//
// Several workouts can be pasted at once; each name line starts a new one.

const SETS_RE = /^(\d+)\s*(?:x|×|\*|sets? of|sets? x)\s*(.*)$/i;
const DASH = '[-–—]';
const LABEL_RE = /^(superset|giant set|circuit|tri-?set|warm[- ]?up|cool[- ]?down|notes?:|rest\b|week \d+$|day \d+$)/i;

export function parseSetsLine(line) {
  const m = line.trim().match(SETS_RE);
  if (!m) return null;
  const sets = parseInt(m[1], 10);
  if (!sets || sets > 30) return null;
  let rest = m[2].trim();
  // a spaced range like "8 - 12" is reps, not a note
  rest = rest.replace(new RegExp(`^(\\d+)\\s*${DASH}\\s*(\\d+)\\b(?!\\s*(?:lbs?|kgs?|kilos?|pounds?|%|x\\b))`, 'i'),
    (all, a, b) => (+b > +a && +b <= 100 ? `${a}-${b}` : all));
  let note = '';
  const dash = rest.search(new RegExp(`\\s${DASH}(\\s|$)`));
  if (dash >= 0) { note = rest.slice(dash).replace(new RegExp(`^\\s*${DASH}\\s*`), '').trim(); rest = rest.slice(0, dash).trim(); }
  const out = { sets, min: null, max: null, secs: null, amrap: false, note };
  const addNote = (t) => { t = t.replace(/^[\s,;:@]+|[\s,;:]+$/g, ''); if (t) out.note = out.note ? `${t}, ${out.note}` : t; };
  if (/^(amrap|max|failure|to failure)\b/i.test(rest)) { out.amrap = true; addNote(rest.replace(/^(amrap|max|failure|to failure)/i, '')); return out; }
  const time = rest.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)\b/i);
  if (time) {
    const v = parseFloat(time[1]);
    out.secs = Math.round(/^m/i.test(time[2]) ? v * 60 : v);
    addNote(rest.slice(time[0].length));
    return out;
  }
  const range = rest.match(new RegExp(`^(\\d+)\\s*(?:${DASH}|to)\\s*(\\d+)\\s*(?:reps?)?`, 'i'));
  if (range) {
    const a = +range[1], b = +range[2];
    out.min = Math.min(a, b); out.max = Math.max(a, b);
    addNote(rest.slice(range[0].length));
    return out;
  }
  const one = rest.match(/^(\d+)\s*(?:reps?)?/i);
  if (one) { out.min = out.max = +one[1]; addNote(rest.slice(one[0].length)); return out; }
  addNote(rest);
  return out;
}

export function parseWorkoutText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
    .map((l) => l.replace(/[   \t]/g, ' ').trim().replace(/^[•·*▪◦]\s*/, '').replace(/^\d{1,2}[.)]\s+/, '').trim())
    .filter(Boolean);
  const items = lines.map((l) => ({ text: l, sets: parseSetsLine(l) }));
  const workouts = [];
  let cur = null;
  const startWorkout = (name) => { cur = { name, exercises: [] }; workouts.push(cur); };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.sets) {
      // another sets line for the same exercise (e.g. a top set then back-off sets)
      const ex = cur && cur.exercises[cur.exercises.length - 1];
      if (ex) {
        ex.sets += it.sets.sets;
        if (it.sets.min != null) { ex.min = ex.min == null ? it.sets.min : Math.min(ex.min, it.sets.min); ex.max = Math.max(ex.max || 0, it.sets.max); }
        if (it.sets.secs != null) ex.secs = Math.max(ex.secs || 0, it.sets.secs);
        if (it.sets.note && !ex.note.includes(it.sets.note)) ex.note = ex.note ? `${ex.note}; ${it.sets.note}` : it.sets.note;
      }
      continue;
    }
    if (LABEL_RE.test(it.text)) continue;
    const next = items[i + 1];
    if (next && next.sets) {
      if (!cur) startWorkout('Imported workout');
      cur.exercises.push({ name: it.text.replace(new RegExp(`\\s*${DASH}\\s*$`), ''), ...next.sets });
      i++;
    } else {
      startWorkout(it.text.replace(new RegExp(`\\s*${DASH}\\s*$`), ''));
    }
  }
  return workouts.filter((w) => w.exercises.length);
}

// ---------- matching names to the exercise library ----------
const WORD_ALIASES = {
  db: 'dumbbell', dbs: 'dumbbell', dumbbells: 'dumbbell', bb: 'barbell', kb: 'kettlebell', ez: 'ez',
  rdl: 'romanian deadlift', sldl: 'romanian deadlift', ohp: 'overhead press', bw: 'bodyweight',
  flye: 'fly', flyes: 'fly', flies: 'fly', crossover: 'fly', crossovers: 'fly', pulldown: 'pulldown', pushdown: 'pushdown',
  chinup: 'chin up', pullup: 'pull up', pushup: 'push up', situp: 'sit up', stepup: 'step up',
  skullcrusher: 'skull crusher', skullcrushers: 'skull crusher', tricep: 'tricep', triceps: 'tricep', bicep: 'bicep', biceps: 'bicep',
};
const PHRASES = [[/\bpull[ -]down/g, 'pulldown'], [/\bpush[ -]down/g, 'pushdown'], [/\bpull[ -]ups?\b/g, 'pull up'], [/\bchin[ -]ups?\b/g, 'chin up'],
  [/\bpush[ -]ups?\b/g, 'push up'], [/\bsit[ -]ups?\b/g, 'sit up'], [/\bstep[ -]ups?\b/g, 'step up'], [/\bez[ -]?bar\b/g, 'ez bar'],
  [/\bt[ -]?bar\b/g, 't bar'], [/\bback squat/g, 'barbell squat'], [/\bpec deck/g, 'chest fly machine'], [/\bmilitary press/g, 'overhead press'], [/\bone[ -]arm\b/g, 'single arm'], [/\b1[ -]arm\b/g, 'single arm'], [/\bsingle[ -]arm\b/g, 'single arm']];
function norm(s) {
  let t = s.toLowerCase().replace(/&/g, ' and ').replace(/[’']/g, '');
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  t = t.replace(/[^a-z0-9]+/g, ' ').trim();
  return t.split(' ').map((w) => WORD_ALIASES[w] || w).join(' ');
}
const stem = (w) => (w.length > 3 && w.endsWith('sses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const tokens = (s) => new Set(norm(s).split(' ').filter(Boolean).map(stem));
const root = (s) => [...tokens(s.replace(/\(.*?\)/g, ''))].join(' ');
const EQUIP_PREF = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'smith', 'kettlebell', 'band', 'other'];

const EQUIP_WORDS = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'kettlebell', 'band', 'bodyweight', 'ez']);
export const normName = (s) => [...tokens(s)].join(' ');

// Returns { id, how: 'exact' | 'close' } or null when nothing is a safe match
export function matchExercise(name, exercises, usage = {}) {
  const list = Object.values(exercises).filter((e) => !e.hidden);
  const n = normName(name);
  const exact = list.find((e) => normName(e.name) === n);
  if (exact) return { id: exact.id, how: 'exact' };
  const rank = (a, b) => (usage[b.id] || 0) - (usage[a.id] || 0) || EQUIP_PREF.indexOf(a.equipment) - EQUIP_PREF.indexOf(b.equipment);
  // same words in a different order ("Barbell Bench Press" and "Bench Press (Barbell)")
  const tn = tokens(name);
  const sameSet = list.filter((e) => { const te = tokens(e.name); return te.size === tn.size && [...tn].every((t) => te.has(t)); });
  if (sameSet.length) return { id: sameSet.sort(rank)[0].id, how: 'exact' };
  // same movement without the equipment in brackets ("Face Pull" and "Face Pull (Cable)")
  const r = root(name);
  const sameRoot = list.filter((e) => root(e.name) === r);
  if (sameRoot.length) return { id: sameRoot.sort(rank)[0].id, how: 'close' };
  // a library exercise whose words are all in the name ("Dumbbell Row" for "Single Arm Dumbbell Row")
  const inside = list.filter((e) => { const te = tokens(e.name); return te.size >= 2 && te.size < tn.size && [...te].every((t) => tn.has(t)) && [...te].some((t) => !EQUIP_WORDS.has(t)); });
  if (inside.length) return { id: inside.sort((a, b) => tokens(b.name).size - tokens(a.name).size || rank(a, b))[0].id, how: 'close' };
  // never trade the equipment the name asks for ("Dumbbell Row" is not "Row (Cable)")
  const gear = [...tn].filter((t) => EQUIP_WORDS.has(t));
  let best = null, bestScore = 0;
  for (const e of list) {
    const te = tokens(e.name);
    if (gear.length && [...te].some((t) => EQUIP_WORDS.has(t) && !tn.has(t))) continue;
    let inter = 0;
    for (const t of tn) if (te.has(t)) inter++;
    const score = inter / (tn.size + te.size - inter);
    if (score > bestScore || (score === bestScore && best && rank(e, best) < 0)) { bestScore = score; best = e; }
  }
  if (best && bestScore >= 0.6) return { id: best.id, how: 'close' };
  return null;
}

// Best guess at muscles and equipment for an exercise the library doesn't have
export function guessExercise(name, secs = null) {
  const n = norm(name);
  const has = (re) => re.test(n);
  let primary = [], secondary = [];
  if (has(/leg curl|hamstring curl|nordic/)) primary = ['hamstrings'];
  else if (has(/leg extension/)) primary = ['quads'];
  else if (has(/back extension|hyperextension|reverse hyper/)) { primary = ['lowerBack', 'glutes']; secondary = ['hamstrings']; }
  else if (has(/leg press|hack squat|squat|lunge|split|step up|sissy/)) { primary = ['quads', 'glutes']; secondary = ['adductors']; }
  else if (has(/deadlift|good morning|hinge|pull through/)) { primary = ['hamstrings', 'glutes']; secondary = ['lowerBack']; }
  else if (has(/hip thrust|glute|bridge/) || (has(/kickback/) && !has(/tricep/))) { primary = ['glutes']; secondary = ['hamstrings']; }
  else if (has(/calf|calve/)) primary = ['calves'];
  else if (has(/abduct/)) primary = ['glutes'];
  else if (has(/adduct|copenhagen/)) primary = ['adductors'];
  else if (has(/face pull|rear delt|reverse fl|reverse pec/)) { primary = ['rearDelts']; secondary = ['upperBack']; }
  else if (has(/pulldown|pull up|chin up|pullover/)) { primary = ['lats']; secondary = ['biceps', 'upperBack']; }
  else if (has(/upright row/)) { primary = ['sideDelts', 'traps']; }
  else if (has(/row/)) { primary = ['upperBack', 'lats']; secondary = ['biceps', 'rearDelts']; }
  else if (has(/shrug/)) primary = ['traps'];
  else if (has(/lateral|side raise|y raise|lu raise/)) primary = ['sideDelts'];
  else if (has(/front raise/)) primary = ['frontDelts'];
  else if (has(/overhead press|shoulder press|military|arnold|z press|push press|landmine press/)) { primary = ['frontDelts']; secondary = ['triceps', 'sideDelts']; }
  else if (has(/tricep|skull|pushdown|kickback|dip|french press|jm press/)) { primary = ['triceps']; if (has(/dip/)) secondary = ['chest']; }
  else if (has(/curl/)) { primary = ['biceps']; secondary = ['forearms']; }
  else if (has(/wrist|forearm|grip|farmer|carry|hang/)) primary = ['forearms'];
  else if (has(/fly|crossover|pec deck/)) { primary = ['chest']; secondary = ['frontDelts']; }
  else if (has(/bench|chest press|push up|floor press|press/)) { primary = ['chest']; secondary = ['triceps', 'frontDelts']; }
  else if (has(/crunch|sit up|plank|\bab\b|abs|leg raise|knee raise|rollout|twist|woodchop|pallof|hollow|dead bug|v up|toes to bar/)) { primary = ['abs']; secondary = ['obliques']; }
  const e = norm(name);
  const equipment = /smith/.test(e) ? 'smith' : /dumbbell/.test(e) ? 'dumbbell' : /cable|rope/.test(e) ? 'cable'
    : /barbell|ez bar|landmine|meadow|t bar|trap bar/.test(e) ? 'barbell' : /machine|lever|hammer strength|pec deck/.test(e) ? 'machine'
      : /bodyweight|push up|pull up|chin up|dip|plank|inverted/.test(e) ? 'bodyweight' : /kettlebell/.test(e) ? 'kettlebell' : /band/.test(e) ? 'band' : 'other';
  const kind = secs != null || /plank|hold|hang|carry|wall sit/.test(e) ? 'time' : equipment === 'bodyweight' ? 'reps' : 'weight';
  return { primary, secondary, equipment, kind };
}

// Times each exercise was logged, so close matches prefer the variation you actually do
export function exerciseUsage(workouts) {
  const u = {};
  for (const w of workouts) for (const e of w.exercises) u[e.exId] = (u[e.exId] || 0) + 1;
  return u;
}
