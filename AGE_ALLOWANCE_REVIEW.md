# Age Allowance — Review

**Drafted by Claude on 20 October 2026. UNREVIEWED: nothing reads this sheet yet.** The app still runs the flat allowance below ("Today"). Once Tāne settles these numbers, a script will compile them into `lib/` the way the standards sheet is compiled, and `GRADING_RULES_VERSION` will be bumped.

## How it works

- **One age per year.** The age you turn this calendar year, birthday or not. It changes on 1 January (decided by Tāne, 20 Oct 2026).
- **The allowance moves the ladder.** An allowance of 1 means you earn each colour at the Open standard for the colour below it. Standards themselves are never scaled.
- **Head-to-head ratings get no allowance.** That is unchanged.
- **Half steps** (`½`) need one new rule. Your exact score is worked out at the whole step below and the whole step above, and the two are averaged. So a ½ allowance is worth half a colour on the exact score, and sometimes the colour itself.

## Today (live)

| Age this year | Under 12 | 12 to 13 | 14 to 16 | 17 to 39 | 40 to 59 | 60+ |
|---|---|---|---|---|---|---|
| Every domain | 2 | 2 | 1 | 0 | 1 | 2 |

## Proposed: adults

Colours of allowance, by the age you turn this year.

| Domains | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75+ |
|---|---|---|---|---|---|---|---|---|---|
| Speed, Power | 0 | ½ | 1 | 1 | 1½ | 2 | 2½ | 3 | 3½ |
| Maximal Strength, Calisthenics | 0 | 0 | ½ | 1 | 1 | 1½ | 2 | 2½ | 3 |
| Stamina, Endurance | 0 | 0 | ½ | ½ | 1 | 1 | 1½ | 2 | 2½ |
| Flexibility, Body Awareness, Coordination, Aim & Precision | 0 | 0 | 0 | 0 | ½ | ½ | 1 | 1 | 1½ |

> Where the numbers come from. Near the top of a ladder one colour is about 10 to 12% of performance (Deadlift: Kōura 1.8× BW, Uenuku 2.0×, Taniwha 2.25×). So an allowance in colours is roughly the loss with age divided by 11%. Published masters factors give about a 10% handicap for a 50 to 54 man's 100m ([WMA 2023 Appendix B](https://www.world-masters-athletics.org/wp-content/uploads/2023/02/2023-WMA-Appendix-B.pdf)). Powerlifting's McCulloch coefficients start at 41 and reach about 1.23 at 60 ([calculover](https://calculover.com/health-fitness/fitness-performance/wilks-score/), [StrongFirst thread](https://strongfirst.com/community/threads/mcculloch-coefficient-for-powerlifting.26251)). Both should be checked against the official WMA tables and a federation McCulloch chart before this is approved. Skill domains lose little with age, so they get least. Speed and Power lose most (Tāne, 20 Oct 2026).
>
> Nobody gets an allowance at 35: the loss there is 1 to 3%, a fraction of one colour. That affects 7 players today.

## Proposed: juniors

| Domains | Under 12 | 12 to 13 | 14 to 16 |
|---|---|---|---|
| Maximal Strength, Power, Speed | 3 | 2 | 1 |
| Calisthenics | 2 | 1½ | ½ |
| Coordination, Aim & Precision, Body Awareness | 2 | 1½ | ½ |
| Stamina, Endurance | 1½ | 1 | ½ |
| Flexibility | 0 | 0 | 0 |

> Children trail adults most on strength, power and speed before puberty, and least on bodyweight endurance. Skills are still developing. Children are usually more flexible than adults, so Flexibility gets nothing. Under 12, boys and girls perform much the same, so the U12s could share one list (open question).

## Open questions for Tāne

1. Are the steps above right, domain by domain?
2. Should the U12s use one list for boys and girls?
3. Colours are 10 to 12% apart near the top of a ladder but up to double near the bottom (Deadlift Kiwikiwi 0.1× BW, Whero 0.2×). A whole-colour allowance is therefore a big gift to a beginner and fair to an elite player. Should the allowance be worked out as a percentage at the player's level instead? This is the change to test hardest with `scripts/replay-colours.ts` before it goes live.
4. Before switching on, run the replay in dry run and read the list of players whose colours would move.
