# Age Allowance — Review

**Drafted by Claude and approved by Tāne on 20 October 2026. LIVE from v0.43.0.0.** The numbers are in `lib/ageAllowance.ts`; `__tests__/ageAllowance.test.ts` fails if this sheet and the code disagree, so change both together and bump `GRADING_RULES_VERSION` in `lib/grading.ts`.

## How it works

- **One age per year.** The age you turn this calendar year, birthday or not. It changes on 1 January (decided by Tāne, 20 Oct 2026).
- **The allowance moves the ladder.** An allowance of 1 means you earn each colour at the Open standard for the colour below it. Standards themselves are never scaled.
- **Head-to-head ratings get no allowance.** That is unchanged.
- **Half steps** (`½`) need one new rule. Your exact score is worked out at the whole step below and the whole step above, and the two are averaged. So a ½ allowance is worth half a colour on the exact score, and sometimes the colour itself.

## Before v0.43.0.0 (retired)

| Age this year | Under 12 | 12 to 13 | 14 to 16 | 17 to 39 | 40 to 59 | 60+ |
|---|---|---|---|---|---|---|
| Every domain | 2 | 2 | 1 | 0 | 1 | 2 |

## Adults

Colours of allowance, by the age you turn this year.

| Domains | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75+ |
|---|---|---|---|---|---|---|---|---|---|
| Speed, Power | 0 | ½ | 1 | 1 | 1½ | 2 | 2½ | 3 | 3½ |
| Maximal Strength, Calisthenics | 0 | 0 | ½ | 1 | 1 | 1½ | 2 | 2½ | 3 |
| Stamina, Endurance | 0 | 0 | ½ | ½ | 1 | 1 | 1½ | 2 | 2½ |
| Flexibility, Body Awareness, Coordination, Aim & Precision | 0 | 0 | 0 | 0 | ½ | ½ | 1 | 1 | 1½ |

> Where the numbers come from. Near the top of a ladder one colour is about 10 to 12% of performance (Deadlift: Kōura 1.8× BW, Uenuku 2.0×, Taniwha 2.25×). So an allowance in colours is roughly the loss with age divided by 11%. Published masters factors give about a 10% handicap for a 50 to 54 man's 100m ([WMA 2023 Appendix B](https://www.world-masters-athletics.org/wp-content/uploads/2023/02/2023-WMA-Appendix-B.pdf)). Powerlifting's McCulloch coefficients start at 41 and reach about 1.23 at 60 ([calculover](https://calculover.com/health-fitness/fitness-performance/wilks-score/), [StrongFirst thread](https://strongfirst.com/community/threads/mcculloch-coefficient-for-powerlifting.26251)). These are secondary sources, not the official WMA tables or a federation McCulloch chart; check them there if a step is ever disputed. Skill domains lose little with age, so they get least. Speed and Power lose most (Tāne, 20 Oct 2026).
>
> Nobody gets an allowance at 35: the loss there is 1 to 3%, a fraction of one colour. That was 7 players on 20 Oct 2026.

## Juniors

| Domains | Under 12 | 12 to 13 | 14 to 16 |
|---|---|---|---|
| Maximal Strength, Power, Speed | 3 | 2 | 1 |
| Calisthenics | 2 | 1½ | ½ |
| Body Awareness, Coordination, Aim & Precision | 2 | 1½ | ½ |
| Stamina, Endurance | 1½ | 1 | ½ |
| Flexibility | 0 | 0 | 0 |

> Children trail adults most on strength, power and speed before puberty, and least on bodyweight endurance. Skills are still developing. Children are usually more flexible than adults, so Flexibility gets nothing. Under 12, boys and girls perform much the same, so they share one list: the boys' (Open) list (Tāne, 21 Oct 2026). From 12 the girls' list applies again.

## Revisit after play testing

1. **Decided 21 Oct 2026 (Tāne): keep colours for now**, through play testing (until February 2027). Revisit then with data. If the beginner gift looks unfair, the suggested middle option is the smaller of one colour or the percentage, keeping the colour shift on events with levels.

   Background: colours are 10 to 12% apart near the top of a ladder but up to double near the bottom (Deadlift Kiwikiwi 0.1× BW, Whero 0.2×). A whole-colour allowance is therefore a big gift to a beginner and fair to an elite player. Should the allowance become a percentage at the player's level? Not decided; test with `scripts/replay-colours.ts` before changing.
