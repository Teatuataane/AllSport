// ─── Loading a player's grades ───────────────────────────────────────────────
// Everything computePlayerGrades needs, for one player, through whichever
// Supabase client the caller passes: the browser (the player's own view and the
// kaiwhakawā's panel), the auto-conferral route on the server, and the history
// replay script. All three compute through here, so they always agree.
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

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computePlayerGrades, heldRungs, voidedSessions, colourGates, gameEvidence,
  type PlayerGrades,
} from './playerGrades'
import { bodyweightOn, bandMidpointKg, type ColourGate, type BodyweightDeclaration } from './grading'
import { workoutEvidence, GAME_MINUTES, type WorkoutEntryRow } from './workouts'
import { rateGames, type SportRating } from './headToHead'
import { disputedBySport, type MatchRow } from './matches'
import { toNZDateString } from './dates'

/**
 * The Supabase client to read through. Passed in rather than created here, so
 * this module works in a browser AND on a server: importing supabase-browser at
 * module scope both drags the browser client into every bundle that touches
 * grading and makes the module unusable server-side, where there is no
 * document.cookie to read a session from.
 *
 * Auto-conferral needs to run this exact engine on a server against the
 * CALLER'S OWN login, so the reads stay inside RLS. That is the whole reason
 * for the parameter. Same split as lib/activePlayer.ts and lib/useActivePlayer.ts.
 */
export type GradeDb = SupabaseClient

export type GradeAward = {
  domain_number: number
  rung: number
  grade_name: string
  conferred_at: string
  /** Present on a loaded award; absent on one the replay has only planned. */
  id?: string
  /** The kaiwhakawā who released it, or null when the server conferred it. */
  conferred_by?: string | null
}

export type GradeState = {
  /**
   * players.is_active. False for an erased or retired profile, which the live
   * route never confers on. Undefined only in a state built by hand.
   */
  active?: boolean
  /** A guest cannot hold a colour (confer_grade refuses one too). */
  guest?: boolean
  grades: PlayerGrades
  awards: GradeAward[]
  /** Highest conferred colour per domain. */
  held: Map<number, number>
  /** Event slugs a kaiwhakawā has confirmed this player cannot do. */
  exemptions: Set<string>
  /**
   * False when the player has declared no bodyweight, so their strength events
   * cannot be graded. Reads declarations once 20260922213125 is applied, and
   * the stored band before it.
   */
  hasBand: boolean
  /** False until the grading migration is applied: nothing can be conferred yet. */
  schemaReady: boolean
  /** Official games played: sessions that finished and were not voided, with any result. Caps the overall colour. */
  games: number
  /** What every domain has waiting to be conferred. */
  gates: ColourGate[]
  /** False until the workout migration is applied. */
  workoutsReady: boolean
  /** Disputed games per sport (event name), waiting for a kaiwhakawā to settle. */
  disputed: Map<string, number>
  /** Every evidence read succeeded. The route writes nothing when this is false. */
  complete?: boolean
}

export type ResultRow = {
  raw_score: number | null
  /** As written at the time. Display only (HOME's "Your best"). */
  score_label?: string | null
  weight_kg: number | null
  difficulty_tier: string | null
  session_id: string
  points_earned: number | null
  created_at: string
  session_events: { event_name: string } | null
  sessions: {
    is_active: boolean
    points_awarded_at: string | null
    started_at: string | null
    /** When it closed. Read only by the history replay, to know WHEN a game started counting. */
    ended_at?: string | null
    /**
     * The NZ day the game was played, trigger-derived from started_at at
     * Pacific/Auckland (20260902020602). This is the day a bodyweight
     * declaration is resolved against — never created_at, which is when the
     * row was typed and can be a different day for a late entry.
     */
    session_date?: string | null
  } | null
  /** The band of the day. Absent before 20260921232726. */
  bodyweight_band?: string | null
}

type MatchQueryRow = {
  id: string
  session_id: string
  outcome: MatchRow['outcome']
  created_at: string
  confirmed_at: string | null
  /** Stored on an entry match (a swap); null on a match anchored to a result. */
  event_name?: string | null
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
export async function loadMatches(db: GradeDb): Promise<MatchRow[]> {
  return (await loadMatchesChecked(db)).rows
}

/** loadMatches, saying whether the read failed rather than returning an empty list for it. */
async function loadMatchesChecked(db: GradeDb): Promise<{ rows: MatchRow[]; failed: boolean }> {
  const { data, error } = await db
    .from('matches')
    // event_name is stored on an entry match (a game played as a SWAP), which
    // has no session_events row to read it from. Asked for with a fallback,
    // because a missing COLUMN is 42703 and takes the whole request down.
    .select('id, session_id, outcome, created_at, confirmed_at, event_name, session_events(event_name), match_players(player_id, side)')
    .order('created_at', { ascending: true })
  if (error?.code === '42703') return loadMatchesLegacy(db)
  if (error) return { rows: [], failed: !missing(error) }
  if (!data) return { rows: [], failed: false }
  const rows = (data as unknown as MatchQueryRow[])
    .map(m => ({ ...m, event_name: m.event_name ?? m.session_events?.event_name ?? '' }))
    .filter(m => m.event_name)
    .map(m => ({
      id: m.id, session_id: m.session_id, outcome: m.outcome, created_at: m.created_at,
      confirmed_at: m.confirmed_at, event_name: m.event_name, players: m.match_players ?? [],
    }))
  return { rows, failed: false }
}

/** Before 20260920053207 a match had no event_name of its own. */
async function loadMatchesLegacy(db: GradeDb): Promise<{ rows: MatchRow[]; failed: boolean }> {
  const { data, error } = await db
    .from('matches')
    .select('id, session_id, outcome, created_at, confirmed_at, session_events(event_name), match_players(player_id, side)')
    .order('created_at', { ascending: true })
  if (error) return { rows: [], failed: !missing(error) }
  if (!data) return { rows: [], failed: false }
  const rows = (data as unknown as MatchQueryRow[])
    .filter(m => m.session_events?.event_name)
    .map(m => ({
      id: m.id, session_id: m.session_id, outcome: m.outcome, created_at: m.created_at,
      confirmed_at: m.confirmed_at, event_name: m.session_events!.event_name, players: m.match_players ?? [],
    }))
  return { rows, failed: false }
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
 * inferring a void from missing points.
 *
 * Cached PER CLIENT, not per module. A module-scope memo is "once per page
 * load" in a browser and "once per process lifetime" on a server — so a game
 * voided after the server started would stay invisible to every request until
 * the next deploy. A client is created per page in the browser and per request
 * on the server, so keying on it gives the right lifetime in both.
 */
const recordedVoidsByDb = new WeakMap<GradeDb, Promise<{ set: Set<string> | null; failed: boolean }>>()
function loadRecordedVoids(db: GradeDb): Promise<{ set: Set<string> | null; failed: boolean }> {
  const cached = recordedVoidsByDb.get(db)
  if (cached) return cached
  const pending = Promise.resolve(
    db.from('sessions').select('id').not('voided_at', 'is', null),
  ).then(({ data, error }) => {
    // 42703 = the column is not there yet: the legacy rule is still correct.
    if (error?.code === '42703') return { set: null, failed: false }
    // Any other failure: count every game rather than guess. After the
    // migration the legacy rule would call EVERY finished game voided, which is
    // far worse than counting one rare voided game. Not cached, so the next
    // load asks again.
    if (error || !data) { recordedVoidsByDb.delete(db); return { set: new Set<string>(), failed: true } }
    return { set: new Set((data as { id: string }[]).map(s => s.id)), failed: false }
  })
  recordedVoidsByDb.set(db, pending)
  return pending
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
 * A player's logged entries. `workouts.session_id` (a swap or extra made at a
 * game) arrived after this query did, and a missing COLUMN is 42703, which
 * takes the WHOLE request down rather than returning nulls — so the column is
 * asked for, and the query is re-run without it if the database has not caught
 * up. Any other error is left to the caller, which treats it as no entries.
 */
async function loadWorkoutEntries(db: GradeDb, playerId: string) {
  // score_label has existed since the table did (20260915214702), so it adds
  // no new 42703 risk to this query. Display only; HOME shows it.
  const base = 'event_slug, count, volume_distance_m, raw_score, weight_kg, difficulty_tier, score_label'
  const ask = (cols: string, workoutCols: string) => db.from('workout_entries')
    .select(`${cols}, workouts!inner(${workoutCols})`)
    .eq('workouts.player_id', playerId)
    .range(0, 4999)

  // Two columns here can be missing, from two different migrations, and a
  // missing one takes the WHOLE request down with 42703 rather than returning
  // nulls. Dropped one at a time, newest first, so a database without
  // bodyweight_band does not also lose session_id and start calling every
  // swap made at a game `solo` evidence.
  const w = 'player_id, performed_on, witnessed, created_at'
  const withBand = await ask(`${base}, bodyweight_band`, `${w}, session_id`)
  if (withBand.error?.code !== '42703') return withBand
  const withSession = await ask(base, `${w}, session_id`)
  if (withSession.error?.code !== '42703') return withSession
  return ask(base, w)
}

/**
 * The player's dated bodyweight declarations (20260922213125).
 *
 * Its own query, never folded into another, because a table that does not exist
 * yet returns PGRST205 in `error` and would otherwise take a read the player's
 * whole grade depends on down with it. `live` false means the migration has not
 * run: the caller falls back to the stored bands, which is exactly the
 * behaviour before this. `failed` true means the read ERRORED against a
 * database that does have the table, which must mark the state incomplete — a
 * silent empty would read as "declared nothing", and a kaiwhakawā deleting a
 * score re-judges that domain and would withdraw strength colours on a
 * transient network error.
 */
async function loadBodyweights(db: GradeDb, playerId: string) {
  const { data, error } = await db
    .from('player_bodyweights')
    .select('measured_on, kg, created_at')
    .eq('player_id', playerId)
  if (missing(error)) return { rows: [] as BodyweightDeclaration[], live: false, failed: false }
  if (error) return { rows: [] as BodyweightDeclaration[], live: true, failed: true }
  return { rows: (data ?? []) as unknown as BodyweightDeclaration[], live: true, failed: false }
}

/**
 * The player's current band and the first band they ever set. The first
 * arrived with 20260921232726; a missing COLUMN is 42703 and would cost the
 * current band too, so it is asked for and the query re-run without it.
 */
async function loadBand(db: GradeDb, playerId: string) {
  const both = await db.from('players').select('bodyweight_band, bodyweight_band_first').eq('id', playerId).maybeSingle()
  if (both.error?.code !== '42703') return both
  return db.from('players').select('bodyweight_band').eq('id', playerId).maybeSingle()
}

/**
 * The player's own result rows. `bodyweight_band` arrived after this query did
 * (20260921232726), so it is asked for and the query re-run without it when the
 * database has not caught up — a missing COLUMN is 42703 and would otherwise
 * cost every score the player has.
 */
async function loadResults(db: GradeDb, playerId: string) {
  // score_label is an original results column (never dropped), display only.
  const base = 'raw_score, weight_kg, difficulty_tier, score_label, session_id, points_earned, created_at,'
    + ' session_events(event_name), sessions(is_active, points_awarded_at, started_at, ended_at, session_date)'
  const ask = (cols: string) => db.from('results')
    .select(cols)
    .eq('player_id', playerId)
    .not('raw_score', 'is', null)
    // Well above any one player's lifetime rows; PostgREST caps a response at 1000.
    .range(0, 4999)

  const withBand = await ask(`${base}, bodyweight_band`)
  if (withBand.error?.code !== '42703') return withBand
  return ask(base)
}

/**
 * Everything one player's grades are computed from, as fetched. Split from the
 * computation so the history replay (scripts/replay-colours.ts) can ask "what
 * would this player have held on 3 March?" through the SAME code the app uses,
 * rather than a second copy of the rules that could quietly disagree. See
 * docs/designs/auto-conferral-spec.md, decision 9.
 */
export type GradeInputs = {
  profile: { division: string | null; age_years: number | null; is_active?: boolean | null; is_guest?: boolean | null }
  gender: string | null
  band: string | null
  /** players.bodyweight_band_first. Undefined before 20260921232726. */
  firstBand?: string | null
  /** Dated bodyweight declarations, newest-wins per day. Empty before 20260922213125. */
  bodyweights?: BodyweightDeclaration[]
  /**
   * False until 20260922213125 is applied. While false the stored bands are
   * used instead, so an old database grades exactly as it did before.
   */
  bodyweightsLive?: boolean
  results: ResultRow[]
  entries: WorkoutEntryRow[]
  exemptions: { event_slug: string; created_at: string | null }[]
  awards: GradeAward[]
  matches: readonly MatchRow[]
  voids: Set<string> | null
  /** False until the grading migration is applied: nothing can be conferred yet. */
  schemaReady: boolean
  /** False until the workout migration is applied. */
  workoutsReady: boolean
  /**
   * False when any evidence read FAILED (as opposed to a table that does not
   * exist yet). A screen can still show what it got; the auto-conferral route
   * must not write on it. A failed results read looked like a player with no
   * scores, and a withdrawal would have taken back every colour in the domain.
   */
  complete: boolean
}

/** A table that is not there yet is a known empty, not a failure. */
const missing = (e: { code?: string } | null | undefined) => !!e && (e.code === 'PGRST205' || e.code === '42P01')

/**
 * Fetch one player's grade inputs through `db`. `matches` may be passed in when
 * loading several players, so every match is fetched once. Returns null only
 * if the player cannot be found.
 */
export async function loadGradeInputs(db: GradeDb, playerId: string, matches?: readonly MatchRow[]): Promise<GradeInputs | null> {
  const [profile, gender, band, bodyweights, results, exemptions, awards, workouts, allMatches, voids] = await Promise.all([
    db.from('players_public').select('division, age_years, is_active, is_guest').eq('id', playerId).maybeSingle(),
    db.from('players').select('gender').eq('id', playerId).maybeSingle(),
    loadBand(db, playerId),
    loadBodyweights(db, playerId),
    loadResults(db, playerId),
    db.from('grade_exemptions').select('event_slug, created_at').eq('player_id', playerId),
    db.from('grade_awards').select('id, domain_number, rung, grade_name, conferred_at, conferred_by').eq('player_id', playerId),
    loadWorkoutEntries(db, playerId),
    matches ? Promise.resolve({ rows: matches, failed: false }) : loadMatchesChecked(db),
    loadRecordedVoids(db),
  ])

  if (!profile.data) return null
  return {
    profile: profile.data as { division: string | null; age_years: number | null; is_active?: boolean | null; is_guest?: boolean | null },
    gender: (gender.data as { gender: string | null } | null)?.gender ?? null,
    band: band.error ? null : (band.data as { bodyweight_band: string | null } | null)?.bodyweight_band ?? null,
    firstBand: band.error ? undefined
      : (band.data as { bodyweight_band_first?: string | null } | null)?.bodyweight_band_first,
    bodyweights: bodyweights.rows,
    bodyweightsLive: bodyweights.live,
    results: (results.data ?? []) as unknown as ResultRow[],
    entries: workouts.error ? [] : (workouts.data ?? []) as unknown as WorkoutEntryRow[],
    exemptions: exemptions.error ? [] : (exemptions.data ?? []) as { event_slug: string; created_at: string | null }[],
    awards: awards.error ? [] : (awards.data ?? []) as GradeAward[],
    matches: allMatches.rows,
    voids: voids.set,
    schemaReady: !awards.error,
    workoutsReady: !workouts.error,
    complete: !results.error && !allMatches.failed && !voids.failed && !bodyweights.failed
      && (!workouts.error || missing(workouts.error))
      && (!exemptions.error || missing(exemptions.error))
      && (!awards.error || missing(awards.error))
      && (!gender.error && !band.error),
  }
}

/** A game's length, for a session that closed without recording when. */
const GAME_MS = GAME_MINUTES * 60 * 1000

/** When a result's game stopped being in progress: recorded, or started + 100 minutes. */
export function closedAt(r: ResultRow): string | null {
  if (!r.sessions) return null
  if (r.sessions.ended_at) return r.sessions.ended_at
  const start = r.sessions.started_at ?? r.created_at
  return new Date(new Date(start).getTime() + GAME_MS).toISOString()
}

/**
 * A player's grade state from inputs already fetched.
 *
 * With no options this is exactly what the app shows today. `asOf` answers the
 * replay's question instead — what could this player have been graded on at
 * that moment? — by dropping every piece of evidence that did not exist yet,
 * and counting a game as finished only once it had actually closed. `awards`
 * substitutes the awards the replay has conferred so far for the stored ones.
 */
export function gradeStateFrom(
  playerId: string,
  inputs: GradeInputs,
  opts: { asOf?: string; awards?: GradeAward[] } = {},
): GradeState {
  const { asOf } = opts
  // Compared as instants, never as strings. Postgres hands back
  // "…04:05:06.123456+00:00" and JavaScript writes "…04:05:06.123Z"; comparing
  // those lexically is right only by luck of the character codes.
  const asOfMs = asOf ? Date.parse(asOf) : null
  const upTo = (t: string | null | undefined) => asOfMs == null || (t != null && Date.parse(t) <= asOfMs)

  const awardRows = opts.awards ?? inputs.awards
  const exempt = new Set(inputs.exemptions.filter(e => upTo(e.created_at)).map(e => e.event_slug))

  // Declarations the player had made by `asOf`. Filtered on created_at (when
  // the row was written), never measured_on (the day it describes), or a
  // kaiwhakawā's later correction of an old weigh-in would appear to have
  // existed at the time.
  const all = inputs.bodyweights ?? []
  const declared = asOfMs == null ? all : all.filter(b => upTo(b.created_at ?? null))

  /**
   * The bodyweight a row is graded against.
   *
   * Once 20260922213125 is applied, declarations are the only source. Before
   * it, the stored bands stand in, which is exactly the behaviour that shipped
   * with 20260921232726: the row's own band, else the first band the player
   * ever set, else their current one.
   */
  const kgOn = (day: string | null | undefined, legacyBand: string | null | undefined) =>
    inputs.bodyweightsLive
      ? bodyweightOn(declared, day)
      : bandMidpointKg(legacyBand ?? inputs.firstBand ?? inputs.band)

  const results = inputs.results.filter(r => upTo(r.sessions?.started_at ?? r.created_at))
  const counted = countedRows(results, inputs.voids)
  const game = gameEvidence(counted.map(r => ({
    session_id: r.session_id,
    event_name: r.session_events!.event_name,
    raw_score: r.raw_score, weight_kg: r.weight_kg, difficulty_tier: r.difficulty_tier,
    score_label: r.score_label ?? null,
    // Live: whatever the session says now. Replay: closed only if it had
    // closed BY THEN — a game in progress is not yet a game (gameEvidence).
    closed: !r.sessions ? true : asOf ? (!r.sessions.is_active && upTo(closedAt(r))) : !r.sessions.is_active,
    // The NZ day the game was played. session_date is trigger-derived from
    // started_at (20260902020602); created_at is when the score was typed,
    // which for a late entry is a different day.
    bodyweightKg: kgOn(
      r.sessions?.session_date ?? toNZDateString(new Date(r.sessions?.started_at ?? r.created_at)),
      r.bodyweight_band,
    ),
  })))
  const logged = workoutEvidence(inputs.entries.filter(e => upTo(e.workouts?.created_at)).map(e => ({
    ...e,
    // performed_on is the day it was TRAINED, which is what a bodyweight
    // describes. Backdating up to 7 days is allowed, so this is observable.
    bodyweightKg: kgOn(e.workouts?.performed_on, e.bodyweight_band),
  })))
  const matches = asOfMs == null ? inputs.matches : inputs.matches.filter(m => upTo(m.created_at))

  const grades = computePlayerGrades({
    player: {
      division: inputs.profile.division,
      ageYears: inputs.profile.age_years,
      gender: inputs.gender,
    },
    results: [...game.rows, ...logged.rows],
    ratings: ratingsFor(playerId, matches),
    exemptions: exempt,
    games: game.games,
  })

  const held = heldRungs(awardRows)
  const games = game.games

  return {
    active: inputs.profile.is_active !== false,
    guest: inputs.profile.is_guest === true,
    grades, awards: awardRows, held, exemptions: exempt,
    hasBand: inputs.bodyweightsLive ? (inputs.bodyweights ?? []).length > 0 : inputs.band != null,
    schemaReady: inputs.schemaReady,
    games,
    gates: colourGates(grades.domains, held),
    workoutsReady: inputs.workoutsReady,
    complete: inputs.complete,
    disputed: disputedBySport(matches, playerId),
  }
}

/**
 * One player's grades and conferred colours, read through `db`. `matches` may
 * be passed in when loading several players, so every match is fetched once.
 * Returns null only if the player cannot be found.
 */
export async function loadGradeState(db: GradeDb, playerId: string, matches?: readonly MatchRow[]): Promise<GradeState | null> {
  const inputs = await loadGradeInputs(db, playerId, matches)
  return inputs && gradeStateFrom(playerId, inputs)
}
