 # Difficulty Levels — Review

All 120 AllSport events. Go through them and set the difficulty levels for each one.

## How to fill this in

Every event has a list of levels under it. **Edit the list.** That is the whole job.

- **Change a level:** type over it.
- **Add a level:** add a new line.
- **Remove a level:** delete the line.
- **Reorder:** move the lines around.
- **This event should have no levels:** delete all the lines and write `NONE`.

Two rules:

1. **D1 is the easiest.** Each level below it must be harder than the one above.
2. **Ignore the D numbers.** Delete D2 and leave a gap if you like. I renumber them at the end.

Events with no levels yet have blank lines waiting. Fill in as many as you need, delete the rest,
and add more lines if five is not enough.

In brackets after a level you may see how it is judged, and `used N times`, meaning players have
actually scored on it. A level nobody has ever used may be too hard, or may not be a real step.

If you are unsure about something, write a note on the line and I will pick it up.

*120 events · 89 with levels · 8 marked NONE · 23 still unmarked*

---

## Before implementation: 16 things only you can settle

Everything else in this sheet is ready to build. Tick these off in your final pass and I'll
write the lot into `lib/eventData.ts`.

### Changes how scoring works

- [ ] **1. How is a `Game` level scored?** It's the top rung on 40 events, and a tiered event
  currently records reps or time, neither of which a game has. My recommendation: the Game level
  switches its input to win/draw/loss, the same way Pause Chinup D5 already switches to kilograms.
  It scores `level × 10,000 + (win 2 / draw 1 / loss 0)`, so playing the game beats drilling, and
  the result separates the players who played. **This turns 20 win/draw/loss events into tiered
  events, so it is the largest single piece of the build.**

  Yes game wins the win/loss/draw format
- [ ] **2. How do weighted levels score?** You've asked for weight *and* reps on Pause Dips,
  Pause Chinup and GHD Situp. Pick one: **volume** (`weight × reps`, keeps "more reps wins",
  my recommendation for a rep contest), or **heaviest wins** (`weight × 100 + reps`, reps break
  the tie). Either fixes a live bug where those levels currently rank below D2.
Heaviest wins 
### Roster and mode changes to confirm

- [ ] **3. Animal Crawl replaces Duck Walk as an event.** That's a roster change, not a rename, so
  it needs its own migration. Confirm you want it.
  Yes rename and update
- [ ] **4. Where do the four Duck Walk scores go?** They are all `50m Duck Walk`, 180 to 300
  seconds. Animal Crawl has 25m and 100m rungs but no 50m one. Add a 50m rung, or say the scores
  should be left behind.
  Leave the old scores behind
- [ ] **5. Leg Ext Hold: "weight and time" means no levels at all.** Confirm and I'll mark it
  `NONE`. It has no history left, so it's free.
  Correct none
- [ ] **6. Shoulder Dislocate** is blank with no mark. It already records width and reps as you
  described, so I assume `NONE`. Confirm.
  confirm

### Ladder ordering

- [ ] **7. `Walking → Timed → Game` puts a lost race above the fastest solo time.** On T-Race,
  Beach Flags, 200m Sprint, Rats & Rabbits and 100m Sprint, a higher level always wins, so
  someone who races and loses outranks the quickest runner of the day. Confirm, or swap Timed
  and Game.
  Racing beats a fast solo time yes
- [ ] **8. 100m Sprint** had that ladder written as a loose note. I've made it a real list to
  match its four siblings. Confirm.
- [ ] **9. Beach Flags** now grades `Walking → Timed → Game` instead of the start position, which
  is the thing that actually makes the event hard. Confirm.
- [ ] **10. Headstand:** is `Wall Head Plank` easier than `Feet-Supported Tripod`? They shared a
  number; I've put Wall Head Plank first.
  Yes wall head plank is easier
- [ ] **11. Iron Cross:** does `Partial Cross` sit above or below `Banded Iron Cross`? They shared
  a number; I've put Partial Cross first.
  Partial cross first
- [ ] **12. Table Tennis:** `Wall Juggles` sits below `Partner Hits`. A wall returns everything
  fast, so it may be the harder of the two.
- [ ] **13. Bowling** has no pins in it, and **Kubb** throws from 10m on an 8m pitch.

### Historical scores that need a home

- [ ] **14. Windshield Wipers:** D3 and D4 both claim the same three scores, which were set on the
  old `Hanging Wiper Circles`. Which rung gets them?
  Remove historical scores that conflict

- [ ] **15. L-Sit Hold** has no `Full L-Sit` any more, stranding three scores. Is `L-Sit` its
  replacement? Same question for **Chinup Contest**, where `Elevated Ring Row` sits alongside
  `High Ring Row`, and `Muscle Up` tops a chin-up contest.


### Unmarked

- [ ] **16. 23 events are blank with no `NONE`**, so I can't tell "no levels" from "not done":
  the ten barbell lifts, the seven throws and jumps, plus Tibialis Curl, Wall Sit, Toe Lift,
  Breath Hold, Leg Ext Hold and Shoulder Dislocate. One line confirming they're all `NONE`
  clears it.

  All none

---

## 1. Maximal Strength

### 1. 1A Press

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 2. Deadlift

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 3. Clean & Press

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 4. Pause Dips
Weighted dips should include the weight and the number of reps
*Scored by: difficulty level, then most reps*

- D1: Assisted · 2 Feet   (Dips with both feet assisting on the ground or a box)
- D2: Dip Top Hold 
- D3: Dip Negatives
- D4: Straight Bar Dips   (used 8 times)
- D5: Rings Turned Out Dip   (used 3 times)
- D6: Weighted RTO Dip

### 5. Pause Chinup
Weighted chinups should include the weight and the number of reps
*Scored by: difficulty level, then most reps*

- D1: High Ring Row
- D2: Low Ring Row
- D3: Chinup Negative
- D4: Banded Chinup
- D5: Chinup   (used 9 times)
- D6: Weighted Chinup   (used 3 times)

### 6. Pause Back Squat

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 7. Zercher Dead

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 8. Pause Bench

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 9. Turkish Getup

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 10. Arthur Lift

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 11. Pause Row

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 12. Pause Front Squat

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

---

## 2. Calisthenics

### 13. 1 Leg Squat

*Scored by: difficulty level, then most reps*

- D1: Assisted Lunge   (used 4 times)
- D2: Lunge   (used 3 times)
- D3: Bulgarian Split Squat   (used 9 times)
- D4: Shrimp Squat   (used 3 times)
- D5: Pistol Squat   (used 7 times)
- D6: Dragon Squat   (used 2 times)

### 14. Human Flag

*Scored by: difficulty level, then longest hold*

- D1: Elevated Side Plank
- D2: Side Plank   (used 4 times)
- D3: 1 Leg Side Plank   (used 3 times)
- D4: Assisted Flag
- D5: Tuck Flag
- D6: Full Flag

### 15. Windshield Wipers

*Scored by: difficulty level, then most reps*

- D1: Tuck Floor Wiper   (used 2 times)
- D2: Floor Wipers   (used 9 times)
- D3: Hanging Tuck Circles   (used 3 times)
- D4: Hanging Circles   (used 3 times)
- D5: Windshield Wipers

### 16. Planche

*Scored by: difficulty level, then longest hold*

- D1: Pseudo Planche Lean   (used 1 time)
- D2: Elevated Pseudo Lean   (Pseudo planche lean with hands elevated · used 1 time)
- D3: Banded Tuck Planche
- D4: Tuck Planche   (used 5 times)
- D5: Banded Planche
- D6: Straddle Planche
- D7: Full Planche

### 17. Back Lever

*Scored by: difficulty level, then longest hold*

- D1: Assisted Hang
- D2: Hang
- D3: Inverted Hang   (used 3 times)
- D4: German Hang   (used 3 times)
- D5: Tuck Back Lever   (used 2 times)
- D6: Banded Back Lever
- D7: Back Lever

### 18. Iron Cross

*Scored by: difficulty level, then longest hold*

- D1: 2 Feet Top Hold
- D2: Straight Bar Top Hold
- D3: Ring Top Hold   (Support hold in the top position on rings · used 2 times)
- D4: Elbow Supported Cross
- D5: Forearm Supported Iron Cross
- D6: Banded Iron Cross
- D7: Iron Cross

### 19. Front Lever

*Scored by: difficulty level, then longest hold*

- D1: Assisted Hang
- D2: Hang
- D3: Inverted Hang   (used 7 times)
- D4: Tuck Lever Negative
- D5: Tuck Front Lever   (used 3 times)
- D6: Banded Front Lever
- D7: Front Lever

### 20. Chin Hang

*Scored by: difficulty level, then longest hold*

- D1: Feet Assisted   (Chin hang with both feet assisting on the ground or a box)
- D2: Banded Hang   (Chin hang with heavy band assistance, hands on the bar)
- D3: Two-Hand Chin Hang   (Chin over the bar, both hands gripping · used 2 times)
- D4: One-Hand Chin Hang   (Chin over the bar, one hand gripping)
- D5: Banded Hands-Free   (Hands-free chin hang with heavy band assistance)
- D6: Chin Hang  (Chin over the bar with no hands on it)

### 21. Climbing

*Scored by: difficulty level, then longest hold*

- D1: Leaning Rope Hold   (used 1 time)
- D2: Assisted Rope Hang   (Feet may grip the rope)
- D3: No Feet Rope Hang   (used 2 times)
- D4: Feet Assisted Climb   (Feet may grip the rope · used 1 time)
- D5: No Feet Rope Climb   (used 2 times)
- D6: L-Sit Rope Climb   (used 1 time)
- D7: Assisted Pegboard   (Feet allowed for support on the board or frame)
- D8: Pegboard Climb

### 22. Handstand

*Scored by: difficulty level, then longest hold*

- D1: Pushup Hold
- D2: Elevated Pushup Hold
- D3: Wall Handstand   (used 3 times)
- D4: Freestanding   (Freestanding handstand, no wall)
- D5: 1 Arm Handstand

### 23. Headstand

*Scored by: difficulty level, then longest hold*

- D1: Wall Head Plank
- D2: Feet-Supported Tripod
- D3: Tripod Headstand   (used 6 times)
- D4: Forearm Headstand   (used 1 time)
- D5: Wall Assisted   (Headstand with no hands, wall support allowed)
- D6: Freestanding   (Freestanding headstand, no wall or hands)

### 24. L-Sit Hold

*Scored by: difficulty level, then longest hold*

- D1: 2 Feet Assisted Tuck
- D2: 1 Foot Assisted Tuck
- D3: Tuck Hold   (Both knees pulled to the chest)
- D4: 1 Leg L-Sit   (One leg extended)
- D5: L-Sit
- D6: V-Sit

---

## 3. Power

### 25. Kelly Snatch

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 26. 1A Snatch

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 27. Javelin

*Scored by: furthest or highest*

- D1: Stick
- D2: Short Javelin
- D3: Long Javelin

### 28. Shotput

*Scored by: furthest or highest*

- D1: Tennis Ball
- D2: Half Weight
- D3: Full Weight

### 29. Australian Football

*Scored by: win, draw or loss against another player*

- D1: Drop Kick
- D2: Drop Kick (5m)   (Drop kick to a partner)
- D3: Drop Kick (10m)   (Drop kick to a partner)
- D4: Drop Kick (20m)   (Drop kick to a partner)
- D5: Game

### 30. Vertical Jump

*Scored by: furthest or highest*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 31. Clean & Jerk

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 32. Snatch

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 33. Standing Broad Jump

*Scored by: furthest or highest*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 34. High Jump

*Scored by: furthest or highest*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 35. Arm Wrestling

*Scored by: win, draw or loss against another player*

**NONE**

### 36. Tug of War

*Scored by: win, draw or loss against another player*

**NONE**

---

## 4. Speed

### 37. 100m Sprint

*Scored by: fastest time*

> > Timed requires a time, game is a race against opponents

- D1: Walking
- D2: Timed
- D3: Game

### 38. Tag

*Scored by: win, draw or loss against another player*

**NONE**

### 39. T-Race
> Timed requires a time, game is a race against opponents
*Scored by: win, draw or loss against another player*

- D1: Walking
- D2: Timed
- D3: Game

### 40. Beach Flags

*Scored by: win, draw or loss against another player*
> Timed requires a time, game is a race against opponents
**NONE**

### 41. 200m Sprint

*Scored by: fastest time*
> Timed requires a time, game is a race against opponents
- D1: Walking
- D2: Timed
- D3: Game

### 42. Touch Rugby

*Scored by: win, draw or loss against another player*

- D1: Ball Passes
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Moving Pass (5m)   (Both players moving)
- D5: Game

### 43. Repeat High Jump

*Scored by: difficulty level, then fastest time*

- D1: Ankle height   (used 2 times)
- D2: Knee height   (used 3 times)
- D3: Hip height   (used 6 times)
- D4: Belly Button Height
- D5: Rib Height
- D6: Shoulder height

### 44. Rats & Rabbits

*Scored by: win, draw or loss against another player*
> Timed requires a time, game is a race against opponents
**NONE**

### 45. Speed Chess

*Scored by: win, draw or loss against another player*

**NONE**

### 46. American Football

*Scored by: win, draw or loss against another player*

- D1: Ball Passes
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Moving Pass (5m)   (Both players moving)
- D5: Game

### 47. Capture the Flag

*Scored by: win, draw or loss against another player*

**NONE**

### 48. Kabaddi

*Scored by: win, draw or loss against another player*

**NONE**

---

## 5. Anaerobic Endurance

### 49. Chinup Contest

*Scored by: difficulty level, then most reps*

- D1: High Ring Row
- D2: Low Ring Row
- D3: Elevated Ring Row
- D4: Banded Chinup   (used 2 times)
- D5: Chin Up   (used 3 times)
- D6: Muscle Up

### 50. Pushup Contest

*Scored by: difficulty level, then most reps*

- D1: Elevated Knee Push Up
- D2: Knee Push Up   (used 3 times)
- D3: Push Up   (used 15 times)
- D4: 1 Arm Pushup   (used 3 times)
- D5: Handstand Pushup
- D6: Deficit Handstand   (Handstand push-up from parallettes or blocks, below floor level)

### 51. Tibialis Curl

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 52. Finger Pushup

*Scored by: difficulty level, then most reps*

- D1: Elevated Knee   (Knee finger pushups with hands elevated)
- D2: Knee Finger Pushup   (used 7 times)
- D3: Finger Pushup   (used 3 times)
- D4: 4 Finger Pushup
- D5: 3 Finger Pushup
- D6: 2 Finger Pushup
- D7: Thumb Pushup

### 53. GHD Situp

*Scored by: difficulty level, then most reps*
Weighted GHD requires weight and reps
- D1: Dead Bug
- D2: Crunch
- D3: Sit Up
- D4: GHD Situp   (used 5 times)
- D5: Weighted GHD Situp

### 54. Leg Ext Hold

*Scored by: difficulty level, then longest hold*

This should be weight and time

### 55. Ab Rollout

*Scored by: difficulty level, then most reps*

- D1: Elevated Hold   (Kneeling hold with the wheel elevated)
- D2: Kneeling Rollout   (used 1 time)
- D3: Elevated Kneeling   (Kneeling rollout with hands elevated)
- D4: Banded Rollout   (Standing rollout with heavy band assistance)
- D5: Full Rollout   (Standing ab rollout, no assistance)

### 56. Hamstring Curl

*Scored by: difficulty level, then most reps*

- D1: Glute Thrust
- D2: Ball Glute Thrust   (Glute thrust with heels on a yoga ball)
- D3: Floor Slider Curl
- D4: Banded Nordic Curl   (used 2 times)
- D5: Nordic Curl

### 57. Sandbag to Shoulder

*Scored by: difficulty level, then most reps*

- D1: 5kg
- D2: 10kg
- D3: 25kg   (used 2 times)
- D4: 50kg
- D5: 80kg
- D6: 100kg

### 58. Wall Sit

*Scored by: longest hold*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 59. Toe Lift

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 60. Lunges

*Scored by: difficulty level, then most reps*

- D1: Assisted Elevated   (Rear foot raised, hand on a support for balance)
- D2: Elevated Lunge   (Rear foot raised, no support)
- D3: Lunge  (Both feet on the floor — the plain lunge)
- D4: Jumping Switch Lunges  (Switch legs in the air, no pause between reps)
- D5: Jumping Bulgarian   (Rear foot raised on a box, switching legs in the air)

---

## 6. Aerobic Endurance

### 61. Burpee Broad Jump

*Scored by: difficulty level, then fastest time*

- D1: 25m
- D2: 50m
- D3: 100m 
- D4: 200m 

### 62. Running

*Scored by: difficulty level, then fastest time*

- D1: 250m
- D2: 500m   (used 1 time)
- D3: 1000m   (used 2 times)

### 63. Cycling

*Scored by: difficulty level, then fastest time*

- D1: 250m   (used 1 time)
- D2: 500m   (used 6 times)
- D3: 1000m   (used 3 times)

### 64. Ski Erg

*Scored by: difficulty level, then fastest time*

- D1: 250m   (used 1 time)
- D2: 500m   (used 1 time)
- D3: 1000m   (used 4 times)

### 65. Row Erg

*Scored by: difficulty level, then fastest time*

- D1: 250m   (used 2 times)
- D2: 500m   (used 2 times)
- D3: 1000m   (used 1 time)

### 66. Breath Hold

*Scored by: longest hold*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 67. Weighted Carry

*Scored by: difficulty level, then fastest time*

- D1: 5kg — 200m
- D2: 10kg — 200m
- D3: 25kg — 200m   (used 6 times)
- D4: 50kg — 200m   (used 9 times)
- D5: 80kg — 200m
- D6: 100kg — 200m

### 68. Animal Crawl

*Scored by: difficulty level, then fastest time*

- D1: 25m Crawl
- D2: 25m Bear Crawl
- D3: 25m Lizard Crawl
- D4: 25m Duck Walk
- D5: 100m Duck Walk

### 69. Bronco

*Scored by: difficulty level, then fastest time*

- D1: 1 Lap   (used 2 times)
- D2: 2 Laps
- D3: 3 Laps   (used 7 times)
- D4: 4 Laps
- D5: 5 Laps   (used 2 times)

### 70. Scooting

*Scored by: difficulty level, then fastest time*

- D1: 250m
- D2: 500m
- D3: 1000m

### 71. Wheelbarrow Push

*Scored by: difficulty level, then fastest time*

- D1: 5kg — 200m
- D2: 10kg — 200m
- D3: 25kg — 200m
- D4: 50kg — 200m
- D5: 80kg — 200m
- D6: 100kg — 200m
- D7: 200kg — 200m

### 72. Wheelbarrow Pull

*Scored by: difficulty level, then fastest time*

- D1: 5kg — 200m
- D2: 10kg — 200m
- D3: 25kg — 200m
- D4: 50kg — 200m
- D5: 80kg — 200m
- D6: 100kg — 200m
- D7: 200kg — 200m

---

## 7. Flexibility

### 73. Rear Hand Clasp

*Scored by: difficulty level, then longest hold*

- D1: Towel-Assisted   (Hands hold opposite ends of a towel behind the back)
- D2: Block Assisted
- D3: Half Block Assisted   (used 3 times)
- D4: Finger Tips Touch
- D5: Finger Clasp   (used 1 time)
- D6: Palm Clasp
- D7: Butterfly Clasp

### 74. Bridge

*Scored by: difficulty level, then longest hold*

- D1: Glute Bridge   (used 1 time)
- D2: Wall Assisted Bridge   (used 3 times)
- D3: Headstand Bridge   (used 1 time)
- D4: Bridge   (used 13 times)
- D5: Straight Arm Bridge
- D6: Rainbow Bridge   (used 3 times)

### 75. Forward Fold

*Scored by: difficulty level, then longest hold*

- D1: Elevated Seated   (Seated fold with the hips elevated on a block)
- D2: Standing Fold
- D3: Standing · Bent Knees   (Standing fold with knees bent · used 3 times)
- D4: Standing · Straight   (Standing fold with straight legs · used 1 time)
- D5: Fingertips to Floor   (Straight legs, fingertips reach the floor)
- D6: Palms to Floor   (Straight legs, palms flat on the floor)
- D7: Elbows to Toes   (Straight legs, elbows reach the toes)
- D8: Head to Legs   (Full fold — head touching the legs)

### 76. Needle Pose

*Scored by: difficulty level, then longest hold*

- D1: Seated Quad Stretch
- D2: Standing Quad Stretch
- D3: 2 Hands to Back Foot
- D4: 1 Foot, 1 Knee
- D5: 2 Knee
- D6: Full Needle Pose

### 77. Forward Split

*Scored by: difficulty level, then longest hold*

- D1: 2 Blocks   (Front split supported on 2 blocks under the front hip · used 1 time)
- D2: 1.5 Blocks   (Front split supported on 1.5 blocks · used 1 time)
- D3: 1 Block   (Front split supported on 1 block · used 1 time)
- D4: 0.5 Blocks   (Front split supported on half a block)
- D5: Front Split
- D6: Over Split

### 78. Middle Split

*Scored by: difficulty level, then longest hold*

- D1: 2 Blocks   (Middle split supported on 2 blocks · used 2 times)
- D2: 1.5 Blocks   (Middle split supported on 1.5 blocks · used 1 time)
- D3: 1.25 Blocks   (Middle split supported on 1.25 blocks)
- D4: 1 Block   (Middle split supported on 1 block)
- D5: 0.75 Blocks   (Middle split supported on 0.75 blocks)
- D6: 0.5 Blocks   (Middle split supported on half a block)
- D7: Middle Split

### 79. Standing Split

*Scored by: difficulty level, then longest hold*

- D1: Ankle Height   (Standing leg lift to ankle height)
- D2: Knee Height   (Standing leg lift to knee height)
- D3: Hip Height   (Standing leg lift to hip height · used 2 times)
- D4: Rib Height
- D5: Shoulder Height
- D6: Head Height
- D7: Standing Split

### 80. Foot Behind Head Pose

*Scored by: difficulty level, then longest hold*

- D1: Assisted Pidgeon Pose
- D2: 90/90 Pose   (used 1 time)
- D3: Pidgeon Pose   (used 2 times)
- D4: Elevated Pidgeon Pose   (used 1 time)
- D5: Foot to Head Pose   (used 2 times)
- D6: Foot Behind Head Pose
- D7: Both Feet Behind Head

### 81. Shoulder Dislocate

*Scored by: narrowest hand width, and reps at that width*

> Your note: this is already how it works. Hand width is measured in cm and a narrower grip
> scores higher; reps are recorded alongside it. My sheet mislabelled it, not the app.

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 82. Pancake

*Scored by: difficulty level, then longest hold*

- D1: Over 2 Blocks   (Seated elevated on more than 2 blocks · used 1 time)
- D2: 2 Blocks   (Seated elevated on 2 blocks · used 2 times)
- D3: 1.5 Blocks   (Seated elevated on 1.5 blocks · used 2 times)
- D4: 1 Block   (Seated elevated on 1 block)
- D5: 0.5 Blocks   (Seated elevated on half a block)
- D6: Elbows to Floor   (Fold forward until the elbows rest flat on the floor)
- D7: Head to Floor   (Fold forward until the head touches the floor)

### 83. Side Bend

*Scored by: difficulty level, then longest hold*

- D1: Standing Bend   (Feet planted, one arm overhead, bend directly to the side)
- D2: Gate Pose   (Parighasana — kneel on one knee, opposite leg extended to the side, bend over it)
- D3: Seated Bend   (Parsva Upavistha — seated wide-legged, torso laid along one leg reaching the foot)
- D4: Side-Split Lateral   (Wide or side-split stance, torso flat along one leg, chest open)

### 84. Full Bound Twist

*Scored by: difficulty level, then longest hold*

- D1: Seated Twist   (Sit tall, rotate the torso and hold with one hand behind · used 2 times)
- D2: Half Lord   (Ardha Matsyendrasana — knee crossed over, elbow outside it, rotate toward the knee)
- D3: Bound Twist   (Marichyasana C — arms bound around the leg to lock the rotation deeper)
- D4: Full Bound Twist   (Marichyasana D — deepest bound spinal rotation)

---

## 8. Body Awareness

### 85. Tae Kwon Do

*Scored by: win, draw or loss against another player*

> Your earlier note here said "scored by reps until the game", which asked for a ladder.
> `NONE` is the later answer so I've taken it, but the two contradict each other.

**NONE**

### 86. Breakdancing

*Scored by: difficulty level, then longest hold*

- D1: Indian Step
- D2: Salsa Step
- D3: 6 Step
- D4: 3 Step
- D5: Baby Freeze
- D6: Pilot Freeze
- D7: Windmill
- D8: Game

### 87. Trampolining

*Scored by: difficulty level, then most reps*

- D1: Basic Bounce
- D2: 180 Spin   (used 1 time)
- D3: 360 Spin   (used 2 times)
- D4: Forward Flip   (used 3 times)
- D5: Back Flip   (used 1 time)
- D6: Front Flip 180
- D7: Game

### 88. Jump Rope

*Scored by: difficulty level, then most reps*

- D1: Basic Two-Foot Jump   (used 11 times)
- D2: Alternating Feet   (Alternating single-foot jumps · used 1 time)
- D3: Criss-Cross   (used 9 times)
- D4: Double Under   (used 6 times)
- D5: Single Dutch
- D6: Double Dutch
- D7: Game

### 89. Wrestling

*Scored by: win, draw or loss against another player*

**NONE**

### 90. Gymnastics

*Scored by: difficulty level, then most reps*

- D1: Forward Roll   (used 1 time)
- D2: Backward Roll   (used 1 time)
- D3: Cartwheel   (used 1 time)
- D4: Roundoff   (used 2 times)
- D5: Handspring   (Front or back handspring)
- D6: One-Hand Cartwheel
- D7: Front Handspring
- D8: Game

### 91. Balance Ball

*Scored by: difficulty level, then longest hold*

- D1: Seated   (used 1 time)
- D2: Kneeling   (used 2 times)
- D3: Kneeling · No Hands   (Kneeling on the ball with no hands touching it · used 1 time)
- D4: 1 Leg · No Hands   (Standing on one leg, no hands · used 1 time)
- D5: Standing   (used 1 time)
- D6: Game

### 92. SKATE

*Scored by: difficulty level, then most reps*

- D1: 180 Pivot   (used 1 time)
- D2: 360 Pivot   (used 6 times)
- D3: Ollie   (used 1 time)
- D4: Pop Shove It
- D5: Kickflip
- D6: Game

### 93. Fencing

*Scored by: win, draw or loss against another player*

**NONE**

### 94. Juggling

*Scored by: difficulty level, then longest hold*

- D1: 2 Ball (both hands)   (used 4 times)
- D2: 2 Ball (one hand)   (used 3 times)
- D3: 3 Ball   (used 5 times)
- D4: Game

### 95. Foot Juggling

*Scored by: difficulty level, then most reps*

- D1: 2 Bounce
- D2: 1 Bounce
- D3: 0 Bounce
- D4: Game

### 96. Slackline

*Scored by: longest hold*

- D1: Single Leg Balance
- D2: Plank Walk
- D3: Beam Walk
- D4: Slackline Walk
- D5: Slackline Bounce
- D6: Game

---

## 9. Coordination

### 97. Volleyball

*Scored by: win, draw or loss against another player*

- D1: Sets
- D2: Digs
- D3: Partner Digs (2m)
- D4: Partner Digs (5m)
- D5: Game

### 98. Baseball

*Scored by: win, draw or loss against another player*

- D1: Pitch Ball
- D2: Bat Ball
- D3: Pitch & Bat (2m)
- D4: Pitch & Bat (5m)
- D5: Game

### 99. Teqball

*Scored by: win, draw or loss against another player*

- D1: Juggles · 2 Bounce   (Foot juggles, two bounces allowed between touches)
- D2: Partner Pass   (Passes to a partner, one bounce allowed)
- D3: Partner Pass (2m)   (Passes to a partner from 2m, one bounce allowed)
- D4: Game

### 100. Tennis

*Scored by: win, draw or loss against another player*

- D1: Vertical Juggles
- D2: Partner Hits (2m)
- D3: Partner Hits (5m)
- D4: Partner Hits (10m)
- D5: Game

### 101. Cricket

*Scored by: win, draw or loss against another player*

- D1: Bowl Ball
- D2: Bat Ball
- D3: Bowl & Bat (2m)
- D4: Bowl & Bat (5m)
- D5: Game

### 102. Badminton

*Scored by: win, draw or loss against another player*

- D1: Vertical Juggles
- D2: Partner Hits (2m)
- D3: Partner Hits (5m)
- D4: Partner Hits (10m)
- D5: Game

### 103. Basketball

*Scored by: win, draw or loss against another player*

- D1: Bounce Ball
- D2: 2 Ball Bounce
- D3: 2 Ball Side to Side
- D4: 2 Ball Back & Forth
- D5: Game

### 104. Football

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 105. Hockey

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 106. Squash

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 107. Lacrosse

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 108. Ultimate Frisbee

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

---

## 10. Aim & Precision

### 109. Netball

*Scored by: win, draw or loss against another player*

- D1: Chest Pass
- D2: Shot Under Hoop   (Standing directly under the hoop)
- D3: Shot (2m)
- D4: Shot (5m)
- D5: Game

### 110. Bocce

*Scored by: win, draw or loss against another player*

- D1: Bowl Ball
- D2: Within 5m of Jack
- D3: Within 1m of Jack
- D4: Hit the Jack   (Strike the jack itself from the throwing line)
- D5: Game

### 111. Dodgeball

*Scored by: win, draw or loss against another player*

- D1: Throw Ball
- D2: Throw & Catch (1m)   (With a partner)
- D3: Throw & Catch (5m)
- D4: Throw & Catch (10m)
- D5: Game

### 112. Carrom

*Scored by: win, draw or loss against another player*

- D1: Strike a Piece   (Flick the striker from the baseline and make contact)
- D2: Pocket a Piece
- D3: Game

### 113. Archery

*Scored by: win, draw or loss against another player*

- D1: Hit the Target (5m)
- D2: Hit the Target (10m)
- D3: Hit the Gold (10m)   (Inner gold rings of the target face)
- D4: Hit the Gold (20m)
- D5: Game

### 114. Bowling

*Scored by: win, draw or loss against another player*

- D1: Partner Bowl
- D2: Partner Bowl (5m)
- D3: Partner Bowl (10m)
- D4: Partner Bowl (20m)
- D5: Game

### 115. Darts

*Scored by: win, draw or loss against another player*

- D1: Hit the Board   (Land all three darts of a visit on the board)
- D2: Named Number   (Hit a number called before you throw)
- D3: Named Double   (Hit the double ring of a number called before you throw)
- D4: Bullseye
- D5: Game

### 116. Disc Golf

*Scored by: fewest strokes over 4 holes*

- D1: Putt (2m)
- D2: Putt (5m)
- D3: Approach (20m)   (Land inside a set radius of the basket)
- D4: Game (4 Holes)

### 117. Golf

*Scored by: fewest strokes over 4 holes*

- D1: Putt (2m)
- D2: Putt (5m)
- D3: Chip (10m)
- D4: Game (4 Holes)

### 118. Handball

*Scored by: win, draw or loss against another player*

- D1: Partner Pass (2m)
- D2: Partner Pass (5m)
- D3: Past a Keeper   (Score with a keeper in goal)
- D4: Game

### 119. Table Tennis

*Scored by: win, draw or loss against another player*

- D1: Vertical Juggles   (Bounce the ball on the bat, standing)
- D2: Wall Juggles
- D3: Partner Hits
- D4: Game

### 120. Kubb

*Scored by: win, draw or loss against another player*

- D1: Throw Baton
- D2: Hit Kubb (2m)
- D3: Hit Kubb (5m)
- D4: Hit Kubb (10m)
- D5: Game

---
