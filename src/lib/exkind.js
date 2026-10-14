// Compound vs isolation, from the exercise's own flag when set, otherwise from its name
const ISOLATION_RE = /curl|raise|fly|flye|crossover|extension|skull|pushdown|push down|kickback|face pull|shrug|crunch|calf|rear delt|wrist|external rotation|abduction|adduction|pullover|straight-arm|plank|dead bug|twist|woodchop|pallof|rollout|hang|bridge|sit up/i;
export const isCompound = (ex) => (ex && ex.compound != null ? !!ex.compound : !!ex && !ISOLATION_RE.test(ex.name));
const LOWER = ['quads', 'glutes', 'hamstrings'];
export const isLowerCompound = (ex) => isCompound(ex) && ex.primary.some((m) => LOWER.includes(m));
