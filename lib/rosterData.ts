// Reads and writes for the roster. Rules in lib/roster.ts.
//
// game_roster and its functions arrive with 20261123202226_roster_and_cover.sql,
// applied after the code deploys (CLAUDE.md §12): a missing table or function
// reads as "not live yet" (null), never as an error.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RosterRow } from '@/lib/roster'
import type { KaiarahiLevel } from '@/lib/kaiarahi'

const NOT_LIVE = new Set(['PGRST205', '42P01', 'PGRST202', '42883'])
const notLive = (e: { code?: string } | null | undefined) => !!e && NOT_LIVE.has(e.code ?? '')

/** Roster rows between two dates. Null when not live; [] when unreadable (not a Kaiārahi). */
export async function loadRoster(supabase: SupabaseClient, from: string, to: string): Promise<RosterRow[] | null> {
  const { data, error } = await supabase.from('game_roster')
    .select('id, weekly_game_id, game_date, role, player_id, helper_name, status, claimed_by, claimed_at, note')
    .gte('game_date', from).lte('game_date', to)
  if (error) return notLive(error) ? null : []
  return (data ?? []) as RosterRow[]
}

export type DirectoryRow = { player_id: string; display_name: string; level: KaiarahiLevel; funded_ok: boolean }

/** Every current Kaiārahi by player name and level, for the pickers. Null when not live. */
export async function loadDirectory(supabase: SupabaseClient): Promise<DirectoryRow[] | null> {
  const { data, error } = await supabase.rpc('kaiarahi_directory')
  if (error) return notLive(error) ? null : []
  return (data ?? []) as DirectoryRow[]
}

/** The database's words are written for people already; strip the prefix. */
const say = (e: { message?: string } | null) => e?.message?.replace(/^roster: /, '') ?? null

export async function setRegular(supabase: SupabaseClient, gameId: string, playerId: string | null): Promise<string | null> {
  const { error } = await supabase.rpc('set_regular_kaiarahi', { p_game_id: gameId, p_player_id: playerId })
  return say(error)
}

export async function requestCover(supabase: SupabaseClient, gameId: string, date: string, note: string): Promise<string | null> {
  const { error } = await supabase.rpc('request_cover', { p_game_id: gameId, p_date: date, p_note: note || null })
  return say(error)
}

export async function claimCover(supabase: SupabaseClient, gameId: string, date: string): Promise<string | null> {
  const { error } = await supabase.rpc('claim_cover', { p_game_id: gameId, p_date: date })
  return say(error)
}

export async function releaseCover(supabase: SupabaseClient, gameId: string, date: string): Promise<string | null> {
  const { error } = await supabase.rpc('release_cover', { p_game_id: gameId, p_date: date })
  return say(error)
}

export async function rosterLead(supabase: SupabaseClient, gameId: string, date: string, playerId: string): Promise<string | null> {
  const { error } = await supabase.rpc('roster_lead', { p_game_id: gameId, p_date: date, p_player_id: playerId })
  return say(error)
}

/** Record the second adult for a game and date (20261123205536). */
export async function setSecondAdult(
  supabase: SupabaseClient, gameId: string, date: string,
  second: { playerId?: string | null; helperName?: string | null; helperAdult?: boolean },
): Promise<string | null> {
  const { error } = await supabase.rpc('set_second_adult', {
    p_game_id: gameId, p_date: date, p_player_id: second.playerId ?? null,
    p_helper_name: second.helperName ?? null, p_helper_adult: !!second.helperAdult,
  })
  // Before 20261123205536 there is nothing to record and no rule to meet.
  if (notLive(error)) return null
  return say(error)
}
