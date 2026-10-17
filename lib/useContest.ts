'use client'

// ─── A Swiss contest, live ───────────────────────────────────────────────────
// Scoring v2 step 5 (redesigned 18 Oct 2026: no Ready button, no queue).
// Loads the two things the contest card needs for one player in one contest:
//   · who they may safely meet, from contest_safe_opponents()
//     (supabase/migrations/20261015011537_swiss_contests.sql), ids only;
//   · every match recorded in this game, which lib/swiss.ts turns into the
//     table, the "Play next" names and "Unbeaten today".
// The host passes `refreshKey`, which changes whenever the game's results do
// (results arrive by realtime and a 15 s poll), so this re-reads alongside.
// A database without the migration leaves `live` false and the card hides.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { contestTable, type ContestRecord, type SafetyLevel } from '@/lib/swiss'
import type { MatchRow } from '@/lib/matches'

export type ContestSafety = {
  level: SafetyLevel
  mixed: boolean
  /** A contact event, and this player has no bodyweight from the last 30 days. */
  needsBodyweight: boolean
  safe: ReadonlySet<string>
}

type Err = { code?: string; message?: string } | null

/** The function is not in the database yet. */
const notLive = (e: Err) => !!e && (e.code === 'PGRST202' || e.code === '42883')

type MatchQueryRow = {
  id: string; session_id: string; outcome: MatchRow['outcome']; created_at: string; confirmed_at: string | null
  event_name: string | null; session_events: { event_name: string } | null
  match_players: { player_id: string; side: 'a' | 'b' }[] | null
}

export function useContest(sessionId: string | null, eventName: string | null, playerId: string | null, refreshKey: string) {
  const key = sessionId && eventName && playerId ? `${sessionId}|${eventName}|${playerId}` : null
  const [loaded, setLoaded] = useState<{ key: string; safety: ContestSafety | null; matches: MatchRow[] } | null>(null)
  const [nonce, setNonce] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const supabase = createClient()
    Promise.all([
      supabase.rpc('contest_safe_opponents', { p_session_id: sessionId, p_event_name: eventName, p_player_id: playerId }),
      supabase.from('matches')
        .select('id, session_id, outcome, created_at, confirmed_at, event_name, session_events(event_name), match_players(player_id, side)')
        .eq('session_id', sessionId),
    ]).then(([safeRes, matchRes]) => {
      if (cancelled) return
      const d = safeRes.data as { level: SafetyLevel; mixed: boolean; needs_bodyweight: boolean; safe: string[] } | null
      // Not live, not a contest, or not allowed: no card.
      if (notLive(safeRes.error) || safeRes.error || !d) { setLoaded({ key, safety: null, matches: [] }); return }
      const matches = ((matchRes.data ?? []) as unknown as MatchQueryRow[])
        .map(m => ({
          id: m.id, session_id: m.session_id, outcome: m.outcome, created_at: m.created_at, confirmed_at: m.confirmed_at,
          event_name: m.event_name ?? m.session_events?.event_name ?? '', players: m.match_players ?? [],
        }))
        .filter(m => m.event_name)
      setLoaded({
        key,
        safety: { level: d.level, mixed: d.mixed, needsBodyweight: d.needs_bodyweight, safe: new Set(d.safe) },
        matches,
      })
    })
    return () => { cancelled = true }
  }, [key, sessionId, eventName, playerId, refreshKey, nonce])

  const current = loaded && loaded.key === key ? loaded : null
  const table = useMemo<Map<string, ContestRecord>>(
    () => current && sessionId && eventName ? contestTable(current.matches, sessionId, eventName) : new Map(),
    [current, sessionId, eventName])

  /** Kaiwhakawā only: let adults of different sexes meet in this contact event. */
  const setMixed = async (mixed: boolean) => {
    setError(null)
    const { error: err } = await createClient().rpc('set_contest_mixed', { p_session_id: sessionId, p_event_name: eventName, p_mixed: mixed })
    if (err) setError(err.message ?? 'Something went wrong.')
    setNonce(n => n + 1)
  }

  return {
    live: !!current?.safety,
    safety: current?.safety ?? null,
    table,
    error,
    setMixed,
    refresh: () => setNonce(n => n + 1),
  }
}
