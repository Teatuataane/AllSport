// lib/eventData.ts — Single source of truth for all 100 AllSport events.

export type InputMode =
  | 'strength'
  | 'reps'
  | 'time'
  | 'hold'
  | 'difficulty+time'
  | 'difficulty+reps'
  | 'distance'
  | 'flexibility'
  | 'sport'
  | 'weight+time'
  | 'distance+time'
  | 'sprint'
  | 'dynamic'

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
  points: 15
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    slug: 'overhead-press',
    name: 'OHP',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'pause-dips',
    name: 'Pause Dips',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'pause-chin-up',
    name: 'Pause Chin Up',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'hamstring-curl',
    name: 'Ham Curl',
    domain: 'Maximal Strength',
    domainNumber: 1,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏋️',
  },

  // ─── Domain 2: Relative Strength ─────────────────────────────────────────────
  {
    slug: '1-leg-squat',
    name: '1 Leg Squat',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'flag',
    name: 'Flag',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🚩',
  },
  {
    slug: 'windshield-wipers',
    name: 'Windshield Wipers',
    domain: 'Relative Strength',
    domainNumber: 2,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Tuck Floor Wiper' },
      { level: 2, name: 'Floor Wipers' },
      { level: 3, name: 'Hanging Wiper Circles' },
      { level: 4, name: 'Windshield Wipers' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🌀',
  },
  {
    slug: 'toe-lift',
    name: 'Toe Lift',
    domain: 'Relative Strength',
    domainNumber: 2,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🦶',
  },
  {
    slug: 'planche',
    name: 'Planche',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'back-lever',
    name: 'Back Lever',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'iron-cross',
    name: 'Iron Cross',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '✚',
  },
  {
    slug: 'front-lever',
    name: 'Front Lever',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'chin-hang',
    name: 'Chin Hang',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🧗',
  },
  {
    slug: 'rope-climb',
    name: 'Climbing',
    domain: 'Relative Strength',
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🪢',
  },

  // ─── Domain 3: Muscular Endurance ─────────────────────────────────────────────
  {
    slug: 'chin-up-contest',
    name: 'Chinup Contest',
    domain: 'Muscular Endurance',
    domainNumber: 3,
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
    domain: 'Muscular Endurance',
    domainNumber: 3,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Elevated Knee Push Up' },
      { level: 2, name: 'Knee Push Up' },
      { level: 3, name: 'Push Up' },
      { level: 4, name: '1 Arm Pushup' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '💪',
  },
  {
    slug: 'reverse-hyper',
    name: 'Reverse Hyper',
    domain: 'Muscular Endurance',
    domainNumber: 3,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Superman Hold' },
      { level: 2, name: 'Back Extension' },
      { level: 3, name: 'Reverse Hyper Hold (Hips off)' },
      { level: 4, name: 'Reverse Hyper Hold (Only Chest Touching)' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🔄',
  },
  {
    slug: 'l-sit-hold',
    name: 'L-Sit Hold',
    domain: 'Muscular Endurance',
    domainNumber: 3,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🪑',
  },
  {
    slug: 'tibialis-curl',
    name: 'Tibialis Curl',
    domain: 'Muscular Endurance',
    domainNumber: 3,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'headstand',
    name: 'Headstand',
    domain: 'Muscular Endurance',
    domainNumber: 3,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Feet-Supported Tripod' },
      { level: 2, name: 'Tripod Headstand' },
      { level: 3, name: 'Forearm Headstand' },
      { level: 4, name: 'Wall Headstand (No hands, wall support)' },
      { level: 5, name: 'Freestanding Headstand' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🙃',
  },
  {
    slug: 'finger-push-up',
    name: 'Finger Push Up',
    domain: 'Muscular Endurance',
    domainNumber: 3,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '👆',
  },
  {
    slug: 'ghd-situp',
    name: 'GHD Situp',
    domain: 'Muscular Endurance',
    domainNumber: 3,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Dead Bug' },
      { level: 2, name: 'Crunch' },
      { level: 3, name: 'Sit Up' },
      { level: 4, name: 'GHD Situp' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'leg-extension',
    name: 'Leg Extension',
    domain: 'Muscular Endurance',
    domainNumber: 3,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🦵',
  },
  {
    slug: 'ab-wheel-rollout',
    name: 'Ab Rollout',
    domain: 'Muscular Endurance',
    domainNumber: 3,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Kneeling Elevated Hold' },
      { level: 2, name: 'Kneeling Ab Rollout' },
      { level: 3, name: 'Elevated Kneeling Ab Rollout' },
      { level: 4, name: 'Banded Ab Rollout' },
      { level: 5, name: 'Ab Rollout' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⚙️',
  },

  // ─── Domain 4: Flexibility & Mobility ────────────────────────────────────────
  {
    slug: 'rear-hand-clasp',
    name: 'Rear Hand Clasp',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🙏',
  },
  {
    slug: 'bridge',
    name: 'Bridge',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🌉',
  },
  {
    slug: 'forward-fold',
    name: 'Forward Fold',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🧘',
  },
  {
    slug: 'needle-pose',
    name: 'Needle Pose',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🪡',
  },
  {
    slug: 'front-split',
    name: 'Forward Split',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'middle-split',
    name: 'Middle Split',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'standing-split',
    name: 'Standing Split',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤸',
  },
  {
    slug: 'foot-behind-head',
    name: 'Foot Behind Head',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🦶',
  },
  {
    slug: 'shoulder-dislocate',
    name: 'Shoulder Dislocate',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Wide Grip (hands double shoulder-width+)' },
      { level: 2, name: 'Moderately Wide (1.5× shoulder width)' },
      { level: 3, name: 'Shoulder-Width Grip' },
      { level: 4, name: 'Narrow Grip (inside shoulder width)' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🌀',
  },
  {
    slug: 'pancake',
    name: 'Pancake',
    domain: 'Flexibility & Mobility',
    domainNumber: 4,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🧘',
  },

  // ─── Domain 5: Power ─────────────────────────────────────────────────────────
  {
    slug: 'kelly-snatch',
    name: 'Kelly Snatch',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '💥',
  },
  {
    slug: 'one-arm-snatch',
    name: '1A Snatch',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '💥',
  },
  {
    slug: 'triple-jump',
    name: 'Triple Jump',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🦘',
  },
  {
    slug: 'javelin-throw',
    name: 'Javelin',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏹',
  },
  {
    slug: 'shot-put',
    name: 'Shotput',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'australian-football',
    name: 'Australian Football',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏉',
  },
  {
    slug: 'vertical-jump',
    name: 'Vertical Jump',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⬆️',
  },
  {
    slug: 'hand-walk',
    name: '50m Hand Walk',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Bear Crawl' },
      { level: 2, name: 'Lizard Crawl' },
      { level: 3, name: 'Handstand (multiple kickups)' },
      { level: 4, name: 'Handstand (unbroken)' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🍑',
  },
  {
    slug: 'clean-and-jerk',
    name: 'Clean & Jerk',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏋️',
  },
  {
    slug: 'snatch',
    name: 'Snatch',
    domain: 'Power',
    domainNumber: 5,
    inputMode: 'strength',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏋️',
  },

  // ─── Domain 6: Aerobic Endurance ─────────────────────────────────────────────
  {
    slug: '200m-burpee-broad-jump',
    name: 'Burpee Broad Jump',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '💨',
  },
  {
    slug: '1k-run',
    name: '1k Run',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: 'Run 1 kilometre as fast as possible on a measured flat course or track. Start from standing. Timer starts on the judge\'s signal. Timer stops when both feet cross the finish line.',
    rules: 'Distance must be exactly 1 kilometre on a measured course. Running shoes or bare feet allowed. No cycling, skating, or assisted movement. Must run the full distance without cutting the course. Timer starts at the judge\'s signal and stops when you cross the finish line.',
    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: '1k-cycle',
    name: '1k Cycle',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🚴',
  },
  {
    slug: '1k-ski-erg',
    name: 'Ski 1k',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⛷️',
  },
  {
    slug: '1k-row',
    name: '1k Row',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🚣',
  },
  {
    slug: 'iron-lungs',
    name: 'Iron Lungs',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'distance',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🫁',
  },
  {
    slug: '200m-carry',
    name: '200m Carry',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '📦',
  },
  {
    slug: '2k-run',
    name: '2k Run',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: '200m-repeats',
    name: '200m Repeats',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: 'bronco',
    name: 'Bronco',
    domain: 'Aerobic Endurance',
    domainNumber: 6,
    inputMode: 'time',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🐴',
  },

  // ─── Domain 7: Speed & Agility ───────────────────────────────────────────────
  {
    slug: '100m-sprint',
    name: '100m Sprint',
    domain: 'Speed & Agility',
    domainNumber: 7,
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
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏷️',
  },
  {
    slug: 't-race',
    name: 'T-Race',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⚡',
  },
  {
    slug: '400m-race',
    name: '400m Race',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏃',
  },
  {
    slug: 'beach-flags',
    name: 'Beach Flags',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🚩',
  },
  {
    slug: '50m-sprint',
    name: '50m Sprint',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⚡',
  },
  {
    slug: '200m-sprint',
    name: '200m Sprint',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '💨',
  },
  {
    slug: 'touch-rugby',
    name: 'Touch Rugby',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏉',
  },
  {
    slug: 'football-dribble',
    name: 'Football Dribble',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'sprint',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'repeat-high-jump',
    name: 'Repeat High Jump',
    domain: 'Speed & Agility',
    domainNumber: 7,
    inputMode: 'difficulty+time',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Ankle height' },
      { level: 2, name: 'Knee height' },
      { level: 3, name: 'Hip height' },
      { level: 4, name: 'Shoulder height' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⬆️',
  },

  // ─── Domain 8: Body Awareness ─────────────────────────────────────────────────
  {
    slug: 'tae-kwon-do',
    name: 'Tae Kwon Do',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🥋',
  },
  {
    slug: 'breakdancing',
    name: 'Breakdancing',
    domain: 'Body Awareness',
    domainNumber: 8,
    inputMode: 'difficulty+reps',
    hasDifficultyTiers: true,
    difficultyTiers: [
      { level: 1, name: 'Basic Toprock (6-step, upright)' },
      { level: 2, name: 'Basic Footwork (6-step on floor)' },
      { level: 3, name: 'Freeze (basic — baby freeze)' },
      { level: 4, name: 'Power Move (windmill or head spin entry)' },
      { level: 5, name: 'Advanced Power Move (clean windmill, flare)' },
      { level: 6, name: 'Combined Routine (power + freeze + toprock, 30s+ performance)' },
    ],
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤹',
  },

  // ─── Domain 9: Co-ordination ─────────────────────────────────────────────────
  {
    slug: 'volleyball',
    name: 'Volleyball',
    domain: 'Co-ordination',
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
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⚾',
  },
  {
    slug: 'teqball',
    name: 'Teqball',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'tennis',
    name: 'Tennis',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🎾',
  },
  {
    slug: 'cricket',
    name: 'Cricket',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏏',
  },
  {
    slug: 'badminton',
    name: 'Badminton',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏸',
  },
  {
    slug: 'basketball',
    name: 'Basketball',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏀',
  },
  {
    slug: 'football',
    name: 'Football',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⚽',
  },
  {
    slug: 'hockey',
    name: 'Hockey',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏑',
  },
  {
    slug: 'squash',
    name: 'Squash',
    domain: 'Co-ordination',
    domainNumber: 9,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏀',
  },
  {
    slug: 'handball',
    name: 'Handball',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🤾',
  },
  {
    slug: 'cornhole',
    name: 'Cornhole',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
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
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🏹',
  },
  {
    slug: 'bowling',
    name: 'Bowling',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🎳',
  },
  {
    slug: 'darts',
    name: 'Darts',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🎯',
  },
  {
    slug: 'disc-golf',
    name: 'Disc Golf',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '🥏',
  },
  {
    slug: 'golf',
    name: 'Golf',
    domain: 'Aim & Precision',
    domainNumber: 10,
    inputMode: 'sport',
    hasDifficultyTiers: false,
    howToPerform: PLACEHOLDER_CONTENT,
    rules: PLACEHOLDER_CONTENT,
    videoPlaceholder: true,
    emoji: '⛳',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getEventBySlug(slug: string): EventData | undefined {
  return EVENTS.find(e => e.slug === slug)
}

export function getEventByName(name: string): EventData | undefined {
  return EVENTS.find(e => e.name === name)
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

  // Sport events: always show targets, no PR required
  if (mode === 'sport') {
    return ([1, 2, 3] as const).map(tier => ({
      tier,
      label: `${tier} extra game${tier > 1 ? 's' : ''} vs a new opponent`,
      detail: `${tier} additional game${tier > 1 ? 's' : ''} vs different opponent${tier > 1 ? 's' : ''}`,
      points: 15 as const,
      inputMode: 'sport',
    }))
  }

  if (seasonPR === null) return []
  const rawScore = typeof seasonPR === 'number' ? seasonPR : parseFloat(String(seasonPR))
  if (isNaN(rawScore)) return []

  // Strength events: PR = best weight_kg
  if (mode === 'strength') {
    if (rawScore <= 0) return []
    const specs: Array<{ tier: 1|2|3; pct: number; reps: number }> = [
      { tier: 1, pct: 0.9, reps: 3 },
      { tier: 2, pct: 0.8, reps: 5 },
      { tier: 3, pct: 0.7, reps: 8 },
    ]
    return specs.map(({ tier, pct, reps }) => {
      const kg = Math.round(rawScore * pct)
      return { tier, label: `${kg}kg × ${reps} reps`, detail: `${kg}kg × ${reps} reps`, points: 15 as const, inputMode: 'strength' }
    })
  }

  // Time / sprint events: raw_score is negative seconds (more negative = faster)
  if (mode === 'time' || mode === 'sprint') {
    const specs: Array<{ tier: 1|2|3; efforts: number; pct: number }> = [
      { tier: 1, efforts: 1, pct: 0.90 },
      { tier: 2, efforts: 2, pct: 0.80 },
      { tier: 3, efforts: 3, pct: 0.70 },
    ]
    return specs.map(({ tier, efforts, pct }) => {
      const threshold = rawScore * pct
      const timeStr = fmtSecs(threshold)
      return {
        tier,
        label: `${efforts} effort${efforts > 1 ? 's' : ''} under ${timeStr}`,
        detail: `${efforts} effort${efforts > 1 ? 's' : ''}, each under ${timeStr}`,
        points: 15 as const,
        inputMode: mode,
      }
    })
  }

  // Distance events: PR = metres
  if (mode === 'distance') {
    if (rawScore <= 0) return []
    const specs: Array<{ tier: 1|2|3; attempts: number; pct: number }> = [
      { tier: 1, attempts: 1, pct: 0.90 },
      { tier: 2, attempts: 2, pct: 0.80 },
      { tier: 3, attempts: 3, pct: 0.70 },
    ]
    return specs.map(({ tier, attempts, pct }) => {
      const dist = Math.round(rawScore * pct * 100) / 100
      return {
        tier,
        label: `${attempts} attempt${attempts > 1 ? 's' : ''} at ${dist}m`,
        detail: `${attempts} attempt${attempts > 1 ? 's' : ''} reaching ${dist}m`,
        points: 15 as const,
        inputMode: 'distance',
      }
    })
  }

  // difficulty+time: raw_score = tierIdx * 10000 + seconds (0-based tierIdx)
  if (mode === 'difficulty+time' && event.hasDifficultyTiers) {
    if (rawScore < 0) return []
    const tierIdx = Math.floor(rawScore / 10000)
    const tierLevel = tierIdx + 1
    const tiers = event.difficultyTiers ?? []
    const currentName = tiers.find(t => t.level === tierLevel)?.name ?? `D${tierLevel}`
    const belowLevel = tierLevel - 1
    const belowName = belowLevel >= 1
      ? (tiers.find(t => t.level === belowLevel)?.name ?? `D${belowLevel}`)
      : null

    const targets: BonusTarget[] = [{
      tier: 1,
      label: `Hold D${tierLevel} for 1 min`,
      detail: `Hold ${currentName} for 1 minute`,
      points: 15,
      inputMode: 'difficulty+time',
    }]

    if (belowName) {
      targets.push({ tier: 2, label: `Hold D${belowLevel} for 2 min`, detail: `Hold ${belowName} for 2 minutes`, points: 15, inputMode: 'difficulty+time' })
      targets.push({ tier: 3, label: `Hold D${belowLevel} for 4 min`, detail: `Hold ${belowName} for 4 minutes`, points: 15, inputMode: 'difficulty+time' })
    } else {
      // At D1: all targets use current tier, progressively longer
      targets.push({ tier: 2, label: `Hold D1 for 2 min`, detail: `Hold ${currentName} for 2 minutes`, points: 15, inputMode: 'difficulty+time' })
      targets.push({ tier: 3, label: `Hold D1 for 4 min`, detail: `Hold ${currentName} for 4 minutes`, points: 15, inputMode: 'difficulty+time' })
    }

    return targets
  }

  // difficulty+reps: raw_score = tierIdx * 10000 + reps (0-based tierIdx)
  if (mode === 'difficulty+reps' && event.hasDifficultyTiers) {
    if (rawScore <= 0) return []
    const tierIdx = Math.floor(rawScore / 10000)
    const prReps = rawScore % 10000
    if (prReps <= 0) return []
    const tierLevel = tierIdx + 1
    const tiers = event.difficultyTiers ?? []
    const currentName = tiers.find(t => t.level === tierLevel)?.name ?? `D${tierLevel}`

    const specs: Array<{ tier: 1|2|3; pct: number }> = [
      { tier: 1, pct: 0.90 },
      { tier: 2, pct: 0.80 },
      { tier: 3, pct: 0.70 },
    ]
    return specs.map(({ tier, pct }) => {
      const targetReps = Math.max(1, Math.round(prReps * pct))
      return {
        tier,
        label: `${targetReps} reps at D${tierLevel}`,
        detail: `${targetReps} reps of ${currentName}`,
        points: 15 as const,
        inputMode: 'difficulty+reps',
      }
    })
  }

  return []
}

// Ordered domain list for consistent display
export const DOMAIN_ORDER = [
  'Maximal Strength',
  'Relative Strength',
  'Muscular Endurance',
  'Flexibility & Mobility',
  'Power',
  'Aerobic Endurance',
  'Speed & Agility',
  'Body Awareness',
  'Co-ordination',
  'Aim & Precision',
]
