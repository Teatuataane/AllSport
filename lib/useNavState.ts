'use client'

// ─── Navigation state ────────────────────────────────────────────────────────
// Shared by the bottom tab bar (phones) and the top bar's desktop links, so the
// PLAY destination cannot drift between the two. It was two copies for about an
// hour and that was already one copy too many.

import { useEffect, useState } from 'react'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { pollWhileVisible } from '@/lib/livePoll'
import { liveOnly, navGame, type LiveGameRow } from '@/lib/liveGames'
import { isHead, isKaiarahi } from '@/lib/kaiarahi'

// Dynamic, not module scope: this hook is what Navbar and NavTabs call, so a
// static import would drag the Supabase client into every page's bundle. See
// lib/authCookie.ts. The effect below already runs only for a signed-in user,
// so the import happens exactly when there is a session to query for.
const supabaseModule = () => import('@/lib/supabase-browser')

export type NavState = {
  userId: string | null
  /** A Kaiwhakawā (head staff): the judge panel. */
  isJudge: boolean
  /** Any level of Kaiārahi: may start a game. */
  isKaiarahi: boolean
  liveSessionId: string | null
  /** Where PLAY goes right now. */
  playHref: string
  /** JUDGE for a Kaiwhakawā, RUN for other Kaiārahi, PLAY for everyone else. */
  playLabel: string
  /** Red for kaiwhakawā, green while a session is live, otherwise resting grey. */
  playColour: string
}

const RESTING = '#5c5c5c'

export function useNavState(): NavState {
  const { userId, self } = useActivePlayer()
  const [liveSessionIdState, setLiveSessionId] = useState<string | null>(null)
  const [anyLiveState, setAnyLive] = useState(false)

  // The level, not players.role, which grants nothing since 20261123024501.
  const isJudge = isHead(self?.kaiarahi_level)
  const runsGames = isKaiarahi(self?.kaiarahi_level)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // The weekly games this player is registered to, read once per page and
    // only when it matters: several games live and none run by them.
    let registered: Set<string> | null = null

    const check = async () => {
      const { createClient } = await supabaseModule()
      if (cancelled) return
      const supabase = createClient()

      // No close_expired_sessions() first (it was a write on every check, and
      // pg_cron runs it every 5 minutes): a game past its 100 minutes reads as
      // over from started_at instead. See lib/livePoll.ts.
      // Every live game: several can run at once since v0.64.0.0 (lib/liveGames.ts).
      const { data, error } = await supabase
        .from('sessions').select('id, started_at, is_active, weekly_game_id, judge_id').eq('is_active', true)
      if (cancelled || error) return
      const rows = liveOnly((data ?? []) as LiveGameRow[])
      if (rows.length > 1 && !registered && !rows.some(r => r.judge_id === userId)) {
        const mem = await supabase.from('weekly_game_members')
          .select('weekly_game_id').eq('player_id', userId).is('left_at', null)
        registered = new Set(((mem.data ?? []) as { weekly_game_id: string }[]).map(r => r.weekly_game_id))
        if (cancelled) return
      }
      setAnyLive(rows.length > 0)
      setLiveSessionId(navGame(rows, { id: userId, registered: registered ?? new Set() }))
    }

    // Swallowed on purpose: the next check retries, so a failed import or a
    // dropped request self-heals. Without the catch it is an unhandled
    // rejection on every flaky load. Every minute while the page is visible,
    // and once when it comes back; a hidden tab (a phone in a pocket) used to
    // ask every minute all day.
    const stop = pollWhileVisible(() => { check().catch(() => {}) }, 60_000)
    return () => { cancelled = true; stop() }
  }, [userId])

  // Derived, not cleared in the effect above: signing out must not leave a stale
  // session id behind, and deriving it avoids a setState in an effect body.
  const liveSessionId = userId ? liveSessionIdState : null
  // Several games may be live with none clearly this player's: PLAY then goes
  // to HOME's Join cards (or the panel), still green.
  const anyLive = !!userId && anyLiveState

  // Every Kaiārahi has the panel (since v0.63.0.0): a head sees everything, a
  // Kaimahi or Kaiako their own games and a New game button.
  const playHref = liveSessionId
    ? `/scoring/${liveSessionId}`
    : runsGames ? '/judge' : '/dashboard#join'

  return {
    userId,
    isJudge,
    isKaiarahi: runsGames,
    liveSessionId,
    playHref,
    playLabel: isJudge ? 'Judge' : runsGames ? 'Run' : 'Play',
    playColour: isJudge ? 'var(--red)' : liveSessionId || anyLive ? 'var(--green)' : RESTING,
  }
}
