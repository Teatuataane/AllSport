'use client'

// ─── The recheck, and the moment it produces ─────────────────────────────────
// One hook for both screens that show a player's colours, so HOME and COLOURS
// cannot drift on when they ask the server or on what counts as news.
//
// The pure half is lib/newColours.ts — same split as activePlayer/useActivePlayer
// and for the same reason: a module that calls localStorage at the wrong moment
// is not testable, and the cold-start rule here is worth testing.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  coloursSeenKey, latestConferredAt, unseenAwards, unseenWithdrawals,
  type AwardLike, type WithdrawalLike,
} from './newColours'
import { recheckGrades } from './recheckGrades'
import { createClient } from './supabase-browser'
import type { GradeState } from './loadGrades'

/** localStorage throws in a private window and in some embedded views. */
const read = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* nothing to do */ } }

const supabase = createClient()

/**
 * Withdrawals newer than the watermark. Its own query, and any failure —
 * PGRST205 before the withdrawals migration, or anything else — is "none":
 * this is a notice, and a missing notice must never cost the page.
 */
async function loadWithdrawals(playerId: string, since: string): Promise<WithdrawalLike[]> {
  const { data, error } = await supabase.from('grade_withdrawals')
    .select('domain_number, rung, grade_name, withdrawn_at, reason')
    .eq('player_id', playerId)
    .gt('withdrawn_at', since)
  return error || !data ? [] : data as WithdrawalLike[]
}

export function useNewColours(
  playerId: string | null,
  state: GradeState | null,
  reload: () => void,
) {
  const [unseen, setUnseen] = useState<AwardLike[]>([])
  const [withdrawn, setWithdrawn] = useState<WithdrawalLike[]>([])
  // Once per player per mount. Without this the recheck fires again on every
  // reload it causes, which is a loop.
  const asked = useRef<string | null>(null)

  useEffect(() => {
    if (!playerId || !state) return
    const seen = read(coloursSeenKey(playerId))
    if (!seen) {
      // Cold start: mark everything already conferred as seen, so the history
      // replay does not open the app on a stack of cards for old news. Epoch
      // when they hold nothing yet, so their FIRST colour is still news.
      write(coloursSeenKey(playerId), latestConferredAt(state.awards) ?? new Date(0).toISOString())
      setUnseen([])
      setWithdrawn([])
      return
    }
    setUnseen(unseenAwards(state.awards, seen))
    let cancelled = false
    void loadWithdrawals(playerId, seen).then(rows => { if (!cancelled) setWithdrawn(unseenWithdrawals(rows, seen)) })
    return () => { cancelled = true }
  }, [playerId, state])

  useEffect(() => {
    if (!playerId || !state || asked.current === playerId) return
    asked.current = playerId
    // Reload only when something landed: the usual answer is nothing, and the
    // colours on screen were already correct before we asked.
    void recheckGrades({ playerId }).then(r => { if (r.conferred.length > 0) reload() })
  }, [playerId, state, reload])

  const dismiss = useCallback(() => {
    if (!playerId) return
    // The newest SERVER timestamp among what was shown, not the phone's clock:
    // a clock running ahead would hide a colour conferred just after dismissing.
    const shown = [...unseen.map(a => a.conferred_at), ...withdrawn.map(w => w.withdrawn_at)]
    const latest = shown.reduce<string | null>((m, t) => (!m || Date.parse(t) > Date.parse(m) ? t : m), null)
    if (latest) write(coloursSeenKey(playerId), latest)
    setUnseen([])
    setWithdrawn([])
  }, [playerId, unseen, withdrawn])

  return { unseen, withdrawn, dismiss }
}
