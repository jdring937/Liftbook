import { useEffect, useState } from 'preact/hooks';

// Animated exercise figures. A 2D rig is posed by joint angles; each exercise defines a start
// pose (a) and an end pose (b), and the figure moves between them. Angles are in degrees.
//   side view, figure faces right (+x):
//     t        torso lean: 0 upright, +90 bent forward flat, -90 lying on its back (head to the left)
//     hd       extra head tilt relative to the torso
//     ua, fa   upper arm and forearm: 0 hangs straight down, +90 points forward, 180 points up
//     hn       hand (wrist curls); defaults to the forearm angle
//     th, sh   thigh and shin: 0 straight down, +90 forward (seated thigh), negative points back
//     ft       foot: 0 flat, negative points the toes down (calf raise)
//     ua2/fa2/hn2/th2/sh2/ft2   far-side limbs when they differ (lunges, one-arm moves)
//   front view: ab/ab2 (arm out to the side, 0 down, 90 level), el/el2 (elbow bend), sg (shrug), lg (legs apart)
//   top view: hz/hz2 (0 out to the side, 90 straight ahead), el (elbow bend), k (upper arm visible), rot (torso turn)

const LEN = { torso: 48, neck: 4, head: 10, ua: 28, fa: 25, th: 41, sh: 39, foot: 14 };
const GROUND = 168;
const rad = (d) => (d * Math.PI) / 180;
const down = (a, l) => [Math.sin(rad(a)) * l, Math.cos(rad(a)) * l];
const add = (p, v) => [p[0] + v[0], p[1] + v[1]];

function fk(p) {
  const hip = [0, 0];
  const up = [Math.sin(rad(p.t)), -Math.cos(rad(p.t))];
  const sho = [up[0] * LEN.torso, up[1] * LEN.torso];
  const ht = p.t + (p.hd || 0);
  const head = add(sho, [Math.sin(rad(ht)) * (LEN.neck + LEN.head), -Math.cos(rad(ht)) * (LEN.neck + LEN.head)]);
  const arm = (ua, fa) => { const el = add(sho, down(ua, LEN.ua)); const wr = add(el, down(fa, LEN.fa)); return [el, wr]; };
  const leg = (th, sh, ft) => {
    const kn = add(hip, down(th, LEN.th));
    const an = add(kn, down(sh, LEN.sh));
    const toe = add(an, [Math.cos(rad(ft || 0)) * LEN.foot, -Math.sin(rad(ft || 0)) * LEN.foot]);
    return [kn, an, toe];
  };
  const [el, wr] = arm(p.ua, p.fa);
  const [el2, wr2] = arm(p.ua2 ?? p.ua, p.fa2 ?? p.fa);
  const hd = add(wr, down(p.hn ?? p.fa, 6));
  const hd2 = add(wr2, down(p.hn2 ?? p.hn ?? p.fa2 ?? p.fa, 6));
  const [kn, an, toe] = leg(p.th, p.sh, p.ft);
  const [kn2, an2, toe2] = leg(p.th2 ?? p.th, p.sh2 ?? p.sh, p.ft2 ?? p.ft);
  return { hip, sho, head, el, wr, el2, wr2, hd, hd2, kn, an, toe, kn2, an2, toe2 };
}

function place(j, anchor) {
  const src = j[anchor.joint];
  const dx = anchor.at[0] - src[0], dy = anchor.at[1] - src[1];
  const out = {};
  for (const k in j) out[k] = [j[k][0] + dx, j[k][1] + dy];
  return out;
}

// tapered capsule between two points
function capsule(a, b, r1, r2) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 0.001;
  const th = Math.atan2(dy, dx);
  const ph = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
  const p = (c, r, ang) => `${(c[0] + r * Math.cos(ang)).toFixed(2)},${(c[1] + r * Math.sin(ang)).toFixed(2)}`;
  return `M${p(a, r1, th + ph)}L${p(b, r2, th + ph)}A${r2},${r2} 0 0 0 ${p(b, r2, th - ph)}L${p(a, r1, th - ph)}A${r1},${r1} 0 1 0 ${p(a, r1, th + ph)}Z`;
}

const lerp = (a, b, t) => a + (b - a) * t;
function mix(a, b, t) {
  const o = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k] ?? b[k], vb = b[k] ?? a[k];
    o[k] = typeof va === 'number' ? lerp(va, vb, t) : va;
  }
  return o;
}
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// timeline: hold start, move to end, hold, return
export function phase(ms, tempo) {
  const [h1, up, h2, back] = tempo || [350, 1000, 300, 1300];
  const total = h1 + up + h2 + back;
  let t = ms % total;
  if (t < h1) return 0;
  t -= h1;
  if (t < up) return ease(t / up);
  t -= up;
  if (t < h2) return 1;
  t -= h2;
  return 1 - ease(t / back);
}

// which body segments light up for the exercise's main muscles
const SEG = {
  chest: 'torso', abs: 'torso', obliques: 'torso', lats: 'torso', upperBack: 'torso', traps: 'torso', lowerBack: 'torso',
  biceps: 'ua', triceps: 'ua', frontDelts: 'ua', sideDelts: 'ua', rearDelts: 'ua',
  forearms: 'fa', quads: 'th', hamstrings: 'th', glutes: 'th', adductors: 'th', calves: 'sh',
};
// Three depths so overlapping parts stay readable: near limbs lightest, torso a step darker,
// far limbs darkest. Worked muscles use the same three steps in red.
function segColors(muscles) {
  const on = new Set((muscles || []).map((m) => SEG[m]).filter(Boolean));
  return (seg, far) => {
    const hot = on.has(seg);
    if (far) return hot ? 'var(--anim-hot-far)' : 'var(--anim-far)';
    if (seg === 'torso') return hot ? 'var(--anim-hot-torso)' : 'var(--anim-torso)';
    return hot ? 'var(--anim-hot)' : 'var(--anim-body)';
  };
}
const EDGE = { stroke: 'var(--anim-edge)', 'stroke-width': 1.7, 'stroke-linejoin': 'round' };

// ---------- equipment ----------
function Props({ props, j }) {
  return (props || []).map((p, i) => {
    switch (p.type) {
      case 'bench': {
        const h = p.h ?? 7;
        return (
          <g key={i} fill="var(--anim-prop)">
            <rect x={p.x} y={p.y} width={p.w} height={h} rx="3" transform={p.angle ? `rotate(${p.angle} ${p.ax ?? p.x + p.w} ${p.ay ?? p.y})` : undefined} />
            {(p.legs || []).map((lx, k) => <rect key={k} x={lx - 2} y={p.y + h} width="4" height={GROUND - p.y - h} />)}
          </g>
        );
      }
      case 'pad':
        return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r ?? 4} fill="var(--anim-prop)" transform={p.angle ? `rotate(${p.angle} ${p.ax ?? p.x} ${p.ay ?? p.y})` : undefined} />;
      case 'tower':
        return <rect key={i} x={p.x - 5} y={p.y1} width="10" height={GROUND - p.y1} rx="2" fill="var(--anim-prop)" />;
      case 'cable': {
        const h = j[p.hand || 'wr'];
        return (
          <g key={i}>
            <line x1={p.from[0]} y1={p.from[1]} x2={h[0]} y2={h[1]} stroke="var(--anim-steel)" stroke-width="1.6" />
            <circle cx={p.from[0]} cy={p.from[1]} r="3.5" fill="none" stroke="var(--anim-steel)" stroke-width="2" />
          </g>
        );
      }
      case 'bar':
        return <line key={i} x1={p.x1} y1={p.y} x2={p.x2} y2={p.y} stroke="var(--anim-steel)" stroke-width="4" stroke-linecap="round" />;
      case 'post':
        return <rect key={i} x={p.x - 3} y={p.y} width="6" height={GROUND - p.y} rx="2" fill="var(--anim-prop)" />;
      case 'box':
        return <rect key={i} x={p.x} y={p.y} width={p.w} height={GROUND - p.y} rx="3" fill="var(--anim-prop)" />;
      case 'footplate': {
        const c = j[p.joint || 'an'];
        const a = rad(p.angle ?? 45);
        const dx = Math.cos(a) * 16, dy = Math.sin(a) * 16;
        const o = p.offset || [0, 0];
        return <line key={i} x1={c[0] + o[0] - dx} y1={c[1] + o[1] - dy} x2={c[0] + o[0] + dx} y2={c[1] + o[1] + dy} stroke="var(--anim-steel)" stroke-width="5" stroke-linecap="round" />;
      }
      case 'roller': {
        const c = j[p.joint || 'an'];
        const o = p.offset || [0, 0];
        return <circle key={i} cx={c[0] + o[0]} cy={c[1] + o[1]} r={p.r || 5.5} fill="var(--anim-steel-dark)" />;
      }
      default:
        return null;
    }
  });
}

function Plate({ c }) {
  return (
    <g>
      <circle cx={c[0]} cy={c[1]} r="15" fill="none" stroke="var(--plate-blue)" stroke-width="5" opacity=".95" />
      <circle cx={c[0]} cy={c[1]} r="4" fill="var(--anim-steel)" />
    </g>
  );
}

function Implement({ kind, j, far, at }) {
  const h = far ? j[at === 'hd' ? 'hd2' : 'wr2'] : j[at || 'wr'];
  if (!kind || !h) return null;
  if (kind === 'barbell') return <Plate c={h} />;
  if (kind === 'backbar') return <Plate c={[j.sho[0] - 8, j.sho[1] + 5]} />;
  if (kind === 'frontbar') return <Plate c={[j.sho[0] + 9, j.sho[1] + 3]} />;
  if (kind === 'hipbar') return <Plate c={[j.hip[0] + 4, j.hip[1] - 12]} />;
  if (kind === 'kettlebell') {
    return (
      <g>
        <circle cx={h[0]} cy={h[1] + 9} r="8" fill="var(--anim-steel-dark)" />
        <path d={`M${h[0] - 5},${h[1] + 4}Q${h[0]},${h[1] - 4} ${h[0] + 5},${h[1] + 4}`} fill="none" stroke="var(--anim-steel-dark)" stroke-width="2.5" />
      </g>
    );
  }
  if (kind === 'rope') return <line x1={h[0]} y1={h[1]} x2={h[0] - 2} y2={h[1] + 9} stroke="var(--anim-steel)" stroke-width="3" stroke-linecap="round" />;
  if (kind === 'dumbbell') {
    return (
      <g opacity={far ? 0.7 : 1}>
        <circle cx={h[0]} cy={h[1]} r="7.5" fill="var(--anim-steel-dark)" />
        <circle cx={h[0]} cy={h[1]} r="3" fill="var(--anim-steel)" />
      </g>
    );
  }
  if (kind === 'handle') return <rect x={h[0] - 6} y={h[1] - 2} width="12" height="4" rx="2" fill="var(--anim-steel)" />;
  if (kind === 'wheel') return <circle cx={h[0]} cy={h[1] + 3} r="8" fill="none" stroke="var(--anim-steel-dark)" stroke-width="4" />;
  return null;
}

function SideFigure({ j, color, implement, one, at }) {
  const limb = (a, b, r1, r2, seg, far) => <path d={capsule(a, b, r1, r2)} fill={color(seg, far)} {...(far ? {} : EDGE)} />;
  const bar = implement === 'barbell' || implement === 'backbar' || implement === 'frontbar' || implement === 'hipbar';
  return (
    <g>
      {limb(j.sho, j.el2, 5.6, 4.6, 'ua', true)}
      {limb(j.el2, j.wr2, 4.4, 3.4, 'fa', true)}
      {limb(j.wr2, j.hd2, 3.4, 3, 'fa', true)}
      {limb(j.hip, j.kn2, 8.4, 6, 'th', true)}
      {limb(j.kn2, j.an2, 5.6, 4, 'sh', true)}
      {limb(j.an2, j.toe2, 3.6, 2.6, 'foot', true)}
      {!bar && !one && <Implement kind={implement} j={j} far at={at} />}
      {limb(j.hip, j.sho, 9.5, 11, 'torso')}
      <circle cx={j.head[0]} cy={j.head[1]} r={LEN.head} fill="var(--anim-torso)" {...EDGE} />
      {limb(j.hip, j.kn, 8.6, 6.2, 'th')}
      {limb(j.kn, j.an, 5.8, 4.2, 'sh')}
      {limb(j.an, j.toe, 3.8, 2.8, 'foot')}
      {limb(j.sho, j.el, 5.8, 4.8, 'ua')}
      {limb(j.el, j.wr, 4.6, 3.6, 'fa')}
      {limb(j.wr, j.hd, 3.6, 3.1, 'fa')}
      <Implement kind={implement} j={j} at={at} />
    </g>
  );
}

// ---------- front view: side raises, shrugs, upright rows, leg spreads ----------
function FrontFigure({ p, color, implement }) {
  const cx = 120, shoY = 52 - (p.sg || 0), hipY = 98;
  const parts = [];
  for (const side of [-1, 1]) {
    const lg = p.lg || 0;
    const hip = [cx + side * 7, hipY];
    const kn = [hip[0] + side * Math.sin(rad(lg + 2)) * 38, hipY + Math.cos(rad(lg + 2)) * 38];
    const an = [kn[0] + side * Math.sin(rad(lg + 2)) * 39, kn[1] + Math.cos(rad(lg + 2)) * 39];
    parts.push(<path key={'t' + side} d={capsule(hip, kn, 8.2, 6)} fill={color('th')} {...EDGE} />);
    parts.push(<path key={'s' + side} d={capsule(kn, an, 5.6, 4)} fill={color('sh')} {...EDGE} />);
    parts.push(<path key={'f' + side} d={capsule(an, [an[0] + side * 4, an[1] + 3], 3.8, 3)} fill={color('foot')} {...EDGE} />);
  }
  parts.push(<path key="torso" d={capsule([cx, hipY], [cx, shoY + 4], 13, 17)} fill={color('torso')} {...EDGE} />);
  parts.push(<circle key="head" cx={cx} cy={shoY - 14} r={LEN.head} fill="var(--anim-torso)" {...EDGE} />);
  const hands = [];
  for (const side of [-1, 1]) {
    const sho = [cx + side * 17, shoY + 2];
    const a = side === 1 && p.ab2 != null ? p.ab2 : p.ab;
    const el = [sho[0] + side * Math.sin(rad(a)) * LEN.ua, sho[1] + Math.cos(rad(a)) * LEN.ua];
    const b = a + (side === 1 && p.el2 != null ? p.el2 : p.el || 0);
    const wr = [el[0] + side * Math.sin(rad(b)) * LEN.fa, el[1] + Math.cos(rad(b)) * LEN.fa];
    hands.push(wr);
    parts.push(<path key={'u' + side} d={capsule(sho, el, 5.8, 4.8)} fill={color('ua')} {...EDGE} />);
    parts.push(<path key={'f' + side} d={capsule(el, wr, 4.6, 3.6)} fill={color('fa')} {...EDGE} />);
    if (implement === 'dumbbell') parts.push(<rect key={'d' + side} x={wr[0] - 3} y={wr[1] - 9} width="6" height="18" rx="2.5" fill="var(--anim-steel-dark)" />);
    if (implement === 'handle' || implement === 'cables') parts.push(<rect key={'h' + side} x={wr[0] - 2} y={wr[1] - 6} width="4" height="12" rx="2" fill="var(--anim-steel)" />);
  }
  if (implement === 'barbell') {
    const y = (hands[0][1] + hands[1][1]) / 2;
    parts.push(<line key="bar" x1={cx - 70} y1={y} x2={cx + 70} y2={y} stroke="var(--anim-steel)" stroke-width="3.5" stroke-linecap="round" />);
    parts.push(<rect key="p1" x={cx - 66} y={y - 17} width="8" height="34" rx="2.5" fill="var(--plate-blue)" />);
    parts.push(<rect key="p2" x={cx + 58} y={y - 17} width="8" height="34" rx="2.5" fill="var(--plate-blue)" />);
  }
  if (implement === 'cables') {
    hands.forEach((h, i) => parts.unshift(<line key={'c' + i} x1={i ? 228 : 12} y1={p.cy ?? GROUND - 4} x2={h[0]} y2={h[1]} stroke="var(--anim-steel)" stroke-width="1.6" />));
  }
  return <g>{parts}</g>;
}

// ---------- top view: arms moving across the body (flies, face pulls, rotations) ----------
function TopFigure({ p, color, implement, props, one }) {
  const cx = 120, cy = 104;
  const r = rad(p.rot || 0);
  const R = (v) => [cx + v[0] * Math.cos(r) - v[1] * Math.sin(r), cy + v[0] * Math.sin(r) + v[1] * Math.cos(r)];
  const parts = [];
  if (props && props.bench) parts.push(<rect key="bench" x={cx - 14} y={cy - 26} width="28" height="96" rx="5" fill="var(--anim-prop)" />);
  const hands = [];
  for (const side of [-1, 1]) {
    const moving = !(one && side === -1);
    const hz = rad(!moving ? 270 : side === -1 && p.hz2 != null ? p.hz2 : p.hz);
    const k = !moving ? 0.35 : p.k ?? 1;
    const sho = [side * 22, 0];
    const el = [sho[0] + side * Math.cos(hz) * LEN.ua * k, sho[1] - Math.sin(hz) * LEN.ua * k];
    const f = !moving ? hz : hz + rad(p.el || 0);
    const fl = moving ? 1 : 0.2;
    const wr = [el[0] + side * Math.cos(f) * LEN.fa * fl, el[1] - Math.sin(f) * LEN.fa * fl];
    parts.push(<path key={'u' + side} d={capsule(R(sho), R(el), 6, 5)} fill={color('ua', !moving)} {...EDGE} />);
    parts.push(<path key={'f' + side} d={capsule(R(el), R(wr), 4.8, 3.8)} fill={color('fa', !moving)} {...EDGE} />);
    if (moving) hands.push(R(wr));
  }
  parts.push(<ellipse key="torso" cx={cx} cy={cy} rx="27" ry="13" fill={color('torso')} {...EDGE} transform={`rotate(${p.rot || 0} ${cx} ${cy})`} />);
  const hc = R([0, -6]);
  parts.push(<circle key="head" cx={hc[0]} cy={hc[1]} r="10.5" fill="var(--anim-body)" {...EDGE} />);
  const nose = R([0, -17]);
  parts.push(<circle key="nose" cx={nose[0]} cy={nose[1]} r="2.8" fill="var(--anim-body)" {...EDGE} />);
  hands.forEach((h, i) => {
    if (implement === 'dumbbell') parts.push(<rect key={'d' + i} x={h[0] - 8} y={h[1] - 3.5} width="16" height="7" rx="3" fill="var(--anim-steel-dark)" />);
    if (implement === 'handle' || implement === 'rope') parts.push(<circle key={'h' + i} cx={h[0]} cy={h[1]} r="3.5" fill="var(--anim-steel)" />);
    if (props && props.cableFrom) parts.unshift(<line key={'c' + i} x1={props.cableFrom[0]} y1={props.cableFrom[1]} x2={h[0]} y2={h[1]} stroke="var(--anim-steel)" stroke-width="1.6" />);
    if (props && props.cablesSide != null) parts.unshift(<line key={'s' + i} x1={h[0] < cx ? 8 : 232} y1={props.cablesSide} x2={h[0]} y2={h[1]} stroke="var(--anim-steel)" stroke-width="1.6" />);
  });
  if (props && props.cableFrom) parts.unshift(<circle key="pulley" cx={props.cableFrom[0]} cy={props.cableFrom[1]} r="4" fill="none" stroke="var(--anim-steel)" stroke-width="2" />);
  return <g>{parts}</g>;
}

export function MoveAnim({ move, muscles, label, at = null }) {
  const [t, setT] = useState(at ?? 0);
  useEffect(() => {
    if (at != null) { setT(at); return; }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setT(1); return; }
    let raf, alive = true;
    const start = performance.now();
    const loop = (now) => {
      if (!alive) return;
      setT(phase(now - start, move.tempo));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [move, at]);
  const color = segColors(muscles);
  const p = mix(move.a, move.b, t);
  let body;
  if (move.view === 'front') body = <FrontFigure p={p} color={color} implement={move.implement} />;
  else if (move.view === 'top') body = <TopFigure p={p} color={color} implement={move.implement} props={move.props} one={move.one} />;
  else {
    const j = place(fk(p), move.anchor);
    body = <><Props props={move.props} j={j} /><SideFigure j={j} color={color} implement={move.implement} one={move.one} at={move.at} /></>;
  }
  const z = move.zoom || 1;
  return (
    <svg class="move-anim" viewBox="0 0 240 180" role="img" aria-label={label || 'Exercise animation'}>
      {move.view !== 'top' && <line x1="0" y1={GROUND} x2="240" y2={GROUND} stroke="var(--line)" stroke-width="1.5" />}
      {z === 1 ? body : <g transform={`translate(120 ${GROUND}) scale(${z}) translate(-120 ${-GROUND})`}>{body}</g>}
    </svg>
  );
}
