-- ─────────────────────────────────────────────────────────────────────────────
-- Roster update: 122 → 120 events (August 2026)
--
-- Removed events leave their historical result rows behind as harmless orphan
-- name strings — the same pattern used for Handball (June 2026) and Kubb (July
-- 2026). Moved events keep their slug and need nothing here.
--
-- RENAMES DO need a backfill. Keeping the slug is not enough: /prs,
-- lib/percentile.ts and the My Events card all group results by
-- session_events.event_name, so a renamed event's history stops matching its own
-- definition and silently disappears from PRs and percentiles. Part 1 below
-- repoints the historical names.
--
-- ONE change cannot be handled that way: Leg Extension became "Leg Ext Hold" and
-- its input mode flipped from `strength` to `difficulty+time`.
--
--   old rows:  raw_score = weight lifted in kg   (e.g. 60 for a 60kg lift)
--   new rows:  raw_score = tierIdx * 10000 + seconds held
--
-- A stored 60 therefore decodes as "D1 · 1:00" — a hold that never happened.
-- There is no time in the old data, so the rows cannot be converted; a wrong PR
-- is worse than no PR, so they are deleted.
--
-- SIDE EFFECT, on purpose: in any live-computed view (/games/[sessionId], the
-- session leaderboard) the affected players now read "No score" for Leg
-- Extension in those past sessions, which ranks them last for that one event.
-- Awarded points are NOT touched — session_player_summary and rankings were
-- written when each session closed and stay exactly as they are.
--
-- Safe to run more than once (the second run deletes nothing).
--
-- DEPLOY ORDER: SHIP THE CODE FIRST, THEN RUN THIS.
-- Run in the wrong order and there is a window where session_events holds the
-- NEW names while the deployed bundle still knows only the OLD ones, so
-- getEventByName() returns undefined and live-session event cards lose their
-- tiers and input mode mid-session. Code-first only degrades display: recent
-- sessions show under the new name, older rows stay detached from PR history
-- until this migration lands, and nothing breaks while scoring.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Part 1: repoint renamed events so their history stays attached ───────────
-- Identity is the slug, which did not change; event_name is the label these
-- pages join on. Idempotent — a second run matches nothing.
--
-- The full old-name list was derived from every historical revision of
-- lib/eventData.ts in git, not from memory, so this also repairs renames from
-- earlier sessions that quietly orphaned their history at the time (Handbalance
-- being the most recent).

-- This roster update (Aug 2026)
update session_events set event_name = 'Pause Back Squat'      where event_name = 'Pause Squat';
update session_events set event_name = 'Pause Chinup'          where event_name = 'Pause Chin Up';
update session_events set event_name = 'Human Flag'            where event_name = 'Flag';
update session_events set event_name = 'Finger Pushup'         where event_name = 'Finger Push Up';
update session_events set event_name = 'Hamstring Curl'        where event_name = 'Ham Curl';
update session_events set event_name = 'Foot Behind Head Pose' where event_name = 'Foot Behind Head';
update session_events set event_name = 'Toe Squat'             where event_name = 'Toe Balance';

-- Earlier renames, same slug throughout — never backfilled until now
update session_events set event_name = 'Turkish Getup'         where event_name in ('Turkish Get Up', 'Turkish Get-Up', 'Turkish');
update session_events set event_name = 'Zercher Dead'          where event_name = 'Zercher Deadlift';
update session_events set event_name = 'Climbing'              where event_name = 'Rope Climb';
update session_events set event_name = 'Handstand'             where event_name in ('Handbalance', 'Hand Walk', '50m Hand Walk');
update session_events set event_name = 'Chinup Contest'        where event_name = 'Chin Up Contest';
update session_events set event_name = 'Pushup Contest'        where event_name = 'Push Up Contest';
update session_events set event_name = 'Ab Rollout'            where event_name = 'Ab Wheel Rollout';
update session_events set event_name = 'Forward Split'         where event_name = 'Front Split';
update session_events set event_name = 'Javelin'               where event_name = 'Javelin Throw';
update session_events set event_name = 'Shotput'               where event_name = 'Shot Put';
update session_events set event_name = 'Chin Hang'             where event_name = 'Chin Lift';
update session_events set event_name = 'T-Race'                where event_name = 'T-Test';

-- Earlier renames where the SLUG also changed but the movement did not
update session_events set event_name = '1A Press'              where event_name = '1 Arm Press';
update session_events set event_name = '1A Snatch'             where event_name = '1 Arm Snatch';
update session_events set event_name = 'Pause Bench'           where event_name = 'Pause Bench Press';
update session_events set event_name = 'Australian Football'   where event_name = 'AFL';
update session_events set event_name = 'Burpee Broad Jump'     where event_name = '200m Burpee Broad Jump';

-- DELIBERATELY NOT SWEPT — these were logged as "renames" but the movement
-- actually changed, so merging the history would credit a player's PR to a lift
-- or game they never did. Left as orphan strings:
--   'OHP' / 'Overhead Press' → Clean & Press   (different lift)
--   'Cornhole'               → Bocce           (different game)
--   'Sprint Repeats'         → Bronco          (different protocol)
--   'Calf Raise', 'Glute Bridge', 'Iron Lungs' (no documented successor)
--   '30-15 Test'             → Walking         (Walking is removed as of this migration)
--   the 2026-05 domain-6 slugs (1k Run, 1k Cycle, 1k Row, 1k Ski Erg, 200m
--     Carry, 2k Run, 200m Repeats) — redesigned, not renamed
-- 'Bowling' is also left alone on purpose: pre-May-2026 Bowling rows became Kubb,
-- but Bowling was re-added as its own event in July 2026, so the correct target
-- depends on the session date rather than the name.

-- NOTE: domain_name / domain_number on session_events are NOT touched. The June
-- 2026 pass renamed AND renumbered domains together, so rewriting the names
-- without the numbers would leave historical rows self-inconsistent. Domain
-- colour comes from the event definition, so past sessions still render fine.

-- NOTE: 'Leg Extension' is deliberately NOT renamed here. Its rows are deleted
-- in Part 2 — repointing the name first would only re-link data that cannot be
-- decoded under the new input mode.

-- ── Part 2: drop un-convertible Leg Extension results ────────────────────────
-- Read-only: what is about to be deleted.
do $$
declare
  n_rows int;
  n_players int;
  n_sessions int;
begin
  select count(*),
         count(distinct r.player_id),
         count(distinct r.session_id)
    into n_rows, n_players, n_sessions
    from results r
    join session_events se on se.id = r.event_id
   where se.event_name = 'Leg Extension';

  raise notice 'Leg Extension rows to delete: % (across % players, % sessions)',
    n_rows, n_players, n_sessions;
end $$;

-- Snapshot before deleting. The rows cannot be reconstructed from anything else,
-- so keep a copy: if the Leg Ext Hold call is ever revisited, the raw weights are
-- still here. Drop this table once you are sure it is no longer wanted.
create table if not exists results_leg_extension_archive_20260801 as
select r.*
  from results r
  join session_events se on se.id = r.event_id
 where se.event_name = 'Leg Extension';

-- CTAS does not inherit RLS, and anything in `public` is reachable through
-- PostgREST — without this the archive would expose every player's results to
-- any authenticated caller. RLS on with NO policies denies all API access;
-- service_role still reads it (BYPASSRLS) for any future restore.
alter table results_leg_extension_archive_20260801 enable row level security;
revoke all on results_leg_extension_archive_20260801 from anon, authenticated;

delete from results r
 using session_events se
 where se.id = r.event_id
   and se.event_name = 'Leg Extension';
