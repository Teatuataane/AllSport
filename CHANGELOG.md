# Changelog

All notable changes to AllSport are documented here.

## [0.3.3.0] - 2026-07-03

### Changed
- **Homepage redesigned** — new hero headline "One Sport, Every Sport." over the true brand rainbow, refreshed copy (better at everything / one sport for everyone / play solo or with whānau), and a koha-only badge.
- **Landing page pulled onto the official brand palette** — replaced the off-brand hero and section colours (#e63946, #2563eb, #9333ea, yellow) with the canonical tokens (#EA4742, #2371BB, #B87DB5) and the pink-inclusive six-colour rainbow. Scoped to the landing page; global tokens are unchanged.
- **Event pools refreshed** to current lists (Sandbag to Shoulder, Ultimate Frisbee, Rats & Rabbits, Speed Chess, Foot Juggling).
- **Colour ladder** now shows the point threshold for each grade (0–499 … 10,000+).
- **Metadata title and description** updated to the new tagline.

### Added
- **Session times band** on the homepage — Tuesday and Thursday 4:30pm, Saturday 9am at 26 Carbine Place, Sockburn, with a link to the full schedule.
- **"How it works" stat row** (10 disciplines · 100 minutes · lowest total wins) folded into the What Is AllSport section.

### Removed
- **Clunky "One session, all of you" format section** — replaced by the inline stat row above.

## [0.3.2.0] - 2026-06-10

### Fixed
- **Women's / Masters Women now appear on the leaderboard** — root cause was that the Masters/Grandmaster chips switched the entire ranking pool, making any player registered as "Masters Women" invisible unless the chip was toggled. All women (Women's + Masters Women + Grandmaster Women) now rank together in a unified pool. Same fix applied to Men's.
- **Leaderboard auto-refreshes without manual page reload** — added a 15-second polling fallback alongside the existing realtime subscription so scores appear automatically.
- **Men's, Women's, and Juniors sections always visible** — previously hidden entirely when no scores were submitted. Now always rendered with a "No scores yet" placeholder.

### Added
- **Total placement score on every leaderboard row** — each player row now shows their cumulative placement score (e.g. `9pts`), the sum of ordinal event placements (lower = better).
- **Masters/Grandmaster sub-division rank badge** — when viewing the full Men's or Women's pool, Masters and Grandmaster players show a secondary rank label (e.g. "1st Masters") below their overall rank.
- **Judge Game Summary tab** — a new "Summary" tab (visible to Kaiwhakawā only) shows all three divisions with all players ranked by total placement score. Each player is expandable to see all event scores and ordinal placements. Judges can delete any score directly from this view, live or post-session.

## [0.3.1.0] - 2026-06-08

### Changed
- **Live session in-game screen redesigned** — top banner now shows the player's current division placement (ordinal) and time remaining side by side, replacing the removed join-code display.
- **Event cards collapsed view updated** — now shows Score, Division rank for that specific event (with medal colours for top 3), and Effort Level. Personal record removed from collapsed view.
- **Event cards expanded view** — "Today's Top Score" is now the player's own session best; "All Today's Scores" shows the player's own submissions only.
- **Live session leaderboard replaced** — tab-based system replaced by three simultaneous sections: Men's, Women's, and Juniors. No effort leaderboard (effort shown on event buttons only).
- **Leaderboard top 3 expandable** — tap any top-3 row to see all event scores and ordinal placements. "Show all" expands ranks 4+.
- **Logged-in player pinned** — current player appears pinned below top 3 with their actual rank and a "YOU" label.
- **Masters/Grandmaster toggle per gender section** — replacing the section outright rather than adding extra rows.
- **Junior age year chips** — exact age shown (not cumulative U-age), only ages present in the session; combinable with event filter.
- **Event filter** — replaces overall ranking with event-specific flat list; age + event filters work together.

## [0.3.0.2] - 2026-06-02

### Changed
- **Domain names and order clarified across the entire app** — five domains renamed and four renumbered. New canonical order: Maximal Strength (1), Calisthenics (2), Power (3), Speed (4), Anaerobic Endurance (5), Aerobic Endurance (6), Flexibility (7), Body Awareness (8), Coordination (9), Aim & Precision (10). Old names (Relative Strength, Muscular Endurance, Flexibility & Mobility, Speed & Agility, Co-ordination) are retired.
- Updated all pages: homepage, How To Play, scoring setup, event voting, and judge panel now show the new names and order.
- DB migration `20260602_rename_domains.sql` backfills all historical session and vote data to the new domain numbers and names.

## [0.3.0.2] - 2026-05-07

### Fixed
- **Leaderboard now ranks players by total session placement** — the competitive tab shows players ordered by their combined placement score across all events (lowest = 1st), not an event-by-event list. Expand any player row to see their per-event score and placement.
- **Single-row tab bar** — the two-level Competitive / Effort split is gone. The first tab is always "Effort Level (All-Divisions)" (purple); remaining tabs are division-specific competitive views, shown only when a player from that division has submitted a score. Age labels added: Juniors (U17), Masters Men (40+), Masters Women (40+), Grandmaster Men (60+), Grandmaster Women (60+).
- **Effort tasks unlock on first submission** — effort tasks are now locked only until the player submits their competition score for an event. The session score acts as the baseline PR when no season PR exists, so tasks generate immediately after the first submission.
- **Event button always shows "Effort Level: N"** — unscored events no longer display "— pts"; the effort level counter starts at 0 and increments with qualifying submissions.
- **Reps and hold mode effort tasks** — `reps` events now generate 3/5/8-set tasks at 90/80/70% PR; `hold` events generate a fixed 2-minute task.
- **Difficulty+time task times are proportional** — tasks use ×1.5/×2.0/×3.0 multipliers on the PR hold time, stepping down D-1/D-2/D-3 tiers (previously used fixed 60/120/240s regardless of PR).

## [0.3.0.1] - 2026-04-30

### Fixed
- **Session code not displaying** — the join code was never written to the database when a session was created, leaving the JudgeCard badge and the in-game banner blank. New sessions now generate and store a 6-character alphanumeric code on creation.

## [0.3.0.0] - 2026-04-28

### Added
- **Event pages** — browse all 100 events at `/events`, or go deep on any single
  event at `/events/[slug]`. Each event page shows how to perform it, the rules,
  scoring method, difficulty tiers (D1–Dn), disadvantage options, and your
  personal best for that event if you're logged in.
- **Personal bests page** — `/prs` shows your best result for every one of the
  100 events, grouped by domain. Tap any event to expand the full history with
  PB badge, championship flags, and difficulty tier labels. Switch between this
  season and all-time with the tab at the top.
- **Difficulty tiers** — 24 skill events now have D1–Dn tier selectors in the
  live scoring view. Breakdancing and Standing Split use a tier × time formula
  so harder variations always rank above easier ones regardless of performance time.
- **Disadvantage system** — players can self-declare a small or large disadvantage
  before competing. Strength events (Domain 1 and 2) apply a 1.2× or 1.5× score
  multiplier. All events record the declaration for future reference.
- **All-Divisions tab** — the combined division tab is now labelled "All-Divisions"
  throughout the live scoring leaderboard.
- **Missing score = last place** — players who submit at least one result in a
  session but miss an event are assigned last place for that event in the standings.

### Changed
- **Dashboard Colours section** — the grade section is now called "Colours" and
  the progress bar uses the colour of your current grade (White → Taniwha Black).
  Year tabs are computed from your actual ranking history (no placeholder years).
- **Session history summary** — each recent session on the dashboard now has a
  "View Summary" popup showing your per-event scores and placements.
- **Browse all events link** — the How to Play page now links to `/events` and
  each domain accordion links to the full event list.
- **Difficulty tier labels** — D1–Dn range is shown on event buttons in session
  setup and on event rows in the live session event list.
- **T-Race** renamed from T-Test; **Chin Hang** renamed from Chin Lift — updated
  across scoring setup, live session, and event data.
- **My Personal Bests** — the dashboard now links to `/prs` instead of showing
  a stub card.

### Fixed
- **Post-game standings lookup** — player lookup in the post-game popup now uses
  `player_id` rather than display name (display name changes no longer cause a
  missing placement).
- **Judge edit clears adjusted_score** — editing a result as a judge now sets
  `adjusted_score = null` so the override isn't contaminated by a prior
  disadvantage multiplier.
- **Difficulty tier guard** — if a tier name is no longer found in event data,
  score computation returns 0 rather than a large negative value.
- **Ordinal suffixes** — 11th, 12th, 13th now display correctly (was 11st/12nd/13rd).
- **Personal best query** — event detail page now correctly filters results by
  event name (was returning the global best across all events).
- **React key collision** — no-score ghost entries now use `player_id` as the
  key component to avoid collisions with real players who have similar names.
- **Session summary null guard** — View Summary button in the dashboard now guards
  against a null `userId` before fetching results.
- **CURRENT_YEAR** — personal bests page now derives the season year from the
  system clock rather than a hardcoded 2026 constant.

## [0.2.0.1] - 2026-04-23

### Fixed
- **Google OAuth registration loop** — new players completing registration via Google
  sign-in were stuck in an infinite loop ("No player profile found") because the
  `players` table had no RLS INSERT policy for self-registration. Added
  `Players can insert own profile` and `Players can update own profile` RLS policies.
  Profile save errors are now surfaced in the UI rather than silently swallowed.

## [0.2.0.0] - 2026-04-22

### Added
- **Family accounts** — parents can add whānau profiles from the dashboard and submit
  scores on their behalf during sessions. The "Submitting as" switcher in the live
  session view makes it easy to record results for each family member. Division is
  set automatically based on age, with a gender toggle for adult family members.
- **Automatic point calculation** — session points are now awarded automatically when a
  session closes (either by judge or by the 100-minute timer). The trigger runs
  placement scoring, bonuses, and multipliers and writes to rankings immediately.
- **Sign out button** on the desktop navbar, matching the existing mobile experience.
- **Family accounts DB migration** — `parent_id` column and RLS policies so parents can
  insert, update, and delete their linked child profiles and submit results for them.
- Welcome email task added to P2 backlog.

### Fixed
- Registration now works correctly during live sessions — switched to the SSR-aware
  Supabase client, uses upsert on profile creation, and handles the email-confirmation
  path gracefully.
- Auth callback creates a minimal player profile when an OAuth user signs in without
  completing the registration form (covers the email-confirmation edge case).
- **Point gap calculation** — `v_player_count` now counts distinct players, not total
  result rows. Previously a 5-player session with 10 submitted events per player was
  treated as a 50-player session, giving everyone near-minimum points.
- **Masters Women multiplier** — the ×1.4 branch was unreachable due to ELSIF ordering.
  Masters Women now correctly receive ×1.4 instead of ×1.2.
- Timer in live session no longer makes repeated DB calls after the session ends.
- `handleAddMember` button no longer gets permanently stuck in disabled state if the
  auth check fails.
- Removing a family member now checks for errors before updating the UI.

### Changed
- Legacy `lib/supabase.ts` client deprecated and replaced with a deprecation stub.
  All components now use `supabase-browser.ts` which handles SSR sessions correctly.
