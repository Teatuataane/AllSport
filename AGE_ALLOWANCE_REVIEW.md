# Age and Sex Scaling — Review

**Everyone plays off one list (`GRADING_STANDARDS_REVIEW.md`), and the level needed is scaled by age and sex. Set by Tāne on 3 November 2026; he will check the numbers again.** The numbers are in `lib/scaling.ts` and `lib/ageAllowance.ts`. `__tests__/ageAllowance.test.ts` and `__tests__/scaling.test.ts` fail if this sheet and the code disagree, so change both together and bump `GRADING_RULES_VERSION` in `lib/grading.ts`.

## How it works

- **One age per year.** The age you turn this calendar year, birthday or not. It changes on 1 January (Tāne, 20 Oct 2026).
- **Events with a number ease by a percentage.** Loads, heights, distances and holds go down by it; times go up by it. Reps and a hold's time on a loaded event stay the same.
- **Events with levels move in colours.** An allowance of 1 means you earn each colour at the listed standard for the colour below it.
- **Sex and age multiply.** A 60-year-old woman on Deadlift lifts 80% × 85% = 68% of the list.
- **Head-to-head ratings are never scaled.**
- **Half steps** (`½`) on events with levels: your exact score is worked out at the whole step below and the whole step above, and the two are averaged.

> Why a percentage. A ladder is wide up to Kahurangi and tight to Taniwha, because players improve quickly and then slow down (Tāne). So a three colour shift on Pause Bench cuts 75% of the load at Kahurangi and 20% at Taniwha. A percentage is the same cut at every colour. It replaces the 21 Oct 2026 decision to keep colours until February 2027.

## Percent: adults

Events with a number, by the age you turn this year. Made from the colour table below, with one colour counted as 10%.

| Domains | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75+ |
|---|---|---|---|---|---|---|---|---|---|
| Power | 0 | 5 | 10 | 10 | 15 | 20 | 25 | 30 | 35 |
| Maximal Strength | 0 | 0 | 5 | 10 | 10 | 15 | 20 | 25 | 30 |
| Stamina, Endurance | 0 | 0 | 5 | 5 | 10 | 10 | 15 | 20 | 25 |

> To check: the only lift figure on file is McCulloch's coefficient of about 1.23 at 60, which is about 19% off (secondary sources), against 15% here.

## Percent: juniors

| Domains | Under 12 | 12 to 13 | 14 to 16 |
|---|---|---|---|
| Maximal Strength, Power | 30 | 20 | 10 |
| Stamina, Endurance | 15 | 10 | 5 |

## Sex

From age 12. Under 12s share the listed standard, and "Other" stays on it.

| Events | Women's standard |
|---|---|
| Deadlift, Back Squat, Front Squat, Loaded Lunge, Zercher Dead, Steinborn Lift, Arthur Lift, Glute Thrust, Leg Extension Hold, Tibialis Curl, Toe Lift, Sandbag to Shoulder, Clean & Jerk, Snatch, Kelly Snatch, 1A Snatch | 80% of the load |
| Pause Bench, Overhead Press, Pause Row, 1A Press, Turkish Getup, Plate Hold, Weighted Tuck, Skullcrusher, Strict Curl, OH Tricep Extension, Overhead Raise, Wrist Extension, Sandbag Carry, Farmer Carry, Weighted Drag | 70% of the load |
| Vertical Jump, Standing Broad Jump, Triple Jump, High Jump | 80% of the height or distance |
| Running, Cycling, Ski Erg, Row Erg, Swim, Walking, Scooting, Burpee Broad Jump | 12% more time |
| Pause Dips, Clap Pushups, Chinups, Pushups, Finger Pushup, Planche, Front Lever, Back Lever, Human Flag, Iron Cross, Reverse Maltese, Handstand, Chin Hang, Hang, Windshield Wipers, Wrestler Pullover | 1 colour |
| Everything else, including the throws on today's lighter implements | No scaling |

## Colours: adults

Events with levels, in colours.

| Domains | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75+ |
|---|---|---|---|---|---|---|---|---|---|
| Speed, Power | 0 | ½ | 1 | 1 | 1½ | 2 | 2½ | 3 | 3½ |
| Maximal Strength, Calisthenics | 0 | 0 | ½ | 1 | 1 | 1½ | 2 | 2½ | 3 |
| Stamina, Endurance | 0 | 0 | ½ | ½ | 1 | 1 | 1½ | 2 | 2½ |
| Flexibility, Control, Coordination, Aim | 0 | 0 | 0 | 0 | ½ | ½ | 1 | 1 | 1½ |

> Published masters factors give about a 10% handicap for a 50 to 54 man's 100m ([WMA 2023 Appendix B](https://www.world-masters-athletics.org/wp-content/uploads/2023/02/2023-WMA-Appendix-B.pdf)). Powerlifting's McCulloch coefficients start at 41 and reach about 1.23 at 60 ([calculover](https://calculover.com/health-fitness/fitness-performance/wilks-score/), [StrongFirst thread](https://strongfirst.com/community/threads/mcculloch-coefficient-for-powerlifting.26251)). These are secondary sources, not the official tables. Skill domains lose little with age, so they get least. Nobody gets an allowance at 35: the loss there is 1 to 3%.

## Colours: juniors

| Domains | Under 12 | 12 to 13 | 14 to 16 |
|---|---|---|---|
| Maximal Strength, Power, Speed | 3 | 2 | 1 |
| Calisthenics | 2 | 1½ | ½ |
| Control, Coordination, Aim | 2 | 1½ | ½ |
| Stamina, Endurance | 1½ | 1 | ½ |
| Flexibility | 0 | 0 | 0 |

> Children trail adults most on strength, power and speed before puberty, and least on bodyweight endurance. Children are usually more flexible than adults, so Flexibility gets nothing.
