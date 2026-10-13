import { useState } from 'preact/hooks';
import { useWidth } from '../ui.jsx';
import { niceMax, niceRange } from '../lib/calc.js';

const AX = 'var(--text-3)';
const GRID = 'var(--line)';

function Tip({ x, w, children }) {
  // keep the tooltip inside the chart box
  const left = Math.min(Math.max(x, 70), w - 70);
  return <div class="chart-tip" style={{ left: left + 'px' }}>{children}</div>;
}

// Column chart for totals per day / week / month
export function BarChart({ data, fmt, fmtAxis = fmt, height = 210, xLabel, tipLabel, color = 'var(--series)', target = null, targetLabel = 'Goal' }) {
  const [ref, width] = useWidth();
  const [sel, setSel] = useState(null);
  const W = width || 320, H = height;
  const padL = 40, padR = 6, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = niceMax(Math.max(0, target || 0, ...data.map((d) => d.value)));
  const ticks = [0, max / 2, max];
  const band = iw / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(24, band * 0.62));
  const gap = band - bw < 2 ? 0 : 0;
  const y = (v) => padT + ih - (v / max) * ih;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 58))));
  const pick = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const i = Math.floor((clientX - r.left - padL) / band);
    setSel(i >= 0 && i < data.length ? i : null);
  };
  const s = sel != null ? data[sel] : null;
  return (
    <div class="chart" ref={ref} onPointerLeave={() => setSel(null)}>
      <svg width={W} height={H} role="img" aria-label="Column chart"
        onPointerDown={(e) => pick(e.clientX)} onPointerMove={(e) => e.pointerType === 'mouse' && pick(e.clientX)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} stroke-width="1" />
            <text x={padL - 8} y={y(t) + 4} text-anchor="end" class="ax">{fmtAxis(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          if (!d.value) return null;
          const x = padL + i * band + (band - bw) / 2 + gap;
          const h = Math.max(2, (d.value / max) * ih);
          const r = Math.min(4, bw / 2, h);
          const yy = padT + ih - h;
          return (
            <path key={i} d={`M${x},${padT + ih}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${padT + ih}Z`}
              fill={color} opacity={sel == null || sel === i ? 1 : 0.45} />
          );
        })}
        {data.map((d, i) => (i % every === 0 ? (
          <text key={'l' + i} x={padL + i * band + band / 2} y={H - 8} text-anchor="middle" class="ax">{xLabel(d)}</text>
        ) : null))}
        {target != null && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="var(--text-2)" stroke-width="1.5" stroke-dasharray="5 4" />
            <text x={W - padR} y={y(target) - 6} text-anchor="end" class="ax ax-strong">{targetLabel}</text>
          </g>
        )}
        {s && <line x1={padL + sel * band + band / 2} x2={padL + sel * band + band / 2} y1={padT} y2={padT + ih} stroke="var(--text-3)" stroke-width="1" opacity=".5" />}
      </svg>
      {s && (
        <Tip x={padL + sel * band + band / 2} w={W}>
          <strong class="num">{fmt(s.value)}</strong>
          <span>{tipLabel(s)}</span>
        </Tip>
      )}
    </div>
  );
}

// Line chart over time with a crosshair readout
export function LineChart({ points, raw = null, fmt, fmtAxis = fmt, height = 220, tipLabel, color = 'var(--series)', zero = false }) {
  const [ref, width] = useWidth();
  const [sel, setSel] = useState(null);
  const W = width || 320, H = height;
  const padL = 44, padR = 14, padT = 16, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  if (!points.length) return <div class="chart" ref={ref} />;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  const ally = raw ? [...ys, ...raw.map((p) => p.y)] : ys;
  const ticks = niceRange(zero ? 0 : Math.min(...ally), Math.max(...ally), 4);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const X = (v) => padL + ((v - x0) / (x1 - x0)) * iw;
  const Y = (v) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(points[points.length - 1].x).toFixed(1)},${padT + ih}L${X(points[0].x).toFixed(1)},${padT + ih}Z`;
  const showDots = !raw && points.length <= 40;
  const pick = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(X(p.x) - px); if (d < bd) { bd = d; best = i; } });
    setSel(best);
  };
  // x-axis: first and last date, plus middle if space
  const xl = [points[0], points[points.length - 1]];
  const last = points[points.length - 1];
  const s = sel != null ? points[sel] : null;
  return (
    <div class="chart" ref={ref} onPointerLeave={() => setSel(null)}>
      <svg width={W} height={H} role="img" aria-label="Line chart"
        onPointerDown={(e) => pick(e.clientX)} onPointerMove={(e) => pick(e.clientX)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke={GRID} stroke-width="1" />
            <text x={padL - 8} y={Y(t) + 4} text-anchor="end" class="ax">{fmtAxis(t)}</text>
          </g>
        ))}
        {!raw && <path d={area} fill={color} opacity=".1" />}
        {raw && raw.map((p, i) => <circle key={'r' + i} cx={X(p.x)} cy={Y(p.y)} r="2.8" fill="var(--text-3)" />)}
        <path d={line} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {showDots && points.map((p, i) => (
          <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={p.pr ? 5 : 4} fill={p.pr ? 'var(--yellow)' : color} stroke="var(--surface)" stroke-width="2" />
        ))}
        {!showDots && <circle cx={X(last.x)} cy={Y(last.y)} r="4.5" fill={color} stroke="var(--surface)" stroke-width="2" />}
        {xl.map((p, i) => (
          <text key={i} x={X(p.x)} y={H - 8} text-anchor={i ? 'end' : 'start'} class="ax">{p.label}</text>
        ))}
        {s && (
          <g>
            <line x1={X(s.x)} x2={X(s.x)} y1={padT} y2={padT + ih} stroke="var(--text-3)" stroke-width="1" />
            <circle cx={X(s.x)} cy={Y(s.y)} r="6" fill={color} stroke="var(--surface)" stroke-width="2" />
          </g>
        )}
      </svg>
      {s && (
        <Tip x={X(s.x)} w={W}>
          <strong class="num">{fmt(s.y)}</strong>
          <span>{tipLabel(s)}</span>
        </Tip>
      )}
    </div>
  );
}

export function Sparkline({ values, width = 76, height = 28, color = 'var(--series)' }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const lo = Math.min(...values), hi = Math.max(...values);
  const X = (i) => 2 + (i / (values.length - 1)) * (width - 6);
  const Y = (v) => 3 + (height - 6) - ((v - lo) / (hi - lo || 1)) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx={X(values.length - 1)} cy={Y(values[values.length - 1])} r="3" fill={color} />
    </svg>
  );
}

// Radar of sets per muscle group
export function Radar({ axes, size = 320, fmt = (v) => v }) {
  const [ref, width] = useWidth();
  const W = Math.min(width || size, 420);
  const H = W * 0.92;
  const cx = W / 2, cy = H / 2 + 2, R = W * 0.3;
  const max = Math.max(1, ...axes.map((a) => a.value));
  const n = axes.length;
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = (f) => axes.map((_, i) => pt(i, f).map((v) => v.toFixed(1)).join(',')).join(' ');
  const data = axes.map((a, i) => pt(i, a.value / max).map((v) => v.toFixed(1)).join(',')).join(' ');
  return (
    <div class="chart radar" ref={ref}>
      <svg width={W} height={H} role="img" aria-label="Radar chart of sets per muscle group">
        {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(f)} fill="none" stroke={GRID} stroke-width="1" />)}
        {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} stroke-width="1" />; })}
        <polygon points={data} fill="var(--series)" fill-opacity=".14" stroke="var(--series)" stroke-width="2" stroke-linejoin="round" />
        {axes.map((a, i) => { const [x, y] = pt(i, a.value / max); return <circle key={i} cx={x} cy={y} r="4" fill="var(--series)" stroke="var(--surface)" stroke-width="2" />; })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.22);
          const anchor = Math.abs(x - cx) < 8 ? 'middle' : x < cx ? 'end' : 'start';
          return (
            <g key={'t' + i}>
              <text x={x} y={y - 2} text-anchor={anchor} class="radar-l">{a.label}</text>
              <text x={x} y={y + 13} text-anchor={anchor} class="radar-v num">{fmt(a.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Goal chart: actual values, the planned path, and a forecast with its uncertainty band
export function ForecastChart({ series, raw = null, goal, fc, conv, fmt, now = Date.now(), height = 240, dateLabel }) {
  const [ref, width] = useWidth();
  const [sel, setSel] = useState(null);
  const W = width || 320, H = height;
  const padL = 44, padR = 16, padT = 18, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const D = 86400000;
  const recent = series.filter((p) => p.t >= now - 16 * 7 * D);
  const pts = recent.length >= 2 ? recent : series.slice(-12);
  let t0 = Math.min(goal.startT || now, pts.length ? pts[0].t : now);
  t0 = Math.max(t0, now - 26 * 7 * D);
  let t1 = now + 28 * D;
  if (goal.date) t1 = Math.max(t1, goal.date + 7 * D);
  if (fc && fc.eta) t1 = Math.max(t1, Math.min(fc.eta + 7 * D, now + 52 * 7 * D));
  if (fc && !fc.eta) t1 = Math.max(t1, now + 12 * 7 * D);
  const fT = (t) => Math.min(t, t1);
  const ys = [goal.target, ...pts.map((p) => p.v)];
  if (raw) ys.push(...raw.filter((p) => p.t >= t0).map((p) => p.v));
  if (goal.startT >= t0) ys.push(goal.start);
  const steps = 24;
  const fpts = fc ? Array.from({ length: steps + 1 }, (_, i) => now + ((t1 - now) * i) / steps) : [];
  if (fc) fpts.forEach((t) => { const [lo, hi] = fc.band(t); ys.push(lo, hi); });
  const ticks = niceRange(Math.min(...ys.map(conv)), Math.max(...ys.map(conv)), 4);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const X = (t) => padL + ((t - t0) / (t1 - t0)) * iw;
  const Y = (v) => padT + ih - ((conv(v) - lo) / (hi - lo || 1)) * ih;
  const clampY = (v) => Math.max(padT - 4, Math.min(padT + ih + 4, Y(v)));
  const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${clampY(p.v).toFixed(1)}`).join('');
  const shown = pts.filter((p) => p.t >= t0);
  const band = fc ? fpts.map((t) => ({ t, v: fc.band(t)[1] })).concat([...fpts].reverse().map((t) => ({ t, v: fc.band(t)[0] }))) : [];
  const fline = fc ? fpts.map((t) => ({ t, v: fc.at(t) })) : [];
  const plan = goal.date && goal.startT ? [{ t: Math.max(goal.startT, t0), v: goal.start + (goal.target - goal.start) * ((Math.max(goal.startT, t0) - goal.startT) / Math.max(1, goal.date - goal.startT)) }, { t: fT(goal.date), v: goal.target }] : null;
  const pick = (clientX) => {
    if (!shown.length) return;
    const r = ref.current.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0, bd = Infinity;
    shown.forEach((p, i) => { const d = Math.abs(X(p.t) - px); if (d < bd) { bd = d; best = i; } });
    setSel(bd < 40 ? best : null);
  };
  const sp = sel != null ? shown[sel] : null;
  const fmtD = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div class="chart" ref={ref} onPointerLeave={() => setSel(null)}>
      <svg width={W} height={H} role="img" aria-label="Goal progress and forecast"
        onPointerDown={(e) => pick(e.clientX)} onPointerMove={(e) => e.pointerType === 'mouse' && pick(e.clientX)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={padT + ih - ((t - lo) / (hi - lo || 1)) * ih} y2={padT + ih - ((t - lo) / (hi - lo || 1)) * ih} stroke={GRID} stroke-width="1" />
            <text x={padL - 8} y={padT + ih - ((t - lo) / (hi - lo || 1)) * ih + 4} text-anchor="end" class="ax">{Math.round(t)}</text>
          </g>
        ))}
        <line x1={X(now)} x2={X(now)} y1={padT} y2={padT + ih} stroke="var(--text-3)" stroke-width="1" stroke-dasharray="2 3" />
        <text x={X(now)} y={padT - 6} text-anchor="middle" class="ax">Today</text>
        {fc && <path d={band.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${clampY(p.v).toFixed(1)}`).join('') + 'Z'} fill="var(--series)" opacity=".13" />}
        <line x1={padL} x2={W - padR} y1={Y(goal.target)} y2={Y(goal.target)} stroke="var(--text-2)" stroke-width="1.5" stroke-dasharray="6 4" />
        {plan && <path d={path(plan)} fill="none" stroke="var(--text-3)" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" />}
        {fc && <path d={path(fline)} fill="none" stroke="var(--series)" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round" />}
        {raw && raw.filter((p) => p.t >= t0).map((p, i) => <circle key={'r' + i} cx={X(p.t)} cy={clampY(p.v)} r="2.6" fill="var(--text-3)" />)}
        {shown.length > 1 && <path d={path(shown)} fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />}
        {!raw && shown.map((p, i) => <circle key={i} cx={X(p.t)} cy={clampY(p.v)} r="4" fill="var(--series)" stroke="var(--surface)" stroke-width="2" />)}
        {raw && shown.length > 0 && <circle cx={X(shown[shown.length - 1].t)} cy={clampY(shown[shown.length - 1].v)} r="4.5" fill="var(--series)" stroke="var(--surface)" stroke-width="2" />}
        {fc && fc.eta && fc.eta <= t1 && <circle cx={X(fc.eta)} cy={Y(goal.target)} r="5" fill="var(--surface)" stroke="var(--series)" stroke-width="2.5" />}
        {goal.date && goal.date <= t1 && <circle cx={X(goal.date)} cy={Y(goal.target)} r="4" fill="var(--text-2)" />}
        <text x={padL + 4} y={Y(goal.target) + (Y(goal.target) < padT + 14 ? 14 : -7)} text-anchor="start" class="ax ax-strong">Goal {fmt(goal.target)}</text>
        <text x={padL} y={H - 8} text-anchor="start" class="ax">{fmtD(t0)}</text>
        <text x={W - padR} y={H - 8} text-anchor="end" class="ax">{fmtD(t1)}</text>
        {sp && (
          <g>
            <line x1={X(sp.t)} x2={X(sp.t)} y1={padT} y2={padT + ih} stroke="var(--text-3)" stroke-width="1" />
            <circle cx={X(sp.t)} cy={clampY(sp.v)} r="6" fill="var(--series)" stroke="var(--surface)" stroke-width="2" />
          </g>
        )}
      </svg>
      {sp && (
        <Tip x={X(sp.t)} w={W}>
          <strong class="num">{fmt(sp.v)}</strong>
          <span>{dateLabel ? dateLabel(sp) : fmtD(sp.t)}</span>
        </Tip>
      )}
      <div class="fc-legend small" aria-hidden="true">
        <span><i class="lg-solid" />{raw ? 'Trend' : 'Actual'}</span>
        {fc && <span><i class="lg-dash" />Forecast</span>}
        {plan && <span><i class="lg-plan" />Plan</span>}
        {fc && fc.eta && <span><i class="lg-eta" />Expected</span>}
      </div>
    </div>
  );
}
