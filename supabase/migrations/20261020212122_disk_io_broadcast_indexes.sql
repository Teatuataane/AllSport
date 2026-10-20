-- Disk IO budget (Supabase warning, 21 Oct 2026).
--
-- The database is 22 MB and sits in memory; what drained the Micro compute's
-- Disk IO budget was Realtime postgres_changes. While any game screen was
-- open, the Realtime server polled the replication slot several times a
-- second (3.35 million polls by 21 Oct), decoding the write-ahead log for
-- every change to `results` and `session_events`. The browser now uses
-- Realtime Broadcast instead (lib/liveSession.ts), which never touches
-- Postgres, so neither table needs to be in the publication.
--
-- DEPLOY THE CODE FIRST. A browser still on the old code loses its live
-- updates once this runs (the scoring screen still polls every 15 seconds).
--
-- Also adds the two indexes every game screen's reads have been missing:
-- `results` had been read by full scan 172,000 times, always by session_id.

-- 1. Stop decoding changes nobody subscribes to any more. Guarded so a re-run
--    or a table already removed is not an error.
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'results') then
    alter publication supabase_realtime drop table public.results;
  end if;
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_events') then
    alter publication supabase_realtime drop table public.session_events;
  end if;
end $$;

-- 2. Indexes for the reads every game screen makes.
create index if not exists results_session_id_idx on public.results (session_id);
create index if not exists session_events_session_id_idx on public.session_events (session_id);

-- 3. Assert.
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public'
               and tablename in ('results', 'session_events')) then
    raise exception 'results or session_events is still in supabase_realtime';
  end if;
  if (select count(*) from pg_indexes where schemaname = 'public'
        and indexname in ('results_session_id_idx', 'session_events_session_id_idx')) <> 2 then
    raise exception 'session_id indexes missing';
  end if;
end $$;
