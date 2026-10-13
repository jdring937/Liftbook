import { useEffect, useRef, useState, useLayoutEffect } from 'preact/hooks';

// ---------- icons ----------
const P = {
  train: 'M2.5 9.5v5M5.5 7v10M18.5 7v10M21.5 9.5v5M5.5 12h13',
  history: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM4 9.5h16M8.5 2.5v3M15.5 2.5v3',
  progress: 'M4 20h16M6.5 20v-6M12 20V5M17.5 20v-9.5',
  plans: 'M6 3.5h12A1.5 1.5 0 0 1 19.5 5v14a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5zM8.5 8.5h7M8.5 12h7M8.5 15.5h4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  plus: 'M12 5v14M5 12h14',
  body: 'M12 7.2a2.35 2.35 0 1 0 0-4.7 2.35 2.35 0 0 0 0 4.7zM5 10.2l7 1.6 7-1.6M12 11.8v4.2M8.3 21.5l3.7-5.5 3.7 5.5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  import: 'M12 3.5v11M7.5 10L12 14.5 16.5 10M5 15.5v4h14v-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  up: 'M5 15l7-7 7 7',
  x: 'M6 6l12 12M18 6L6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M9.5 2.5h5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  trash: 'M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12M9 7V4.5h6V7',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  play: 'M7 4.5v15l12.5-7.5z',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  share: 'M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v6.5h14V13',
  swap: 'M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7',
  note: 'M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4',
  medal: 'M8 3h8l-2 5h-4zM12 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM12 13.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z',
  flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.3 0-4.4-3.8-6.4-4.6-10.7-2.3 1.6-3.3 3.9-3.3 6.1-1-.6-1.6-1.8-1.7-3.1C7 8.6 5.5 11.3 5.5 14.7 5.5 18.4 8.1 21 12 21z',
};
export function Icon({ name, size = 22, stroke = 1.9, fill = 'none', class: cls = '', style }) {
  return (
    <svg class={'ic ' + cls} style={style} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      stroke-width={name === 'more' ? 3.2 : stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

// ---------- tiny global UI store: navigation, sheets, toasts ----------
const ui = { tab: 'train', stack: [], sheets: [], toast: null };
const uiListeners = new Set();
function emit() { uiListeners.forEach((l) => l()); }
export function useUI() {
  const [, f] = useState(0);
  useEffect(() => { const l = () => f((x) => x + 1); uiListeners.add(l); return () => uiListeners.delete(l); }, []);
  return ui;
}
export function setTab(tab) { ui.tab = tab; ui.stack = []; emit(); window.scrollTo(0, 0); }

// Screens live in ui.stack. One history entry acts as a guard so a back gesture pops a screen
// instead of leaving the app; programmatic navigation never traverses history.
let guard = false;
function ensureGuard() {
  if (ui.stack.length && !guard) {
    try { history.pushState({ g: 1 }, ''); guard = true; } catch (e) { /* ignore */ }
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    guard = false;
    if (ui.sheets.length) {
      const top = ui.sheets[ui.sheets.length - 1];
      top.opts.onClose && top.opts.onClose();
      ui.sheets = ui.sheets.slice(0, -1);
    } else if (ui.stack.length) {
      ui.stack = ui.stack.slice(0, -1);
    }
    emit();
    ensureGuard();
  });
}
export function push(screen, params = {}) {
  ui.stack = [...ui.stack, { screen, params, key: Math.random().toString(36).slice(2) }];
  emit(); ensureGuard();
}
export function pop() {
  if (!ui.stack.length) return;
  ui.stack = ui.stack.slice(0, -1); emit();
}
// remove a screen (and anything above it) by name
export function removeScreen(name) {
  const idx = ui.stack.findIndex((s) => s.screen === name);
  if (idx < 0) return;
  ui.stack = ui.stack.slice(0, idx); emit();
}

export function openSheet(render, opts = {}) {
  const id = Math.random().toString(36).slice(2);
  ui.sheets = [...ui.sheets, { id, render, opts }];
  emit();
  return () => closeSheet(id);
}
export function closeSheet(id) {
  ui.sheets = id ? ui.sheets.filter((s) => s.id !== id) : ui.sheets.slice(0, -1);
  emit();
}
let toastTimer;
export function toast(msg) {
  ui.toast = { msg, id: Math.random() };
  emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast = null; emit(); }, 2200);
}

export function confirmSheet({ title, body, confirm = 'Confirm', danger = false, cancel = 'Cancel', alt = null }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    openSheet((close) => (
      <div class="sheet-pad">
        <h3 class="sheet-title">{title}</h3>
        {body && <p class="muted sheet-body">{body}</p>}
        <div class="stack-8">
          <button class={'btn ' + (danger ? 'btn-danger' : 'btn-primary')} onClick={() => { finish(true); close(); }}>{confirm}</button>
          {alt && <button class="btn" onClick={() => { finish('alt'); close(); }}>{alt}</button>}
          <button class="btn btn-ghost" onClick={() => { finish(false); close(); }}>{cancel}</button>
        </div>
      </div>
    ), { onClose: () => finish(false) });
  });
}

export function SheetHost() {
  const u = useUI();
  useEffect(() => {
    document.documentElement.classList.toggle('lock', u.sheets.length > 0);
  });
  return (
    <>
      {u.sheets.map((s, i) => (
        <div class="sheet-wrap" key={s.id} style={{ zIndex: 200 + i * 2 }}>
          <div class="sheet-backdrop" onClick={() => { s.opts.onClose && s.opts.onClose(); closeSheet(s.id); }} />
          <div class={'sheet' + (s.opts.tall ? ' sheet-tall' : '')} role="dialog" aria-modal="true">
            <div class="sheet-grip" />
            {s.render(() => closeSheet(s.id))}
          </div>
        </div>
      ))}
      {u.toast && <div class="toast" key={u.toast.id} role="status">{u.toast.msg}</div>}
    </>
  );
}

// ---------- primitives ----------
export function Header({ title, onBack, right, sub }) {
  return (
    <header class="screen-head">
      <div class="screen-head-row">
        {onBack && (
          <button class="icon-btn" aria-label="Back" onClick={onBack}><Icon name="left" size={24} /></button>
        )}
        <div class="screen-head-title">
          <h1 class="h-screen">{title}</h1>
          {sub && <div class="muted small">{sub}</div>}
        </div>
        <div class="screen-head-right">{right}</div>
      </div>
    </header>
  );
}

export function Chips({ options, value, onChange, class: cls = '' }) {
  return (
    <div class={'chips ' + cls} role="tablist">
      {options.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={k === value} class={'chip' + (k === value ? ' on' : '')} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div class="seg" role="tablist">
      {options.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={k === value} class={k === value ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, fmt = (v) => v, label }) {
  return (
    <div class="stepper" aria-label={label}>
      <button class="icon-btn sm" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - step))}><span class="minus" /></button>
      <span class="stepper-val num">{fmt(value)}</span>
      <button class="icon-btn sm" aria-label="Increase" onClick={() => onChange(Math.min(max, value + step))}><Icon name="plus" size={18} /></button>
    </div>
  );
}

export function Toggle({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} class={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

// Numeric text input that keeps what you type (e.g. "180.") while committing parsed numbers
export function NumInput({ value, onChange, placeholder, decimal = true, class: cls = '', label, onEnter, inputRef }) {
  // While focused the field shows exactly what was typed (e.g. "180."); otherwise it shows the stored value.
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const shown = editing ? text : value == null ? '' : String(value);
  return (
    <input
      ref={inputRef}
      class={'num-in num ' + cls}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterkeyhint="done"
      aria-label={label}
      placeholder={placeholder == null ? '' : String(placeholder)}
      value={shown}
      onFocus={(e) => {
        setText(value == null ? '' : String(value));
        setEditing(true);
        setTimeout(() => { try { e.target.select(); } catch (x) { /* ignore */ } }, 0);
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); onEnter && onEnter(); } }}
      onInput={(e) => {
        let t = e.target.value.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
        const parts = t.split('.');
        if (parts.length > 2) t = parts[0] + '.' + parts.slice(1).join('');
        setText(t);
        setEditing(true);
        const n = t === '' || t === '.' ? null : parseFloat(t);
        onChange(n == null || isNaN(n) ? null : n);
      }}
    />
  );
}

export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(Math.round(ref.current.getBoundingClientRect().width));
    const ro = new ResizeObserver((e) => setW(Math.round(e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function Empty({ title, body, action }) {
  return (
    <div class="empty">
      <div class="empty-title">{title}</div>
      {body && <p class="muted">{body}</p>}
      {action}
    </div>
  );
}

export function plateVar(color) {
  return `var(--plate-${color || 'blue'})`;
}
