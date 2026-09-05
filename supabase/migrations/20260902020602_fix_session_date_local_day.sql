-- sessions.session_date has been stored a day early for every morning game.
--
-- app/scoring/page.tsx derived it from `new Date().toISOString().split('T')[0]`,
-- which is the UTC day. Any session starting before noon NZ is therefore stamped
-- with the previous day: a 9:00am Saturday is 21:00 UTC Friday. 25 of the 62
-- sessions are wrong (verified against prod) — every Saturday morning game, and
-- roughly as many weekday morning ones. The Selwyn Winter Jam of Sat 4 July 2026
-- sits in the table as 2026-07-03.
--
-- Surfaces rendering the wrong day today: session history on /taniwha/history
-- and in JudgeCard, /games/[sessionId], /prs and PersonalBestCard. NOT /schedule
-- — that page is static copy and renders no session_date at all.
--
-- Expected side effect: correcting these dates reorders history. Sorted by
-- session_date, 15 of 62 sessions change position and same-day clusters drop
-- from 11 to 9. limbCrossings() in lib/taniwha.ts replays sessions in
-- session_date order to reconstruct when each taniwha piece landed, so some
-- historical piece dates and the colours timeline shift by a day. That is the
-- correction landing, not a regression: those dates were wrong before.
--
-- The June 2026 lib/dates.ts work fixed the READ side (parseLocalDate). This is
-- the write side, which was never touched and is still producing bad rows: the
-- 29 August 2026 session was stored as the 28th.
--
-- Two parts: correct the history, then make the invariant structural so no
-- client can reintroduce it.

-- ---------------------------------------------------------------------------
-- Part 1 — enforce the invariant at the database, not in each caller.
-- ---------------------------------------------------------------------------
-- session_date means "the local day this game is played on", and started_at is
-- the authoritative instant. Deriving one from the other in a trigger fixes it
-- once for every writer: the live-session screen, any future scheduling UI, and
-- anything that creates sessions in advance.
--
-- 'Pacific/Auckland' rather than a fixed +12: NZDT is +13 from late September,
-- so a hardcoded offset would silently reintroduce the same off-by-one every
-- summer. Sessions with a NULL started_at keep whatever date they were given —
-- there is nothing to derive from.
create or replace function public.set_session_date_from_started_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.started_at is not null then
    new.session_date := (new.started_at at time zone 'Pacific/Auckland')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists session_date_follows_started_at on public.sessions;
create trigger session_date_follows_started_at
  before insert or update of started_at, session_date on public.sessions
  for each row
  execute function public.set_session_date_from_started_at();

-- ---------------------------------------------------------------------------
-- Part 2 — correct the 25 historical rows.
-- ---------------------------------------------------------------------------
-- Touch only rows that actually disagree, so re-running this is a no-op.
--
-- Safe against the award chain, and this is load-bearing rather than luck:
-- sessions carries three AFTER UPDATE triggers (auto_award_points,
-- trg_event_placements, trg_taniwha_sync) and every one of them is gated on
-- WHEN (old.is_active = true AND new.is_active = false AND
-- new.points_awarded_at IS NULL). This UPDATE never touches is_active, so the
-- WHEN clause is false on all 62 rows and none of them re-award. Anyone
-- widening this backfill to touch is_active would re-run the entire points,
-- placement and taniwha pipeline over the whole history.
-- The trigger above would do the same work, but stating it explicitly keeps the
-- migration readable on its own and reports the row count.
do $$
declare
  n integer;
begin
  update public.sessions
     set session_date = (started_at at time zone 'Pacific/Auckland')::date
   where started_at is not null
     and session_date is distinct from (started_at at time zone 'Pacific/Auckland')::date;
  get diagnostics n = row_count;
  raise notice 'session_date corrected on % session(s)', n;
end $$;

-- ---------------------------------------------------------------------------
-- Assert the invariant actually holds before declaring success.
-- ---------------------------------------------------------------------------
-- A migration that rewrites data has to prove it landed; a silent partial
-- update that reports success is the failure mode this guards against.
do $$
declare
  bad integer;
begin
  select count(*) into bad
    from public.sessions
   where started_at is not null
     and session_date is distinct from (started_at at time zone 'Pacific/Auckland')::date;
  if bad > 0 then
    raise exception 'session_date still disagrees with started_at on % row(s)', bad;
  end if;
end $$;
