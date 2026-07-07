# AllSport — TODOS

## ✅ Done

- Domain rename (June 2026): Relative Strength → Calisthenics, Muscular Endurance → Anaerobic Endurance, Flexibility & Mobility → Flexibility, Speed & Agility → Speed, Co-ordination → Coordination. New order: Maximal Strength / Calisthenics / Power / Speed / Anaerobic Endurance / Aerobic Endurance / Flexibility / Body Awareness / Coordination / Aim & Precision. Updated lib/eventData.ts, all app pages, and DB migration 20260602_rename_domains.sql
- Event selector in scoring setup now derived from eventData.ts — names always in sync, no more hardcoded DOMAINS array
- `score` inputMode added for Golf and Disc Golf (stroke count for 4 holes, lower is better)
- Domain 6 updated: Bronco (D1–D3) and Walking (D1–D3) replace Sprint Repeats and 30-15 Test
- Domain 10 updated: Bocce replaces Cornhole, Kubb replaces Bowling
- Effort task system simplified: one repeatable task per event, +5 pts per qualifying submission (effort level × 5, cap = effort level 20)
- getBonusTargets simplified to return 1 target per event
- D6 effort formula: half-distance at 80% pace (or same D1 distance if PR is D1 tier)
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
- Judge player management — judges can add any registered player or create a guest during a live session via "+" button; tabs persist in localStorage; guest players get real player_id, earn placement points, appear on leaderboard
- Guest players — stored in players table with is_guest=true, no auth account; players.id FK to auth.users dropped (migration 20260505); RLS updated so judges can insert players/results/bonuses for any player
- Bento dashboard redesign — 6 hero cards: Judge (judge-only → links to /judge), Vote (when active), Player Profile, Colours (points history modal on tap), Personal Bests, Join a Game
- /judge page — dedicated judge panel, role-gated; wraps JudgeCard; create/end/void sessions, QR code, Event Votes panel (Kōwhiringa Tūāhuatanga)
- /profile page — icon picker (20 sport emojis), username/display name editing, leaderboard display prefs, family member management, active profile switcher (localStorage)
- Event voting system — judges create votes via /judge; players vote step-by-step (one domain per screen); partial save (is_final=false); locked on final submit; spoiler-free results; counts while open, percentages after close; judge full breakdown with voter names; VoteBanner on dashboard
- session_player_summary table — populated by award_session_points trigger; dashboard points history; per-session: date, placement, effort level, points breakdown
- Event content populated — howToPerform + rules written for all 94 placeholder events in lib/eventData.ts (pending Tāne's review of flagged events: Toe Lift, Kelly Snatch, Repeat High Jump, Australian Football, Tag, Netball). **Completed:** v0.4.0.0 (2026-07-05)
- July 2026 design review (DR-1..10) — session-end takeover + milestones, PR/new-event/effort toasts, effort-cap + full-house one-time moments, players land on own tab, rank-improvement flash, My 100 dashboard card, next-session countdown, /leaderboard cleanup (avg place migration 20260707, Youth tab removed, Grandmaster tab keys fixed, Felix duplicate merged, copy corrected). **Completed:** v0.4.1.0 (2026-07-07)

---

## P1 — Do Next

### Referral system — DB migration
**What:** Add `referral_code` (TEXT UNIQUE) to `players`, create `referrals` table (referrer_id, referred_id, session_count, qualified_at), add trigger on `session_player_summary INSERT` to increment session_count and set qualified_at when threshold (10) is reached.
**Migration file:** `supabase/migrations/20260515_referral_system.sql`
**Notes:** Generate referral_code as 6-char alphanumeric via `substring(md5(random()::text), 1, 6)` or a custom function. Backfill existing players.

### Referral system — /join/[code] landing page
**What:** Public page at `/join/[code]`. Fetches the referrer's display name, shows an AllSport intro block, and a Register CTA that pre-fills the referral code in the registration form.
**Design:** Dark background, rainbow stripe, logo, "You've been invited to AllSport by [name]", brief 3-line sport description, big red Register button.
**Where:** `app/join/[code]/page.tsx`

### Referral system — dashboard "Invite Friends" section
**What:** New section within the dashboard (or a dedicated bento card) showing: player's referral code, one-tap copy link button, count of pending referrals (session_count < 10), count of qualified referrals, and a progress bar toward next Koha tier.
**Where:** `app/dashboard/page.tsx`

### Referral system — /koha referral tier display
**What:** Update /koha page to show both paths (donation + referral) for each Koha tier in a clear two-column format.
**Where:** `app/koha/page.tsx`

### Funding campaign block on /koha
**What:** Add a "Wheels for AllSport" campaign section at the top of /koha. Shows: campaign name, goal ($8,000), hardcoded current amount, progress bar, three milestone markers ($1k first event kit / $3k trailer deposit / $8k full goal), short description of why equipment mobility matters.
**Where:** `app/koha/page.tsx`
**Notes:** Start with a hardcoded `currentAmount` constant. Update it manually or wire to Supabase when multiple campaigns exist.

### Partners page — DB migration
**What:** Create `partners` table (club_name, sport, description, website_url, logo_url, is_active, display_order). Add `partner_id` (uuid → partners, null) to `sessions`.
**Migration file:** `supabase/migrations/20260515_partners.sql`
**RLS:** Public read; judge INSERT/UPDATE.

### Partners page — /supporters page
**What:** New public page at `/supporters`. Two sections: (1) Koha supporters wall — existing supporter names; (2) Partner Clubs — card grid, each card shows club logo, name, sport, short description, website link.
**Where:** `app/supporters/page.tsx`
**Design:** Same dark bento aesthetic. Empty state for Partner Clubs section: "Partnerships coming soon."

### Partners page — partner badge on /schedule
**What:** When a session has a `partner_id` set, show the partner club name/logo as a badge on that session card.
**Where:** `app/schedule/page.tsx`

---

## P2 — Soon

### Update unit tests for new event data
**What:** `__tests__/eventData.test.ts` has tests referencing old event slugs (30-15-test, sprint-repeats) and old getBonusTargets spec (3 targets, points 15). These now reflect the new single-task spec.
**Where:** `__tests__/eventData.test.ts`

### Welcome email on registration
**What:** Send a branded welcome email when a new player registers — their username, division, next session times, and a link back to their dashboard.
**How:** Supabase Edge Function triggered by a database webhook on `players INSERT`, calling Resend (free tier, 3,000/month). Domain `allsport.nz` needs two DNS TXT records added in Resend.
**Effort:** M (CC)

### Judge approval flow
**What:** Judges can be assigned via the app rather than running `UPDATE players SET role = 'judge'` manually.
**Effort:** M (CC)

### Guest player claim flow
**What:** A guest player who later creates an account can claim their previous session results. Judge or admin links the guest `player_id` to the new account.
**How:** Simple admin SQL or a judge UI that searches for guest players by name and merges them with a registered player.
**Effort:** S–M (CC)

---

## P3 — Later

### Leaderboard icons
**What:** Add player icon emoji next to name on /leaderboard and /scoring/[sessionId].
**When:** After icon system is proven stable on /dashboard.

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

### Per-event placement storage
**What:** Add `event_placement` column to results + trigger update, so points history can show "1st in Deadlift" etc.
**When:** Future enhancement — wait for session volume to justify the complexity.

---

## Non-code — Budget & Growth Actions

### Book professional content session ($600)
**What:** Hire a photographer/videographer for one AllSport session. Capture stills + short Reels footage.
**Why:** Primary asset for grant applications (Sport NZ, CCC), partnership pitches, and social media growth. Highest leverage spend.
**When:** Before the next milestone session or first club partnership session.

### Buy session materials ($300)
**What:** Retractable pull-up banner ($150), cones/markers ($100), tape measure set ($50).
**Why:** Makes sessions look credible to first-time visitors and venue partners.

### Stock referral reward packs ($400)
**What:** Pre-print ~20 sticker packs for Tier 3 referral rewards.
**Why:** Rewards need to be ready at launch — delays kill referral momentum.

### Apply for Sport NZ Aktive community sport fund
**What:** Submit a funding application for equipment/transport costs.
**Why:** Registered charitable status makes AllSport eligible. Content assets (above) strengthen the application.
**When:** After content session is complete.

### Apply for Christchurch City Council community funding
**What:** CCC runs community sport funding rounds annually.
**Why:** Eligible as a charitable org based in Ōtautahi.

### Approach first club partner
**What:** Identify 2–3 local clubs whose sport overlaps with AllSport events (e.g. a volleyball club, a track & field club). Pitch the partnership model: AllSport runs a session for their community, their sport is one of the 10 events, AllSport gains ongoing access to their facility.
**When:** After /supporters page is live (gives you something to show them).
