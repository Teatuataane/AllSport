// ─── Loading a player's grades ───────────────────────────────────────────────
// Everything computePlayerGrades needs, for one player, from the browser. The
// player's own view and the kaiwhakawā's release panel both call this, so they
// always agree.
//
// EVERY READ IS ITS OWN QUERY, per CLAUDE.md. A missing table returns PGRST205
// in `error` and a missing column returns 42703 and takes its whole query down,
// so nothing grading-specific is folded into a query that must succeed. Before
// the grading migration lands: no band (lifts ungradeable), no exemptions, no
// awards, and `schemaReady` false — the colours still compute.
//
// Reads only what RLS already lets the viewer see: results, sessions, events
// and matches are public; gender and band are readable by the player, their
// parent and kaiwhakawā. A viewer who cannot read them gets null, which grades
// a junior on the men's ladder and leaves lifts ungradeable.

import { createClient } from './supabase-browser'
import {
  computePlayerGrades, heldRungs, voidedSessionIds, type PlayerGrades, type GradeResultRow,
} from './playerGrades'
import { rateGames, type SportRating } from './headToHead'
import type { MatchRow } from './matches'

const supabase = createClient()

export type GradeAward = { domain_number: number; rung: number; grade_name: string; conferred_at: string }

export type GradeState = {
  grades: PlayerGrades
  awards: GradeAward[]
  /** Highest conferred colour per domain. */
  held: Map<number, number>
  /** Event slugs a kaiwhakawā has confirmed this player cannot do. */
  exemptions: Set<string>
  /** False when the player has no bodyweight band, so lifts cannot be graded. */
  hasBand: boolean
  /** False until the grading migration is applied: nothing can be conferred yet. */
  schemaReady: boolean
}

type ResultRow = {
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
  session_id: string
  points_earned: number | null
  session_events: { event_name: string } | null
  sessions: { is_active: boolean; points_awarded_at: string | null } | null
}

type MatchQueryRow = {
  id: string
  session_id: string
  outcome: MatchRow['outcome']
  created_at: string
  session_events: { event_name: string } | null
  match_players: { player_id: string; side: 'a' | 'b' }[]
}

/** Every recorded match, shaped for lib/matches.ts. Empty before match recording lands. */
export async function loadMatches(): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, session_id, outcome, created_at, session_events(event_name), match_players(player_id, side)')
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as unknown as MatchQueryRow[])
    .filter(m => m.session_events?.event_name)
    .map(m => ({
      id: m.id, session_id: m.session_id, outcome: m.outcome, created_at: m.created_at,
      event_name: m.session_events!.event_name, players: m.match_players ?? [],
    }))
}

/** Each sport's rating for one player, from every recorded match. */
export function ratingsFor(playerId: string, matches: readonly MatchRow[]): Map<string, SportRating> {
  const out = new Map<string, SportRating>()
  for (const [sport, players] of rateGames(matches)) {
    const r = players.get(playerId)
    if (r) out.set(sport, r)
  }
  return out
}

/**
 * The player's rows that may grade them: not from a VOIDED session. The award
 * trigger writes points to every row a player scored in a session that really
 * closed, so this player's own rows are enough to tell (voidedSessionIds).
 */
function countedRows(rows: readonly ResultRow[]): GradeResultRow[] {
  const sessions = [...new Map(rows.filter(r => r.sessions).map(r => [r.session_id, {
    id: r.session_id, is_active: r.sessions!.is_active, points_awarded_at: r.sessions!.points_awarded_at,
  }])).values()]
  const voided = voidedSessionIds(sessions, rows)
  return rows
    .filter(r => !voided.has(r.session_id) && r.session_events?.event_name)
    .map(r => ({
      event_name: r.session_events!.event_name,
      raw_score: r.raw_score, weight_kg: r.weight_kg, difficulty_tier: r.difficulty_tier,
    }))
}

/**
 * One player's grades and conferred colours. `matches` may be passed in when
 * loading several players, so every match is fetched once. Returns null only
 * if the player cannot be found.
 */
export async function loadGradeState(playerId: string, matches?: readonly MatchRow[]): Promise<GradeState | null> {
  const [profile, gender, band, results, exemptions, awards, allMatches] = await Promise.all([
    supabase.from('players_public').select('division, age_years').eq('id', playerId).maybeSingle(),
    supabase.from('players').select('gender').eq('id', playerId).maybeSingle(),
    supabase.from('players').select('bodyweight_band').eq('id', playerId).maybeSingle(),
    supabase.from('results')
      .select('raw_score, weight_kg, difficulty_tier, session_id, points_earned, session_events(event_name), sessions(is_active, points_awarded_at)')
      .eq('player_id', playerId)
      .not('raw_score', 'is', null)
      // Well above any one player's lifetime rows; PostgREST caps a response at 1000.
      .range(0, 4999),
    supabase.from('grade_exemptions').select('event_slug').eq('player_id', playerId),
    supabase.from('grade_awards').select('domain_number, rung, grade_name, conferred_at').eq('player_id', playerId),
    matches ? Promise.resolve(matches) : loadMatches(),
  ])

  if (!profile.data) return null
  const p = profile.data as { division: string | null; age_years: number | null }
  const awardRows = awards.error ? [] : (awards.data ?? []) as GradeAward[]
  const bandLabel = band.error ? null : (band.data as { bodyweight_band: string | null } | null)?.bodyweight_band ?? null
  const exempt = new Set(exemptions.error ? [] : (exemptions.data ?? []).map((e: { event_slug: string }) => e.event_slug))

  const grades = computePlayerGrades({
    player: {
      division: p.division,
      ageYears: p.age_years,
      gender: (gender.data as { gender: string | null } | null)?.gender ?? null,
      bodyweightBand: bandLabel,
    },
    results: countedRows((results.data ?? []) as unknown as ResultRow[]),
    ratings: ratingsFor(playerId, allMatches),
    exemptions: exempt,
  })

  return {
    grades, awards: awardRows, held: heldRungs(awardRows), exemptions: exempt,
    hasBand: bandLabel != null, schemaReady: !awards.error,
  }
}
