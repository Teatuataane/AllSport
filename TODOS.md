# AllSport — TODOS

## ✅ Done

- **Design review of the taniwha work, acted on** (2026-08-28, branch `claude/allsport-taniwha-review-71d18c`). Full report and reasoning in the review artifact; the headline was that **every taniwha surface priced progress in points and nothing said what a session was worth**, so the ladder had no denominator. Shipped: the calibration line (`sessionsToGo` in `lib/taniwha.ts`, on the card and the session-end takeover); the first-run dashboard the FirstRun canvas specified, replacing four zeros and an empty radar; `/leaderboard` rebuilt for phones (it needed 860px inside a 342px column, hiding **Season Pts — the column it sorts by** — behind an unsignalled scroll); the Taniwha column switched from crowns to **pieces**, which differentiate today where crowns read `0` on all 27 rows; the **field-of-three win rule** stated on `/taniwha` and `/prs` after being enforced-but-unexplained since launch; one word ("pieces") for the unit that had three; and the last Colours-era copy off the public pages. `/events` also regained a nav entry — the EVENTS tab is `/prs`, which had left the catalogue unreachable when logged in.

- **Taniwha grading system live** (v0.6.0.0, applied and verified 2026-08-25). Both migrations pushed from `main` and confirmed by querying the objects with the public anon key rather than trusting `db push`:
  - `event_domains` **120 rows**, `player_taniwha` seeded for all **27 players**, **197 wins backfilled** from history, `results.event_placement` present.
  - The budget invariant — `SUM(body_parts) <= taniwha_body_budget(lifetime_points)` for every player — returns **zero breaches**. Nobody is building two taniwha. No guest row carries a placement.
  - **The interesting part:** Tāne already holds three domains at or past 9 of 12 (Coordination 11, Calisthenics 10, Maximal Strength 9) and RGFell holds one, but **nobody has crown room** — everyone is under 10,000 lifetime points. The crowns are earned and waiting on points. That is the calibration working, not a bug: don't lower a threshold to "fix" it.
  - `/leaderboard` switched over on its own — column header reads TANIWHA, the Taniwha Key replaced the Colour Key, every player shows `0 · Whānau`.

- **The Colours fallbacks are gone** (v0.6.0.1). Deploy-order insurance, spent once the migrations landed. Deleted `lib/colourAlerts.ts`, `components/ColourAlertBanner.tsx`, `components/ColourWatchlist.tsx` and every fallback branch. `lib/colours.ts` survives shrunk to a lookup table, because `colour_awards` records colours really earned on real dates and the timeline still shows them. The points economy moved to `lib/taniwha.ts`; `RAINBOW` to `lib/domainColours.ts`. **Coverage moved with the code**: the component test was ported to the taniwha components rather than deleted, and the generic ranking helpers are now tested in `__tests__/sessionRanking.test.ts`.

- **`player_taniwha` folded into `leaderboard_page()`** (`20260824233516`). The separate query was correct while the progression migrations were pending; it is not any more, and it had turned the performance pass's 7-requests-into-1 back into 2. `/prs` runs its two queries concurrently for the same reason.

- **`npm install`.** `@testing-library/react` and `jsdom` were declared but never installed, so `colourComponents.test.tsx` had been permanently red and React components had no coverage at all. Suite is now fully green with zero errors.

- **OWASP access-control pass closed in production** (v0.5.6.0–v0.5.8.0, applied and verified 2026-08-21). Every finding shut and confirmed with the public anon key and no account:
  - **Every player's contact details were readable by anyone.** `players_select_all USING (true)`, live since the April 2026 schema rebuild. One unauthenticated request returned all 27 players: 19 emails, 9 phone numbers, 25 legal names, 27 exact dates of birth, 8 of those players under 18, one with a guardian's name/email/phone. `20260813000003` replaced it with an own/child/judge policy and revoked `anon`'s grant outright. **`players` now returns `42501 permission denied`**; `players_public` still serves the roster, so the leaderboard, game report and live session are unaffected.
  - **Any registered player could make themselves a kaiwhakawā.** `players_update_own` had no column restriction and RLS is row-level, so `PATCH {"role":"judge"}` on your own row worked; `players_insert_own` had the same gap at registration. `20260813000000` pins `role`, `is_guest`, `parent_id` and `id` with a trigger (chosen over column grants: a table-level UPDATE grant overrides column-level REVOKEs, and a column list breaks silently when a column is added later).
  - **Any player could fabricate scores and points.** No trigger on `results`, and the insert policy constrained neither session state nor the numeric columns, so you could write into closed sessions you never attended and set `points_earned` directly — which `award_session_points` then converted into permanent lifetime colour points. `20260813000001` confines writes to an open session, preserves the server-authoritative columns from `OLD`, bounds effort credit, and limits guest rows to kaiwhakawā.
  - **Clean:** SQL injection (no dynamic SQL anywhere in 38 migrations; PostgREST parameterises), XSS (zero sinks — no `dangerouslySetInnerHTML`/`innerHTML`/`eval`), and authentication (Supabase Auth throughout, no hand-rolled tokens, no `service_role` key in client code, and the OAuth `next` param is not an open redirect because `origin` is server-derived).
  - **`raw_score` is still player-submitted, by design.** There is no server-side truth to check it against; the sport requires a filmed or witnessed result. What changed is that a score can no longer be rewritten after the fact.
  - **`search_players_by_username` no longer reads past the lockdown** (v0.5.8.0, `20260820000001`). It was `SECURITY DEFINER` with no `search_path`, read `players` directly, and was callable by **anon** — an unauthenticated caller got 10 players back even after the lockdown, because owner rights ignore RLS. Nothing leaked (it only selected `id`/`display_name`/`username`, all in `players_public`), but it was an anon-reachable path *into* the closed table, so one added column would have bypassed everything silently. It now reads `players_public`, so it is structurally incapable of returning a private column, and `SECURITY DEFINER` was **dropped entirely** rather than mitigated. anon lost EXECUTE; verified `42501`. The ILIKE pattern is escaped too, so `%` is a literal rather than "match everyone".
  - `event_vote_responses` was also on the residual list and is now `42501`, closed by other work.
  - Remaining residuals are at P1/P2/P3 below: none are reachable without an account.

- **Games now end when their clock runs out** (v0.5.8.0, applied 2026-08-21). A session was meant to auto-lock after 100 minutes. The only thing that ever did it was a `setInterval` in the live-session screen calling `supabase.from('sessions').update(...)` — but `sessions_update_judge` is the ONLY UPDATE policy on `sessions`, so that call affected **zero rows for every player**, returned no error, and nothing checked the result. A game closed only if a kaiwhakawā happened to have that screen open at the exact minute the clock hit zero.
  - **What it cost:** `award_session_points` fires on the `is_active` true → false transition, so an un-closed session awards nobody anything. The 2026-08-19 game sat open overnight: 13 results, 2 players, zero placements. The scores were saved; they never became a result.
  - **Second bug behind it:** the client set its own `sessionEnded` state regardless, so players saw "Session Ended" while the database still had the game running. That is why it looked fine on the night and nobody reported it.
  - **Fix:** `close_expired_sessions()` (`20260820000000`) derives expiry from `started_at` server-side, so a caller can only ask it to check, never choose the outcome — which is why it is granted to `anon`, and why it **must** be. Restricting it to kaiwhakawā would rebuild the exact failure. Called from the live-session timer, the dashboard and the leaderboard. `ended_at` records when the game actually ran out, not when it was noticed. `points_awarded_at` is untouched, so Void still works.
  - **Plus pg_cron** (`20260820000002`) every 5 minutes, so a game ends unattended — the actual 19 August failure mode was that the last person shut their phone before the clock ran out. The migration is exception-guarded at every step so an unavailable extension raises a NOTICE instead of aborting the push; on prod it scheduled successfully.
  - **Verified on apply:** `closed 1 stranded session(s)`, the 19 August game came back 13/13 placements and 13/13 `points_earned`, `ended_at` = 18:54 NZST (start + 100 min exactly), and no session is left open.

- **Final security hygiene from the OWASP pass** (v0.5.10.1, 2026-08-21). Three small things, none of them reachable without an account, all closed so the tree has no half-finished examples in it:
  - **`get_wellbeing_report` search_path pinned** (`20260821000002`). It was the last SECURITY DEFINER function in the schema without one. Genuinely low risk — it raises unless the caller is a kaiwhakawā, and exploiting a mutable search_path needs CREATE on a schema `authenticated` does not have — but fixed anyway, because the next definer function anyone writes gets copied from an existing one, and every example in the tree should now be correct.
  - **The two orphaned bonus tables are gone** (`20260821000001`). `bonus_completions` and `bonus_sport_opponents` outlived the bonus system by three months. `bso_insert_own` was `FOR INSERT WITH CHECK (true)` — the only write path in the schema with no identity check at all, so anon could write unbounded rows into a table nothing read. **Archived before dropping**, because `bonus_completions` held six real rows from the 2026-05-05 session, not junk. (An earlier version of this file said "1 leftover row" — that count came from a probe run with `limit=1` and was simply wrong.) Archives carry RLS-on-with-no-policies and revoked grants, per the trap `20260801000000` documents: `CREATE TABLE … AS SELECT` does not inherit RLS, so an unguarded archive would have republished player history to anon.
  - **The join-code wildcard is closed.** `app/dashboard` looked the code up with `.ilike()`, so `?code=%` meant "match every session". It failed safe only because `.maybeSingle()` errors on multiple rows — protection that evaporates the moment exactly one coded session exists. Now `.eq()`. Whether session codes should be public at all is still open at P2, deliberately: that is a product decision, not a bug.

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

### Settle which migration file owns prod's `20260821000000` row
**What:** two different files were written under version `20260821000000` — `leaderboard_rpc` (v0.5.11.0) and `privacy_tidyup` (v0.5.10.0). Only one row can exist per version, but the objects from BOTH exist in production, so one of them was applied by a route other than `db push`. `privacy_tidyup` has since been renumbered to `20260822000000`; `leaderboard_rpc` keeps `20260821000000`. Confirm the ledger row actually corresponds to `leaderboard_rpc`, and that `20260822000000` has since been applied and recorded.
**Why it matters:** nothing is broken today — `leaderboard_page`, `stats_bundle` and `delete_my_account` all exist and are verified. The risk is a `supabase db reset` or any rebuild-from-migrations, where the recorded history would replay something different from what actually shaped production.
**Why it went unnoticed:** the CLI keys on the 14-digit prefix ALONE, so a collision is applied silently as a skip and `db push` reports success. `migration list` then reads as complete from either side. This is the third collision in two weeks — the other two were `20260816000000` (caught pre-push) and `privacy_tidyup` vs `pin_wellbeing_search_path` (main renumbered the latter to `...0002`).
**Guard that would have caught all three:** `ls supabase/migrations | cut -c1-14 | sort | uniq -d` before pushing any branch that has been open while something else merged. Now written into CLAUDE.md.
**Noticed:** /ship v0.5.11.0, 2026-08-22
**Effort:** S (one query, then a `migration list`)

### Reconcile the two branches that still carry their own players_public
**What:** `players_public` was built three times, from three worktrees, and twice applied straight to production without going through `supabase/migrations`. Two of those branches are still unmerged and each still carries its own view definition AND its own `is_judge()`: `frontend-keys-server-proxy-bd20f8` (its `20260819000000` age-NZ fix has since been merged to main, so its untracked copy should be deleted) and `epic-cohen-4e2392` / `claude/user-data-privacy-audit` (a variant with `city` and `region`). Merging either as-written collides again.
**What it cost, concretely:** the view's shape changed under the deployed client twice in three days. Each time three queries started returning `42703` in production — the live session's player-info map, the kaiwhakawā roster, and the game report — so the in-game leaderboard listed nobody and the game report showed no names. It also, once, blocked `supabase db push` entirely: production's migration history held a version with no file in the repo, so the PII lockdown could not be applied until that file was committed.
**Now settled, don't undo it:** `20260816000000` is the single definition of the view and uses DROP + CREATE, so it lands whatever shape it finds. `20260813000002` is a deliberate no-op that explains why. `CREATE OR REPLACE VIEW` can only APPEND a column — it cannot rename, reorder, retype or remove one, and it aborts the whole push if you try.
**The actual lesson:** a database object created outside `supabase/migrations/` is invisible to every other branch, and a migration applied from an unmerged branch blocks everyone else's `db push` until its file is committed. Apply migrations from `main` only.
**Still true as of 2026-08-21:** both worktrees still hold three migration files each covering the same ground. Nothing has been reconciled; the incidents stopped because `main` is now correct, not because the collision was resolved.
**Noticed:** v0.5.6.1 hotfix, 2026-08-19; re-checked 2026-08-21
**Effort:** M (mostly a coordination call, not code)

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

### Draw the twelve taniwha — 1 of 12 done
**Done:** Te Taniwha ō te Whānau, all eleven pieces, in `public/taniwha/whanau/`. Registration verified clean — same 1000×1000 canvas, real alpha, no drift across the eleven frames. The method works.
**Three pieces of it need redrawing** (committed as-is so the pipeline was proven end to end): `hands.png` is a solid disc rather than the many-hands implement; `tikitiki` is 104×59 on a 1000px canvas, which is a 2px smudge at the size the leaderboard renders — for what is four months of a player's work; and `arero` is 0.16% coverage and 44% semi-transparent, so the wero fades rather than reads.
**Lesson for the other eleven:** draw the small pieces much LARGER on the canvas. A piece scales with the whole square, so anything under about 150px across vanishes at 24px.
**Check each one before drawing the next:** `node scripts/check-taniwha-art.mjs <slug>` then open `public/taniwha/_preview.html`.
**What remains:** eleven creatures — one per domain, plus Te Kāhui — each drawn ONCE and sliced into eleven layers: Pane, Tinana, Hiku, Ringa mauī, Ringa matau, Waewae mauī, Waewae matau, Parirau, Arero, the implement, Tikitiki.
**Spec:** transparent PNG, solid silhouette, 1000×1000, same as `public/event-icons/`. Path `public/taniwha/{taniwha-slug}/{part-slug}.png` — **the folder must be the slug**, lowercase and no macrons; a folder named "Te Taniwha o te Whānau" resolves to nothing and the card draws blank, silently.
**The one constraint that cannot be fixed later:** all ten parts of a taniwha must be exported on the SAME canvas with the SAME registration, or they will not layer. A filename that is not the exact slug falls back silently, exactly as event icons do.
**Why it matters:** the taniwha card currently draws a progress bar and a name. The creature assembling part by part IS the feature; without the art a player sees a counter.
**Supersedes** the old "export the two colour emblem PNGs" item — that ladder is retired and `emblemSrc` is deleted, so those two assets are no longer wanted.
**Noticed:** /ship v0.6.0.0, 2026-08-25; first one landed v0.6.1.0, 2026-08-26
**Effort:** M (art, no code) — about 11/12 remaining
**Draw them in the order players will actually meet them** (design review, 2026-08-28): the
backfill set everyone building Whānau, which IS drawn, so today's players mostly see real art
and the filler geometry is nearly invisible. That protection ends the first time anyone uses
the picker. The domains real players are closest to crowning are the ones they will switch to —
Coordination, Calisthenics and Maximal Strength are already at 9–11 of 12 wins for Tāne, and
RGFell holds one — so `ruruku`, `kaha-tinana` and `kaha` cover most plausible switches for the
next few months. At 150px the filler reads as abstract polygons rather than a creature, and at
the 96px and 74px sizes it reads as nothing.

### Component-test infrastructure — supabase mocking strategy
**What is now done:** `npm install` (v0.6.0.1) finally installed `@testing-library/react` and `jsdom`, which were declared but missing — the component test had been permanently red and React components had zero coverage. `__tests__/taniwhaComponents.test.tsx` now covers `TaniwhaAlertBanner` and `TaniwhaWatchlist` with 15 tests.
**What is still untestable:** anything that fetches — the dashboard taniwha card and its choose/switch picker, the profile badge, the leaderboard column, `/prs`, the session-end takeover. All need a decision on how to mock `supabase-browser` before they can be tested at all. This is a project-wide gap that predates the taniwha work by the whole life of the repo.
**Suggested:** `vi.mock('@/lib/supabase-browser')` with a small chainable query-builder fake, or MSW at the PostgREST layer.
**Sharpest reason to do it:** the taniwha card's choose-and-switch flow calls an RPC that writes permanent, never-revoked progression. It is the highest-consequence untested path in the app.
**Noticed:** v0.5.4.0 coverage gate; half-closed v0.6.0.1
**Effort:** M

### Drop the Leg Extension archive table once settled
**What:** `results_leg_extension_archive_20260801` holds the 17 result rows deleted when Leg Extension became Leg Ext Hold (a `strength` raw_score can't be decoded as a `difficulty+time` hold). Verified locked down: it returns HTTP 401 / `42501 insufficient_privilege` through PostgREST, so RLS is on and no policy exposes it. Drop it once the Leg Ext Hold call is settled and you're sure nobody wants those weights back.
**Also:** three `session_events` rows still read "Leg Extension" — deliberately not renamed, since repointing a name onto rows that were about to be deleted would only re-link undecodable data. Those historical sessions show that event with no scores. Rename them to "Leg Ext Hold" only if you'd rather the display match the current roster; "Leg Extension" is the more truthful label for what was actually performed.
**Noticed:** /ship follow-up, 2026-08-01
**Effort:** XS

### Referral system — /join/[code] landing page
**The DB half is already BUILT** — `20260515000002_referral_system.sql` created `referrals`, `players.referral_code` and the qualifying trigger, and `/my-koha` reads them. CLAUDE.md described the whole feature as "Planned" until v0.6.0.0; that was wrong. **Only this page is missing.**
**Why it matters more than it used to:** Te Taniwha ō te Whānau is crowned by one qualified referral, and **nobody in the club has one**. It is currently the hardest crown in the system rather than the first one everybody gets. Making it easy to invite someone is now on the critical path of the grading system, not a growth nice-to-have.
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

### Fold lifetime points into `leaderboard_page()` (needs a migration)
**What:** The board's Taniwha column shows PIECES, because nobody has a crown yet and a
crowns-only cell rendered "0" on all 27 rows. Pieces come from `player_totals.lifetime_points`,
which `leaderboard_page()` does not return, so the page reads that table in a `Promise.all`
alongside the RPC.
**Why it is fine for now:** the two requests are parallel, so it costs no extra wall time and
the 7-into-1 collapse still holds. It is two round trips, same as before this change.
**The tidier fix** is one more key on `leaderboard_page()`'s payload, the same way
`20260824233516` folded the taniwha read in. Deferred here because migrations must be applied
from `main` and this is a review branch.
**Where:** `app/leaderboard/page.tsx`, the `Promise.all` in the main load effect
**Noticed:** design review, 2026-08-28

### Move the ranking maths into SQL (PERF_AGGREGATION_PLAN.md Stage 2)
**What:** `/leaderboard` and `/dashboard` still ship the full result history to the browser and compute percentiles and wins there. Stage 1 collapsed the request fan-out into one RPC, which fixed the latency; Stage 2 would aggregate server-side and return ~20 rows instead of ~1500.
**Why it is deliberately deferred:** payload is ~40 KB gzipped today, which does not justify the risk. The maths maps cleanly onto window functions (`rank() - 1` is exactly the "ties never count as beaten" rule).
**The stated blocker is now gone.** This item used to be held up by domain rollup needing event name → domain, which lived only in `lib/eventData.ts`. v0.6.0.0 seeds exactly that table — `event_domains`, 120 rows, in `20260824222612` — because the crown condition needs the server to know an event's domain without trusting the client. Two tests read the migration file and fail if it disagrees with `EVENTS`. So Stage 2 is now a smaller job than this entry assumes.
**Do not ship it without the parity gate:** diff the TypeScript and SQL implementations player-by-player on real data first. Watch the `'Youth'` legacy division mapping, orphan event names, the `max(1, …)` floor, and shared-top counting as `isLeader`. This can silently change what players see.
**Trigger:** revisit when `results` grows perhaps 5–10× from today, or if the `events` reference table becomes worth having on its own merits.
**Where:** full plan with measurements in `PERF_AGGREGATION_PLAN.md`
**Noticed:** performance audit, 2026-08-22
**Effort:** L (2–3 days with the reference table and the parity gate)

### Decide what the session join code is actually for
**What is left:** `sessions_select_all USING (true)` publishes every session row to anyone, so **all 55 session codes are readable unauthenticated** (re-verified 2026-08-21). The wildcard half of this is fixed — v0.5.8.1 switched the lookup from `.ilike()` to `.eq()`, so `?code=%` no longer means "match everything" — but the codes themselves are still public.
**Why it is a decision, not a bug:** the code reads like an access control and isn't one. If it is only a convenience so nobody has to type a UUID, that is completely fine and this can be closed as won't-fix. If anything is ever meant to *depend* on it being unguessable, it needs to stop being published first.
**What restricting would cost:** /leaderboard and /schedule both read `sessions` publicly, so hiding just `session_code` means either a `sessions_public` view (the `players_public` pattern) or column-level grants — and column grants are the brittle option, because a table-level SELECT grant overrides them and any new column silently becomes unreadable.
**Noticed:** OWASP audit, 2026-08-16; wildcard fixed v0.5.8.1, 2026-08-21
**Effort:** XS to close as won't-fix; M to actually restrict

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

### Focus states — live session screen AND the new nav
**What:** The live session screen builds every control (kaiwhakawā player chips, roster rows, event list rows, quick-entry sheet chips, tab bar) as inline-styled `<button>`s. Inline styles can't express `:hover` or `:focus-visible`, so keyboard users get no focus indicator anywhere on the screen, and the chips land ~36px tall (the "Roster" button ~28px) against a 44px minimum touch target.
**Also:** the August 2026 dashboard redesign added `components/BottomNav.tsx` and `components/PlayerTabs.tsx` the same way — inline styles, so no `:focus-visible` on the five nav tabs, the MORE sheet rows or the family chips. Their touch targets ARE at the floor (tabs 44px, chips 45px); it is keyboard focus that is missing. That makes three surfaces on one fix rather than one.
**Why deferred:** Patching only the new kaiwhakawā chips would make them inconsistent with the identical chips in the quick-entry sheet sitting on top of them. The honest fix is the whole-screen move onto CSS classes / `components/ui.tsx`, already flagged in CLAUDE.md as the session-19 follow-up.
**Where:** `app/scoring/[sessionId]/page.tsx`, `components/BottomNav.tsx`, `components/PlayerTabs.tsx`, `app/globals.css`
**Noticed:** /ship design review, 2026-07-30 (v0.5.2.0); widened 2026-08-26 (v0.6.2.0)
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
