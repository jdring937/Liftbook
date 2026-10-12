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
export function BarChart({ data, fmt, fmtAxis = fmt, height = 210, xLabel, tipLabel, color = 'var(--series)' }) {
  const [ref, width] = useWidth();
  const [sel, setSel] = useState(null);
  const W = width || 320, H = height;
  const padL = 40, padR = 6, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
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
export function LineChart({ points, fmt, fmtAxis = fmt, height = 220, tipLabel, color = 'var(--series)', zero = false }) {
  const [ref, width] = useWidth();
  const [sel, setSel] = useState(null);
  const W = width || 320, H = height;
  const padL = 44, padR = 14, padT = 16, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  if (!points.length) return <div class="chart" ref={ref} />;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  const ticks = niceRange(zero ? 0 : Math.min(...ys), Math.max(...ys), 4);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const X = (v) => padL + ((v - x0) / (x1 - x0)) * iw;
  const Y = (v) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(points[points.length - 1].x).toFixed(1)},${padT + ih}L${X(points[0].x).toFixed(1)},${padT + ih}Z`;
  const showDots = points.length <= 40;
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
        <path d={area} fill={color} opacity=".1" />
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
