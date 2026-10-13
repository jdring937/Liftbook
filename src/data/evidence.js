// Evidence behind the app's recommendations. Each entry: a plain summary, what the app does with it,
// and the sources. Citations were checked against publisher / Crossref records (October 2026).
// Where something is a rule of thumb rather than a tested finding, the text says so.

const doi = (d) => `https://doi.org/${d}`;

export const EVIDENCE = {
  volume: {
    title: 'Weekly sets per muscle',
    summary: 'Muscle growth tends to rise with the number of hard sets per muscle each week, with diminishing returns. Around 10–20 weekly sets is a common target, and the 2026 ACSM position stand recommends at least 10 for growth. Strength needs fewer sets.',
    app: 'Coverage counts a set as 1 for an exercise’s main muscles and 0.5 for its helper muscles, the “fractional” method that fit the data best in the 2026 meta-regression. Bands: under 4 low, 4–9 moderate, 10–20 typical growth range, over 20 diminishing returns.',
    refs: [
      { cite: 'Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci 35(11):1073–1082.', url: doi('10.1080/02640414.2016.1210197') },
      { cite: 'Pelland JC, Remmert JF, Robinson ZP, et al. (2026). The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. Sports Med 56(2):481–505.', url: doi('10.1007/s40279-025-02344-w') },
      { cite: 'Currier BS, D’Souza AC, Fiatarone Singh MA, et al. (2026). ACSM Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. Med Sci Sports Exerc 58(4):851–872.', url: doi('10.1249/MSS.0000000000003897') },
    ],
  },
  frequency: {
    title: 'How often to train a muscle',
    summary: 'When weekly sets are matched, training a muscle more often makes little difference to growth. Weekly sets matter more than how you split them. Twice a week per muscle is a practical default, and more frequent practice may help strength a little.',
    app: 'Coverage shows how many days a week each muscle is a main target, as information rather than a warning.',
    refs: [
      { cite: 'Schoenfeld BJ, Grgic J, Krieger JW (2019). How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis. J Sports Sci 37(11):1286–1295.', url: doi('10.1080/02640414.2018.1555906') },
      { cite: 'Grgic J, Schoenfeld BJ, Davies TB, et al. (2018). Effect of Resistance Training Frequency on Gains in Muscular Strength: A Systematic Review and Meta-Analysis. Sports Med 48(5):1207–1220.', url: doi('10.1007/s40279-018-0872-x') },
      { cite: 'Currier BS, et al. (2026). ACSM Position Stand (see above): at least 2 sessions a week covering all major muscle groups.', url: doi('10.1249/MSS.0000000000003897') },
    ],
  },
  rest: {
    title: 'Rest between sets',
    summary: 'Resting more than about 60 seconds may give slightly more muscle growth than very short rest; beyond about 90 seconds there’s no clear extra benefit. Longer rest (2–3 minutes) on heavy compound lifts is common practice, mainly to keep performance up across sets, and isolation exercises usually need less.',
    app: 'When fitting a workout into less time, the app shortens rest on isolation exercises first (to no less than 75 seconds) and keeps at least 2 minutes on compound lifts.',
    refs: [
      { cite: 'Schoenfeld BJ, Pope ZK, Benik FM, et al. (2016). Longer Interset Rest Periods Enhance Muscle Strength and Hypertrophy in Resistance-Trained Men. J Strength Cond Res 30(7):1805–1812.', url: doi('10.1519/JSC.0000000000001272') },
      { cite: 'Singer A, Wolf M, Generoso L, et al. (2024). Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. Front Sports Act Living 6:1429789.', url: doi('10.3389/fspor.2024.1429789') },
      { cite: 'Ratamess NA, Alvar BA, Evetoch TK, et al. (2009). ACSM Position Stand. Progression Models in Resistance Training for Healthy Adults. Med Sci Sports Exerc 41(3):687–708. (1–2 minutes may suffice for assistance exercises.)', url: doi('10.1249/MSS.0b013e3181915670') },
    ],
  },
  timeEfficient: {
    title: 'Training when short on time',
    summary: 'A review of time-efficient training recommends prioritising multi-joint lifts (at least a squat or leg press, an upper-body push and an upper-body pull), doing at least 4 hard sets per muscle per week, and remembering that weekly volume matters more than frequency. Supersets and similar techniques can roughly halve session time.',
    app: 'Fit to time protects compound lifts longest, in line with the review’s priority on multi-joint exercises. The rest of the trimming order is the app’s own rule of thumb: shorten rest on isolation moves (and trim compound rest to no less than 2 minutes), drop accessories that repeat a muscle already trained that session, then trim accessory sets before compound sets.',
    refs: [
      { cite: 'Iversen VM, Norum M, Schoenfeld BJ, Fimland MS (2021). No Time to Lift? Designing Time-Efficient Training Programs for Strength and Hypertrophy: A Narrative Review. Sports Med 51(10):2079–2095.', url: doi('10.1007/s40279-021-01490-1') },
    ],
  },
  sets: {
    title: 'One set or several',
    summary: 'Two to three sets per exercise usually beat a single set for both size and strength, but a single hard set still produces real gains when time is short.',
    app: 'Fit to time keeps at least 2 sets on compound lifts where it can, and only drops to 1 set when the time budget is very tight.',
    refs: [
      { cite: 'Krieger JW (2010). Single vs. multiple sets of resistance exercise for muscle hypertrophy: a meta-analysis. J Strength Cond Res 24(4):1150–1159.', url: doi('10.1519/JSC.0b013e3181d4d436') },
      { cite: 'Krieger JW (2009). Single versus multiple sets of resistance exercise: a meta-regression. J Strength Cond Res 23(6):1890–1901.', url: doi('10.1519/JSC.0b013e3181b370be') },
    ],
  },
  load: {
    title: 'Heavy or light weights',
    summary: 'You can build muscle across a wide rep range when sets are taken close to failure. Heavier loads build more maximal strength.',
    app: 'Rep ranges in your workouts can be anything that suits you; the app’s targets add weight once you reach the top of your range.',
    refs: [
      { cite: 'Lopez P, Radaelli R, Taaffe DR, et al. (2021). Resistance Training Load Effects on Muscle Hypertrophy and Strength Gain: Systematic Review and Network Meta-analysis. Med Sci Sports Exerc 53(6):1206–1216.', url: doi('10.1249/MSS.0000000000002585') },
      { cite: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW (2017). Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis. J Strength Cond Res 31(12):3508–3523.', url: doi('10.1519/JSC.0000000000002200') },
    ],
  },
  failure: {
    title: 'How close to failure',
    summary: 'Muscle growth tends to increase as sets end closer to failure, though going all the way to failure doesn’t add more. Strength gains are similar across a wide range of effort. Stopping with about 0–3 reps left is a common recommendation.',
    app: 'Deload weeks suggest stopping 3–4 reps short of failure to shed fatigue.',
    refs: [
      { cite: 'Robinson ZP, Pelland JC, Remmert JF, et al. (2024). Exploring the Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. Sports Med 54(9):2209–2231.', url: doi('10.1007/s40279-024-02069-2') },
      { cite: 'Refalo MC, Helms ER, Trexler ET, et al. (2023). Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis. Sports Med 53(3):649–665.', url: doi('10.1007/s40279-022-01784-y') },
    ],
  },
  deload: {
    title: 'Deloads',
    summary: 'An international expert consensus defines a deload as a period of reduced training stress to manage fatigue and prepare for more training. Experts agreed on reducing volume (fewer sets) and training further from failure; load can stay similar or come down. No fixed interval was agreed: deloads can be planned into each training block or taken when fatigue builds. In one trial, a full week off mid-programme didn’t change muscle growth and slightly blunted lower-body strength gains.',
    app: 'When two or more lifts trend down at once, or one does after 6+ straight weeks of training, the app suggests a deload week. Deload mode halves your sets for 7 days and suggests stopping 3–4 reps short of failure, keeping your usual weights.',
    refs: [
      { cite: 'Bell L, Strafford BW, Coleman M, et al. (2023). Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach. Sports Med Open 9:87.', url: doi('10.1186/s40798-023-00633-0') },
      { cite: 'Coleman M, Burke R, Augustin F, et al. (2024). Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. PeerJ 12:e16777.', url: doi('10.7717/peerj.16777') },
    ],
  },
  trend: {
    title: 'Spotting a decline or a stall',
    summary: 'Single sessions are noisy: sleep, food and stress move performance from day to day. A lift is only flagged as declining when its estimated 1RM sits clearly below its recent best for several sessions in a row, and as stalled when it hasn’t beaten its best for about four weeks. These cut-offs are rules of thumb, not tested thresholds.',
    app: 'Declining: the last 3 sessions all at least 3% below the best of the 6 weeks before them. Stalled: no new best (beating it by more than 1%) for 4+ weeks, with at least 3 sessions since that best. Several declining lifts at once may point to general fatigue rather than one lift.',
    refs: [
      { cite: 'Bell L, et al. (2023). Deloading Delphi consensus (see Deloads): deloads can be pre-planned or used in response to signs of fatigue.', url: doi('10.1186/s40798-023-00633-0') },
    ],
  },
  variation: {
    title: 'Changing exercises',
    summary: 'Planned, occasional exercise variation is fine and may help some regions of a muscle grow, while constant random switching may slow progress. Swapping an exercise or rep range when you stall is common coaching practice, not a proven rule.',
    app: 'Stalled lifts get a suggestion to try a different rep range or a close variation for a few weeks.',
    refs: [
      { cite: 'Kassiano W, Nunes JP, Costa B, et al. (2022). Does Varying Resistance Exercises Promote Superior Muscle Hypertrophy and Strength Gains? A Systematic Review. J Strength Cond Res 36(6):1753–1762.', url: doi('10.1519/JSC.0000000000004258') },
    ],
  },
  progression: {
    title: 'When to add weight',
    summary: 'ACSM’s progression guidance: once you can do 1–2 reps more than your target in two sessions in a row, add about 2–10% load (less for small muscle groups, more for large ones). The 2026 position stand recommends progressive training, noting overload matters most for continued long-term progress.',
    app: 'Session targets use double progression: add a rep each session until every set reaches the top of your rep range, then add one weight jump (set in Settings) and start again at the bottom of the range.',
    refs: [
      { cite: 'Ratamess NA, Alvar BA, Evetoch TK, et al. (2009). ACSM Position Stand. Progression Models in Resistance Training for Healthy Adults. Med Sci Sports Exerc 41(3):687–708.', url: doi('10.1249/MSS.0b013e3181915670') },
      { cite: 'Currier BS, et al. (2026). ACSM Position Stand (see Weekly sets).', url: doi('10.1249/MSS.0000000000003897') },
    ],
  },
  e1rm: {
    title: 'Estimated 1RM',
    summary: 'Formulas like Brzycki and Epley estimate your one-rep max from a set of several reps. They are approximations; a common rule of thumb is that they’re more reliable from lower-rep sets (about 10 or fewer). In one study of untrained students, every common equation underestimated the deadlift.',
    app: 'Estimates use your best set each session and ignore sets of more than 20 reps. Forecasts use the trend in these estimates, not any single session.',
    refs: [
      { cite: 'LeSuer DA, McCormick JH, Mayhew JL, et al. (1997). The Accuracy of Prediction Equations for Estimating 1-RM Performance in the Bench Press, Squat, and Deadlift. J Strength Cond Res 11(4):211–213.', url: doi('10.1519/00124278-199711000-00001') },
    ],
  },
  weightRate: {
    title: 'How fast to change bodyweight',
    summary: 'When losing weight, about 0.5–1% of bodyweight per week helps keep muscle; in elite athletes, a slower target kept lean mass better than a faster one. When gaining, about 0.25–0.5% per week limits fat gain for most lifters, slower for advanced lifters.',
    app: 'Bodyweight goals show the weekly rate your goal needs and flag it if it’s faster than these ranges.',
    refs: [
      { cite: 'Helms ER, Aragon AA, Fitschen PJ (2014). Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 11:20.', url: doi('10.1186/1550-2783-11-20') },
      { cite: 'Garthe I, Raastad T, Refsnes PE, et al. (2011). Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. Int J Sport Nutr Exerc Metab 21(2):97–104.', url: doi('10.1123/ijsnem.21.2.97') },
      { cite: 'Iraki J, Fitschen P, Espinar S, Helms E (2019). Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative Review. Sports 7(7):154.', url: doi('10.3390/sports7070154') },
    ],
  },
  weighTrend: {
    title: 'Reading bodyweight',
    summary: 'Weight moves day to day with water, food and salt, and tends to rise over weekends and fall during the week. A smoothed trend tells you more than any single weigh-in. Smoothing is a sensible practice rather than a tested rule.',
    app: 'The chart shows each weigh-in as a dot and a smoothed trend line; forecasts and weekly rates use the trend.',
    refs: [
      { cite: 'Orsama AL, Mattila E, Ermes M, et al. (2014). Weight Rhythms: Weight Increases during Weekends and Decreases during Weekdays. Obes Facts 7(1):36–47.', url: doi('10.1159/000356147') },
    ],
  },
  balance: {
    title: 'Muscle balance',
    summary: 'Balanced pushing and pulling, and training both the front and back of the thigh, are sensible rules of thumb, but research hasn’t established an ideal volume ratio. Hamstring-to-quadriceps strength ratios (around 0.6 is a common norm) have shown very limited ability to predict injury.',
    app: 'Coverage points out when one side gets more than twice the sets of the other. Treat it as a prompt to think, not a rule.',
    refs: [
      { cite: 'Kellis E, Sahinis C, Baltzopoulos V (2023). Is hamstrings-to-quadriceps torque ratio useful for predicting anterior cruciate ligament and hamstring injuries? A systematic and critical review. J Sport Health Sci 12(3):343–358.', url: doi('10.1016/j.jshs.2022.01.002') },
    ],
  },
  effort: {
    title: 'Rating effort (RIR and RPE)',
    summary: 'Reps in reserve (RIR) is how many more reps you could have done. The RIR-based RPE scale maps RPE 10 to no reps left, RPE 9 to one left, and so on. In a meta-analysis, people underestimated their reps left by about one on average, and were a little more accurate closer to failure and on sets under about 12 reps.',
    app: 'Effort is optional. When you log it, estimated 1RM uses your reps plus reps left (capped at 5), so an easier day doesn’t look like lost strength. If the reps you had left would have reached the top of your rep range with 2+ to spare on every top set, the next target adds weight (an app rule of thumb). RPE is stored as reps left, so RPE 8 = 2 left.',
    refs: [
      { cite: 'Zourdos MC, Klemp A, Dolan C, et al. (2016). Novel Resistance Training–Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve. J Strength Cond Res 30(1):267–275.', url: doi('10.1519/JSC.0000000000001049') },
      { cite: 'Helms ER, Cronin J, Storey A, Zourdos MC (2016). Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training. Strength Cond J 38(4):42–49.', url: doi('10.1519/SSC.0000000000000218') },
      { cite: 'Halperin I, Malleron T, Har-Nir I, et al. (2022). Accuracy in Predicting Repetitions to Task Failure in Resistance Exercise: A Scoping Review and Exploratory Meta-analysis. Sports Med 52(2):377–390.', url: doi('10.1007/s40279-021-01559-x') },
    ],
  },
  pain: {
    title: 'Exercising with pain',
    summary: 'In a trial of people with Achilles tendinopathy, continuing running and jumping guided by a pain-monitoring model did as well as stopping them for 6 weeks, with both groups doing the same rehab exercises. Pain was allowed up to 5/10 during activity, had to settle by the next morning, and could not get worse from week to week. The evidence is from Achilles rehab; persistent or worsening pain deserves a clinician’s opinion.',
    app: 'If you log pain on an exercise, the app flags ratings above 5/10 and pain that rises from one week to the next. It can’t check next-morning pain, so check that yourself.',
    refs: [
      { cite: 'Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J (2007). Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy: a randomized controlled study. Am J Sports Med 35(6):897–906.', url: doi('10.1177/0363546506298279') },
    ],
  },
};

export const EVIDENCE_ORDER = ['volume', 'frequency', 'sets', 'load', 'failure', 'effort', 'rest', 'progression', 'timeEfficient', 'deload', 'trend', 'variation', 'e1rm', 'weightRate', 'weighTrend', 'balance', 'pain'];
