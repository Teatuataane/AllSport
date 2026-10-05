# In-game screen and standards: design

Agreed with Tāne, 5 October 2026. Four changes to the play screens and My Events.
Nothing here changes what a player earns: no grading rule, no leaderboard rule,
no migration. `GRADING_RULES_VERSION` stays as it is.

| # | Change | Where |
|---|---|---|
| 1 | Show every difficulty level on My Events, played or not | `components/play/PRBoardView.tsx`, `app/prs/page.tsx` |
| 2 | Domain name moves inside each event button; one fixed domain order on every play screen | `components/play/GameEventList.tsx`, `EventListRow.tsx`, `app/workout/[id]/page.tsx` |
| 3 | Win/draw/loss events show their colour, the rating, and games left to a rating | `EventListRow.tsx`, `lib/scoreColour.ts`, both play screens |
| 4 | The colour standards, on the player's own ladder, in game and on My Events | new `lib/standardsLadder.ts`, `QuickEntrySheet.tsx`, `app/prs/page.tsx` |

**Dropped:** requiring film for a solo score above Kahurangi. Solo scores keep counting in full, as they do today.
**Dropped:** more wins in one game giving a higher colour. One game's result stays win Kahurangi / draw Kākāriki / loss Kōwhai (`GAME_RESULT_RUNG`). Colours above Kahurangi come only from the rating, as they do now.

---

## Already true: a best score at every level

`lib/prBoard.ts` keeps one best score per player per level of every tiered
event, and the top five on an untiered one. Beating your D2 best is a PR even
after you have done D4. Records are worked out from the scores each time they
are shown (never stored), and a score's level comes from its `raw_score` band,
not the level's name. Nothing to build. Change 1 is about showing it.

## 1. Every level on My Events

**Now:** `PRBoardView` lists only the levels with a record, plus the level being
scored in the entry sheet.

**Change:** on My Events, list every level of the ladder from D1 up. A level with
no record reads "No record yet", so a player can see the whole ladder and where
they have not been. Each row shows the level's name as well as its number
(`D3 · Feet elevated`), because "D3" alone means nothing on a page with no
ladder beside it.

**Entry sheet unchanged:** it still shows only levels played, plus the one being
scored. It is an entry screen, and a twelve-row ladder pushes the inputs off a
phone. The change is a prop on `PRBoardView` (`showAllLevels`), set only by
`app/prs/page.tsx`. `lib/prBoard.ts` already returns every level, so nothing
changes in the logic.

## 2. Domain inside the button, one order everywhere

**Now:** the live game puts a heading ("4 · SPEED") above each domain and
indents added events by 14px, so buttons don't line up. Personal games split
into "Still to play" and "Scored", which moves a row when it is scored.

**Change:**
- No domain headings. Each button carries its domain on the line under the
  event name (`showDomain`, which the game screen currently turns off), as
  "4 · Speed".
- That line uses the button's own secondary text colour, the grey already used
  for the "Added" line. It is not tinted by the domain, so the colour a score
  reaches stays the only colour on the button.
- No indent on added events. Every button has the same left edge, and the
  existing "Added" tag marks the extras.
- Every button has the second line, so official, added, scored and unscored
  rows are the same height.
- **One order on every screen:** domain 1 to 10. Within a domain the official
  event comes first, then added events in the order they were added. Rows never
  move when scored. Applies to:
  - the player's game screen and the kaiwhakawā's game tab (both
    `GameEventList`, so one change covers both);
  - personal games and kaiwhakawā training sessions (`app/workout/[id]`): the
    "Still to play" / "Scored" split goes, and events sort by domain, then
    planned order.
- The + (add events in this domain) stays on the official event's corner. The
  section's `aria-label` moves to the button, whose accessible name becomes
  "Event, domain".

Watch the progress bar: on the game screen it is coloured per domain from
`domainGroups`. It does not depend on the headings, but check it after the
change.

## 3. Win/draw/loss events: colour, rating, games to a rating

This applies to every event where `STANDARDS[slug].game` is true (topped by a
Game rung) or `kind === 'rating'` (rating only, such as wrestling).

### Button colour

**Now:** the button stays neutral after a win, draw or loss. `scoreRung` uses the
standards, and the standards never grade a single result.

**Change:** the button takes the highest of:
- the result colour for the day's best result: win **Kahurangi**, draw
  **Kākāriki**, loss **Kōwhai** (`GAME_RESULT_RUNG`);
- any drill colour today (capped at Kahurangi, as now);
- the player's rating colour, if they have one (Poroporo at 1,100, then one
  colour per 100 points, up to Taniwha).

This is `eventRungInGame` in `lib/leaderboardScores.ts`, the function behind
the leaderboard's colour total, so the button and the game report always agree.
`scoreRung` calls it for these events instead of `eventGrade`. Several results
on one event in one game: the best counts.

**Known and accepted:** a win turns the button Kahurangi, but HOME's colour for
that event still comes from drills and the rating. The button shows what the
game paid, the same as the game report. It does not show a profile colour.

### What the button says

Under the score, where the colour name and division rank go today:

| Player's state | Line on the button |
|---|---|
| Fewer than 10 rated games in this sport | `KAHURANGI · 7 GAMES TO A RATING` |
| Rated | `POROPORO · RATING 1,148` |

- The games count shows whether or not the event is scored yet. On an unscored
  button it goes on the domain line: `4 · SPEED · 7 GAMES TO A RATING`.
- **The count is 10 minus the games that count:** games both players recorded,
  or a kaiwhakawā settled (`rateGames`, `MIN_RATED_GAMES`). A game only one side
  has recorded doesn't count yet, and the button says nothing about it. No
  "waiting on your opponent" state (decided).
- **The rating is live:** it includes every game that counts so far, today's
  among them. The leaderboard still prices a closed game on the rating at its
  close, so a later run of wins never re-prices an old game.
- A rating below 1,100 still shows its number. The colour then comes from the
  result alone.

### Data

Neither play screen loads matches today. Load them once per screen with the
same query and helper HOME uses (the `matches` read in `lib/loadGrades.ts`, then
`ratingsFor(playerId, matches)`), as their own query. A failure means no rating
and no count: the button falls back to the result colour, which needs nothing
loaded. Reload after the player records a match. The rating needs both sides,
so it moves only when the opponent's record arrives. A reload on reopening the
screen is enough; no realtime subscription.

One small pure helper in `lib/` (testable, no Supabase) decides the line:
`gameEventLine(ev, rating: SportRating | undefined) → { gamesToRating } | { rating }`.

## 4. The standards, in game and on My Events

### What is shown

A **Standards** ladder for the event: every colour Kiwikiwi to Taniwha with the
score needed for it, on the **player's own ladder only**. That is their
division's sex ladder (`ladderFor`) with their age shift applied
(`thresholdFor(thresholds, rung - AGE_SHIFT[band])`), exactly as grading reads
it. No switching between divisions.

Each row shows the colour's name in its colour (`rungPaint`) and the threshold
in the event's own units, using `formatPR` / the `describeRawGap` decoding:

| Standard kind | Row reads |
|---|---|
| Raw, untiered | `Kākāriki · 25 reps` |
| Raw, tiered | `Kākāriki · D3 Feet elevated, 30s` |
| Ratio (strength) | `Kōwhai · 0.65× bodyweight · 52.5 kg` |
| Game-rung event | Kiwikiwi to Kahurangi are drill thresholds, then `Poroporo · Rating 1,100`, `Parahi · Rating 1,200` … `Taniwha · Rating 1,600`. Ratings are not age-shifted. |
| Rating only | Only Poroporo to Taniwha, with one line: "No drill colours: this event is graded on games." |

The player's current colour on the event is highlighted (the same
`eventGrade` HOME uses), along with the next one. The rows above that are the
target.

### Strength with no bodyweight: ratios plus a prompt

Ratios are always shown. Without a bodyweight the kg column is empty and
the ladder shows a bodyweight prompt:
- **In game:** the bodyweight declared for today. The prompt is the existing
  `BodyweightField` inside the standards panel. Saving it fills in the kg
  column, re-colours the buttons (`setBodyweightKg`, as at the top of the
  screen today) and is the same declaration grading uses.
- **On My Events:** the player's most recent declaration, labelled with its
  date ("at 80 kg, 2 Oct"). The prompt shows only if they have never declared
  one, and a weight entered there is recorded for today through
  `record_bodyweight()`, as everywhere else.

Bodyweight stays private: it is read for the player's own ladder only and is
never sent anywhere else.

### Where

- **In game (both play screens, both tabs):** the entry sheet's HOW TO panel
  gets a **Standards** section after "Difficulty tiers". The current "Rules &
  standards" heading becomes "Rules", because it holds the rules text, not the
  colour standards.
- **My Events:** a "Standards" toggle under each event's PR list, collapsed by
  default so the page stays scannable.

### Pure helper

`lib/standardsLadder.ts`:

`standardsLadder(ev, player, bodyweightKg) → { rung, name, label, kind }[]`

It has no React or Supabase imports, and it reads `STANDARDS` and the
`lib/grading.ts` helpers rather than copying thresholds, so it can't drift from
grading. Tests: an age-shifted ladder (Masters, U14), the ratio ladder with and
without a bodyweight, a Game-rung event's drill/rating split, a rating-only
event, and a tiered event's labels.

---

## Order of work and checks

1. Change 2 (layout). It touches every play screen, so do it first and the
   later changes land on the final layout.
2. Change 1 (all levels). A small prop.
3. Change 4 (standards). The new pure module first, with tests, then the two
   panels.
4. Change 3 (win/draw/loss). The new matches read, then the button line.

Each ships with `npm run lint`, `npx tsc --noEmit`, `npm test` and
`npm run build`, plus a `VERSION` / `CHANGELOG.md` bump. None of them needs a
migration or a grading-rules bump.

Add component tests for the extracted parts (`EventListRow` second line and
games-to-rating text, `PRBoardView` all-levels mode), in jsdom, as the existing
component tests do.
