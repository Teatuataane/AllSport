// ─── Reading and writing the leaderboard's published numbers ────────────────
// One place for both, so the recheck route and the backfill script cannot
// write them differently, and so the page's read is testable outside a
// 'use client' file. Takes the client as an argument and never imports one:
// the writes run with the service key (app/api/grades/recheck/route.ts,
// scripts/refresh-leaderboard-scores.ts), the read with the visitor's.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameColours } from './leaderboardScores'

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
