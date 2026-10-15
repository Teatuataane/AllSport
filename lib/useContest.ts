'use client'

// ─── A player's place in a Swiss contest, live ───────────────────────────────
// Scoring v2 step 5. Wraps contest_state / contest_ready / contest_leave /
// contest_close (supabase/migrations/20261015011537_swiss_contests.sql). While
// the player waits, or is paired, it polls every few seconds: a pairing is made
// by whoever taps Ready second, or by a kaiwhakawā, so this screen learns of it
// by asking. A database without the migration leaves `live` false and the
// card hides itself. The kaiwhakawā's view is useContestBoard.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()
const POLL_MS = 4000

export type ContestPairing = {
  id: string
  opponent_id: string
  opponent_name: string
  opponent_icon: string | null
  by_judge: boolean
}

export type ContestState = {
  status: 'idle' | 'waiting' | 'paired' | 'needs_bodyweight'
  pairing: ContestPairing | null
  waiting: number
  /** Nobody in this game can be paired with this player: offer a bye. */
  noneEligible: boolean
  matches: number
  played: number
}

type Err = { code?: string; message?: string } | null

/** The functions are not in the database yet. */
const notLive = (e: Err) => !!e && (e.code === 'PGRST202' || e.code === '42883')

export function useContest(sessionId: string | null, eventName: string | null, playerId: string | null) {
  const key = sessionId && eventName && playerId ? `${sessionId}|${eventName}|${playerId}` : null
  const [loaded, setLoaded] = useState<{ key: string; state: ContestState | null; live: boolean } | null>(null)
  const [nonce, setNonce] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    supabase.rpc('contest_state', { p_session_id: sessionId, p_event_name: eventName, p_player_id: playerId })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (notLive(err) || (!err && data == null)) { setLoaded({ key, state: null, live: false }); return }
        if (err) return
        const d = data as { status: ContestState['status']; pairing: ContestPairing | null; waiting: number; matches: number; played: number }
        setLoaded(prev => ({
          key, live: true,
          state: {
            status: d.status, pairing: d.pairing, waiting: d.waiting, matches: d.matches, played: d.played,
            // Kept from the last Ready: contest_state does not work it out.
            noneEligible: prev?.key === key && d.status === 'waiting' ? prev.state?.noneEligible ?? false : false,
          },
        }))
      })
    return () => { cancelled = true }
  }, [key, sessionId, eventName, playerId, nonce])

  const current = loaded && loaded.key === key ? loaded : null
  const status = current?.state?.status

  // Poll while something can change without this player doing anything.
  useEffect(() => {
    if (status !== 'waiting' && status !== 'paired') return
    const t = setInterval(() => setNonce(n => n + 1), POLL_MS)
    return () => clearInterval(t)
  }, [status])

  const call = useCallback(async (fn: string, args: Record<string, unknown>) => {
    setBusy(true); setError(null)
    const { data, error: err } = await supabase.rpc(fn, args)
    setBusy(false)
    if (err) { setError(err.message ?? 'Something went wrong.'); return null }
    return data
  }, [])

  const ready = useCallback(async () => {
    if (!key) return
    const d = await call('contest_ready', { p_session_id: sessionId, p_event_name: eventName, p_player_id: playerId }) as
      { status: ContestState['status']; pairing?: ContestPairing; waiting?: number; none_eligible?: boolean } | null
    if (!d) return
    setLoaded(prev => {
      const base = prev?.key === key && prev.state ? prev.state : { matches: 3, played: 0 }
      return {
        key, live: true,
        state: {
          ...base, status: d.status, pairing: d.pairing ?? null, waiting: d.waiting ?? 0,
          noneEligible: d.none_eligible ?? false,
        } as ContestState,
      }
    })
  }, [key, call, sessionId, eventName, playerId])

  const leave = useCallback(async () => {
    await call('contest_leave', { p_session_id: sessionId, p_event_name: eventName, p_player_id: playerId })
    setNonce(n => n + 1)
  }, [call, sessionId, eventName, playerId])

  /** The match is recorded (or called off): free both players for the next one. */
  const close = useCallback(async () => {
    const id = current?.state?.pairing?.id
    if (!id) return
    await call('contest_close', { p_pairing_id: id })
    setNonce(n => n + 1)
  }, [call, current])

  return {
    live: current?.live ?? false,
    state: current?.state ?? null,
    busy, error, ready, leave, close,
    refresh: () => setNonce(n => n + 1),
  }
}

export type ContestBoard = {
  waiting: { id: string; name: string; points: number }[]
  paired: { id: string; a: string; b: string }[]
  matches: number
  mixed: boolean
}

/** The kaiwhakawā's view of one contest: who waits, who is paired, the rules. */
export function useContestBoard(sessionId: string | null, eventName: string | null, enabled: boolean) {
  const key = enabled && sessionId && eventName ? `${sessionId}|${eventName}` : null
  const [loaded, setLoaded] = useState<{ key: string; board: ContestBoard | null } | null>(null)
  const [nonce, setNonce] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    supabase.rpc('contest_board', { p_session_id: sessionId, p_event_name: eventName }).then(({ data, error: err }) => {
      if (cancelled) return
      setLoaded({ key, board: err ? null : data as ContestBoard })
    })
    const t = setTimeout(() => setNonce(n => n + 1), POLL_MS)
    return () => { cancelled = true; clearTimeout(t) }
  }, [key, sessionId, eventName, nonce])

  const act = async (fn: string, args: Record<string, unknown>) => {
    setError(null)
    const { error: err } = await supabase.rpc(fn, args)
    if (err) setError(err.message ?? 'Something went wrong.')
    setNonce(n => n + 1)
  }

  return {
    board: loaded && loaded.key === key ? loaded.board : null,
    error,
    pair: (a: string, b: string) => act('contest_pair', { p_session_id: sessionId, p_event_name: eventName, p_a: a, p_b: b }),
    setRules: (matches: number, mixed: boolean) =>
      act('set_contest_rules', { p_session_id: sessionId, p_event_name: eventName, p_matches: matches, p_mixed: mixed }),
  }
}
