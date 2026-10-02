# HANDOFF

> **Status: there is no active handoff task yet.** This file is the template and baseline for the first one. The only work done so far in this effort is the agent-portability documentation described below. Whoever hands off next should overwrite the task-specific sections and keep the headings.
>
> Last updated: 2 October 2026, repo at v0.26.0.0, branch `claude/kind-dijkstra-cv6c1i`.

# Current Task

None. No feature, bug fix or migration is in progress.

The most recent task was making the repository portable between AI coding agents (Claude Code and OpenAI Codex). That task is finished and is awaiting review in [Teatuataane/AllSport#156](https://github.com/Teatuataane/AllSport/pull/156).

# Objective

Overall: any AI coding agent can pick up AllSport, understand it, and change it safely without a human re-explaining the project.

Concretely, the portability work set out to:
- Give agents one neutral operating manual (`AGENTS.md`).
- Give agents a concise technical briefing (`CLAUDE.md`) instead of a roughly 3,700-line history.
- Keep the old history available (`docs/PROJECT_HISTORY.md`).
- Provide a handoff mechanism (this file).

# Completed

- Inspected the repository structure and wrote a findings report (chat only, not committed).
- `CLAUDE.md` rewritten as a 185-line briefing. The previous version is preserved unabridged as `docs/PROJECT_HISTORY.md`.
- `AGENTS.md` created: 102 lines, no Claude-specific instructions, covering the 15 requested areas.
- `HANDOFF.md` created (this file).
- Commits for `CLAUDE.md`, `docs/PROJECT_HISTORY.md` and `AGENTS.md` are pushed to `claude/kind-dijkstra-cv6c1i`, and PR #156 is open against `main`.

# Current State

**The application.** Nothing in application code, migrations, scripts or tests was touched.

AllSport is a Next.js 16 App Router app (React 19, TypeScript) with no backend server of its own. The browser talks to Supabase (Postgres, PostgREST, Auth, Realtime) under RLS. Business logic is split between pure TypeScript in `lib/` and SQL triggers, RPCs and views in `supabase/migrations/` (89 files, newest `20260930222237_training_sessions.sql`). The one server route is `app/api/grades/recheck/route.ts`. Production is on Vercel at `allsport.nz`, with the database on hosted Supabase.

Players earn colours: a domain colour is the average of their best six events in that domain, and the overall colour is the average of ten domains, capped by games played. The season leaderboard ranks everyone in a game on their game colour total. Points, units, effort tasks, taniwha and Elo are retired.

**The documentation.** Four agent-facing files now exist at the root or in `docs/`: `AGENTS.md` (rules), `CLAUDE.md` (technical map), `docs/PROJECT_HISTORY.md` (history), `HANDOFF.md` (current state). They overlap in places by design; the code and live database win when they disagree.

# Important Discoveries

- **Documentation is not evidence.** `docs/PROJECT_HISTORY.md` records migrations as "applied and verified" that had never run. Verify against `pg_proc`, `pg_trigger` and `information_schema`, not the ledger or prose.
- **There is no CI.** No `.github/`, no `vercel.json`. Lint, typecheck, tests and build must be run by hand before pushing.
- **No typecheck script.** Use `npx tsc --noEmit`.
- **The build throws without `NEXT_PUBLIC_SUPABASE_URL`**, because the CSP `connect-src` is derived from it (`next.config.ts`).
- **Many tests are structural.** They read migration files and assert rules are present. Redefining a SQL function in a new migration will fail them if any earlier rule is dropped; that is their purpose.
- **`README.md` is still the unmodified `create-next-app` boilerplate.** `TODO.md` and `TODOS.md` both exist; `TODOS.md` is the maintained one.
- **`docs/designs/` is referenced throughout the history but is gitignored**, so it does not exist in a fresh clone.
- **`.claude/skills/` (about 33 gstack skills) is Claude-specific tooling.** The previous `CLAUDE.md` contained a "skill routing" section that was not carried into the new one.
- **The previous root `CLAUDE.md` told agents to update it after every significant piece of work.** The new one asks for updates to both it and `docs/PROJECT_HISTORY.md`; confirm that is the process the owner wants.

# Files Involved

| File | Why it matters |
|---|---|
| `AGENTS.md` | Neutral operating manual for any agent. Read first. |
| `CLAUDE.md` | Condensed technical briefing: architecture, scoring, grading, security, commands, file map. |
| `docs/PROJECT_HISTORY.md` | The previous `CLAUDE.md`, unabridged. Search it by topic before non-trivial changes. |
| `HANDOFF.md` | This file. |
| `TODOS.md`, `CHANGELOG.md`, `VERSION` | Open work, release notes, version (`0.26.0.0`). |
| `lib/eventData.ts` | The 128-event roster; compiled from `EVENT_DIFFICULTY_REVIEW.md`. |
| `lib/grading.ts`, `lib/standards.ts` | Colour rules and compiled standards. |
| `lib/scoring.ts` | `raw_score` encoding. |
| `supabase/migrations/` | All schema and server logic. |

# Changes Made

All on branch `claude/kind-dijkstra-cv6c1i`:

1. `docs: condense CLAUDE.md into an agent briefing, keep full record in docs/PROJECT_HISTORY.md`
2. `docs: add agent-neutral AGENTS.md operating manual`
3. `HANDOFF.md` added (this file; committed with whichever commit follows it, check `git log`).

Documentation only. No application code, migrations, scripts, tests or config were modified.

# Problems / Blockers

- **PR #156 is unreviewed.** The owner has not yet approved the content of `CLAUDE.md` or `AGENTS.md`.
- **The new docs have not been fact-checked against production.** The scoring, ranking and grading descriptions come from the old `CLAUDE.md` plus code inspection. I did not re-verify them against the live database or run the tests.
- **Overlap between `AGENTS.md` and `CLAUDE.md`** will drift if one is edited without the other.
- **`CLAUDE.md` still carries some Claude-flavoured material** (the `.claude/` tooling note). It is clearly marked, but a Codex session reading it may be confused.
- **Dropped content.** The old "skill routing" section is gone; decide whether to restore it in a Claude-only form.
- **Nothing is known to be broken in the application**, but the application was not built or tested in this effort.

# Next Steps

1. Owner reviews PR #156 and merges it, or requests changes.
2. Run `npm install`, `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` (with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set) to establish a verified baseline, and record the results under Tests below.
3. Optionally replace the boilerplate `README.md` with a short human-facing readme that points at `AGENTS.md`.
4. Optionally reduce overlap between `AGENTS.md` and `CLAUDE.md`, or decide that `CLAUDE.md` should just reference `AGENTS.md`.
5. For the next real task: overwrite Current Task, Objective, Changes Made, Problems / Blockers and Next Steps here, and keep everything else.

# Tests

- **Tests run in this effort: none.** No lint, typecheck, Vitest or build was executed, because only Markdown files changed.
- Repository facts observed (not test results): about 70 test files in `__tests__/`, Vitest in `node` with `TZ=Pacific/Auckland`, jsdom opt-in per file.
- Baseline pass/fail for the suite is **unknown**. Establish it before starting real work.

# Do Not Forget

- Do not apply migrations to production unless explicitly told to. When told to: from `main` only, clean checkout, code deployed first, verify by querying objects. Never `supabase migration repair`.
- Never reuse or hand-name a migration timestamp; use `supabase migration new`.
- Do not hand-edit generated output: ladders come from `EVENT_DIFFICULTY_REVIEW.md`, standards from `GRADING_STANDARDS_REVIEW.md`.
- Bump `GRADING_RULES_VERSION` in `lib/grading.ts` whenever a rule changes what the same evidence earns.
- Renaming an event needs a backfill migration and a sweep of every table storing a slug or name.
- `players` is not publicly readable; use `players_public`. The service-role key is server-only.
- Several product rules are deliberate owner decisions (walkovers count, one-point place gap, games-cap table). Do not "fix" them without asking.
- Work on the branch you were assigned; do not push elsewhere without permission.
- The repo is public: no secrets, no documents naming players.
- Keep this file current. If you stop mid-task, record what is done, what is half-done, and what you assumed.
