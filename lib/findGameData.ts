// ─── Find a game: reads ──────────────────────────────────────────────────────
// The Supabase half of lib/findGame.ts. Takes its client as an argument.
//
// Logged out: the weekly board alone (sites, games, notices). Since
// 20261123234843 `anon` reads listed games only; findCards filters unlisted
// ones anyway, so the page is right before the migration too.
// Signed in: the same board with registrations, answers and counts, plus who
// leads each date (game_leads) and their names from players_public.
//
// One read per page load; no polling (CLAUDE.md §4).

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadWeeklyBoard, type WeeklyBoard } from '@/lib/weeklyGamesData'
import { countsKey } from '@/lib/bookings'
import { nextGameDate } from '@/lib/weeklyGames'

export type Lead = { id: string; name: string }

export type FindBoard = {
  board: WeeklyBoard
  /** By countsKey(game, date): who leads that date. Absent = not known or cover needed. */
  leads: Map<string, Lead>
}

export async function loadFindBoard(
  supabase: SupabaseClient, playerId: string | null, now: Date = new Date(),
): Promise<FindBoard | null> {
  const board = await loadWeeklyBoard(supabase, playerId, now)
  if (!board) return null
  const leads = new Map<string, Lead>()
  if (!playerId || board.games.length === 0) return { board, leads }

  const pairs = board.games.filter(g => g.listed !== false || board.mine.has(g.id)).slice(0, 50)
    .map(g => ({ gameId: g.id, date: nextGameDate(g, now) }))
  const { data, error } = await supabase.rpc('game_leads', {
    p_game_ids: pairs.map(p => p.gameId), p_dates: pairs.map(p => p.date),
  })
  // Not live yet, or refused: the cards simply show no Kaiārahi.
  if (error) return { board, leads }
  const rows = (data ?? []) as { weekly_game_id: string; game_date: string; lead_id: string | null }[]
  const ids = [...new Set(rows.map(r => r.lead_id).filter((x): x is string => !!x))]
  if (ids.length === 0) return { board, leads }
  const people = await supabase.from('players_public').select('id, display_name, username').in('id', ids)
  const names = new Map<string, string>()
  for (const p of (people.data ?? []) as { id: string; display_name: string | null; username: string | null }[]) {
    names.set(p.id, p.display_name?.trim() || p.username?.trim() || 'Kaiārahi')
  }
  for (const r of rows) {
    if (r.lead_id) leads.set(countsKey(r.weekly_game_id, r.game_date), { id: r.lead_id, name: names.get(r.lead_id) ?? 'Kaiārahi' })
  }
  return { board, leads }
}
