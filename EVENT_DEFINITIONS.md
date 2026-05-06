# AllSport Event Definitions
## Input Modes, Difficulty Tiers & Effort Tasks

> **Purpose:** This document is the authoritative spec for every event's input type, difficulty tiers, and effort task targets. It is the reference for the AI implementation that will update `lib/eventData.ts` and the scoring engine. Review and correct this before implementation begins.

---

## 1. New InputMode: `difficulty+reps`

A new InputMode must be added to the TypeScript union:

```ts
| 'difficulty+reps'  // Tier selector + rep count. Scored as: tierIndex × 10,000 + reps
```

Scoring formula mirrors `hold` (difficulty+time) but substitutes reps for seconds:
- Higher tier always beats lower tier
- Within the same tier, more reps wins
- `raw_score = tierIndex * 10000 + reps`  (tierIndex is 0-based)

**Special case — GHD Situp D4:** When the selected tier is D4 (GHD Situp), scoring switches to weight-based (like `strength` mode). `raw_score = weight_kg`. The weight input replaces the rep count input for D4 only.

---

## 2. InputMode Changes Summary

| Old Mode | New Mode | Affected Events |
|---|---|---|
| `dynamic` | `difficulty+time` | Flag, Planche, Back Lever, Iron Cross, Front Lever |
| `flexibility` | `difficulty+time` | Rear Hand Clasp, Forward Fold, Needle Pose, Middle Split, Shoulder Dislocate, Side Bend |
| `hold` (no tiers) → `difficulty+time` | Fix `hasDifficultyTiers: true` | Headstand, Bridge, Standing Split, Breakdancing |
| `reps` | `difficulty+reps` | 1 Leg Squat, Windshield Wipers, Chin Up Contest, Push Up Contest, Reverse Hyper, Finger Push Up, Ab Wheel Rollout, Jump Rope, Juggling, Gymnastics |
| `reps` | `strength` | Pause Dips, Pause Chin Up |
| `reps` | `difficulty+reps` (special D4) | Calf Raise → renamed GHD Situp |
| `reps` | `strength` | Leg Extension |
| `time` | `difficulty+time` | Rope Climb |
| `hold` | `distance` | Iron Lungs |
| No change | `strength` | Tib Curl (confirm: weight + reps, no tiers) |

---

## 3. Effort Task Patterns by InputMode

| Mode | E1 (90%) | E2 (80%) | E3 (70%) |
|---|---|---|---|
| `strength` | 90% of PR weight × 3 reps | 80% of PR weight × 5 reps | 70% of PR weight × 8 reps |
| `difficulty+time` | Hold current tier for 1 min | Hold one tier below for 2 min | Hold one tier below for 4 min |
| `difficulty+reps` | 90% of PR reps at current tier | 80% of PR reps at current tier | 70% of PR reps at current tier |
| `time` / `sprint` | 1 effort within 90% of PR time | 2 efforts within 80% of PR time | 3 efforts within 70% of PR time |
| `distance` | 1 attempt at 90% of PR distance | 2 attempts at 80% of PR distance | 3 attempts at 70% of PR distance |
| `sport` | 1 extra game vs a new opponent | 2 extra games vs new opponents | 3 extra games vs new opponents |

**Notes on `difficulty+time` effort tasks:**
- If the player is at D1 (no tier below), generate: Hold D1 for 1 min / 2 min / 4 min instead.
- Effort tasks are generated from the decoded PR: `tierIdx = Math.floor(rawScore / 10000)`, `value = rawScore % 10000`.

**Notes on `difficulty+reps` effort tasks:**
- PR reps decoded from raw_score: `prReps = rawScore % 10000`, `prTierIdx = Math.floor(rawScore / 10000)`.
- Targets: `Math.round(prReps * 0.9)`, `* 0.8`, `* 0.7` — minimum 1 rep.

---

## 4. `getBonusTargets` — Key Fix

The current condition gating effort tasks for hold+tier events is wrong:

```ts
// CURRENT (broken — misses domain 2, 5, 6, 7, 8 hold events)
const isFlexOrTieredHold =
  mode === 'flexibility' ||
  (event.hasDifficultyTiers && (event.domainNumber === 3 || event.domainNumber === 4))

// CORRECT
const isTieredHold = mode === 'difficulty+time' && event.hasDifficultyTiers
```

The function must also decode PR from `raw_score` (a number) — NOT from a "D5" string, since `get_player_season_pr` always returns a numeric `raw_score`.

---

## 5. Season PR Loading — Critical Note

`get_player_season_pr` always returns a numeric `raw_score`. For `difficulty+time` and `difficulty+reps` events, the tier is encoded in the number (`tierIdx * 10000 + value`). The effort task logic must decode this — do not expect a "D5" string.

The PR display line in the scoring UI (`PR: {seasonPR}`) must also decode and format these values correctly, e.g. "D3 · 45s" or "D2 · 12 reps".

---

## 6. Per-Event Definitions

### Domain 1 — Maximal Strength
*All events: `strength` mode, no difficulty tiers. Effort tasks: 90%×3, 80%×5, 70%×8.*

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | 1A Press | `one-arm-press` | strength | none |
| 2 | Deadlift | `deadlift` | strength | none |
| 3 | OHP | `overhead-press` | strength | none |
| 4 | Pause Dips | `pause-dips` | **difficulty+reps** (D5 weight-scored) | D1–D5 |
| 5 | Pause Chin Up | `pause-chin-up` | **difficulty+reps** (D5 weight-scored) | D1–D5 |
| 6 | Pause Squat | `pause-squat` | strength | none |
| 7 | Zercher Dead | `zercher-deadlift` | strength | none |
| 8 | Ham Curl | `hamstring-curl` | **difficulty+reps** | D1–D5 |
| 9 | Pause Bench | `pause-bench` | strength | none |
| 10 | Turkish Get Up | `turkish-get-up` | strength | none |

**Difficulty Tier Definitions — Domain 1:**
**Pause Dip** (D1-D5)
- D1: Assisted Dips (2 Feet)
- D2: Assisted Dips (1 Foot)
- D3: Straight Bar Dips
- D4: Rings Turned Out Dip
- D5: Weighted RTO Dip (**weight-scored** — input switches to weight_kg)

**Pause Chin Up** (D1-D5)
- D1: Assisted Chins (2 Feet)
- D2: Assisted Chins (1 Foot)
- D3: Banded Chinup
- D4: Chinup
- D5: Weighted Chinup (**weight-scored** — input switches to weight_kg)

**Hamstring Curl** (D1-D5)
- D1: Glute Thrust
- D2: Yoga Ball Glute Thrust
- D3: Floor Slider Curl
- D4: Banded Nordic Curl
- D5: Nordic Curl
---

### Domain 2 — Relative Strength

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | 1 Leg Squat | `1-leg-squat` | **difficulty+reps** *(was reps)* | D1–D6 |
| 2 | Flag | `flag` | **difficulty+time** *(was dynamic)* | D1–D6 |
| 3 | Windshield Wipers | `windshield-wipers` | **difficulty+reps** *(was reps)* | D1–D4 |
| 4 | Toe Lift | `toe-lift` | strength | none |
| 5 | Planche | `planche` | **difficulty+time** *(was dynamic)* | D1–D6 |
| 6 | Back Lever | `back-lever` | **difficulty+time** *(was dynamic)* | D1–D7 |
| 7 | Iron Cross | `iron-cross` | **difficulty+time** *(was dynamic)* | D1–D6 |
| 8 | Front Lever | `front-lever` | **difficulty+time** *(was dynamic)* | D1–D7 |
| 9 | Chin Hang | `chin-hang` | difficulty+time | D1–D6 |
| 10 | Climbing | `rope-climb` | **difficulty+time** *(was time)* | D1–D8 |

**Tier Definitions — Domain 2:**

**1 Leg Squat** (D1–D6)
- D1: Assisted Lunge
- D2: Lunge
- D3: Bulgarian Split Squat
- D4: Shrimp Squat
- D5: Pistol Squat
- D6: Dragon Squat

**Flag** (D1–D6)
- D1: Elevated Side Plank
- D2: Side Plank
- D3: 1 Leg Side Plank
- D4: Partial Flag
- D5: Tuck Flag
- D6: Human Flag

**Windshield Wipers** (D1–D4)
- D1: Tuck Floor Wiper
- D2: Floor Wipers
- D3: Hanging Wiper Circles
- D4: Windshield Wipers

**Planche** (D1–D6)
- D1: Pseudo Planche Lean
- D2: Elevated Pseudo Planche Lean
- D3: Tuck Planche
- D4: Banded Planche
- D5: Straddle Planche
- D6: Full Planche

**Back Lever** (D1–D7)
- D1: Assisted Hang
- D2: Hang
- D3: Inverted Hang
- D4: German Hang
- D5: Tuck Back Lever
- D6: Straddle Back Lever
- D7: Back Lever

**Iron Cross** (D1–D6)
- D1: Assisted Iron Cross (2 Feet)
- D2: Assisted Iron Cross (1 Foot)
- D3: Ring Top Position Hold
- D4: Banded Iron Cross
- D5: Partial Iron Cross
- D6: Iron Cross

**Front Lever** (D1–D7)
- D1: Assisted Hang
- D2: Hang
- D3: Inverted Hang
- D4: Tuck Front Lever
- D5: Banded Front Lever
- D6: 1 Leg Front Lever
- D7: Front Lever

**Chin Hang** (D1–D6) *(existing — keep)*
- D1: Assisted Chin Hang (2 Feet)
- D2: Assisted Chin Hang (1 Foot)
- D3: Two-Hand Chin Hang
- D4: One-Hand Chin Hang
- D5: Band-Assisted Chin Hang
- D6: Hands-Free Chin Hang

**Climbing / Rope Climb** (D1–D8)
- D1: Leaning Rope Hold
- D2: Foot-Assisted Rope Hang
- D3: No Feet Rope Hang
- D4: Foot-Assisted Rope Climb
- D5: No Feet Rope Climb
- D6: L-Sit Rope Climb
- D7: Pegboard (feet allowed)
- D8: Pegboard (no feet)

---

### Domain 3 — Muscular Endurance

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | Chinup Contest | `chin-up-contest` | **difficulty+reps** *(was reps)* | D1–D4 |
| 2 | Pushup Contest | `push-up-contest` | **difficulty+reps** *(was reps)* | D1–D4 |
| 3 | Reverse Hyper | `reverse-hyper` | **difficulty+reps** *(was reps)* | D1–D4 |
| 4 | L-Sit Hold | `l-sit-hold` | difficulty+time | D1–D7 |
| 5 | Tibialis Curl | `tibialis-curl` | strength | none |
| 6 | Headstand | `headstand` | difficulty+time *(fix hasDifficultyTiers: true)* | D1–D5 |
| 7 | Finger Push Up | `finger-push-up` | **difficulty+reps** *(was reps)* | D1–D7 |
| 8 | GHD Situp | `ghd-situp` *(was calf-raise)* | **difficulty+reps** (D4 weight-scored) | D1–D4 |
| 9 | Leg Extension | `leg-extension` | **strength** *(was reps)* | none |
| 10 | Ab Rollout | `ab-wheel-rollout` | **difficulty+reps** *(was reps)* | D1–D5 |

**Tier Definitions — Domain 3:**

**Chin Up Contest** (D1–D4)
- D1: Ring Row
- D2: Elevated Ring Row
- D3: Banded Chinup
- D4: Chin Up

**Push Up Contest** (D1–D4)
- D1: Elevated Knee Push Up
- D2: Knee Push Up
- D3: Push Up
- D4: 1 Arm Pushup

**Reverse Hyper** (D1–D4)
- D1: Superman Hold
- D2: Back Extension
- D3: Reverse Hyper Hold (Hips off)
- D4: Reverse Hyper Hold (Only Chest Touching)

**L-Sit Hold** (D1–D7)
- D1: Support Hold (legs bent, feet touching floor)
- D2: Support Hold (legs straight, 1 foot touching floor)
- D3: Tuck Hold (both knees to chest)
- D4: Tucked L-Sit (one leg extended)
- D5: Half L-Sit (legs angled, not fully horizontal)
- D6: Full L-Sit (legs fully horizontal, Knees locked)
- D7: V-Sit (Thighs Touching Chest, Knees locked)

**Headstand** (D1–D5) *(existing — fix hasDifficultyTiers, add D1 name)*
- D1: Feet-Supported Tripod
- D2: Tripod Headstand
- D3: Forearm Headstand
- D4: Wall Headstand (No hands, wall support)
- D5: Freestanding Headstand

**Finger Push Up** (D1–D7)
- D1: Elevated Knee Finger Pushup
- D2: Knee Finger Pushup
- D3: Finger Pushup
- D4: 4 Finger Pushup
- D5: 3 Finger Pushup
- D6: 2 Finger Pushup
- D7: Thumb Pushup

**GHD Situp** (D1–D4) — *renames Calf Raise; slug changes to `ghd-situp`*
- D1: Dead Bug (reps — no weight)
- D2: Crunch (reps — no weight)
- D3: Sit Up (reps — no weight)
- D4: GHD Situp (**weight-scored** — input switches to weight_kg)

**Ab Rollout** (D1–D5)
- D1: Kneeling Elevated Hold
- D2: Kneeling Ab Rollout
- D3: Elevated Kneeling Ab Rollout
- D4: Banded Ab Rollout
- D5: Ab Rollout

---

### Domain 4 — Flexibility & Mobility
*All events switch to `difficulty+time`. Effort tasks: Hold current tier 1 min, tier-below 2 min, tier-below 4 min.*

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | Rear Hand Clasp | `rear-hand-clasp` | **difficulty+time** *(was flexibility)* | D1–D7 |
| 2 | Bridge | `bridge` | difficulty+time *(fix hasDifficultyTiers: true)* | D1–D6 |
| 3 | Forward Fold | `forward-fold` | **difficulty+time** *(was flexibility)* | D1–D8 |
| 4 | Needle Pose | `needle-pose` | **difficulty+time** *(was flexibility)* | D1–D6 |
| 5 | Forward Split | `front-split` | **difficulty+time** *(was hold, no tiers)* | D1–D8 |
| 6 | Middle Split | `middle-split` | **difficulty+time** *(was flexibility)* | D1–D7 |
| 7 | Standing Split | `standing-split` | difficulty+time *(fix hasDifficultyTiers: true)* | D1–D8 |
| 8 | Foot Behind Head | `foot-behind-head` | difficulty+time | D1–D6 |
| 9 | Shoulder Dislocate | `shoulder-dislocate` | **difficulty+time** *(was flexibility)* | D1–D4 |
| 10 | Pancake | `pancake` | **difficulty+time** *(was flexibility)* | D1–D7 |

**Tier Definitions — Domain 4:**

**Rear Hand Clasp** (D1–D7)
- D1: Towel-Assisted (hands hold opposite ends of towel)
- D2: Block Assisted
- D3: Half Block Assisted
- D4: Finger Tips Touch
- D5: Finger Clasp
- D6: Palm Clasp
- D7: Butterfly Clasp

**Bridge** (D1–D6)
- D1: Glute Bridge
- D2: Wall Assisted Bridge
- D3: Headstand Bridge
- D4: Bridge
- D5: Straight Arm Bridge
- D6: Rainbow Bridge

**Forward Fold** (D1–D8)
- D1: Elevated Seated Forward Fold
- D2: Standing Forward Fold
- D3: Standing Forward Fold (knees bent)
- D4: Standing Forward Fold (straight legs)
- D5: Standing Forward Fold (finger-tips to floor)
- D6: Standing Forward Fold (palms to floor)
- D7: Standing Forward Fold (elbow to toes)
- D8: Full Forward Fold (head to legs)

**Needle Pose** (D1–D6) *(existing — add D1/D2/D3 names)*
- D1: Standing Leg Lift (below hip)
- D2: Standing Leg Lift (at hip height / horizontal)
- D3: Standing Scale (slightly above hip)
- D4: Standing Scale (at hip, leg fully extended)
- D5: Standing Scale (high, above head level)
- D6: Needle Pose (leg to head)

**Front Split** (D1–D6)
- D1: Assisted Front Split (2 Blocks)
- D2: Assisted Front Split (1.5 Blocks)
- D3: Assisted Front Split (1 Block)
- D4: Assisted Front Split (0.5 Blocks)
- D5: Front Split
- D6: Over Split

**Middle Split** (D1–D7)
- D1: Assisted Middle Split (2 Blocks)
- D2: Assisted Middle Split (1.5 Blocks)
- D3: Assisted Middle Split (1.25 Blocks)
- D4: Assisted Middle Split (1 Block)
- D5: Assisted Middle Split (0.75 Blocks)
- D6: Assisted Middle Split (0.5 Blocks)
- D7: Middle Split

**Standing Split** (D1–D8)
- D1: Standing Leg Lift (Ankle height)
- D2: Standing Leg Lift (Knee height)
- D3: Standing Leg Lift (Hip height)
- D4: Standing Split (Hip height, knee locked)
- D5: Standing Split (Above hip height, hand assisted, knee locked)
- D6: Standing Split (Above hip height, knee locked)
- D7: Standing Split (Head height, hand assisted)
- D8: Standing Split (Head height, no hand assistance)

**Foot Behind Head Pose** (D1–D6) *(existing — update D1–D3 names)*
- D1: Assisted Pidgeon Pose
- D2: 90/90 Pose
- D3: Pidgeon Pose
- D4: Elevated Pidgeon Pose
- D5: Foot to Head Pose
- D6: Foot Behind Head Pose

**Shoulder Dislocate** (D1–D4)
- D1: Wide Grip (hands double shoulder-width+)
- D2: Moderately Wide (1.5× shoulder width)
- D3: Shoulder-Width Grip
- D4: Narrow Grip (inside shoulder width)

**Pancake** (D1–D7)
- D1: Elevated Pancake (More than 2 blocks)
- D2: Elevated Pancake (2 blocks)
- D3: Elevated Pancake (1.5 blocks)
- D4: Elevated Pancake (1 block)
- D5: Elevated Pancake (0.5 blocks)
- D6: Pancake (hands to floor)
- D7: Pancake (head to floor)

---

### Domain 5 — Power

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | Kelly Snatch | `kelly-snatch` | strength | none |
| 2 | 1A Snatch | `one-arm-snatch` | strength | none |
| 3 | Triple Jump | `triple-jump` | distance | none |
| 4 | Javelin | `javelin-throw` | distance | none |
| 5 | Shotput | `shot-put` | distance | none |
| 6 | Australian Football | `australian-football` | sport | none |
| 7 | Vertical Jump | `vertical-jump` | distance | none |
| 8 | Hand Walk | `hand-walk` | **difficulty+time** | D1–D4 |
| 9 | Clean & Jerk | `clean-and-jerk` | strength | none |
| 10 | Snatch | `snatch` | strength | none |

*Distance events: effort tasks at 90%, 80%, 70% of PR distance (1, 3, 5 attempts).*
*Strength events: 90%×3, 80%×5, 70%×8.*
*AFL (sport): 1/2/3 extra games vs new opponents.*

**Tier Definitions — Domain 5:**
**Hand Walk** (D1–D4)
- D1: Bear Crawl
- D2: Lizard Crawl
- D3: Wall Handstand Walk
- D4: Handstand Walk (unbroken)

---

### Domain 6 — Aerobic Endurance

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | Burpee Broad Jump | `burpee-broad-jump` | **difficulty+time** | D1-D3 |
| 2 | Running | `running` | **difficulty+time** | D1-D3 |
| 3 | Cycling | `cycling` | **difficulty+time** | D1-D3 |
| 4 | Ski Erg | `ski-erg` | **difficulty+time** | D1-D3 |
| 5 | Row Erg| `row-erg` | **difficulty+time** | D1-D3 |
| 6 | Breath Hold | `breath-hold` | **time** | none |
| 7 | Weighted Carry | `weighted-carry` | **difficulty+time** | D1-D3 |
| 8 | Duck Walk | `duck-walk` | **difficulty+time** | D1-D5 |
| 9 | Sprint Repeats | `sprint-repeats` | **sport** | none |
| 10 | 30-15 Test | `30-15-test` | **time** | none |

*`difficulty+time` events: Hold current tier 1 min / hold tier-below 2 min / hold tier-below 4 min.*
*`time` events (Breath Hold, 30-15 Test): effort tasks at 90%/80%/70% of PR time (1/2/3 efforts).*
*`sport` (Sprint Repeats): 1/2/3 extra rounds vs new opponents.*

**Breath Hold** — player holds their breath as long as possible. Score = time in seconds (higher is better).

**Tier Definitions — Domain 6:**
**Burpee Broad Jump** (D1–D3)
- D1: 25m
- D2: 50m
- D3: 100m

**Running** (D1–D3)
- D1: 250m
- D2: 500m
- D3: 1000m

**Cycling** (D1–D3)
- D1: 250m
- D2: 500m
- D3: 1000m

**Ski Erg** (D1–D3)
- D1: 250m
- D2: 500m
- D3: 1000m

**Row Erg** (D1–D3)
- D1: 250m
- D2: 500m
- D3: 1000m

**Weighted Carry** (D1–D3)
- D1: ×0.25 BW
- D2: ×0.5 BW
- D3: ×1 BW

**Duck Walk** (D1–D5)
- D1: Squat Hold
- D2: OH Squat Hold
- D3: 25m Duck Walk
- D4: 50m Duck Walk
- D5: 100m Duck Walk


---

### Domain 7 — Speed & Agility

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | 100m Sprint | `100m-sprint` | sprint | none |
| 2 | Tag | `tag` | sport | none |
| 3 | T-Race | `t-race` | sport | none |
| 4 | 400m Race | `400m-race` | sprint | none |
| 5 | Beach Flags | `beach-flags` | sport | none |
| 6 | 50m Sprint | `50m-sprint` | sprint | none |
| 7 | 200m Sprint | `200m-sprint` | sprint | none |
| 8 | Touch Rugby | `touch-rugby` | sport | none |
| 9 | Football Dribble | `football-dribble` | sprint | none |
| 10 | Repeat High Jump | `repeat-high-jump` | **difficulty+time** | D1–D4 |

*Sprint events: effort tasks at 90%/80%/70% of PR (1/2/3 efforts).*
*Sport events: 1/2/3 extra games vs new opponents.*
*Repeat High Jump (`difficulty+time`): Hold current tier 1 min / tier-below 2 min / tier-below 4 min.*

**Tier Definitions — Domain 7:**
**Repeat High Jump** (D1–D4)
- D1: Ankle height
- D2: Knee height
- D3: Hip height
- D4: Shoulder height
---

### Domain 8 — Body Awareness

| # | Name | Slug | InputMode | Tiers |
|---|---|---|---|---|
| 1 | Tae Kwon Do | `tae-kwon-do` | sport | none |
| 2 | Breakdancing | `breakdancing` | **difficulty+reps** *(fix hasDifficultyTiers: true)* | D1–D6 |
| 3 | Trampolining | `trampolining` | **difficulty+reps** *(fix hasDifficultyTiers: true)* | D1–D6 |
| 4 | Jump Rope | `jump-rope` | **difficulty+reps** *(was reps)* | D1–D5 |
| 5 | Wrestling | `wrestling` | sport | none |
| 6 | Gymnastics | `gymnastics` | **difficulty+reps** *(was sport)* | D1–D8 |
| 7 | Balance Ball | `balance-ball` | difficulty+time | D1–D5 |
| 8 | SKATE | `skate` | **difficulty+reps** *(fix hasDifficultyTiers: true)* | D1–D5 |
| 9 | Fencing | `fencing` | sport | none |
| 10 | Juggling | `juggling` | **difficulty+time** *(was reps)* | D1–D4 |

**Tier Definitions — Domain 8:**

**Breakdancing** (D1–D6)
- D1: Basic Toprock (6-step, upright)
- D2: Basic Footwork (6-step on floor)
- D3: Freeze (basic — baby freeze)
- D4: Power Move (windmill or head spin entry)
- D5: Advanced Power Move (clean windmill, flare)
- D6: Combined Routine (power + freeze + toprock, 30s+ performance)

**Trampolining** (D1–D6)
- D1: Basic Bounce
- D2: 180 Spin
- D3: 360 Spin
- D4: Forward Flip
- D5: Back Flip
- D6: Front Flip 180

**Jump Rope** (D1–D5)
- D1: Basic Two-Foot Jump
- D2: Alternating Single-Foot Jump
- D3: Criss-Cross
- D4: Double Under
- D5: Crossover Double Under

**Gymnastics** (D1–D8)
- D1: Forward Roll
- D2: Backward Roll
- D3: Cartwheel
- D4: Roundoff
- D5: Handspring (front or back)
- D6: One-Hand Cartwheel
- D7: Front Handspring 
- D8: Back Handspring

**Balance Ball** (D1–D5)
- D1: Seated
- D2: Kneeling
- D3: Kneeling (no hands)
- D4: 1 Leg Standing (no hands)
- D5: Standing 

**SKATE** (D1–D5)
- D1: 180 Pivot
- D2: 360 Pivot
- D3: Ollie
- D4: Pop Shove It
- D5: Kickflip

**Juggling** (D1–D4)
- D1: 2 Ball (both hands)
- D2: 2 Ball (one hand)
- D3: 3 Ball
- D4: 4 Ball 

---

### Domain 9 — Co-ordination
*All events: `sport` mode. Effort tasks: 1/2/3 extra games vs new opponents.*

| # | Name | Slug | InputMode |
|---|---|---|---|
| 1 | Volleyball | `volleyball` | sport |
| 2 | Baseball | `baseball` | sport |
| 3 | Teqball | `teqball` | sport |
| 4 | Tennis | `tennis` | sport |
| 5 | Cricket | `cricket` | sport |
| 6 | Badminton | `badminton` | sport |
| 7 | Basketball | `basketball` | sport |
| 8 | Football | `football` | sport |
| 9 | Hockey | `hockey` | sport |
| 10 | Squash | `squash` | sport |

---

### Domain 10 — Aim & Precision
*All events: `sport` mode. Effort tasks: 1/2/3 extra games vs new opponents.*

| # | Name | Slug | InputMode |
|---|---|---|---|
| 1 | Netball | `netball` | sport |
| 2 | Handball | `handball` | sport |
| 3 | Cornhole | `cornhole` | sport |
| 4 | Dodgeball | `dodgeball` | sport |
| 5 | Carrom | `carrom` | sport |
| 6 | Archery | `archery` | sport |
| 7 | Bowling | `bowling` | sport |
| 8 | Darts | `darts` | sport |
| 9 | Disc Golf | `disc-golf` | sport |
| 10 | Golf | `golf` | sport |

*Note: Archery, Bowling, Darts, Disc Golf, and Golf are treated as competitive head-to-head events in AllSport (win/draw/loss). If a future requirement tracks individual numerical scores (e.g. pin count, stroke count), inputMode would change to `reps` (higher = better) or `time` (lower = better). For now, `sport` is correct.*

---

