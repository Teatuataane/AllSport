# AllSport — TODOS

## ✅ Done

- Deploy to Vercel
- Custom domain allsport.nz — DNS configured, SSL live, Supabase Auth URLs updated
- Google OAuth redirect URLs configured for production
- RLS policies — results INSERT, UPDATE, rankings write
- Points auto-calculation trigger (award_session_points on session close)
- season_year on rankings, unique constraint (player_id, season_year)
- calculate_streak() function
- Live leaderboard — real Supabase data, division tabs, podium
- Active session banner on leaderboard (realtime, shows current leader)
- Session scoring — per-event structured inputs (10 modes: strength, reps, time, hold, distance, flexibility, sport, sprint, weight+time, distance+time, dynamic)
- Sprint timing mode — seconds + centiseconds for 100m/50m/200m Sprint
- Score upsert — resubmitting updates instead of erroring
- Score submission re-fetch — results always appear after submit (fixes realtime UPDATE miss)
- Unique constraint: results_player_event_unique (player_id, session_id, event_id)
- Expandable event scores in session leaderboard (shows ranked list, current best)
- Judge Void button — cancels session without awarding points
- Session start time — editable field, pre-filled with now
- Pre-session timer — purple "until start" countdown before started_at, then game clock
- Bodyweight field in session scoring — saves to player profile
- Schedule page — corrected session times (4:30pm Tue/Thu) and championship date (14 Mar 2027)
- Removed "Train Everything" tagline from login screen
- QR code fullscreen in JudgeCard
- Sport events — record opponent name + conflict detection between players
- Distance score decimal fix — stored as whole cm integers (no DB type errors)
- Division tabs on live session leaderboard — All-Divisions / Men's / Women's / Juniors
- All-Divisions multipliers — Women's/Juniors ×1.2, Masters Men ×1.2, Masters Women ×1.4
- Supabase SSR middleware (middleware.ts) — fixes session persistence and Google double sign-in
- Navbar — switched to browser client, PLAY NOW hides when logged in (shows DASHBOARD)
- /play — redirects already-logged-in users to dashboard
- Browser tab — "AllSport — Play EVERYTHING" + logo favicon
- Bodyweight SQL migration — `ALTER TABLE players ADD COLUMN IF NOT EXISTS bodyweight_kg NUMERIC;`
- Sign out button on desktop navbar
- Family accounts — parent adds/removes whānau profiles from dashboard; "Submitting as" switcher in live session; `parent_id` column + RLS migration
- Registration failure fix — switched to `supabase-browser`, upsert on profile, email-confirmation handling
- Legacy `lib/supabase.ts` deprecated — all pages now use `supabase-browser.ts`
- SQL fix: `v_player_count` now counts distinct players (not result rows) — point gaps were wrong
- SQL fix: Masters Women ×1.4 multiplier ELSIF reordered — was unreachable, always gave ×1.2
- Missing scores default to last place — players with no score for an event display as "No score" and are ranked last
- Judge score edit — pencil icon on each result row in expanded event list, pre-fills input form, recalculates leaderboard on save
- Judge score delete fix — confirmation state works correctly, delete executes on second click, leaderboard recalculates
- "Overall" tab renamed to "All-Divisions" everywhere (live session, global leaderboard, post-game popup, session history)
- Post-game popup — triggers on session close, shows placements, per-event breakdown, bonuses, total points, colour progression moment with animation
- Session history View Summary — past session popup viewable from dashboard session cards
- My Colour History — colour progression section on homepage becomes a button for logged-in players, opens modal of all past session summaries
- Colours section renamed from "Grade" on dashboard — conditional year tabs (no 2024, 2025 only for players with data), coloured progress bar
- T-Race — renamed from T-Test everywhere, converted to sport/win-loss input mode
- Chin Hang — renamed from Chin Lift everywhere
- Difficulty tiers — tier selector in live session scoring for 24 events; stored in results.difficulty_tier; defined in lib/eventData.ts
- Breakdancing converted to difficulty tier + time format (D1 Toprock → D6 Full Routine + seconds)
- 1 Leg Squat updated to D1 Assisted Lunge → D6 Dragon Squat
- Toe Lift converted to weight + reps (no tiers)
- Turkish Get Up converted to weight + reps (no tiers)
- Disadvantage system — self-declared small/large per event; ×1.2/×1.5 multiplier on strength events; recorded on all events; three options per level per event (5 events fully defined, 95 placeholder)
- Event detail pages — /events/[slug] public pages with template: how-to, rules, difficulty tiers, disadvantage options, personal best
- Events index — /events listing all 100 events by domain, links to detail pages
- How To Play page links to /events; event names in domain table link to detail pages
- Live session event names link to /events/[slug] (opens new tab)
- Personal bests page — /prs with all 100 events, expandable history, this season + previous seasons tabs
- Dashboard PR section replaced with "My Personal Bests" button linking to /prs
- Real-time player count in JudgeCard
- lib/eventData.ts — single source of truth for all 100 events
- supabase/migrations/20260428_phase2.sql — difficulty_tier, disadvantage_type, disadvantage_option columns; updated award_session_points trigger
- Sessions page display verified — times, location, championship date all correct
- Difficulty tier labels on session event listings (e.g. "Planche D1–D7")

---

## P1 — Do Next

### Populate event content for remaining 95 events
**What:** Fill in `howToPerform`, `rules`, and all disadvantage options in `lib/eventData.ts` for the 95 events that currently have placeholder content.
**Why:** Event detail pages show "Content coming soon" for most events.
**Effort:** L (content work, not code) — can be done incrementally, one domain at a time.
**Where:** `lib/eventData.ts`

### Real-time player count in JudgeCard
**What:** Already done — confirm it is working in production.

---

## P2 — Soon

### Welcome email on registration
**What:** Send a branded welcome email when a new player registers — their username, division, next session times, and a link back to their dashboard.
**How:** Supabase Edge Function triggered by a database webhook on `players INSERT`, calling Resend (free tier, 3,000/month). Domain `allsport.nz` needs two DNS TXT records added in Resend.
**Effort:** M (CC)

### Judge approval flow
**What:** Judges can be assigned via the app rather than running `UPDATE players SET role = 'judge'` manually.
**Effort:** M (CC)

### Player profile page
**What:** Players can view and edit their display name, division, privacy settings, and grade history.
**Effort:** M (CC)
**Where:** New route `/profile` or modal from dashboard.

### Disadvantage options — full 100 events
**What:** Define all three small and three large options for the 95 events currently using placeholders in `lib/eventData.ts`.
**Effort:** L (content work) — no code changes required, only data entry in the constants file.

---

## P3 — Later

### Verify Te Reo "Kaiwāwao"
**What:** Confirm "Kaiwāwao" is correct and culturally appropriate for judge/referee in a sports context.
**Effort:** S (human) — ask a te reo advisor or native speaker before first public session.
**Where:** `app/components/JudgeCard.tsx` heading.

### Championship registration flow
**What:** Separate registration/confirmation flow for the annual championship.
**When:** 6 months before March 2027.

### created_by column on sessions
**What:** Add created_by (player_id) to sessions so judge panel can show "your sessions" vs all.
**When:** Add when second judge joins.

### Disadvantage system — full rules documentation
**What:** Write comprehensive public-facing rules for the disadvantage system.
**When:** Before 2027 Championship.
