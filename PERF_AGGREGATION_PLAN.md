# Server-side aggregation plan — /leaderboard and /dashboard

Status: **Stage 0 and Stage 1 implemented** (August 2026), pending deploy.
Stage 2 and Stage 3 remain proposals. Written after the mobile performance
audit; the P0 image and cache fixes from that audit are already landed.

> **DEPLOY ORDER: apply `20260821000000_leaderboard_rpc.sql` FIRST, then ship the
> code.** The migration is purely additive, so it is a no-op against the
> currently deployed bundle. Reversed, the new bundle calls `leaderboard_page`
> before it exists and the board renders empty.

> **THIS BRANCH IS 42 COMMITS BEHIND `origin/main` — merge before shipping.**
> `supabase migration list` surfaced two problems that were invisible from
> inside the branch:
>
> 1. The migration was first written as `20260816000000`, which **collides with
>    `20260816000000_players_public_show_division.sql`** already applied to prod.
>    The CLI keys on the 14-digit version alone, so `db push` would have treated
>    this file as already applied and **silently skipped it**. Renamed to
>    `20260821000000` (main's highest is `20260820000002`).
> 2. `20260813000003_players_pii_lockdown.sql` **removed
>    `players_select_all USING (true)`** in production. The original RPC read
>    `players` directly on the strength of that policy, so against today's
>    database an anonymous visitor would have got zero player rows — no names on
>    the leaderboard and no percentile columns — and RLS fails *quiet*, returning
>    no rows rather than an error. Both functions now read `players_public`, the
>    view granted to anon for exactly this. `results`, `sessions`,
>    `session_events`, `rankings` and `player_totals` were checked and still
>    carry public SELECT.
>
> Merging main will conflict in `app/leaderboard/page.tsx` and
> `app/dashboard/page.tsx`: main switched their roster reads to `players_public`,
> and this branch replaced those same effects with the RPC call. The RPC version
> supersedes them — it reads `players_public` server-side — but the merge needs a
> human eye rather than "take ours".

---

## The measurement that decides the design

The audit reported "8 of 9 Supabase calls exceed 300ms, most 2.2–2.8s" and
attributed it to the full-table client-side reads. That was the right symptom
and the wrong cause. Follow-up measurement against the live project:

| What was measured | Result |
|---|---|
| Raw network RTT to the Supabase origin | **~52ms** |
| Single query, tiny table (`partners`), cold | **1097ms** |
| Single query, tiny table, warm | **409ms** |
| `results` page 1 — one of **7 concurrent** requests | **2764ms** |
| `results` page 2 — same query shape, **running alone** | **134ms** |

The same query costs **2764ms in a crowd and 134ms alone**: a 20× swing with no
change to the SQL. A 20-row `player_totals` read also took 2212ms, which cannot
be execution time.

Supporting facts:

- `results` RLS SELECT policy is `USING (true)` (`20260429000000_v2_clean_schema.sql:187`),
  so per-row policy evaluation is not the cost.
- `results` has no index beyond its PK and `UNIQUE (player_id, session_id, event_id)`.
  Irrelevant today (the queries are unfiltered scans of a small table) but it
  matters for Stage 2.
- `results` is currently **2 pages** (between 1000 and 2000 rows) — the audit
  observed a second `results` request at offset 1000.

**Diagnosis: per-request overhead dominates and concurrent requests contend.**
The lever is the NUMBER OF REQUESTS on the critical path, not query speed and
not payload size. Optimising the SQL would move almost nothing.

It also means speculative parallel requests are actively harmful. An interim fix
had `lib/fetchAll.ts` fetch pages in parallel waves, which had to be reworked
from a fixed width to a ramp (1, 2, 4, 8) because a fixed width fires three
wasted CONCURRENT requests for a two-page table, and two pages is exactly the
shape `results` is in today. That module has since been deleted outright: Stage 1
removed both its callers, and server-side aggregation has no 1000-row cap to page
around. Worth remembering if paging is ever reintroduced — parallelism is not
free against this backend.

---

## What actually consumes the data

Worth knowing before designing anything: **the Elo engine is dead code.**

| Function | Call sites outside `lib/` |
|---|---|
| `computeRatings` | **0** |
| `eloTo100` | **0** |
| `domainRatings` | **0** |
| `sessionWins` | 2 (leaderboard, dashboard) |
| `computePercentiles` | 2 (leaderboard, dashboard) |
| `divisionPool` | 0 direct (used inside `percentile.ts`) |

Session 24 replaced the player-facing skill score with percentiles and left the
Elo engine in place "for `sessionWins`", but `sessionWins` is a plain
`placement = 1` count that does not touch Elo. So `computeRatings` — the
pairwise K-factor loop, ~90 lines — runs nowhere.

The live requirement is only:

- `sessionWins(results)` → needs `player_id, session_id, placement`, filtered to the current season
- `computePercentiles(results, session_events, players)` → needs `player_id, event_id, raw_score` + `session_events(id, event_name)` + `players(id, division)`
- `sessions(id, session_date)` → used **only** to work out which sessions are in the current year

---

## Staged plan

### Stage 0 — delete the dead Elo engine

Remove `computeRatings`, `eloTo100`, `domainRatings`, `topEvent`, `topDomain`
from `lib/rating.ts`, keeping `divisionPool` (used by `percentile.ts`) and
`sessionWins`. Delete the corresponding cases in `__tests__/rating.test.ts`.

- **Effort:** ~30 min. **Risk:** none — nothing imports them.
- **Win: clarity, NOT bytes.** Measured after the fact: the client bundle went
  from 388.0 KB to 389.2 KB gzipped across Stage 0 and Stage 1 together, i.e.
  deleting 280 lines saved nothing. The dead exports had no importers, so
  tree-shaking was already dropping them from the bundle; the 1.2 KB rise is
  Stage 1's new code. **Do not justify this work on bundle size.** Justify it on
  nobody having to reason about which of two competing ranking metrics is
  authoritative — a live hazard, since the leaderboard imports `topDomain` from
  `percentile.ts` aliased as `pctTopDomain` purely because `rating.ts` exported
  a different function with the same name.

Do this first and independently. It is pure deletion and needs no migration.

**Done.** `lib/rating.ts` now holds only `divisionPool` + `sessionWins` and the
row types; `__tests__/rating.test.ts` trimmed to match. The file keeps its name
and its `Rating*` type names because they are referenced across the dashboard,
leaderboard, `percentile.ts` and CLAUDE.md — renaming is churn with no payoff.

### Stage 1 — collapse the request fan-out into one RPC ← **recommended stopping point for now**

Add one `SECURITY DEFINER` (or plain, given public-read) function that returns
everything the page needs as a single JSON payload:

```sql
create or replace function public.leaderboard_page(p_season int)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'rankings',       (select coalesce(jsonb_agg(...), '[]') from rankings ... where season_year = p_season),
    'colour_rungs',   (select coalesce(jsonb_agg(...), '[]') from player_totals),
    'active_session', (select to_jsonb(s) from sessions s where s.is_active limit 1),
    'results',        (select coalesce(jsonb_agg(...), '[]') from results where raw_score is not null),
    'session_events', (select coalesce(jsonb_agg(...), '[]') from session_events),
    'sessions',       (select coalesce(jsonb_agg(...), '[]') from sessions),
    'players',        (select coalesce(jsonb_agg(...), '[]') from players)
  );
$$;
```

The client keeps `sessionWins` and `computePercentiles` exactly as they are and
just feeds them from the RPC result instead of four `fetchAll` calls.

- **Effort:** half a day including the dashboard equivalent.
- **Risk:** **low, and specifically no scoring-correctness risk** — not a single
  line of ranking maths changes. The failure mode is a wrong column list, which
  typechecking and a page load both catch immediately.
- **Win:** the leaderboard goes from **7 concurrent requests to 1**. On the
  measured numbers that is roughly **2.7s → ~400ms** for the stats, and the
  board itself paints sooner because `rankings` is no longer queued behind six
  competing requests.
- **Bonus:** it also removes the 1000-row paging problem entirely, because
  aggregation happens server-side where the cap does not apply.

**Do not split this into "fast core" and "slow stats" RPCs.** That reintroduces
the concurrency that is causing the problem. One request.

**Done.** `supabase/migrations/20260821000000_leaderboard_rpc.sql` adds
`stats_bundle()` (shared by both pages) and `leaderboard_page(p_season)` (which
embeds it). `/leaderboard` went from four data effects to one RPC call plus a
realtime effect keyed on the returned session id; `/dashboard` swapped its
four-way `fetchAll` block for `stats_bundle()`. `lib/fetchAll.ts` and its tests
were deleted with the last caller — aggregation now happens server-side, where
the 1000-row cap does not apply.

**Not yet verified against a real database.** There is no local Postgres or
Docker in this environment, and `supabase db lint` needs one (or would lint prod
without exercising this file). Every referenced column was cross-checked against
the schema migrations by hand, but the SQL has not been executed. Apply it to a
branch/staging database first, or watch the `db push` output closely.

Payload after Stage 1 is still full history (roughly 1500 result rows, about
40KB gzipped). That is **not** currently a bottleneck, which is why Stage 2 is
not urgent.

### Stage 2 — move the aggregation itself into SQL (defer until data grows)

Only worth doing when the payload starts to matter, i.e. results grows perhaps
5–10× from today. It returns ~20 rows instead of ~1500.

The percentile maths maps onto window functions cleanly. The strict-lower count
that `percentile.ts` needs — "ties never count as beaten" — is exactly
`rank() over (partition by event_name, pool order by best_raw asc) - 1`, and
`isLeader` is `best_raw = max(best_raw) over (partition by event_name, pool)`.

**The blocker is not the maths, it is the domain mapping.** Rolling up per-event
percentiles into a top DOMAIN needs event name → domain number, which lives only
in `lib/eventData.ts`. So Stage 2 requires either:

- **(a)** an `events` reference table in Postgres, generated from `eventData.ts`
  by a migration, with a test asserting the two never drift; or
- **(b)** returning per-event rows and rolling up on the client — but that is
  ~1200 rows for all players, barely smaller than the raw data, so it defeats
  the purpose.

**Take (a).** It is more work, but event names living only in TypeScript while
the database stores them as strings is the exact structural weakness behind the
session-27 rename incident documented in CLAUDE.md, where renaming an event
silently orphaned every PB. A reference table with a drift test fixes that class
of bug as a side effect.

**Parity gate — mandatory before switching over.** Do not swap the client onto
SQL-computed percentiles on faith. Write a throwaway script that pulls prod
data, runs `computePercentiles` in TypeScript, calls the RPC, and diffs the two
player-by-player and event-by-event. Ship only on an exact match. Watch
specifically for: the `'Youth'` legacy division mapping, orphan event names that
match no current event (deliberately unrated today), the `max(1, …)` floor, and
shared-top counting as `isLeader`.

- **Effort:** 2–3 days with the reference table and the parity gate.
- **Risk:** medium. This is the one that can silently change what players see.

### Stage 3 — indexes, only when a query plan says so

Add `results(event_id)`, `results(session_id)` and `session_events(session_id)`
when Stage 2's joins are in place and `explain analyze` justifies them. Adding
them now would be cargo-culting: the current queries are unfiltered scans of a
table small enough that the planner will ignore an index anyway.

A materialised view refreshed on session close is the endgame if the RPC itself
ever gets slow. It is not needed at this data size, and it would need the same
"recompute, never increment" discipline the colours rework settled on.

---

## Recommendation

Ship **Stage 0 and Stage 1**, then re-measure. Together they are about a day and
carry no risk to scoring correctness, and they address the actual measured
cause — request count — rather than the one the original audit assumed.

Hold **Stage 2** until either the payload measurably hurts or the roster work
makes the `events` reference table worth having on its own merits. It is the
larger and riskier half, and the numbers do not currently justify it.
