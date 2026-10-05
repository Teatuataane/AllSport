 # Difficulty Levels — Review

All 126 AllSport events (Shoulder Dislocate and Lunges removed 5 Oct 2026). Go through them and set the difficulty levels for each one.

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

### 13. Pullover & Press

*Scored by: heaviest weight lifted*

**NONE**

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.

### 14. Loaded Lunge

*Scored by: heaviest weight lifted*

**NONE**

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.
> The tier is the TOTAL load, not the load per side.

## 2. Calisthenics

### 15. 1 Leg Squat

*Scored by: difficulty level, then most reps*

- D1: Assisted Lunge   (used 4 times)
- D2: Lunge   (used 3 times)
- D3: Bulgarian Split Squat   (used 9 times)
- D4: Shrimp Squat   (used 3 times)
- D5: Pistol Squat   (used 7 times)
- D6: Dragon Squat   (used 2 times)

### 16. Human Flag

*Scored by: difficulty level, then longest hold*

- D1: Elevated Side Plank
- D2: Side Plank   (used 4 times)
- D3: 1 Leg Side Plank   (used 3 times)
- D4: Assisted Flag
- D5: Tuck Flag
- D6: Full Flag

### 17. Windshield Wipers

*Scored by: difficulty level, then most reps*

- D1: Tuck Floor Wiper   (used 2 times)
- D2: Floor Wipers   (used 9 times)
- D3: Hanging Tuck Circles   (used 3 times)
- D4: Hanging Circles   (used 3 times)
- D5: Windshield Wipers

### 18. Planche

*Scored by: difficulty level, then longest hold*

- D1: Pseudo Planche Lean   (used 1 time)
- D2: Elevated Pseudo Lean   (Pseudo planche lean with hands elevated · used 1 time)
- D3: Banded Tuck Planche
- D4: Tuck Planche   (used 5 times)
- D5: Banded Planche
- D6: Straddle Planche
- D7: Full Planche

### 19. Back Lever

*Scored by: difficulty level, then longest hold*

- D1: Assisted Hang
- D2: Hang
- D3: Inverted Hang   (used 3 times)
- D4: German Hang   (used 3 times)
- D5: Tuck Back Lever   (used 2 times)
- D6: Banded Back Lever
- D7: Back Lever

### 20. Iron Cross

*Scored by: difficulty level, then longest hold*

> Changed 5 Oct 2026 (Tāne): D4 and D5 renamed (Elbow / Forearm Iron Cross). Same holds.

- D1: 2 Feet Top Hold
- D2: Straight Bar Top Hold
- D3: Ring Top Hold   (Support hold in the top position on rings · used 2 times)
- D4: Elbow Iron Cross
- D5: Forearm Iron Cross
- D6: Banded Iron Cross
- D7: Iron Cross

### 21. Front Lever

*Scored by: difficulty level, then longest hold*

- D1: Assisted Hang
- D2: Hang
- D3: Inverted Hang   (used 7 times)
- D4: Tuck Lever Negative
- D5: Tuck Front Lever   (used 3 times)
- D6: Banded Front Lever
- D7: Front Lever

### 22. Chin Hang

*Scored by: difficulty level, then longest hold*

- D1: Feet Assisted   (Chin hang with both feet assisting on the ground or a box)
- D2: Banded Hang   (Chin hang with heavy band assistance, hands on the bar)
- D3: Two-Hand Chin Hang   (Chin over the bar, both hands gripping · used 2 times)
- D4: One-Hand Chin Hang   (Chin over the bar, one hand gripping)
- D5: Banded Hands-Free   (Hands-free chin hang with heavy band assistance)
- D6: Chin Hang  (Chin over the bar with no hands on it)

### 23. Skull Hang

*Scored by: difficulty level, then longest hold*

- D1: Feet Assisted   (Bar behind the neck with both feet assisting on the ground or a box)
- D2: Banded Hang   (Heavy band assistance, both hands on the bar)
- D3: Two-Hand Hang   (Bar resting behind the neck, both hands gripping)
- D4: One-Hand Hang   (Bar resting behind the neck, one hand gripping)
- D5: Banded Hands-Free   (No hands on the bar, heavy band assistance)
- D6: Free Hang   (Bar behind the neck, no hands and no band)

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.
> Deliberately the Chin Hang ladder unchanged. If this position turns out harder to hold,
> every rung should come down together rather than one at a time.

### 24. Climbing

*Scored by: difficulty level, then fastest time*

> Changed 5 Oct 2026 (Tāne): Rope rungs renamed, L-Sit Rope Climb and both pegboard rungs removed, the Game is now a HORSE-style match.

- D1: Assisted Hang   (used 1 time)
- D2: Hang   (Feet may grip the rope)
- D3: No Feet Hang   (used 2 times)
- D4: Feet Assisted Climb   (Feet may grip the rope · used 1 time)
- D5: No Feet Climb   (used 2 times)
- D6: Game   (Like HORSE: players take turns to nominate a climb, the fastest up it takes the point, first to 3 points wins)

### 25. Handstand

*Scored by: difficulty level, then longest hold*

- D1: Pushup Hold
- D2: Elevated Pushup Hold
- D3: Wall Handstand   (used 3 times)
- D4: Freestanding   (Freestanding handstand, no wall)
- D5: 1 Arm Handstand

### 26. Headstand

*Scored by: difficulty level, then longest hold*

- D1: Wall Head Plank
- D2: Feet-Supported Tripod
- D3: Tripod Headstand   (used 6 times)
- D4: Forearm Headstand   (used 1 time)
- D5: Wall Assisted   (Headstand with no hands, wall support allowed)
- D6: Freestanding   (Freestanding headstand, no wall or hands)

### 27. L-Sit Hold

*Scored by: difficulty level, then longest hold*

> Changed 5 Oct 2026 (Tāne): Tuck Hold is on p-bars; Floor Tuck Hold added above it.

- D1: 2 Feet Assisted Tuck
- D2: 1 Foot Assisted Tuck
- D3: Tuck Hold   (Both knees pulled to the chest, on p-bars)
- D4: Floor Tuck Hold   (Both knees pulled to the chest, hands on the floor)
- D5: 1 Leg L-Sit   (One leg extended)
- D6: L-Sit
- D7: V-Sit

---

## 3. Power

### 28. Kelly Snatch

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 29. 1A Snatch

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 30. Javelin

*Scored by: furthest throw*

> Changed 5 Oct 2026 (Tāne): Levels removed: one implement, the full javelin, and the distance is the score.

**NONE**

### 31. Shotput

*Scored by: furthest throw*

> Changed 5 Oct 2026 (Tāne): Levels removed: one implement, the full-weight shot, and the distance is the score.

**NONE**

### 32. Australian Football

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): D2 may kick to a target as well as a partner.

- D1: Drop Kick
- D2: Drop Kick (5m)   (Drop kick to a partner or target)
- D3: Drop Kick (10m)   (Drop kick to a partner)
- D4: Drop Kick (20m)   (Drop kick to a partner)
- D5: Game

### 33. Vertical Jump

*Scored by: furthest or highest*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 34. Clean & Jerk

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 35. Snatch

*Scored by: heaviest weight lifted*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 36. Standing Broad Jump

*Scored by: furthest or highest*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 37. High Jump

*Scored by: furthest or highest*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 38. Arm Wrestling

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Levels removed, only the game.

**NONE**

### 39. Tug of War

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Levels removed, only the game.

**NONE**

---

## 4. Speed

### 40. 100m Sprint

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

### 41. Tag

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

### 42. T-Race

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

### 43. Beach Flags

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

### 44. 200m Sprint

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

### 45. Touch Rugby

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Pass rungs renamed; the moving pass is now from 10m.

- D1: Passes
- D2: Pass (2m)
- D3: Pass (5m)
- D4: Pass (10m)   (Both players moving)
- D5: Game

### 46. Repeat Vault

*Scored by: difficulty level, then fastest time*

> Changed 5 Oct 2026 (Tāne): Renamed from Repeat High Jump. Same heights, so its history carries over.

- D1: Ankle height   (used 2 times)
- D2: Knee height   (used 3 times)
- D3: Hip height   (used 6 times)
- D4: Belly Button Height
- D5: Rib Height
- D6: Shoulder height

### 47. Rats & Rabbits

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

### 48. Speed Chess

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Levels removed, only the game.

**NONE**

### 49. American Football

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Pass rungs out to 20m; the moving pass is gone.

- D1: Passes
- D2: Pass (2m)
- D3: Pass (5m)
- D4: Pass (10m)
- D5: Pass (20m)
- D6: Game

### 50. Capture the Flag

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

### 51. Kabaddi

*Scored by: win, draw or loss against another player; the time is recorded alongside when one is taken*

> Changed 5 Oct 2026 (Tāne): Levels removed: only win/draw/loss, time optional.

**NONE**

---

## 5. Anaerobic Endurance

### 52. Chinups

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): Renamed from Chinup Contest. Ladder unchanged.

- D1: High Ring Row
- D2: Low Ring Row
- D3: Elevated Ring Row
- D4: Banded Chinup   (used 2 times)
- D5: Chin Up   (used 3 times)
- D6: Muscle Up

### 53. Pushups

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): Renamed from Pushup Contest. Ladder unchanged.

- D1: Elevated Knee Push Up
- D2: Knee Push Up   (used 3 times)
- D3: Push Up   (used 15 times)
- D4: 1 Arm Pushup   (used 3 times)
- D5: Handstand Pushup
- D6: Deficit Handstand   (Handstand push-up from parallettes or blocks, below floor level)

### 54. Tibialis Curl

*Scored by: heaviest load, then most reps in 2 minutes*

> Changed 5 Oct 2026 (Tāne): Fixed loads removed: any weight and reps are entered. Heavier always wins; reps break the tie.

**NONE**

### 55. Finger Pushup

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): The 4, 3, 2 finger and thumb rungs replaced by one 1 Arm Finger Pushup.

- D1: Elevated Knee   (Knee finger pushups with hands elevated)
- D2: Knee Finger Pushup   (used 7 times)
- D3: Finger Pushup   (used 3 times)
- D4: 1 Arm Finger Pushup

### 56. GHD Situp

*Scored by: difficulty level, then most reps*
Weighted GHD requires weight and reps
- D1: Dead Bug
- D2: Crunch
- D3: Sit Up
- D4: GHD Situp   (used 5 times)
- D5: Weighted GHD Situp

### 57. Leg Ext Hold

*Scored by: difficulty level, then longest hold*

> Changed 5 Oct 2026 (Tāne): Checked: it records the load and the hold time, heavier wins and the hold breaks a tie.

This should be weight and time

### 58. Ab Rollout

*Scored by: difficulty level, then most reps*

- D1: Elevated Hold   (Kneeling hold with the wheel elevated)
- D2: Kneeling Rollout   (used 1 time)
- D3: Elevated Kneeling   (Kneeling rollout with hands elevated)
- D4: Banded Rollout   (Standing rollout with heavy band assistance)
- D5: Full Rollout   (Standing ab rollout, no assistance)

### 59. Hamstring Curl

*Scored by: difficulty level, then most reps*

- D1: Glute Thrust
- D2: Ball Glute Thrust   (Glute thrust with heels on a yoga ball)
- D3: Floor Slider Curl
- D4: Banded Nordic Curl   (used 2 times)
- D5: Nordic Curl

### 60. Sandbag to Shoulder

*Scored by: difficulty level, then most reps*

- D1: 5kg
- D2: 10kg
- D3: 25kg   (used 2 times)
- D4: 50kg
- D5: 80kg
- D6: 100kg

### 61. Wall Sit

*Scored by: longest hold*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 62. Toe Lift

*Scored by: heaviest load, then longest hold*

Changed 29 Sept 2026 (Tāne): weight and hold time, like Leg Ext Hold. No levels: the load is entered.

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

---

### 63. Calf Raises

*Scored by: difficulty level, then most reps*

- D1: Two-Leg Raise   (Both feet flat on the floor, rising to the top of the toes)
- D2: Two-Leg Deficit   (Both feet on a step, heels dropping below the toes each rep)
- D3: Single-Leg Raise   (One foot on the floor, the other held clear)
- D4: Single-Leg Deficit   (One foot on a step, heel dropping below the toes each rep)

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.

## 6. Endurance

### 64. Burpee Broad Jump

*Scored by: difficulty level, then fastest time*

- D1: 25m
- D2: 50m
- D3: 100m 
- D4: 200m 

### 65. Running

*Scored by: best effort: any distance of at least 1000m and its time, ranked on the 1000m time it predicts*

> Changed 5 Oct 2026 (Tāne): Open distance and time. A 4:00 km beats a 15:00 3km, which predicts about 4:41.

**NONE**

### 66. Cycling

*Scored by: best effort: any distance of at least 1000m and its time, ranked on the 1000m time it predicts*

> Changed 5 Oct 2026 (Tāne): Open distance and time.

**NONE**

### 67. Ski Erg

*Scored by: best effort: any distance of at least 1000m and its time, ranked on the 1000m time it predicts*

> Changed 5 Oct 2026 (Tāne): Open distance and time.

**NONE**

### 68. Row Erg

*Scored by: best effort: any distance of at least 1000m and its time, ranked on the 1000m time it predicts*

> Changed 5 Oct 2026 (Tāne): Open distance and time.

**NONE**

### 69. Breath Hold

*Scored by: longest hold*

_No levels yet._

- D1: 
- D2: 
- D3: 
- D4: 
- D5: 

### 70. Sandbag Carry

*Scored by: heaviest load, then furthest distance, then fastest time*

> Changed 5 Oct 2026 (Tāne): Open weight, distance and time.

**NONE**

### 71. Animal Crawl

*Scored by: difficulty level, then best effort: any distance of at least 25m and its time, ranked on the 25m time it predicts*

> Changed 5 Oct 2026 (Tāne): Crawl styles are the levels; distance and time are open. The old 100m Duck Walk lands on Duck Walk.

- D1: Crawl   (Hands and knees)
- D2: Bear Crawl   (Hands and feet, hips high, opposite hand and foot together)
- D3: Lizard Crawl   (Chest low, elbows bent, hips down)
- D4: Duck Walk   (Deep squat, hips below knees, stepping without standing up)

### 72. Bronco

*Scored by: difficulty level, then fastest time*

- D1: 1 Lap   (used 2 times)
- D2: 2 Laps
- D3: 3 Laps   (used 7 times)
- D4: 4 Laps
- D5: 5 Laps   (used 2 times)

### 73. Scooting

*Scored by: best effort: any distance of at least 1000m and its time, ranked on the 1000m time it predicts*

> Changed 5 Oct 2026 (Tāne): Open distance and time.

**NONE**

### 74. Farmer Carry

*Scored by: heaviest load, then furthest distance, then fastest time*

> Changed 5 Oct 2026 (Tāne): Open weight, distance and time.

**NONE**

### 75. Weighted Drag

*Scored by: heaviest load, then furthest distance, then fastest time*

> Changed 5 Oct 2026 (Tāne): Open weight, distance and time.

**NONE**

---

> Renamed from Wheelbarrow Pull, Sept 2026. Ladder unchanged; only the implement is named.

## 7. Flexibility

### 76. Rear Hand Clasp

*Scored by: difficulty level, then longest hold*

- D1: Towel-Assisted   (Hands hold opposite ends of a towel behind the back)
- D2: Block Assisted
- D3: Half Block Assisted   (used 3 times)
- D4: Finger Tips Touch
- D5: Finger Clasp   (used 1 time)
- D6: Palm Clasp
- D7: Butterfly Clasp

### 77. Bridge

*Scored by: difficulty level, then longest hold*

- D1: Glute Bridge   (used 1 time)
- D2: Wall Assisted Bridge   (used 3 times)
- D3: Headstand Bridge   (used 1 time)
- D4: Bridge   (used 13 times)
- D5: Straight Arm Bridge
- D6: Rainbow Bridge   (used 3 times)

### 78. Forward Fold

*Scored by: difficulty level, then longest hold*

- D1: Elevated Seated   (Seated fold with the hips elevated on a block)
- D2: Standing Fold
- D3: Standing · Bent Knees   (Standing fold with knees bent · used 3 times)
- D4: Standing · Straight   (Standing fold with straight legs · used 1 time)
- D5: Fingertips to Floor   (Straight legs, fingertips reach the floor)
- D6: Palms to Floor   (Straight legs, palms flat on the floor)
- D7: Elbows to Toes   (Straight legs, elbows reach the toes)
- D8: Head to Legs   (Full fold — head touching the legs)

### 79. Needle Pose

*Scored by: difficulty level, then longest hold*

- D1: Seated Quad Stretch
- D2: Standing Quad Stretch
- D3: 2 Hands to Back Foot
- D4: 1 Foot, 1 Knee
- D5: 2 Knee
- D6: Full Needle Pose

### 80. Forward Split

*Scored by: difficulty level, then longest hold*

- D1: 2 Blocks   (Front split supported on 2 blocks under the front hip · used 1 time)
- D2: 1.5 Blocks   (Front split supported on 1.5 blocks · used 1 time)
- D3: 1 Block   (Front split supported on 1 block · used 1 time)
- D4: 0.5 Blocks   (Front split supported on half a block)
- D5: Front Split
- D6: Over Split

### 81. Middle Split

*Scored by: difficulty level, then longest hold*

> Changed 5 Oct 2026 (Tāne): 3 Blocks added at the bottom; 1.25 and 0.75 removed.

- D1: 3 Blocks   (Middle split supported on 3 blocks)
- D2: 2 Blocks   (Middle split supported on 2 blocks · used 2 times)
- D3: 1.5 Blocks   (Middle split supported on 1.5 blocks · used 1 time)
- D4: 1 Block   (Middle split supported on 1 block)
- D5: 0.5 Blocks   (Middle split supported on half a block)
- D6: Middle Split

### 82. Standing Split

*Scored by: difficulty level, then longest hold*

- D1: Ankle Height   (Standing leg lift to ankle height)
- D2: Knee Height   (Standing leg lift to knee height)
- D3: Hip Height   (Standing leg lift to hip height · used 2 times)
- D4: Rib Height
- D5: Shoulder Height
- D6: Head Height
- D7: Standing Split

### 83. Foot Behind Head Pose

*Scored by: difficulty level, then longest hold*

- D1: Assisted Pidgeon Pose
- D2: 90/90 Pose   (used 1 time)
- D3: Pidgeon Pose   (used 2 times)
- D4: Elevated Pidgeon Pose   (used 1 time)
- D5: Foot to Head Pose   (used 2 times)
- D6: Foot Behind Head Pose
- D7: Both Feet Behind Head

### 84. Pancake

*Scored by: difficulty level, then longest hold*

> Changed 5 Oct 2026 (Tāne): Over 2 Blocks renamed 3 Blocks.

- D1: 3 Blocks   (Seated elevated on 3 blocks · used 1 time)
- D2: 2 Blocks   (Seated elevated on 2 blocks · used 2 times)
- D3: 1.5 Blocks   (Seated elevated on 1.5 blocks · used 2 times)
- D4: 1 Block   (Seated elevated on 1 block)
- D5: 0.5 Blocks   (Seated elevated on half a block)
- D6: Elbows to Floor   (Fold forward until the elbows rest flat on the floor)
- D7: Head to Floor   (Fold forward until the head touches the floor)

### 85. Side Bend

*Scored by: difficulty level, then longest hold*

- D1: Standing Bend   (Feet planted, one arm overhead, bend directly to the side)
- D2: Gate Pose   (Parighasana — kneel on one knee, opposite leg extended to the side, bend over it)
- D3: Seated Bend   (Parsva Upavistha — seated wide-legged, torso laid along one leg reaching the foot)
- D4: Side-Split Lateral   (Wide or side-split stance, torso flat along one leg, chest open)

### 86. Full Bound Twist

*Scored by: difficulty level, then longest hold*

- D1: Seated Twist   (Sit tall, rotate the torso and hold with one hand behind · used 2 times)
- D2: Half Lord   (Ardha Matsyendrasana — knee crossed over, elbow outside it, rotate toward the knee)
- D3: Bound Twist   (Marichyasana C — arms bound around the leg to lock the rotation deeper)
- D4: Full Bound Twist   (Marichyasana D — deepest bound spinal rotation)

---

### 87. Plie Squat

*Scored by: difficulty level, then longest hold*

- D1: Supported Demi   (Hand on a wall or barre, knees bent to half depth, heels down)
- D2: Demi   (No support, thighs above parallel, heels down, knees tracking over the toes)
- D3: Grand   (Thighs at or below parallel, heels staying down throughout)
- D4: Relevé Grand   (Full depth held on the balls of both feet, heels lifted and still)

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.

### 88. Seiza

*Scored by: difficulty level, then longest hold*

- D1: Supported Kneel   (A block or cushion between the hips and the heels)
- D2: Hips to Heels   (Hips resting fully on the heels, no support, tops of the feet flat)
- D3: Toes Tucked   (Hips on the heels with the toes tucked under)
- D4: Reclined Kneel   (Sitting on the heels and leaning back, shoulders toward the floor)

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.

### 89. Wrist Stretch

*Scored by: difficulty level, then longest hold*

- D1: Fingers Forward   (Palms flat on the floor, fingers pointing away, elbows soft)
- D2: Elbows Locked   (Palms flat, fingers pointing away, arms straight, weight over the hands)
- D3: Fingers Turned In   (Palms flat, fingers pointing back toward the knees, arms straight)
- D4: Fingers In · Loaded   (Fingers pointing back with the hips stacked over the hands)

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.

### 90. Reverse Wrist Stretch

*Scored by: difficulty level, then longest hold*

- D1: Backs Down · Bent   (Backs of the hands on the floor, fingers pointing back, elbows soft)
- D2: Backs Down · Straight   (Backs of the hands flat, fingers pointing back, arms straight)
- D3: Fingers Forward   (Backs of the hands flat, fingers pointing away from the knees, arms straight)
- D4: Backs Down · Loaded   (Backs of the hands flat with the hips stacked over them)

> NEW EVENT, Sept 2026 (Tāne). Nobody has scored it, so there is no usage to calibrate against.
> Shorter range than Wrist Stretch at every rung: the wrist bends far less this way.

## 8. Body Awareness

### 91. Tae Kwon Do

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Levels removed, only the game.

**NONE**

### 92. Breakdancing

*Scored by: difficulty level, then longest time*

> Changed 5 Oct 2026 (Tāne): New ladder.

- D1: Top Rock
- D2: Footwork
- D3: Top Rock + Footwork
- D4: Top Rock + Footwork + Freeze
- D5: Game

### 93. Trampolining

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): 180 Spin replaced by Bounce to Butt; Front Flip 180 removed.

- D1: Basic Bounce
- D2: Bounce to Butt
- D3: 360 Spin   (used 2 times)
- D4: Forward Flip   (used 3 times)
- D5: Back Flip   (used 1 time)
- D6: Game

### 94. Jump Rope

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): Alternating Feet, Criss-Cross and Double Under removed.

- D1: Basic Two-Foot Jump   (used 11 times)
- D2: Single Dutch
- D3: Double Dutch
- D4: Game

### 95. Wrestling

*Scored by: win, draw or loss against another player*

**NONE**

### 96. Gymnastics

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): Roundoff, One-Hand Cartwheel and Front Handspring removed.

- D1: Forward Roll   (used 1 time)
- D2: Backward Roll   (used 1 time)
- D3: Cartwheel   (used 1 time)
- D4: Handspring   (Front or back handspring)
- D5: Game

### 97. Balance Ball

*Scored by: difficulty level, then longest hold*

- D1: Seated   (used 1 time)
- D2: Kneeling   (used 2 times)
- D3: Kneeling · No Hands   (Kneeling on the ball with no hands touching it · used 1 time)
- D4: 1 Leg · No Hands   (Standing on one leg, no hands · used 1 time)
- D5: Standing   (used 1 time)
- D6: Game

### 98. SKATE

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): 180 Pivot renamed Board Tilts, 360 Pivot renamed 360 Spin, Kickflip removed.

- D1: Board Tilts   (used 1 time)
- D2: 360 Spin   (used 6 times)
- D3: Ollie   (used 1 time)
- D4: Pop Shove It
- D5: Game

### 99. Fencing

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Levels removed, only the game.

**NONE**

### 100. Juggling

*Scored by: difficulty level, then longest hold*

- D1: 2 Ball (both hands)   (used 4 times)
- D2: 2 Ball (one hand)   (used 3 times)
- D3: 3 Ball   (used 5 times)
- D4: Game

### 101. Foot Juggling

*Scored by: difficulty level, then most reps*

> Changed 5 Oct 2026 (Tāne): 0 Bounce renamed No Bounce.

- D1: 2 Bounce
- D2: 1 Bounce
- D3: No Bounce
- D4: Game

### 102. Slackline

*Scored by: longest hold*

> Changed 5 Oct 2026 (Tāne): Plank Walk and Slackline Bounce removed; Beam Walk and Slackline Walk renamed.

- D1: Single Leg Balance
- D2: Beam
- D3: Slackline
- D4: Game

---

## 9. Coordination

### 103. Volleyball

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): New drill ladder.

- D1: Dig Passes (2m)
- D2: Dig Passes (5m)
- D3: Partner Digs (10m)
- D4: Partner Digs (20m)
- D5: Game

### 104. Baseball

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): New drill ladder.

- D1: Bat & Catch
- D2: Bat & Catch (2m)
- D3: Bat & Catch (5m)
- D4: Bat & Catch (10m)
- D5: Bat & Catch (20m)
- D6: Game

### 105. Teqball

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): New drill ladder.

- D1: Bounce Pass
- D2: Bounce Pass (2m)
- D3: Bounce Pass (5m)
- D4: Game

### 106. Tennis

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Partner Hits renamed Hits.

- D1: Vertical Juggles
- D2: Hits (2m)
- D3: Hits (5m)
- D4: Hits (10m)
- D5: Game

### 107. Cricket

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): New drill ladder; Game kept on top (confirmed 5 Oct 2026).

- D1: Bat & Catch
- D2: Bat & Catch (2m)
- D3: Bat & Catch (5m)
- D4: Bat & Catch (10m)
- D5: Bat & Catch (20m)
- D6: Game

### 108. Badminton

*Scored by: win, draw or loss against another player*

- D1: Vertical Juggles
- D2: Partner Hits (2m)
- D3: Partner Hits (5m)
- D4: Partner Hits (10m)
- D5: Game

### 109. Basketball

*Scored by: win, draw or loss against another player*

- D1: Bounce Ball
- D2: 2 Ball Bounce
- D3: 2 Ball Side to Side
- D4: 2 Ball Back & Forth
- D5: Game

### 110. Football

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 111. Hockey

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 112. Squash

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 113. Lacrosse

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

### 114. Ultimate Frisbee

*Scored by: win, draw or loss against another player*

- D1: Partner Pass
- D2: Partner Pass (2m)
- D3: Partner Pass (5m)
- D4: Partner Pass (10m)
- D5: Game

---

## 10. Aim & Precision

### 115. Netball

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Chest Pass removed.

- D1: Shot Under Hoop   (Standing directly under the hoop)
- D2: Shot (2m)
- D3: Shot (5m)
- D4: Game

### 116. Bocce

*Scored by: win, draw or loss against another player*

- D1: Bowl Ball
- D2: Within 5m of Jack
- D3: Within 1m of Jack
- D4: Hit the Jack   (Strike the jack itself from the throwing line)
- D5: Game

### 117. Dodgeball

*Scored by: win, draw or loss against another player*

- D1: Throw Ball
- D2: Throw & Catch (1m)   (With a partner)
- D3: Throw & Catch (5m)
- D4: Throw & Catch (10m)
- D5: Game

### 118. Carrom

*Scored by: win, draw or loss against another player*

- D1: Strike a Piece   (Flick the striker from the baseline and make contact)
- D2: Pocket a Piece
- D3: Game

### 119. Archery

*Scored by: win, draw or loss against another player*

- D1: Hit the Target (5m)
- D2: Hit the Target (10m)
- D3: Hit the Gold (10m)   (Inner gold rings of the target face)
- D4: Hit the Gold (20m)
- D5: Game

### 120. Bowling

*Scored by: win, draw or loss against another player*

- D1: Partner Bowl
- D2: Partner Bowl (5m)
- D3: Partner Bowl (10m)
- D4: Partner Bowl (20m)
- D5: Game

### 121. Darts

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Named Double and Bullseye removed.

- D1: Hit the Board   (Land all three darts of a visit on the board)
- D2: Named Number   (Hit a number called before you throw)
- D3: Game

### 122. Disc Golf

*Scored by: win, draw or loss against another player at the top level*

> Changed 5 Oct 2026 (Tāne): Approach (20m) replaced by Putt (10m); the game is any round, strokes recorded alongside.

- D1: Putt (2m)
- D2: Putt (5m)
- D3: Putt (10m)
- D4: Game

### 123. Golf

*Scored by: win, draw or loss against another player at the top level*

> Changed 5 Oct 2026 (Tāne): The game is any round, strokes recorded alongside.

- D1: Putt (2m)
- D2: Putt (5m)
- D3: Chip (10m)
- D4: Game

### 124. Handball

*Scored by: win, draw or loss against another player*

- D1: Partner Pass (2m)
- D2: Partner Pass (5m)
- D3: Past a Keeper   (Score with a keeper in goal)
- D4: Game

### 125. Table Tennis

*Scored by: win, draw or loss against another player*

> Changed 5 Oct 2026 (Tāne): Partner Hits removed.

- D1: Vertical Juggles   (Bounce the ball on the bat, standing)
- D2: Wall Juggles
- D3: Game

### 126. Kubb

*Scored by: win, draw or loss against another player*

- D1: Throw Baton
- D2: Hit Kubb (2m)
- D3: Hit Kubb (5m)
- D4: Hit Kubb (10m)
- D5: Game

---
