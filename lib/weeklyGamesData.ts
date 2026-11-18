// ─── Weekly games: reads and writes ──────────────────────────────────────────
// The Supabase half of lib/weeklyGames.ts. Takes its client as an argument, as
// lib/training.ts does. Every read is its own query, and a missing table or
// column (migration 20261118010039 not applied yet) reads as "not live": the
// loaders return null and HOME falls back to the fixed schedule line.
//
// Read once per page load. No polling and no Realtime: a rain call is read
// when the player opens HOME (phase 2 pushes it to them), and the Nano compute
// has no budget for a poll on every HOME tab (CLAUDE.md §4).

import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, nextGameDate, nzWallClock, type GameNotice, type Site, type WeeklyGame } from '@/lib/weeklyGames'

type PgError = { code?: string; message?: string } | null | undefined

/** Table or column not there yet. */
export const notLive = (e: PgError) =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01' || e.code === '42703' || e.code === 'PGRST204')

export type WeeklyBoard = {
  sites: Site[]
  games: WeeklyGame[]
  /** Notices for today onwards (a fortnight is plenty for "next date"). */
  notices: GameNotice[]
  /** Weekly game ids the player is registered to. */
  mine: Set<string>
  /** `${gameId}|${date}` the player said they will miss. */
  away: Set<string>
}

export const awayKey = (gameId: string, date: string) => `${gameId}|${date}`

/**
 * Sites, active weekly games, upcoming notices and (with a player) their
 * registrations and absences. Null when the tables are not live, or when the
 * timetable itself fails to load.
 */
export async function loadWeeklyBoard(
  supabase: SupabaseClient, playerId: string | null, now: Date = new Date(),
): Promise<WeeklyBoard | null> {
  const today = nzWallClock(now).date
  const [sitesRes, gamesRes, noticesRes] = await Promise.all([
    supabase.from('sites').select('id, name, address, map_url, is_active').eq('is_active', true),
    supabase.from('weekly_games').select('id, site_id, dow, start_time, is_active').eq('is_active', true),
    supabase.from('game_notices')
      .select('id, weekly_game_id, game_date, kind, message, created_at')
      .gte('game_date', today).lte('game_date', addDays(today, 14)),
  ])
  if (sitesRes.error || gamesRes.error) {
    if (!notLive(sitesRes.error) && !notLive(gamesRes.error)) {
      console.warn('weekly games unavailable', sitesRes.error?.message ?? gamesRes.error?.message)
    }
    return null
  }
  const sites = (sitesRes.data ?? []) as Site[]
  const siteIds = new Set(sites.map(s => s.id))
  const games = ((gamesRes.data ?? []) as WeeklyGame[]).filter(g => siteIds.has(g.site_id))
  // A failed notices read still shows the timetable; it just shows no news.
  const notices = noticesRes.error ? [] : (noticesRes.data ?? []) as GameNotice[]

  const mine = new Set<string>()
  const away = new Set<string>()
  if (playerId) {
    const [memRes, awayRes] = await Promise.all([
      supabase.from('weekly_game_members').select('weekly_game_id').eq('player_id', playerId).is('left_at', null),
      supabase.from('weekly_game_absences').select('weekly_game_id, game_date').eq('player_id', playerId).gte('game_date', today),
    ])
    for (const r of (memRes.data ?? []) as { weekly_game_id: string }[]) mine.add(r.weekly_game_id)
    for (const r of (awayRes.data ?? []) as { weekly_game_id: string; game_date: string }[]) {
      away.add(awayKey(r.weekly_game_id, r.game_date))
    }
  }
  return { sites, games, notices, mine, away }
}

/** Register (or re-register: clears left_at). */
export async function joinWeeklyGame(
  supabase: SupabaseClient, gameId: string, playerId: string, via: 'home' | 'game' = 'home',
): Promise<string | null> {
  // Update first so a returning player keeps their first joined_at and how they
  // first came; insert only when there is no row.
  const { data, error } = await supabase.from('weekly_game_members')
    .update({ left_at: null })
    .eq('weekly_game_id', gameId).eq('player_id', playerId)
    .select('weekly_game_id')
  if (error) return error.message
  if (data && data.length > 0) return null
  const ins = await supabase.from('weekly_game_members')
    .insert({ weekly_game_id: gameId, player_id: playerId, joined_via: via })
  return ins.error?.message ?? null
}

/** Leave: stamps left_at, keeps the row. */
export async function leaveWeeklyGame(supabase: SupabaseClient, gameId: string, playerId: string): Promise<string | null> {
  const { error } = await supabase.from('weekly_game_members')
    .update({ left_at: new Date().toISOString() })
    .eq('weekly_game_id', gameId).eq('player_id', playerId)
  return error?.message ?? null
}

/** "Can't make it" for one date, or take it back. */
export async function setAway(
  supabase: SupabaseClient, gameId: string, playerId: string, date: string, away: boolean,
): Promise<string | null> {
  const { error } = away
    ? await supabase.from('weekly_game_absences').insert({ weekly_game_id: gameId, player_id: playerId, game_date: date })
    : await supabase.from('weekly_game_absences').delete()
      .eq('weekly_game_id', gameId).eq('player_id', playerId).eq('game_date', date)
  // Tapping twice on a slow phone inserts a duplicate; that is already done.
  if (error && error.code === '23505') return null
  return error?.message ?? null
}

/** Is this player registered to this weekly game? Null when not live. */
export async function isRegistered(supabase: SupabaseClient, gameId: string, playerId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('weekly_game_members')
    .select('weekly_game_id').eq('weekly_game_id', gameId).eq('player_id', playerId).is('left_at', null)
  if (error) return null
  return (data ?? []).length > 0
}

/** One weekly game with its site, for the walk-up offer. */
export async function loadWeeklyGame(
  supabase: SupabaseClient, gameId: string,
): Promise<{ game: WeeklyGame; site: Site } | null> {
  const g = await supabase.from('weekly_games').select('id, site_id, dow, start_time, is_active').eq('id', gameId).maybeSingle()
  if (g.error || !g.data) return null
  const s = await supabase.from('sites').select('id, name, address, map_url, is_active').eq('id', g.data.site_id).maybeSingle()
  if (s.error || !s.data) return null
  return { game: g.data as WeeklyGame, site: s.data as Site }
}

// ── Kaiwhakawā ───────────────────────────────────────────────────────────────

export type RosterRow = { player_id: string; name: string; away: boolean }

/**
 * Who is registered to each weekly game, with names from players_public and
 * whether they said they will miss the game's next date. RLS lets only a
 * kaiwhakawā read other players' rows.
 */
export async function loadRosters(
  supabase: SupabaseClient, games: WeeklyGame[], now: Date = new Date(),
): Promise<Map<string, RosterRow[]>> {
  const out = new Map<string, RosterRow[]>()
  if (games.length === 0) return out
  const ids = games.map(g => g.id)
  const today = nzWallClock(now).date
  const [memRes, awayRes] = await Promise.all([
    supabase.from('weekly_game_members').select('weekly_game_id, player_id').in('weekly_game_id', ids).is('left_at', null),
    supabase.from('weekly_game_absences').select('weekly_game_id, player_id, game_date').in('weekly_game_id', ids).gte('game_date', today),
  ])
  const members = (memRes.data ?? []) as { weekly_game_id: string; player_id: string }[]
  const playerIds = [...new Set(members.map(m => m.player_id))]
  const names = new Map<string, string>()
  if (playerIds.length > 0) {
    const { data } = await supabase.from('players_public')
      .select('id, display_name, username').in('id', playerIds)
    for (const p of (data ?? []) as { id: string; display_name: string | null; username: string | null }[]) {
      names.set(p.id, p.display_name || p.username || 'Player')
    }
  }
  const away = new Set(((awayRes.data ?? []) as { weekly_game_id: string; player_id: string; game_date: string }[])
    .map(a => `${a.weekly_game_id}|${a.player_id}|${a.game_date}`))
  const nextDate = new Map(games.map(g => [g.id, nextGameDate(g, now)]))
  for (const m of members) {
    const list = out.get(m.weekly_game_id) ?? []
    list.push({
      player_id: m.player_id,
      name: names.get(m.player_id) ?? 'Player',
      away: away.has(`${m.weekly_game_id}|${m.player_id}|${nextDate.get(m.weekly_game_id)}`),
    })
    out.set(m.weekly_game_id, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

export async function postNotice(
  supabase: SupabaseClient, gameId: string, date: string, kind: GameNotice['kind'], message: string | null, judgeId: string,
): Promise<string | null> {
  const { error } = await supabase.from('game_notices').insert({
    weekly_game_id: gameId, game_date: date, kind,
    message: message?.trim() ? message.trim() : null,
    created_by: judgeId,
  })
  return error?.message ?? null
}

export async function deleteNotice(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await supabase.from('game_notices').delete().eq('id', id)
  return error?.message ?? null
}
