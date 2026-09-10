# Grading calibration — what the real data says

**Date:** 6 September 2026
**Method:** a one-off calibration run (read-only, public anon key; the re-runnable successor is `scripts/grading-readiness.mjs`) over
1,388 production `results` rows, 640 `session_events`, 27 players.
**Standards under test:** `docs/designs/grading-standards-draft.md`.

> **SUPERSEDED IN PART, 10 September 2026.** The event-difficulty overhaul
> (v0.7.0.0) rebuilt every ladder and changed the input mode of 34 events, so
> the roster counts in §3 and §6 below no longer describe the live roster and
> the blocker in §3 is resolved. Sections 1, 2, 5, 7 and 8 still hold. The
> current picture is in `grading-system-spec.md`; run
> `node scripts/grading-readiness.mjs` for live numbers.

This is the run the handoff called the highest-value first task. It changed the
priority order: the blocker the handoff predicted is real but is **not** the
binding constraint, and two problems it did not anticipate are larger.

---

## 1 · Domain coverage is free. The minimum rule is safe

**14 of the 23 players who have ever scored already cover all ten domains.**

This is structural, not luck: a session draws one event from each of the ten
domains, so a single completed session covers every domain at once. The nine
players below ten domains are the ones who have played part-sessions.

The worry that a minimum rule would leave players permanently ungraded because
they had never touched a domain **does not survive contact with the data.**
Coverage was never the risk.

## 2 · The real blocker is how few events carry standards

**Only 3 of 27 players could be graded in all ten domains today. The median is
5 of 10.**

The draft writes standards for 3 events per domain out of 12. Sessions draw one
event per domain at random, so the chance a given session yields a gradeable
result in a given domain is roughly 3-in-12. Covering all ten domains with
*standards-bearing* events takes many more sessions than covering all ten
domains at all.

| Standards-domain coverage | Players |
|---|---|
| 10 of 10 | 3 |
| 9 | 1 |
| 5–6 | 11 |
| 1–2 | 4 |
| 0 | 8 |

This is a breadth problem with a cheap fix — write standards for more of the
twelve — and it should be resolved before anything else is built.

## 3 · Three domains are structurally ungradeable, not two

The handoff names Coordination and Aim. **Speed is the third and was missed.**

| Domain | Gradeable | Sport (W/D/L) | Note |
|---|---|---|---|
| Coordination | **0 / 12** | 12 | A hard zero. No event can ever yield a number |
| Aim & Precision | 2 / 12 | 10 | Only Golf and Disc Golf. **Archery and Darts are `sport` mode**, despite having natural scoring |
| Speed | **3 / 12** | 9 | 100m, 200m, Repeat High Jump |
| Body Awareness | 9 / 12 | 3 | |
| Power | 9 / 12 | 3 | |
| Other five | 12 / 12 | 0 | |

Under a minimum rule, **Coordination alone caps every player forever**. It is
not a footnote to fix later; it is load-bearing.

The cheapest partial win: Archery and Darts already score naturally
(points on a target, points off 9 darts) and are only `sport` mode by
configuration. Re-moding those two takes Aim from 2/12 to 4/12 without
inventing any new sport.

## 4 · The Maximal Strength standards cannot be computed at all

Every row of domain 1 is expressed as a multiple of bodyweight.
**`players.bodyweight_kg` was dropped on 2026-08-22** by
`20260822000000_privacy_tidyup.sql`. Querying it returns `42703`.

So the entire domain-1 table is uncomputable against current data, and
re-collecting bodyweight reverses a deliberate privacy decision. Either domain 1
grades on absolute load, or bodyweight comes back as an optional
player-entered field.

## 5 · The curve is far too soft — and the reason matters

Of 48 graded player-events, **24 (50%) land in the top two grades and 13 (27%)
land on the top grade**. The highest of the seven drafted grades is the single
most common outcome.

The draft anticipated this ("the curve tops out too soft"). The data confirms it
and supplies the underlying reason, which is more interesting than the symptom:
**AllSport players are not the general population.** They are a self-selected
group who choose to train across ten domains. Standards pegged to
general-population percentiles will put most of the club near the top and stop
discriminating between them.

Worked examples:

- **Vertical Jump — 14 of 14 players grade at the 60th percentile or better.**
  Not one player falls below. The standard does no work.
- **Golf — all 5 players hit the top grade.** The top standard is 17 strokes
  over 4 holes; RGFell shot 10.

Extending to twelve grades (down to the 1st percentile) fixes the ceiling. It
does not fix the calibration reference, which is a separate decision.

## 6 · Many standards are written in units the app does not store

| Event | Draft unit | Actual `inputMode` |
|---|---|---|
| Pushup Contest | flat reps | `difficulty+reps` |
| Chin Hang | flat seconds | `difficulty+time` |
| Forward Split | cm block height | `difficulty+time` |
| Rear Hand Clasp | cm | `difficulty+time` |
| Running / Row Erg / Ski Erg | 1 km, 500 m | `difficulty+time`, distance tiers |
| Balance Ball, Headstand, L-Sit | flat seconds | `difficulty+time` |

A tiered event stores a tier **and** a value, so "35 seconds" has no meaning
until the tier is named. Only 8 of the 30 standards events could be graded
without guessing — which is why the run above covers 48 player-events and not
several hundred.

Related doc drift: `CLAUDE.md` states Forward Split and Middle Split use
`distance` mode (block height in cm). The code says `difficulty+time`, and the
stored rows agree with the code.

## 7 · Juniors have no sex available, and the standards are sex-split

`players_public` exposes no gender by design, and the standards split M/F from
the bottom rung up. Juniors carry the division "Juniors" with no sex, so
Salvador and Margarita were graded against the male table in this run and
flagged `?`. Any real implementation needs an explicit decision here, not a
default.

## 8 · Two data-quality items worth fixing regardless

**A corrupt sprint row grades as the top rung.** Clairebear's 100m best is
stored as **0.16 s** (`raw_score = -16`) — sprint mode is seconds plus
centiseconds, and this looks like centiseconds entered alone. It is physically
impossible, and it graded her Poroporo, the top grade. Standards need outlier
rejection, and sprint entry needs a lower bound.

**Two events changed input mode, and lifetime bests span the change.**
Shotput has 6 rows stored as weight (May) and 4 as distance (September);
Shoulder Dislocate has 4 rows as tier+time and 3 as grip-width. Within any one
session the encoding is consistent, so **placements are correct** — this is not
a live scoring bug.

But `lib/percentile.ts:51` takes `max(raw_score)` across all sessions and states
in a comment that the event "is the same event across sessions". For these two
events that is false: a distance-encoded 680 always beats a weight-encoded 7.9.
**Top % is wrong for Shotput and Shoulder Dislocate today**, and grading on a
lifetime best would inherit the same fault.

---

## Recommended order

1. **Decide the calibration reference** (§5) — general population, or the
   AllSport player population. Everything downstream depends on it.
2. **Fix Coordination** (§3). Nothing ships under a minimum rule until it has a
   number. Re-moding Archery and Darts is the cheap adjacent win.
3. **Widen standards from 3 events per domain toward 12** (§2), in the units the
   app actually stores (§6).
4. Resolve bodyweight (§4) and Junior sex (§7).
5. Fix the two data items (§8) — independent of grading, worth doing anyway.
