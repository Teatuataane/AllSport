# The 151-event roster: implementation plan

Tāne's event sheet of 29 October 2026, compared against the live roster
(148 events, v0.45.0.0) and settled with him the same day. Nothing here is
built yet.

**Result:** 148 + 15 new − 12 removed = **151 events**.

| # | Domain (new name) | Now | After |
|---|---|---|---|
| 1 | Maximal Strength | 16 | 17 |
| 2 | Calisthenics | 13 | 15 |
| 3 | Power | 15 | 16 |
| 4 | Speed | 15 | 13 |
| 5 | Stamina | 18 | 15 |
| 6 | Endurance | 15 | 15 |
| 7 | Flexibility | 15 | 17 |
| 8 | **Control** (was Body Awareness) | 14 | 15 |
| 9 | Coordination | 13 | 14 |
| 10 | **Aim** (was Aim & Precision) | 14 | 14 |

The domain numbers and their order do not change. The sheet's column order is
only how the sheet is laid out.

---

## Settled with Tāne (29 Oct 2026)

- Kī-o-rahi, Target Shooting and Kapa Haka are **not** added.
- External and Internal Wrist Stretch are both removed and replaced by one new
  event, **Bent Wrist Stretch**.
- **Wrestler Pullover is a new event**, not a rename: Pullover & Press is
  removed (its colours protected) and its history stays under its own name.
- Renames: Leg Ext Hold to **Leg
  Extension Hold**, Reverse Wrist Ext to **Wrist Extension**, Airsoft to
  **Airsoft/Nerf**.
- Foot Behind Head Pose and Standing Broad Jump keep their names (the sheet's
  cells were cut off).
- Domain renames: Body Awareness to **Control**, Aim & Precision to **Aim**.

## Still open

1. **Scoring of the new events.** All 15 drafted by Claude in
   `ROSTER_151_DRAFTS.md` for Tāne to review.
2. Chinups and Pushups keep their live plural names (default accepted).

## Production, read only, 29 Oct 2026

- **Chinups and Pushups:** 38 conferred Stamina colours (2026) cite them (16
  and 22; 6 cite Pushups alone). 5 and 21 game results, 6 and 12 workout
  entries. After the move they count toward Calisthenics. This year's Stamina
  colours stay (no ordinary recheck withdraws), but those players' Stamina
  averages drop from 2027. Tāne should hear this before the release.
- **Sprints:** no game result was ever scored under 100m to 800m Sprint (only
  4 old `50m Sprint` rows, a retired name). 8 awards cite `100m-sprint` or
  `200m-sprint`, and they are protected. No carry-over to Sprint Race is needed.
- **Shoulder Dislocate:** 3 old results (grip width, raw −120 to −85, 2
  players), 1 award citing it, slug not on the roster. The new ladder can't
  read them, so they stay as history.
- **Other removals:** Pause Chinup 8 awards (1 cites it alone), Breath Hold
  12, Pullover & Press 0 (2 entries), Skull Hang 0 (2 entries), both wrist
  stretches 0. All protected by `protectedAwards`.
- **Table Tennis:** no awards and no entries, so its move changes nothing.
- **"Wrist Extension":** no `session_events` row uses that name, so renaming
  Reverse Wrist Ext clashes with nothing. `leg-extension` has 3 awards, which
  the rename does not touch (awards key on the slug).

---

## Part 1: 15 new events

Every new event needs an entry in `lib/eventData.ts` (via
`EVENT_DIFFICULTY_REVIEW.md` and `scripts/apply-difficulty-sheet.mjs`),
standards in `GRADING_STANDARDS_REVIEW.md` (via `scripts/apply-standards-sheet.mjs`),
an icon at `public/event-icons/{slug}.png`, and how-to and rules text.

| Event | Domain | Slug | Draft scoring |
|---|---|---|---|
| Wrestler Pullover | Strength | `wrestler-pullover` | `strength` (a lift: estimated 1RM) |
| Plate Hold | Strength | `plate-hold` | `weight+time` (pinch load, then longest hold) |
| Weighted Tuck | Strength | `weighted-tuck` | `strength` (a lift: estimated 1RM, load held by the feet) |
| Nordic Curl | Calisthenics | `nordic-curl` | `difficulty+reps` (assisted levels to free) |
| Cobra Pose | Flexibility | `cobra-pose` | `difficulty+time` |
| Butterfly Pose | Flexibility | `butterfly-pose` | `difficulty+time` |
| Deep Squat | Flexibility | `deep-squat` | `difficulty+time` |
| Bent Wrist Stretch | Flexibility | `bent-wrist-stretch` | `difficulty+time` (back of the hand down, weight added by level) |
| Shoulder Dislocate (returns) | Flexibility | `shoulder-dislocate` | `difficulty+reps` by grip width |
| Discus | Power | `discus` | `distance` |
| Sprint Race | Speed | `sprint-race` | `sport`, `recordsTime: true` |
| Hurdles | Speed | `hurdles` | `difficulty+time`, a timed effort (joins `TIMED_EFFORT_SLUGS`) |
| Underwater Swim | Endurance | `underwater-swim` | `distance` on one breath |
| Tī Rākau | Control | `ti-rakau` | `difficulty+reps` (clean rounds) |
| Goal Kicking | Aim | `goal-kicking` | `difficulty+reps` from set spots |

Notes:
- `shoulder-dislocate` is the only slug that has been used before. Before reusing
  it, read production for rows under it and their encoding, as the 144 roster
  did for `triple-jump`, `walking` and `cornhole`. Its icon already exists.
- `bent-wrist-stretch` is a fresh slug on purpose: `reverse-wrist-stretch` and
  `wrist-stretch` carry the old stretches' history.
- Sprint Race joins the pure-contest slug list in
  `guard_workout_entries_write` and `record_entry_match`.

## Part 2: three moves (slugs unchanged, results move with them)

| Event | Slug | From | To |
|---|---|---|---|
| Chinups | `chin-up-contest` | Stamina (5) | Calisthenics (2) |
| Pushups | `push-up-contest` | Stamina (5) | Calisthenics (2) |
| Table Tennis | `table-tennis` | Aim (10) | Coordination (9) |

The grading engine reads an event's domain from the current roster, so past
results count toward the new domain from the deploy. Chinups and Pushups are
among the most played Stamina events, so **check production for
`grade_awards` rows citing these three slugs before building.** A conferred
Stamina colour is never withdrawn by an ordinary recheck, so this year's colours
stay; Tāne should know which players' Stamina averages fall in 2027 as a
result. Past games keep the domain slot they filled
(`session_events.domain_number`), as with every earlier move.

## Part 3: twelve removals

| Event | Slug | Domain |
|---|---|---|
| Pause Chinup | `pause-chin-up` | Strength |
| Pullover & Press | `pullover-and-press` | Strength |
| Skull Hang | `skull-hang` | Calisthenics |
| Hamstring Curl | (look up) | Stamina |
| Internal Wrist Stretch | `wrist-stretch` | Flexibility |
| External Wrist Stretch | `reverse-wrist-stretch` | Flexibility |
| Plie Squat | (look up) | Flexibility |
| Breath Hold | `breath-hold` | Endurance |
| 100m, 200m, 400m, 800m Sprint | `100m-sprint` … `800m-sprint` | Speed |

- Colours citing a removed event stay (`protectedAwards` in `lib/autoConfer.ts`).
- Add all twelve to the removed-event list in `enforce_relevelled_ladders`, and
  take `shoulder-dislocate` out of it. Skull Hang and the wrist stretches are
  also on its re-levelled list; drop them there.
- The four sprints leave the pure-contest list in both guard functions.
- Skull Hang only gained its One-Hand Banded level on 17 Oct; Tāne confirmed it
  goes anyway.

## Part 4: renames (name only, slugs unchanged)

| Old | New | Slug |
|---|---|---|
| Leg Ext Hold | Leg Extension Hold | `leg-extension` |
| Reverse Wrist Ext | Wrist Extension | `wrist-extension` |
| Airsoft | Airsoft/Nerf | `airsoft` |

Each one, per CLAUDE.md §9: backfill `session_events.event_name`, check
`results`, `workout_entries`, `workouts.planned_events`, `grade_exemptions`,
`activity_aliases` and `event_domains`, grep `lib/` and `app/` for the old name,
and update `__tests__/fixtures/levelNames.json` if any level name moves.
`enforce_lift_estimate` loses `pullover-and-press` and gains `wrestler-pullover` and `weighted-tuck`.

**Name clash:** checked, none (see Production above).

## Part 5: two domain renames

Body Awareness to **Control**, Aim & Precision to **Aim**. Domain numbers 8 and
10 stay, so colours and awards are untouched.

- Code that keys on the name: `lib/eventData.ts` (every event's `domain`),
  `lib/domainColours.ts`, `components/DomainIcon.tsx`, `lib/ageAllowance.ts`,
  `lib/playerGrades.ts`, `app/leaderboard/page.tsx`, `app/components/JudgeCard.tsx`,
  `app/vote/[voteId]/page.tsx` and `results/page.tsx`, and the scripts
  `replay-colours.ts`, `withdraw-gap-colours.ts`, `grading-readiness.mjs`.
  Grep again at build time.
- Icons: `public/domain-icons/body-awareness.png` and `aim-and-precision.png`.
  Either rename the files to `control.png` and `aim.png` or keep the old file
  names (Endurance still uses `aerobic-endurance.png`). Default: keep them.
- Data: `UPDATE session_events SET domain_name = …` for numbers 8 and 10, as the
  Stamina and Endurance renames did, with an assertion that no old name remains.
- Text: `/grades`, `/how-to-play`, `/events`, the review sheets' headings,
  CLAUDE.md and `AGE_ALLOWANCE_REVIEW.md`.

---

## The migration

One new file from `supabase migration new roster_151`, modelled on
`20261005222950_roster_144.sql` and `20261014222805_stamina_arm_events.sql`:

1. Re-seed `event_domains` with 151 rows **first** (the write guards reject slugs
   not on the roster).
2. Rename backfills, each with a pre-image in an
   `*_archive_20261…` table behind RLS with no policies.
3. `session_events.domain_name` for domains 8 and 10.
4. Redefine whole, each from its newest definition: `enforce_relevelled_ladders`,
   `guard_workout_entries_write`, `record_entry_match`, and
   `enforce_lift_estimate` (Wrestler Pullover replaces Pullover & Press;
   Weighted Tuck joins).
5. Assert: 151 rows, per-domain counts 17/15/16/13/15/15/17/15/14/14, no duplicate
   slug, no retired name in `session_events`, every alias points at an event.

Rehearse against production in a rolled-back transaction, deploy the code, then
apply from a clean `main` checkout with `db query --linked -f` plus the ledger
row. Verify as `authenticated` (rolled back): a new event's entry is accepted, a
removed event's is refused, a Shoulder Dislocate score is accepted again.
Refresh the season board, then hard-refresh kaiwhakawā devices.

## Code and tests

- `lib/eventData.ts` header and roster count, `TIMED_EFFORT_SLUGS` and lift lists
  if touched.
- Structural tests: `staminaRoster.test.ts` (pins the newest guard),
  `sqlMirrors`, `estimatedOneRm`, `levelNames`, and the roster vs
  `event_domains` test.
- Bump `GRADING_RULES_VERSION` (moved events change what evidence earns).
- `VERSION`, `CHANGELOG.md`, CLAUDE.md (148 to 151, domain names and counts),
  `docs/PROJECT_HISTORY.md`.
- Run lint, `tsc --noEmit`, `npm test`, `npm run build`.

## Suggested order of work

1. ~~Read production~~ (done 29 Oct, above).
2. ~~Draft the 15 new events~~ (`ROSTER_151_DRAFTS.md`). Tāne reviews, then
   they go into the two review sheets.
3. Code: roster, renames, moves, domain names, icons, tests.
4. Migration, rehearsal, PR, deploy, apply, verify.

## Decisions after the sheet review (3 Nov 2026): now 154 events

Tāne reviewed `AllSport levels and standards review.xlsx` and sent a newer list.
Counts are now 17/15/16/16/13/16/18/15/14/14 = 154. The workbook is the source
for levels and standards, with these changes on top of it.

- One list for everyone. Women's lists are gone; sex and age scale the list.
- Events: Clean & Press removed (history and colours stay), Overhead Press new,
  takes Clean & Press's list. Hollow Hold renamed Dragon Flag and moved to
  Calisthenics, history carried. Windshield Wipers moved to Stamina. Hang,
  Skipping Rope (Endurance, continuous; tricks and Game stay in Jump Rope) and
  Cheststand new. Bent Wrist Stretch keeps that name. Repeat Vault renamed
  Leapfrog, its eight levels become heights one to one (Ankles 25cm to Head
  200cm). Steinborn renamed Steinborn Lift.
- Sex scaling (from age 12, none under 12, "Other" stays on the listed standard):
  80% load on lower body, Olympic lifts and Arthur Lift; 70% on upper body and
  carries; 80% on jumps; 12% more time on timed Endurance; 1 colour on upper body
  events with levels; nothing on other events with levels, Flexibility, Control,
  Coordination, Aim, ratings, or throws (today's implements stay).
- Age: percentage on events with a number, colours on events with levels. This
  replaces the 21 Oct decision to keep colours until February. Table awaiting
  Tāne's check in `AllSport final check.xlsx`.
- Stamina arm events keep reps, on the live men's lists. Tibialis Curl follows
  them. Sandbag to Shoulder stays an estimated 1RM. Toe Lift, Leg Extension Hold
  and Plate Hold are a fixed 30s hold.
- Swim reference 400m, times doubled (≤ 12:00 Kahurangi to ≤ 8:00 Taniwha), steps
  50, 100, 200, 400m. Burpee Broad Jump reference 100m. Cycling keeps its old top
  six. Cycling and Ski Erg low steps 100, 250, 500, 1000m. Rating colours stay on
  the live 500 to 1,600 scale.
- The value fixes listed in the 3 Nov review stand: Shotput 7.5m; Bronco D5 ·
  ≤ 7:30; Windshield D4 · 5; Animal Crawl D3 · ≤ 3:00, D4 · Any, D4 · ≤ 4:00;
  0.175× BW at Kākāriki on the 1kg list; GHD 0.3, 0.35, 0.4, 0.5; Full Bound Twist
  and Cobra D2 · 45s; Climbing finish, ≤ 60s, 45s, 30s, 20s, 15s; Breakdancing any,
  10s, 20s, 30s, 45s, 1:00; Trampolining and Diving drills capped below Game;
  Dodgeball D1 any, D2 any, D3 any, D3 · 10, D4 any, D4 · 10. Distance steps earn
  low colours; timed colours need the full distance.
- Before shipping: replay everyone's colours and show Tāne the change.

## Built 3 Nov 2026 (v0.46.0.0)

Compiled into the sheets, code and `20261102211504_roster_154.sql`. Final check edits taken: Hang has three levels (no One-Hand Assisted), Skipping Rope two, Cheststand five with no colour on D3. Real per-domain counts are 17/15/16/13/16/16/18/15/14/14 in domain order. The migration is not applied.
