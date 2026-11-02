// ─── Loading a player's place in the whole game ──────────────────────────────
// Reads every published colour total for one game and who may hold a place,
// then ranks through placeInGame (lib/gameReport.ts). Both reads are public.
//
// Null when the table is not there yet (PGRST205: 20260928011813 not applied),
// the read fails, or the player has no published total. The screen then shows no
// place: a game's only place is on colour score.

import type { SupabaseClient } from '@supabase/supabase-js'
import { gameBoard, placeInGame, type BoardPlace, type GamePlace } from './gameReport'

export async function loadGamePlace(db: SupabaseClient, sessionId: string, playerId: string): Promise<GamePlace | null> {
  const { data, error } = await db
    .from('player_game_colours')
    .select('player_id, colour_total')
    .eq('session_id', sessionId)
  if (error || !data || data.length === 0) return null
  const rows = data as { player_id: string; colour_total: number }[]
  const { data: people, error: pErr } = await db
    .from('players_public')
    .select('id, is_active, is_guest')
    .in('id', rows.map(r => r.player_id))
  if (pErr || !people) return null
  const ok = new Set((people as { id: string; is_active: boolean | null; is_guest: boolean | null }[])
    .filter(p => p.is_active !== false && p.is_guest !== true).map(p => p.id))
  return placeInGame(rows, id => ok.has(id), playerId)
}

type TotalRow = { player_id: string; session_id: string; colour_total: number }

/** Who may hold a place: not an erased profile, not a guest. Null if the read fails. */
async function eligiblePlayers(db: SupabaseClient, ids: readonly string[]): Promise<Set<string> | null> {
  const { data, error } = await db.from('players_public').select('id, is_active, is_guest').in('id', [...new Set(ids)])
  if (error || !data) return null
  return new Set((data as { id: string; is_active: boolean | null; is_guest: boolean | null }[])
    .filter(p => p.is_active !== false && p.is_guest !== true).map(p => p.id))
}

/** Everyone's place in one game, best first. Null when there is nothing to rank yet. */
export async function loadGameBoard(db: SupabaseClient, sessionId: string): Promise<BoardPlace[] | null> {
  const { data, error } = await db.from('player_game_colours').select('player_id, colour_total').eq('session_id', sessionId)
  if (error || !data || data.length === 0) return null
  const rows = data as { player_id: string; colour_total: number }[]
  const ok = await eligiblePlayers(db, rows.map(r => r.player_id))
  return ok && gameBoard(rows, id => ok.has(id))
}

/** A short list of ids at a time: a game holds under 100 totals, and a read is capped at 1,000. */
const SESSIONS_PER_READ = 10

/**
 * One player's place in every game they have a published total in, by session.
 * Empty when the read fails, so a history shows no places rather than wrong ones.
 */
export async function loadMyGamePlaces(db: SupabaseClient, playerId: string): Promise<Map<string, GamePlace>> {
  const out = new Map<string, GamePlace>()
  const { data: mine, error } = await db.from('player_game_colours').select('session_id').eq('player_id', playerId)
  if (error || !mine) return out
  const ids = (mine as { session_id: string }[]).map(r => r.session_id)
  const rows: TotalRow[] = []
  for (let i = 0; i < ids.length; i += SESSIONS_PER_READ) {
    const { data, error: readErr } = await db.from('player_game_colours')
      .select('player_id, session_id, colour_total').in('session_id', ids.slice(i, i + SESSIONS_PER_READ))
    if (readErr || !data) return out
    rows.push(...(data as TotalRow[]))
  }
  const ok = await eligiblePlayers(db, rows.map(r => r.player_id))
  if (!ok) return out
  for (const id of ids) {
    const place = placeInGame(rows.filter(r => r.session_id === id), p => ok.has(p), playerId)
    if (place) out.set(id, place)
  }
  return out
}
