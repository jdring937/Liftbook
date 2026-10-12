export const DAY = 86400000;
export const KG_PER_LB = 0.45359237;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function toKg(v, unit) {
  if (v == null || v === '' || isNaN(v)) return null;
  return unit === 'lb' ? v * KG_PER_LB : v;
}
export function fromKg(kg, unit) {
  if (kg == null) return null;
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}
export function round(n, d = 1) {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}
// weight number for display in the user's unit
export function wNum(kg, unit, d = 1) {
  if (kg == null) return null;
  return round(fromKg(kg, unit), d);
}
export function fmtNum(n, d = 1) {
  if (n == null || isNaN(n)) return '–';
  return round(n, d).toLocaleString('en-US', { maximumFractionDigits: d });
}
export function fmtW(kg, unit, withUnit = true) {
  if (kg == null) return '–';
  const s = fmtNum(fromKg(kg, unit), unit === 'kg' ? 2 : 1);
  return withUnit ? `${s} ${unit}` : s;
}
export function compact(n) {
  if (n == null || isNaN(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1e6) return round(n / 1e6, a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e4) return round(n / 1e3, a >= 1e5 ? 0 : 1) + 'K';
  if (a >= 1000) return round(n / 1e3, 1) + 'K';
  return fmtNum(n, a < 10 ? 1 : 0);
}
export function fmtDuration(ms) {
  if (ms == null || ms < 0) return '–';
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`;
}
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export function fmtSecs(sec) {
  if (sec == null) return '–';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const dfCache = {};
function df(opts) {
  const k = JSON.stringify(opts);
  return dfCache[k] || (dfCache[k] = new Intl.DateTimeFormat('en-US', opts));
}
export const fmtDate = (t) => df({ weekday: 'short', month: 'short', day: 'numeric' }).format(t);
export const fmtDateLong = (t) => df({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(t);
export const fmtDateShort = (t) => df({ month: 'short', day: 'numeric' }).format(t);
export const fmtDateYear = (t) => df({ month: 'short', day: 'numeric', year: 'numeric' }).format(t);
export const fmtMonth = (t) => df({ month: 'long', year: 'numeric' }).format(t);
export const fmtMonthShort = (t) => df({ month: 'short' }).format(t);
export const fmtTime = (t) => df({ hour: 'numeric', minute: '2-digit' }).format(t);

export function startOfDay(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime();
}
export function startOfWeek(t, weekStart = 0) {
  const d = new Date(startOfDay(t));
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}
export function startOfMonth(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(1); return d.getTime();
}
export function addDays(t, n) {
  const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime();
}
export function addMonths(t, n) {
  const d = new Date(t); d.setDate(1); d.setMonth(d.getMonth() + n); return d.getTime();
}
export function daysAgo(t, now = Date.now()) {
  const n = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return 'Last week';
  if (n < 60) return `${Math.floor(n / 7)} weeks ago`;
  return fmtDateYear(t);
}
// value for <input type="datetime-local">
export function toLocalInput(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function plural(n, word, pl) {
  return `${fmtNum(n, 1)} ${n === 1 ? word : (pl || word + 's')}`;
}
