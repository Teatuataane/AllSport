-- Event Voting System
-- Three tables: event_votes, event_vote_nominations, event_vote_responses

-- ─── event_votes ────────────────────────────────────────────────────────────
CREATE TABLE public.event_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  voting_closes_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  nominations_per_domain INTEGER NOT NULL CHECK (nominations_per_domain BETWEEN 2 AND 10)
);

-- ─── event_vote_nominations ─────────────────────────────────────────────────
CREATE TABLE public.event_vote_nominations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  vote_id UUID NOT NULL REFERENCES public.event_votes(id) ON DELETE CASCADE,
  domain_number INTEGER NOT NULL CHECK (domain_number BETWEEN 1 AND 10),
  domain_name TEXT NOT NULL,
  event_name TEXT NOT NULL
);

-- ─── event_vote_responses ───────────────────────────────────────────────────
CREATE TABLE public.event_vote_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  vote_id UUID NOT NULL REFERENCES public.event_votes(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id),
  domain_number INTEGER NOT NULL CHECK (domain_number BETWEEN 1 AND 10),
  chosen_event TEXT NOT NULL,
  is_final BOOLEAN DEFAULT FALSE,
  UNIQUE(vote_id, player_id, domain_number)
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vote_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vote_responses ENABLE ROW LEVEL SECURITY;

-- event_votes policies
CREATE POLICY "event_votes_select_all" ON public.event_votes
  FOR SELECT USING (TRUE);

CREATE POLICY "event_votes_insert_judges" ON public.event_votes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'judge')
  );

CREATE POLICY "event_votes_update_judges" ON public.event_votes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'judge')
  );

-- event_vote_nominations policies
CREATE POLICY "event_vote_nominations_select_all" ON public.event_vote_nominations
  FOR SELECT USING (TRUE);

CREATE POLICY "event_vote_nominations_insert_judges" ON public.event_vote_nominations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'judge')
  );

-- event_vote_responses policies
CREATE POLICY "event_vote_responses_select" ON public.event_vote_responses
  FOR SELECT USING (
    player_id = auth.uid()
    OR is_final = TRUE
    OR EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'judge')
  );

CREATE POLICY "event_vote_responses_insert" ON public.event_vote_responses
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY "event_vote_responses_update" ON public.event_vote_responses
  FOR UPDATE USING (player_id = auth.uid());

-- ─── Aggregate results function (security-definer so players see counts only) ─
CREATE OR REPLACE FUNCTION public.get_vote_results(p_vote_id UUID)
RETURNS TABLE (domain_number INTEGER, chosen_event TEXT, vote_count BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT domain_number, chosen_event, COUNT(*)::BIGINT
  FROM event_vote_responses
  WHERE vote_id = p_vote_id AND is_final = TRUE
  GROUP BY domain_number, chosen_event
  ORDER BY domain_number, COUNT(*) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_vote_results(UUID) TO authenticated;

-- ─── Full breakdown function (judge-only) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_vote_details(p_vote_id UUID)
RETURNS TABLE (
  domain_number INTEGER,
  chosen_event TEXT,
  player_id UUID,
  display_name TEXT,
  username TEXT,
  division TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT evr.domain_number, evr.chosen_event, evr.player_id,
         p.display_name, p.username, p.division, evr.created_at
  FROM event_vote_responses evr
  LEFT JOIN players p ON p.id = evr.player_id
  WHERE evr.vote_id = p_vote_id AND evr.is_final = TRUE
  ORDER BY evr.domain_number, evr.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.get_vote_details(UUID) TO authenticated;
