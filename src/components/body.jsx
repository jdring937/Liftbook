// Abstract segmented body map. Each muscle is drawn once for the left half and mirrored.
// Muscles are separated by a 2px surface-colored gap (the stroke), not outlines.

const FRONT = [
  ['traps', 'path', { d: 'M56.4,32.5 L53.2,33.6 Q47.5,40 40.6,44.6 L56.4,44.6 Z' }],
  ['sideDelts', 'ellipse', { cx: 34, cy: 53, rx: 6.6, ry: 9.6 }],
  ['frontDelts', 'ellipse', { cx: 41.6, cy: 51, rx: 6.6, ry: 8.2 }],
  ['chest', 'path', { d: 'M59,46.5 L47.5,46.5 Q42.2,48.2 42.6,55 L43.5,62 Q45.5,70.5 53,71.5 L59,71.5 Z' }],
  ['biceps', 'ellipse', { cx: 31.6, cy: 74.5, rx: 5.6, ry: 12.2, transform: 'rotate(9 31.6 74.5)' }],
  ['forearms', 'ellipse', { cx: 26.6, cy: 102.5, rx: 5.2, ry: 14, transform: 'rotate(11 26.6 102.5)' }],
  ['abs', 'rect', { x: 52.4, y: 74.5, width: 6.6, height: 9.5, rx: 2.4 }],
  ['abs', 'rect', { x: 52.4, y: 85.5, width: 6.6, height: 9.5, rx: 2.4 }],
  ['abs', 'rect', { x: 52.4, y: 96.5, width: 6.6, height: 9.5, rx: 2.4 }],
  ['abs', 'rect', { x: 52.4, y: 107.5, width: 6.6, height: 13, rx: 2.4 }],
  ['obliques', 'path', { d: 'M50.4,74.5 L45.2,76.5 Q42.6,90 44.4,104 L50.4,114.5 Z' }],
  ['quads', 'path', { d: 'M51.6,126.8 Q45,124.2 42.2,134 Q39.2,152 42,171 Q44.8,186 52,188.5 Q55.8,182 56.4,172 Q56.2,162 54.6,154 Q52.6,140 51.6,126.8 Z' }],
  ['adductors', 'path', { d: 'M59,128.6 L59,152 Q58.6,160 58,166 Q57.2,156 56,148 Q54,138 53.6,128.6 Z' }],
  ['calves', 'path', { d: 'M46.5,201 Q42.4,212 43.8,227 Q45.6,238 49,243 L52,243 Q55,228 54.4,212 Q53.6,202 50.5,200.5 Z' }],
];
const FRONT_NEUTRAL = [
  ['path', { d: 'M44.6,108 Q46.5,118 52,122.5 L59,124.5 L59,123.5 L52.4,122 L52.4,121 Q47,117 44.6,108 Z' }],
  ['ellipse', { cx: 22.6, cy: 122.5, rx: 4.4, ry: 5 }],
  ['ellipse', { cx: 50.4, cy: 194.6, rx: 5, ry: 3.8 }],
  ['ellipse', { cx: 50.2, cy: 247.6, rx: 5.4, ry: 2.8 }],
];

const BACK = [
  ['traps', 'path', { d: 'M60,30.5 L55.5,35 L42,44.5 L51.5,50.5 L56,62 L60,77 Z' }],
  ['sideDelts', 'ellipse', { cx: 33.4, cy: 54.5, rx: 5.6, ry: 8.8 }],
  ['rearDelts', 'ellipse', { cx: 40.2, cy: 51.6, rx: 6.4, ry: 7.6 }],
  ['upperBack', 'path', { d: 'M51.2,51.4 L45.2,56.4 Q43.4,63 46.2,69.6 L55.6,66.4 L55.4,61.6 Z' }],
  ['lats', 'path', { d: 'M44.2,68 Q39.8,77 41.6,89 Q45,100.5 54,108.5 L57.2,104.5 Q51.6,88 50,74 Z' }],
  ['lowerBack', 'rect', { x: 52.4, y: 80, width: 6.6, height: 35, rx: 3.2 }],
  ['triceps', 'ellipse', { cx: 30.8, cy: 75.5, rx: 5.8, ry: 12.6, transform: 'rotate(9 30.8 75.5)' }],
  ['forearms', 'ellipse', { cx: 26.6, cy: 103.5, rx: 5.2, ry: 14, transform: 'rotate(11 26.6 103.5)' }],
  ['glutes', 'path', { d: 'M59,119.5 L50.5,119.5 Q41.6,122.5 41.6,135.5 Q43,148.5 52,150.5 L59,150.5 Z' }],
  ['hamstrings', 'path', { d: 'M57.4,154 Q46.2,152.4 43.2,161 Q41,177.5 46,189.5 L54.4,190.5 Q57.8,175 57.4,154 Z' }],
  ['calves', 'path', { d: 'M45.6,200.5 Q41.6,210 43,222 Q45,233 49.2,243 L52.2,243 Q56.6,228 55.6,214 Q54.6,202.5 50.8,200 Z' }],
];
const BACK_NEUTRAL = [
  ['ellipse', { cx: 22.6, cy: 123.5, rx: 4.4, ry: 5 }],
  ['ellipse', { cx: 50.4, cy: 195, rx: 5, ry: 3.8 }],
  ['ellipse', { cx: 50.2, cy: 247.6, rx: 5.4, ry: 2.8 }],
];

function Shape({ tag: Tag, props, ...rest }) {
  return <Tag {...props} {...rest} />;
}

function Half({ shapes, neutral, levels, selected, onSelect, mirror }) {
  return (
    <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      {neutral.map(([tag, props], i) => (
        <Shape key={'n' + i} tag={tag} props={props} fill="var(--body)" stroke="var(--surface)" stroke-width="2" />
      ))}
      {shapes.map(([m, tag, props], i) => (
        <Shape key={i} tag={tag} props={props}
          class={'muscle' + (selected === m ? ' sel' : '')}
          fill={`var(--heat-${levels[m] || 0})`}
          stroke={selected === m ? 'var(--text)' : 'var(--surface)'}
          stroke-width="2"
          onClick={() => onSelect(m)} />
      ))}
    </g>
  );
}

export function BodyFigure({ side, levels, selected, onSelect }) {
  const shapes = side === 'front' ? FRONT : BACK;
  const neutral = side === 'front' ? FRONT_NEUTRAL : BACK_NEUTRAL;
  // draw the selected muscle last so its outline sits on top
  const ordered = selected ? [...shapes.filter((s) => s[0] !== selected), ...shapes.filter((s) => s[0] === selected)] : shapes;
  return (
    <svg viewBox="0 0 120 252" class="body-fig" role="img" aria-label={side === 'front' ? 'Front of body' : 'Back of body'}>
      <circle cx="60" cy="17" r="12" fill="var(--body)" />
      <rect x="54.5" y="28.5" width="11" height="8.5" rx="3" fill="var(--body)" />
      <Half shapes={ordered} neutral={neutral} levels={levels} selected={selected} onSelect={onSelect} />
      <Half shapes={ordered} neutral={neutral} levels={levels} selected={selected} onSelect={onSelect} mirror />
    </svg>
  );
}
