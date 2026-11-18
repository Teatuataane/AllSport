// ─── Reading and writing the leaderboard's published numbers ────────────────
// One place for both, so the recheck route and the backfill script cannot
// write them differently, and so the page's read is testable outside a
// 'use client' file. Takes the client as an argument and never imports one:
// the writes run with the service key (app/api/grades/recheck/route.ts,
// scripts/refresh-leaderboard-scores.ts), the read with the visitor's.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameColours } from './leaderboardScores'
import type { SeasonGame, GameColourRow } from './seasonColourBoard'
// Type only: lib/eventRecords.ts imports the whole roster.
import type { RecordResultRow } from './eventRecords'

export type PublishedScores = { domainRungs: number[]; games: GameColours[] }

/**
 * Publish a player's domain colours and their colour total in every finished
 * game, then remove the games they no longer have a result in (every score
 * deleted, or the game voided), or they would keep a place in them. Only call
 * this on a COMPLETE read of the player's evidence: a game missing from
 * `scores.games` is deleted.
 *
 * The stale games are found by reading what is stored and deleting the
 * difference by id, rather than "everything not in this list": that list is
 * every game the player has ever played, and it would grow past what a URL
 * can carry.
 *
 * `readFrom` is when this request began reading the evidence. Only rows
 * written before it are deleted: two rechecks of one player overlap at every
 * game end (their own screen and the kaiwhakawā's), and an older read that
 * never saw a game must not delete the total a newer one just wrote.
 */
export async function publishLeaderboardScores(
  db: SupabaseClient,
  playerId: string,
  scores: PublishedScores,
  readFrom: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString()
  const [domains, games] = await Promise.all([
    db.from('player_domain_colours').upsert(
      { player_id: playerId, domain_rungs: scores.domainRungs, updated_at: now },
      { onConflict: 'player_id' },
    ),
    scores.games.length === 0 ? { error: null } : db.from('player_game_colours').upsert(
      scores.games.map(g => ({ player_id: playerId, session_id: g.session_id, colour_total: g.total, updated_at: now })),
      { onConflict: 'player_id,session_id' },
    ),
  ])
  const failed = domains.error ?? games.error
  // Never delete after a failed write: the stored rows are all that is left.
  if (failed) return { error: failed.message }

  const stored = await db.from('player_game_colours').select('session_id').eq('player_id', playerId)
  if (stored.error) return { error: stored.error.message }
  const keep = new Set(scores.games.map(g => g.session_id))
  const stale = ((stored.data ?? []) as { session_id: string }[])
    .map(r => r.session_id).filter(id => !keep.has(id))
  if (stale.length === 0) return { error: null }
  const removed = await db.from('player_game_colours').delete()
    .eq('player_id', playerId).in('session_id', stale).lt('updated_at', readFrom)
  return { error: removed.error?.message ?? null }
}

export type SeasonPointsRow = { player_id: string; points: number; games: number }

/**
 * This season's points, by place in each game (the season_points view,
 * 20260928011813). An error is reported, so the page can say so rather than
 * show an empty season.
 */
export async function loadSeasonPoints(
  db: SupabaseClient,
  year: number,
): Promise<{ rows: SeasonPointsRow[]; failed: boolean }> {
  const { data, error } = await db.from('season_points').select('player_id, points, games').eq('season_year', year)
  return { rows: (data ?? []) as SeasonPointsRow[], failed: !!error }
}

// ─── Colour score board and event records (Tāne, 18 Nov 2026) ────────────────
// The board ranks on colour score (lib/seasonColourBoard.ts) and lists the
// season's best score per event and division (lib/eventRecords.ts). Both read
// the year's games first and then only those games' rows, so a page load reads
// one season, never every season.

const ROW_PAGE = 1000
/** A backstop far above a season: 150 games of 100 players is 15 pages. */
const MAX_ROW_PAGES = 50

/** The year's finished, unvoided official games. Null when the read failed. */
export async function loadSeasonGames(db: SupabaseClient, year: number): Promise<SeasonGame[] | null> {
  const { data, error } = await db.from('sessions').select('id, started_at, session_date')
    .gte('session_date', `${year}-01-01`).lte('session_date', `${year}-12-31`)
    .eq('is_active', false).is('voided_at', null)
  return error ? null : (data ?? []) as SeasonGame[]
}

/**
 * Every published colour total in those games. PAGED: PostgREST caps a
 * response at 1000 rows, and a season passes that. The table's rows only
 * change when a recheck republishes a closed game, so offset pages are safe.
 * Null when any page failed: a partial season would rank players wrongly.
 */
export async function loadGameColours(db: SupabaseClient, sessionIds: readonly string[]): Promise<GameColourRow[] | null> {
  if (sessionIds.length === 0) return []
  const out: GameColourRow[] = []
  for (let page = 0; page < MAX_ROW_PAGES; page++) {
    const { data, error } = await db.from('player_game_colours').select('player_id, session_id, colour_total')
      .in('session_id', [...sessionIds])
      .order('session_id').order('player_id')
      .range(page * ROW_PAGE, (page + 1) * ROW_PAGE - 1)
    if (error) return null
    const got = (data ?? []) as GameColourRow[]
    out.push(...got.map(r => ({ ...r, colour_total: Number(r.colour_total) })))
    if (got.length < ROW_PAGE) return out
  }
  return null
}

type ResultWithEvent = {
  id: string
  player_id: string | null
  session_id: string
  raw_score: number | string | null
  difficulty_tier: string | null
  session_events: { event_slug: string | null; event_name: string | null } | null
}

/**
 * Every scored result in those games, with its event, for the season's
 * records. KEYSET paged on id, like loadGameCounts. Null when any page failed.
 */
export async function loadSeasonResults(db: SupabaseClient, games: readonly SeasonGame[]): Promise<RecordResultRow[] | null> {
  if (games.length === 0) return []
  const startedAt = new Map(games.map(g => [g.id, g.started_at ?? g.session_date]))
  const out: RecordResultRow[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_ROW_PAGES; page++) {
    let q = db.from('results')
      .select('id, player_id, session_id, raw_score, difficulty_tier, session_events(event_slug, event_name)')
      .in('session_id', games.map(g => g.id))
      .not('raw_score', 'is', null)
    if (after) q = q.gt('id', after)
    const { data, error } = await q.order('id', { ascending: true }).limit(ROW_PAGE)
    if (error) return null
    const got = (data ?? []) as unknown as ResultWithEvent[]
    for (const r of got) {
      out.push({
        player_id: r.player_id,
        raw_score: r.raw_score,
        difficulty_tier: r.difficulty_tier,
        event_slug: r.session_events?.event_slug ?? null,
        event_name: r.session_events?.event_name ?? null,
        at: startedAt.get(r.session_id) ?? null,
      })
    }
    if (got.length < ROW_PAGE) return out
    after = got[got.length - 1].id
  }
  return null
}
