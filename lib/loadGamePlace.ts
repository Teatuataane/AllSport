// ─── Loading a player's place in the whole game ──────────────────────────────
// Reads every published colour total for one game and who may hold a place,
// then ranks through placeInGame (lib/gameReport.ts). Both reads are public.
//
// Null when the table is not there yet (PGRST205: 20260928011813 not applied),
// the read fails, or the player has no published total. The report then leads
// with the division place alone, which is what it showed before.

import type { SupabaseClient } from '@supabase/supabase-js'
import { placeInGame, type GamePlace } from './gameReport'

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
