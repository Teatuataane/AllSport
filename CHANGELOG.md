# Changelog

All notable changes to AllSport are documented here.

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
