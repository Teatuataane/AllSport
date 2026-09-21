# Workout units — review sheet

What ONE effort unit is, for each of the 128 events. Units are the training
gate on every colour: each domain colour needs a number of units in that
domain since the last colour there (see `lib/grading.ts`). Any completed unit
counts; there is no intensity floor.

**How to review:** change `rule` or `per` on any row, then run
`node scripts/apply-units-sheet.mjs`. The last column is only a reading aid.

- `set` — one working set is `per` units apart (`per` 1 = every set is a unit)
- `hold` — one hold
- `distance` — `per` metres is one unit (Cycling 1000 = 25km is 25 units)
- `attempts` — `per` attempts is one unit (throws and jumps: 3)
- `game` — one game
- `round` — one four-hole round

A Game rung on a drill ladder always counts one game, whatever the rule.
Generated from the per-mode defaults on 2026-09-15.

## 1. Maximal Strength

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `one-arm-press` | 1A Press | 1 | set | 1 | one set |
| `deadlift` | Deadlift | 1 | set | 1 | one set |
| `clean-and-press` | Clean & Press | 1 | set | 1 | one set |
| `pause-dips` | Pause Dips | 1 | set | 1 | one set |
| `pause-chin-up` | Pause Chinup | 1 | set | 1 | one set |
| `pause-squat` | Pause Back Squat | 1 | set | 1 | one set |
| `zercher-deadlift` | Zercher Dead | 1 | set | 1 | one set |
| `pause-bench` | Pause Bench | 1 | set | 1 | one set |
| `turkish-get-up` | Turkish Getup | 1 | set | 1 | one set |
| `arthur-lift` | Arthur Lift | 1 | set | 1 | one set |
| `pause-row` | Pause Row | 1 | set | 1 | one set |
| `pause-front-squat` | Pause Front Squat | 1 | set | 1 | one set |
| `pullover-and-press` | Pullover & Press | 1 | set | 1 | one set |
| `loaded-lunge` | Loaded Lunge | 1 | set | 1 | one set |

## 2. Calisthenics

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `1-leg-squat` | 1 Leg Squat | 2 | set | 1 | one set |
| `flag` | Human Flag | 2 | hold | 1 | one hold |
| `windshield-wipers` | Windshield Wipers | 2 | set | 1 | one set |
| `planche` | Planche | 2 | hold | 1 | one hold |
| `back-lever` | Back Lever | 2 | hold | 1 | one hold |
| `iron-cross` | Iron Cross | 2 | hold | 1 | one hold |
| `front-lever` | Front Lever | 2 | hold | 1 | one hold |
| `chin-hang` | Chin Hang | 2 | hold | 1 | one hold |
| `skull-hang` | Skull Hang | 2 | hold | 1 | one hold |
| `hand-walk` | Handstand | 2 | hold | 1 | one hold |
| `headstand` | Headstand | 2 | hold | 1 | one hold |
| `l-sit-hold` | L-Sit Hold | 2 | hold | 1 | one hold |

## 3. Power

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `kelly-snatch` | Kelly Snatch | 3 | set | 1 | one set |
| `one-arm-snatch` | 1A Snatch | 3 | set | 1 | one set |
| `javelin-throw` | Javelin | 3 | attempts | 3 | 3 attempts |
| `shot-put` | Shotput | 3 | attempts | 3 | 3 attempts |
| `australian-football` | Australian Football | 3 | set | 1 | one set |
| `vertical-jump` | Vertical Jump | 3 | attempts | 3 | 3 attempts |
| `clean-and-jerk` | Clean & Jerk | 3 | set | 1 | one set |
| `snatch` | Snatch | 3 | set | 1 | one set |
| `standing-broad-jump` | Standing Broad Jump | 3 | attempts | 3 | 3 attempts |
| `high-jump` | High Jump | 3 | attempts | 3 | 3 attempts |
| `arm-wrestling` | Arm Wrestling | 3 | hold | 1 | one hold |
| `tug-of-war` | Tug of War | 3 | set | 1 | one set |

## 4. Speed

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `100m-sprint` | 100m Sprint | 4 | set | 1 | one set |
| `tag` | Tag | 4 | set | 1 | one set |
| `t-race` | T-Race | 4 | set | 1 | one set |
| `beach-flags` | Beach Flags | 4 | set | 1 | one set |
| `200m-sprint` | 200m Sprint | 4 | set | 1 | one set |
| `touch-rugby` | Touch Rugby | 4 | set | 1 | one set |
| `repeat-high-jump` | Repeat High Jump | 4 | set | 1 | one set |
| `rats-and-rabbits` | Rats & Rabbits | 4 | set | 1 | one set |
| `speed-chess` | Speed Chess | 4 | set | 1 | one set |
| `american-football` | American Football | 4 | set | 1 | one set |
| `capture-the-flag` | Capture the Flag | 4 | set | 1 | one set |
| `kabaddi` | Kabaddi | 4 | set | 1 | one set |

## 5. Anaerobic Endurance

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `chin-up-contest` | Chinup Contest | 5 | set | 1 | one set |
| `push-up-contest` | Pushup Contest | 5 | set | 1 | one set |
| `tibialis-curl` | Tibialis Curl | 5 | set | 1 | one set |
| `finger-push-up` | Finger Pushup | 5 | set | 1 | one set |
| `ghd-situp` | GHD Situp | 5 | set | 1 | one set |
| `leg-extension` | Leg Ext Hold | 5 | hold | 1 | one hold |
| `ab-wheel-rollout` | Ab Rollout | 5 | set | 1 | one set |
| `hamstring-curl` | Hamstring Curl | 5 | set | 1 | one set |
| `sandbag-to-shoulder` | Sandbag to Shoulder | 5 | set | 1 | one set |
| `wall-sit` | Wall Sit | 5 | hold | 1 | one hold |
| `toe-lift` | Toe Lift | 5 | set | 1 | one set |
| `lunges` | Lunges | 5 | set | 1 | one set |
| `calf-raises` | Calf Raises | 5 | set | 1 | one set |

## 6. Aerobic Endurance

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `burpee-broad-jump` | Burpee Broad Jump | 6 | distance | 200 | 200 metres |
| `running` | Running | 6 | distance | 1000 | 1000 metres |
| `cycling` | Cycling | 6 | distance | 1000 | 1000 metres |
| `ski-erg` | Ski Erg | 6 | distance | 1000 | 1000 metres |
| `row-erg` | Row Erg | 6 | distance | 1000 | 1000 metres |
| `breath-hold` | Breath Hold | 6 | hold | 1 | one hold |
| `sandbag-carry` | Sandbag Carry | 6 | set | 1 | one set |
| `animal-crawl` | Animal Crawl | 6 | distance | 100 | 100 metres |
| `bronco` | Bronco | 6 | set | 1 | one set |
| `scooting` | Scooting | 6 | distance | 1000 | 1000 metres |
| `farmer-carry` | Farmer Carry | 6 | set | 1 | one set |
| `weighted-drag` | Weighted Drag | 6 | set | 1 | one set |

## 7. Flexibility

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `rear-hand-clasp` | Rear Hand Clasp | 7 | hold | 1 | one hold |
| `bridge` | Bridge | 7 | hold | 1 | one hold |
| `forward-fold` | Forward Fold | 7 | hold | 1 | one hold |
| `needle-pose` | Needle Pose | 7 | hold | 1 | one hold |
| `front-split` | Forward Split | 7 | hold | 1 | one hold |
| `middle-split` | Middle Split | 7 | hold | 1 | one hold |
| `standing-split` | Standing Split | 7 | hold | 1 | one hold |
| `foot-behind-head` | Foot Behind Head Pose | 7 | hold | 1 | one hold |
| `shoulder-dislocate` | Shoulder Dislocate | 7 | set | 1 | one set |
| `pancake` | Pancake | 7 | hold | 1 | one hold |
| `side-bend` | Side Bend | 7 | hold | 1 | one hold |
| `full-bound-twist` | Full Bound Twist | 7 | hold | 1 | one hold |
| `plie-squat` | Plie Squat | 7 | hold | 1 | one hold |
| `seiza` | Seiza | 7 | hold | 1 | one hold |
| `wrist-stretch` | Wrist Stretch | 7 | hold | 1 | one hold |
| `reverse-wrist-stretch` | Reverse Wrist Stretch | 7 | hold | 1 | one hold |

## 8. Body Awareness

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `tae-kwon-do` | Tae Kwon Do | 8 | set | 1 | one set |
| `breakdancing` | Breakdancing | 8 | hold | 1 | one hold |
| `trampolining` | Trampolining | 8 | set | 1 | one set |
| `jump-rope` | Jump Rope | 8 | set | 1 | one set |
| `wrestling` | Wrestling | 8 | game | 1 | one game |
| `gymnastics` | Gymnastics | 8 | set | 1 | one set |
| `balance-ball` | Balance Ball | 8 | hold | 1 | one hold |
| `skate` | SKATE | 8 | set | 1 | one set |
| `fencing` | Fencing | 8 | set | 1 | one set |
| `juggling` | Juggling | 8 | hold | 1 | one hold |
| `foot-juggling` | Foot Juggling | 8 | set | 1 | one set |
| `slackline` | Slackline | 8 | hold | 1 | one hold |
| `rope-climb` | Climbing | 8 | set | 1 | one set |

## 9. Coordination

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `volleyball` | Volleyball | 9 | set | 1 | one set |
| `baseball` | Baseball | 9 | set | 1 | one set |
| `teqball` | Teqball | 9 | set | 1 | one set |
| `tennis` | Tennis | 9 | set | 1 | one set |
| `cricket` | Cricket | 9 | set | 1 | one set |
| `badminton` | Badminton | 9 | set | 1 | one set |
| `basketball` | Basketball | 9 | set | 1 | one set |
| `football` | Football | 9 | set | 1 | one set |
| `hockey` | Hockey | 9 | set | 1 | one set |
| `squash` | Squash | 9 | set | 1 | one set |
| `lacrosse` | Lacrosse | 9 | set | 1 | one set |
| `ultimate-frisbee` | Ultimate Frisbee | 9 | set | 1 | one set |

## 10. Aim & Precision

| slug | event | domain | rule | per | one unit is |
|---|---|---|---|---|---|
| `netball` | Netball | 10 | set | 1 | one set |
| `bocce` | Bocce | 10 | set | 1 | one set |
| `dodgeball` | Dodgeball | 10 | set | 1 | one set |
| `carrom` | Carrom | 10 | set | 1 | one set |
| `archery` | Archery | 10 | set | 1 | one set |
| `bowling` | Bowling | 10 | set | 1 | one set |
| `darts` | Darts | 10 | set | 1 | one set |
| `disc-golf` | Disc Golf | 10 | set | 1 | one set |
| `golf` | Golf | 10 | set | 1 | one set |
| `handball` | Handball | 10 | set | 1 | one set |
| `table-tennis` | Table Tennis | 10 | set | 1 | one set |
| `kubb` | Kubb | 10 | set | 1 | one set |
