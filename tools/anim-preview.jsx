// Dev page: renders every animated move at a controllable time, for screenshots and GIFs.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { MoveAnim } from '../src/components/anim.jsx';
import { MOVES } from '../src/data/moves.js';
import { BUILTIN_EXERCISES } from '../src/data/exercises.js';

function phaseOf(ms, tempo) {
  const [h1, up, h2, back] = tempo || [350, 1000, 300, 1300];
  const total = h1 + up + h2 + back;
  let t = ms % total;
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  if (t < h1) return 0; t -= h1;
  if (t < up) return ease(t / up); t -= up;
  if (t < h2) return 1; t -= h2;
  return 1 - ease(t / back);
}
function App() {
  const [ms, setMs] = useState(null);
  window.setMs = setMs;
  const ids = new URLSearchParams(location.search).get('ids');
  const q = new URLSearchParams(location.search);
  const ab = q.get('ab');
  const from = +(q.get('from') || 0), n = +(q.get('n') || 999);
  const list = (ids ? ids.split(',') : Object.keys(MOVES)).slice(from, from + n);
  return (
    <div class="grid">
      {list.map((id) => {
        const ex = BUILTIN_EXERCISES[id];
        if (ab) {
          return (
            <figure key={id} id={'m-' + id} class="ab">
              <div class="pair"><MoveAnim move={MOVES[id]} muscles={ex.primary} at={0} /><MoveAnim move={MOVES[id]} muscles={ex.primary} at={1} /></div>
              <figcaption>{ex.name}</figcaption>
            </figure>
          );
        }
        return (
          <figure key={id} id={'m-' + id}>
            <MoveAnim move={MOVES[id]} muscles={ex.primary} at={ms == null ? null : phaseOf(ms, MOVES[id].tempo)} />
            <figcaption>{ex.name}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
render(<App />, document.getElementById('app'));
