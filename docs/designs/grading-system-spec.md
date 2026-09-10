# The AllSport grading system — specification

**Date:** 6 September 2026
**Status:** Rules and ladder SETTLED and implemented in `lib/grading.ts`.
Standards NOT written — that is now the only remaining work.
**The launch gate CLEARED on 10 September 2026** when the event-difficulty
overhaul (v0.7.0.0, PR #101) shipped. Every domain can now be graded.
**Evidence:** `docs/designs/grading-calibration-findings.md`
**Supersedes:** the taniwha parts ladder, and the abandoned evolution-chain
detour in `TANIWHA_EVOLUTION_PLAN.md`.

---

## Why this exists

Three grading systems shipped in about a month — seasonal colours, lifetime
colours, taniwha parts — and all three went unremarked. In the taniwha system's
first five days, zero of 27 players reacted to it unprompted.

It was never the narrative. **All three were gated on lifetime points, which are
attendance. You cannot be proud of something you could not have failed.** Turn
up enough times and the award arrives, so there is nothing to become attached
to.

The one thing AllSport has that martial arts do not is complete objective
performance data across 120 events. The syllabus can grade itself.

## The ladder

Twelve earned grades plus a starting rung. **Grades own colour**; domains are
identified by name and icon only, because colour cannot mean both "which domain"
and "how good".

| | Grade | Colour | Population target |
|---|---|---|---|
| — | **Mā** | white | start, not an award |
| 1 | **Kiwikiwi** | grey | anyone |
| 2 | **Whero** | red | 90% |
| 3 | **Karaka** | orange | 80% |
| 4 | **Kōwhai** | yellow | 70% |
| 5 | **Kākāriki** | green | 60% |
| 6 | **Kahurangi** | blue | 50% |
| 7 | **Poroporo** | purple | 40% |
| 8 | **Parahi** | bronze | 30% |
| 9 | **Hiriwa** | silver | 20% |
| 10 | **Kōura** | gold | 10% |
| 11 | **Uenuku** | rainbow | 5% |
| 12 | **Taniwha** | black | 1% |

Three phases on purpose: grey, then the spectrum, then the metals, then Uenuku
and Taniwha. Bronze/silver/gold reads as "better than most" in any country
without explanation, and it lands exactly where the curve turns.

**Never label these `D1`–`D12`.** `D1`–`D7` already means difficulty TIER inside
an event (Pause Dips D1–D5, Planche D1–D7). A grade ladder on the same letters
is unreadable on a scorecard. Pinned by a test.

## The three rules

1. A player holds a colour in **each of the ten domains**, earned against
   published standards, not points.
2. Your colour in a domain is the **highest grade whose standard you have met in
   at least half of that domain's events**.
3. Your **overall grade is your lowest domain colour**.

Rule 3 is the whole point. AllSport is "one sport, every sport", so a grade set
by your weakest domain says structurally that you are only as good as the thing
you avoid. Average and maximum both reward specialists, which is the opposite of
the sport, and the minimum makes your worst domain the only thing worth
training — a self-correcting coaching system.

---

## The twelve decisions, and why

**1 · Standards are calibrated against the GENERAL population, not the AllSport
player population.** A club-relative percentile moves when other people join, so
a player could be demoted by somebody else's arrival — which breaks "a colour
once earned is never lost" and punishes you for the club growing. A fixed
reference also means the grade says something outside the room.

**2 · Grades are earned through normal sessions.** No separate grading occasion.

**3 · Half the domain's events, not one.** The earlier "best grade in ANY event"
rule made a grade winnable on a single favourable movement.

**4 · The denominator is the events AVAILABLE to that player, coach-confirmed.**
Eight of Maximal Strength's twelve events load the shoulder, so a player whose
shoulder will never press has four available and could never reach six — and
under rule 3 that caps their overall grade forever, in a charity whose mission
is making sport accessible to everyone in Aotearoa. A kaiwhakawā marks events
unavailable and the threshold moves with them: four available needs two.
**This is load-bearing against the mission, not a convenience.**

**5 · Maximal Strength grades on absolute load, not bodyweight multiples.**
`players.bodyweight_kg` was dropped on 2026-08-22 and querying it returns
`42703`. It held zero rows and nothing read it, so reinstating it is not a
restore — it is starting to weigh people, including tamariki, which
`20260822000000_privacy_tidyup.sql` explicitly called out. Sex-splitting and
age-scaling already absorb most body-size variance.

**6 · Juniors are graded sex-split like adults, computed server-side.** A
15-year-old girl graded against boys' numbers is systematically under-graded,
and under rule 3 that caps her overall grade permanently — in exactly the
rangatahi cohort the charity exists to keep. `gender` is already collected, but
"for exactly one purpose: choosing a competition division", so **this needs a
privacy-notice update before it ships.** Gender is never exposed through
`players_public`; only the resulting colour is.

**7 · The taniwha system is retired entirely.** Not merged, not run alongside.
See "Retiring taniwha" below.

**8 · A grade is computed automatically and released by a kaiwhakawā.** The
engine detects it and alerts the coach; the player sees it when the coach
confers it, in the room. This reuses the working `claim_colour_award` pattern
and restores the thing the diagnosis says makes a belt mean something — a person
confers it.

**9 · Awards are append-only. A grade is never revoked.** Same as
`colour_awards`. Grades computed from lifetime bests are naturally monotonic,
but an exemption change or a standards revision could otherwise lower one.
Failure means not passing a grading, never being demoted.

**10 · The player sees ten domain colours; the overall grade appears only once
all ten exist.** `overallGrade()` returns `null`, not Mā, while any domain is
ungraded — "not graded in Flexibility yet" is progress, "you are Mā" is a
verdict. Ten moving numbers also give a reason to open the app between sessions,
which none of the three previous systems had.

**11 · Standards are written once for a reference group (Open, 17–39); every
other band is a FACTOR.** Athletics age-grading works this way; it is revisable
in one place, and hand-setting a number for every band and sex across 120 events
guarantees inconsistency. **Direction matters:** multiply for weight, reps,
distance and hold-time; DIVIDE for time-to-beat and lower-is-better, or a
Grandmaster's 100m standard comes out faster than Open. Junior flexibility
factors are above 1.0 on purpose — children are more mobile, so the standard is
harder.

**12 · Events that can never carry a standard leave the DENOMINATOR.** The
eleven remaining pure contests are removed from a domain before the half is
taken, exactly as a player's own exemptions are. Speed holds six of them, so
counting them would ask a Speed player to meet the standard in all six of the
events that CAN be graded — a 100% requirement where every other domain asks
50%. Half of what can be graded is the rule; half of the roster is an accident
of which events happen to be contests. `ungradeable` on `DomainGradeInput`,
pinned by four tests.

---

## The launch gate — CLEARED

**Grading was blocked on the event-difficulty overhaul. That shipped on
10 September 2026 as v0.7.0.0 and the gate is now clear.** Run
`node scripts/grading-readiness.mjs` for the current state.

The overhaul rebuilt every ladder so that **drill rungs sit beneath the
contest**: Basketball is now `Bounce Ball → 2 Ball Bounce → 2 Ball Side to Side
→ 2 Ball Back & Forth → Game`, and Archery is `Hit the Target (5m) → … → Game`.
Pure `sport` events fell from **38 to 11**, and 39 Game rungs now sit on top of
ladders that can be graded underneath.

| Domain | Gradeable, before → after |
|---|---|
| Coordination | 0/12 → **12/12** |
| Aim & Precision | 2/12 → **12/12** |
| Calisthenics | 0/12 → **12/12** |
| Aerobic Endurance | 1/12 → **12/12** |
| Flexibility | 1/12 → **12/12** |
| Anaerobic Endurance | 3/12 → **12/12** |
| Body Awareness | 1/12 → **9/12** |
| Speed | 2/12 → **6/12** |
| Power | 9/12 → 10/12 |
| Maximal Strength | 10/12 → 12/12 |

**The key structural move was putting `scoring: 'sport'` on the TIER rather than
the event.** Before, `inputMode` was single-valued, so an event was either a
contest or a measurement and adding drills to Basketball would have removed the
opponent. Declaring it per rung lets one event be a graded ladder AND a real
contest at the top. That is a better answer than the separate grading occasion
this spec originally recommended, and it is why decision 2 stands unchanged.

Eleven pure contests remain and can never be graded — Arm Wrestling, Tug of War
(Power); Tag, Beach Flags, Rats & Rabbits, Speed Chess, Capture the Flag,
Kabaddi (Speed); Tae Kwon Do, Wrestling, Fencing (Body Awareness). See decision
12 for how the rule handles them.

Player readiness is not a design problem: three of 23 players already clear the
threshold in all ten domains, and since a session draws one event per domain the
rest accrues over roughly ten to twelve sessions.

---

## What standards must now look like

**84 of 120 events are tiered ladders** (44 `difficulty+reps`, 40
`difficulty+time`), up from 54. This changes the shape of the remaining work in
the club's favour.

A tiered ladder is *already* a calibrated difficulty progression — that is what
the overhaul spent its effort on. So a standard for a tiered event is most
naturally **"reach rung N"**, not a hand-authored percentile in that event's
units. That collapses most of the authoring job and sidesteps the unit mismatch
this design's calibration run found, where the draft graded Pushup Contest in
flat reps against an event that stores a tier plus reps.

Two things it does not settle, and both need Tāne:

- **Ladders are 3–7 rungs; the ladder of grades is 12.** The mapping from rung
  to grade has to be decided, and it cannot be one-to-one.
- **Rungs are ordered, not percentile-calibrated.** Nobody has said what share
  of the population reaches "2 Ball Back & Forth". The ordering is trustworthy;
  the population target attached to each rung is not, and that is exactly the
  claim decision 1 says a grade makes.

`rungForPerformance()` in `lib/grading.ts` grades a flat scalar against a
reference ladder. A tier-aware sibling is needed before standards can be
written, and is deliberately absent until the mapping above is chosen.

---

---

## Data model

Not yet migrated, deliberately. Create it with `supabase migration new` **from
an up-to-date `main`** when the overhaul lands — never hand-name a migration,
because a duplicate 14-digit version is invisible to git and is applied as a
silent skip.

```
grade_exemptions                      -- decision 4
  id, player_id -> players, event_slug TEXT, reason TEXT,
  confirmed_by -> players, created_at
  UNIQUE (player_id, event_slug)
  RLS: read own + child + kaiwhakawā; write kaiwhakawā only

grade_awards                          -- decisions 8, 9. Append-only.
  id, player_id -> players, domain_number INT CHECK (1..10),
  rung INT CHECK (1..12), grade_name TEXT,   -- name snapshotted at award time
  session_id -> sessions NULL, awarded_at, conferred_at NULL
  UNIQUE (player_id, domain_number, rung)    -- makes the mid-session claim and
                                             -- the close trigger idempotent
                                             -- against each other
  RLS: read own + child + kaiwhakawā; write via SECURITY DEFINER only
```

The **overall grade is derived, never stored** — it is the minimum across the
highest rung held per domain, and storing it would create a second thing that
can disagree with the first.

**Standards live in TypeScript**, as `lib/gradingStandards.ts`, so they are
version-controlled, diffable and unit-testable without a migration to change a
number. But conferral is server-authoritative, so the server must know them too:
mirror them into a `grade_standards` table **in the same migration that changes
them**, with a test that reads the newest migration and fails on drift. This is
exactly the `event_domains` pattern, and for the same reason — the server must
not trust the client about what a standard is.

**Every grading read must be its own query.** A missing column returns `42703`
and takes the whole request down, while a missing table returns `PGRST205` in
`error`. Never fold a grading column into an existing select.

---

## Retiring taniwha

29 `player_taniwha` rows, **0 crowns held, 25 players on zero parts, and only 2
players ever chose a taniwha** — 27 are still on the default. There is almost no
accumulated investment to preserve. The cost is 25 UI files, not the data.

**Retire:** `player_taniwha`, the parts ladder in `lib/taniwha.ts`,
`lib/taniwhaAlerts.ts`, `TaniwhaCard`, `TaniwhaFigure`, `TaniwhaWatchlist`,
`TaniwhaAlertBanner`, `/taniwha`, `/taniwha/history`, the leaderboard taniwha
column, and the dashboard card. Archive the table before dropping it — and
**enable RLS on the archive explicitly**, because `CREATE TABLE … AS SELECT`
does not inherit it and anything in `public` is reachable through PostgREST.

**Keep, because they are not taniwha-specific:**

- `results.event_placement` / `event_field_size` and the `player_event_wins`
  view — `/prs` shows wins and average placement from these.
- `event_domains` — the roster mirror; the standards mirror should sit beside it.
- `colour_awards` and `lib/colours.ts` — real colours awarded on real dates. The
  dashboard timeline still renders them as the colours era. Rewriting them as
  grades would fabricate history.
- `player_totals` — lifetime points still drive nothing in grading, but the
  leaderboard reads them.

---

## Known problems this must not inherit

**The difficulty overhaul multiplied the incompatible-encoding problem by
thirteen, and the repair migration has not shipped.**

`lib/percentile.ts:51` takes `max(raw_score)` across all sessions as a lifetime
best, and asserts in a comment that the event "is the same event across
sessions". Before September 2026 that was false for two events (Shotput,
Shoulder Dislocate). The overhaul changed the input mode of **34 events, 27 of
which have history**, so it is now false for 27.

Measured against production on 10 September 2026, of 911 result rows on events
that now carry a ladder:

| | Rows |
|---|---|
| carrying **no level at all** — scored on the abandoned scale | **477** |
| carrying a label matching **no current rung** | **91** |
| **total unresolvable to a rung** | **568** |

The 477 figure matches the overhaul's own TODOS entry exactly, so this was
found, not missed. But that entry is marked **Completed: v0.7.0.0**, and the
completion covers the code, not the data — `20260908221459` re-seeds
`event_domains` and states in its own header that "nothing here touches
`results`", forward-referencing "the data-repair migration that follows this
one". **No such migration exists in the repo.** `scripts/gen-difficulty-migration.mjs`
emits a migration body to stdout and nothing has committed the result.

Why it matters beyond grading: a historical Carrom win is `raw_score = 2` while
a new drill rung encodes as `30010`, so **any single drill result outranks every
contest a player has ever won** in Top % and in PR display. Placements are
computed per session and every session is internally consistent, so those are
unaffected — this is a cross-session comparison fault, exactly the class the
Shotput note describes, at thirteen times the size.

**Grading must not inherit it.** A lifetime best has to be taken per encoding
era, or the repair migration has to land first. The latter is better, because
`lib/percentile.ts` has the same bug today and would be fixed by the same work.

**A corrupt sprint row grades as the top rung.** One 100m best is stored as
`0.16 s` (`raw_score = -16`) — physically impossible, and under the draft
standards it graded as the top grade. **Standards need outlier rejection**, and
sprint entry needs a lower bound. Note 100m Sprint moved from `sprint` to
`difficulty+time` in the overhaul, so that row is now also one of the 477.
