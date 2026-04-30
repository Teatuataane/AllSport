# Changelog

All notable changes to AllSport are documented here.

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
