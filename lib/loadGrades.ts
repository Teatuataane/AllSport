// ─── Loading a player's grades ───────────────────────────────────────────────
// Everything computePlayerGrades needs, for one player, from the browser. The
// player's own view and the kaiwhakawā's release panel both call this, so they
// always agree.
//
// EVERY READ IS ITS OWN QUERY, per CLAUDE.md. A missing table returns PGRST205
// in `error` and a missing column returns 42703 and takes its whole query down,
// so nothing grading-specific is folded into a query that must succeed. Before
// the grading migration lands: no band (lifts ungradeable), no exemptions, no
// awards, and `schemaReady` false — the colours still compute. Before the
// workout migration lands: no workouts, `workoutsReady` false.
//
// Reads only what RLS already lets the viewer see: results, sessions, events
// and matches are public; gender, band and workouts are readable by the
// player, their parent and kaiwhakawā. A viewer who cannot read them gets null
// or nothing, which grades a junior on the men's ladder, leaves lifts
// ungradeable and counts no logged training.

import { createClient } from './supabase-browser'
import {
  computePlayerGrades, heldRungs, voidedSessions, colourGates, unitsSinceConferral, gameEvidence,
  type PlayerGrades,
} from './playerGrades'
import type { ColourGate } from './grading'
import { workoutEvidence, type WorkoutEntryRow } from './workouts'
import { rateGames, type SportRating } from './headToHead'
import { disputedBySport, type MatchRow } from './matches'

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
  /** Official games played: sessions that finished and were not voided, with any result. */
  games: number
  /** Effort units per domain since the last colour there. */
  unitsByDomain: Map<number, number>
  /** The three gates on every domain's next colour. */
  gates: ColourGate[]
  /** False until the workout migration is applied. */
  workoutsReady: boolean
  /** Disputed games per sport (event name), waiting for a kaiwhakawā to settle. */
  disputed: Map<string, number>
}

type ResultRow = {
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
  session_id: string
  points_earned: number | null
  created_at: string
  session_events: { event_name: string } | null
  sessions: { is_active: boolean; points_awarded_at: string | null; started_at: string | null } | null
}

type MatchQueryRow = {
  id: string
  session_id: string
  outcome: MatchRow['outcome']
  created_at: string
  confirmed_at: string | null
  session_events: { event_name: string } | null
  match_players: { player_id: string; side: 'a' | 'b' }[]
}

/**
 * Every recorded match, shaped for lib/matches.ts. Empty before match recording lands.
 *
 * `confirmed_at` rides in this query rather than its own because it was created
 * in the same CREATE TABLE as `matches` itself (20260914020739): a database that
 * has the table cannot lack the column, so it cannot raise 42703 here.
 */
export async function loadMatches(): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, session_id, outcome, created_at, confirmed_at, session_events(event_name), match_players(player_id, side)')
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as unknown as MatchQueryRow[])
    .filter(m => m.session_events?.event_name)
    .map(m => ({
      id: m.id, session_id: m.session_id, outcome: m.outcome, created_at: m.created_at,
      confirmed_at: m.confirmed_at, event_name: m.session_events!.event_name, players: m.match_players ?? [],
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
 * Every session a kaiwhakawā voided, from `sessions.voided_at`. Its OWN query,
 * never folded into the results select: before the migration that adds the
 * column, naming it raises 42703 and would take the whole results read down.
 * Null means the column is not there yet, and `voidedSessions` falls back to
 * inferring a void from missing points. Fetched once per page load.
 */
let recordedVoids: Promise<Set<string> | null> | null = null
function loadRecordedVoids(): Promise<Set<string> | null> {
  recordedVoids ??= Promise.resolve(
    supabase.from('sessions').select('id').not('voided_at', 'is', null),
  ).then(({ data, error }) => {
    // 42703 = the column is not there yet: the legacy rule is still correct.
    if (error?.code === '42703') return null
    // Any other failure: count every game rather than guess. After the
    // migration the legacy rule would call EVERY finished game voided, which is
    // far worse than counting one rare voided game. Not cached, so the next
    // load asks again.
    if (error || !data) { recordedVoids = null; return new Set<string>() }
    return new Set((data as { id: string }[]).map(s => s.id))
  })
  return recordedVoids
}

/** The player's rows that may grade them: not from a VOIDED session. */
function countedRows(rows: readonly ResultRow[], recorded: ReadonlySet<string> | null): ResultRow[] {
  const sessions = [...new Map(rows.filter(r => r.sessions).map(r => [r.session_id, {
    id: r.session_id, is_active: r.sessions!.is_active, points_awarded_at: r.sessions!.points_awarded_at,
  }])).values()]
  const voided = voidedSessions(recorded, sessions, rows)
  return rows.filter(r => !voided.has(r.session_id) && r.session_events?.event_name)
}

/**
 * One player's grades and conferred colours. `matches` may be passed in when
 * loading several players, so every match is fetched once. Returns null only
 * if the player cannot be found.
 */
export async function loadGradeState(playerId: string, matches?: readonly MatchRow[]): Promise<GradeState | null> {
  const [profile, gender, band, results, exemptions, awards, workouts, allMatches, voids] = await Promise.all([
    supabase.from('players_public').select('division, age_years').eq('id', playerId).maybeSingle(),
    supabase.from('players').select('gender').eq('id', playerId).maybeSingle(),
    supabase.from('players').select('bodyweight_band').eq('id', playerId).maybeSingle(),
    supabase.from('results')
      .select('raw_score, weight_kg, difficulty_tier, session_id, points_earned, created_at, session_events(event_name), sessions(is_active, points_awarded_at, started_at)')
      .eq('player_id', playerId)
      .not('raw_score', 'is', null)
      // Well above any one player's lifetime rows; PostgREST caps a response at 1000.
      .range(0, 4999),
    supabase.from('grade_exemptions').select('event_slug').eq('player_id', playerId),
    supabase.from('grade_awards').select('domain_number, rung, grade_name, conferred_at').eq('player_id', playerId),
    supabase.from('workout_entries')
      .select('event_slug, count, volume_distance_m, raw_score, weight_kg, difficulty_tier, workouts!inner(player_id, performed_on, witnessed, created_at)')
      .eq('workouts.player_id', playerId)
      .range(0, 4999),
    matches ? Promise.resolve(matches) : loadMatches(),
    loadRecordedVoids(),
  ])

  if (!profile.data) return null
  const p = profile.data as { division: string | null; age_years: number | null }
  const awardRows = awards.error ? [] : (awards.data ?? []) as GradeAward[]
  const bandLabel = band.error ? null : (band.data as { bodyweight_band: string | null } | null)?.bodyweight_band ?? null
  const exempt = new Set(exemptions.error ? [] : (exemptions.data ?? []).map((e: { event_slug: string }) => e.event_slug))

  const counted = countedRows((results.data ?? []) as unknown as ResultRow[], voids)
  const game = gameEvidence(counted.map(r => ({
    session_id: r.session_id,
    event_name: r.session_events!.event_name,
    raw_score: r.raw_score, weight_kg: r.weight_kg, difficulty_tier: r.difficulty_tier,
    at: r.sessions?.started_at ?? r.created_at,
    closed: r.sessions ? !r.sessions.is_active : true,
  })))
  const logged = workoutEvidence(workouts.error ? [] : (workouts.data ?? []) as unknown as WorkoutEntryRow[])

  const grades = computePlayerGrades({
    player: {
      division: p.division,
      ageYears: p.age_years,
      gender: (gender.data as { gender: string | null } | null)?.gender ?? null,
      bodyweightBand: bandLabel,
    },
    results: [...game.rows, ...logged.rows],
    ratings: ratingsFor(playerId, allMatches),
    exemptions: exempt,
  })

  const held = heldRungs(awardRows)
  const games = game.games
  const unitsByDomain = unitsSinceConferral([...game.units, ...logged.units], awardRows)

  return {
    grades, awards: awardRows, held, exemptions: exempt,
    hasBand: bandLabel != null, schemaReady: !awards.error,
    games, unitsByDomain,
    gates: colourGates(grades.domains, held, games, unitsByDomain),
    workoutsReady: !workouts.error,
    disputed: disputedBySport(allMatches, playerId),
  }
}
