import { render, Component } from 'preact';
import { useEffect } from 'preact/hooks';
import { loadState, useStore } from './store.js';
import { useUI, setTab, push, Icon, SheetHost } from './ui.jsx';
import { TrainScreen } from './screens/train.jsx';
import { HistoryScreen } from './screens/history.jsx';
import { ProgressScreen } from './screens/progress.jsx';
import { PlansScreen, TemplateEditor, ProgramScreen, ProgramEditor } from './screens/plans.jsx';
import { WorkoutEditor } from './screens/workout.jsx';
import { ExerciseScreen } from './screens/exercise.jsx';
import { SettingsScreen } from './screens/settings.jsx';
import { fmtClock } from './lib/util.js';
import { useState } from 'preact/hooks';

const TABS = [
  ['train', 'Train', 'train'],
  ['history', 'History', 'history'],
  ['progress', 'Progress', 'progress'],
  ['plans', 'Plans', 'plans'],
];

function Screen({ s }) {
  const p = s.params;
  switch (s.screen) {
    case 'workout': return <WorkoutEditor mode="active" />;
    case 'editWorkout': return <WorkoutEditor mode="edit" workoutId={p.id} draft={p.draft} />;
    case 'exercise': return <ExerciseScreen id={p.id} />;
    case 'template': return <TemplateEditor id={p.id} />;
    case 'program': return <ProgramScreen id={p.id} />;
    case 'programEdit': return <ProgramEditor id={p.id} />;
    case 'settings': return <SettingsScreen />;
    default: return null;
  }
}

function MiniBar({ active }) {
  const [, f] = useState(0);
  useEffect(() => { const i = setInterval(() => f((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  return (
    <button class="mini-bar" onClick={() => push('workout')}>
      <span class="resume-dot" />
      <span class="mini-name">{active.name}</span>
      <span class="num mini-time">{fmtClock((Date.now() - active.start) / 1000)}</span>
      <Icon name="up" size={20} />
    </button>
  );
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#14171a' : '#e8ebe8');
}

function App() {
  const s = useStore();
  const u = useUI();
  useEffect(() => { applyTheme(s.settings.theme); }, [s.settings.theme]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => applyTheme(s.settings.theme);
    mq.addEventListener && mq.addEventListener('change', h);
    return () => mq.removeEventListener && mq.removeEventListener('change', h);
  }, [s.settings.theme]);
  const covered = u.stack.length > 0;
  useEffect(() => { document.documentElement.classList.toggle('covered', covered); }, [covered]);
  const showMini = s.active && u.tab !== 'train' && !u.stack.some((x) => x.screen === 'workout');
  return (
    <>
      <main class={'tab-page' + (showMini ? ' with-mini' : '')} aria-hidden={covered ? 'true' : undefined}>
        {u.tab === 'train' && <TrainScreen />}
        {u.tab === 'history' && <HistoryScreen />}
        {u.tab === 'progress' && <ProgressScreen />}
        {u.tab === 'plans' && <PlansScreen />}
      </main>
      {showMini && !covered && <MiniBar active={s.active} />}
      <nav class="tabbar" aria-label="Sections">
        {TABS.map(([k, label, icon]) => (
          <button key={k} class={'tab' + (u.tab === k ? ' on' : '')} aria-current={u.tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
            <Icon name={icon} size={24} stroke={u.tab === k ? 2.3 : 1.9} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {u.stack.map((sc, i) => (
        <div key={sc.key} class={'layer' + (i === u.stack.length - 1 ? ' top' : '')} style={{ zIndex: 100 + i }}
          aria-hidden={i === u.stack.length - 1 ? undefined : 'true'}>
          <Screen s={sc} />
        </div>
      ))}
      <SheetHost />
    </>
  );
}

class Boundary extends Component {
  constructor() { super(); this.state = { err: null }; }
  componentDidCatch(err) { this.setState({ err }); console.error(err); }
  render() {
    if (this.state.err) {
      return (
        <div class="crash">
          <h1 class="h-page">Something broke</h1>
          <p>Your data is safe on this phone. Go back and carry on, or reload if it happens again.</p>
          <pre>{String(this.state.err && (this.state.err.stack || this.state.err.message))}</pre>
          <button class="btn btn-primary" onClick={() => { setTab('train'); this.setState({ err: null }); }}>Back to Train</button>
          <button class="btn" onClick={() => location.reload()}>Reload the app</button>
        </div>
      );
    }
    return this.props.children;
  }
}

loadState().then(() => {
  render(<Boundary><App /></Boundary>, document.getElementById('app'));
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
