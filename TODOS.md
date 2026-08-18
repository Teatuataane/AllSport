# AllSport — TODOS

## ✅ Done

- **Security headers confirmed live in production** (v0.5.5.0, verified 2026-08-13). All 8 headers serve on allsport.nz. The open question was ACAO: Vercel's static-asset layer sets `Access-Control-Allow-Origin: *` on prerendered HTML, so it was unknown whether Next's `headers()` would override it. **It does** — prod returns `access-control-allow-origin: https://allsport.nz`. No `vercel.json` fallback needed; `lib/securityHeaders.ts` stays the single source of truth. CSP verified enforcing (all 12 directives present, `frame-ancestors 'none'` + `X-Frame-Options: DENY` both live).
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
- ~~My Colour History — colour progression section on homepage becomes a button for logged-in players~~ **This never actually shipped** — verified 2026-08-07, no such button exists in `app/page.tsx`. The colour history now lives in the Colours card modal on /dashboard as a full timeline (v0.5.4.0).
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
- Event roster reconciled to 120 events, 12 per domain — 7 added (Arm Wrestling, Tug of War, Capture the Flag, Kabaddi, Wheelbarrow Push/Pull, Kubb restored), 9 removed, 9 renamed, 5 moved between domains, Leg Extension → Leg Ext Hold (strength → difficulty+time, D1–D7). Domain names/numbers/order deliberately unchanged. Icons 120/120. **Completed:** v0.5.3.0 (2026-08-01)
- Event renames no longer orphan personal-best history — /prs, lib/percentile.ts and My Events all group results by `session_events.event_name`, so every past rename had silently detached its own history. Migration `20260801000000` repoints 24 old names (derived from git history of eventData.ts, not memory), including earlier casualties Handbalance, Rope Climb, Zercher Deadlift, Shot Put and Javelin Throw. `lib/scoring.ts` also matched weight-scored tiers on the name literal and now accepts both spellings. **Completed:** v0.5.3.0 (2026-08-01)
- All migrations applied and verified to prod — `20260713000000`, `20260713000001`, `20260714000000`, `20260801000000`. The ×2 games/points root cause is confirmed dead: `select tgname from pg_trigger` returns only `auto_award_points`, with the orphaned `on_session_end` absent, which also proves `20260713000000` genuinely executed rather than being recorded without effect. That migration rebuilt the 2026 rankings, so session counts and point totals now reflect true values. **Completed:** 2026-08-01
- Corrected the stale "three session-22 migrations are pending" claim in CLAUDE.md and TODOS.md — they had already been applied, and re-running `20260713000001` (a one-time Breath Hold / Duck Walk re-encode) would have corrupted those scores. **Completed:** 2026-08-01

---

## P1 — Do Next

### Three parallel sessions built the same PII lockdown, and one shipped a view nobody else knew about
**What:** `players_public` exists in production but came from none of the migrations on `main`. It was created out-of-band by the work in worktree `frontend-keys-server-proxy-bd20f8`. A third variant sits unmerged in `epic-cohen-4e2392` (`claude/user-data-privacy-audit`) with yet another shape (`full_name`, `city`, `region`, `show_division`). All three define `is_judge()` too.
**What it cost:** v0.5.6.0 shipped client code asking for `age_years`, `age_group` and `full_name` against a live view that has `age` and `name`. Three queries returned `42703` in production — the live session's player-info map and judge roster, and the game report — so the in-game leaderboard populated no players and the game report showed no names. Fixed in v0.5.6.1 by aligning the code and the repo's migration to the view that was already live.
**Decide before any of this moves again:** which view definition is canonical, and what happens to the two unmerged branches. The other two both still carry their own `players_public` and their own lockdown migration, so merging either one as-written will collide again. `20260813000002` is now pinned to the live shape with a comment explaining that `CREATE OR REPLACE VIEW` cannot rename or drop a column, so a shape change needs DROP + CREATE plus a sweep of every caller.
**The actual lesson:** a database object created outside `supabase/migrations/` is invisible to every other branch. Until that view landed in the repo, `supabase db reset` produced a schema the deployed app could not run against.
**Noticed:** v0.5.6.1 hotfix, 2026-08-19
**Effort:** M (mostly a coordination call, not code)

### Vote responses are readable by anyone, with names attached
**What:** `event_vote_responses_select` reads `player_id = auth.uid() OR is_final = TRUE OR <judge>`. The `is_final = TRUE` branch makes every submitted vote world-readable, including its `player_id`. Verified unauthenticated against prod: `curl "$URL/rest/v1/event_vote_responses?select=*" -H "apikey: $ANON_KEY"` returns **60 rows**, each pairing a player with the event they chose. Fix is to drop that branch so the policy is own-row plus judge, since the aggregate paths already exist.
**Why it matters:** it defeats two deliberate design decisions at once. `get_vote_results()` and `get_vote_details()` were written as SECURITY DEFINER precisely so players see anonymised counts and only kaiwhakawā see names — the base table bypasses both. It also breaks the spoiler-free rule, because anyone can read the running tally before voting. Players were told the vote was anonymous.
**Careful:** `/vote/[voteId]/results` reads the aggregate RPCs, not the table, so check whether anything still selects the table directly before tightening.
**Noticed:** OWASP audit, 2026-08-16
**Effort:** S (one policy, plus a grep for direct table reads)

### Confirm no-store actually reaches a real auth-cookie response
**What:** sign in with Google in an incognito window with DevTools → Network open, find the `/auth/callback` 307, and check its Response Headers say `cache-control: private, no-cache, no-store, must-revalidate, max-age=0`.
**Why it matters:** this is the one change in v0.5.5.0 never demonstrated end-to-end. It was the most serious finding of the pass — prod was serving the session-setting redirect as `cache-control: public`, which lets a shared cache store one player's session token. The fix (forwarding the second `headers` argument of `@supabase/ssr`'s `setAll`) rests on code reading and the library contract, not a production measurement.
**Why curl can't settle it:** `curl -sSI https://allsport.nz/auth/callback` returns `cache-control: public`, and that is CORRECT, not a regression. With no `?code=` param the route skips the whole Supabase block, sets no cookies, and just redirects to `/login?error=auth` — there is no session token in that response to protect. Only a real OAuth code exchange exercises the fixed path. Don't mistake that curl output for a failure.
**Noticed:** /ship v0.5.5.0 follow-up, 2026-08-13
**Effort:** S (one sign-in with DevTools open)

### Consider moving Supabase auth off document.cookie so httpOnly becomes possible
**What:** the session cookie is deliberately NOT `httpOnly`, because `@supabase/ssr`'s browser client reads the token out of `document.cookie` and every client component in the app uses it. Setting the flag today signs everybody out. Making it possible means reading auth server-side and passing the session down, rather than a config tweak.
**Why it matters:** it is the one remaining gap in the cookie hardening from v0.5.5.0. Without httpOnly, any successful script injection can read the session token. Current mitigations are that there is no `dangerouslySetInnerHTML` anywhere and the CSP `connect-src` gives an attacker nowhere to send it, but neither is as strong as the flag.
**Noticed:** /ship v0.5.5.0, 2026-08-13
**Effort:** L (architectural — affects every client component that calls supabase)

### Export the two colour emblem PNGs
**What:** `public/colour-emblems/taniwha.png` (one taniwha) and `nga-taniwha.png` (the full twin crest). Transparent, solid single colour, ~1000×1000, no wordmark bar, no koru shield — same spec as `public/event-icons/`, so the existing CSS-mask tint pipeline picks them up with no code change.
**Why it matters:** the emblem is the ONLY thing distinguishing Taniwha (rung 10) from Ngā Taniwha (rung 19). Without them a player who spends four years climbing cycle 2 arrives at a card identical to the one they already had. Everything else about cycle 2 renders correctly today; the masked element just draws nothing.
**Not usable:** `SVG/Colour Logo_White outline.svg` — it is the 7-fill multicolour version (can't be mask-tinted), carries the ALL SPORT wordmark bar, and its linework won't survive being drawn at 200px.
**Noticed:** /ship v0.5.4.0, 2026-08-07
**Effort:** S (Canva export, no code)

### Component-test infrastructure — supabase mocking strategy
**What:** jsdom + @testing-library/react landed in v0.5.4.0 and cover pure components (`ColourAlertBanner`, `ColourWatchlist`). What is still untestable is anything that fetches: the dashboard Colours card and timeline, the profile badge, the leaderboard colour column, the session-end takeover. All need a decision on how to mock `supabase-browser` before they can be tested at all.
**Why it matters:** ship coverage for the colours rework came out at 43%, and every remaining gap is a fetch path or the markup wrapped around one. This is a project-wide gap, not a colours one — it predates this change by the whole life of the repo.
**Suggested:** `vi.mock('@/lib/supabase-browser')` with a small chainable query-builder fake, or MSW at the PostgREST layer.
**Noticed:** /ship v0.5.4.0 coverage gate, 2026-08-07
**Effort:** M

### Drop the Leg Extension archive table once settled
**What:** `results_leg_extension_archive_20260801` holds the 17 result rows deleted when Leg Extension became Leg Ext Hold (a `strength` raw_score can't be decoded as a `difficulty+time` hold). Verified locked down: it returns HTTP 401 / `42501 insufficient_privilege` through PostgREST, so RLS is on and no policy exposes it. Drop it once the Leg Ext Hold call is settled and you're sure nobody wants those weights back.
**Also:** three `session_events` rows still read "Leg Extension" — deliberately not renamed, since repointing a name onto rows that were about to be deleted would only re-link undecodable data. Those historical sessions show that event with no scores. Rename them to "Leg Ext Hold" only if you'd rather the display match the current roster; "Leg Extension" is the more truthful label for what was actually performed.
**Noticed:** /ship follow-up, 2026-08-01
**Effort:** XS

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

### The session join code is not actually a secret
**What:** two separate things. `sessions_select_all USING (true)` publishes every session row to anyone — verified unauthenticated, **52 of 55 sessions return their `session_code`**. And `app/dashboard/page.tsx` looks the code up with `.ilike('session_code', code)` on raw user input, so `%` is a wildcard rather than a code.
**Why it matters:** the join code reads like an access control and isn't one. Anyone can list every code that has ever existed, so "ask the kaiwhakawā for the code" protects nothing. Worth deciding what the code is *for*: if it is only a convenience for typing, that's fine, but then nothing should depend on it being unguessable.
**Not currently exploitable via the wildcard:** `%` matches 52 rows and `.maybeSingle()` errors on multiple, so it fails rather than joining. That only holds while more than one session has a code. Switch to `.eq()` regardless.
**Noticed:** OWASP audit, 2026-08-16
**Effort:** S for the `.eq()`; M if you want session rows restricted, since /leaderboard and /schedule read them publicly

### Pin search_path on the two remaining SECURITY DEFINER functions
**What:** `get_wellbeing_report()` (20260714000000) and `search_players_by_username()` (20260515000000) are SECURITY DEFINER without `SET search_path = public`. Add it. `claim_colour_award`, `get_vote_results`, `get_vote_details`, `get_player_top_event` and the new `is_judge` already have it, so this is consistency more than anything.
**Why it matters:** a SECURITY DEFINER function with a mutable search_path is the classic Postgres escalation shape: an attacker who can create an object in an earlier schema hijacks an unqualified reference and runs it as the owner. **Theoretical here** — `authenticated` has no CREATE on any schema in the path on Supabase — but the mitigation is one line per function and it stops the pattern being copied into the next function that matters.
**Noticed:** OWASP audit, 2026-08-16
**Effort:** XS

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

### Live session screen — focus states and touch targets
**What:** The live session screen builds every control (kaiwhakawā player chips, roster rows, event list rows, quick-entry sheet chips, tab bar) as inline-styled `<button>`s. Inline styles can't express `:hover` or `:focus-visible`, so keyboard users get no focus indicator anywhere on the screen, and the chips land ~36px tall (the "Roster" button ~28px) against a 44px minimum touch target.
**Why deferred:** Patching only the new kaiwhakawā chips would make them inconsistent with the identical chips in the quick-entry sheet sitting on top of them. The honest fix is the whole-screen move onto CSS classes / `components/ui.tsx`, already flagged in CLAUDE.md as the session-19 follow-up.
**Where:** `app/scoring/[sessionId]/page.tsx`, `app/globals.css`
**Noticed:** /ship design review, 2026-07-30 (v0.5.2.0)
**Effort:** M (CC)

### Guest player claim flow
**What:** A guest player who later creates an account can claim their previous session results. Judge or admin links the guest `player_id` to the new account.
**How:** Simple admin SQL or a judge UI that searches for guest players by name and merges them with a registered player.
**Effort:** S–M (CC)

---

## P3 — Later

### Drop the two orphaned bonus tables
**What:** `bonus_completions` and `bonus_sport_opponents` still exist in prod and are still world-readable, but the bonus system was removed in May 2026 and replaced by the effort system. Neither table is referenced anywhere in `app/`, `components/` or `lib/`. Verified unauthenticated: both return HTTP 200 (`bonus_sport_opponents` 0 rows, `bonus_completions` 1 leftover row). Drop both, or at minimum revoke anon.
**Why it matters:** mostly tidiness, but `bso_insert_own` is `FOR INSERT WITH CHECK (true)` — no `auth.uid()` check at all — so on Supabase's default grants an unauthenticated caller can write unbounded rows into a table nothing reads. That is junk data and storage growth rather than a data leak, but it is the only write path in the schema with no identity check whatsoever.
**Careful:** confirm nothing in an unshipped branch still writes them before dropping, and take the usual archive-then-drop route if the single `bonus_completions` row is worth keeping.
**Noticed:** OWASP audit, 2026-08-16
**Effort:** XS

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
