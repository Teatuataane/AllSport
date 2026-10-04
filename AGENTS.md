# AGENTS.md — Operating manual for AI coding agents

Applies to any AI coding agent working in this repository. `CLAUDE.md` holds a longer technical briefing (file map, scoring and grading detail, deployment steps); `docs/PROJECT_HISTORY.md` is the full historical record — search it by topic before changing anything non-trivial. If these documents disagree with the code or the live database, the code and database win; fix the document.

## 1. What AllSport is

A koha-funded (donation-based) community sport from Ōtautahi, Aotearoa. Players compete individually across 10 events per game, one from each of 10 domains, in a 100-minute session. Players earn **colours** (a 12-step ladder, Mā to Taniwha) and appear on a season leaderboard. Kaiwhakawā (judges/referees) run games and training sessions. The roster is 128 events. Display text uses te reo Māori (Kaiwhakawā, koha, colour names); the database role value stays `judge`. No emoji in the UI.

## 2. Architecture

- Next.js 16 (App Router), React 19, TypeScript. React Compiler is on.
- **No separate backend server.** The browser talks to Supabase (Postgres, PostgREST, Auth, Realtime) under row-level security. Logic lives in (a) pure TypeScript in `lib/` and (b) SQL triggers, RPCs and views in `supabase/migrations/`.
- One server route: `app/api/grades/recheck/route.ts` (confers colours using a service key).
- `middleware.ts` refreshes the Supabase session on every request; keep it.
- Hosted on Vercel; database on hosted Supabase (pg_cron closes expired games).
- Key locations: `lib/eventData.ts` (event roster, source of truth), `lib/scoring.ts` (score encoding), `lib/grading.ts` + `lib/standards.ts` (colour rules), `lib/leaderboard*.ts` (season board), `components/play/` (shared scoring UI), `app/scoring/[sessionId]/page.tsx` (live game), `supabase/migrations/` (schema and server logic), `__tests__/` (Vitest).

## 3. Core business rules

- `raw_score` is the single ranking number; **higher is always better** in every input mode. Encodings live in `lib/scoring.ts` and `lib/eventData.ts`; tiered events use `tierIdx * 10000 + term`, so a higher tier always outranks a lower one.
- Lifts rank on estimated 1RM. The database trigger `enforce_lift_estimate` and `lib/scoring.ts` must stay in step.
- A domain colour is the average of the player's best six events there (unplayed = Mā), rounded down. The overall colour is the average of the ten domains, capped by lifetime official games. Standards are compiled from reviewed sheets, not hand-written.
- Colours are conferred by the server recheck route, which re-reads data under the caller's login and re-runs `lib/grading.ts`. The client never asserts a colour. Ordinary rechecks never withdraw a colour.
- Season leaderboard: everyone in a finished, unvoided game is ranked together on their game colour total; places pay 100, 99, 98 … never below 1; ties share.
- A missed event ranks last. Voided games are excluded everywhere (`sessions.voided_at`). Events added on top of an official game are stored as workouts, never in `results`.
- Points, units, effort tasks, taniwha and Elo skill ratings are retired. Do not reintroduce a second ranking metric.
- Several rules are deliberate product decisions by the owner (walkovers count, the one-point place gap, the games-cap table, best-six without a breadth bonus). Do not "fix" them without being asked.

## 4. Development principles

- Match the surrounding code: naming, comment density (comments here explain *why*), inline styles where the file uses them, and shared tokens/`components/ui.tsx` for new UI.
- Keep logic that needs testing in pure `lib/` modules with no Supabase or React imports; hooks and components wrap them.
- Client components use `createClient()` from `@/lib/supabase-browser`. Never use `lib/supabase.ts` (legacy).
- Dates mean NZ time. Use `lib/dates.ts`; never `new Date('YYYY-MM-DD')` for DATE columns.
- A read of a table or column that may not exist yet is its own query, handling PGRST205 / 42P01 / 42703 as "not live yet", so one missing object cannot take a whole page down.
- Do not hand-edit generated output. Event ladders come from `EVENT_DIFFICULTY_REVIEW.md` via `scripts/apply-difficulty-sheet.mjs`; standards from `GRADING_STANDARDS_REVIEW.md` via `scripts/apply-standards-sheet.mjs`. Edit the sheet and re-run the script.

## 5. Inspect before you build

Before adding functionality, search the repo for existing code that already does it: `lib/` helpers, `components/` and `components/play/`, existing RPCs and views in `supabase/migrations/`, and the history file. Extend or reuse what exists rather than writing a parallel version. Two copies of a rule (a second ladder, a second ranking, a second scoring path) have repeatedly caused silent disagreement here. If a rule is already mirrored between TypeScript and SQL, change both and the test that pins them.

## 6. Modifying existing code

- Preserve existing behaviour unless the task explicitly requires changing it. Keep diffs minimal and scoped; do not refactor, rename or reformat unrelated code.
- Before changing a function, find its callers and tests. Grep embeds and string references too, not only imports.
- Renaming an event is not safe just because its slug survives: results group by `session_events.event_name`, and slugs/names are stored in several tables (`results`, `session_events`, `workout_entries`, `workouts.planned_events`, `grade_exemptions`, `activity_aliases`, `event_domains`). A rename needs a backfill migration and a sweep.
- If a change alters what the same evidence earns a player, bump `GRADING_RULES_VERSION` in `lib/grading.ts`, or no one is rechecked.
- Do not delete or weaken tests to get green. Many tests are structural and exist to stop a rule being dropped.

## 7. Database and schema changes

- Create migrations with `supabase migration new`; never hand-name or reuse a timestamp. Check for duplicates: `ls supabase/migrations | cut -c1-14 | sort | uniq -d`.
- A new migration must not redefine an existing function from memory. Start from the live definition (`pg_proc`) or the newest migration defining it, keep every earlier rule, and let the structural tests confirm.
- `CREATE OR REPLACE VIEW` can only append columns. `players_public` is defined once (DROP + CREATE); changing its columns requires sweeping every caller in `app/`.
- Enable RLS on every new table. Archive tables created with `CREATE TABLE … AS SELECT` need RLS explicitly enabled with no policies. Pin `search_path` on every `SECURITY DEFINER` function.
- Archive (with a pre-image) before irreversible data changes, and end data-rewriting migrations with an assertion that the invariant holds.
- Never re-run one-time re-encode migrations (for example `20260713000001`).
- Applying migrations to production is a human-supervised step: apply from `main` only, from a clean checkout, code deployed first unless the migration says otherwise. Never use `supabase migration repair` to get past a refusal; it means your tree is stale. Do not apply a migration yourself unless explicitly told to.
- Verify by querying the objects (`pg_proc`, `pg_trigger`, `information_schema`), not the migration ledger or prose.

## 8. Authentication and authorization

- Auth is Supabase Auth (email/password, Google OAuth) via `@supabase/ssr`. Pass `AUTH_COOKIE_OPTIONS` (`lib/supabase-cookies.ts`) to every Supabase client. Any new server client must forward the `headers` argument of `setAll` (carries `no-store`). `httpOnly` stays off.
- `players.role` is `player` or `judge`, pinned by trigger. Use `public.is_judge()` (definer) in policies on `players`.
- `players` is not publicly readable. Other players' data comes from `players_public`. Family accounts use `players.parent_id`; switch the active profile through `lib/useActivePlayer.ts`, never by writing localStorage.
- Authorization is enforced in the database (RLS and guard triggers). Never rely on UI hiding. Guards that distinguish client from server writes test `current_user`, not `auth.uid()`.
- Any redirect built from user input needs the `safeNext()` guard used by `/auth/callback`.

## 9. Security requirements

- Never commit secrets or `.env*`. `SUPABASE_SERVICE_ROLE_KEY` is server-only, imported only by `lib/supabase-admin.ts` (used by the recheck route and two scripts), used for writes only, and never `NEXT_PUBLIC_`.
- Do not add `dangerouslySetInnerHTML`, `eval` or dynamic SQL. Do not loosen the CSP or headers in `lib/securityHeaders.ts` (it is tested).
- When restricting a table, grep PostgREST embeds (`players(`) as well as `from('players')`. RLS failures return zero rows, not errors.
- Exact bodyweight and wellbeing responses are sensitive: keep them private and out of public payloads. The repo is public; do not commit documents naming players or their results.
- Test public RPCs as `anon` and logged-in RPCs as `authenticated`; running as `postgres` bypasses RLS and proves nothing.

## 10. Testing requirements

- Commands: `npm test` (Vitest), `npm run lint`, `npx tsc --noEmit`, `npm run build`. The build requires `NEXT_PUBLIC_SUPABASE_URL`.
- There is no CI configuration. Run lint, typecheck, tests and build yourself before pushing, and report honestly what passed and what you could not run.
- Add or update tests with every behaviour change; scoring, grading and ranking changes need unit tests in `__tests__/`. Tests run in `Pacific/Auckland` time; component tests opt into jsdom via a docblock.
- Pages behind a login are not browser-tested. Say so rather than claiming a UI change was verified.

## 11. Git and change management

- Work on the branch you were given; do not push to other branches or to `main` without explicit permission.
- Small, focused commits with descriptive messages. Do not force-push or rewrite history on shared branches.
- Bump `VERSION` and add a `CHANGELOG.md` entry for shipped changes, matching the existing format. Record follow-ups in `TODOS.md`.
- Several people and agents work in parallel worktrees. Fetch and check recent branches before touching migrations or `players_public`.
- Pull request descriptions state what changed, why, what was verified, and what was not.

## 12. Destructive changes

Before deleting data, dropping columns or tables, rewriting history, re-encoding scores, deleting files, overwriting uncommitted work, or running anything against production, stop and explain: what will change, what is irreversible, what depends on it, and how to roll back. Wait for explicit approval. Look at the target before overwriting it.

## 13. Uncertainty

Do not guess. If a requirement, rule or product decision is ambiguous, ask. If you cannot ask, choose the most conservative reading, make the smallest reversible change, and state the assumption in the commit or PR. Distinguish what you verified (ran, queried, read) from what you inferred. Never present an unverified claim as fact, and never mark something "applied" or "verified" in documentation unless you checked the live object.

## 14. Documenting incomplete work

If you stop before finishing, leave the next agent what they need, in the PR description and `TODOS.md`: what is done, what is not, the exact files and migrations involved, anything half-applied, commands to reproduce failures, assumptions made, and open questions for the owner. Do not leave partial changes unmarked or failing tests undescribed. Update `CLAUDE.md`/`docs/PROJECT_HISTORY.md` when facts they state become wrong.
