// ─── Bookings: reads and writes ──────────────────────────────────────────────
// The Supabase half of lib/bookings.ts. Takes its client as an argument.
//
// Code ships before 20261123214052 is applied (CLAUDE.md §12), so every read
// and write falls back to the away dates (weekly_game_absences) while
// game_bookings and set_booking are missing: "Not this time" is an away date,
// and a Yes simply clears one. `live` says which the board is showing, so the
// card does not offer a Yes it cannot keep.

import type { SupabaseClient } from '@supabase/supabase-js'
import { answerKey, countsKey, type Answer, type BookingCounts } from '@/lib/bookings'
type PgError = { code?: string; message?: string } | null | undefined

/** Table, column or function not there yet (as notLive in lib/weeklyGamesData.ts, plus a missing RPC). */
const missing = (e: PgError) => !!e && ['PGRST205', '42P01', '42703', 'PGRST204', 'PGRST202', '42883'].includes(e.code ?? '')

export type LoadedAnswers = { live: boolean; answers: Map<string, Answer> }

/** Answers from `from` onwards for these players (yourself and your children; RLS). */
export async function loadAnswers(
  supabase: SupabaseClient, playerIds: string[], from: string,
): Promise<LoadedAnswers> {
  const answers = new Map<string, Answer>()
  if (playerIds.length === 0) return { live: true, answers }
  const res = await supabase.from('game_bookings')
    .select('weekly_game_id, game_date, player_id, answer').in('player_id', playerIds).gte('game_date', from)
  if (!res.error) {
    for (const r of (res.data ?? []) as { weekly_game_id: string; game_date: string; player_id: string; answer: Answer }[]) {
      answers.set(answerKey(r.weekly_game_id, r.game_date, r.player_id), r.answer)
    }
    return { live: true, answers }
  }
  if (!missing(res.error)) console.warn('bookings unavailable', res.error.message)
  const old = await supabase.from('weekly_game_absences')
    .select('weekly_game_id, game_date, player_id').in('player_id', playerIds).gte('game_date', from)
  for (const r of (old.data ?? []) as { weekly_game_id: string; game_date: string; player_id: string }[]) {
    answers.set(answerKey(r.weekly_game_id, r.game_date, r.player_id), 'no')
  }
  return { live: false, answers }
}

/** Counts for these (game, date) pairs, at most 50. Null when not live or not readable. */
export async function loadCounts(
  supabase: SupabaseClient, pairs: { gameId: string; date: string }[],
): Promise<Map<string, BookingCounts> | null> {
  const out = new Map<string, BookingCounts>()
  if (pairs.length === 0) return out
  const some = pairs.slice(0, 50)
  const { data, error } = await supabase.rpc('booking_counts', {
    p_game_ids: some.map(p => p.gameId), p_dates: some.map(p => p.date),
  })
  if (error) {
    if (!missing(error)) console.warn('booking counts unavailable', error.message)
    return null
  }
  for (const r of (data ?? []) as { weekly_game_id: string; game_date: string; coming: number; not_coming: number; unanswered: number }[]) {
    out.set(countsKey(r.weekly_game_id, r.game_date), { coming: r.coming, notComing: r.not_coming, unanswered: r.unanswered })
  }
  return out
}

/** Answer for a player (yourself or your child); null takes it back. */
export async function setBooking(
  supabase: SupabaseClient, gameId: string, date: string, playerId: string, answer: Answer | null,
): Promise<string | null> {
  const { error } = await supabase.rpc('set_booking', {
    p_game_id: gameId, p_date: date, p_player_id: playerId, p_answer: answer,
  })
  if (!error) return null
  if (!missing(error)) return error.message.replace(/^bookings: /, '')
  // Not live yet: the away dates. "No" is away; Yes and taking it back clear it.
  const { error: e2 } = answer === 'no'
    ? await supabase.from('weekly_game_absences').insert({ weekly_game_id: gameId, player_id: playerId, game_date: date })
    : await supabase.from('weekly_game_absences').delete()
      .eq('weekly_game_id', gameId).eq('player_id', playerId).eq('game_date', date)
  if (e2 && e2.code === '23505') return null
  return e2?.message ?? null
}

export type ComingPlayer = { id: string; name: string }

/**
 * Who said Yes for this game and date, by name, for the Kaiārahi running it
 * (RLS shows nobody else other people's answers). Null when not live.
 */
export async function loadComing(
  supabase: SupabaseClient, gameId: string, date: string,
): Promise<{ coming: ComingPlayer[]; notComing: number } | null> {
  const { data, error } = await supabase.from('game_bookings')
    .select('player_id, answer').eq('weekly_game_id', gameId).eq('game_date', date)
  if (error) return null
  const rows = (data ?? []) as { player_id: string; answer: Answer }[]
  const yes = rows.filter(r => r.answer === 'yes').map(r => r.player_id)
  const names = new Map<string, string>()
  if (yes.length > 0) {
    const { data: ps } = await supabase.from('players_public').select('id, display_name, username').in('id', yes)
    for (const p of (ps ?? []) as { id: string; display_name: string | null; username: string | null }[]) {
      names.set(p.id, p.display_name || p.username || 'Player')
    }
  }
  return {
    coming: yes.map(id => ({ id, name: names.get(id) ?? 'Player' })).sort((a, b) => a.name.localeCompare(b.name)),
    notComing: rows.filter(r => r.answer === 'no').length,
  }
}
