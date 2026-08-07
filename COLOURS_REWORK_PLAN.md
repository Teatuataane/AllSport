# Colours Rework — Lifetime Progression, Taniwha Cycle, Kaiwhakawā Alert

**Status:** design locked, ready to build
**Date:** 1 August 2026
**Branch:** `claude/colours-system-rework-513ac2`

Design settled in a `/grill-me` session. Every decision below was chosen deliberately;
where a decision goes against the obvious default, the reason is recorded.

---

## 1. What changes, in one paragraph

Colour points stop resetting each January and accumulate for as long as a player plays.
The ladder extends from 10 rungs to 19: the existing Mā through Taniwha, then a second
cycle of Taniwha Kiwikiwi through Taniwha Uenuku at +10,000 each, capped by a single peak
rung at 100,000: **Ngā Taniwha**.
The competitive leaderboard stays seasonal so there is still an annual contest. A new
kaiwhakawā alert tells the coach **during a live session** that a player is about to cross
a colour, so the moment can be marked in the room rather than discovered after everyone
has gone home.

---

## 2. Decisions locked

| # | Decision | Chosen | Note |
|---|---|---|---|
| 1 | Taniwha threshold | **stays 10,000** | Real data says this is ~4.5 months for a 3×/week winner and ~1.4 years for a 1.5×/week non-winner, not the 1 and 3 years originally described. Accepted knowingly: it front-loads reward and puts the long game in cycle 2. |
| 2 | Cycle 2 spacing | **flat +10,000** | As specified in the brief. Cycle 1's heavier finish (2,000 steps for Uenuku and Taniwha) is not mirrored. |
| 3 | Cycle 2 skips Mā | **yes** | "Taniwha Mā" would read as a demotion. |
| 4 | Terminus | **hard cap at rung 19** | No rung 20. Nothing stacks past it. Keeps "Taniwha" singular. |
| 5 | Leaderboard | **stays seasonal** | Colour badge shows lifetime colour; rank still comes from current-year points. Preserves the annual contest and a climbable board for newcomers. |
| 6 | Lifetime storage | **new `player_totals`, recomputed not incremented** | Incremental accumulation caused the ×2 double-award bug. A lifetime total that never resets makes that class of bug permanent instead of self-healing each January. |
| 7 | Alert surfaces | **both** | Standing watchlist on `/judge` plus a live in-session banner on the Kaiwhakawā tab. |
| 8 | Alert firing | **conservative** | "Has earned" only fires when the crossing holds even at the player's guaranteed worst case, so the app never announces a colour the trigger later disagrees with. |
| 9 | Alert coverage | **all 19 rungs** | Including Kiwikiwi at 500. A first colour is the best celebration available. |
| 10 | Colour permanence | **append-only, never revoked** | A voided session or a deleted score can lower `lifetime_points`. The colour is kept and the points are simply re-earned on the way back up. |
| 11 | Clearing an alert | **explicit "Celebrated" tap** | The alert nags until the moment has actually been done, which is the point of the feature. |
| 12 | Year tabs | **replaced by a colour timeline** | Year tabs switch `season_year`, which no longer exists as a concept for colours. |
| 13 | Cycle 2 visual grammar | **black card, colour accent** | Background stays Taniwha black; the cycle colour takes border, heading text and progress bar. Black keeps meaning "peak". |
| 14 | Emblem | **one taniwha**, tinted the accent colour, on Taniwha and all of cycle 2 | Cycle 2 is the only place the crest earns a permanent home. |
| 15 | Rung 19 treatment | **the full crest, both taniwha, in amber** | *Revised after inspecting the brand assets.* The AllSport crest is **already twin taniwha**, so "twin emblems" would have put four taniwha on the card. Instead the escalation is one taniwha for cycle 2 and the whole crest for the peak, which is literally what "Ngā Taniwha" names. Rainbow was already spent on Taniwha Uenuku. |
| 16 | Historic points | **restored via `adjustment_points`** | Salvador +800, Rodrigo +1500, Zeke/"Zebe" +1500. Must live in its own column, see §5.2. |
| 17 | Backfilled timeline dates | **reconstructed from session history** | Day one of the feature shows real dates and real sessions, not a wall of "today". |
| 18 | Duplicate Kōki account | **ignored** | Confirmed by Tāne as a made-up account. |
| 19 | Who tells the player | **the coach releases it** | Player sees nothing until the coach taps Celebrated, with automatic release at session close as a fallback. |

---

## 3. The ladder

19 rungs. Single source of truth becomes `lib/colours.ts`.

| # | Colour | English | Threshold | Cycle |
|---|---|---|---|---|
| 1 | Mā | White | 0 | 1 |
| 2 | Kiwikiwi | Grey | 500 | 1 |
| 3 | Whero | Red | 1,000 | 1 |
| 4 | Karaka | Orange | 2,000 | 1 |
| 5 | Kōwhai | Yellow | 3,000 | 1 |
| 6 | Kākāriki | Green | 4,000 | 1 |
| 7 | Kahurangi | Blue | 5,000 | 1 |
| 8 | Poroporo | Purple | 6,000 | 1 |
| 9 | Uenuku | Rainbow | 8,000 | 1 |
| 10 | Taniwha | Black | 10,000 | 1 |
| 11 | Taniwha Kiwikiwi | Grey | 20,000 | 2 |
| 12 | Taniwha Whero | Red | 30,000 | 2 |
| 13 | Taniwha Karaka | Orange | 40,000 | 2 |
| 14 | Taniwha Kōwhai | Yellow | 50,000 | 2 |
| 15 | Taniwha Kākāriki | Green | 60,000 | 2 |
| 16 | Taniwha Kahurangi | Blue | 70,000 | 2 |
| 17 | Taniwha Poroporo | Purple | 80,000 | 2 |
| 18 | Taniwha Uenuku | Rainbow | 90,000 | 2 |
| 19 | **Ngā Taniwha** | The Taniwha | 100,000 | peak |

### Pace, for reference

Derived from 113 real player-sessions: **149 pts/session** for a division winner,
**93 pts/session** for a runner-up, **135** across everyone.

| Milestone | Keen winner (3×/wk, 149) | Casual non-winner (1.5×/wk, 93) |
|---|---|---|
| Kiwikiwi (500) | ~2 weeks | ~4 weeks |
| Whero (1,000) | ~3 weeks | ~2 months |
| Taniwha (10,000) | ~4.5 months | ~1.4 years |
| Each Taniwha colour (+10,000) | ~4.5 months | ~1.4 years |
| Twin Taniwha (100,000) | ~4.5 years | ~14 years |

### One useful invariant

The smallest gap on the ladder is **500** and the theoretical maximum for one session is
**200** (100 placement + 100 effort). **A player can never skip a rung in one session.**
The code still awards every crossed rung defensively, but the alert never has to announce
two colours at once.

### Colour hex values

Canonical values from `CLAUDE.md`, which resolves an existing disagreement: Kōwhai is
`#F9E051` (the dashboard's `#FFE566` is the outlier and gets corrected).

```
Mā #ffffff (card surface #f0f0f0 for legibility)   Kākāriki  #4DB26E
Kiwikiwi #888888                                    Kahurangi #2371BB
Whero    #EA4742                                    Poroporo  #B87DB5
Karaka   #F9B051                                    Uenuku    var(--rainbow)
Kōwhai   #F9E051                                    Taniwha   #000000 on #F9B051
```

---

## 4. Data model

### 4.1 `player_totals` (new)

Keyed on `player_id` **alone**. This is deliberate and fixes a latent bug: `rankings` is
keyed `(player_id, season_year, division)`, so when Salvador turns 17 and moves Juniors →
Men's, or a player turns 40 and moves to Masters, the trigger inserts a **brand new row
starting at zero**. Seasonal points hid this because everything reset each January.
Lifetime points would silently halve a player's total on a birthday.

```sql
CREATE TABLE player_totals (
  player_id         uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  earned_points     int  NOT NULL DEFAULT 0,   -- recomputed from session history
  adjustment_points int  NOT NULL DEFAULT 0,   -- manual, survives every recompute
  lifetime_points   int  GENERATED ALWAYS AS (earned_points + adjustment_points) STORED,
  lifetime_sessions int  NOT NULL DEFAULT 0,
  highest_rung      int  NOT NULL DEFAULT 1,   -- denormalised from colour_awards
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

RLS: public read (the leaderboard needs everyone's colour), judge write, no player write.

### 4.2 `colour_awards` (new)

Append only. One row per colour a player has ever earned.

```sql
CREATE TABLE colour_awards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rung            int  NOT NULL CHECK (rung BETWEEN 1 AND 19),
  colour_name     text NOT NULL,              -- snapshot, survives a rename
  points_at_award int  NOT NULL,
  session_id      uuid REFERENCES sessions(id) ON DELETE SET NULL,
  awarded_at      timestamptz NOT NULL DEFAULT now(),
  celebrated_at   timestamptz,                -- set by the kaiwhakawā's tap
  UNIQUE (player_id, rung)
);
```

The `UNIQUE (player_id, rung)` constraint is what makes the whole thing idempotent: the
mid-session eager claim and the session-close trigger can both try to write the same row
and only one wins.

**Player-side release rule** (no extra column needed, derived on read):

> a colour is visible to the player when `celebrated_at IS NOT NULL`
> **or** the session that caused it is no longer active.

### 4.3 `rankings` (unchanged)

Stays exactly as-is, seasonal, and remains the sole input to the `/leaderboard` ranking.
Its `(player_id, season_year, division)` key still splits a player across two rows if they
change division mid-season, which double-counts them on the All-Divisions tab. **Out of
scope here; log it in `TODOS.md`.**

---

## 5. Server-side logic

### 5.1 `recompute_player_total(p_player uuid)`

Full recompute, never an increment. Reuses the UNION truth-source CTE already proven in
`20260713000000_fix_double_award.sql`:

1. **Truth source 1:** `session_player_summary`, summed as `total_placement_points + effort_points`.
2. **Truth source 2:** sessions closed before summaries existed (pre `20260514`), falling
   back to `MAX(results.points_earned)` per `(player_id, session_id)`, because
   `points_earned` repeats on every row for that player.

Sets `earned_points` and `lifetime_sessions`. Never touches `adjustment_points`.

> **Why recompute:** the ×2 bug was `total_points = total_points + EXCLUDED.total_points`.
> Under seasonal points a bug like that self-heals every January. Under lifetime points it
> is permanent. Same discipline already used in `lib/rating.ts`, which recomputes ratings
> from full history by design.

### 5.2 Why manual adjustments need their own column

`20260610000000_historic_points.sql` is a no-op twice over: it `UPDATE`s `season_year = 2025`
rows that have never existed (prod has **zero** 2025 rankings rows), and it matches Zeke on
`full_name ILIKE '%Zeke%'` when that player's `full_name` is **null** (he is in the DB with
display name "Zebe"). So 3,800 points of intended recognition never landed.

More importantly: because `earned_points` is recomputed, any manual
`UPDATE ... SET lifetime_points = lifetime_points + 1500` would be **silently wiped the next
time that player finishes a session**. Hence `adjustment_points`, which is auditable,
survives every recompute, and gives a legitimate lever for future one-offs (a championship
award, points from play that predates the app).

### 5.3 `award_session_points()` extension

At the end of the existing per-player loop, after the `session_player_summary` upsert:

1. `PERFORM recompute_player_total(rec.player_id);`
2. Insert a `colour_awards` row for **every rung** now crossed that has no row yet, with
   `session_id = NEW.id`, `points_at_award = lifetime_points`, `celebrated_at` left null,
   `ON CONFLICT (player_id, rung) DO NOTHING`.
3. Update `player_totals.highest_rung`.

The atomic claim guard added by `20260713000000` stays untouched.

### 5.4 `claim_colour_award(p_player_id uuid, p_session_id uuid)` RPC

`SECURITY DEFINER`, judge-role gated. This is what makes the **live** moment possible:
`colour_awards` rows normally only appear when a session closes, so without this the coach
would have nothing to stamp `celebrated_at` on mid-session.

It re-derives the conservative condition **server side** so a client can never mint a
colour, and inserts only genuinely safe rungs (`ON CONFLICT DO NOTHING`).

**The conservative condition** (§6.1) is deliberately simple enough to compute identically
on client and server, with no ranking maths at all.

---

## 6. The kaiwhakawā alert

### 6.1 The two states, and the maths

Points are only written when a session closes, so an alert built on stored data fires after
everyone has packed up. The alert therefore has to be **predictive**, and it has to be
predictive in a way that can never be wrong.

Let `L` = committed `lifetime_points`, `T` = the next rung's threshold.

| State | Condition | Meaning |
|---|---|---|
| **"on track for Whero today"** | `L + projected_placement_pts + (effort_level × 5) ≥ T` | Uses the player's *current* provisional division placement. May retract if they slip. |
| **"has earned Whero"** | `L + 10 + (effort_level × 5) ≥ T` | Guaranteed floor. `10` is the minimum placement award for anyone in the session; banked effort can only go up. |

The "has earned" formula uses **no placement ranking whatsoever**, so it cannot be
invalidated by another player finishing strongly. That is what makes conservative firing
safe to announce out loud, and it is cheap enough to compute identically in the browser and
in the RPC.

The projected placement maths for the softer state already exists in `SessionEndTakeover`:
`max(100 − (100/nDiv) × (rank − 1), 10)`, effort `= level × 5`.

**Known edge case:** if a judge deletes a score, `effort_level` can fall and a "has earned"
claim could become false. Colours are permanent (decision 10), so the player simply keeps
it. Accepted.

### 6.2 Part 1 — the standing watchlist (`/judge`)

A **Colours** panel in the Players tab of `app/components/JudgeCard.tsx`, listing everyone
approaching a rung, closest first.

Measured in **sessions away, not points away**, using each player's own rolling average
points per session (last 10 sessions), because *"Meredith: Whero in ~2 sessions"* is
actionable to a coach and *"Meredith: 190 points to Whero"* is not. Raw points shown
underneath as the secondary line.

Covers all 19 rungs, per decision 9. Sensible default filter: within ~3 sessions.

### 6.3 Part 2 — the live banner (Kaiwhakawā tab)

In `app/scoring/[sessionId]/page.tsx`, on the Kaiwhakawā tab only:

- A persistent chip while anyone is **on track**: *"Meredith is on track to earn Whero today"*.
- It upgrades to *"Meredith has earned Whero"* the instant the guaranteed floor clears,
  while she is still standing in front of you.
- Tapping opens a small card: player, colour earned, colour they came from, points.
- A **"Celebrated"** button calls `claim_colour_award`, stamps `celebrated_at`, clears the
  alert, and releases the player-side moment.
- Multiple simultaneous crossings stack as separate chips.

Player-only moments (effort cap, full-house shimmer, new-event toast) remain off the judge
tab, consistent with the session 26 rebuild. This one is judge-only by the same logic.

### 6.4 Part 3 — the player's moment

Gated on the coach, per decision 19. A new headline state on the existing
`SessionEndTakeover`: the colour crossing becomes the top of the end-of-session screen,
above placement and points, with the new colour card rendered full width.

Released when `celebrated_at` is set, **or** automatically at session close if the coach
never tapped, so nobody is left hanging on a forgotten tap.

---

## 7. Client work, surface by surface

### 7.1 `lib/colours.ts` (new, single source of truth)

The ladder was duplicated in **six** places that already disagreed with each other:
`app/dashboard/page.tsx` (`GRADES`), `app/leaderboard/page.tsx` (`getGrade()` **and**
`grades[]`), `app/page.tsx` (`ranks[]`), `app/profile/page.tsx` (`GRADES`), and
`app/scoring/[sessionId]/page.tsx` (`GRADES`), plus a seventh copy inlined in
`__tests__/grades.test.ts`. Three of them had Kōwhai as `#FFE566` and three as `#F9E051`.
Going from 10 rungs to 19 across six copies is not survivable.

```ts
export type Colour = {
  rung: number            // 1..19
  name: string            // 'Taniwha Whero'
  english: string         // 'Red'
  threshold: number
  cycle: 1 | 2 | 'peak'
  accent: string          // hex, or the rainbow gradient
}

export const COLOURS: Colour[]                 // 19 entries
export const PEAK_COLOUR_NAME = 'Twin Taniwha' // ← swap for the te reo name, one line
export function colourForPoints(points: number): Colour
export function nextColour(points: number): Colour | null
export function colourCardStyle(c: Colour): CSSProperties
export function colourSwatchStyle(c: Colour): CSSProperties
```

`colourCardStyle` encodes decision 13: cycle 1 keeps today's solid/gradient treatment;
cycle 2 returns black background with `accent` on border, heading text and progress bar;
rung 19 returns black with amber and twin emblems.

### 7.2 Dashboard (`app/dashboard/page.tsx`)

- Colours card reads `player_totals`, not `rankings`.
- **Delete the year tabs** and the `selectedYear` / `allRankings` machinery behind them.
- Card style comes from `lib/colours.ts`; add the crest watermark for cycle 2.
- Progress bar to the next rung, unchanged in behaviour, correct across 19 rungs.
- The points-history modal gains a **Colour Timeline** section above the existing session
  list: one row per `colour_awards` entry, showing colour, date and the session it happened
  in (*"Whero, earned 3 July 2026 at the Selwyn Winter Jam"*).

### 7.3 Leaderboard (`app/leaderboard/page.tsx`)

- Rank and points columns: **unchanged**, still seasonal from `rankings`.
- Colour column: from `player_totals.highest_rung`.
- Colour Key expands to 19 rungs. Show cycle 1 by default with cycle 2 behind a
  "Beyond Taniwha" reveal, so the key does not become a 19 row wall.
- **Copy fix at `:482`**, currently *"your grade for the year, earned from total season
  points… Points reset each January"*. Rewrite: colour is lifetime and never resets; the
  ranking is the current year.

### 7.4 Home (`app/page.tsx`)

- Colour list at `:38` sourced from `lib/colours.ts`.
- Copy at `:224` about Taniwha updated for the cycle beyond it.
- "My Colour History" button repointed at the new timeline.

### 7.5 Profile and live session

- `app/profile/page.tsx:110` and `app/scoring/[sessionId]/page.tsx:1693` both fetch
  seasonal `rankings` for colour display. Repoint at `player_totals`.

### 7.6 Copy sweep

`grep -rn "reset each January\|season points\|for the year"` across `app/`. Every claim that
colours reset is now false.

---

## 8. Migration

**One migration, `20260802000000_lifetime_colours.sql`.** Additive only; it changes no
existing read path.

1. Create `player_totals` and `colour_awards` with RLS.
2. Create `recompute_player_total()`.
3. Create `claim_colour_award()`.
4. Replace `award_session_points()` with the extended version (§5.3).
5. **Seed** `player_totals` by running `recompute_player_total()` for every player.
6. **Apply adjustments:** Salvador +800, Rodrigo +1500, Zeke +1500. Match Salvador and
   Rodrigo on `full_name`; match Zeke on **`display_name = 'Zebe'`**, since his `full_name`
   is null, which is why the original migration silently matched nothing.
7. **Reconstruct the timeline.** Replay each player's sessions in `session_date` order with
   a running total seeded at `adjustment_points` (those points represent 2025 play, so they
   precede every logged session), and for each rung take the first session where the running
   total reaches the threshold:

   ```sql
   WITH per_session AS ( ... summary UNION ALL results-fallback ... ),
   running AS (
     SELECT player_id, session_id, session_date,
            adj + SUM(pts) OVER (PARTITION BY player_id
                                 ORDER BY session_date, session_id
                                 ROWS UNBOUNDED PRECEDING) AS cum
     FROM per_session
   )
   -- first session per (player, rung) where cum >= threshold
   ```

   Rungs already cleared by `adjustment_points` alone (Rodrigo is Whero before his first
   logged session) get `session_id = NULL` and a nominal `awarded_at` of `2025-12-31`.

8. All backfilled rows get `celebrated_at = awarded_at`, so launch day does not fire twenty
   stale alerts.
9. Set `highest_rung` from `colour_awards`.

### Deploy order: **migration FIRST, then code**

The opposite of the session 27 roster update, and for the opposite reason. This migration is
purely additive and no deployed code reads the new tables, so running it early is invisible.
The new client code **requires** `player_totals` to exist, so shipping code first would break
the dashboard for every logged-in player. Ship the SQL, verify, then deploy.

### Expected outcome (simulated against live prod data, 2 Aug 2026)

The backfill was replayed offline over all 1,086 scored `results` rows and 54 sessions.
Apply the migration and this is exactly what should come out:

| Player | Sessions | Earned | Adjustment | Lifetime | Colour | vs today |
|---|---|---|---|---|---|---|
| RGFell (Rodrigo) | 22 | 3,650 | **+1,500** | **5,150** | Kahurangi | ▲ 2 rungs |
| Coach Tāne | 29 | 4,470 | 0 | 4,470 | Kākāriki | unchanged |
| Salvador | 21 | 2,493 | **+800** | **3,293** | Kōwhai | ▲ 1 rung |
| Zebe (Zeke) | 15 | 1,403 | **+1,500** | **2,903** | Karaka | ▲ 1 rung |
| Loco Chocko | 5 | 550 | 0 | 550 | Kiwikiwi | unchanged |
| *15 others* | 1–4 | 75–435 | 0 | 75–435 | Mā | unchanged |

**19 `colour_awards` rows** in total, all marked celebrated. **Nobody is demoted** (a direct
consequence of keeping Taniwha at 10,000 rather than rescaling). The only movements are the
three players whose historic points are finally applied.

Two things to know:

- **Restoring the historic points changes the pecking order.** Rodrigo passes Tāne on lifetime
  points, 5,150 to 4,470. That is the correct result, since Rodrigo genuinely played the 2025
  sessions those points represent, but it will be visible.
- **Those three promotions arrive silently.** The backfilled rows are pre-celebrated so the
  kaiwhakawā alert does not fire twenty stale notifications on launch day, which means
  Rodrigo, Salvador and Zeke get two, one and one new colour with no ceremony. Worth marking
  in person at the next session.

Sample of the reconstructed timeline:

```
Coach Tāne   Kiwikiwi   2026-05-07  AllSport HQ
Coach Tāne   Whero      2026-05-14  AllSport HQ
Coach Tāne   Kākāriki   2026-07-21  AllSport HQ
RGFell       Kiwikiwi   2025-12-31  (historic points, no session)
RGFell       Karaka     2026-05-12  AllSport HQ
RGFell       Kahurangi  2026-07-29  AllSport HQ
Salvador     Whero      2026-05-07  AllSport HQ
```

### Verification after applying

```sql
-- every active player has a total
SELECT count(*) FROM players p LEFT JOIN player_totals t USING (player_id) WHERE t IS NULL;
-- lifetime should equal the 2026 seasonal total today (only one season exists), plus adjustments
SELECT p.display_name, r.total_points AS season, t.earned_points, t.adjustment_points, t.lifetime_points
FROM player_totals t JOIN players p ON p.id = t.player_id
LEFT JOIN rankings r ON r.player_id = t.player_id AND r.season_year = 2026
ORDER BY t.lifetime_points DESC;
-- timeline sanity: nobody has a rung without every rung below it
SELECT player_id, count(*), max(rung) FROM colour_awards GROUP BY 1 HAVING count(*) <> max(rung);
```

---

## 9. Tests

New `__tests__/colours.test.ts`:

- 19 rungs, thresholds strictly increasing, no duplicate names.
- `colourForPoints` at every boundary and at boundary ± 1.
- `colourForPoints(0)` is Mā; `colourForPoints(999_999)` is rung 19 (hard cap, no rung 20).
- Cycle 2 naming: rungs 11 to 18 are `'Taniwha ' + cycle1[rung − 9].name`, and Mā is skipped.
- **Invariant test:** the smallest gap on the ladder (500) exceeds the maximum single-session
  award (200), so no session can skip a rung. This is the assumption the alert relies on and
  it should fail loudly if the points formula ever changes.
- Conservative-firing helper: given `L`, `effort_level` and a threshold, `hasEarned` matches
  the SQL in `claim_colour_award` exactly. Pull it into a pure function shared by both.

Suite is at 198 passing; expect roughly 215 to 220 after.

---

## 10. Open items and risks

| Item | Owner | Blocking? |
|---|---|---|
| ~~Te reo name for rung 19~~ | — | **Resolved: Ngā Taniwha.** |
| **Two emblem assets** into `public/colour-emblems/` (see §10.1) | Tāne | Partially. Cards render with the emblem slot empty until they land; nothing else waits on them. |
| `rankings` splits a player across rows on a division change, double-counting them on the All-Divisions tab | log in `TODOS.md` | No. Pre-existing, unrelated to this change. |
| Kōwhai hex disagreement (`#FFE566` vs `#F9E051`) resolved to `#F9E051` | this plan | No. |
| Kōki duplicate account | ignored, confirmed made-up | No. |
| Effort level can fall if a judge deletes a score, invalidating a claimed crossing | accepted | No. Colours are permanent by decision 10. |
| The gap between winning and never winning is only ~1.6×, because effort dominates | accepted, by design | No. Consistent with the koha and accessibility mission. Worth revisiting only if the ladder ever needs to reward winning more than attendance. |

### 10.1 Emblem assets needed

The supplied `SVG/Colour Logo_White outline.svg` is **not usable** as a watermark: it is the
7-fill multicolour version (a single-colour silhouette is required for CSS-mask tinting, and
collapsing its structural white outline turns the artwork into a blob), it has the
"ALL SPORT" wordmark bar baked in, and its fine linework will not survive being drawn at
~200px and low opacity.

Two exports needed, to the same spec as `public/event-icons/` so the existing
`EventIcon` mask-and-tint pipeline works untouched:

| File | Content | Used by |
|---|---|---|
| `public/colour-emblems/taniwha.png` | **one** taniwha, no wordmark bar, no koru shield | Taniwha + all of cycle 2, tinted the accent colour |
| `public/colour-emblems/nga-taniwha.png` | **the full crest**, both taniwha, no wordmark bar | Ngā Taniwha only, in amber |

Spec: transparent PNG, solid single colour (black is fine, it gets masked and tinted),
roughly square, 1000×1000, simplified enough to read at 200px.

---

## 11. Suggested build order

1. ~~`lib/colours.ts` + `__tests__/colours.test.ts`~~ **DONE.** 19 rungs, lookups, progress,
   `crossedRungs`, the two live-alert predicates and the card/swatch/emblem styling.
   54 tests; suite at 233 passing, typecheck clean. `__tests__/grades.test.ts` deleted
   (it held a sixth inline copy of the ladder and asserted Taniwha was the top of it);
   its points-formula tests moved across with the **gap floor bug corrected** — the old
   copy used `Math.max(100 / playerCount, 10)`, reintroducing the floor removed in May 2026.
2. ~~Write and apply `20260802000000_lifetime_colours.sql`~~ **DONE — APPLIED TO PROD
   2026-08-07 and verified live.** Written against the real Postgres parser (44 top-level
   statements, plus the three in-function statements parsed standalone) and rehearsed offline
   first. The applied result matches that rehearsal **row for row**: RGFell 5,150 Kahurangi,
   Coach Tāne 4,470 Kākāriki, Salvador 3,293 Kōwhai, Zebe 2,903 Karaka, Loco Chocko 550
   Kiwikiwi, 27 `player_totals` rows, 19 ladder rungs with rung 19 = Ngā Taniwha.
   - **Security verified in prod, not assumed:** `colour_awards` returns `[]` to an anonymous
     caller (RLS holds) and `claim_colour_award` returns **HTTP 401** to anon (the REVOKE
     holds, so nobody can mint themselves a colour).
   - **Live confirmation of the two-number design:** the leaderboard now shows
     `2 | RGFell | KAHURANGI | 3650 pts` above `1 | Coach Tāne | KĀKĀRIKI | 4470 pts` —
     rank from season points, colour from lifetime, exactly as intended.
   - Note: a worktree has no `supabase/.temp`, so `supabase db push` must run from a linked
     checkout (or symlink `.temp` in). Running it from `~` fails with "Cannot find project ref".
3. ~~Repoint dashboard, leaderboard, home, profile at `lib/colours.ts` and `player_totals`~~
   **DONE.** Six inline copies of the ladder deleted (`app/dashboard`, `app/leaderboard` ×2,
   `app/page`, `app/profile`, `app/scoring/[sessionId]`); all now read `lib/colours.ts`.
   Year tabs removed from the Colours card and the points-history modal (the modal's tabs
   were already cosmetic: `loadHistory` never filtered by year). Emblem watermark slot wired
   into the Colours card. `colourOnDark()` added for name colours on the dark theme.
   - **Verified in-browser:** home colour list (10 rungs + the "beyond" line), leaderboard
     Colour Key with the "Beyond Taniwha" reveal showing all 9 remaining rungs, rewritten
     copy on both, no console errors. Fixed one visual bug found this way: Taniwha Uenuku's
     28px chip fell back to a grey edge because `border` cannot take a gradient; it now uses
     the two-layer `background-clip` trick.
   - **Not verified in-browser:** the dashboard Colours card and the profile badge are behind
     auth and there is no test login available here. They typecheck and the tests pass.
   - **Pre-migration behaviour confirmed**: with `player_totals` absent, the leaderboard
     renders every player as Mā rather than erroring (supabase-js returns the error in the
     result object, so `data ?? []` degrades cleanly). It will populate the moment the
     migration lands.
4. ~~Colour timeline (replaces the year tabs)~~ **DONE.** A "Colours earned" section at the
   top of the points-history modal: one row per `colour_awards` entry, newest rung first,
   showing the colour chip (cycle-2 grammar, gradient edge for the rainbow rungs), the name,
   the date and venue of the session it happened in, and the points total at the time.
   Adjustment-only rungs with no session read "Awarded for play before AllSport kept
   records". The session list below it now carries a "Sessions" heading.
   - **Edge case found and fixed while building this:** the early-claim design lets a
     kaiwhakawā write an award row mid-session, but `lifetime_points` only catches up when
     the session closes. A player given Whero in front of the room would have seen
     "Whero — 60 pts to go" on their own dashboard. New `nextColourFrom(points, highestRung)`
     targets the rung above the highest AWARDED one, with a regression test.
   - **Not verified in-browser.** The route compiles and serves 200 with no console errors,
     but the modal is behind auth and the timeline needs `colour_awards` to exist, so it
     needs both a login and the migration applied before it can be eyeballed.
   - Note: the "My Colour History button on the homepage" described in `CLAUDE.md` does not
     exist in the code. Nothing was repointed because there was nothing to repoint.
5. ~~`claim_colour_award` RPC + the live Kaiwhakawā banner~~ **DONE (code); RPC ships with the
   migration.** New pure `lib/colourAlerts.ts` (+15 tests) and the banner in the Kaiwhakawā
   tab of `app/scoring/[sessionId]/page.tsx`.
   - **`divisionRanks()` extracted, not copied.** The banner needs provisional placement for
     EVERY player, while the existing `myDivisionPlacement` memo only computes it for the
     viewer. Given this codebase had six copies of the colour ladder silently drift apart, a
     second copy of the placement maths was not acceptable, so it now lives in the lib with
     tests covering ties, missed events, best-of-multiple-submissions and per-division
     isolation. *(Follow-up: point `myDivisionPlacement` at it too — left alone this pass to
     avoid changing behaviour the banner does not depend on.)*
   - **Banner states.** `on-track` (grey, no button) uses the current provisional placement
     and says how many guaranteed points are still missing. `earned` (amber, rainbow top
     stripe, **Celebrated** button) only appears once `lifetime + 10 + effort×5` clears the
     threshold, so it holds even if the player finishes last. Judge tab only, and hidden
     once the session has ended.
   - **The tap retires the alert with no round trip.** `celebrateColour` calls the RPC then
     bumps `highest_rung` in local state; `nextColourFrom` moves to the next rung and the
     chip disappears. `lifetime_points` is deliberately left alone, since it genuinely does
     not change until the session closes.
   - **Not verified in-browser.** The route compiles and serves (307 to login, no console
     errors), but the banner needs a judge login, a live session and the migration applied.
     All 15 alert scenarios are covered by unit tests instead.
   - Lint: the file is back to its baseline 12 problems. The one new violation I introduced
     (`setState` in an effect body) was fixed by inlining the fetch with a `cancelled` guard,
     which also protects against the out-of-order responses that bit `judgePRs` in session 26.
6. ~~`SessionEndTakeover` colour headline~~ **DONE.** The takeover fetches
   `colour_awards` for `(player_id, session_id)` and renders any colour earned today as a
   full-bleed card **above** the placement ordinal and the points row, because on the day you
   cross a threshold that is the headline, not where you finished.
   - **The release rule needs no code.** Rows for this session exist either because the
     kaiwhakawā tapped "Celebrated" (already released) or because the close trigger wrote
     them, and the takeover only renders once `sessionEnded` is true. The "auto-release at
     session close if the coach forgot" fallback is therefore structural rather than a
     branch that could rot.
   - **`colourCardStyle` now owns the border.** Verified through a temporary preview route
     (since deleted) which was the first time either full-size card had actually been looked
     at. It caught Taniwha Uenuku rendering an **amber** border while its leaderboard chip
     rendered rainbow, because CSS `border` cannot take a gradient and was silently falling
     back. The two-layer `background-clip` trick moved into `colourCardStyle`, which removed
     the duplicated border logic from three call sites at the same time.
   - **Missing emblems degrade cleanly** — confirmed visually. No broken image, no layout
     shift; the masked element simply renders nothing.
   - **⚠ Taniwha and Ngā Taniwha are visually identical until the emblems land.** Both are
     black with an amber edge and amber lettering. The single-vs-twin emblem is the only
     thing that separates rung 10 from rung 19, so §10.1's two PNGs matter more than
     "nice to have".
   - **Not verified in-browser** in situ: the takeover needs a login, an ended session and
     the applied migration.
7. ~~`/judge` standing watchlist~~ **DONE.** `colourWatchlist()` added to `lib/colourAlerts.ts`
   (+8 tests) and rendered by a new `components/ColourWatchlist.tsx` in the Players tab of
   `JudgeCard`.
   - Sorted soonest-first, measured in **sessions away** from each player's mean points over
     their last 10 finished sessions, with points-to-go and current form as the secondary
     line. Default cutoff is 3 sessions.
   - Players with no finished sessions are skipped: there is no form to extrapolate from, and
     they are 500 points from their first colour anyway.
   - **A test caught dead code.** `Math.max(1, …)` guarded against a 0-session estimate, but
     `nextColourFrom` always returns a rung strictly ahead of the player (it either beat the
     points, so `threshold > lifetime`, or beat the awarded rung, which is already ahead of
     the points). `pointsToGo` can never be 0. The guard is gone and a test now pins the
     invariant instead of the impossible case I originally wrote.
   - **Extracted to its own component rather than inlined**, so the temporary preview harness
     could verify the real component instead of a copy of its markup. `JudgeCard` was already
     past 1,200 lines. Verified visually: sort order, both chip grammars, singular/plural.
8. ~~Copy sweep, then `CLAUDE.md` update~~ **DONE.**
   - Copy: every claim that colours reset is gone. User-visible "grade" wording replaced with
     "colour" on the home page ("AllSport's colours follow the light spectrum"), the
     leaderboard koha link ("colour achievers") and `/koha` ("Your colour is earned by
     playing — not by giving"). Internal `grade` variable names left alone.
   - `CLAUDE.md`: Colour System section rewritten for 19 rungs and lifetime points; new
     "Colours rework (session 28)" block; `player_totals` / `colour_awards` / `colour_ladder`
     added to the schema; `lib/colours.ts`, `lib/colourAlerts.ts`,
     `components/ColourWatchlist.tsx`, the migration and `public/colour-emblems/` added to the
     file structure; seven new Key Decisions; footer updated.
   - **Three stale claims in `CLAUDE.md` corrected** while I was in there: the 2025 year tab
     "for Tane, Zeke, Rodrigo, Salvador" (there have never been any 2025 `rankings` rows), the
     homepage "My Colour History" button (does not exist), and the Taniwha-as-peak wording.

---

## 12. Where this stands

**Written and verified as far as it can be without prod:** all eight steps. 260 tests,
typecheck clean, lint at or below baseline on every touched file.

**Blocked on Tāne:**

| | |
|---|---|
| ~~Apply `20260802000000`~~ | **DONE 2026-08-07**, verified live |
| **Two emblem PNGs** (§10.1) | Without them Taniwha and Ngā Taniwha are the same card |

**Unverifiable here, and worth a look once the above lands:** the dashboard Colours card and
timeline, the `/profile` badge, the session-end colour headline, the live Kaiwhakawā banner
and the `/judge` watchlist. All are behind auth, and most also need `player_totals` to exist.
The pure logic under each is unit-tested; the pixels are not.
