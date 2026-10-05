// lib/eventData.ts — Single source of truth for all 128 AllSport events.

export type InputMode =
  | 'strength'
  | 'reps'
  | 'time'
  | 'hold'
  | 'difficulty+time'
  | 'difficulty+reps'
  | 'difficulty+distance'
  // Weight then longest hold: heavier always wins, time breaks the tie.
  // Leg Ext Hold only — a loaded hold with no ladder (difficulty review, Sept 2026).
  | 'weight+time'
  // Any load and reps: heavier always wins, reps break the tie. Tibialis Curl
  // only, since its fixed loads were removed (5 Oct 2026).
  | 'weight+reps'
  // An open distance and time, ranked on the time the effort predicts over the
  // event's `referenceMetres` (Riegel). Optionally tiered (Animal Crawl's crawl
  // styles), with the tier band on top as everywhere else. 5 Oct 2026.
  | 'distance+time'
  // An open load, distance and time: heaviest, then furthest, then fastest.
  // The carries, since their bodyweight-fraction ladders were removed.
  | 'weight+distance+time'
  | 'distance'
  | 'sport'
  | 'sprint'
  | 'score'

export type DifficultyTier = {
  level: number
  name: string
  // Judge criteria that used to bloat the name — shown in HOW TO and on
  // /events/[slug], never on the compact tier chips.
  detail?: string
  // A tier that is scored differently from the rest of its ladder.
  //   'weight' — the top rung of a rep ladder, where you load the movement
  //              instead of adding reps (Weighted Chinup, Weighted RTO Dip).
  //   'sport'  — a `Game` rung: the drill ladder tops out in the real contest,
  //              so the rung records a win, draw or loss.
  // Declared HERE, on the tier, and never matched by event name in scoring.ts.
  // Name matching is what silently dropped the weight input across the
  // 'Pause Chin Up' → 'Pause Chinup' rename (see CLAUDE.md); with 37 Game rungs
  // on the roster that failure mode would be everywhere.
  scoring?: 'weight' | 'sport'
  // A second number captured alongside the score but not used to rank within
  // the tier: reps on a weighted rung, strokes on a golf Game rung.
  records?: 'reps' | 'strokes'
}

export type EventData = {
  slug: string
  name: string
  domain: string
  domainNumber: number
  inputMode: InputMode
  hasDifficultyTiers: boolean
  difficultyTiers?: DifficultyTier[]
  variations?: string[]
  weightVariations?: string[]
  howToPerform: string
  rules: string
  videoPlaceholder: boolean
  emoji: string
  // 'distance+time' only: the distance every effort is compared over, in
  // metres. It is also the shortest distance accepted, because Riegel predicts
  // a SHORTER distance well and a longer one badly (a 250m sprint would
  // "predict" an elite 1000m).
  referenceMetres?: number
  // 'sport' only: a raced contest where a time may be recorded alongside the
  // win, draw or loss. It is kept for the record and never ranks.
  recordsTime?: boolean
}

export type BonusTarget = {
  tier: 1 | 2 | 3
  label: string
  detail: string
  points: 5
  inputMode: string
}

const PLACEHOLDER_CONTENT = 'Content coming soon.'

export const EVENTS: EventData[] = [
  // ─── Domain 1: Maximal Strength ─────────────────────────────────────────────
  {
    slug: 'one-arm-press',
    name: '1A Press',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Stand tall with a dumbbell or kettlebell racked at one shoulder, feet shoulder-width apart. Brace your core, squeeze your glutes, and press the weight straight overhead until your arm is fully locked out with your biceps beside your ear. Lower under control back to the shoulder.",
    rules: "Strict press only — no dip, bounce, or leg drive. Full lockout required at the top with a stable, motionless finish. Either arm allowed; the free hand may rest on your hip but not touch the working arm or the weight. Dumbbell or kettlebell allowed. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'deadlift',
    name: 'Deadlift',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: 'Stand with feet hip-width apart, barbell over mid-foot. Hinge at the hips, grip the bar just outside your legs. Brace your core, take a breath, and drive through the floor to stand tall. Lock out at the top with hips and knees fully extended. Lower under control.',
    rules: 'Starting position must be a dead stop on the floor. Full lockout required at the top — hips and knees fully extended, standing tall. No hitching (using thighs as a ramp). Standard or sumo stance allowed. Any grip allowed. Belt and straps permitted. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.',
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'clean-and-press',
    name: 'Clean & Press',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Start with the barbell on the floor. Clean it to your shoulders in one motion, standing tall in the front rack. Reset your breath, brace, then strictly press the bar overhead until your arms are locked out and the bar is over mid-foot. Lower under control.",
    rules: "The clean must reach the shoulders in one continuous motion. The press is strict — no dip, bounce, or leg drive after the bar leaves the shoulders. Full lockout at the top with head through and feet in line. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'pause-dips',
    name: 'Pause Dips',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Assisted · 2 Feet', detail: 'Dips with both feet assisting on the ground or a box' },
      { level: 2, name: 'Dip Top Hold' },
      { level: 3, name: 'Dip Negatives' },
      { level: 4, name: 'Straight Bar Dips' },
      { level: 5, name: 'Rings Turned Out Dip' },
      { level: 6, name: 'Weighted RTO Dip', scoring: 'weight', records: 'reps' },
    ],
    howToPerform: "Choose your tier, then support yourself on the bars or rings. Lower under control until your shoulders sit below your elbows, hold a dead pause at the bottom, then press back to full lockout. Repeat for max reps.",
    rules: "One-second dead pause at the bottom of every rep — no bounce. Full elbow lockout at the top. Depth standard: shoulder below elbow. Declare your tier before starting; most reps at your tier wins, and a higher tier always outranks a lower one. The top rung (Weighted RTO Dip) is scored by added weight, with reps recorded alongside it.",
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'pause-chin-up',
    name: 'Pause Chinup',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'High Ring Row' },
      { level: 2, name: 'Low Ring Row' },
      { level: 3, name: 'Chinup Negative' },
      { level: 4, name: 'Banded Chinup' },
      { level: 5, name: 'Chinup' },
      { level: 6, name: 'Weighted Chinup', scoring: 'weight', records: 'reps' },
    ],
    howToPerform: "Choose your tier and hang from the bar with an underhand grip, arms fully extended. Pull until your chin is clearly over the bar, lower under control to a dead hang, and pause before the next rep. Repeat for max reps.",
    rules: "One-second dead-hang pause at the bottom of every rep — no kipping or swinging. Chin clearly over the bar at the top. Declare your tier before starting; most reps at your tier wins, and a higher tier always outranks a lower one. The top rung (Weighted Chinup) is scored by added weight, with reps recorded alongside it.",
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'pause-squat',
    name: 'Pause Back Squat',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Set the barbell across your upper back. Stand, brace, and squat down until your hip crease is below your knee. Hold a dead pause in the bottom, then drive up to a full stand without bouncing.",
    rules: "One-second dead pause at the bottom — no bounce out of the hole. Depth standard: hip crease below the top of the knee. Full lockout at the top, hips and knees extended. High-bar or low-bar allowed. Belt allowed. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'zercher-deadlift',
    name: 'Zercher Dead',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Start with the barbell resting on the floor. Squat down, thread your arms under the bar, and cradle it in the crooks of your elbows with hands clasped. Brace hard, keep your chest up, and stand to full extension. Lower under control.",
    rules: "The bar starts at a dead stop on the floor and must be held in the crooks of the elbows — no hands under the bar. Full lockout at the top, hips and knees extended, standing tall. A bar pad or towel is permitted. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'pause-bench',
    name: 'Pause Bench',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Lie on the bench with your feet flat on the floor and eyes under the bar. Unrack, lower the bar to your chest under control, hold a dead pause, then press to full lockout.",
    rules: "One-second visible pause with the bar motionless on the chest — no sinking or bouncing. Full lockout at the top. Butt stays on the bench and feet stay on the floor throughout. Any grip width. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'turkish-get-up',
    name: 'Turkish Getup',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Lie on your back with a kettlebell or dumbbell locked out above one shoulder. Keeping the weight locked out and your eyes on it, work through the sequence — roll to the elbow, to the hand, sweep the leg, lunge — until you are standing tall with the weight overhead.",
    rules: "The arm stays locked out and the weight under control for the entire movement — a bent elbow or dropped weight is a failed attempt. Finish standing fully upright, feet together or in a stable stance. Either arm allowed. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },

  {
    slug: 'arthur-lift',
    name: 'Arthur Lift',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "The mirror of the clean and jerk, with the bar finishing overhead behind the body rather than in front. Clean the barbell to rest across the back of your shoulders, behind the neck, then dip and drive to jerk it overhead to full lockout.",
    rules: "The bar is received and driven from behind the neck and finishes locked out overhead with the head through and feet in line. Press-outs or a soft, unstable lockout are failed attempts. Split or power jerk both allowed. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'pause-row',
    name: 'Pause Row',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Hinge over with a flat back and the barbell hanging at arms length. Row the bar to your lower chest, hold a dead pause against the body, then lower under control to a full stretch.",
    rules: "One-second pause with the bar held against the torso every rep, then a controlled lower to full arm extension. Torso angle stays fixed; no jerking or standing up to move the weight. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'pause-front-squat',
    name: 'Pause Front Squat',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Rack the barbell across the front of your shoulders with elbows high. Squat down until your hip crease is below the knee, hold a dead pause at the bottom, then drive back to standing.",
    rules: "One-second visible pause at the bottom with the hips below parallel; no bouncing out of the hole. Elbows stay up and the bar stays racked. Full extension at the top. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'pullover-and-press',
    name: 'Pullover & Press',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Lie back with the barbell on the floor behind your head. Pull it over your face and down to your chest in one continuous movement, then press it to full lockout with your arms straight. Lower under control.",
    rules: "The bar travels from behind the head to the chest in one pullover — no rolling it up the body in stages. The press is strict from the chest to full lockout. Barbell or dumbbells allowed; with two dumbbells, score their combined weight. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    // The LOADED lunge, ranked on the estimated one-rep max. The bodyweight
    // Lunges ladder it sat beside was removed from Stamina in Sept 2026.
    slug: 'loaded-lunge',
    name: 'Loaded Lunge',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Take the load on your back, in the front rack, or in each hand. Step forward into a lunge until the back knee touches or nearly touches the floor and the front thigh is at least parallel. Drive back to standing under control, then change legs.",
    rules: "Both legs must be lunged for the lift to count — one rep each side. The back knee comes to within a fist of the floor and the front shin stays roughly vertical. Barbell, dumbbells or kettlebells allowed; declare which before you lift, and with two implements score their combined weight. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  // ─── Domain 2: Calisthenics ──────────────────────────────────────────────────
  {
    slug: '1-leg-squat',
    name: '1 Leg Squat',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Assisted Lunge' },
      { level: 2, name: 'Lunge' },
      { level: 3, name: 'Bulgarian Split Squat' },
      { level: 4, name: 'Shrimp Squat' },
      { level: 5, name: 'Pistol Squat' },
      { level: 6, name: 'Dragon Squat' },
    ],
    howToPerform: "Choose your tier — the progressions run from assisted lunges through to the dragon squat. Squat on one leg through the full range for your tier, keeping your heel down and knee tracking over your toes. Stand fully between reps. Repeat for max reps.",
    rules: "Declare your tier before starting. All reps on the same leg. Full depth for your tier and a full stand between reps. The free leg must not touch the ground mid-rep (where the tier requires it). Most reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'flag',
    name: 'Human Flag',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Side Plank' },
      { level: 2, name: 'Side Plank' },
      { level: 3, name: '1 Leg Side Plank' },
      { level: 4, name: 'Assisted Flag' },
      { level: 5, name: 'Tuck Flag' },
      { level: 6, name: 'Full Flag' },
    ],
    howToPerform: "Grip a vertical pole or upright with one hand high and one low, arms locked. Press hard with the bottom arm and pull with the top as you lift your body toward horizontal — or hold the plank variation for your tier. Hold the position as long as you can.",
    rules: "Declare your tier before starting. The timer starts when the declared position is reached and stops the moment it breaks. Body straight and aligned for flag tiers — hips level, legs together. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🚩',
  },
  {
    slug: 'windshield-wipers',
    name: 'Windshield Wipers',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Tuck Floor Wiper' },
      { level: 2, name: 'Floor Wipers' },
      { level: 3, name: 'Hanging Tuck Circles' },
      { level: 4, name: 'Hanging Circles' },
      { level: 5, name: 'Windshield Wipers' },
    ],
    howToPerform: "Hang from a pull-up bar and raise your legs to vertical (or set up on the floor for the lower tiers). Keeping your legs together, sweep them side to side in a controlled arc like a windshield wiper. Repeat for max reps.",
    rules: "Declare your tier before starting. One rep = a full sweep from one side to the other, under control, legs together. No swinging or using momentum. Most reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🌀',
  },
  {
    slug: 'planche',
    name: 'Planche',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Pseudo Planche Lean' },
      { level: 2, name: 'Elevated Pseudo Lean', detail: 'Pseudo planche lean with hands elevated' },
      { level: 3, name: 'Banded Tuck Planche' },
      { level: 4, name: 'Tuck Planche' },
      { level: 5, name: 'Banded Planche' },
      { level: 6, name: 'Straddle Planche' },
      { level: 7, name: 'Full Planche' },
    ],
    howToPerform: "Set your hands on the floor (or parallettes), lean your shoulders forward past your wrists, and take your feet off the ground into the planche position for your tier — from a pseudo lean up to the full planche. Hold as long as you can.",
    rules: "Declare your tier before starting. Timer starts when your feet leave the floor (or the lean position is set) and stops when the position breaks. Arms straight for planche tiers; banded means heavy band. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'back-lever',
    name: 'Back Lever',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Assisted Hang' },
      { level: 2, name: 'Hang' },
      { level: 3, name: 'Inverted Hang' },
      { level: 4, name: 'German Hang' },
      { level: 5, name: 'Tuck Back Lever' },
      { level: 6, name: 'Banded Back Lever' },
      { level: 7, name: 'Back Lever' },
    ],
    howToPerform: "Hang from a bar or rings, pull your legs through into an inverted position, and lower your body backward toward horizontal, face down, at the tier you have chosen. Keep your arms straight and your body tight. Hold as long as you can.",
    rules: "Declare your tier before starting. Timer starts when the declared position is reached and stops the moment it breaks. Body straight and horizontal for the full back lever; banded means heavy band. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'iron-cross',
    name: 'Iron Cross',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '2 Feet Top Hold' },
      { level: 2, name: 'Straight Bar Top Hold' },
      { level: 3, name: 'Ring Top Hold', detail: 'Support hold in the top position on rings' },
      { level: 4, name: 'Elbow Iron Cross' },
      { level: 5, name: 'Forearm Iron Cross' },
      { level: 6, name: 'Banded Iron Cross' },
      { level: 7, name: 'Iron Cross' },
    ],
    howToPerform: "On rings, lower from a support position until your arms are straight out to your sides and your body hangs vertically between them — the iron cross. Lower tiers use foot assistance, top-position holds, or a heavy band. Hold as long as you can.",
    rules: "Declare your tier before starting. Arms straight and in line with the shoulders — bent elbows end the attempt. Timer starts when the position is set and stops when it breaks. Banded means heavy band. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '✚',
  },
  {
    slug: 'front-lever',
    name: 'Front Lever',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Assisted Hang' },
      { level: 2, name: 'Hang' },
      { level: 3, name: 'Inverted Hang' },
      { level: 4, name: 'Tuck Lever Negative' },
      { level: 5, name: 'Tuck Front Lever' },
      { level: 6, name: 'Banded Front Lever' },
      { level: 7, name: 'Front Lever' },
    ],
    howToPerform: "Hang from a bar or rings with straight arms and pull your body up to horizontal, face up, at the tier you have chosen — from a basic hang through tuck and one-leg variations to the full front lever. Hold as long as you can.",
    rules: "Declare your tier before starting. Timer starts when the declared position is reached and stops the moment it breaks. Hips level with shoulders for lever tiers; banded means heavy band. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'chin-hang',
    name: 'Chin Hang',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Feet Assisted', detail: 'Chin hang with both feet assisting on the ground or a box' },
      { level: 2, name: 'Banded Hang', detail: 'Chin hang with heavy band assistance, hands on the bar' },
      { level: 3, name: 'Two-Hand Chin Hang', detail: 'Chin over the bar, both hands gripping' },
      { level: 4, name: 'One-Hand Chin Hang', detail: 'Chin over the bar, one hand gripping' },
      { level: 5, name: 'Banded Hands-Free', detail: 'Hands-free chin hang with heavy band assistance' },
      { level: 6, name: 'Chin Hang', detail: 'Chin over the bar with no hands on it' },
    ],
    howToPerform: "Pull to the top of a chin-up and hold with your chin over the bar, using the grip or assistance your tier allows. Stay tight and keep breathing. Hold as long as you can.",
    rules: "Declare your tier before starting. Chin clearly over the bar for the whole hold — the timer stops when your eyes drop below it. No resting your chin on the bar. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🧗',
  },
  {
    // Tāne, Sept 2026: "similar to the chin hang but performed using the back
    // of the neck/skull", and confirmed in /ship review: the SAME ladder as Chin
    // Hang, two hands, one hand, banded hands-free, then a free hang. The free
    // hang is the point of the event, so the rules must not forbid it. A hold,
    // longer wins, so NOT a timed effort.
    slug: 'skull-hang',
    name: 'Skull Hang',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Feet Assisted', detail: 'Bar behind the neck with both feet assisting on the ground or a box' },
      { level: 2, name: 'Banded Hang', detail: 'Heavy band assistance, both hands on the bar' },
      { level: 3, name: 'Two-Hand Hang', detail: 'Bar resting behind the neck, both hands gripping' },
      { level: 4, name: 'One-Hand Hang', detail: 'Bar resting behind the neck, one hand gripping' },
      { level: 5, name: 'Banded Hands-Free', detail: 'No hands on the bar, heavy band assistance' },
      { level: 6, name: 'Free Hang', detail: 'Bar behind the neck, no hands and no band' },
    ],
    howToPerform: "Pull up until the bar sits behind your neck, across the base of the skull and the top of the traps, using the grip or assistance your tier allows. Keep your chest up and your shoulders pulled down away from your ears. Hold as long as you can.",
    rules: "Declare your tier before starting. The bar stays behind the neck for the whole hold — the timer stops when it slides onto the shoulders or the head drops through. The upper tiers load the neck fully, so build up through the tiers rather than starting at the top; a kaiwhakawā will stop any hold where the head is pulled forward or the neck is strained. Longest hold at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🧗',
  },
  {
    // Renamed Handbalance -> Handstand, moved Power -> Calisthenics;
    // slug stays 'hand-walk' so historical results remain linked
    slug: 'hand-walk',
    name: 'Handstand',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Pushup Hold' },
      { level: 2, name: 'Elevated Pushup Hold' },
      { level: 3, name: 'Wall Handstand' },
      { level: 4, name: 'Freestanding', detail: 'Freestanding handstand, no wall' },
      { level: 5, name: '1 Arm Handstand' },
    ],
    howToPerform: "Choose your tier and set the hold: push-up hold, elevated push-up hold, wall handstand, or freestanding handstand. Lock your arms, squeeze your body tight, and hold the position as long as you can.",
    rules: "Declare your tier before starting. Timer starts when the position is set and stops when it breaks — for handstands, when your feet return to the floor or you walk more than a step out of position. Arms straight throughout. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'headstand',
    name: 'Headstand',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Wall Head Plank' },
      { level: 2, name: 'Feet-Supported Tripod' },
      { level: 3, name: 'Tripod Headstand' },
      { level: 4, name: 'Forearm Headstand' },
      { level: 5, name: 'Wall Assisted', detail: 'Headstand with no hands, wall support allowed' },
      { level: 6, name: 'Freestanding', detail: 'Freestanding headstand, no wall or hands' },
    ],
    howToPerform: "Choose your tier and set your base — head and hands in a stable tripod, or forearms for that tier. Walk your feet in, lift into the headstand for your tier, and hold as long as you can. Come down under control.",
    rules: "Declare your tier before starting. Timer starts when your feet are up in the declared position and stops when they come down or the wall/support rules for your tier are broken. Use a mat. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🙃',
  },
  {
    // Renamed from L-Sit Hold (Sept 2026). Slug stays 'l-sit-hold' so its history stays attached.
    slug: 'l-sit-hold',
    name: 'L-Sit',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Curl Up', detail: 'Lying on the back, head and shoulders curled off the floor, hands reaching past the knees' },
      { level: 2, name: 'V Up', detail: 'Seated on the floor, straight legs and torso lifted into a V, hands off the floor' },
      { level: 3, name: 'Tuck Hold', detail: 'Supported on straight arms, hips off the floor, both knees pulled to the chest' },
      { level: 4, name: 'L Sit', detail: 'Supported on straight arms, legs straight and level with the hips' },
      { level: 5, name: 'V Sit', detail: 'Supported on straight arms, straight legs raised above level' },
    ],
    howToPerform: 'Get into the position for your level, from a curl up on the floor to a V sit on straight arms, and hold it as long as you can. From Tuck Hold up, support yourself on parallettes, a bench or the floor with straight arms and your hips off the ground.',
    rules: 'Declare your level before starting. The timer starts when the position is set and stops when it breaks: the shoulders touch down on Curl Up, a hand or foot touches down on V Up, and on the supported levels the hips or feet touch down or the legs drop below the level\'s standard. Knees locked on L Sit and V Sit. Longest hold at your level wins; a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '🪑',
  },
  {
    // Added Sept 2026 (Tāne). A hold on the rings: longest wins.
    // The level descriptions were drafted by Claude and are unreviewed.
    slug: 'reverse-maltese',
    name: 'Reverse Maltese',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'High Ring Lean' },
      { level: 2, name: '45° Lean' },
      { level: 3, name: 'Low Lean' },
      { level: 4, name: 'Feet Raised' },
      { level: 5, name: 'Tuck R Maltese' },
    ],
    howToPerform: 'On the rings with straight arms, set the lean or position for your level, from a high ring lean up to the tuck reverse maltese, and hold it as long as you can.',
    rules: 'Declare your level before starting. Arms stay straight throughout. The timer starts when the position is set and stops when it breaks or the arms bend. Longest hold at your level wins; a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '🤸',
  },
  // ─── Domain 5: Stamina (Anaerobic Endurance until Sept 2026) ─────────────────
  {
    slug: 'chin-up-contest',
    name: 'Chinups',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'High Ring Row' },
      { level: 2, name: 'Low Ring Row' },
      { level: 3, name: 'Elevated Ring Row' },
      { level: 4, name: 'Banded Chinup' },
      { level: 5, name: 'Chin Up' },
      { level: 6, name: 'Muscle Up' },
    ],
    howToPerform: 'Start from a dead hang with palms facing you (supinated grip), hands shoulder-width apart. Pull your chin above the bar on every rep. Return to full dead hang between reps. Count total reps completed without stopping.',
    rules: 'Palms facing toward you (supinated grip). Full dead hang at the bottom of each rep — elbows fully extended. Chin must clear the bar on every rep. Kipping not allowed. No momentum from legs. You have 2 minutes: most reps inside 2 minutes wins.',
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    // Renamed from Pushup Contest (Sept 2026). Slug stays 'push-up-contest' so its history stays attached.
    slug: 'push-up-contest',
    name: 'Pushups',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Hands Up Knee Pushup', detail: 'On the knees, hands raised on a box or bench' },
      { level: 2, name: 'Knee Pushup' },
      { level: 3, name: 'Elevated Pushup', detail: 'Full pushup with the hands raised on a box or bench' },
      { level: 4, name: 'Pushup' },
      { level: 5, name: '1 Arm Pushup' },
    ],
    howToPerform: 'Choose your level and set up in the pushup position for it. Lower until your chest reaches the floor, or the box on an elevated level, then press back to full lockout with your body in one straight line. Repeat for max reps without resting on the floor.',
    rules: 'Declare your level before starting. Chest touches the floor, or the box on an elevated level, every rep; full elbow lockout at the top; hips stay in line, no sagging or piking. Resting is allowed in the top position only. Two minutes on the clock: most reps at your level inside two minutes wins, and a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'tibialis-curl',
    name: 'Tibialis Curl',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'weight+reps',
    hasDifficultyTiers: false,
    howToPerform: "Choose any load — tib bar, plate, or nothing — then sit or stand with your heels planted and the load over your forefoot. Keeping your legs straight and heels down, pull your toes up toward your shins as high as possible, then lower under control. Keep going for 2 minutes.",
    rules: "Declare your load before you start and stay on it for the whole set; enter the load (0 for bodyweight) and your reps. Heels stay planted throughout. Full range every rep: toes fully lifted at the top, controlled on the way down, or it does not count. You have 2 minutes. A heavier load always outranks a lighter one, and at the same load the most reps wins.",

    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'finger-push-up',
    name: 'Finger Pushup',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Knee', detail: 'Knee finger pushups with hands elevated' },
      { level: 2, name: 'Knee Finger Pushup' },
      { level: 3, name: 'Finger Pushup' },
      { level: 4, name: '1 Arm Finger Pushup' },
    ],
    howToPerform: "Choose your tier and set up in a push-up position on your fingertips — the tiers reduce the number of fingers as they climb. Lower until your chest reaches the floor, then press back to full lockout. Repeat for max reps.",
    rules: "Declare your tier before starting. Fingertips only — palms never touch the floor. Chest to floor and full lockout every rep, body in one straight line. Only the fingers your tier allows. You have 2 minutes: most reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '👆',
  },
  {
    slug: 'ghd-situp',
    name: 'GHD Situp',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Dead Bug' },
      { level: 2, name: 'Crunch' },
      { level: 3, name: 'Sit Up' },
      { level: 4, name: 'GHD Situp' },
      { level: 5, name: 'Weighted GHD Situp', scoring: 'weight', records: 'reps' },
    ],
    howToPerform: "Choose your tier — from dead bugs and crunches up to the full GHD sit-up. Move through the full range for your tier under control, touching the stated points at top and bottom. Repeat for max reps.",
    rules: "Declare your tier before starting. Full range every rep to your tier's standard. You have 2 minutes: most reps at your tier wins; a higher tier always outranks a lower one. The top rung (Weighted GHD Situp) is scored by added weight, with reps recorded alongside it.",

    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'leg-extension',
    name: 'Leg Ext Hold',
    domain: 'Stamina',
    domainNumber: 5,
    // Ladder removed Sept 2026 (difficulty review): the load IS the difficulty,
    // so it is entered rather than picked off a ladder. Heavier wins, longest
    // hold breaks the tie.
    inputMode: 'weight+time',
    hasDifficultyTiers: false,
    howToPerform: "Sit tall on a bench or box with your knees in line with the edge and your chosen load set across your ankles. Extend both legs until your knees are fully locked and level, then hold that position for as long as you can.",
    rules: "Record the load you used. The timer starts when both knees reach full lockout and stops the moment either leg drops below level. Hips stay on the bench and hands off the thighs. Heaviest load wins; within a load, the longest hold wins.",

    videoPlaceholder: true,
    emoji: '🦵',
  },

  {
    slug: 'hamstring-curl',
    name: 'Hamstring Curl',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Glute Thrust' },
      { level: 2, name: 'Ball Glute Thrust', detail: 'Glute thrust with heels on a yoga ball' },
      { level: 3, name: 'Floor Slider Curl' },
      { level: 4, name: 'Banded Nordic Curl' },
      { level: 5, name: 'Nordic Curl' },
    ],
    howToPerform: "Choose your tier. Each variation works the hamstrings through hip extension or knee flexion — from glute thrusts up to the full Nordic curl. Move under control through the full range for your tier, keeping your hips extended and core braced. Repeat for max reps.",
    rules: "Declare your tier before starting. Full range of motion every rep — no half reps. Nordic curls: lower under control to the floor and pull back up with the hamstrings; hands may only assist at the tier that allows the band. You have 2 minutes: most reps at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'sandbag-to-shoulder',
    name: 'Sandbag to Shoulder',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '5kg' },
      { level: 2, name: '10kg' },
      { level: 3, name: '25kg' },
      { level: 4, name: '50kg' },
      { level: 5, name: '80kg' },
      { level: 6, name: '100kg' },
    ],
    howToPerform: 'A bar is set at shoulder height. Starting with the sandbag on the ground, lift it over the bar so it fully clears and lands on the other side. Move around the bar to the other side and repeat. Each time the sandbag fully clears the bar counts as one rep.',
    rules: 'Bar must be set to the individual player\'s shoulder height. The sandbag must fully clear the bar and land on the other side to count as a rep. Player retrieves the bag from the other side for each subsequent rep. Any lifting technique permitted. You have 2 minutes: a heavier bag always outranks a lighter one, and within a bag the most reps wins.',
    videoPlaceholder: true,
    emoji: '💼',
  },
  {
    slug: 'wall-sit',
    name: 'Wall Sit',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'hold',
    hasDifficultyTiers: false,
    howToPerform: "Set your back flat against a wall and slide down until your thighs are parallel to the ground, knees over ankles. Hold the position for as long as you can.",
    rules: "Thighs stay at or below parallel with knees at roughly 90 degrees; the hold ends when your hips rise above the line or you push off the wall with your hands. Longest hold wins.",
    videoPlaceholder: true,
    emoji: '🪑',
  },
  {
    slug: 'toe-lift',
    name: 'Toe Lift',
    domain: 'Stamina',
    domainNumber: 5,
    // Changed Sept 2026 (Tāne): a hold, like Leg Ext Hold. The load is entered,
    // heavier wins, the longest hold breaks the tie. Bodyweight is 0kg.
    inputMode: 'weight+time',
    hasDifficultyTiers: false,
    howToPerform: "Stand tall with your heels planted and your chosen load set across your forefoot, or no load at all. Keeping your legs straight and heels glued to the floor, lift your toes and forefoot as high as you can toward your shins and hold them there for as long as you can.",
    rules: "Record the load you used (0 for none). The timer starts when the toes reach the top and stops the moment they drop or a heel lifts. No rocking back. Heaviest load wins; within a load, the longest hold wins.",

    videoPlaceholder: true,
    emoji: '🦶',
  },
  {
    slug: 'calf-raises',
    name: 'Calf Raises',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Calf Raise', detail: 'Both feet flat on the floor, rising onto the balls of the feet' },
      { level: 2, name: 'Deficit Calf Raise', detail: 'Balls of both feet on a step, heels dropping below the step each rep' },
      { level: 3, name: 'Toe Calf Raise', detail: 'On the step with a full deficit, rising until only the tips of the toes touch, like en pointe' },
      { level: 4, name: 'Single Leg Toe Raise', detail: 'The toe calf raise on one leg, the other held clear' },
    ],
    howToPerform: 'Stand tall with the balls of your feet loaded, on the floor or on the edge of a step as your level calls for. Drive up as high as your level asks, pause at the top, then lower all the way down under control. Keep the knee straight throughout.',
    rules: 'Declare your level before starting. Every rep reaches the full height of your level at the top (only the tips of the toes touching on Toe Calf Raise and above) and, on a deficit level, a full stretch at the bottom. A part rep does not count. Knees stay straight; bending them to bounce ends the set. One hand may rest on a wall for balance but must not take weight. You have 2 minutes: most reps at your level wins; a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    // Added Sept 2026 (Tāne). A hold: longest wins.
    slug: 'back-extension',
    name: 'Back Extension',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Bird Dog', detail: 'On hands and knees, one arm and the opposite leg held out straight and level' },
      { level: 2, name: 'Superman', detail: 'Face down on the floor, arms, chest and legs lifted off the floor' },
      { level: 3, name: 'Back Ext', detail: 'Hips on a back extension bench or GHD pad, body held straight and level, hands at the chest' },
      { level: 4, name: 'Straight Arm Ext', detail: 'The back extension with the arms held straight overhead' },
    ],
    howToPerform: 'Get into the position for your level, from a bird dog on hands and knees up to a straight-arm hold on a back extension bench, and hold it as long as you can with your body in one straight line.',
    rules: 'Declare your level before starting. The timer starts when the position is set and stops when it breaks: a hand or knee lifts or the raised limbs drop on Bird Dog, the chest or legs touch down on Superman, and the body drops below level on the bench levels. Longest hold at your level wins; a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '🦸',
  },
  {
    // Added Sept 2026 (Tāne). A hold: longest wins.
    slug: 'hollow-hold',
    name: 'Hollow Hold',
    domain: 'Stamina',
    domainNumber: 5,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Knee Plank', detail: 'Forearm plank on the knees, body straight from knees to shoulders' },
      { level: 2, name: 'Plank', detail: 'Forearm plank on the toes, body in one straight line' },
      { level: 3, name: 'Tuck Hollow', detail: 'On the back, lower back pressed to the floor, shoulders lifted, knees tucked to the chest' },
      { level: 4, name: 'Hollow Hold', detail: 'Lower back pressed to the floor, arms overhead and straight legs, both held just off the floor' },
      { level: 5, name: 'Tuck Dragon', detail: 'Lying on a bench gripping behind the head, hips and knees lifted off the bench in a tuck, weight on the shoulders' },
      { level: 6, name: 'Dragon Flag', detail: 'The body held straight and rigid from the shoulders, off the bench' },
    ],
    howToPerform: 'Get into the position for your level, from a plank up to a dragon flag, and hold it as long as you can. On the hollow levels press your lower back into the floor; on the dragon levels grip the bench behind your head and hold your body off it from the shoulders.',
    rules: 'Declare your level before starting. The timer starts when the position is set and stops when it breaks: the hips sag or pike on the plank levels, the lower back lifts or the arms or feet touch down on the hollow levels, and the hips touch the bench on the dragon levels. Longest hold at your level wins; a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '🍌',
  },
  // ─── Domain 7: Flexibility ────────────────────────────────────────────────────
  {
    slug: 'rear-hand-clasp',
    name: 'Rear Hand Clasp',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Towel-Assisted', detail: 'Hands hold opposite ends of a towel behind the back' },
      { level: 2, name: 'Block Assisted' },
      { level: 3, name: 'Half Block Assisted' },
      { level: 4, name: 'Finger Tips Touch' },
      { level: 5, name: 'Finger Clasp' },
      { level: 6, name: 'Palm Clasp' },
      { level: 7, name: 'Butterfly Clasp' },
    ],
    howToPerform: "Reach one arm over your shoulder and the other up your back behind you, working your hands toward each other — with the towel or blocks your tier allows. Clasp (or bridge the gap) and hold.",
    rules: "Declare your tier before starting. The timer starts when the position is set and stops when the grip or contact breaks. Stand or kneel tall — no hunching to cheat the distance. Either arm on top. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🙏',
  },
  {
    slug: 'bridge',
    name: 'Bridge',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Glute Bridge' },
      { level: 2, name: 'Wall Assisted Bridge' },
      { level: 3, name: 'Headstand Bridge' },
      { level: 4, name: 'Bridge' },
      { level: 5, name: 'Straight Arm Bridge' },
      { level: 6, name: 'Rainbow Bridge' },
    ],
    howToPerform: "Lie on your back with your hands planted beside your ears, fingers pointing toward your feet (or set up for your tier's variation). Press through hands and feet, lifting your hips and chest toward the ceiling into the bridge for your tier. Hold, and keep breathing.",
    rules: "Declare your tier before starting. The timer starts when the declared position is reached and stops when any part of it breaks. Arms straight where the tier requires it. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🌉',
  },
  {
    slug: 'forward-fold',
    name: 'Forward Fold',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Seated', detail: 'Seated fold with the hips elevated on a block' },
      { level: 2, name: 'Standing Fold' },
      { level: 3, name: 'Standing · Bent Knees', detail: 'Standing fold with knees bent' },
      { level: 4, name: 'Standing · Straight', detail: 'Standing fold with straight legs' },
      { level: 5, name: 'Fingertips to Floor', detail: 'Straight legs, fingertips reach the floor' },
      { level: 6, name: 'Palms to Floor', detail: 'Straight legs, palms flat on the floor' },
      { level: 7, name: 'Elbows to Toes', detail: 'Straight legs, elbows reach the toes' },
      { level: 8, name: 'Head to Legs', detail: 'Full fold — head touching the legs' },
    ],
    howToPerform: "Stand (or sit, for the elevated tier) with your legs together and fold forward from the hips, reaching toward the floor. Work to the depth your tier requires — fingertips, palms, elbows, or head to legs — and hold.",
    rules: "Declare your tier before starting. Legs straight where the tier requires it — no bent knees to cheat depth. Timer starts when the position is reached and stops when it breaks. No bouncing. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🧘',
  },
  {
    slug: 'needle-pose',
    name: 'Needle Pose',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Seated Quad Stretch' },
      { level: 2, name: 'Standing Quad Stretch' },
      { level: 3, name: '2 Hands to Back Foot' },
      { level: 4, name: '1 Foot, 1 Knee' },
      { level: 5, name: '2 Knee' },
      { level: 6, name: 'Full Needle Pose' },
    ],
    howToPerform: "Standing on one leg, lift the other leg behind you and raise it toward the height your tier requires, folding your torso forward as the leg climbs — all the way to leg-to-head for the top tier. Use the wall only if your tier allows it. Hold.",
    rules: "Declare your tier before starting. The lifted leg must reach and hold the height your tier states. Timer starts when the position is set and stops when the leg drops or balance is lost. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🪡',
  },
  {
    slug: 'front-split',
    name: 'Forward Split',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '2 Blocks', detail: 'Front split supported on 2 blocks under the front hip' },
      { level: 2, name: '1.5 Blocks', detail: 'Front split supported on 1.5 blocks' },
      { level: 3, name: '1 Block', detail: 'Front split supported on 1 block' },
      { level: 4, name: '0.5 Blocks', detail: 'Front split supported on half a block' },
      { level: 5, name: 'Front Split' },
      { level: 6, name: 'Over Split' },
    ],
    howToPerform: "Slide one leg forward and one back into a front split, using the block height your tier allows under your front hip. Keep your hips square and both legs straight. Settle into the position and hold.",
    rules: "Declare your tier before starting. Hips square to the front leg, both legs straight, and resting on the stated block height (or the floor, for the full split). Timer starts when the position is set and stops when it lifts or breaks. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'middle-split',
    name: 'Middle Split',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '3 Blocks', detail: 'Middle split supported on 3 blocks' },
      { level: 2, name: '2 Blocks', detail: 'Middle split supported on 2 blocks' },
      { level: 3, name: '1.5 Blocks', detail: 'Middle split supported on 1.5 blocks' },
      { level: 4, name: '1 Block', detail: 'Middle split supported on 1 block' },
      { level: 5, name: '0.5 Blocks', detail: 'Middle split supported on half a block' },
      { level: 6, name: 'Middle Split' },
    ],
    howToPerform: "Slide your legs out to the sides into a middle split, resting at the block height your tier allows. Keep your knees pointing up or forward and your torso tall. Settle in and hold.",
    rules: "Declare your tier before starting. Legs straight, resting at the stated block height (or flat on the floor for the full split). Timer starts when the position is set and stops when it lifts or breaks. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'standing-split',
    name: 'Standing Split',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Ankle Height', detail: 'Standing leg lift to ankle height' },
      { level: 2, name: 'Knee Height', detail: 'Standing leg lift to knee height' },
      { level: 3, name: 'Hip Height', detail: 'Standing leg lift to hip height' },
      { level: 4, name: 'Rib Height' },
      { level: 5, name: 'Shoulder Height' },
      { level: 6, name: 'Head Height' },
      { level: 7, name: 'Standing Split' },
    ],
    howToPerform: "Standing on one leg, raise the other leg in front or to the side to the height your tier requires — ankle, knee, hip, or all the way to head height — with hand assistance only where your tier allows. Lock the knee where stated and hold.",
    rules: "Declare your tier before starting. The lifted leg holds the stated height with the knee locked where required; hand assistance only at the tiers that allow it. Timer starts when the position is set and stops when the leg drops. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'foot-behind-head',
    name: 'Foot Behind Head Pose',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Assisted Pidgeon Pose' },
      { level: 2, name: '90/90 Pose' },
      { level: 3, name: 'Pidgeon Pose' },
      { level: 4, name: 'Elevated Pidgeon Pose' },
      { level: 5, name: 'Foot to Head Pose' },
      { level: 6, name: 'Foot Behind Head Pose' },
      { level: 7, name: 'Both Feet Behind Head' },
    ],
    howToPerform: "Sit tall and work your leg up your body according to your tier — from assisted pigeon pose through to foot behind the head. Move in slowly, keep your spine as tall as you can, and hold the position.",
    rules: "Declare your tier before starting. The timer starts when the declared position is reached and stops when the leg slips or the position breaks. No forcing the leg with jerky movements. Either leg. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🦶',
  },
  {
    slug: 'pancake',
    name: 'Pancake',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '3 Blocks', detail: 'Seated elevated on 3 blocks' },
      { level: 2, name: '2 Blocks', detail: 'Seated elevated on 2 blocks' },
      { level: 3, name: '1.5 Blocks', detail: 'Seated elevated on 1.5 blocks' },
      { level: 4, name: '1 Block', detail: 'Seated elevated on 1 block' },
      { level: 5, name: '0.5 Blocks', detail: 'Seated elevated on half a block' },
      { level: 6, name: 'Elbows to Floor', detail: 'Fold forward until the elbows rest flat on the floor' },
      { level: 7, name: 'Head to Floor', detail: 'Fold forward until the head touches the floor' },
    ],
    howToPerform: "Sit with your legs wide and fold your torso forward between them, resting at the block height your tier allows — down to hands, then head, on the floor for the top tiers. Keep your back long and legs straight. Hold.",
    rules: "Declare your tier before starting. Legs straight and knees pointing up; torso resting at the stated depth. Timer starts when the position is set and stops when it lifts. No bouncing. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🧘',
  },

  {
    slug: 'side-bend',
    name: 'Side Bend',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Standing Bend', detail: 'Feet planted, one arm overhead, bend directly to the side' },
      { level: 2, name: 'Gate Pose', detail: 'Parighasana — kneel on one knee, opposite leg extended to the side, bend over it' },
      { level: 3, name: 'Seated Bend', detail: 'Parsva Upavistha — seated wide-legged, torso laid along one leg reaching the foot' },
      { level: 4, name: 'Side-Split Lateral', detail: 'Wide or side-split stance, torso flat along one leg, chest open' },
    ],
    howToPerform: "Declare your tier, then bend laterally into the position and hold it still. Keep both hips grounded and the movement purely side-on, not rotating or leaning forward.",
    rules: "Declare your tier before starting. Hips stay square and grounded; leaning forward or twisting voids the hold. Longest hold at your tier wins, and a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🧘',
  },
  {
    slug: 'full-bound-twist',
    name: 'Full Bound Twist',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Seated Twist', detail: 'Sit tall, rotate the torso and hold with one hand behind' },
      { level: 2, name: 'Half Lord', detail: 'Ardha Matsyendrasana — knee crossed over, elbow outside it, rotate toward the knee' },
      { level: 3, name: 'Bound Twist', detail: 'Marichyasana C — arms bound around the leg to lock the rotation deeper' },
      { level: 4, name: 'Full Bound Twist', detail: 'Marichyasana D — deepest bound spinal rotation' },
    ],
    howToPerform: "Declare your tier, then rotate the spine into the position and hold it still, keeping your hips settled and the turn coming from the torso.",
    rules: "Declare your tier before starting. Hips stay grounded and the rotation comes from the spine, not from lifting off the seat. Longest hold at your tier wins, and a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🧘',
  },
  // ─── Domain 3: Power ─────────────────────────────────────────────────────────
  {
    slug: 'kelly-snatch',
    name: 'Kelly Snatch',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Start with a single dumbbell or kettlebell on the floor between your feet. In one explosive motion, drive through the floor and pull the weight overhead to a locked-out finish, catching it with a stable arm. Lower under control between attempts.",
    rules: "One continuous motion from floor to overhead lockout — no pressing out from the shoulder. Finish standing tall with the arm locked and the weight stable. Either arm allowed. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '💥',
  },
  {
    slug: 'one-arm-snatch',
    name: '1A Snatch',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Set a dumbbell or kettlebell on the floor between your feet. Hinge, grip, and in one explosive pull drive the weight all the way overhead, punching through to a locked-out catch. Stand tall to finish.",
    rules: "Floor to overhead in one continuous motion — a pause at the shoulder or a press-out is a failed attempt. Full lockout with the weight under control to finish. Either arm allowed. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '💥',
  },
  {
    slug: 'javelin-throw',
    name: 'Javelin',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: "Grip the javelin at the cord, draw it back over your shoulder, and throw it one-handed with an over-shoulder action after a short run-up. Follow through without crossing the throwing line.",
    rules: "One-handed over-the-shoulder throw only — no slinging or spinning. Use the full javelin. Release behind the line; crossing it is a foul. The javelin must land within the marked sector. Distance measured from the line to the first point of contact. Best attempt scores; the furthest throw wins.",

    videoPlaceholder: true,
    emoji: '🏹',
  },
  {
    slug: 'shot-put',
    name: 'Shotput',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: "Tuck the shot against your neck under your jaw. From behind the line, drive through your legs and hips and punch the shot forward in one putting action. Glide or standing put both allowed.",
    rules: "The shot must be putt from the neck with one hand — no throwing from behind the shoulder line. Use the full-weight shot. Release from behind the line and stay behind it until the shot lands. Distance measured from the line to first contact. Best attempt scores; the furthest put wins.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'australian-football',
    name: 'Australian Football',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Drop Kick' },
      { level: 2, name: 'Drop Kick (5m)', detail: 'Drop kick to a partner or target' },
      { level: 3, name: 'Drop Kick (10m)', detail: 'Drop kick to a partner' },
      { level: 4, name: 'Drop Kick (20m)', detail: 'Drop kick to a partner' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short-format game built on Australian Football skills — kicking, marking, and handballing. The kaiwhakawā sets the format on the day to suit numbers and space (kick-to-kick marking contests, or a small-sided game).",
    rules: "Format and scoring set by the kaiwhakawā before play and kept the same for all matches. Log your result as a win, draw, or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🏉',
  },
  {
    slug: 'vertical-jump',
    name: 'Vertical Jump',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: "Stand side-on to a wall and mark your standing reach with your arm fully extended. Then, from a stationary two-foot stance, jump as high as you can and touch the wall at the top. Your score is the difference between the two marks.",
    rules: "Two-foot take-off from a standing start — no steps or run-up. Arm fully extended for both the standing reach and the jump touch. Score is jump mark minus standing reach, measured in centimetres. Best attempt scores.",

    videoPlaceholder: true,
    emoji: '⬆️',
  },
  {
    slug: 'clean-and-jerk',
    name: 'Clean & Jerk',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Clean the barbell from the floor to your shoulders, standing tall in the front rack. Then dip and drive, jerking the bar overhead and catching it with locked arms — split or power jerk both allowed. Recover to standing with the bar overhead.",
    rules: "Two parts: a clean to the shoulders, then a jerk to full overhead lockout. Press-outs are failed attempts. Finish standing tall, feet in line, bar stable overhead. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'snatch',
    name: 'Snatch',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Take a wide grip on the barbell. In one explosive pull, drive the bar from the floor to overhead, catching it with locked arms — power or squat receive both allowed — and stand to finish.",
    rules: "Floor to overhead in one continuous motion. No press-out — arms must lock as the bar is received. Finish standing tall with the bar stable overhead. Score is your estimated one-rep max: more reps at a weight score higher, counted up to 10 reps.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },

  {
    slug: 'standing-broad-jump',
    name: 'Standing Broad Jump',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: "From a standing start behind the line, swing your arms and jump forward for maximum distance, landing on both feet. Distance is measured from the line to the nearest heel on landing.",
    rules: "Both feet start behind and stay behind the line until take-off (no run-up or step). You must land and hold your feet without falling backward or touching down with a hand. Measured to the nearest point of contact. Furthest jump wins.",
    videoPlaceholder: true,
    emoji: '🦘',
  },
  {
    slug: 'high-jump',
    name: 'High Jump',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: "Approach and take off from one foot to clear a horizontal bar set at height, landing on the mat beyond it. The bar is raised each round; your score is the greatest height you clear.",
    rules: "Take off from one foot. The jump counts only if the bar stays on its supports. Dislodging the bar is a miss. Height is recorded in centimetres at the highest bar cleared. Highest clearance wins.",
    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: 'arm-wrestling',
    name: 'Arm Wrestling',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Face your opponent across the table, plant your elbow on the pad, and lock hands with your free hand gripping the peg. On the referee's go, drive your opponent's hand down to the pad.",
    rules: "Elbow stays on the pad for the whole match — lifting it is a foul. Shoulders square to the table and the free hand stays on the peg. A pin is the back of the hand touching the pad. Two fouls lose the match. Log your result as a win, draw or loss with your opponent's name.",
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'tug-of-war',
    name: 'Tug of War',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Take your place on the rope with the centre marker over the middle line. On the referee's go, drive through your legs and pull the marker past your side's line.",
    rules: "Feet only — no sitting, no wrapping the rope around any part of your body. The pull is won when the centre marker crosses your line. Teams are set by the kaiwhakawa and matched for size where possible. Log your result as a win, draw or loss with the opposing side named.",
    videoPlaceholder: true,
    emoji: '🪢',
  },
  {
    slug: 'plie-squat',
    name: 'Plie Squat',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Supported Demi', detail: 'Hand on a wall or barre, knees bent to half depth, heels down' },
      { level: 2, name: 'Demi', detail: 'No support, thighs above parallel, heels down, knees tracking over the toes' },
      { level: 3, name: 'Grand', detail: 'Thighs at or below parallel, heels staying down throughout' },
      { level: 4, name: 'Relevé Grand', detail: 'Full depth held on the balls of both feet, heels lifted and still' },
    ],
    howToPerform: "Stand with your feet wide and your toes turned out, heels down. Keeping your torso upright and your knees tracking out over your toes, bend to the depth your tier calls for and hold.",
    rules: "Declare your tier before starting. Torso stays upright — leaning forward to reach depth ends the hold. Knees track over the toes and must not fall inward. On every tier but Relevé, both heels stay flat on the floor; on Relevé both heels stay lifted and still. Longest hold at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🧎',
  },
  {
    slug: 'seiza',
    name: 'Seiza',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Supported Kneel', detail: 'A block or cushion between the hips and the heels' },
      { level: 2, name: 'Hips to Heels', detail: 'Hips resting fully on the heels, no support, tops of the feet flat' },
      { level: 3, name: 'Toes Tucked', detail: 'Hips on the heels with the toes tucked under' },
      { level: 4, name: 'Reclined Kneel', detail: 'Sitting on the heels and leaning back, shoulders toward the floor' },
    ],
    howToPerform: "Kneel with your shins on the floor and your feet as your tier calls for, then sit your hips back onto your heels. Sit tall, breathe, and hold.",
    rules: "Declare your tier before starting. Hips stay in contact with the heels for the whole hold — lifting away ends it. Hands rest on the thighs and may not take weight, except on Reclined Kneel where they may brace behind you. Longest hold at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🧘',
  },
  {
    // Renamed from Wrist Stretch (Sept 2026). Slug stays 'wrist-stretch'.
    slug: 'wrist-stretch',
    name: 'Internal Wrist Stretch',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Hand Assisted', detail: 'The other hand eases the fingers back toward the forearm' },
      { level: 2, name: 'Hand Forward', detail: 'Kneeling, palms flat on the floor, fingers pointing forward, arms straight' },
      { level: 3, name: 'Fingers Inwards', detail: 'Palms flat, fingers pointing toward each other, arms straight' },
      { level: 4, name: 'Fingers Backwards', detail: 'Palms flat, fingers pointing back toward the knees, arms straight' },
      { level: 5, name: 'Backwards Plank', detail: 'Fingers pointing back, in a full plank with the weight over the hands' },
    ],
    howToPerform: 'On Hand Assisted, use your other hand to ease your fingers back toward your forearm. From Hand Forward up, kneel and place your palms flat on the floor in the direction your level calls for, straighten your arms and shift your weight over your hands until you feel the stretch through the front of the forearm. Hold.',
    rules: 'Declare your level before starting. On the floor levels the whole palm and every fingertip stay in contact with the floor and the arms stay straight; the hold ends the moment the heel of a hand lifts. On the plank level the knees stay off the floor. Longest hold at your level wins; a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '🖐️',
  },
  {
    // Renamed from Reverse Wrist Stretch (Sept 2026). Slug stays 'reverse-wrist-stretch'.
    slug: 'reverse-wrist-stretch',
    name: 'External Wrist Stretch',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Hand Assisted', detail: 'The other hand eases the back of the hand toward the forearm' },
      { level: 2, name: 'Fingers Outwards', detail: 'Kneeling, backs of the hands flat on the floor, fingers pointing out to the sides, arms straight' },
      { level: 3, name: 'Fingers Backwards', detail: 'Backs of the hands flat, fingers pointing back toward the knees, arms straight' },
      { level: 4, name: 'Fingers Inwards', detail: 'Backs of the hands flat, fingers pointing toward each other, arms straight' },
      { level: 5, name: 'Inwards Plank', detail: 'Fingers pointing toward each other, in a full plank with the weight over the backs of the hands' },
    ],
    howToPerform: 'On Hand Assisted, use your other hand to ease the back of your hand toward your forearm. From Fingers Outwards up, kneel and place the BACKS of your hands flat on the floor in the direction your level calls for, straighten your arms and ease your weight over them until you feel the stretch through the back of the forearm. Hold.',
    rules: 'Declare your level before starting. On the floor levels the back of each hand and every knuckle stay in contact with the floor and the arms stay straight; the hold ends the moment a hand rolls up onto its edge. On the plank level the knees stay off the floor. Ease into this one: the wrist has far less range this way than palms-down. Longest hold at your level wins; a higher level always outranks a lower one.',
    videoPlaceholder: true,
    emoji: '✋',
  },
  // ─── Domain 6: Endurance ─────────────────────────────────────────────────────
  {
    slug: 'burpee-broad-jump',
    name: 'Burpee Broad Jump',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '25m' },
      { level: 2, name: '50m' },
      { level: 3, name: '100m' },
      { level: 4, name: '200m' },
    ],
    howToPerform: "Choose your distance tier. Perform a burpee — chest to the floor, back to your feet — then a two-foot broad jump forward. Repeat the burpee-jump sequence down the course until you cover the full distance.",
    rules: "Declare your tier before starting. Every rep is a full burpee (chest touches the floor) followed by a two-foot broad jump — no running or walking forward. Timed from start signal to crossing the line. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '💨',
  },
  {
    slug: 'running',
    name: 'Running',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Run any distance of 1000m or more on a measured course or a GPS watch, as hard as you can hold. Pace yourself to finish strong.",
    rules: "Timed from the start signal to the end of your distance. Enter the distance you covered and your time. Any distance of at least 1000m counts. Your effort is ranked on the 1000m time it predicts (Riegel's formula, the standard endurance prediction), so a faster pace over a longer distance is a better effort: a 4:00 km beats a 15:00 3km, which predicts about 4:41.",
    videoPlaceholder: true,
    emoji: '🏃',
    referenceMetres: 1000,
  },
  {
    slug: 'cycling',
    name: 'Cycling',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Ride any distance of 1000m or more, on the bike erg or a measured course set up on the day, as hard as you can hold.",
    rules: "Timed from a stationary start to the end of your distance. Same bike setup available to all players; seat height adjustment allowed. Enter the distance you covered and your time. Any distance of at least 1000m counts. Your effort is ranked on the 1000m time it predicts (Riegel's formula, the standard endurance prediction), so a faster pace over a longer distance is a better effort: a 4:00 km beats a 15:00 3km, which predicts about 4:41.",
    videoPlaceholder: true,
    emoji: '🚴',
    referenceMetres: 1000,
  },
  {
    slug: 'ski-erg',
    name: 'Ski Erg',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Set the monitor, then drive the handles down with your whole body, hinging hard at the hips and finishing each pull past your thighs. Cover any distance of 1000m or more and empty the tank.",
    rules: "Distance and time are read from the erg monitor from a dead start. Any damper setting. Enter the distance you covered and your time. Any distance of at least 1000m counts. Your effort is ranked on the 1000m time it predicts (Riegel's formula, the standard endurance prediction), so a faster pace over a longer distance is a better effort: a 4:00 km beats a 15:00 3km, which predicts about 4:41.",
    videoPlaceholder: true,
    emoji: '⛷️',
    referenceMetres: 1000,
  },
  {
    slug: 'row-erg',
    name: 'Row Erg',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Strap in, and row with the sequence legs-body-arms on the drive, arms-body-legs on the recovery. Cover any distance of 1000m or more, keeping the handle moving and driving hard through the finish.",
    rules: "Distance and time are read from the erg monitor from a dead start. Any damper setting. Enter the distance you covered and your time. Any distance of at least 1000m counts. Your effort is ranked on the 1000m time it predicts (Riegel's formula, the standard endurance prediction), so a faster pace over a longer distance is a better effort: a 4:00 km beats a 15:00 3km, which predicts about 4:41.",
    videoPlaceholder: true,
    emoji: '🚣',
    referenceMetres: 1000,
  },
  {
    slug: 'breath-hold',
    name: 'Breath Hold',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'hold',
    hasDifficultyTiers: false,
    howToPerform: "Sit or lie down somewhere stable. Take a few calm breaths, then one full breath in, and hold. Relax everything — stillness buys you seconds. The attempt ends the moment you breathe out or in.",
    rules: "Performed seated or lying down, on land, with the kaiwhakawā or a partner watching — never alone and never in water. No hyperventilating before the attempt. Timer runs from the final inhale to the first breath out. Stop immediately if you feel dizzy. Longest hold wins.",
    videoPlaceholder: true,
    emoji: '🫁',
  },
  {
    slug: 'sandbag-carry',
    name: 'Sandbag Carry',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'weight+distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Pick the sandbag up off the floor and carry it as far and as fast as you can. Bear hug it to the chest or take it on one shoulder, whichever you can hold. You may set it down to regrip; the clock keeps running.",
    rules: "The bag is carried against the body — no handles, straps or barrow. Timed from the start signal to the end of your distance. Enter the combined load, the distance you covered, and your time. Heavier always wins; at the same load the longer distance wins, and at the same load and distance the faster time wins. Setting the load down is allowed, but the clock never stops.",
    videoPlaceholder: true,
    emoji: '📦',
  },
  {
    // REPLACES Duck Walk (Sept 2026). Not a rename: a bear crawl is not a duck
    // walk, so `duck-walk` history is deliberately NOT swept onto this slug.
    // Duck Walk survives as two rungs of this ladder, not as an event.
    slug: 'animal-crawl',
    name: 'Animal Crawl',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'distance+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Crawl', detail: 'Hands and knees' },
      { level: 2, name: 'Bear Crawl', detail: 'Hands and feet, hips high, opposite hand and foot together' },
      { level: 3, name: 'Lizard Crawl', detail: 'Chest low, elbows bent, hips down' },
      { level: 4, name: 'Duck Walk', detail: 'Deep squat, hips below knees, stepping without standing up' },
    ],
    howToPerform: "Choose your crawl, then cover any distance of 25m or more in it without breaking position.",
    rules: "Declare your crawl before starting. Hold the position for the whole distance — standing up or dropping the knees stops the clock until you are back in position. A harder crawl always outranks an easier one. Within a crawl, enter the distance you covered and your time. Any distance of at least 25m counts. Your effort is ranked on the 25m time it predicts (Riegel's formula, the standard endurance prediction), so a faster pace over a longer distance is a better effort: a 15-second 25m beats a 2-minute 100m.",
    videoPlaceholder: true,
    emoji: '🦆',
    referenceMetres: 25,
  },
  {
    slug: 'bronco',
    name: 'Bronco',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '1 Lap' },
      { level: 2, name: '2 Laps' },
      { level: 3, name: '3 Laps' },
      { level: 4, name: '4 Laps' },
      { level: 5, name: '5 Laps' },
    ],
    howToPerform: "Choose your lap tier. One lap is the rugby bronco shuttle: run 20m and back, 40m and back, then 60m and back, touching each line. Complete your tier's laps as fast as you can.",
    rules: "Declare your tier before starting. Touch every line with your foot on each shuttle — a missed line means returning to it. Timed from the start signal to the final line. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🏃',
  },

  {
    slug: 'scooting',
    name: 'Scooting',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Scoot any distance of 1000m or more seated on the ground, driving with your legs and arms, as fast as you can hold.",
    rules: "Stay seated on the ground for the whole distance; standing or crawling on hands and knees voids the attempt. Enter the distance you covered and your time. Any distance of at least 1000m counts. Your effort is ranked on the 1000m time it predicts (Riegel's formula, the standard endurance prediction), so a faster pace over a longer distance is a better effort: a 4:00 km beats a 15:00 3km, which predicts about 4:41.",
    videoPlaceholder: true,
    emoji: '🧎',
    referenceMetres: 1000,
  },
  {
    slug: 'farmer-carry',
    name: 'Farmer Carry',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'weight+distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Take a matched weight in each hand — farmer handles, dumbbells or kettlebells — stand tall, and walk it as far and as fast as you can. Shoulders back, arms hanging straight. You may set the weights down to regrip; the clock keeps running.",
    rules: "The two loads must match, and the load entered is their COMBINED weight. Both stay in your hands while you are moving — resting them on the body or a shoulder voids the attempt. Timed from the start signal to the end of your distance. Enter the combined load, the distance you covered, and your time. Heavier always wins; at the same load the longer distance wins, and at the same load and distance the faster time wins. Setting the load down is allowed, but the clock never stops.",
    videoPlaceholder: true,
    emoji: '🧳',
  },
  {
    slug: 'weighted-drag',
    name: 'Weighted Drag',
    domain: 'Endurance',
    domainNumber: 6,
    inputMode: 'weight+distance+time',
    hasDifficultyTiers: false,
    howToPerform: "Load the sled, take the strap or harness, and drag it as far and as fast as you can. Face forward and walk it out, or face the sled and pull hand over hand — either is allowed. You may stop to regrip; the clock keeps running.",
    rules: "The load is DRAGGED on the ground for the whole distance — lifting or carrying any part of it voids the attempt. The load entered is what is on the sled; spilling it means reloading before you carry on. Timed from the start signal to the end of your distance. Enter the combined load, the distance you covered, and your time. Heavier always wins; at the same load the longer distance wins, and at the same load and distance the faster time wins. Setting the load down is allowed, but the clock never stops.",
    videoPlaceholder: true,
    emoji: '🛷',
  },
  // ─── Domain 4: Speed ────────────────────────────────────────────────────────────
  {
    slug: '100m-sprint',
    name: '100m Sprint',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Race 100 metres side by side from a standing start on a measured straight course. React to the judge's signal and sprint at full speed through the finish line.",
    rules: "Distance must be exactly 100 metres on a measured course. Standing start — no blocks required. Stay in your lane. First across the line wins. Log your result as a win, draw or loss with your opponent's name; your time can be recorded alongside it but does not decide the result.",
    videoPlaceholder: true,
    emoji: '💨',
    recordsTime: true,
  },
  {
    slug: 'tag',
    name: 'Tag',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "One-on-one tag duel inside a marked grid. One player chases, one evades, for a set time — then roles swap. Use fakes, cuts, and acceleration to win your role.",
    rules: "Grid size, round length, and rounds per match are set by the kaiwhakawā and kept the same for all matches. Tags must be a clear touch — no pushing or grabbing. Log your result as a win, draw, or loss with your opponent's name; a time can be recorded alongside it but does not decide the result.",

    videoPlaceholder: true,
    emoji: '🏷️',
    recordsTime: true,
  },
  {
    slug: 't-race',
    name: 'T-Race',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Two identical T-shaped cone courses are set side by side. On the signal, sprint forward to the top of the T, shuffle side to side across it, and backpedal home. First player back wins the race.",
    rules: "Run head-to-head on matching courses. Touch each cone as set by the kaiwhakawā; a missed cone means going back to it. No crossing into the other lane. Log your result as a win, draw or loss with your opponent's name; your time can be recorded alongside it but does not decide the result.",

    videoPlaceholder: true,
    emoji: '⚡',
    recordsTime: true,
  },
  {
    slug: 'beach-flags',
    name: 'Beach Flags',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Players lie face down in a line, feet toward the flags, hands stacked under the chin. On the signal, spring up, turn, and sprint to grab a flag — there is always one fewer flag than players.",
    rules: "Start prone, facing away, motionless until the signal. False starts restart the heat; a second false start eliminates. No holding or blocking other players — grab the flag cleanly. Log each duel as a win, draw or loss with your opponent's name; a time can be recorded alongside it but does not decide the result.",

    videoPlaceholder: true,
    emoji: '🚩',
    recordsTime: true,
  },
  {
    slug: '200m-sprint',
    name: '200m Sprint',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Race 200 metres side by side on the marked course. Attack the first half, then hold your form and keep your turnover high all the way through the line.",
    rules: "Standing start, no blocks. Stay in your lane where lanes are marked. First chest across the line wins. Log your result as a win, draw or loss with your opponent's name; your time can be recorded alongside it but does not decide the result.",

    videoPlaceholder: true,
    emoji: '💨',
    recordsTime: true,
  },
  {
    slug: 'touch-rugby',
    name: 'Touch Rugby',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Passes' },
      { level: 2, name: 'Pass (2m)' },
      { level: 3, name: 'Pass (5m)' },
      { level: 4, name: 'Pass (10m)', detail: 'Both players moving' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short-format game of touch rugby. Move the ball with passes, run into space, and make touches on defence — a touch counts as a tackle and play restarts with a rollball.",
    rules: "Format (team size, touches per set, game length) is set by the kaiwhakawā and kept the same for all matches. Standard touch rules: six touches, no kicking, forward passes are turnovers. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '🏉',
  },
  {
    slug: 'repeat-high-jump',
    name: 'Repeat Vault',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Ankle height' },
      { level: 2, name: 'Knee height' },
      { level: 3, name: 'Hip height' },
      { level: 4, name: 'Belly Button Height' },
      { level: 5, name: 'Rib Height' },
      { level: 6, name: 'Shoulder height' },
    ],
    howToPerform: "Choose your bar height — ankle, knee, hip, belly button, rib or shoulder height. On the signal, complete the set number of two-foot jumps over the bar, rebounding side to side, as fast as you can.",
    rules: "Declare your tier before starting. The rep count is set by the kaiwhakawā and is the same for everyone. Two-foot take-off and landing; clipping the bar means resetting it before you continue, with the clock running. Fastest time to finish all reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '⬆️',
  },
  {
    slug: 'rats-and-rabbits',
    name: 'Rats & Rabbits',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: 'Face your opponent in a line, back to back. A judge calls either "Rats!" or "Rabbits!". If your team is called, you chase — if your team is not called, you run to your safe zone. First to tag the opponent\'s back scores the point. Play to first to 3 points, win by 2.',
    rules: "Players stand back to back in the centre. Judge calls \"Rats!\" or \"Rabbits!\" — named team chases, other team runs to their safe zone. A point is scored if the chaser tags the runner before they reach the safe zone. First to 3 points wins (must win by 2). Log your result as a win, draw or loss; a time can be recorded alongside it but does not decide the result. Match must be witnessed by the judge.",
    videoPlaceholder: true,
    emoji: '🐀',
    recordsTime: true,
  },
  {
    slug: 'speed-chess',
    name: 'Speed Chess',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: 'Play a game of chess against your opponent using only half the pieces (remove one side\'s pieces as agreed before the match). Each player has 3 minutes on the clock. Move fast — if your clock runs out, you lose.',
    rules: "Half pieces only — remove one colour's pieces symmetrically as agreed before the match. Each player has 3 minutes. Standard chess rules apply. Losing on time counts as a loss. Checkmate or resignation also ends the game. Trial format — time control and piece count subject to change after trialling. Record as win, draw, or loss.",
    videoPlaceholder: true,
    emoji: '♟️',
  },

  {
    slug: 'american-football',
    name: 'American Football',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Passes' },
      { level: 2, name: 'Pass (2m)' },
      { level: 3, name: 'Pass (5m)' },
      { level: 4, name: 'Pass (10m)' },
      { level: 5, name: 'Pass (20m)' },
      { level: 6, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a game of American football against your opponent or opposing team under the format set for the session. Advance the ball by running and passing and score in the end zone.",
    rules: "Format, field size and down rules are set by the kaiwhakawa and matched for all players. Log your result as a win, draw or loss with your opponent's name. Must be witnessed by a judge.",
    videoPlaceholder: true,
    emoji: '🏈',
  },
  {
    slug: 'capture-the-flag',
    name: 'Capture the Flag',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Defend the flag in your own half while trying to take the opposing flag and carry it back across the halfway line. Tagged players in enemy territory go to jail until a teammate frees them.",
    rules: "A tag in the opponent's half sends you to jail; you are safe in your own half. A jailed player is freed by a teammate's touch. The round is won by carrying the enemy flag over the halfway line. Field size, team size and round length are set by the kaiwhakawa and matched for all players. Log your result as a win, draw or loss; a time can be recorded alongside it but does not decide the result.",
    videoPlaceholder: true,
    emoji: '🚩',
    recordsTime: true,
  },
  {
    slug: 'kabaddi',
    name: 'Kabaddi',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Take turns raiding the opposing half. As the raider, cross the line, tag as many defenders as you can, and get back to your own half in a single breath while chanting. As a defender, hold the raider until the breath breaks.",
    rules: "The raider must keep the chant going for the whole raid — breaking it ends the raid with no points. A raid scores one point per defender tagged, and only if the raider returns across the halfway line. Defenders score by holding the raider until the chant breaks. Match length and team size are set by the kaiwhakawa and matched for all players. Log your result as a win, draw or loss; a time can be recorded alongside it but does not decide the result.",
    videoPlaceholder: true,
    emoji: '🤼',
    recordsTime: true,
  },
  // ─── Domain 8: Body Awareness ─────────────────────────────────────────────────
  {
    // Moved Calisthenics -> Body Awareness (Sept 2026); slug stays 'rope-climb'
    // so its history stays attached. Topped with a Game rung: the drill ladder
    // is a timed effort, and the Game term is NOT inverted (see encodeDiffTime),
    // or a loss would outrank a win.
    slug: 'rope-climb',
    name: 'Climbing',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Assisted Hang' },
      { level: 2, name: 'Hang', detail: 'Feet may grip the rope' },
      { level: 3, name: 'No Feet Hang' },
      { level: 4, name: 'Feet Assisted Climb', detail: 'Feet may grip the rope' },
      { level: 5, name: 'No Feet Climb' },
      { level: 6, name: 'Game', detail: 'Like HORSE: players take turns to nominate a climb, the fastest up it takes the point, first to 3 points wins', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier: the lower tiers are rope hangs, the upper tiers are climbs of the rope, with or without feet. For climbs, start standing with both hands on the rope, climb to touch the marked top, then descend under control.",
    rules: "Declare your tier before starting. Rope height is set and marked by the kaiwhakawā and must be the same for all players. Climbs are timed from the start signal to the top touch — fastest wins within a tier. No jumping start. Descend under control; sliding burns count as a safety fault. A higher tier always outranks a lower one. Game: like HORSE. Players take turns to nominate a climb; whoever climbs it fastest takes the point, and the first to 3 points wins. Record the win, draw or loss rather than a time.",

    videoPlaceholder: true,
    emoji: '🪢',
  },

  {
    slug: 'tae-kwon-do',
    name: 'Tae Kwon Do',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Spar a light-contact, points-based taekwondo match. Score with controlled kicks and punches to the scoring zones — head contact only where protective gear and both players' experience allow.",
    rules: "Light contact only — control is the standard, and the kaiwhakawā stops the match at any excessive contact. Round length and scoring zones set on the day. Protective gear worn where available. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '🥋',
  },
  {
    slug: 'breakdancing',
    name: 'Breakdancing',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Top Rock' },
      { level: 2, name: 'Footwork' },
      { level: 3, name: 'Top Rock + Footwork' },
      { level: 4, name: 'Top Rock + Footwork + Freeze' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier — top rock, footwork, then the two combined, then top rock and footwork finished with a freeze. Perform your tier's sequence continuously for as long as you can, staying clean and in control.",
    rules: "Declare your tier before starting. Timer runs while the move is performed or held to a recognisable standard — a stumble, extra support, or loss of the pattern stops the clock. Longest time at your tier wins; a higher tier always outranks a lower one. Game: a one-on-one battle of three alternating 30-second rounds; the kaiwhakawā picks the winner.",

    videoPlaceholder: true,
    emoji: '💃',
  },
  {
    slug: 'trampolining',
    name: 'Trampolining',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Basic Bounce' },
      { level: 2, name: 'Bounce to Butt' },
      { level: 3, name: '360 Spin' },
      { level: 4, name: 'Forward Flip' },
      { level: 5, name: 'Back Flip' },
      { level: 6, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier, from basic bounces to spins and flips. Perform your tier's skill on the trampoline for consecutive clean reps — land balanced in the centre and go straight into the next rep.",
    rules: "Declare your tier before starting. A rep counts when the skill is completed and landed under control on the feet. The set ends when you stop, land off-balance, or break the sequence. Flips only with kaiwhakawā approval and supervision. Most consecutive reps at your tier wins; a higher tier always outranks a lower one. Game: skill for skill. Land a skill and your opponent must match it; miss and take a letter. Five letters loses.",

    videoPlaceholder: true,
    emoji: '🎪',
  },
  {
    slug: 'jump-rope',
    name: 'Jump Rope',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Basic Two-Foot Jump' },
      { level: 2, name: 'Single Dutch' },
      { level: 3, name: 'Double Dutch' },
      { level: 4, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier — basic two-foot jumps, single dutch or double dutch. Skip continuously, counting every successful rep of your tier's skill, until you trip or stop.",
    rules: "Declare your tier before starting. Only clean reps of the tier skill count. The set ends when the rope stops or catches. Most consecutive reps at your tier wins; a higher tier always outranks a lower one. Game: side by side, thirty seconds of speed skipping; most reps wins.",

    videoPlaceholder: true,
    emoji: '🪢',
  },
  {
    slug: 'wrestling',
    name: 'Wrestling',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Wrestle a short match on mats. Score with takedowns, reversals, and control positions — win by points or by pin, as set on the day.",
    rules: "Match length and scoring set by the kaiwhakawā. No strikes, no submissions, no slams — takedowns must be controlled to the mat. Log your result as a win, draw, or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🤼',
  },
  {
    slug: 'gymnastics',
    name: 'Gymnastics',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Forward Roll' },
      { level: 2, name: 'Backward Roll' },
      { level: 3, name: 'Cartwheel' },
      { level: 4, name: 'Handspring', detail: 'Front or back handspring' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier, from forward rolls up to back handsprings. Perform your tier's skill for clean, consecutive reps on the mats — finish each rep in control before starting the next.",
    rules: "Declare your tier before starting. A rep counts when the skill is completed to a clean standard and finished under control. Mats required; handsprings only with kaiwhakawā approval. Most reps at your tier wins; a higher tier always outranks a lower one. Game: skill for skill on floor skills. Land a skill and your opponent must match it; miss and take a letter. Five letters loses.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'balance-ball',
    name: 'Balance Ball',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Seated' },
      { level: 2, name: 'Kneeling' },
      { level: 3, name: 'Kneeling · No Hands', detail: 'Kneeling on the ball with no hands touching it' },
      { level: 4, name: '1 Leg · No Hands', detail: 'Standing on one leg, no hands' },
      { level: 5, name: 'Standing' },
      { level: 6, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier and mount the balance ball — seated, kneeling, or standing as your tier requires. Find your balance point and hold it as long as you can, using your hands only where the tier allows.",
    rules: "Declare your tier before starting. Timer starts when you are balanced in the declared position with no outside support and stops when any body part touches the floor or you leave the position. Spot the ball on soft ground or mats. Longest hold at your tier wins; a higher tier always outranks a lower one. Game: side by side on two balls in the same position; the last player still balanced wins.",

    videoPlaceholder: true,
    emoji: '⚖️',
  },
  {
    slug: 'skate',
    name: 'SKATE',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Board Tilts' },
      { level: 2, name: '360 Spin' },
      { level: 3, name: 'Ollie' },
      { level: 4, name: 'Pop Shove It' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your trick tier — from board tilts up to the pop shove it. Attempt the trick and land it rolling away clean. Every clean landing counts one rep.",
    rules: "Declare your tier before starting. A rep counts only when the trick is landed with both feet on the board, rolling away in control. Attempts are unlimited within the time the kaiwhakawā sets. Most landed reps at your tier wins; a higher tier always outranks a lower one. Helmet required. Game: S.K.A.T.E. Land a trick and your opponent must match it; miss and take a letter. Spell SKATE and you lose.",

    videoPlaceholder: true,
    emoji: '🛹',
  },
  {
    slug: 'fencing',
    name: 'Fencing',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Fence a short bout — first to the target number of touches. Score by landing the blade on your opponent's scoring zone while defending your own with footwork and parries.",
    rules: "Bout format and target touches set by the kaiwhakawā. Masks and chest protection required; only the equipment provided may be used. Clean, controlled touches only. Log your result as a win, draw or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🤺',
  },
  {
    slug: 'juggling',
    name: 'Juggling',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '2 Ball (both hands)' },
      { level: 2, name: '2 Ball (one hand)' },
      { level: 3, name: '3 Ball' },
      { level: 4, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier — two balls in both hands, two in one hand, three, or four. Start the pattern and keep it running as long as you can. The attempt ends when a ball drops or the pattern breaks.",
    rules: "Declare your tier before starting. Timer starts with the first throw and stops when a ball is dropped or caught against the body, or the pattern stops. Any props (balls, beanbags, clubs). Longest continuous juggle at your tier wins; a higher tier always outranks a lower one. Game: side by side, same pattern; the last one still juggling wins.",

    videoPlaceholder: true,
    emoji: '🤹',
  },
  {
    slug: 'foot-juggling',
    name: 'Foot Juggling',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '2 Bounce' },
      { level: 2, name: '1 Bounce' },
      { level: 3, name: 'No Bounce' },
      { level: 4, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: 'Keep a football (soccer ball) in the air using only your feet, knees, and legs. Each tier allows fewer bounces between touches, from two down to none. Count how many consecutive touches you complete before the ball hits the ground.',
    rules: 'Use a standard soccer ball. Touches must be below the waist — no hands or arms. Your tier sets how many ground bounces are allowed between touches. Count consecutive touches. Submit your best total from one continuous attempt. Must be witnessed by a judge or filmed. Game: side-by-side keepy-uppies; the last ball up wins.',
    videoPlaceholder: true,
    emoji: '⚽',
  },

  {
    slug: 'slackline',
    name: 'Slackline',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Single Leg Balance' },
      { level: 2, name: 'Beam' },
      { level: 3, name: 'Slackline' },
      { level: 4, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Choose your tier, then hold the balance for as long as you can. Use your arms and gaze to stay centred.",
    rules: "Declare your tier before starting. The clock starts once you are balanced unassisted and stops the moment a foot touches the ground or a support. Longest time at your tier wins; a higher tier always outranks a lower one. Game: side by side on two lines; the last one on wins.",
    videoPlaceholder: true,
    emoji: '🎪',
  },
  // ─── Domain 9: Coordination ──────────────────────────────────────────────────
  {
    slug: 'volleyball',
    name: 'Volleyball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Dig Passes (2m)' },
      { level: 2, name: 'Dig Passes (5m)' },
      { level: 3, name: 'Partner Digs (10m)' },
      { level: 4, name: 'Partner Digs (20m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: 'Play a standard game of volleyball against your opponent. One-on-one or two-a-side over a net; first to 11 points (win by 2) takes the match. Use standard volleyball rules. A judge or agreed witness must observe the match.',
    rules: 'Standard volleyball rules apply. One-on-one or two-a-side; first to 11 points wins (must win by 2). If no court is available, a modified court may be used with judge approval. Record win, draw (if agreed), or loss and the final score.',
    videoPlaceholder: true,
    emoji: '🏐',
  },
  {
    slug: 'baseball',
    name: 'Baseball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Bat & Catch' },
      { level: 2, name: 'Bat & Catch (2m)' },
      { level: 3, name: 'Bat & Catch (5m)' },
      { level: 4, name: 'Bat & Catch (10m)' },
      { level: 5, name: 'Bat & Catch (20m)' },
      { level: 6, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short-format baseball contest — batting, pitching, and fielding, scaled to numbers and space. The kaiwhakawā sets the format on the day (hitting duels, over-the-line, or a quick innings game).",
    rules: "Format and scoring set by the kaiwhakawā before play and kept the same for all matches. Log your result as a win, draw, or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '⚾',
  },
  {
    slug: 'teqball',
    name: 'Teqball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Bounce Pass' },
      { level: 2, name: 'Bounce Pass (2m)' },
      { level: 3, name: 'Bounce Pass (5m)' },
      { level: 4, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play teqball over the curved table (or a bench substitute) — football tennis, no hands. Return the ball over the table using any part of your body except arms and hands, within the touch limit.",
    rules: "First to the target points, set by the kaiwhakawā. No hands or arms; maximum three touches per side and no consecutive touches with the same body part. Log your result as a win or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'tennis',
    name: 'Tennis',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Vertical Juggles' },
      { level: 2, name: 'Hits (2m)' },
      { level: 3, name: 'Hits (5m)' },
      { level: 4, name: 'Hits (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short-format tennis match — full court or short court to suit space. Serve diagonally, rally, and take your chances at the net.",
    rules: "Format (games or first-to points, serve rules) set by the kaiwhakawā and kept the same for all matches. Log your result as a win, draw, or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🎾',
  },
  {
    slug: 'cricket',
    name: 'Cricket',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Bat & Catch' },
      { level: 2, name: 'Bat & Catch (2m)' },
      { level: 3, name: 'Bat & Catch (5m)' },
      { level: 4, name: 'Bat & Catch (10m)' },
      { level: 5, name: 'Bat & Catch (20m)' },
      { level: 6, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a quick-format cricket contest — batting, bowling, and fielding in a compressed game (pairs cricket or a set number of overs each).",
    rules: "Format set by the kaiwhakawā: overs per side, runs and dismissal rules, kept the same for all matches. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '🏏',
  },
  {
    slug: 'badminton',
    name: 'Badminton',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Vertical Juggles' },
      { level: 2, name: 'Partner Hits (2m)' },
      { level: 3, name: 'Partner Hits (5m)' },
      { level: 4, name: 'Partner Hits (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short badminton match. Serve underarm and diagonal, then rally — use clears, drops, and smashes to move your opponent around the court.",
    rules: "First to the target points (rally scoring), set by the kaiwhakawā. Standard badminton faults apply: shuttle must cross the net and land in, no double hits. Log your result as a win or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🏸',
  },
  {
    slug: 'basketball',
    name: 'Basketball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Bounce Ball' },
      { level: 2, name: '2 Ball Bounce' },
      { level: 3, name: '2 Ball Side to Side' },
      { level: 4, name: '2 Ball Back & Forth' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short-format basketball game — 1v1 or small-sided halfcourt, first to the target score. Check the ball at the top, and clear it behind the arc on each change of possession in halfcourt play.",
    rules: "Format (target score, 1s-and-2s scoring, game length) set by the kaiwhakawā and kept the same for all matches. Standard violations apply — travels, double dribble, and fouls called honestly. Log your result as a win or loss.",

    videoPlaceholder: true,
    emoji: '🏀',
  },
  {
    slug: 'football',
    name: 'Football',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Partner Pass' },
      { level: 2, name: 'Partner Pass (2m)' },
      { level: 3, name: 'Partner Pass (5m)' },
      { level: 4, name: 'Partner Pass (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a small-sided football game — small goals, tight space, first to the target score or best score within the time. Keep the ball moving and press hard when you lose it.",
    rules: "Format (team size, goal size, game length) set by the kaiwhakawā and kept the same for all matches. No slide tackles. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'hockey',
    name: 'Hockey',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Partner Pass' },
      { level: 2, name: 'Partner Pass (2m)' },
      { level: 3, name: 'Partner Pass (5m)' },
      { level: 4, name: 'Partner Pass (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a small-sided hockey game with sticks and a ball — small goals, no keepers unless numbers allow. Keep the ball on the flat side of the stick and pass early.",
    rules: "Format set by the kaiwhakawā and kept the same for all matches. Sticks below shoulder height at all times; no lifting the ball dangerously. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '🏑',
  },
  {
    slug: 'squash',
    name: 'Squash',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Partner Pass' },
      { level: 2, name: 'Partner Pass (2m)' },
      { level: 3, name: 'Partner Pass (5m)' },
      { level: 4, name: 'Partner Pass (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short squash match. Serve from the service box, then rally off the front wall — take the T, and move your opponent into the corners.",
    rules: "First to the target points, set by the kaiwhakawā. Standard squash rules: ball above the tin and below the out line, one bounce. Play lets and strokes honestly. Log your result as a win or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🎾',
  },

  {
    slug: 'lacrosse',
    name: 'Lacrosse',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Partner Pass' },
      { level: 2, name: 'Partner Pass (2m)' },
      { level: 3, name: 'Partner Pass (5m)' },
      { level: 4, name: 'Partner Pass (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a game of lacrosse against your opponent or opposing team. Carry and pass the ball with your stick and score by shooting into the goal, under the format set for the session.",
    rules: "Format, field size and rules are set by the kaiwhakawa and matched for all players. Log your result as a win, draw or loss with your opponent's name. Must be witnessed by a judge.",
    videoPlaceholder: true,
    emoji: '🥍',
  },
  {
    slug: 'ultimate-frisbee',
    name: 'Ultimate Frisbee',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Partner Pass' },
      { level: 2, name: 'Partner Pass (2m)' },
      { level: 3, name: 'Partner Pass (5m)' },
      { level: 4, name: 'Partner Pass (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: 'Play a game of Ultimate Frisbee against your opponent or opposing team. Move the disc down the field by passing — no running with the disc. Score by catching the disc in the opposing end zone. Standard Ultimate Frisbee rules apply.',
    rules: 'Standard Ultimate Frisbee rules apply. No running with the disc — pivot and pass only. Disc changes possession on incomplete passes, interceptions, or out-of-bounds. Score by catching in the end zone. Small-sided: first to three points, or the most points when the set time runs out. Record as a win, draw, or loss. Must be witnessed by a judge.',
    videoPlaceholder: true,
    emoji: '🥏',
  },
  // ─── Domain 10: Aim & Precision ──────────────────────────────────────────────
  {
    slug: 'netball',
    name: 'Netball',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Shot Under Hoop', detail: 'Standing directly under the hoop' },
      { level: 2, name: 'Shot (2m)' },
      { level: 3, name: 'Shot (5m)' },
      { level: 4, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a short-format netball contest — a shooting duel or small-sided game, as set on the day. In game play, pass quickly and hold your space; no stepping with the ball.",
    rules: "Format set by the kaiwhakawā (shooting rounds or a timed small-sided game) and kept the same for all matches. Standard netball rules where playing a game: no stepping, no contact, obstruction at arm's length. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '🏀',
  },
  {
    slug: 'bocce',
    name: 'Bocce',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Bowl Ball' },
      { level: 2, name: 'Within 5m of Jack' },
      { level: 3, name: 'Within 1m of Jack' },
      { level: 4, name: 'Hit the Jack', detail: 'Strike the jack itself from the throwing line' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Take turns throwing your bocce balls toward the jack. Get closer than your opponent — knock their balls away or reposition the jack with a well-weighted throw.",
    rules: "Points per end go to the balls closer to the jack than the opponent's best ball; first to the target score set by the kaiwhakawā. Throw from behind the line. Log your result as a win or loss with your opponent's name.",
    videoPlaceholder: true,
    emoji: '🎯',
  },
  {
    slug: 'dodgeball',
    name: 'Dodgeball',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Throw Ball' },
      { level: 2, name: 'Throw & Catch (1m)', detail: 'With a partner' },
      { level: 3, name: 'Throw & Catch (5m)' },
      { level: 4, name: 'Throw & Catch (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a dodgeball match. Throw to hit opponents below the shoulders, dodge what comes back, and catch a live ball to bring a teammate back in — last team (or player) standing wins the set.",
    rules: "Format (team size, sets, court size) set by the kaiwhakawā. Hits above the shoulders don't count and headhunting is a foul. A caught ball puts the thrower out. Honesty rule: call yourself out. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '🎯',
  },
  {
    slug: 'carrom',
    name: 'Carrom',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Strike a Piece', detail: 'Flick the striker from the baseline and make contact' },
      { level: 2, name: 'Pocket a Piece' },
      { level: 3, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a game of carrom. Flick the striker from your baseline to pocket your colour's pieces into the corner pockets, finishing with the red queen covered by one of your own.",
    rules: "Standard carrom rules: strike from your own baseline, pocket your pieces, and the queen must be covered to count. Fouls return a pocketed piece to the board. First to clear their pieces (with the queen resolved) wins. Log your result as a win or loss.",

    videoPlaceholder: true,
    emoji: '🎱',
  },
  {
    slug: 'archery',
    name: 'Archery',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Hit the Target (5m)' },
      { level: 2, name: 'Hit the Target (10m)' },
      { level: 3, name: 'Hit the Gold (10m)', detail: 'Inner gold rings of the target face' },
      { level: 4, name: 'Hit the Gold (20m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Shoot a set number of arrows per end at the target from the marked distance. Draw smoothly, anchor consistently, and score where each arrow lands.",
    rules: "Distance, arrows per end, and total ends are set by the kaiwhakawā and matched for both players. All safety commands are absolute — arrows are only nocked on the shooting line and collected together. Highest total wins the match. Log your result as a win, draw, or loss.",

    videoPlaceholder: true,
    emoji: '🏹',
  },
  {
    slug: 'bowling',
    name: 'Bowling',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Partner Bowl' },
      { level: 2, name: 'Partner Bowl (5m)' },
      { level: 3, name: 'Partner Bowl (10m)' },
      { level: 4, name: 'Partner Bowl (20m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Bowl head-to-head against an opponent over a set number of frames. Roll at the pins from behind the line — most pins across your frames takes the match.",
    rules: "Frame count and lane setup are set by the kaiwhakawā on the day and matched for all players. Release the ball behind the line; foot faults score zero for that roll. Most total pins wins the match; equal pins is a draw. Log your result as a win, draw or loss with your opponent's name.",
    videoPlaceholder: true,
    emoji: '🎳',
  },
  {
    slug: 'darts',
    name: 'Darts',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Hit the Board', detail: 'Land all three darts of a visit on the board' },
      { level: 2, name: 'Named Number', detail: 'Hit a number called before you throw' },
      { level: 3, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a darts match from the oche — 301 or 501, as set on the day. Score with each three-dart visit and work your way down to a finish.",
    rules: "Game format (301/501, straight or double finish) set by the kaiwhakawā and matched for all players. Both feet behind the oche when throwing. Log your result as a win or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🎯',
  },
  {
    slug: 'disc-golf',
    name: 'Disc Golf',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Putt (2m)' },
      { level: 2, name: 'Putt (5m)' },
      { level: 3, name: 'Putt (10m)' },
      { level: 4, name: 'Game', scoring: 'sport', records: 'strokes' },
    ],
    howToPerform: "Play a round of disc golf. Tee off from the marked tee, throw from where the disc lands, and finish each hole by hitting the basket or target. Count every throw.",
    rules: "Play the holes set out by the kaiwhakawā, from the tees and to the targets marked. Every throw counts one stroke; play the disc where it lies, with course penalty rules as set on the day. Lowest total strokes wins. In a game, fewer strokes than your opponent is a win and equal strokes is a draw.",
    videoPlaceholder: true,
    emoji: '🥏',
  },
  {
    slug: 'golf',
    name: 'Golf',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Putt (2m)' },
      { level: 2, name: 'Putt (5m)' },
      { level: 3, name: 'Chip (10m)' },
      { level: 4, name: 'Game', scoring: 'sport', records: 'strokes' },
    ],
    howToPerform: "Play a round of golf on the course set out for the session. Tee off, play the ball as it lies, and hole out on each green. Count every stroke.",
    rules: "Play the holes set out by the kaiwhakawā from the marked tees. Every stroke counts, penalties as set on the day, and the ball is holed when it is in the cup (or hits the marked target). Lowest total strokes wins. In a game, fewer strokes than your opponent is a win and equal strokes is a draw.",
    videoPlaceholder: true,
    emoji: '⛳',
  },
  {
    slug: 'handball',
    name: 'Handball',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Partner Pass (2m)' },
      { level: 2, name: 'Partner Pass (5m)' },
      { level: 3, name: 'Past a Keeper', detail: 'Score with a keeper in goal' },
      { level: 4, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a game of handball against your opponent or opposing team. Pass and dribble by hand and throw to score past the goalkeeper, under the format set for the session.",
    rules: "Format and court are set by the kaiwhakawa and matched for all players. No travelling with the ball beyond the allowed steps. Log your result as a win, draw or loss with your opponent's name.",
    videoPlaceholder: true,
    emoji: '🤾',
  },
  {
    slug: 'table-tennis',
    name: 'Table Tennis',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Vertical Juggles', detail: 'Bounce the ball on the bat, standing' },
      { level: 2, name: 'Wall Juggles' },
      { level: 3, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "Play a table tennis match against your opponent, best of the number of games set on the day. Serve, rally and score to the target points per game.",
    rules: "Game and match format (points per game, best-of) set by the kaiwhakawa and matched for all players. Standard service and let rules apply. Log your result as a win or loss with your opponent's name.",
    videoPlaceholder: true,
    emoji: '🏓',
  },
  {
    slug: 'kubb',
    name: 'Kubb',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Throw Baton' },
      { level: 2, name: 'Hit Kubb (2m)' },
      { level: 3, name: 'Hit Kubb (5m)' },
      { level: 4, name: 'Hit Kubb (10m)' },
      { level: 5, name: 'Game', scoring: 'sport' },
    ],
    howToPerform: "From your baseline, throw batons underarm to knock over your opponent's field kubbs, then their baseline kubbs — and finally the king. Knock the king over early and you lose instantly.",
    rules: "Underarm, end-over-end baton throws only — no helicopter throws. Standard kubb sequence: field kubbs must fall before baseline kubbs, king last. Toppling the king before clearing everything else is an instant loss. Log your result as a win or loss.",
    videoPlaceholder: true,
    emoji: '🪵',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getEventBySlug(slug: string): EventData | undefined {
  return EVENTS.find(e => e.slug === slug)
}

export function getEventByName(name: string): EventData | undefined {
  return EVENTS.find(e => e.name === name)
}

// ─── difficulty+time encoding ────────────────────────────────────────────────
// raw_score is encoded as: tierIdx * DT_CAP + within-tier term (0-based tierIdx).
// Two semantics share this mode:
//   • HOLDS (longer wins)   → within-tier term = seconds            (more = better)
//   • TIMED EFFORTS (faster wins) → within-tier term = DT_CAP - seconds (faster = better)
// Either way a higher tier always outranks a lower one, and a higher raw_score is
// always better — so every ranker (client + SQL trigger) can sort raw_score DESC.
export const DT_CAP = 10000

// Events where finishing FASTER is better (timed efforts), not holding LONGER.
// Duck Walk joined July 2026 when its tiers became all-walk (holds removed).
export const TIMED_EFFORT_SLUGS = new Set<string>([
  'bronco', 'walking', 'burpee-broad-jump', 'rope-climb', 'repeat-high-jump',
  'duck-walk', 'backwards-walk',
])
// NOTE: 'walking', 'backwards-walk' and 'duck-walk' are retired events (removed
// from EVENTS by the Aug 2026 and Sept 2026 roster updates) but stay in this set
// on purpose — their historical raw_scores are inverted-encoded, so
// decodeDiffTime must keep reading them as timed efforts wherever old sessions
// are rendered.
//
// LEFT THE SET 5 Oct 2026, because they are no longer 'difficulty+time': the
// distance efforts (running, cycling, ski-erg, row-erg, scooting, animal-crawl)
// are 'distance+time', which is faster-wins by construction; the carries
// (sandbag-carry, farmer-carry, weighted-drag) are 'weight+distance+time'; and
// the raced contests (100m-sprint, 200m-sprint, t-race, tag, rats-and-rabbits,
// capture-the-flag, beach-flags, tug-of-war) are plain win/draw/loss. Their
// history was re-encoded by 20261005012108, so no stored row needs the
// inverted decode any more.
//
// 'climbing' was a BUG, fixed Sept 2026: the event's slug is 'rope-climb', so the
// entry matched nothing. isTimedEffort gates BOTH encode and decode, so Climbing's
// rows were written un-inverted and read back un-inverted — self-consistent, but
// ranked longest-wins on an event that is raced. Adding 'rope-climb' flips the
// decode, which is exactly why 20260908221459 re-encodes Climbing from
// time_seconds rather than leaving the old rows alone.
// Every entry here is asserted against the roster by a test in eventData.test.ts.
// NO APOSTROPHES in comments inside the set above: several scripts read it by
// pulling out quoted names, and a stray one misreads every slug after it.

export function isTimedEffort(slug?: string | null): boolean {
  return !!slug && TIMED_EFFORT_SLUGS.has(slug)
}

export function encodeDiffTime(tierIdx: number, secs: number, fasterWins: boolean): number {
  return tierIdx * DT_CAP + (fasterWins ? DT_CAP - secs : secs)
}

// ─── Open distance + time (5 Oct 2026) ──────────────────────────────────────
// Tāne: "what wins is the best effort — a 4 min kilometre is much harder than
// a 15 min three k." Every effort is converted to the time it predicts over the
// event's referenceMetres with Riegel, T2 = T1 × (D2/D1)^1.06, the same formula
// lib/naturalFormats.ts already uses for logged runs, and that time ranks.
//
// It only ever SHORTENS: an effort below the reference distance is refused,
// because extrapolating up would invent endurance nobody showed. There is no
// upper limit: from a long effort the formula predicts a conservative short
// time (a 3:30 marathon predicts a 4:00 km), so going long never games it.
//
// The SQL in the 5 Oct 2026 roster migration re-encodes history with the same
// formula and rounding (round half up on a positive number).
export const RIEGEL_EXPONENT = 1.06

/** Whole seconds an effort predicts over the reference, or null if it cannot be ranked. */
export function predictedEffortSecs(referenceMetres: number, metres: number, secs: number): number | null {
  if (!(referenceMetres > 0) || !(metres > 0) || !(secs > 0)) return null
  if (metres < referenceMetres) return null
  const p = metres === referenceMetres
    ? Math.round(secs)
    : Math.round(secs * Math.pow(referenceMetres / metres, RIEGEL_EXPONENT))
  return p >= 1 && p < DT_CAP ? p : null
}

export function decodeDiffTime(rawScore: number, fasterWins: boolean): { tierIdx: number; secs: number } {
  const tierIdx = Math.floor(rawScore / DT_CAP)
  const rem = rawScore % DT_CAP
  return { tierIdx, secs: fasterWins ? DT_CAP - rem : rem }
}

export function getEventsByDomain(): Record<string, EventData[]> {
  const map: Record<string, EventData[]> = {}
  for (const event of EVENTS) {
    if (!map[event.domain]) map[event.domain] = []
    map[event.domain].push(event)
  }
  return map
}

// ─── getBonusTargets ─────────────────────────────────────────────────────────
// Returns 3 effort-level bonus targets for a given event and season PR.
// seasonPR is always numeric raw_score from get_player_season_pr:
//   - strength      → best estimated 1RM (raw_score)
//   - time/sprint   → best raw_score (negative seconds; more negative = faster)
//   - distance      → best distance in metres
//   - difficulty+time  → tierIdx * 10000 + seconds  (0-based tierIdx)
//   - difficulty+reps  → tierIdx * 10000 + reps      (0-based tierIdx)
//   - sport         → null (targets always shown regardless)

function fmtSecs(totalSecs: number): string {
  const abs = Math.abs(totalSecs)
  const m = Math.floor(abs / 60)
  const s = Math.round(abs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function getBonusTargets(
  event: EventData,
  seasonPR: number | string | null
): BonusTarget[] {
  const mode = event.inputMode

  // Sport events: always show one repeatable target
  if (mode === 'sport') {
    return [{
      tier: 1 as const,
      label: 'Play a game vs a new opponent',
      detail: 'Each extra game vs any opponent = +1 effort level',
      points: 5 as const,
      inputMode: 'sport',
    }]
  }

  // Score events (Golf, Disc Golf): any additional 4-hole round counts
  if (mode === 'score') {
    return [{
      tier: 1 as const,
      label: 'Complete an additional 4 holes',
      detail: 'Any additional 4-hole round = +1 effort level',
      points: 5 as const,
      inputMode: 'score',
    }]
  }

  if (seasonPR === null) return []
  const rawScore = typeof seasonPR === 'number' ? seasonPR : parseFloat(String(seasonPR))
  if (isNaN(rawScore)) return []

  // Strength: 5 reps at 80% PR weight
  if (mode === 'strength') {
    if (rawScore <= 0) return []
    const kg = Math.round(rawScore * 0.8)
    return [{ tier: 1 as const, label: `${kg}kg × 5 reps`, detail: `5 reps at 80% of PR weight (${kg}kg)`, points: 5 as const, inputMode: 'strength' }]
  }

  // Sprint: qualify at 80% of PR pace (raw is negative centiseconds)
  if (mode === 'sprint') {
    const threshold = Math.round(rawScore / 0.8)
    const thresholdSecs = Math.abs(threshold) / 100
    const s = Math.floor(thresholdSecs)
    const cs = Math.round((thresholdSecs - s) * 100)
    const timeStr = `${s}.${cs.toString().padStart(2, '0')}s`
    return [{ tier: 1 as const, label: `Sprint in ${timeStr} or faster`, detail: `Each effort within 80% of PR pace`, points: 5 as const, inputMode: 'sprint' }]
  }

  // Time (Breath Hold etc.): hold for 80% of PR time
  if (mode === 'time') {
    if (rawScore <= 0) return []
    const targetSecs = Math.round(rawScore * 0.8)
    return [{ tier: 1 as const, label: `Hold for ${fmtSecs(targetSecs)} or longer`, detail: `Each effort at ≥80% of PR time`, points: 5 as const, inputMode: 'time' }]
  }

  // Distance: each attempt ≥80% of PR distance
  if (mode === 'distance') {
    if (rawScore <= 0) return []
    const targetCm = Math.round(rawScore * 0.8)
    const targetStr = targetCm >= 100 ? `${(targetCm / 100).toFixed(2)}m` : `${targetCm}cm`
    return [{ tier: 1 as const, label: `Throw/jump ≥ ${targetStr}`, detail: `Each attempt at ≥80% of PR distance`, points: 5 as const, inputMode: 'distance' }]
  }

  // difficulty+time
  if (mode === 'difficulty+time' && event.hasDifficultyTiers) {
    if (rawScore < 0) return []
    const tierIdx = Math.floor(rawScore / 10000)
    const prTimeSecs = rawScore % 10000
    const tiers = event.difficultyTiers ?? []
    const tierLevel = tierIdx + 1

    // Domain 6: race/endurance events — distance-scaled effort
    if (event.domainNumber === 6) {
      if (tierIdx === 0) {
        const tierName = tiers[0]?.name ?? 'D1'
        const targetSecs = Math.round(prTimeSecs * 1.2)
        return [{ tier: 1 as const, label: `Complete ${tierName} in ${fmtSecs(targetSecs)} or faster`, detail: `Same distance at 80% of PR pace`, points: 5 as const, inputMode: 'difficulty+time' }]
      } else {
        const belowName = tiers[tierIdx - 1]?.name ?? `D${tierIdx}`
        const targetSecs = Math.round(prTimeSecs * 0.6)
        return [{ tier: 1 as const, label: `Complete ${belowName} in ${fmtSecs(targetSecs)} or faster`, detail: `Half distance at 80% of PR pace`, points: 5 as const, inputMode: 'difficulty+time' }]
      }
    }

    // Non-D6: hold events — hold tier below for 2 minutes
    if (tierLevel > 1) {
      const belowName = tiers.find(t => t.level === tierLevel - 1)?.name ?? `D${tierLevel - 1}`
      return [{ tier: 1 as const, label: `Hold ${belowName} for 2 min`, detail: `Hold D${tierLevel - 1} tier for at least 2 minutes`, points: 5 as const, inputMode: 'difficulty+time' }]
    } else {
      const currentName = tiers.find(t => t.level === 1)?.name ?? 'D1'
      return [{ tier: 1 as const, label: `Hold ${currentName} for 2 min`, detail: `Hold D1 tier for at least 2 minutes`, points: 5 as const, inputMode: 'difficulty+time' }]
    }
  }

  // difficulty+distance: same implement, 80% of the PR throw
  if (mode === 'difficulty+distance' && event.hasDifficultyTiers) {
    const tiers = event.difficultyTiers ?? []
    const pr = typeof seasonPR === 'string' ? parseFloat(seasonPR) : seasonPR
    if (pr === null || !Number.isFinite(pr) || pr <= 0) return []
    const tierIdx = Math.floor(pr / 10000)
    const metres = (pr % 10000) / 10
    const target = Math.round(metres * 0.8 * 10) / 10
    if (target <= 0) return []
    const tierName = tiers[tierIdx]?.name ?? `D${tierIdx + 1}`
    return [{ tier: 1 as const, label: `Throw ${target}m or further with the ${tierName}`, detail: `80% of your PR throw at the same tier`, points: 5 as const, inputMode: 'difficulty+distance' }]
  }

  // difficulty+reps: one set at 80% PR reps, same tier
  if (mode === 'difficulty+reps' && event.hasDifficultyTiers) {
    if (rawScore <= 0) return []
    const tierIdx = Math.floor(rawScore / 10000)
    const tierLevel = tierIdx + 1
    const tiers = event.difficultyTiers ?? []
    const rung = tiers[tierIdx]
    const tierName = rung?.name ?? `D${tierLevel}`

    // The within-tier term is only a rep count on an ordinary rung. On a weight
    // rung it is centi-kilograms and on a Game rung it is a win/draw/loss code,
    // so reading it as reps produced "1600 reps at Weighted RTO Dip".
    if (rung?.scoring === 'sport') {
      return [{ tier: 1 as const, label: `Play ${tierName} against a new opponent`, detail: `Any result counts`, points: 5 as const, inputMode: 'sport' }]
    }
    if (rung?.scoring === 'weight') {
      const prKg = (rawScore % 10000) / 100
      if (prKg <= 0) return []
      const targetKg = Math.round(prKg * 0.8 * 10) / 10
      return [{ tier: 1 as const, label: `${targetKg}kg at ${tierName}`, detail: `80% of your PR load on the same rung`, points: 5 as const, inputMode: 'difficulty+reps' }]
    }

    const prReps = rawScore % 10000
    if (prReps <= 0) return []
    const targetReps = Math.max(1, Math.round(prReps * 0.8))
    return [{ tier: 1 as const, label: `${targetReps} reps at ${tierName}`, detail: `A qualifying set of ${targetReps} reps at D${tierLevel} (80% of PR)`, points: 5 as const, inputMode: 'difficulty+reps' }]
  }

  // weight+time: 80% of the PR load, held for 80% of the PR time.
  if (mode === 'weight+time') {
    const pr = typeof seasonPR === 'string' ? parseFloat(seasonPR) : seasonPR
    if (pr === null || !Number.isFinite(pr) || pr <= 0) return []
    const kg = Math.floor(pr / 10000) / 100
    const secs = pr % 10000
    if (secs <= 0) return []
    const targetKg = Math.round(kg * 0.8 * 10) / 10
    const targetSecs = Math.round(secs * 0.8)
    const load = targetKg > 0 ? `${targetKg}kg` : 'Bodyweight'
    return [{ tier: 1 as const, label: `Hold ${load} for ${fmtSecs(targetSecs)}`, detail: `80% of your PR load and time`, points: 5 as const, inputMode: 'weight+time' }]
  }

  return []
}

// Ordered domain list for consistent display
export const DOMAIN_ORDER = [
  'Maximal Strength',
  'Calisthenics',
  'Power',
  'Speed',
  'Stamina',
  'Endurance',
  'Flexibility',
  'Body Awareness',
  'Coordination',
  'Aim & Precision',
]
