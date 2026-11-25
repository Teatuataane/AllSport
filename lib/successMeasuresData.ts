// Reads for the scorecard. Rules in lib/successMeasures.ts.
//
// Sessions and results are readable by every signed-in player already. Bookings
// read for a head, or for the lead of that date (their own games). The reach
// data (birth date, sex, ethnicity, suburb) is read only for a head, through
// the existing policies (`players` and `player_profile_private` via can_log_for),
// and never leaves the page as anything but counts.
//
// Light on the Nano database: one pass of sessions and of results, paged by
// id, from the start of last year at most (first games before that are rare
// and only matter for "new this term").

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Booking, Cancellation, Person, Played, ScoredSession } from '@/lib/successMeasures'

const PAGE = 1000
const MAX_PAGES = 50

async function paged<T>(run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[] | null> {
  const out: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await run(page * PAGE, (page + 1) * PAGE - 1)
    if (error) return null
    const got = (data ?? []) as T[]
    out.push(...got)
    if (got.length < PAGE) return out
  }
  return out
}

export type ScoreData = {
  sessions: ScoredSession[]
  played: Played[]
  bookings: Booking[]
  cancellations: Cancellation[]
}

/** Everything the measures need except reach. Null when it could not be read. */
export async function loadScoreData(supabase: SupabaseClient, since: string, bookingsFrom: string): Promise<ScoreData | null> {
  const sessions = await paged<ScoredSession>((a, b) => supabase.from('sessions')
    .select('id, weekly_game_id, session_date, judge_id, voided_at')
    .gte('session_date', since).order('id').range(a, b))
  if (!sessions) return null
  const ids = new Set(sessions.map(s => s.id))
  // Results carry many rows per player per session; keep one pair each.
  const rows: Played[] = []
  const idList = [...ids]
  for (let i = 0; i < idList.length; i += 100) {
    const chunk = idList.slice(i, i + 100)
    const got = await paged<Played>((a, b) => supabase.from('results')
      .select('session_id, player_id').in('session_id', chunk).not('player_id', 'is', null)
      .order('id').range(a, b))
    if (!got) return null
    rows.push(...got)
  }
  const seen = new Set<string>()
  const played: Played[] = []
  for (const r of rows) {
    const key = `${r.session_id}|${r.player_id}`
    if (!ids.has(r.session_id) || seen.has(key)) continue
    seen.add(key)
    played.push(r)
  }
  const [bk, cn] = await Promise.all([
    supabase.from('game_bookings').select('weekly_game_id, game_date, player_id, answer').gte('game_date', bookingsFrom),
    supabase.from('game_notices').select('weekly_game_id, game_date, kind, reason').eq('kind', 'cancelled').gte('game_date', since),
  ])
  return {
    sessions, played,
    bookings: bk.error ? [] : (bk.data ?? []) as Booking[],
    cancellations: cn.error ? [] : (cn.data ?? []) as Cancellation[],
  }
}

/** Head only: the reach details of these players. Empty when not readable. */
export async function loadPeople(supabase: SupabaseClient, ids: string[]): Promise<Map<string, Person>> {
  const out = new Map<string, Person>()
  if (ids.length === 0) return out
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const [suburbs, ...parts] = await Promise.all([
    supabase.from('nz_suburbs').select('id, nzdep'),
    ...chunks.flatMap(c => [
      supabase.from('players').select('id, date_of_birth, gender').in('id', c),
      supabase.from('player_profile_private').select('player_id, ethnicity, suburb_id').in('player_id', c),
    ]),
  ])
  const decile = new Map(((suburbs.data ?? []) as { id: string; nzdep: number | null }[]).map(s => [s.id, s.nzdep]))
  for (let i = 0; i < parts.length; i += 2) {
    for (const p of (parts[i].data ?? []) as { id: string; date_of_birth: string | null; gender: string | null }[]) {
      out.set(p.id, { id: p.id, dob: p.date_of_birth, gender: p.gender, ethnicity: null, decile: null })
    }
    for (const q of (parts[i + 1].data ?? []) as { player_id: string; ethnicity: string[] | null; suburb_id: string | null }[]) {
      const p = out.get(q.player_id)
      if (p) { p.ethnicity = q.ethnicity; p.decile = q.suburb_id ? decile.get(q.suburb_id) ?? null : null }
    }
  }
  return out
}
