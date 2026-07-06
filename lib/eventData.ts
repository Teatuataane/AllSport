// lib/eventData.ts — Single source of truth for all 100 AllSport events.

export type InputMode =
  | 'strength'
  | 'reps'
  | 'time'
  | 'hold'
  | 'difficulty+time'
  | 'difficulty+reps'
  | 'distance'
  | 'sport'
  | 'sprint'
  | 'score'

export type DifficultyTier = {
  level: number
  name: string
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
    rules: "Strict press only — no dip, bounce, or leg drive. Full lockout required at the top with a stable, motionless finish. Either arm allowed; the free hand may rest on your hip but not touch the working arm or the weight. Dumbbell or kettlebell allowed. Score is your heaviest successful press.",

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
    rules: 'Starting position must be a dead stop on the floor. Full lockout required at the top — hips and knees fully extended, standing tall. No hitching (using thighs as a ramp). Standard or sumo stance allowed. Any grip allowed. Belt and straps permitted.',
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
    rules: "The clean must reach the shoulders in one continuous motion. The press is strict — no dip, bounce, or leg drive after the bar leaves the shoulders. Full lockout at the top with head through and feet in line. Score is your heaviest successful clean and press.",

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
      { level: 1, name: 'Assisted Dips (2 Feet)' },
      { level: 2, name: 'Assisted Dips (1 Foot)' },
      { level: 3, name: 'Straight Bar Dips' },
      { level: 4, name: 'Rings Turned Out Dip' },
      { level: 5, name: 'Weighted RTO Dip' },
    ],
    howToPerform: "Choose your tier, then support yourself on the bars or rings. Lower under control until your shoulders sit below your elbows, hold a dead pause at the bottom, then press back to full lockout. Repeat for max reps.",
    rules: "One-second dead pause at the bottom of every rep — no bounce. Full elbow lockout at the top. Depth standard: shoulder below elbow. Declare your tier before starting; most reps at your tier wins, and a higher tier always outranks a lower one. D5 (Weighted RTO Dip) is scored by added weight instead of reps.",
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'pause-chin-up',
    name: 'Pause Chin Up',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Assisted Chins (2 Feet)' },
      { level: 2, name: 'Assisted Chins (1 Foot)' },
      { level: 3, name: 'Banded Chinup' },
      { level: 4, name: 'Chinup' },
      { level: 5, name: 'Weighted Chinup' },
    ],
    howToPerform: "Choose your tier and hang from the bar with an underhand grip, arms fully extended. Pull until your chin is clearly over the bar, lower under control to a dead hang, and pause before the next rep. Repeat for max reps.",
    rules: "One-second dead-hang pause at the bottom of every rep — no kipping or swinging. Chin clearly over the bar at the top. Declare your tier before starting; most reps at your tier wins, and a higher tier always outranks a lower one. D5 (Weighted Chinup) is scored by added weight instead of reps.",
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'pause-squat',
    name: 'Pause Squat',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Set the barbell across your upper back. Stand, brace, and squat down until your hip crease is below your knee. Hold a dead pause in the bottom, then drive up to a full stand without bouncing.",
    rules: "One-second dead pause at the bottom — no bounce out of the hole. Depth standard: hip crease below the top of the knee. Full lockout at the top, hips and knees extended. High-bar or low-bar allowed. Belt allowed. Score is your heaviest successful pause squat.",

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
    rules: "The bar starts at a dead stop on the floor and must be held in the crooks of the elbows — no hands under the bar. Full lockout at the top, hips and knees extended, standing tall. A bar pad or towel is permitted. Score is your heaviest successful lift.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'hamstring-curl',
    name: 'Ham Curl',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Glute Thrust' },
      { level: 2, name: 'Yoga Ball Glute Thrust' },
      { level: 3, name: 'Floor Slider Curl' },
      { level: 4, name: 'Banded Nordic Curl' },
      { level: 5, name: 'Nordic Curl' },
    ],
    howToPerform: "Choose your tier. Each variation works the hamstrings through hip extension or knee flexion — from glute thrusts up to the full Nordic curl. Move under control through the full range for your tier, keeping your hips extended and core braced. Repeat for max reps.",
    rules: "Declare your tier before starting. Full range of motion every rep — no half reps. Nordic curls: lower under control to the floor and pull back up with the hamstrings; hands may only assist at the tier that allows the band. Most reps at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'pause-bench',
    name: 'Pause Bench',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Lie on the bench with your feet flat on the floor and eyes under the bar. Unrack, lower the bar to your chest under control, hold a dead pause, then press to full lockout.",
    rules: "One-second visible pause with the bar motionless on the chest — no sinking or bouncing. Full lockout at the top. Butt stays on the bench and feet stay on the floor throughout. Any grip width. Score is your heaviest successful pause bench.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'turkish-get-up',
    name: 'Turkish Get Up',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Lie on your back with a kettlebell or dumbbell locked out above one shoulder. Keeping the weight locked out and your eyes on it, work through the sequence — roll to the elbow, to the hand, sweep the leg, lunge — until you are standing tall with the weight overhead.",
    rules: "The arm stays locked out and the weight under control for the entire movement — a bent elbow or dropped weight is a failed attempt. Finish standing fully upright, feet together or in a stable stance. Either arm allowed. Score is your heaviest completed get-up.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'sandbag-to-shoulder',
    name: 'Sandbag to Shoulder',
    domain: 'Maximal Strength',
    domainNumber: 1,
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
    rules: 'Bar must be set to the individual player\'s shoulder height. The sandbag must fully clear the bar and land on the other side to count as a rep. Player retrieves the bag from the other side for each subsequent rep. Any lifting technique permitted.',
    videoPlaceholder: true,
    emoji: '💼',
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
    name: 'Flag',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Side Plank' },
      { level: 2, name: 'Side Plank' },
      { level: 3, name: '1 Leg Side Plank' },
      { level: 4, name: 'Partial Flag' },
      { level: 5, name: 'Tuck Flag' },
      { level: 6, name: 'Human Flag' },
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
      { level: 3, name: 'Hanging Wiper Circles' },
      { level: 4, name: 'Windshield Wipers' },
    ],
    howToPerform: "Hang from a pull-up bar and raise your legs to vertical (or set up on the floor for the lower tiers). Keeping your legs together, sweep them side to side in a controlled arc like a windshield wiper. Repeat for max reps.",
    rules: "Declare your tier before starting. One rep = a full sweep from one side to the other, under control, legs together. No swinging or using momentum. Most reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🌀',
  },
  {
    slug: 'toe-lift',
    name: 'Toe Lift',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Stand tall with your heels planted and the resistance set across your forefoot. Keeping your legs straight and heels glued to the floor, lift your toes and forefoot as high as you can toward your shins, then lower under control.",
    rules: "Heels stay on the floor for the whole rep — no rocking back. Full range: toes as high as possible at the top, controlled lower. Score is the heaviest successful lift.",

    videoPlaceholder: true,
    emoji: '🦶',
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
      { level: 2, name: 'Elevated Pseudo Planche Lean' },
      { level: 3, name: 'Tuck Planche' },
      { level: 4, name: 'Banded Planche' },
      { level: 5, name: 'Straddle Planche' },
      { level: 6, name: 'Full Planche' },
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
      { level: 6, name: 'Straddle Back Lever' },
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
      { level: 1, name: 'Assisted Iron Cross (2 Feet)' },
      { level: 2, name: 'Assisted Iron Cross (1 Foot)' },
      { level: 3, name: 'Ring Top Position Hold' },
      { level: 4, name: 'Banded Iron Cross' },
      { level: 5, name: 'Partial Iron Cross' },
      { level: 6, name: 'Iron Cross' },
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
      { level: 4, name: 'Tuck Front Lever' },
      { level: 5, name: 'Banded Front Lever' },
      { level: 6, name: '1 Leg Front Lever' },
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
      { level: 1, name: 'Assisted Chin Hang (2 Feet)' },
      { level: 2, name: 'Assisted Chin Hang (1 Foot)' },
      { level: 3, name: 'Two-Hand Chin Hang' },
      { level: 4, name: 'One-Hand Chin Hang' },
      { level: 5, name: 'Band-Assisted Chin Hang' },
      { level: 6, name: 'Hands-Free Chin Hang' },
    ],
    howToPerform: "Pull to the top of a chin-up and hold with your chin over the bar, using the grip or assistance your tier allows. Stay tight and keep breathing. Hold as long as you can.",
    rules: "Declare your tier before starting. Chin clearly over the bar for the whole hold — the timer stops when your eyes drop below it. No resting your chin on the bar. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🧗',
  },
  {
    slug: 'rope-climb',
    name: 'Climbing',
    domain: 'Calisthenics',
    domainNumber: 2,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Leaning Rope Hold' },
      { level: 2, name: 'Foot-Assisted Rope Hang' },
      { level: 3, name: 'No Feet Rope Hang' },
      { level: 4, name: 'Foot-Assisted Rope Climb' },
      { level: 5, name: 'No Feet Rope Climb' },
      { level: 6, name: 'L-Sit Rope Climb' },
      { level: 7, name: 'Pegboard (feet allowed)' },
      { level: 8, name: 'Pegboard (no feet)' },
    ],
    howToPerform: "Choose your tier: the lower tiers are rope holds and hangs, the upper tiers are climbs of the rope or pegboard, with or without feet. For climbs, start standing with both hands on the rope, climb to touch the marked top, then descend under control.",
    rules: "Declare your tier before starting. Rope and pegboard height is set and marked by the kaiwhakawā and must be the same for all players. Climbs are timed from the start signal to the top touch — fastest wins within a tier. No jumping start. Descend under control; sliding burns count as a safety fault. A higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🪢',
  },

  // ─── Domain 5: Anaerobic Endurance ───────────────────────────────────────────
  {
    slug: 'chin-up-contest',
    name: 'Chinup Contest',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Ring Row' },
      { level: 2, name: 'Elevated Ring Row' },
      { level: 3, name: 'Banded Chinup' },
      { level: 4, name: 'Chin Up' },
    ],
    howToPerform: 'Start from a dead hang with palms facing you (supinated grip), hands shoulder-width apart. Pull your chin above the bar on every rep. Return to full dead hang between reps. Count total reps completed without stopping.',
    rules: 'Palms facing toward you (supinated grip). Full dead hang at the bottom of each rep — elbows fully extended. Chin must clear the bar on every rep. Kipping not allowed. No momentum from legs. Score is total reps completed in one continuous set.',
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'push-up-contest',
    name: 'Pushup Contest',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Knee Push Up' },
      { level: 2, name: 'Knee Push Up' },
      { level: 3, name: 'Push Up' },
      { level: 4, name: '1 Arm Pushup' },
    ],
    howToPerform: "Choose your tier and set up in the push-up position for it. Lower until your chest reaches the floor, then press back to full lockout with your body in one straight line. Repeat for max reps without resting on the floor.",
    rules: "Declare your tier before starting. Chest touches the floor every rep; full elbow lockout at the top; hips stay in line — no sagging or piking. Resting is allowed in the top position only. Most reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'reverse-hyper',
    name: 'Reverse Hyper',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Superman Hold' },
      { level: 2, name: 'Back Extension Hold' },
      { level: 3, name: 'Reverse Hyper Hold (Hips off)' },
      { level: 4, name: 'Reverse Hyper Hold (Only Chest Touching)' },
    ],
    howToPerform: "Choose your tier and set up face down — on the floor for the superman, or on a bench or GHD for the extension and reverse hyper holds. Lift into the hold position for your tier, squeezing your glutes and lower back, and hold as long as you can.",
    rules: "Declare your tier before starting. Timer starts when the position is set and stops when any part of it drops. For reverse hyper holds, only the stated body contact is allowed (hips off, or chest only). Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🔄',
  },
  {
    slug: 'l-sit-hold',
    name: 'L-Sit Hold',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Support Hold (legs bent, feet touching floor)' },
      { level: 2, name: 'Support Hold (legs straight, 1 foot touching floor)' },
      { level: 3, name: 'Tuck Hold (both knees to chest)' },
      { level: 4, name: 'Tucked L-Sit (one leg extended)' },
      { level: 5, name: 'Half L-Sit (legs angled, not fully horizontal)' },
      { level: 6, name: 'Full L-Sit (legs fully horizontal, Knees locked)' },
      { level: 7, name: 'V-Sit (Thighs Touching Chest, Knees locked)' },
    ],
    howToPerform: "Support yourself on parallettes, a bench, or the floor with straight arms, and lift your legs into the position for your tier — from a bent-leg support hold up to the full L-sit or V-sit. Hold as long as you can.",
    rules: "Declare your tier before starting. Timer starts when the position is set and stops when the legs or hips drop below the tier standard. Knees locked where the tier states it. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🪑',
  },
  {
    slug: 'tibialis-curl',
    name: 'Tibialis Curl',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Sit or stand with your heels planted and the weight loaded over your forefoot (tib bar or plate). Keeping your legs straight and heels down, pull your toes up toward your shins as high as possible, then lower under control.",
    rules: "Heels stay planted throughout. Full range every rep — toes fully lifted at the top, controlled on the way down. Score is the heaviest weight lifted with good form.",

    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'headstand',
    name: 'Headstand',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Feet-Supported Tripod' },
      { level: 2, name: 'Tripod Headstand' },
      { level: 3, name: 'Forearm Headstand' },
      { level: 4, name: 'Wall Headstand (No hands, wall support)' },
      { level: 5, name: 'Freestanding Headstand' },
    ],
    howToPerform: "Choose your tier and set your base — head and hands in a stable tripod, or forearms for that tier. Walk your feet in, lift into the headstand for your tier, and hold as long as you can. Come down under control.",
    rules: "Declare your tier before starting. Timer starts when your feet are up in the declared position and stops when they come down or the wall/support rules for your tier are broken. Use a mat. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🙃',
  },
  {
    slug: 'finger-push-up',
    name: 'Finger Push Up',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Knee Finger Pushup' },
      { level: 2, name: 'Knee Finger Pushup' },
      { level: 3, name: 'Finger Pushup' },
      { level: 4, name: '4 Finger Pushup' },
      { level: 5, name: '3 Finger Pushup' },
      { level: 6, name: '2 Finger Pushup' },
      { level: 7, name: 'Thumb Pushup' },
    ],
    howToPerform: "Choose your tier and set up in a push-up position on your fingertips — the tiers reduce the number of fingers as they climb. Lower until your chest reaches the floor, then press back to full lockout. Repeat for max reps.",
    rules: "Declare your tier before starting. Fingertips only — palms never touch the floor. Chest to floor and full lockout every rep, body in one straight line. Only the fingers your tier allows. Most reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '👆',
  },
  {
    slug: 'ghd-situp',
    name: 'GHD Situp',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Dead Bug' },
      { level: 2, name: 'Crunch' },
      { level: 3, name: 'Sit Up' },
      { level: 4, name: 'GHD Situp' },
    ],
    howToPerform: "Choose your tier — from dead bugs and crunches up to the full GHD sit-up. Move through the full range for your tier under control, touching the stated points at top and bottom. Repeat for max reps.",
    rules: "Declare your tier before starting. Full range every rep to your tier's standard. Most reps at your tier wins; a higher tier always outranks a lower one. D4 (GHD Situp) is scored by added weight instead of reps.",

    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'leg-extension',
    name: 'Leg Extension',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Sit in the leg extension machine with the pad on your shins and your knees in line with the pivot. Extend both legs until your knees are fully locked, hold for a beat, then lower under control.",
    rules: "Full lockout at the top of every rep — partial extensions do not count. Controlled lowering; no kicking or bouncing the stack. Hips stay on the seat. Score is the heaviest weight lifted with good form.",

    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'ab-wheel-rollout',
    name: 'Ab Rollout',
    domain: 'Anaerobic Endurance',
    domainNumber: 5,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Kneeling Elevated Hold' },
      { level: 2, name: 'Kneeling Ab Rollout' },
      { level: 3, name: 'Elevated Kneeling Ab Rollout' },
      { level: 4, name: 'Banded Ab Rollout' },
      { level: 5, name: 'Ab Rollout' },
    ],
    howToPerform: "Choose your tier and kneel (or stand, at the top tiers) with your hands on the ab wheel. Brace hard and roll the wheel out as far as your tier requires — to full extension for the top tiers — then pull back to the start without breaking your line.",
    rules: "Declare your tier before starting. Hips stay in line throughout — no sagging or piking, and the body never touches the floor mid-rep. Full extension and full return each rep. Most reps at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '⚙️',
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
      { level: 1, name: 'Towel-Assisted (hands hold opposite ends of towel)' },
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
      { level: 1, name: 'Elevated Seated Forward Fold' },
      { level: 2, name: 'Standing Forward Fold' },
      { level: 3, name: 'Standing Forward Fold (knees bent)' },
      { level: 4, name: 'Standing Forward Fold (straight legs)' },
      { level: 5, name: 'Standing Forward Fold (finger-tips to floor)' },
      { level: 6, name: 'Standing Forward Fold (palms to floor)' },
      { level: 7, name: 'Standing Forward Fold (elbow to toes)' },
      { level: 8, name: 'Full Forward Fold (head to legs)' },
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
      { level: 1, name: 'Standing Leg Lift (below hip)' },
      { level: 2, name: 'Standing Leg Lift (at hip height / horizontal)' },
      { level: 3, name: 'Standing Scale (slightly above hip)' },
      { level: 4, name: 'Standing Scale (at hip, leg fully extended)' },
      { level: 5, name: 'Standing Scale (high, above head level)' },
      { level: 6, name: 'Needle Pose (leg to head)' },
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
      { level: 1, name: 'Assisted Front Split (2 Blocks)' },
      { level: 2, name: 'Assisted Front Split (1.5 Blocks)' },
      { level: 3, name: 'Assisted Front Split (1 Block)' },
      { level: 4, name: 'Assisted Front Split (0.5 Blocks)' },
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
      { level: 1, name: 'Assisted Middle Split (2 Blocks)' },
      { level: 2, name: 'Assisted Middle Split (1.5 Blocks)' },
      { level: 3, name: 'Assisted Middle Split (1.25 Blocks)' },
      { level: 4, name: 'Assisted Middle Split (1 Block)' },
      { level: 5, name: 'Assisted Middle Split (0.75 Blocks)' },
      { level: 6, name: 'Assisted Middle Split (0.5 Blocks)' },
      { level: 7, name: 'Middle Split' },
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
      { level: 1, name: 'Standing Leg Lift (Ankle height)' },
      { level: 2, name: 'Standing Leg Lift (Knee height)' },
      { level: 3, name: 'Standing Leg Lift (Hip height)' },
      { level: 4, name: 'Standing Split (Hip height, knee locked)' },
      { level: 5, name: 'Standing Split (Above hip height, hand assisted, knee locked)' },
      { level: 6, name: 'Standing Split (Above hip height, knee locked)' },
      { level: 7, name: 'Standing Split (Head height, hand assisted)' },
      { level: 8, name: 'Standing Split (Head height, no hand assistance)' },
    ],
    howToPerform: "Standing on one leg, raise the other leg in front or to the side to the height your tier requires — ankle, knee, hip, or all the way to head height — with hand assistance only where your tier allows. Lock the knee where stated and hold.",
    rules: "Declare your tier before starting. The lifted leg holds the stated height with the knee locked where required; hand assistance only at the tiers that allow it. Timer starts when the position is set and stops when the leg drops. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'foot-behind-head',
    name: 'Foot Behind Head',
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
    ],
    howToPerform: "Sit tall and work your leg up your body according to your tier — from assisted pigeon pose through to foot behind the head. Move in slowly, keep your spine as tall as you can, and hold the position.",
    rules: "Declare your tier before starting. The timer starts when the declared position is reached and stops when the leg slips or the position breaks. No forcing the leg with jerky movements. Either leg. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🦶',
  },
  {
    slug: 'shoulder-dislocate',
    name: 'Shoulder Dislocate',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: 'Hold a stick or dowel with both hands at a wide grip. With straight arms, rotate the stick over your head and behind your back, then return to the front. Measure the grip width in centimetres between your index fingers. Perform as many reps as possible at your narrowest comfortable width.',
    rules: 'Arms must remain straight throughout the full rotation. Grip width is measured between index fingers in centimetres. Narrower grip = higher score. Record total reps completed at your measured grip width. Stick, dowel, resistance band, or rope all permitted.',
    videoPlaceholder: true,
    emoji: '🌀',
  },
  {
    slug: 'pancake',
    name: 'Pancake',
    domain: 'Flexibility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Pancake (More than 2 blocks)' },
      { level: 2, name: 'Elevated Pancake (2 blocks)' },
      { level: 3, name: 'Elevated Pancake (1.5 blocks)' },
      { level: 4, name: 'Elevated Pancake (1 block)' },
      { level: 5, name: 'Elevated Pancake (0.5 blocks)' },
      { level: 6, name: 'Pancake (hands to floor)' },
      { level: 7, name: 'Pancake (head to floor)' },
    ],
    howToPerform: "Sit with your legs wide and fold your torso forward between them, resting at the block height your tier allows — down to hands, then head, on the floor for the top tiers. Keep your back long and legs straight. Hold.",
    rules: "Declare your tier before starting. Legs straight and knees pointing up; torso resting at the stated depth. Timer starts when the position is set and stops when it lifts. No bouncing. Longest hold at your tier wins; a higher tier always outranks a lower one.",

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
    rules: "One continuous motion from floor to overhead lockout — no pressing out from the shoulder. Finish standing tall with the arm locked and the weight stable. Either arm allowed. Score is your heaviest successful snatch.",

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
    rules: "Floor to overhead in one continuous motion — a pause at the shoulder or a press-out is a failed attempt. Full lockout with the weight under control to finish. Either arm allowed. Score is your heaviest successful snatch.",

    videoPlaceholder: true,
    emoji: '💥',
  },
  {
    slug: 'triple-jump',
    name: 'Triple Jump',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: "From the take-off line, perform the hop, step, and jump sequence: land the hop on your take-off foot, the step on the other foot, then jump and land with both feet in the pit or landing zone. Run-up allowed.",
    rules: "The sequence must be hop (same foot), step (other foot), jump. Take off behind the line — crossing it is a foul. Distance is measured from the take-off line to the closest mark made on landing. Best attempt scores; three attempts make one effort task.",

    videoPlaceholder: true,
    emoji: '🦘',
  },
  {
    slug: 'javelin-throw',
    name: 'Javelin',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: "Grip the javelin at the cord, draw it back over your shoulder, and throw it one-handed with an over-shoulder action after a short run-up. Follow through without crossing the throwing line.",
    rules: "One-handed over-the-shoulder throw only — no slinging or spinning. Release behind the line; crossing it is a foul. The javelin must land within the marked sector. Distance measured from the line to the first point of contact. Best attempt scores.",

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
    rules: "The shot must be putt from the neck with one hand — no throwing from behind the shoulder line. Release from behind the line and stay behind it until the shot lands. Distance measured from the line to first contact. Best attempt scores.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'australian-football',
    name: 'Australian Football',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short-format game built on Australian Football skills — kicking, marking, and handballing. The kaiwhakawā sets the format on the day to suit numbers and space (kick-to-kick marking contests, or a small-sided game).",
    rules: "Format and scoring set by the kaiwhakawā before play and kept the same for all matches. Log your result as a win, draw, or loss with your opponent's name. Every extra match against a new opponent earns effort points.",

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
    // slug stays 'hand-walk' so historical results remain linked
    slug: 'hand-walk',
    name: 'Handbalance',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Pushup Hold' },
      { level: 2, name: 'Elevated Pushup Hold' },
      { level: 3, name: 'Wall Handstand' },
      { level: 4, name: 'Freestanding Handstand' },
    ],
    howToPerform: "Choose your tier and set the hold: push-up hold, elevated push-up hold, wall handstand, or freestanding handstand. Lock your arms, squeeze your body tight, and hold the position as long as you can.",
    rules: "Declare your tier before starting. Timer starts when the position is set and stops when it breaks — for handstands, when your feet return to the floor or you walk more than a step out of position. Arms straight throughout. Longest hold at your tier wins; a higher tier always outranks a lower one.",

    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'clean-and-jerk',
    name: 'Clean & Jerk',
    domain: 'Power',
    domainNumber: 3,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: "Clean the barbell from the floor to your shoulders, standing tall in the front rack. Then dip and drive, jerking the bar overhead and catching it with locked arms — split or power jerk both allowed. Recover to standing with the bar overhead.",
    rules: "Two parts: a clean to the shoulders, then a jerk to full overhead lockout. Press-outs are failed attempts. Finish standing tall, feet in line, bar stable overhead. Score is your heaviest successful clean and jerk.",

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
    rules: "Floor to overhead in one continuous motion. No press-out — arms must lock as the bar is received. Finish standing tall with the bar stable overhead. Score is your heaviest successful snatch.",

    videoPlaceholder: true,
    emoji: '🏋️',
  },

  // ─── Domain 6: Aerobic Endurance ─────────────────────────────────────────────
  {
    slug: 'burpee-broad-jump',
    name: 'Burpee Broad Jump',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '25m' },
      { level: 2, name: '50m' },
      { level: 3, name: '100m' },
    ],
    howToPerform: "Choose your distance tier. Perform a burpee — chest to the floor, back to your feet — then a two-foot broad jump forward. Repeat the burpee-jump sequence down the course until you cover the full distance.",
    rules: "Declare your tier (25m, 50m, or 100m) before starting. Every rep is a full burpee (chest touches the floor) followed by a two-foot broad jump — no running or walking forward. Timed from start signal to crossing the line. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '💨',
  },
  {
    slug: 'running',
    name: 'Running',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '250m' },
      { level: 2, name: '500m' },
      { level: 3, name: '1000m' },
    ],
    howToPerform: "Choose your distance tier — 250m, 500m, or 1000m — and run it as fast as you can on the marked course. Pace yourself to finish strong.",
    rules: "Declare your tier before starting. Timed from the start signal to crossing the finish line on the measured course. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: 'cycling',
    name: 'Cycling',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '250m' },
      { level: 2, name: '500m' },
      { level: 3, name: '1000m' },
    ],
    howToPerform: "Choose your distance tier — 250m, 500m, or 1000m — and ride it as fast as you can, on the bike erg or marked course set up on the day.",
    rules: "Declare your tier before starting. Timed from a stationary start to the full distance. Same bike setup available to all players; seat height adjustment allowed. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🚴',
  },
  {
    slug: 'ski-erg',
    name: 'Ski Erg',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '250m' },
      { level: 2, name: '500m' },
      { level: 3, name: '1000m' },
    ],
    howToPerform: "Choose your distance tier — 250m, 500m, or 1000m. Set the monitor, then drive the handles down with your whole body, hinging hard at the hips and finishing each pull past your thighs. Find a rhythm and empty the tank.",
    rules: "Declare your tier before starting. Time is read from the erg monitor for the full distance from a dead start. Any damper setting. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '⛷️',
  },
  {
    slug: 'row-erg',
    name: 'Row Erg',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '250m' },
      { level: 2, name: '500m' },
      { level: 3, name: '1000m' },
    ],
    howToPerform: "Choose your distance tier — 250m, 500m, or 1000m. Strap in, and row with the sequence legs-body-arms on the drive, arms-body-legs on the recovery. Keep the handle moving and drive hard through the finish.",
    rules: "Declare your tier before starting. Time is read from the erg monitor for the full distance from a dead start. Any damper setting. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🚣',
  },
  {
    slug: 'breath-hold',
    name: 'Breath Hold',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: "Sit or lie down somewhere stable. Take a few calm breaths, then one full breath in, and hold. Relax everything — stillness buys you seconds. The attempt ends the moment you breathe out or in.",
    rules: "Performed seated or lying down, on land, with the kaiwhakawā or a partner watching — never alone and never in water. No hyperventilating before the attempt. Timer runs from the final inhale to the first breath out. Stop immediately if you feel dizzy. Longest hold wins.",
    videoPlaceholder: true,
    emoji: '🫁',
  },
  {
    slug: 'weighted-carry',
    name: 'Weighted Carry',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '5kg — 200m' },
      { level: 2, name: '10kg — 200m' },
      { level: 3, name: '25kg — 200m' },
      { level: 4, name: '50kg — 200m' },
      { level: 5, name: '80kg — 200m' },
      { level: 6, name: '100kg — 200m' },
    ],
    howToPerform: "Choose your weight tier, pick up the load, and carry it 200 metres as fast as you can. Any safe carry style — farmer, front, shoulder, or bear hug. You may set it down to regrip; the clock keeps running.",
    rules: "Declare your weight tier before starting; the distance is always 200m. Timed from the start signal to crossing the line with the full load. Setting the weight down is allowed but the clock never stops. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '📦',
  },
  {
    slug: 'duck-walk',
    name: 'Duck Walk',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Squat Hold' },
      { level: 2, name: 'OH Squat Hold' },
      { level: 3, name: '25m Duck Walk' },
      { level: 4, name: '50m Duck Walk' },
      { level: 5, name: '100m Duck Walk' },
    ],
    howToPerform: "Choose your tier. The first two tiers are holds — a deep squat hold, then an overhead squat hold. The walking tiers cover 25m, 50m, or 100m in a deep squat, hips below knees, stepping forward without standing up.",
    rules: "Declare your tier before starting. Holds: timer runs while the position is held, hips below knees. Walks: stay below parallel the whole way — standing up stops the clock until you are back in position. A higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🦆',
  },
  {
    slug: 'bronco',
    name: 'Bronco',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '1 Lap' },
      { level: 2, name: '3 Laps' },
      { level: 3, name: '5 Laps' },
    ],
    howToPerform: "Choose your lap tier. One lap is the rugby bronco shuttle: run 20m and back, 40m and back, then 60m and back, touching each line. Complete your tier's laps as fast as you can.",
    rules: "Declare your tier (1, 3, or 5 laps) before starting. Touch every line with your foot on each shuttle — a missed line means returning to it. Timed from the start signal to the final line. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: 'walking',
    name: 'Walking',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: '250m' },
      { level: 2, name: '500m' },
      { level: 3, name: '1000m' },
    ],
    howToPerform: "Choose your distance tier — 250m, 500m, or 1000m — and walk it as fast as you can. Drive with your arms and take quick, full strides.",
    rules: "Declare your tier before starting. Walking only: one foot in contact with the ground at all times — visible running or jumping means a warning, then disqualification of the attempt. Timed over the measured course. Fastest time at your tier wins; a higher tier always outranks a lower one.",
    videoPlaceholder: true,
    emoji: '🚶',
  },

  // ─── Domain 4: Speed ────────────────────────────────────────────────────────────
  {
    slug: '100m-sprint',
    name: '100m Sprint',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: 'Sprint 100 metres from a standing start on a measured straight course. React to the judge\'s signal to start. Sprint at full speed to the finish line. Timer is recorded in seconds and centiseconds.',
    rules: 'Distance must be exactly 100 metres on a measured course. Standing start — no blocks required. Timer starts on the judge\'s signal, stops when you cross the finish line. Must stay in your lane. Time recorded as seconds + centiseconds (e.g. 12.34).',
    videoPlaceholder: true,
    emoji: '💨',
  },
  {
    slug: 'tag',
    name: 'Tag',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "One-on-one tag duel inside a marked grid. One player chases, one evades, for a set time — then roles swap. Use fakes, cuts, and acceleration to win your role.",
    rules: "Grid size, round length, and rounds per match are set by the kaiwhakawā and kept the same for all matches. Tags must be a clear touch — no pushing or grabbing. Log your result as a win, draw, or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏷️',
  },
  {
    slug: 't-race',
    name: 'T-Race',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Two identical T-shaped cone courses are set side by side. On the signal, sprint forward to the top of the T, shuffle side to side across it, and backpedal home. First player back wins the race.",
    rules: "Run head-to-head on matching courses. Touch each cone as set by the kaiwhakawā; a missed cone means going back to it. No crossing into the other lane. Log your result as a win or loss with your opponent's name. Extra races vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '⚡',
  },
  {
    slug: '400m-race',
    name: '400m Race',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: "Race 400 metres on the marked course — one full lap of a standard track. Go out fast, hold your form down the back straight, and empty the tank over the final 100.",
    rules: "Standing start. Timed from the start signal to the finish line in seconds and centiseconds. Stay in your lane where lanes are marked. Fastest time wins.",

    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: 'beach-flags',
    name: 'Beach Flags',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Players lie face down in a line, feet toward the flags, hands stacked under the chin. On the signal, spring up, turn, and sprint to grab a flag — there is always one fewer flag than players.",
    rules: "Start prone, facing away, motionless until the signal. False starts restart the heat; a second false start eliminates. No holding or blocking other players — grab the flag cleanly. Win your duel or heat to progress. Log each duel as a win or loss with your opponent's name.",

    videoPlaceholder: true,
    emoji: '🚩',
  },
  {
    slug: '50m-sprint',
    name: '50m Sprint',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: "Sprint 50 metres flat out on the marked course. Explode off the start, build to top speed, and run all the way through the line.",
    rules: "Standing start, no blocks. Timed from the start signal to the chest crossing the line, in seconds and centiseconds. Fastest time wins.",

    videoPlaceholder: true,
    emoji: '⚡',
  },
  {
    slug: '200m-sprint',
    name: '200m Sprint',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: "Sprint 200 metres on the marked course. Attack the first half, then hold your form and keep your turnover high all the way through the line.",
    rules: "Standing start, no blocks. Timed from the start signal to the chest crossing the line, in seconds and centiseconds. Stay in your lane where lanes are marked. Fastest time wins.",

    videoPlaceholder: true,
    emoji: '💨',
  },
  {
    slug: 'touch-rugby',
    name: 'Touch Rugby',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short-format game of touch rugby. Move the ball with passes, run into space, and make touches on defence — a touch counts as a tackle and play restarts with a rollball.",
    rules: "Format (team size, touches per set, game length) is set by the kaiwhakawā and kept the same for all matches. Standard touch rules: six touches, no kicking, forward passes are turnovers. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏉',
  },
  {
    slug: 'football-dribble',
    name: 'Football Dribble',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: "Dribble a football through the marked cone course as fast as you can, keeping the ball under close control through every gate, and finish over the line with the ball.",
    rules: "The ball must pass through every gate under control — a missed gate means going back through it. Knocking over a cone adds a re-take of that gate. Timed from the start signal to crossing the finish line with the ball. Fastest time wins.",

    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'repeat-high-jump',
    name: 'Repeat High Jump',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Ankle height' },
      { level: 2, name: 'Knee height' },
      { level: 3, name: 'Hip height' },
      { level: 4, name: 'Shoulder height' },
    ],
    howToPerform: "Choose your bar height tier — ankle, knee, hip, or shoulder height. On the signal, complete the set number of two-foot jumps over the bar, rebounding side to side, as fast as you can.",
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
    rules: 'Players stand back to back in the centre. Judge calls "Rats!" or "Rabbits!" — named team chases, other team runs to their safe zone. A point is scored if the chaser tags the runner before they reach the safe zone. First to 3 points wins (must win by 2). Record as a win or loss. Match must be witnessed by the judge.',
    videoPlaceholder: true,
    emoji: '🐀',
  },
  {
    slug: 'speed-chess',
    name: 'Speed Chess',
    domain: 'Speed',
    domainNumber: 4,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: 'Play a game of chess against your opponent using only half the pieces (remove one side\'s pieces as agreed before the match). Each player has 3 minutes on the clock. Move fast — if your clock runs out, you lose.',
    rules: 'Half pieces only — remove one colour\'s pieces symmetrically as agreed before the match. Each player has 3 minutes. Standard chess rules apply. Losing on time counts as a loss. Checkmate or resignation also ends the game. Trial format — time control and piece count subject to change after trialling. Record as win, draw, or loss.',
    videoPlaceholder: true,
    emoji: '♟️',
  },

  // ─── Domain 8: Body Awareness ─────────────────────────────────────────────────
  {
    slug: 'tae-kwon-do',
    name: 'Tae Kwon Do',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Spar a light-contact, points-based taekwondo match. Score with controlled kicks and punches to the scoring zones — head contact only where protective gear and both players' experience allow.",
    rules: "Light contact only — control is the standard, and the kaiwhakawā stops the match at any excessive contact. Round length and scoring zones set on the day. Protective gear worn where available. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

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
      { level: 1, name: 'Indian Step' },
      { level: 2, name: 'Salsa Step' },
      { level: 3, name: '6 Step' },
      { level: 4, name: '3 Step' },
      { level: 5, name: 'Baby Freeze' },
      { level: 6, name: 'Pilot Freeze' },
      { level: 7, name: 'Windmill' },
    ],
    howToPerform: "Choose your tier — footwork steps at the lower tiers, freezes and the windmill at the top. Perform your tier's move continuously (steps and windmills) or hold it (freezes) for as long as you can, staying clean and in control.",
    rules: "Declare your tier before starting. Timer runs while the move is performed or held to a recognisable standard — a stumble, extra support, or loss of the pattern stops the clock. Longest time at your tier wins; a higher tier always outranks a lower one.",

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
      { level: 2, name: '180 Spin' },
      { level: 3, name: '360 Spin' },
      { level: 4, name: 'Forward Flip' },
      { level: 5, name: 'Back Flip' },
      { level: 6, name: 'Front Flip 180' },
    ],
    howToPerform: "Choose your tier, from basic bounces to spins and flips. Perform your tier's skill on the trampoline for consecutive clean reps — land balanced in the centre and go straight into the next rep.",
    rules: "Declare your tier before starting. A rep counts when the skill is completed and landed under control on the feet. The set ends when you stop, land off-balance, or break the sequence. Flips only with kaiwhakawā approval and supervision. Most consecutive reps at your tier wins; a higher tier always outranks a lower one.",

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
      { level: 2, name: 'Alternating Single-Foot Jump' },
      { level: 3, name: 'Criss-Cross' },
      { level: 4, name: 'Double Under' },
      { level: 5, name: 'Crossover Double Under' },
    ],
    howToPerform: "Choose your tier — from basic two-foot jumps up to crossover double unders. Skip continuously, counting every successful rep of your tier's skill, until you trip or stop.",
    rules: "Declare your tier before starting. Only clean reps of the tier skill count. The set ends when the rope stops or catches. Most consecutive reps at your tier wins; a higher tier always outranks a lower one.",

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
    rules: "Match length and scoring set by the kaiwhakawā. No strikes, no submissions, no slams — takedowns must be controlled to the mat. Log your result as a win, draw, or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

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
      { level: 4, name: 'Roundoff' },
      { level: 5, name: 'Handspring (front or back)' },
      { level: 6, name: 'One-Hand Cartwheel' },
      { level: 7, name: 'Front Handspring' },
      { level: 8, name: 'Back Handspring' },
    ],
    howToPerform: "Choose your tier, from forward rolls up to back handsprings. Perform your tier's skill for clean, consecutive reps on the mats — finish each rep in control before starting the next.",
    rules: "Declare your tier before starting. A rep counts when the skill is completed to a clean standard and finished under control. Mats required; handsprings only with kaiwhakawā approval. Most reps at your tier wins; a higher tier always outranks a lower one.",

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
      { level: 3, name: 'Kneeling (no hands)' },
      { level: 4, name: '1 Leg Standing (no hands)' },
      { level: 5, name: 'Standing' },
    ],
    howToPerform: "Choose your tier and mount the balance ball — seated, kneeling, or standing as your tier requires. Find your balance point and hold it as long as you can, using your hands only where the tier allows.",
    rules: "Declare your tier before starting. Timer starts when you are balanced in the declared position with no outside support and stops when any body part touches the floor or you leave the position. Spot the ball on soft ground or mats. Longest hold at your tier wins; a higher tier always outranks a lower one.",

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
      { level: 1, name: '180 Pivot' },
      { level: 2, name: '360 Pivot' },
      { level: 3, name: 'Ollie' },
      { level: 4, name: 'Pop Shove It' },
      { level: 5, name: 'Kickflip' },
    ],
    howToPerform: "Choose your trick tier — from pivots up to kickflips. Attempt the trick and land it rolling away clean. Every clean landing counts one rep.",
    rules: "Declare your tier before starting. A rep counts only when the trick is landed with both feet on the board, rolling away in control. Attempts are unlimited within the time the kaiwhakawā sets. Most landed reps at your tier wins; a higher tier always outranks a lower one. Helmet required.",

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
    rules: "Bout format and target touches set by the kaiwhakawā. Masks and chest protection required; only the equipment provided may be used. Clean, controlled touches only. Log your result as a win or loss with your opponent's name. Extra bouts vs new opponents earn effort points.",

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
      { level: 4, name: '4 Ball' },
    ],
    howToPerform: "Choose your tier — two balls in both hands, two in one hand, three, or four. Start the pattern and keep it running as long as you can. The attempt ends when a ball drops or the pattern breaks.",
    rules: "Declare your tier before starting. Timer starts with the first throw and stops when a ball is dropped or caught against the body, or the pattern stops. Any props (balls, beanbags, clubs). Longest continuous juggle at your tier wins; a higher tier always outranks a lower one.",

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
      { level: 1, name: '1 Bounce' },
      { level: 2, name: 'No Bounce' },
    ],
    howToPerform: 'Keep a football (soccer ball) in the air using only your feet, knees, and legs. D1: the ball may bounce once between each touch. D2: no bounces allowed — pure keepy-uppies only. Count how many consecutive touches you complete before the ball hits the ground (or for D1, before you fail to control a bounce).',
    rules: 'Use a standard soccer ball. Touches must be below the waist — no hands or arms. D1: one ground bounce is allowed between each touch. D2: no bounces allowed. Count consecutive touches. Submit your best total from one continuous attempt. Must be witnessed by a judge or filmed.',
    videoPlaceholder: true,
    emoji: '⚽',
  },

  // ─── Domain 9: Coordination ──────────────────────────────────────────────────
  {
    slug: 'volleyball',
    name: 'Volleyball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: 'Play a standard game of volleyball against your opponent. First to 21 points (win by 2) takes the match. Use standard volleyball rules. A judge or agreed witness must observe the match.',
    rules: 'Standard volleyball rules apply. First to 21 points wins (must win by 2). If no court is available, a modified court may be used with judge approval. Record win, draw (if agreed), or loss and the final score.',
    videoPlaceholder: true,
    emoji: '🏐',
  },
  {
    slug: 'baseball',
    name: 'Baseball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short-format baseball contest — batting, pitching, and fielding, scaled to numbers and space. The kaiwhakawā sets the format on the day (hitting duels, over-the-line, or a quick innings game).",
    rules: "Format and scoring set by the kaiwhakawā before play and kept the same for all matches. Log your result as a win, draw, or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '⚾',
  },
  {
    slug: 'teqball',
    name: 'Teqball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play teqball over the curved table (or a bench substitute) — football tennis, no hands. Return the ball over the table using any part of your body except arms and hands, within the touch limit.",
    rules: "First to the target points, set by the kaiwhakawā. No hands or arms; maximum three touches per side and no consecutive touches with the same body part. Log your result as a win or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'tennis',
    name: 'Tennis',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short-format tennis match — full court or short court to suit space. Serve diagonally, rally, and take your chances at the net.",
    rules: "Format (games or first-to points, serve rules) set by the kaiwhakawā and kept the same for all matches. Log your result as a win, draw, or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🎾',
  },
  {
    slug: 'cricket',
    name: 'Cricket',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a quick-format cricket contest — batting, bowling, and fielding in a compressed game (pairs cricket or a set number of overs each).",
    rules: "Format set by the kaiwhakawā: overs per side, runs and dismissal rules, kept the same for all matches. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏏',
  },
  {
    slug: 'badminton',
    name: 'Badminton',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short badminton match. Serve underarm and diagonal, then rally — use clears, drops, and smashes to move your opponent around the court.",
    rules: "First to the target points (rally scoring), set by the kaiwhakawā. Standard badminton faults apply: shuttle must cross the net and land in, no double hits. Log your result as a win or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏸',
  },
  {
    slug: 'basketball',
    name: 'Basketball',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short-format basketball game — 1v1 or small-sided halfcourt, first to the target score. Check the ball at the top, and clear it behind the arc on each change of possession in halfcourt play.",
    rules: "Format (target score, 1s-and-2s scoring, game length) set by the kaiwhakawā and kept the same for all matches. Standard violations apply — travels, double dribble, and fouls called honestly. Log your result as a win or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏀',
  },
  {
    slug: 'football',
    name: 'Football',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a small-sided football game — small goals, tight space, first to the target score or best score within the time. Keep the ball moving and press hard when you lose it.",
    rules: "Format (team size, goal size, game length) set by the kaiwhakawā and kept the same for all matches. No slide tackles. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'hockey',
    name: 'Hockey',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a small-sided hockey game with sticks and a ball — small goals, no keepers unless numbers allow. Keep the ball on the flat side of the stick and pass early.",
    rules: "Format set by the kaiwhakawā and kept the same for all matches. Sticks below shoulder height at all times; no lifting the ball dangerously. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏑',
  },
  {
    slug: 'squash',
    name: 'Squash',
    domain: 'Coordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short squash match. Serve from the service box, then rally off the front wall — take the T, and move your opponent into the corners.",
    rules: "First to the target points, set by the kaiwhakawā. Standard squash rules: ball above the tin and below the out line, one bounce. Play lets and strokes honestly. Log your result as a win or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🎾',
  },

  // ─── Domain 10: Aim & Precision ──────────────────────────────────────────────
  {
    slug: 'netball',
    name: 'Netball',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a short-format netball contest — a shooting duel or small-sided game, as set on the day. In game play, pass quickly and hold your space; no stepping with the ball.",
    rules: "Format set by the kaiwhakawā (shooting rounds or a timed small-sided game) and kept the same for all matches. Standard netball rules where playing a game: no stepping, no contact, obstruction at arm's length. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏀',
  },
  {
    slug: 'bocce',
    name: 'Bocce',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Take turns throwing your bocce balls toward the jack. Get closer than your opponent — knock their balls away or reposition the jack with a well-weighted throw.",
    rules: "Points per end go to the balls closer to the jack than the opponent's best ball; first to the target score set by the kaiwhakawā. Throw from behind the line. Log your result as a win or loss with your opponent's name. Extra matches vs new opponents earn effort points.",
    videoPlaceholder: true,
    emoji: '🎯',
  },
  {
    slug: 'dodgeball',
    name: 'Dodgeball',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a dodgeball match. Throw to hit opponents below the shoulders, dodge what comes back, and catch a live ball to bring a teammate back in — last team (or player) standing wins the set.",
    rules: "Format (team size, sets, court size) set by the kaiwhakawā. Hits above the shoulders don't count and headhunting is a foul. A caught ball puts the thrower out. Honesty rule: call yourself out. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🎯',
  },
  {
    slug: 'carrom',
    name: 'Carrom',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a game of carrom. Flick the striker from your baseline to pocket your colour's pieces into the corner pockets, finishing with the red queen covered by one of your own.",
    rules: "Standard carrom rules: strike from your own baseline, pocket your pieces, and the queen must be covered to count. Fouls return a pocketed piece to the board. First to clear their pieces (with the queen resolved) wins. Log your result as a win or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🎱',
  },
  {
    slug: 'archery',
    name: 'Archery',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Shoot a set number of arrows per end at the target from the marked distance. Draw smoothly, anchor consistently, and score where each arrow lands.",
    rules: "Distance, arrows per end, and total ends are set by the kaiwhakawā and matched for both players. All safety commands are absolute — arrows are only nocked on the shooting line and collected together. Highest total wins the match. Log your result as a win, draw, or loss. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🏹',
  },
  {
    slug: 'kubb',
    name: 'Kubb',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "From your baseline, throw batons underarm to knock over your opponent's field kubbs, then their baseline kubbs — and finally the king. Knock the king over early and you lose instantly.",
    rules: "Underarm, end-over-end baton throws only — no helicopter throws. Standard kubb sequence: field kubbs must fall before baseline kubbs, king last. Toppling the king before clearing everything else is an instant loss. Log your result as a win or loss. Extra matches vs new opponents earn effort points.",
    videoPlaceholder: true,
    emoji: '🪵',
  },
  {
    slug: 'darts',
    name: 'Darts',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: "Play a darts match from the oche — 301 or 501, as set on the day. Score with each three-dart visit and work your way down to a finish.",
    rules: "Game format (301/501, straight or double finish) set by the kaiwhakawā and matched for all players. Both feet behind the oche when throwing. Log your result as a win or loss with your opponent's name. Extra matches vs new opponents earn effort points.",

    videoPlaceholder: true,
    emoji: '🎯',
  },
  {
    slug: 'disc-golf',
    name: 'Disc Golf',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'score',
    hasDifficultyTiers: false,
    howToPerform: "Play 4 holes of disc golf. Tee off from the marked tee, throw from where the disc lands, and finish each hole by hitting the basket or target. Count every throw.",
    rules: "Play the 4 holes set out by the kaiwhakawā, from the tees and to the targets marked. Every throw counts one stroke; play the disc where it lies, with course penalty rules as set on the day. Lowest total strokes wins. Each additional 4-hole round earns effort points.",
    videoPlaceholder: true,
    emoji: '🥏',
  },
  {
    slug: 'golf',
    name: 'Golf',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'score',
    hasDifficultyTiers: false,
    howToPerform: "Play 4 holes of golf on the course set out for the session. Tee off, play the ball as it lies, and hole out on each green. Count every stroke.",
    rules: "Play the 4 holes set out by the kaiwhakawā from the marked tees. Every stroke counts, penalties as set on the day, and the ball is holed when it is in the cup (or hits the marked target). Lowest total strokes wins. Each additional 4-hole round earns effort points.",
    videoPlaceholder: true,
    emoji: '⛳',
  },
  {
    slug: 'ultimate-frisbee',
    name: 'Ultimate Frisbee',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: 'Play a game of Ultimate Frisbee against your opponent or opposing team. Move the disc down the field by passing — no running with the disc. Score by catching the disc in the opposing end zone. Standard Ultimate Frisbee rules apply.',
    rules: 'Standard Ultimate Frisbee rules apply. No running with the disc — pivot and pass only. Disc changes possession on incomplete passes, interceptions, or out-of-bounds. Score by catching in the end zone. Match format (score target or time limit) agreed before play. Record as a win, draw, or loss. Must be witnessed by a judge.',
    videoPlaceholder: true,
    emoji: '🥏',
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
// Duck Walk is intentionally excluded (mixed hold/walk tiers) — pending tier redesign.
export const TIMED_EFFORT_SLUGS = new Set<string>([
  'running', 'cycling', 'ski-erg', 'row-erg', 'weighted-carry',
  'bronco', 'walking', 'burpee-broad-jump', 'climbing', 'repeat-high-jump',
])

export function isTimedEffort(slug?: string | null): boolean {
  return !!slug && TIMED_EFFORT_SLUGS.has(slug)
}

export function encodeDiffTime(tierIdx: number, secs: number, fasterWins: boolean): number {
  return tierIdx * DT_CAP + (fasterWins ? DT_CAP - secs : secs)
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
//   - strength      → best weight_kg
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

  // difficulty+reps: one set at 80% PR reps, same tier
  if (mode === 'difficulty+reps' && event.hasDifficultyTiers) {
    if (rawScore <= 0) return []
    const tierIdx = Math.floor(rawScore / 10000)
    const prReps = rawScore % 10000
    if (prReps <= 0) return []
    const tierLevel = tierIdx + 1
    const tiers = event.difficultyTiers ?? []
    const tierName = tiers.find(t => t.level === tierLevel)?.name ?? `D${tierLevel}`
    const targetReps = Math.max(1, Math.round(prReps * 0.8))
    return [{ tier: 1 as const, label: `${targetReps} reps at ${tierName}`, detail: `A qualifying set of ${targetReps} reps at D${tierLevel} (80% of PR)`, points: 5 as const, inputMode: 'difficulty+reps' }]
  }

  return []
}

// Ordered domain list for consistent display
export const DOMAIN_ORDER = [
  'Maximal Strength',
  'Calisthenics',
  'Power',
  'Speed',
  'Anaerobic Endurance',
  'Aerobic Endurance',
  'Flexibility',
  'Body Awareness',
  'Coordination',
  'Aim & Precision',
]
