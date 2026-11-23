'use client'

// ─── Navigation state ────────────────────────────────────────────────────────
// Shared by the bottom tab bar (phones) and the top bar's desktop links, so the
// PLAY destination cannot drift between the two. It was two copies for about an
// hour and that was already one copy too many.

import { useEffect, useState } from 'react'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { isLiveSession, pollWhileVisible } from '@/lib/livePoll'
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

  // The level, not players.role, which grants nothing since 20261123024501.
  const isJudge = isHead(self?.kaiarahi_level)
  const runsGames = isKaiarahi(self?.kaiarahi_level)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const check = async () => {
      const { createClient } = await supabaseModule()
      if (cancelled) return
      const supabase = createClient()

      // No close_expired_sessions() first (it was a write on every check, and
      // pg_cron runs it every 5 minutes): a game past its 100 minutes reads as
      // over from started_at instead. See lib/livePoll.ts.
      const { data, error } = await supabase
        .from('sessions').select('id, started_at').eq('is_active', true).maybeSingle()
      if (!cancelled && !error) setLiveSessionId(isLiveSession(data) ? data!.id : null)
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
    playColour: isJudge ? 'var(--red)' : liveSessionId ? 'var(--green)' : RESTING,
  }
}
