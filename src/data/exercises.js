// Built-in exercise library.
// kind: 'weight' = weight x reps, 'reps' = bodyweight reps (optional added weight), 'time' = seconds held
// primary muscles count a full set, secondary muscles count half a set.

export const MUSCLES = [
  ['chest', 'Chest'],
  ['frontDelts', 'Front delts'],
  ['sideDelts', 'Side delts'],
  ['rearDelts', 'Rear delts'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['forearms', 'Forearms'],
  ['abs', 'Abs'],
  ['obliques', 'Obliques'],
  ['traps', 'Traps'],
  ['upperBack', 'Upper back'],
  ['lats', 'Lats'],
  ['lowerBack', 'Lower back'],
  ['glutes', 'Glutes'],
  ['quads', 'Quads'],
  ['hamstrings', 'Hamstrings'],
  ['adductors', 'Adductors'],
  ['calves', 'Calves'],
];
export const MUSCLE_NAME = Object.fromEntries(MUSCLES);

// Radar groups (a few minor muscles are left to the body map and table)
export const RADAR_GROUPS = [
  ['Chest', ['chest']],
  ['Back', ['lats', 'upperBack', 'traps', 'lowerBack']],
  ['Shoulders', ['frontDelts', 'sideDelts', 'rearDelts']],
  ['Biceps', ['biceps']],
  ['Triceps', ['triceps']],
  ['Core', ['abs', 'obliques']],
  ['Glutes', ['glutes']],
  ['Quads', ['quads']],
  ['Hamstrings', ['hamstrings']],
  ['Calves', ['calves']],
];

// Filter groups for the exercise picker
export const MUSCLE_FILTERS = [
  ['Chest', ['chest']],
  ['Back', ['lats', 'upperBack', 'traps', 'lowerBack']],
  ['Shoulders', ['frontDelts', 'sideDelts', 'rearDelts']],
  ['Arms', ['biceps', 'triceps', 'forearms']],
  ['Core', ['abs', 'obliques']],
  ['Legs', ['quads', 'hamstrings', 'glutes', 'adductors', 'calves']],
];

export const EQUIPMENT = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine',
  smith: 'Smith machine', bodyweight: 'Bodyweight', kettlebell: 'Kettlebell', band: 'Band', other: 'Other',
};

const L = [
  // name, equipment, primary, secondary, kind
  // Chest
  ['Bench Press (Barbell)', 'barbell', 'chest', 'triceps frontDelts'],
  ['Bench Press (Dumbbell)', 'dumbbell', 'chest', 'triceps frontDelts'],
  ['Bench Press (Smith Machine)', 'smith', 'chest', 'triceps frontDelts'],
  ['Incline Bench Press (Barbell)', 'barbell', 'chest', 'frontDelts triceps'],
  ['Incline Bench Press (Dumbbell)', 'dumbbell', 'chest', 'frontDelts triceps'],
  ['Incline Bench Press (Smith Machine)', 'smith', 'chest', 'frontDelts triceps'],
  ['Decline Bench Press (Barbell)', 'barbell', 'chest', 'triceps'],
  ['Decline Bench Press (Dumbbell)', 'dumbbell', 'chest', 'triceps'],
  ['Close-Grip Bench Press (Barbell)', 'barbell', 'triceps', 'chest frontDelts'],
  ['Chest Press (Machine)', 'machine', 'chest', 'triceps frontDelts'],
  ['Incline Chest Press (Machine)', 'machine', 'chest', 'frontDelts triceps'],
  ['Chest Fly (Dumbbell)', 'dumbbell', 'chest', 'frontDelts'],
  ['Incline Chest Fly (Dumbbell)', 'dumbbell', 'chest', 'frontDelts'],
  ['Chest Fly (Machine)', 'machine', 'chest', 'frontDelts'],
  ['Cable Crossover', 'cable', 'chest', 'frontDelts'],
  ['Low-to-High Cable Fly', 'cable', 'chest', 'frontDelts'],
  ['Push Up', 'bodyweight', 'chest', 'triceps frontDelts', 'reps'],
  ['Dip (Chest)', 'bodyweight', 'chest', 'triceps frontDelts', 'reps'],

  // Back
  ['Deadlift (Barbell)', 'barbell', 'hamstrings glutes lowerBack', 'quads traps upperBack forearms'],
  ['Sumo Deadlift (Barbell)', 'barbell', 'glutes adductors quads', 'hamstrings lowerBack traps'],
  ['Trap Bar Deadlift', 'barbell', 'glutes quads hamstrings', 'lowerBack traps forearms'],
  ['Rack Pull', 'barbell', 'lowerBack traps', 'glutes hamstrings upperBack forearms'],
  ['Pull Up', 'bodyweight', 'lats', 'biceps upperBack', 'reps'],
  ['Chin Up', 'bodyweight', 'lats biceps', 'upperBack', 'reps'],
  ['Assisted Pull Up (Machine)', 'machine', 'lats', 'biceps upperBack'],
  ['Lat Pulldown (Wide Grip)', 'cable', 'lats', 'biceps upperBack'],
  ['Lat Pulldown (Neutral Grip)', 'cable', 'lats', 'biceps upperBack'],
  ['Lat Pulldown (Close Grip)', 'cable', 'lats', 'biceps upperBack'],
  ['Lat Pulldown (Underhand)', 'cable', 'lats', 'biceps upperBack'],
  ['Lat Pulldown (Machine)', 'machine', 'lats', 'biceps upperBack'],
  ['Straight-Arm Pulldown (Cable)', 'cable', 'lats', 'triceps'],
  ['Seated Row (Cable)', 'cable', 'upperBack lats', 'biceps rearDelts'],
  ['Seated Row (Machine)', 'machine', 'upperBack lats', 'biceps rearDelts'],
  ['Single-Arm Row (Cable)', 'cable', 'lats upperBack', 'biceps rearDelts'],
  ['Bent Over Row (Barbell)', 'barbell', 'upperBack lats', 'biceps rearDelts lowerBack'],
  ['Pendlay Row (Barbell)', 'barbell', 'upperBack lats', 'biceps rearDelts lowerBack'],
  ['Dumbbell Row', 'dumbbell', 'lats upperBack', 'biceps rearDelts'],
  ['Chest-Supported Row (Dumbbell)', 'dumbbell', 'upperBack lats', 'biceps rearDelts'],
  ['T-Bar Row', 'barbell', 'upperBack lats', 'biceps rearDelts'],
  ['Inverted Row', 'bodyweight', 'upperBack lats', 'biceps rearDelts', 'reps'],
  ['Shrug (Barbell)', 'barbell', 'traps', 'forearms'],
  ['Shrug (Dumbbell)', 'dumbbell', 'traps', 'forearms'],
  ['Back Extension', 'bodyweight', 'lowerBack', 'glutes hamstrings', 'reps'],
  ['Good Morning (Barbell)', 'barbell', 'hamstrings lowerBack', 'glutes'],

  // Shoulders
  ['Overhead Press (Barbell)', 'barbell', 'frontDelts', 'triceps sideDelts traps'],
  ['Shoulder Press (Dumbbell)', 'dumbbell', 'frontDelts', 'triceps sideDelts'],
  ['Shoulder Press (Machine)', 'machine', 'frontDelts', 'triceps sideDelts'],
  ['Arnold Press (Dumbbell)', 'dumbbell', 'frontDelts', 'sideDelts triceps'],
  ['Landmine Press', 'barbell', 'frontDelts', 'chest triceps'],
  ['Lateral Raise (Dumbbell)', 'dumbbell', 'sideDelts', 'traps'],
  ['Lateral Raise (Cable)', 'cable', 'sideDelts', 'traps'],
  ['Lateral Raise (Machine)', 'machine', 'sideDelts', 'traps'],
  ['Front Raise (Dumbbell)', 'dumbbell', 'frontDelts', 'sideDelts'],
  ['Front Raise (Cable)', 'cable', 'frontDelts', 'sideDelts'],
  ['Rear Delt Fly (Dumbbell)', 'dumbbell', 'rearDelts', 'upperBack'],
  ['Rear Delt Fly (Cable)', 'cable', 'rearDelts', 'upperBack'],
  ['Reverse Fly (Machine)', 'machine', 'rearDelts', 'upperBack'],
  ['Face Pull (Cable)', 'cable', 'rearDelts', 'upperBack traps'],
  ['Upright Row (Barbell)', 'barbell', 'sideDelts traps', 'biceps'],
  ['Upright Row (Cable)', 'cable', 'sideDelts traps', 'biceps'],
  ['Shoulder External Rotation (Cable)', 'cable', 'rearDelts', ''],
  ['Shoulder External Rotation (Dumbbell)', 'dumbbell', 'rearDelts', ''],

  // Biceps
  ['Bicep Curl (Barbell)', 'barbell', 'biceps', 'forearms'],
  ['Bicep Curl (Dumbbell)', 'dumbbell', 'biceps', 'forearms'],
  ['Bicep Curl (Cable)', 'cable', 'biceps', 'forearms'],
  ['EZ Bar Curl', 'barbell', 'biceps', 'forearms'],
  ['Hammer Curl (Dumbbell)', 'dumbbell', 'biceps forearms', ''],
  ['Hammer Curl (Cable Rope)', 'cable', 'biceps forearms', ''],
  ['Incline Curl (Dumbbell)', 'dumbbell', 'biceps', 'forearms'],
  ['Preacher Curl (EZ Bar)', 'barbell', 'biceps', 'forearms'],
  ['Preacher Curl (Dumbbell)', 'dumbbell', 'biceps', 'forearms'],
  ['Preacher Curl (Machine)', 'machine', 'biceps', 'forearms'],
  ['Concentration Curl (Dumbbell)', 'dumbbell', 'biceps', ''],
  ['Spider Curl (Dumbbell)', 'dumbbell', 'biceps', ''],
  ['Bayesian Curl (Cable)', 'cable', 'biceps', ''],

  // Triceps
  ['Tricep Rope Push Down (Cable)', 'cable', 'triceps', ''],
  ['Tricep Pushdown (Cable Bar)', 'cable', 'triceps', ''],
  ['Overhead Tricep Extension (Cable)', 'cable', 'triceps', ''],
  ['Overhead Tricep Extension (Dumbbell)', 'dumbbell', 'triceps', ''],
  ['Skull Crusher (EZ Bar)', 'barbell', 'triceps', ''],
  ['Skull Crusher (Dumbbell)', 'dumbbell', 'triceps', ''],
  ['Tricep Kickback (Dumbbell)', 'dumbbell', 'triceps', ''],
  ['Tricep Kickback (Cable)', 'cable', 'triceps', ''],
  ['Tricep Extension (Machine)', 'machine', 'triceps', ''],
  ['JM Press (Barbell)', 'barbell', 'triceps', 'chest'],
  ['Dip (Triceps)', 'bodyweight', 'triceps', 'chest frontDelts', 'reps'],
  ['Bench Dip', 'bodyweight', 'triceps', 'chest frontDelts', 'reps'],

  // Forearms
  ['Wrist Curl (Dumbbell)', 'dumbbell', 'forearms', ''],
  ['Reverse Wrist Curl (Dumbbell)', 'dumbbell', 'forearms', ''],
  ['Reverse Curl (EZ Bar)', 'barbell', 'forearms', 'biceps'],
  ['Dead Hang', 'bodyweight', 'forearms', 'lats', 'time'],

  // Core
  ['Crunch', 'bodyweight', 'abs', '', 'reps'],
  ['Decline Crunch', 'bodyweight', 'abs', 'obliques', 'reps'],
  ['Cable Crunch', 'cable', 'abs', 'obliques'],
  ['Crunch (Machine)', 'machine', 'abs', 'obliques'],
  ['Sit Up', 'bodyweight', 'abs', '', 'reps'],
  ['Bicycle Crunch', 'bodyweight', 'obliques abs', '', 'reps'],
  ['Hanging Leg Raise', 'bodyweight', 'abs', 'obliques', 'reps'],
  ['Hanging Knee Raise', 'bodyweight', 'abs', 'obliques', 'reps'],
  ['Lying Leg Raise', 'bodyweight', 'abs', '', 'reps'],
  ['Ab Wheel Rollout', 'bodyweight', 'abs', 'obliques lats', 'reps'],
  ['Dead Bug', 'bodyweight', 'abs', '', 'reps'],
  ['Russian Twist', 'bodyweight', 'obliques', 'abs', 'reps'],
  ['Pallof Press (Cable)', 'cable', 'obliques', 'abs'],
  ['Woodchopper (Cable)', 'cable', 'obliques', 'abs'],
  ['Plank', 'bodyweight', 'abs', 'obliques', 'time'],
  ['Side Plank', 'bodyweight', 'obliques', 'abs', 'time'],

  // Legs
  ['Squat (Barbell)', 'barbell', 'quads glutes', 'adductors hamstrings lowerBack'],
  ['Front Squat (Barbell)', 'barbell', 'quads', 'glutes abs'],
  ['Smith Machine Squat', 'smith', 'quads glutes', 'adductors'],
  ['Goblet Squat', 'dumbbell', 'quads glutes', 'adductors'],
  ['Hack Squat (Machine)', 'machine', 'quads', 'glutes'],
  ['Pendulum Squat', 'machine', 'quads', 'glutes'],
  ['Belt Squat', 'machine', 'quads glutes', 'adductors'],
  ['Leg Press', 'machine', 'quads glutes', 'adductors'],
  ['Bulgarian Split Squat (Dumbbell)', 'dumbbell', 'quads glutes', 'adductors hamstrings'],
  ['Lunge (Dumbbell)', 'dumbbell', 'quads glutes', 'hamstrings adductors'],
  ['Walking Lunge (Dumbbell)', 'dumbbell', 'quads glutes', 'hamstrings adductors'],
  ['Reverse Lunge (Dumbbell)', 'dumbbell', 'glutes quads', 'hamstrings'],
  ['Step Up (Dumbbell)', 'dumbbell', 'quads glutes', 'hamstrings'],
  ['Leg Extension (Machine)', 'machine', 'quads', ''],
  ['Seated Leg Curl (Machine)', 'machine', 'hamstrings', ''],
  ['Lying Leg Curl (Machine)', 'machine', 'hamstrings', 'calves'],
  ['Nordic Curl', 'bodyweight', 'hamstrings', '', 'reps'],
  ['Romanian Deadlift (Barbell)', 'barbell', 'hamstrings glutes', 'lowerBack forearms'],
  ['Romanian Deadlift (Dumbbell)', 'dumbbell', 'hamstrings glutes', 'lowerBack forearms'],
  ['Hip Thrust (Barbell)', 'barbell', 'glutes', 'hamstrings'],
  ['Hip Thrust (Machine)', 'machine', 'glutes', 'hamstrings'],
  ['Glute Bridge', 'bodyweight', 'glutes', 'hamstrings', 'reps'],
  ['Glute Kickback (Cable)', 'cable', 'glutes', 'hamstrings'],
  ['Hip Abduction (Machine)', 'machine', 'glutes', ''],
  ['Hip Adduction (Machine)', 'machine', 'adductors', ''],
  ['Kettlebell Swing', 'kettlebell', 'glutes hamstrings', 'lowerBack'],
  ['Standing Calf Raise (Machine)', 'machine', 'calves', ''],
  ['Seated Calf Raise (Machine)', 'machine', 'calves', ''],
  ['Calf Raise (Leg Press)', 'machine', 'calves', ''],
  ['Single-Leg Calf Raise (Dumbbell)', 'dumbbell', 'calves', ''],
];

export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const BUILTIN_EXERCISES = Object.fromEntries(
  L.map(([name, equipment, primary, secondary, kind = 'weight']) => {
    const id = slug(name);
    return [id, {
      id, name, equipment,
      primary: primary.split(' ').filter(Boolean),
      secondary: secondary.split(' ').filter(Boolean),
      kind,
    }];
  })
);
