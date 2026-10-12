// Animated movement definitions: start pose (a), end pose (b), how the figure is anchored,
// equipment, and tempo [hold, move to b, hold, return] in ms. Angles are explained in components/anim.jsx.
// Exercises without an entry fall back to photos.

const ANK = (x = 120) => ({ joint: 'an', at: [x, 163] });
const at = (joint, x, y) => ({ joint, at: [x, y] });
const STAND = { t: 0, th: 0, sh: 0, ua: 0, fa: 0 };
const SLOW_DOWN = [350, 1300, 250, 1000]; // lower slowly, lift
const LIFT = [300, 950, 250, 1300]; // lift, lower slowly
const FLAT_BENCH = { type: 'bench', x: 58, y: 128, w: 112, legs: [72, 158] };
const SEAT = (x = 84, w = 50) => [{ type: 'pad', x, y: 128, w, h: 8 }, { type: 'post', x: x + w / 2, y: 136 }];
const BACKPAD = (x, y = 70, h = 58) => ({ type: 'pad', x, y, w: 8, h });
const TOWER_FRONT = [{ type: 'tower', x: 214, y1: 10 }];
const TOWER_BACK = [{ type: 'tower', x: 22, y1: 10 }];

function benchPress(implement, opts = {}) {
  const t = opts.t ?? -90;
  const props = [];
  if (t === -90) props.push(FLAT_BENCH);
  else if (t > -90) {
    // incline: seat plus a back pad along the torso
    props.push({ type: 'pad', x: 140, y: 126, w: 34, h: 8 }, { type: 'post', x: 157, y: 134 });
    props.push({ type: 'pad', x: 150 - 66, y: 126, w: 66, h: 8, angle: 90 + t, ax: 150, ay: 126 });
  } else {
    props.push({ type: 'pad', x: 60, y: 120, w: 104, h: 8, angle: t + 90, ax: 164, ay: 120 }, { type: 'post', x: 136, y: 126 });
  }
  const tilt = t + 90;
  return {
    anchor: at('hip', 150, t === -90 ? 118 : t > -90 ? 117 : 110), implement, tempo: SLOW_DOWN, props,
    a: { t, ua: 180, fa: 180, th: t < -90 ? 70 : 82, sh: t < -90 ? 30 : -8 },
    b: { t, ua: 62 + tilt * 0.55, fa: 180 + (opts.fa ?? 0), th: t < -90 ? 70 : 82, sh: t < -90 ? 30 : -8 },
  };
}

function seatedPress(implement, end = { ua: 84, fa: 86 }, start = { ua: -45, fa: 86 }) {
  return {
    anchor: at('hip', 104, 119), implement, tempo: LIFT,
    props: [...SEAT(80, 46), BACKPAD(70, 62, 66)],
    a: { t: -6, th: 86, sh: -4, ...start },
    b: { t: -6, th: 86, sh: -4, ...end },
  };
}

function overheadSeated(implement) {
  return {
    anchor: at('hip', 116, 119), implement, tempo: LIFT, zoom: 0.9,
    props: [...SEAT(92, 46), BACKPAD(82, 54, 74)],
    a: { t: -4, th: 86, sh: -4, ua: 34, fa: 170 },
    b: { t: -4, th: 86, sh: -4, ua: 176, fa: 178 },
  };
}

function curl(implement, props = []) {
  return {
    anchor: ANK(112), implement, tempo: LIFT, props,
    a: { ...STAND, ua: 2, fa: 4 },
    b: { ...STAND, ua: 10, fa: 150 },
  };
}

function pushdown(implement) {
  return {
    anchor: ANK(108), implement, tempo: LIFT,
    props: [...TOWER_FRONT, { type: 'cable', from: [205, 22] }],
    a: { t: 12, th: 4, sh: -4, ua: -8, fa: 168 },
    b: { t: 12, th: 4, sh: -4, ua: -8, fa: 4 },
  };
}

function hinge(implement, b, a = { ...STAND, t: 2 }, x = 116, tempo = SLOW_DOWN) {
  return { anchor: ANK(x), implement, tempo, a, b };
}

function pulldown() {
  return {
    anchor: at('hip', 112, 119), implement: 'handle', tempo: LIFT,
    props: [
      { type: 'tower', x: 206, y1: 6 },
      { type: 'bar', x1: 120, x2: 206, y: 8 },
      ...SEAT(86, 48),
      { type: 'pad', x: 140, y: 101, w: 26, h: 9 },
      { type: 'cable', from: [124, 10] },
    ],
    a: { t: -6, ua: 176, fa: 178, th: 86, sh: 4 },
    b: { t: -14, ua: -24, fa: 168, th: 86, sh: 4 },
  };
}

function pullup(extra = {}) {
  return {
    anchor: at('wr', 124, 2), implement: null, tempo: LIFT, zoom: 0.76,
    props: [{ type: 'bar', x1: 70, x2: 178, y: 4 }, { type: 'post', x: 72, y: 4 }, { type: 'post', x: 176, y: 4 }],
    a: { t: 0, ua: 178, fa: 180, th: 6, sh: -22, ft: -50, ...extra.a },
    b: { t: 0, ua: -25, fa: 165, th: 10, sh: -28, ft: -50, ...extra.b },
  };
}

function lunge(implement, opts = {}) {
  return {
    anchor: ANK(150), implement, tempo: SLOW_DOWN, props: opts.props,
    a: { t: 2, ua: 0, fa: 0, th: 18, sh: 18, th2: -20, sh2: -20, ft2: -40, ...opts.a },
    b: { t: 6, ua: 0, fa: 0, th: 86, sh: -6, th2: -10, sh2: -86, ft2: -70, ...opts.b },
  };
}

function squat(implement, opts = {}) {
  const arms = opts.arms || { ua: -35, fa: 165 };
  return {
    anchor: ANK(opts.x ?? 122), implement, tempo: SLOW_DOWN, props: opts.props,
    a: { ...STAND, t: opts.t0 ?? 6, ...arms },
    b: { t: opts.t1 ?? 42, th: 96, sh: -34, ...arms, ...(opts.armsB || {}) },
  };
}

function row(implement, opts = {}) {
  return {
    anchor: ANK(opts.x ?? 100), implement, tempo: LIFT, props: opts.props, one: opts.one,
    a: { t: opts.t ?? 70, th: 30, sh: -12, ua: 0, fa: 0, ...opts.a },
    b: { t: opts.t ?? 70, th: 30, sh: -12, ua: -75, fa: -10, ...opts.b },
  };
}

function frontRaise(implement, props) {
  return {
    anchor: ANK(112), implement, tempo: LIFT, props,
    a: { ...STAND, ua: 0, fa: 0 },
    b: { ...STAND, ua: 92, fa: 92 },
  };
}

function calfRaise(implement, extra = {}) {
  return {
    anchor: at('toe', 136, 163), implement, tempo: [300, 700, 450, 1100], one: extra.one,
    a: { ...STAND, ft: 14, ...extra.pose },
    b: { ...STAND, ft: -32, ...extra.pose },
  };
}

const TOP_FLY = (implement, props) => ({ view: 'top', implement, tempo: LIFT, props, a: { hz: 2, el: 18, k: 1 }, b: { hz: 82, el: 6, k: 1 } });
const TOP_REVERSE = (implement, props) => ({ view: 'top', implement, tempo: LIFT, props, a: { hz: 82, el: 4, k: 1 }, b: { hz: -2, el: 8, k: 1 } });
const LATERAL = (implement) => ({ view: 'front', implement, tempo: LIFT, a: { ab: 10, el: 6, cy: 160 }, b: { ab: 86, el: 6, cy: 160 } });
const SHRUG = (implement) => ({ view: 'front', implement, tempo: [300, 600, 500, 900], a: { ab: 6, el: 0 }, b: { ab: 6, el: 0, sg: 9 } });
const UPRIGHT = (implement) => ({ view: 'front', implement, tempo: LIFT, a: { ab: -10, el: 2 }, b: { ab: 102, el: -162 } });

export const MOVES = {
  // ---- chest
  'bench-press-barbell': benchPress('barbell'),
  'bench-press-dumbbell': benchPress('dumbbell'),
  'bench-press-smith-machine': benchPress('barbell'),
  'incline-bench-press-barbell': benchPress('barbell', { t: -50 }),
  'incline-bench-press-dumbbell': benchPress('dumbbell', { t: -50 }),
  'incline-bench-press-smith-machine': benchPress('barbell', { t: -50 }),
  'decline-bench-press-barbell': benchPress('barbell', { t: -106 }),
  'decline-bench-press-dumbbell': benchPress('dumbbell', { t: -106 }),
  'close-grip-bench-press-barbell': benchPress('barbell', { fa: -6 }),
  'jm-press-barbell': benchPress('barbell', { fa: 30 }),
  'chest-press-machine': seatedPress('handle'),
  'incline-chest-press-machine': seatedPress('handle', { ua: 118, fa: 122 }),
  'chest-fly-dumbbell': TOP_FLY('dumbbell', { bench: true }),
  'incline-chest-fly-dumbbell': TOP_FLY('dumbbell', { bench: true }),
  'chest-fly-machine': TOP_FLY('handle'),
  'cable-crossover': TOP_FLY('handle', { cablesSide: 70 }),
  'low-to-high-cable-fly': TOP_FLY('handle', { cablesSide: 150 }),
  'push-up': {
    anchor: at('toe', 46, 165), tempo: SLOW_DOWN,
    a: { t: 70, th: -70, sh: -70, ft: -78, ua: 2, fa: 2 },
    b: { t: 82, th: -82, sh: -82, ft: -82, ua: -100, fa: 30 },
  },
  'dip-chest': {
    anchor: at('wr', 122, 92), tempo: SLOW_DOWN,
    props: [{ type: 'post', x: 122, y: 92 }, { type: 'bar', x1: 108, x2: 136, y: 92 }],
    a: { t: 22, ua: 4, fa: 0, th: 14, sh: -60, ft: -40 },
    b: { t: 30, ua: -84, fa: 8, th: 24, sh: -60, ft: -40 },
  },
  'dip-triceps': {
    anchor: at('wr', 122, 92), tempo: SLOW_DOWN,
    props: [{ type: 'post', x: 122, y: 92 }, { type: 'bar', x1: 108, x2: 136, y: 92 }],
    a: { t: 4, ua: 2, fa: 0, th: 8, sh: -60, ft: -40 },
    b: { t: 10, ua: -80, fa: 6, th: 12, sh: -60, ft: -40 },
  },
  'bench-dip': {
    anchor: at('wr', 96, 128), tempo: SLOW_DOWN,
    props: [{ type: 'bench', x: 40, y: 128, w: 60, legs: [50, 90] }],
    a: { t: 4, ua: -14, fa: -14, th: 86, sh: 2, hn: 60 },
    b: { t: 10, ua: -96, fa: -4, th: 135, sh: 3, hn: 60 },
  },

  // ---- back
  'deadlift-barbell': hinge('barbell', { ...STAND, t: 2 }, { t: 50, th: 80, sh: -30, ua: 3, fa: 3 }, 116, LIFT),
  'sumo-deadlift-barbell': hinge('barbell', { ...STAND, t: 2 }, { t: 36, th: 84, sh: -24, ua: 2, fa: 2 }, 116, LIFT),
  'trap-bar-deadlift': hinge('barbell', { ...STAND, t: 2 }, { t: 38, th: 88, sh: -30, ua: 2, fa: 2 }, 118, LIFT),
  'rack-pull': hinge('barbell', { ...STAND, t: 2 }, { t: 42, th: 34, sh: -10, ua: 2, fa: 2 }, 116, LIFT),
  'romanian-deadlift-barbell': hinge('barbell', { t: 70, th: 40, sh: -5, ua: -12, fa: -12 }),
  'romanian-deadlift-dumbbell': hinge('dumbbell', { t: 70, th: 40, sh: -5, ua: -12, fa: -12 }),
  'good-morning-barbell': hinge('backbar', { t: 72, th: 32, sh: -6, ua: -30, fa: 165 }, { ...STAND, t: 4, ua: -35, fa: 165 }),
  'kettlebell-swing': {
    anchor: ANK(118), implement: 'kettlebell', tempo: [150, 650, 150, 750],
    a: { t: 62, th: 34, sh: -8, ua: -28, fa: -28 },
    b: { ...STAND, ua: 88, fa: 88 },
  },
  'pull-up': pullup(),
  'chin-up': pullup(),
  'assisted-pull-up-machine': pullup(),
  'dead-hang': { ...pullup(), tempo: [600, 1400, 600, 1400], b: { t: 2, ua: 178, fa: 180, th: 8, sh: -26, ft: -50 } },
  'lat-pulldown-wide-grip': pulldown(),
  'lat-pulldown-neutral-grip': pulldown(),
  'lat-pulldown-close-grip': pulldown(),
  'lat-pulldown-underhand': pulldown(),
  'lat-pulldown-machine': pulldown(),
  'straight-arm-pulldown-cable': {
    anchor: ANK(104), implement: 'handle', tempo: LIFT,
    props: [...TOWER_FRONT, { type: 'cable', from: [205, 26] }],
    a: { t: 26, th: 12, sh: -12, ua: 128, fa: 132 },
    b: { t: 26, th: 12, sh: -12, ua: -6, fa: -6 },
  },
  'seated-row-cable': {
    anchor: at('hip', 86, 138), implement: 'handle', tempo: LIFT,
    props: [{ type: 'pad', x: 56, y: 148, w: 60, h: 8 }, { type: 'tower', x: 222, y1: 112 }, { type: 'footplate', joint: 'an', angle: 72, offset: [9, -6] }, { type: 'cable', from: [214, 150] }],
    a: { t: 26, ua: 82, fa: 86, th: 82, sh: 72 },
    b: { t: -6, ua: -46, fa: 82, th: 82, sh: 72 },
  },
  'single-arm-row-cable': {
    anchor: at('hip', 86, 138), implement: 'handle', tempo: LIFT, one: true,
    props: [{ type: 'pad', x: 56, y: 148, w: 60, h: 8 }, { type: 'tower', x: 222, y1: 112 }, { type: 'footplate', joint: 'an', angle: 72, offset: [9, -6] }, { type: 'cable', from: [214, 150] }],
    a: { t: 22, ua: 82, fa: 86, ua2: 30, fa2: 60, th: 82, sh: 72 },
    b: { t: -4, ua: -46, fa: 82, ua2: 30, fa2: 60, th: 82, sh: 72 },
  },
  'seated-row-machine': {
    anchor: at('hip', 96, 119), implement: 'handle', tempo: LIFT,
    props: [...SEAT(72, 48), { type: 'pad', x: 146, y: 64, w: 9, h: 42 }, { type: 'post', x: 151, y: 106 }],
    a: { t: 8, ua: 84, fa: 88, th: 86, sh: -4 },
    b: { t: 2, ua: -46, fa: 84, th: 86, sh: -4 },
  },
  'bent-over-row-barbell': row('barbell'),
  'pendlay-row-barbell': row('barbell', { t: 84, a: { th: 38 }, b: { th: 38 } }),
  't-bar-row': row('barbell', { t: 60 }),
  'dumbbell-row': row('dumbbell', {
    x: 150, one: true, t: 82,
    props: [{ type: 'bench', x: 118, y: 128, w: 90, legs: [130, 196] }],
    a: { th: 14, sh: -6, th2: 2, sh2: -90, ft2: -30, ua2: -6, fa2: 4 },
    b: { th: 14, sh: -6, th2: 2, sh2: -90, ft2: -30, ua2: -6, fa2: 4 },
  }),
  'chest-supported-row-dumbbell': {
    anchor: ANK(84), implement: 'dumbbell', tempo: LIFT,
    props: [{ type: 'pad', x: 97, y: 104, w: 58, h: 8, angle: -43, ax: 97, ay: 108 }, { type: 'post', x: 110, y: 104 }],
    a: { t: 46, th: 28, sh: -18, ua: 0, fa: 0 },
    b: { t: 46, th: 28, sh: -18, ua: -72, fa: -8 },
  },
  'shrug-barbell': SHRUG('barbell'),
  'shrug-dumbbell': SHRUG('dumbbell'),
  'back-extension': {
    anchor: at('hip', 116, 96), tempo: LIFT,
    props: [{ type: 'pad', x: 108, y: 99, w: 20, h: 9, angle: -35, ax: 108, ay: 99 }, { type: 'post', x: 112, y: 104 }, { type: 'footplate', joint: 'an', angle: -35, offset: [-2, 4] }],
    a: { t: 150, th: -55, sh: -55, ft: -20, ua: 150, fa: 300 },
    b: { t: 58, th: -55, sh: -55, ft: -20, ua: 58 + 92, fa: 58 + 242 },
  },

  // ---- shoulders
  'overhead-press-barbell': {
    anchor: ANK(116), implement: 'barbell', tempo: LIFT, zoom: 0.8,
    a: { ...STAND, ua: 32, fa: 172 },
    b: { ...STAND, ua: 178, fa: 180 },
  },
  'shoulder-press-dumbbell': overheadSeated('dumbbell'),
  'shoulder-press-machine': overheadSeated('handle'),
  'arnold-press-dumbbell': { ...overheadSeated('dumbbell'), a: { t: -4, th: 86, sh: -4, ua: 14, fa: 160 } },
  'landmine-press': {
    anchor: ANK(112), implement: 'handle', tempo: LIFT,
    props: [{ type: 'cable', from: [24, 164] }],
    a: { t: 14, th: 8, sh: -8, ua: 30, fa: 158 },
    b: { t: 16, th: 8, sh: -8, ua: 122, fa: 124 },
  },
  'lateral-raise-dumbbell': LATERAL('dumbbell'),
  'lateral-raise-cable': LATERAL('cables'),
  'lateral-raise-machine': LATERAL('handle'),
  'front-raise-dumbbell': frontRaise('dumbbell'),
  'front-raise-cable': frontRaise('handle', [{ type: 'tower', x: 26, y1: 120 }, { type: 'cable', from: [34, 160] }]),
  'rear-delt-fly-dumbbell': TOP_REVERSE('dumbbell'),
  'rear-delt-fly-cable': TOP_REVERSE('handle', { cablesSide: 40 }),
  'reverse-fly-machine': TOP_REVERSE('handle'),
  'face-pull-cable': { view: 'top', implement: 'rope', tempo: LIFT, props: { cableFrom: [120, 14] }, a: { hz: 84, el: 2, k: 1 }, b: { hz: -14, el: 104, k: 1 } },
  'upright-row-barbell': UPRIGHT('barbell'),
  'upright-row-cable': UPRIGHT('handle'),
  'shoulder-external-rotation-cable': { view: 'top', implement: 'handle', one: true, tempo: LIFT, props: { cableFrom: [16, 96] }, a: { hz: 270, el: -180, k: 0.18 }, b: { hz: 270, el: -278, k: 0.18 } },
  'shoulder-external-rotation-dumbbell': { view: 'top', implement: 'dumbbell', one: true, tempo: LIFT, a: { hz: 270, el: -180, k: 0.18 }, b: { hz: 270, el: -278, k: 0.18 } },

  // ---- biceps
  'bicep-curl-barbell': curl('barbell'),
  'bicep-curl-dumbbell': curl('dumbbell'),
  'bicep-curl-cable': curl('handle', [...TOWER_FRONT, { type: 'cable', from: [205, 160] }]),
  'ez-bar-curl': curl('barbell'),
  'hammer-curl-dumbbell': curl('dumbbell'),
  'hammer-curl-cable-rope': curl('rope', [...TOWER_FRONT, { type: 'cable', from: [205, 160] }]),
  'reverse-curl-ez-bar': curl('barbell'),
  'incline-curl-dumbbell': {
    anchor: at('hip', 150, 117), implement: 'dumbbell', tempo: LIFT,
    props: [{ type: 'pad', x: 140, y: 126, w: 34, h: 8 }, { type: 'post', x: 157, y: 134 }, { type: 'pad', x: 84, y: 126, w: 66, h: 8, angle: 55, ax: 150, ay: 126 }],
    a: { t: -35, ua: -4, fa: -4, th: 82, sh: -8 },
    b: { t: -35, ua: -4, fa: 140, th: 82, sh: -8 },
  },
  'preacher-curl-ez-bar': preacher('barbell'),
  'preacher-curl-dumbbell': preacher('dumbbell'),
  'preacher-curl-machine': preacher('handle'),
  'concentration-curl-dumbbell': {
    anchor: at('hip', 100, 120), implement: 'dumbbell', tempo: LIFT, one: true,
    props: SEAT(70, 46),
    a: { t: 36, ua: 8, fa: 8, ua2: 40, fa2: 70, th: 84, sh: -8 },
    b: { t: 36, ua: 8, fa: 148, ua2: 40, fa2: 70, th: 84, sh: -8 },
  },
  'spider-curl-dumbbell': {
    anchor: ANK(84), implement: 'dumbbell', tempo: LIFT,
    props: [{ type: 'pad', x: 97, y: 104, w: 58, h: 8, angle: -43, ax: 97, ay: 108 }, { type: 'post', x: 110, y: 104 }],
    a: { t: 46, th: 28, sh: -18, ua: 0, fa: 0 },
    b: { t: 46, th: 28, sh: -18, ua: 0, fa: 140 },
  },
  'bayesian-curl-cable': {
    anchor: ANK(120), implement: 'handle', tempo: LIFT, one: true,
    props: [...TOWER_BACK, { type: 'cable', from: [30, 150] }],
    a: { t: 8, th: 6, sh: -6, ua: -28, fa: -28, ua2: 0, fa2: 0 },
    b: { t: 8, th: 6, sh: -6, ua: -28, fa: 122, ua2: 0, fa2: 0 },
  },

  // ---- triceps
  'tricep-rope-push-down-cable': pushdown('rope'),
  'tricep-pushdown-cable-bar': pushdown('handle'),
  'tricep-extension-machine': { ...seatedPress('handle', { ua: 62, fa: 66 }, { ua: 62, fa: 176 }), props: [...SEAT(80, 46), BACKPAD(70, 62, 66), { type: 'pad', x: 120, y: 92, w: 30, h: 8, angle: 28, ax: 120, ay: 92 }] },
  'overhead-tricep-extension-cable': {
    anchor: ANK(130), implement: 'rope', tempo: LIFT, zoom: 0.82,
    props: [...TOWER_BACK, { type: 'cable', from: [30, 140] }],
    a: { t: 20, th: 10, sh: -10, ua: 172, fa: -30 },
    b: { t: 20, th: 10, sh: -10, ua: 172, fa: -180 },
  },
  'overhead-tricep-extension-dumbbell': {
    anchor: ANK(118), implement: 'dumbbell', tempo: LIFT, zoom: 0.82,
    a: { ...STAND, t: 2, ua: 172, fa: -30 },
    b: { ...STAND, t: 2, ua: 172, fa: -180 },
  },
  'skull-crusher-ez-bar': skull('barbell'),
  'skull-crusher-dumbbell': skull('dumbbell'),
  'tricep-kickback-dumbbell': kickback('dumbbell'),
  'tricep-kickback-cable': kickback('handle', [{ type: 'tower', x: 214, y1: 110 }, { type: 'cable', from: [206, 150] }]),

  // ---- forearms
  'wrist-curl-dumbbell': wrist(),
  'reverse-wrist-curl-dumbbell': wrist(),

  // ---- core
  'crunch': {
    anchor: at('hip', 132, 157), tempo: LIFT,
    a: { t: -90, ua: 96, fa: 96, th: 140, sh: 22 },
    b: { t: -56, ua: 112, fa: 112, th: 140, sh: 22 },
  },
  'sit-up': {
    anchor: at('hip', 132, 157), tempo: [300, 1100, 250, 1200],
    a: { t: -90, ua: 96, fa: 96, th: 140, sh: 22 },
    b: { t: -6, ua: 80, fa: 80, th: 140, sh: 22 },
  },
  'decline-crunch': {
    anchor: at('hip', 140, 104), tempo: LIFT,
    props: [{ type: 'pad', x: 52, y: 114, w: 100, h: 8, angle: -18, ax: 152, ay: 114 }, { type: 'post', x: 104, y: 112 }, { type: 'roller', joint: 'an', offset: [-2, -7], r: 5 }],
    a: { t: -106, ua: 70, fa: 70, th: 120, sh: 34 },
    b: { t: -40, ua: 120, fa: 120, th: 120, sh: 34 },
  },
  'cable-crunch': {
    anchor: at('kn', 128, 161), implement: 'rope', tempo: LIFT,
    props: [{ type: 'tower', x: 214, y1: 8 }, { type: 'bar', x1: 150, x2: 214, y: 10 }, { type: 'cable', from: [152, 12] }],
    a: { t: 16, th: 0, sh: -90, ft: -80, ua: 160, fa: -10 },
    b: { t: 84, th: 8, sh: -90, ft: -80, ua: 226, fa: 56 },
  },
  'crunch-machine': {
    anchor: at('hip', 104, 119), implement: 'handle', tempo: LIFT,
    props: [...SEAT(80, 46)],
    a: { t: -2, th: 86, sh: -4, ua: 30, fa: 164 },
    b: { t: 52, th: 86, sh: -4, ua: 80, fa: 214 },
  },
  'bicycle-crunch': {
    anchor: at('hip', 120, 157), tempo: [200, 800, 200, 800],
    a: { t: -62, ua: -160, fa: 40, th: 150, sh: 70, th2: 96, sh2: 96 },
    b: { t: -62, ua: -160, fa: 40, th: 96, sh: 96, th2: 150, sh2: 70 },
  },
  'hanging-leg-raise': pullup({ a: { th: 0, sh: 0, ft: -40 }, b: { ua: 178, fa: 180, th: 94, sh: 92, ft: -10 } }),
  'hanging-knee-raise': pullup({ a: { th: 0, sh: 0, ft: -40 }, b: { ua: 178, fa: 180, th: 112, sh: 4, ft: -40 } }),
  'lying-leg-raise': {
    anchor: at('hip', 120, 157), tempo: LIFT,
    a: { t: -90, ua: 90, fa: 90, th: 90, sh: 90, ft: 0 },
    b: { t: -90, ua: 90, fa: 90, th: 176, sh: 176, ft: 0 },
  },
  'ab-wheel-rollout': {
    anchor: at('kn', 70, 161), implement: 'wheel', tempo: SLOW_DOWN,
    a: { t: 44, th: -6, sh: -90, ft: -80, ua: 14, fa: 14 },
    b: { t: 82, th: -52, sh: -90, ft: -80, ua: 74, fa: 74 },
  },
  'dead-bug': {
    anchor: at('hip', 126, 156), tempo: [250, 900, 250, 900],
    a: { t: -90, ua: 180, fa: 180, ua2: 266, fa2: 266, th: 178, sh: 92, th2: 100, sh2: 100 },
    b: { t: -90, ua: 266, fa: 266, ua2: 180, fa2: 180, th: 100, sh: 100, th2: 178, sh2: 92 },
  },
  'russian-twist': { view: 'top', tempo: [200, 700, 200, 700], a: { rot: -38, hz: 62, el: 34, k: 0.8 }, b: { rot: 38, hz: 62, el: 34, k: 0.8 } },
  'pallof-press-cable': { view: 'top', implement: 'handle', tempo: [300, 800, 600, 900], props: { cableFrom: [14, 70] }, a: { hz: 66, el: 70, k: 0.5 }, b: { hz: 86, el: 4, k: 1 } },
  'woodchopper-cable': { view: 'front', implement: 'handle', tempo: [250, 900, 250, 1100], a: { ab: 140, ab2: -140, el: 0, el2: 0 }, b: { ab: -40, ab2: 40, el: 0, el2: 0 } },
  'plank': {
    anchor: at('el', 158, 162), tempo: [800, 1400, 800, 1400],
    a: { t: 92, th: -86, sh: -86, ft: -84, ua: 2, fa: 92 },
    b: { t: 90, th: -88, sh: -88, ft: -84, ua: 2, fa: 92 },
  },

  // ---- legs
  'squat-barbell': squat('backbar'),
  'smith-machine-squat': squat('backbar'),
  'front-squat-barbell': squat('frontbar', { t0: 4, t1: 24, arms: { ua: 74, fa: 196 } }),
  'goblet-squat': squat('dumbbell', { t0: 4, t1: 26, arms: { ua: 14, fa: 162 } }),
  'belt-squat': squat(null, { t0: 4, t1: 22, arms: { ua: 30, fa: 60 } }),
  'hack-squat-machine': squat(null, { t0: -14, t1: 6, arms: { ua: -10, fa: 150 }, x: 126 }),
  'pendulum-squat': squat(null, { t0: -10, t1: 14, arms: { ua: -10, fa: 150 }, x: 126 }),
  'leg-press': {
    anchor: at('hip', 74, 128), tempo: SLOW_DOWN,
    props: [{ type: 'pad', x: 62, y: 137, w: 42, h: 8 }, { type: 'pad', x: 16, y: 137, w: 60, h: 8, angle: 32, ax: 76, ay: 137 }, { type: 'post', x: 82, y: 145 }, { type: 'footplate', joint: 'an', angle: 45, offset: [6, -2] }],
    a: { t: -58, ua: 20, fa: 60, th: 132, sh: 134, ft: 45 },
    b: { t: -58, ua: 20, fa: 60, th: 186, sh: 70, ft: 45 },
  },
  'bulgarian-split-squat-dumbbell': lunge('dumbbell', {
    props: [{ type: 'bench', x: 24, y: 126, w: 50, legs: [34, 64] }],
    a: { th: 4, sh: 0, th2: -26, sh2: -104, ft2: -150 },
    b: { th: 88, sh: -12, th2: -2, sh2: -98, ft2: -150 },
  }),
  'lunge-dumbbell': lunge('dumbbell'),
  'walking-lunge-dumbbell': lunge('dumbbell'),
  'reverse-lunge-dumbbell': lunge('dumbbell'),
  'step-up-dumbbell': {
    anchor: at('an', 150, 123), implement: 'dumbbell', tempo: LIFT, zoom: 0.8,
    props: [{ type: 'box', x: 128, y: 128, w: 54 }],
    a: { t: 8, ua: 0, fa: 0, th: 80, sh: -10, th2: -12, sh2: -12 },
    b: { t: 2, ua: 0, fa: 0, th: 0, sh: 0, th2: 62, sh2: -14 },
  },
  'leg-extension-machine': {
    anchor: at('hip', 98, 118), tempo: LIFT,
    props: [...SEAT(76, 50), BACKPAD(70, 64, 62), { type: 'roller', joint: 'an', offset: [6, 0] }],
    a: { t: -10, ua: 10, fa: 34, th: 88, sh: 4 },
    b: { t: -10, ua: 10, fa: 34, th: 88, sh: 84 },
  },
  'seated-leg-curl-machine': {
    anchor: at('hip', 98, 118), tempo: LIFT,
    props: [...SEAT(76, 50), BACKPAD(70, 64, 62), { type: 'roller', joint: 'kn', offset: [0, -11], r: 6 }, { type: 'roller', joint: 'an', offset: [-2, 6] }],
    a: { t: -12, ua: 10, fa: 34, th: 88, sh: 82 },
    b: { t: -12, ua: 10, fa: 34, th: 88, sh: -6 },
  },
  'lying-leg-curl-machine': {
    anchor: at('hip', 116, 118), tempo: LIFT,
    props: [{ type: 'bench', x: 36, y: 128, w: 140, legs: [50, 162] }, { type: 'roller', joint: 'an', offset: [0, -7] }],
    a: { t: 92, ua: 30, fa: 20, th: -92, sh: -92, ft: -60 },
    b: { t: 92, ua: 30, fa: 20, th: -92, sh: -186, ft: -60 },
  },
  'nordic-curl': {
    anchor: at('kn', 92, 161), tempo: [300, 1600, 200, 900],
    props: [{ type: 'roller', joint: 'an', offset: [0, -7] }],
    a: { t: 0, th: 0, sh: -90, ft: -80, ua: 40, fa: 60 },
    b: { t: 60, th: -60, sh: -90, ft: -80, ua: 110, fa: 120 },
  },
  'hip-thrust-barbell': hipThrust('hipbar'),
  'hip-thrust-machine': hipThrust(null),
  'glute-bridge': {
    anchor: ANK(150), tempo: [300, 800, 500, 1000],
    a: { t: -96, th: 124, sh: -24, ua: 94, fa: 94 },
    b: { t: -114, th: 78, sh: -18, ua: 70, fa: 70 },
  },
  'glute-kickback-cable': {
    anchor: at('an2', 124, 163), implement: null, tempo: LIFT,
    props: [...TOWER_FRONT, { type: 'tower', x: 22, y1: 120 }, { type: 'cable', from: [30, 158], hand: 'an' }],
    a: { t: 34, ua: 64, fa: 80, th: 10, sh: -24, th2: 6, sh2: -4 },
    b: { t: 34, ua: 64, fa: 80, th: -58, sh: -64, th2: 6, sh2: -4 },
  },
  'hip-abduction-machine': { view: 'front', tempo: LIFT, a: { ab: 8, el: 30, lg: 2 }, b: { ab: 8, el: 30, lg: 22 } },
  'hip-adduction-machine': { view: 'front', tempo: LIFT, a: { ab: 8, el: 30, lg: 22 }, b: { ab: 8, el: 30, lg: 2 } },
  'standing-calf-raise-machine': calfRaise(null, { pose: { ua: 34, fa: 162 } }),
  'single-leg-calf-raise-dumbbell': calfRaise('dumbbell', { one: true, pose: { th2: 30, sh2: -50 } }),
  'seated-calf-raise-machine': {
    anchor: at('toe', 150, 163), tempo: [300, 700, 450, 1100],
    props: [...SEAT(78, 46), { type: 'roller', joint: 'kn', offset: [0, -11], r: 7 }],
    a: { t: 2, ua: 30, fa: 70, th: 88, sh: -2, ft: 14 },
    b: { t: 2, ua: 30, fa: 70, th: 88, sh: -2, ft: -30 },
  },
};

function preacher(implement) {
  return {
    anchor: at('hip', 98, 120), implement, tempo: LIFT,
    props: [...SEAT(74, 46), { type: 'pad', x: 128, y: 82, w: 34, h: 9, angle: 42, ax: 128, ay: 82 }, { type: 'post', x: 140, y: 100 }],
    a: { t: 14, ua: 48, fa: 58, th: 86, sh: -6 },
    b: { t: 14, ua: 48, fa: 168, th: 86, sh: -6 },
  };
}

function skull(implement) {
  return {
    anchor: at('hip', 150, 118), implement, tempo: SLOW_DOWN, props: [FLAT_BENCH],
    a: { t: -90, ua: 194, fa: 194, th: 82, sh: -8 },
    b: { t: -90, ua: 194, fa: 292, th: 82, sh: -8 },
  };
}

function kickback(implement, props) {
  return {
    anchor: ANK(96), implement, tempo: LIFT, one: true, props,
    a: { t: 74, th: 26, sh: -12, ua: -96, fa: 2, ua2: 40, fa2: 40 },
    b: { t: 74, th: 26, sh: -12, ua: -96, fa: -92, ua2: 40, fa2: 40 },
  };
}

function wrist() {
  return {
    anchor: at('hip', 98, 119), implement: 'dumbbell', at: 'hd', tempo: LIFT,
    props: SEAT(70, 46),
    a: { t: 26, ua: 22, fa: 92, hn: 36, th: 86, sh: -6 },
    b: { t: 26, ua: 22, fa: 92, hn: 158, th: 86, sh: -6 },
  };
}

function hipThrust(implement) {
  return {
    anchor: ANK(158), implement, tempo: [300, 900, 500, 1100],
    props: [{ type: 'bench', x: 30, y: 122, w: 46, legs: [40, 66] }],
    a: { t: -64, th: 124, sh: -10, ua: 80, fa: 140 },
    b: { t: -88, th: 92, sh: -2, ua: 60, fa: 120 },
  };
}
