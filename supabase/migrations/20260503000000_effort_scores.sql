-- Effort scores table
create table effort_scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  player_id uuid references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  event_id uuid references session_events(id) on delete cascade,
  difficulty_tier text,
  time_seconds integer,
  weight_kg numeric,
  reps integer,
  distance_m numeric,
  points_awarded integer not null default 0,
  is_qualifying boolean not null default false
);

alter table effort_scores enable row level security;

create policy "Players can insert own effort scores"
  on effort_scores for insert
  with check (auth.uid() = player_id);

create policy "Players can view effort scores in their sessions"
  on effort_scores for select
  using (true);

-- Enable realtime
alter publication supabase_realtime add table effort_scores;
