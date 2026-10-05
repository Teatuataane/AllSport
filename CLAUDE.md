# AllSport — Project Briefing for AI Coding Agents

Read this first. The full historical record (every design decision, incident and migration note since March 2026) is in **`docs/PROJECT_HISTORY.md`** — grep it by topic before changing anything non-trivial. Update both when you finish significant work: this file for current facts, the history file for the story.

> **Claims in docs are not evidence.** `docs/PROJECT_HISTORY.md` has recorded migrations as "applied and verified" that had never run. Before relying on database state, query the live objects (`pg_proc`, `pg_trigger`, `information_schema`), not the migration ledger or prose.

---

## 1. What AllSport is

A decathlon-style community sport from Ōtautahi (Christchurch), Aotearoa. It is a koha-based (donation, no set fee) charitable initiative. Individuals play **10 events per game, one drawn from each of 10 domains**, in a 100-minute session (Tue/Thu 4:30pm, Sat 9:00am). The roster is **128 events**; domains are uneven (14/13/12/12/13/12/15/13/12/12).

Domains in order: 1 Maximal Strength, 2 Calisthenics, 3 Power, 4 Speed, 5 Stamina (Anaerobic Endurance until Sept 2026), 6 Aerobic Endurance, 7 Flexibility, 8 Body Awareness, 9 Coordination, 10 Aim & Precision.

The app is a Next.js site where players register, join/play live games, log personal workouts, earn **colours**, and appear on a leaderboard; kaiwhakawā (judges/referees) run games and training.

Language: te reo Māori is used in display text — *Kaiwhakawā* (judge; the DB role value stays `judge`), *koha*, and the colour names (Mā, Kiwikiwi, Whero, Karaka, Kōwhai, Kākāriki, Kahurangi, Poroporo, Parahi, Hiriwa, Kōura, Uenuku, Taniwha). No emoji in the UI.

## 2. Architecture

- **Next.js 16.1.6 App Router + React 19.2.3 + TypeScript.** React Compiler enabled (`babel-plugin-react-compiler`).
- **No separate backend server.** The browser talks to **Supabase** (Postgres + PostgREST + Auth + Realtime) directly, under RLS. Business logic lives in two places:
  1. Pure TypeScript in `lib/` (grading, scoring encode/decode, ranking helpers).
  2. SQL triggers/RPCs/views in `supabase/migrations/` (placements, session close, leaderboard payloads, write guards).
- **One server route:** `app/api/grades/recheck/route.ts` (auto-conferral of colours using the service key).
- Hosted on **Vercel** (production domain `allsport.nz`). DB is hosted Supabase, project ref `pvutdyosuhpwnklrpczu`.
- `middleware.ts` runs on nearly every request and refreshes the Supabase session with `getUser()`. **Never remove or swap it for `getSession()`.**

## 3. Frontend structure

| Path | Contents |
|---|---|
| `app/` | Routes. Public: `/`, `how-to-play`, `events`, `events/[slug]`, `schedule`, `koha`, `grades` (public colours guide, server component), `privacy`, `supporters`. Auth: `login`, `register`, `play`, `auth/callback`. Player: `dashboard` (called HOME), `leaderboard`, `prs` (My Events), `history`, `profile`, `my-koha`, `games/[sessionId]`, `workout/new`, `workout/[id]`, `vote/[voteId]` (+ `/results`). `log` is a redirect to `workout/new`. Admin: `judge`. Live scoring: `scoring`, `scoring/[sessionId]` (~2,200 lines). |
| `app/components/` | Judge/vote/wellbeing panels: `JudgeCard`, `TrainingTab`, `ActivityReport`, `WellbeingSurvey`, `WellbeingReport`, `VoteBanner`, `VoteCard`. |
| `components/` | Shared UI: `Navbar`, `NavTabs` (phone tab strip + `MoreMenu`), `Footer`, `ui.tsx` (brand UI kit), `EventIcon`, `DomainIcon`, `GradesCard`, `HomeParts`, `PlayerTabs`, `GradeReleasePanel`, etc. |
| `components/play/` | The shared scoring UI used by both official games and personal workouts: `QuickEntrySheet`, `GameEventList`, `EventListRow`, `AddEventsSheet`, `EventPlanPicker`, `PRBoardView`, `BodyweightField`, `chrome.tsx`. The sheet does not write to a table; the host screen passes `onSubmit`/`onDelete`. |
| `public/` | `event-icons/{slug}.png` and `domain-icons/{slug}.png` (silhouettes rendered as CSS masks, tinted in the domain colour; **filename must be the exact slug** or it silently falls back to an emoji), `taniwha/` art, logo assets. |
| `app/globals.css` | Design tokens in `:root` (single source of truth), global `:focus-visible` rule, `.phone-nav` / `.brand-word` responsive rules. |

Fonts: Bebas Neue (headings), Barlow (body), Barlow Condensed (labels). Use `var(--font-display/body/label)` rather than hard-coded font stacks. Brand palette tokens are in `globals.css`; domain colours come from `lib/domainColours.ts`.

## 4. Backend / database structure

- **90 migrations** in `supabase/migrations/` (14-digit timestamp names, newest `20260930222237_training_sessions.sql`). `supabase/config.toml` and `supabase/README.md` document the CLI workflow.
- Core tables: `players` (+ `players_public` view), `sessions`, `session_events`, `results`, `session_player_summary`, `rankings` (legacy, seasonal), `grade_awards`, `grade_exemptions`, `grade_withdrawals`, `player_bodyweights`, `matches` / `match_players`, `workouts`, `workout_entries`, `activity_aliases`, `player_game_colours` (+ `season_points` view), `player_domain_colours`, `event_domains`, `referrals`, `partners`, `event_votes*`, `wellbeing_surveys`. Several `*_archive_*` tables exist behind RLS with no policies.
- Key SQL objects: `award_session_points`, `compute_event_placements`, `close_expired_sessions` (also run by pg_cron every 5 minutes), `leaderboard_page()`, `player_dashboard(uuid[])`, `confer_grade`, `grades_need_recheck`, `record_match`, `record_entry_match`, `settle_dispute`, `record_bodyweight`, `fit_activity`, `delete_my_account`, `enforce_lift_estimate` (trigger), plus `guard_*_write` triggers.
- `session_date` is derived from `started_at` at `Pacific/Auckland` by a DB trigger. Derive local days from `started_at`, not `session_date`, for data before v0.6.5.2.

## 5. Authentication and authorization

- **Supabase Auth**: email/password and Google OAuth via `@supabase/ssr`. Client components use `createClient()` from `@/lib/supabase-browser`. `lib/supabase.ts` is legacy — do not use in new code. Server components use `lib/supabase-server.ts`.
- `lib/supabase-cookies.ts` exports `AUTH_COOKIE_OPTIONS`; it must be passed to **every** Supabase client (browser, server, middleware, callback route). `httpOnly` is deliberately off (the browser client reads the session from `document.cookie`).
- Any new `createServerClient` call site must forward the second `headers` argument of `setAll` (carries `Cache-Control: private, no-store`).
- `lib/authCookie.ts` (`hasAuthCookie`) is a Supabase-free probe so the shell avoids importing the client; it fails open.
- **Roles:** `players.role` is `player` or `judge`. Pinned by trigger (not grants). `public.is_judge()` is SECURITY DEFINER; use it in policies on `players` to avoid recursion.
- **Family accounts:** `players.parent_id`; the active profile is held in localStorage key `allsport_active_player_id`, and must be changed through `lib/useActivePlayer.ts`, never by writing localStorage directly. Pure half in `lib/activePlayer.ts`.
- `/auth/callback` has an open-redirect guard (`safeNext()`); any redirect built by appending to an origin needs the same.

## 6. External services

Supabase (DB, Auth, Realtime, pg_cron), Vercel (hosting), Google OAuth, Google Fonts. `qrcode.react` renders the join QR code. No payment, email, or analytics integration was found in the code or `package.json`. There is no `.mcp.json`. `.claude/skills/` holds ~33 Claude Code skills (gstack: ship, review, qa, investigate, codex, etc.) and `.claude/launch.json` defines the dev server on port 3000; these are Claude-specific tooling, not application code.

## 7. Scoring system

- **Source of truth for events:** `lib/eventData.ts` (128 events: slug, domain, input mode, difficulty tiers, how-to/rules text). Event ladders are **compiled** from `EVENT_DIFFICULTY_REVIEW.md` by `scripts/apply-difficulty-sheet.mjs`; do not hand-edit a ladder without updating the sheet. A test checks the roster against the SQL mirror (`event_domains`).
- **`raw_score` is the one ranking number:** higher is always better, for every input mode. Encoding/decoding lives in `lib/scoring.ts` (plus `lib/eventData.ts` helpers `encodeDiffTime`/`decodeDiffTime`/`isTimedEffort`).
- Input modes: `strength`, `reps`, `time`, `hold`, `distance`, `sport` (win/draw/loss), `sprint`, `difficulty+time`, `difficulty+reps`, `difficulty+distance`, `weight+time`, `score`. (`sprint`, `score`, `time` are unused by the current roster but kept for historical rows.)
- Tiered events: `raw_score = tierIdx * 10000 + within-tier term`, so a higher tier always outranks a lower one. Holds use seconds; **timed efforts** (faster wins; `TIMED_EFFORT_SLUGS`, keyed by slug — an entry matching no event silently does nothing) use `10000 − seconds`. A rung's special scoring (`scoring: 'weight' | 'sport'`) is declared **on the tier**, never matched by event-name.
- **Lifts rank on estimated 1RM** (Brzycki, reps past 10 count as 10, to 0.1 kg). The DB trigger `enforce_lift_estimate` recomputes `raw_score` on write; `__tests__/estimatedOneRm.test.ts` pins SQL to TS. Any change to the lift list or formula must change both.
- Time events use `time_seconds` stored raw; sport events store `result_type` (win 2 / draw 1 / loss 0 within a Game rung).
- Strength standards are a ratio of the player's **bodyweight of the day** (`player_bodyweights`, written only through `record_bodyweight()`).
- Per-event placement is computed server-side by `compute_event_placements` at close: one best row per player per event, ties share a place, missing a scored event = last.
- **Re-levelled ladders are guarded in the database** (`enforce_relevelled_ladders()`, migration `20260930011149`, **not yet applied to production as of v0.27.0.0**; deploy the code first, then the migration straight after with no game or workout running): a write that changes the score on Compression, Pushups, Calf Raises or either wrist stretch must name a level of the new ladder in that level's band, and a new score on a removed event (Lunges, Ab Rollout, Shoulder Dislocate) is refused. Any future change to those five ladders must redefine it in a NEW migration; `__tests__/staminaRoster.test.ts` pins the newest definition to `lib/eventData.ts`. The grading engine also ignores a tiered row whose stored level name is not the ladder's name at its band, so **renaming a level is now a migration**: repoint `results.difficulty_tier` and `workout_entries.difficulty_tier`, then regenerate `__tests__/fixtures/levelNames.json` (`__tests__/levelNames.test.ts` fails until you do).
- Natural formats (sets × reps, distance + time) are converted in `lib/naturalFormats.ts` for swaps/extras/personal games only.

## 8. Ranking, grading and leaderboard

- **Colours are the only player-facing progression.** Points, units, effort tasks, taniwha and the Elo skill rating are retired. Don't reintroduce a second ranking metric without asking.
- **Domain colour** = average of the player's best six events in that domain, rounded down (unplayed slots count as Mā). **Overall colour** = average of the ten domain colours, rounded down, **capped by lifetime official games played** (`GAMES_REQUIRED`). Rules in `lib/grading.ts` (pure, tested); standards in `lib/standards.ts` (compiled from `GRADING_STANDARDS_REVIEW.md` by `scripts/apply-standards-sheet.mjs`). Age shifts the ladder (not the value); game events cap drills at Kahurangi with higher colours from a head-to-head rating (`lib/headToHead.ts`, needs 10 agreed games).
- **Auto-conferral:** the client posts "check me" to `POST /api/grades/recheck`; the route re-reads data under the caller's own login, re-runs `lib/grading.ts`, and writes awards with the service key. The client asserts nothing. Ordinary rechecks never withdraw a colour. **Bump `GRADING_RULES_VERSION` in `lib/grading.ts` whenever a rule changes what the same evidence earns**, or players are never rechecked.
- **Season leaderboard (`/leaderboard`):** every player in a finished, unvoided game is ranked together by their game colour total (sum of each official event's rung, up to 120); places pay 100, 99, 98 … never below 1, ties share. Totals are published per player per game to `player_game_colours`; the `season_points` view ranks and sums per NZ season year. One write path: `publishLeaderboardScores` in `lib/leaderboardData.ts`. Pure rule mirror: `lib/leaderboardScores.ts` (`seasonPointsFromGames`). `lib/colourBoard.ts` orders the lifetime colour board.
- `leaderboard_page()` is one RPC returning the public board payload (and healing expired sessions). `player_dashboard(uuid[])` loads a whole household.
- `lib/percentile.ts` computes best-score "Top X%" within a unified division pool (`divisionPool` in `lib/rating.ts`: men / women / juniors).
- Divisions: Men's, Women's, Juniors (U17), Masters (40+), Grandmaster (60+) by sex. Live leaderboards pool Men/Masters/Grandmaster together, same for women.

## 9. Important business rules

- Koha only; no fees. Players 1–100 per session. Results must be filmed or witnessed.
- A game auto-closes 100 min after `started_at` via `close_expired_sessions()` (RPC called from the UI, plus pg_cron). Closing fires `award_session_points` (placements + summary row; no points). **Void** is recorded in `sessions.voided_at`; voided games are excluded everywhere.
- A missed event ranks last. Unscored events can be **added** on top at an official game (stored as a workout linked to the game via `workouts.session_id`, never in `results`); unplayed official events still rank last.
- Personal games and kaiwhakawā training sessions are **workouts**, not sessions. A kaiwhakawā-created workout for someone else is `witnessed`.
- Owner decisions not to silently change: walkovers count on the season board; one-point place gap is deliberate (rewards attendance); best-six with no breadth bonus; Taniwha colour thresholds; games-cap table; Game-rung floor win 6 / draw 5 / loss 4.
- A colour citing an event removed from the roster is never withdrawn automatically, nor anything below it (`protectedAwards` in `lib/autoConfer.ts`); the kaiwhakawā is told it needs a manual database change. A rename that MOVES a slug must repoint `grade_awards.events`.
- Koha tiers and the referral system (qualified referral = referred player completes 10 sessions) are documented in `docs/PROJECT_HISTORY.md`.
- **Renaming an event is not safe just because the slug survives.** Results/PRs group by `session_events.event_name`. A rename needs a backfill migration, a grep for old names in `lib/` and `app/`, and a check of every table storing a slug or name (`results`, `session_events`, `workout_entries`, `workouts.planned_events`, `grade_exemptions`, `activity_aliases`, `event_domains`). Don't merge history across a rename that changed the movement.

## 10. Development commands

```bash
npm install
npm run dev        # next dev, http://localhost:3000
npm run build      # next build (authoritative compile check)
npm run start
npm run lint       # eslint (next core-web-vitals + typescript)
npx tsc --noEmit   # typecheck (tsconfig.json present; no script defined)
```

Environment (`.env*` is gitignored; none is committed): `NEXT_PUBLIC_SUPABASE_URL` (the build **throws** without it), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server only; used by the recheck route and two scripts).

Scripts (`scripts/`): TypeScript ones run with `node --import ./scripts/ts-loader.mjs scripts/x.ts` (`replay-colours.ts`, `refresh-leaderboard-scores.ts`; dry-run by default, `--apply` writes; need the service key). Others are plain `.mjs` generators/checkers (`apply-difficulty-sheet.mjs`, `apply-standards-sheet.mjs`, `grading-readiness.mjs`, `check-taniwha-art.mjs`, `optimize-icons.mjs`, `gen-logo-assets.mjs`).

Next's dev server can cache a failed compile and keep reporting a stale parse error; `npm run build` is authoritative.

## 11. Testing

```bash
npm test                       # vitest run (all of __tests__/)
npm run test:watch
npx vitest run __tests__/grading.test.ts
```

- ~70 test files in `__tests__/`. Vitest runs in `node` by default, pinned to `TZ=Pacific/Auckland`; component tests opt into jsdom with a `@vitest-environment jsdom` docblock. `@` aliases the repo root.
- Many tests are **structural**: they read migration files and assert rules are present (e.g. `trainingSessions`, `workoutSchema`, `autoConferral`, `sqlMirrors`, `estimatedOneRm`, `securityHeaders`). Redefining a SQL function whole in a new migration will fail these if any earlier rule is dropped — that is their purpose.
- There are no database-level (pgTAP) tests and no CI configuration (`.github/` does not exist). Run lint, typecheck, tests and build yourself before pushing.
- Pages behind a login are not covered by browser tests; component tests exist only for extracted parts.

## 12. Deployment

- Code deploys via Vercel (no `vercel.json` in the repo). Next's `headers()` in `next.config.ts` applies the security header set.
- **Migrations are applied by a person/session with CLI access, not by deploy.** `supabase db push` needs `SUPABASE_DB_PASSWORD`; `supabase db query --linked -f file.sql` does not (if used, write the ledger row too). Rules:
  1. Apply from **`main` only**, from a clean checkout/worktree (`supabase/.temp/` is gitignored; a worktree is not linked).
  2. Create files with `supabase migration new`; **never hand-name or reuse a timestamp** (collisions are invisible to git and silently skipped by the CLI). Check `ls supabase/migrations | cut -c1-14 | sort | uniq -d`.
  3. **Deploy code first, then the migration**, unless the migration says otherwise; a missing column returns `42703` and takes a whole PostgREST request down, so loaders query new columns separately with fallbacks.
  4. Never use `supabase migration repair --status reverted` to get past a refusal; it means your tree is stale.
  5. Never re-run one-time re-encode migrations (e.g. `20260713000001` corrupts scores if applied twice).
  6. Verify by querying the objects; test public RPCs as `anon` and logged-in ones as `authenticated` (`postgres` bypasses RLS and proves nothing).
- Parallel worktrees/sessions work on this repo; `git fetch` and check recent branches before writing migrations or changing `players_public`.

## 13. Security considerations

- **RLS is on everywhere.** `players` is **not** publicly readable (own row, children, judges only; `anon` revoked). Read other players through the `players_public` view (owner-rights, exposes no email/phone/DOB/gender). Changing `players_public` columns requires sweeping every caller in `app/`; `CREATE OR REPLACE VIEW` can only append columns, so it is defined once by `20260816000000` with DROP + CREATE.
- When restricting a table, grep PostgREST embeds (`players(`) as well as `from('players')`. RLS failures return zero rows, not errors.
- Write guards: `results` writes only into an open session; points/placement columns are server-only; guests are judge-only; division, DOB, gender, `is_active` are changeable only by a kaiwhakawā or server code. Triggers that must treat client vs server writes test **`current_user`, not `auth.uid()`**, and are SECURITY INVOKER.
- Every `SECURITY DEFINER` function pins `search_path`. Only `delete_my_account` may update `players` (a test enforces it). Check `can_log_for` before reading in definer functions.
- The **service-role key** is imported only by `lib/supabase-admin.ts`, used only by `app/api/grades/recheck/route.ts` and the replay/refresh scripts, never `NEXT_PUBLIC_`, and for writes only. `__tests__/autoConferral.test.ts` enforces this.
- Archive tables from `CREATE TABLE … AS SELECT` need RLS explicitly enabled with no policies. Archive then delete, with a pre-image, before irreversible data changes; end data-rewriting migrations with an assertion.
- Headers: `lib/securityHeaders.ts` builds the CSP + other headers (tested). `connect-src` is derived from `NEXT_PUBLIC_SUPABASE_URL` and must include `wss://`. `script-src`/`style-src` keep `'unsafe-inline'` on purpose. No `dangerouslySetInnerHTML` is used.
- `raw_score` is player-submitted by design (the sport requires witnessing); the DB bounds the damage instead of validating it.
- A bodyweight (exact kg) and a wellbeing survey are sensitive data; they are private-by-design and never joined into public payloads. Don't commit design docs naming players (`docs/designs/` is gitignored; the repo is public).

## 14. Coding conventions actually present

- TypeScript, path alias `@/…`. Client components start with `'use client'`.
- **Pure logic goes in `lib/` with no Supabase/React imports so it is unit-testable** (`grading`, `scoring`, `judgeRoster`, `percentile`, `activePlayer`, …). Hooks over them are separate (`useActivePlayer`, `useGradeProfile`, …). `lib/loadGrades.ts` takes its Supabase client as an argument so it can run on a server.
- Presentational parts that must be testable take props only (`components/HomeParts.tsx`, `components/play/*`).
- Server components cannot call functions exported from a `'use client'` file; shared helpers (e.g. `gradeInk`, `domainColours`) live in `lib/`.
- New UI uses the canonical tokens and `components/ui.tsx` primitives; existing pages still use inline `style={{}}` heavily, so match the surrounding file.
- Each new Supabase read of a possibly-missing table/column is its **own query** with PGRST205/42P01/42703 handled as "not live yet".
- Dates: parse DATE columns with `lib/dates.ts` (`parseLocalDate`, `formatNZDate`, `sessionStart`), never `new Date('YYYY-MM-DD')`; all dates mean NZ time.
- Commit/changelog: `VERSION` (currently `0.27.0.0`) and `CHANGELOG.md` are bumped per shipped change; open work is tracked in `TODOS.md`. Comments in this codebase explain *why* at length; match that density when you touch a risky area.
- Event/standards/difficulty changes are made by editing the reviewed sheet and re-running the apply script, not by hand-editing generated output.

## 15. Important files and directories

| Path | What it holds |
|---|---|
| `lib/eventData.ts` | The 128-event roster, tiers, input modes, how-to text |
| `lib/scoring.ts`, `lib/naturalFormats.ts`, `lib/eventKinds.ts` | Score encoding, set/distance conversion, distance/Game-rung helpers |
| `lib/grading.ts`, `lib/standards.ts`, `lib/playerGrades.ts` | Colour rules, compiled standards, per-player grade computation |
| `lib/loadGrades.ts`, `lib/autoConfer.ts`, `lib/recheckGrades.ts`, `lib/replayColours.ts`, `lib/newColours.ts` | Loading evidence, conferral decisions, client recheck, history replay, "new colour" moment |
| `lib/leaderboardScores.ts`, `lib/leaderboardData.ts`, `lib/colourBoard.ts`, `lib/gameReport.ts`, `lib/loadGamePlace.ts` | Game colour totals, season points publishing, boards, game report |
| `lib/headToHead.ts`, `lib/matches.ts` | Match recording and the game rating |
| `lib/prBoard.ts`, `lib/percentile.ts`, `lib/rating.ts` | Records per level, Top %, division pools / session wins |
| `lib/workouts.ts`, `lib/personalGame.ts`, `lib/gameSwaps.ts`, `lib/training.ts` | Workouts, personal games, adds at a game, training sessions |
| `lib/supabase-*.ts`, `lib/authCookie.ts`, `lib/securityHeaders.ts` | Supabase clients, cookies, security headers |
| `lib/dates.ts`, `lib/schedule.ts` | NZ date handling, fixed session schedule |
| `app/api/grades/recheck/route.ts` | Only server route |
| `supabase/migrations/` | All schema/logic changes (see §12 before touching) |
| `__tests__/` | Vitest suite, including structural migration tests |
| `scripts/` | Sheet compilers, replay/refresh tools, asset checkers |
| `EVENT_DIFFICULTY_REVIEW.md`, `GRADING_STANDARDS_REVIEW.md` | Reviewed sheets that are compiled into `lib/eventData.ts` / `lib/standards.ts` |
| `TODOS.md`, `CHANGELOG.md`, `VERSION` | Open work, release notes, version |
| `docs/PROJECT_HISTORY.md` | Full prior project record (the previous CLAUDE.md, unabridged) |
| `AGENTS.md`, `HANDOFF.md` | Agent-neutral operating manual, and the handoff note for the next agent |
| `*_PLAN.md`, `EVENT_*.md`, `design-canvas/` | Older design records and mockups; historical |
| `.claude/` | Claude Code skills and launch config (tooling only) |

*Last updated: 5 October 2026 (v0.27.0.0).*
