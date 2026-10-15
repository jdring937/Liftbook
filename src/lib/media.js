// Previews people add to exercises that don't have a built-in one:
// photos and steps from free-exercise-db (Unlicense), loaded from the source on demand,
// and YouTube videos, which only load when you tap play.

export const LIB_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
export const libImg = (srcId, frame) => `${LIB_BASE}${encodeURIComponent(srcId)}/${frame}.jpg`;

// ---------- the library index (ex/library.json, built by tools/build-library.py) ----------
// rows: [source id, name, equipment, primary muscles, our id when the app already has it]
let lib = null;
let libP = null;
export function loadLibrary() {
  if (lib) return Promise.resolve(lib);
  if (!libP) {
    libP = fetch('ex/library.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((rows) => (lib = rows.map(([id, name, equipment, muscles, ours]) => ({ id, name, equipment, muscles, ours: ours || null, hay: `${name} ${equipment} ${muscles}`.toLowerCase() }))))
      .catch((e) => { libP = null; throw e; });
  }
  return libP;
}

const STOP = new Set(['the', 'a', 'an', 'with', 'and', 'on', 'of', 'to', 'machine', 'cable', 'barbell', 'dumbbell']);
const EQUIP_WORD = { machine: 'machine', cable: 'cable', barbell: 'barbell', dumbbell: 'dumbbell', dumbbells: 'dumbbell', kettlebell: 'kettlebells', band: 'bands', bands: 'bands' };
const words = (q) => q.toLowerCase().replace(/[()]/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
// Best matches for a name: every word helps, equipment words count less than movement words
export function searchLibrary(rows, q, limit = 40) {
  const ws = words(q);
  if (!ws.length) return rows.slice(0, limit);
  const scored = [];
  const lead = ws.find((w) => !STOP.has(w));
  for (const r of rows) {
    const name = r.name.toLowerCase();
    let sc = 0;
    for (const w of ws) {
      const stem = w.length > 4 ? w.replace(/(es|s)$/, '') : w;
      if (new RegExp(`\\b${stem}`).test(name)) sc += (STOP.has(w) ? 1 : 3) + (w === lead ? 0.5 : 0);
      else if (r.hay.includes(stem)) sc += 1;
      if (EQUIP_WORD[w] && r.equipment === EQUIP_WORD[w]) sc += 1;
    }
    if (sc > 0) scored.push([sc - name.length / 200, r]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map((x) => x[1]);
}

// Steps for a chosen exercise, from the source's own file
export async function fetchSteps(srcId) {
  const r = await fetch(`${LIB_BASE}${encodeURIComponent(srcId)}.json`);
  if (!r.ok) throw new Error(r.status);
  const e = await r.json();
  return (e.instructions || []).map((s) => String(s).trim()).filter(Boolean);
}

// ---------- YouTube ----------
const ID = /^[\w-]{11}$/;
function seconds(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return +t;
  const m = String(t).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
}
// { id, start, tall } from a YouTube link (watch, youtu.be, shorts, embed, live), or null
export function parseYouTube(text) {
  const s = (text || '').trim();
  if (!s) return null;
  if (ID.test(s)) return { id: s, start: 0, tall: false };
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id = null;
  let tall = false;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
      if (m) { id = m[2]; tall = m[1] === 'shorts'; }
    }
  }
  if (!id || !ID.test(id)) return null;
  return { id, start: seconds(u.searchParams.get('t') || u.searchParams.get('start')), tall };
}
export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const ytWatch = (m) => (m.ytTall ? `https://www.youtube.com/shorts/${m.yt}` : `https://www.youtube.com/watch?v=${m.yt}${m.ytStart ? `&t=${m.ytStart}s` : ''}`);
export const ytEmbed = (m) => `https://www.youtube-nocookie.com/embed/${m.yt}?autoplay=1&playsinline=1&rel=0${m.ytStart ? `&start=${m.ytStart}` : ''}`;
export const ytLink = (m) => (m && m.yt ? ytWatch(m) : '');
