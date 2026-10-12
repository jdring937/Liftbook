import { BODY } from '../data/bodymap.js';
import { MUSCLE_NAME } from '../data/exercises.js';

// Body map regions and the app's muscles they show. A region shared by two muscles
// (front deltoid also shows the side delts) takes the higher of their levels.
const REGIONS = {
  front: {
    chest: ['chest'], obliques: ['obliques'], abs: ['abs'], biceps: ['biceps'], triceps: ['triceps'],
    forearm: ['forearms'], deltoids: ['frontDelts', 'sideDelts'], trapezius: ['traps'],
    quadriceps: ['quads'], adductors: ['adductors'], calves: ['calves'],
  },
  back: {
    deltoids: ['rearDelts', 'sideDelts'], trapezius: ['traps', 'upperBack'], 'upper-back': ['lats'],
    'lower-back': ['lowerBack'], triceps: ['triceps'], forearm: ['forearms'], gluteal: ['glutes'],
    hamstring: ['hamstrings'], adductors: ['adductors'], calves: ['calves'],
  },
};

const LABELS = {
  'frontDelts,sideDelts': 'Front and side delts',
  'rearDelts,sideDelts': 'Rear and side delts',
  'traps,upperBack': 'Traps and upper back',
};

export function regionInfo(muscles) {
  const key = muscles.join(',');
  return { key, muscles, label: LABELS[key] || muscles.map((m) => MUSCLE_NAME[m]).join(' and ') };
}

export function BodyFigure({ side, sex = 'male', levels, selected, onSelect }) {
  const fig = BODY[sex] || BODY.male;
  const regions = REGIONS[side];
  const parts = fig[side];
  return (
    <svg viewBox={fig.vb[side]} class="body-fig" role="img" aria-label={side === 'front' ? 'Front of body' : 'Back of body'}>
      {parts.map((p) => {
        const muscles = regions[p.slug];
        if (!muscles) {
          return p.d.map((d, i) => <path key={p.slug + i} d={d} fill={p.slug === 'hair' ? 'var(--body-hair)' : 'var(--body)'} />);
        }
        const info = regionInfo(muscles);
        const level = Math.max(...muscles.map((m) => levels[m] || 0));
        const on = selected === info.key;
        return (
          <g key={p.slug} class={'muscle' + (on ? ' sel' : '')} onClick={() => onSelect(info)} role="button" aria-label={info.label}>
            {p.d.map((d, i) => (
              <path key={i} d={d} fill={`var(--heat-${level})`} stroke={on ? 'var(--text)' : 'none'} stroke-width={on ? 7 : 0} stroke-linejoin="round" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
