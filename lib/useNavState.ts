'use client'

// ─── Navigation state ────────────────────────────────────────────────────────
// Shared by the bottom tab bar (phones) and the top bar's desktop links, so the
// PLAY destination cannot drift between the two. It was two copies for about an
// hour and that was already one copy too many.

import { useEffect, useState } from 'react'
import { useActivePlayer } from '@/lib/useActivePlayer'

// Dynamic, not module scope: this hook is what Navbar and BottomNav call, so a
// static import would drag the Supabase client into every page's bundle. See
// lib/authCookie.ts. The effect below already runs only for a signed-in user,
// so the import happens exactly when there is a session to query for.
const supabaseModule = () => import('@/lib/supabase-browser')

export type NavState = {
  userId: string | null
  isJudge: boolean
  liveSessionId: string | null
  /** Where PLAY goes right now. */
  playHref: string
  /** JUDGE for kaiwhakawā, PLAY for everyone else. */
  playLabel: string
  /** Red for kaiwhakawā, green while a session is live, otherwise resting grey. */
  playColour: string
}

const RESTING = '#5c5c5c'

export function useNavState(): NavState {
  const { userId, self } = useActivePlayer()
  const [liveSessionIdState, setLiveSessionId] = useState<string | null>(null)

  const isJudge = self?.role === 'judge'

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const check = async () => {
      const { createClient } = await supabaseModule()
      if (cancelled) return
      const supabase = createClient()

      // A session whose 100 minutes ran out while the app was closed never fires
      // award_session_points, so nobody in it gets placements or points. This RPC
      // derives expiry from started_at server-side, so a caller can only ask it to
      // check, never choose the outcome.
      await supabase.rpc('close_expired_sessions')
      const { data } = await supabase
        .from('sessions').select('id').eq('is_active', true).maybeSingle()
      if (!cancelled) setLiveSessionId(data?.id ?? null)
    }

    // Swallowed on purpose: the interval below retries every 60s, so a failed
    // import or a dropped request self-heals. Without the catch it is an
    // unhandled rejection on every flaky load.
    const run = () => { check().catch(() => {}) }

    run()
    const t = setInterval(run, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [userId])

  // Derived, not cleared in the effect above: signing out must not leave a stale
  // session id behind, and deriving it avoids a setState in an effect body.
  const liveSessionId = userId ? liveSessionIdState : null

  const playHref = isJudge
    ? (liveSessionId ? `/scoring/${liveSessionId}` : '/judge')
    : (liveSessionId ? `/scoring/${liveSessionId}` : '/dashboard#join')

  return {
    userId,
    isJudge,
    liveSessionId,
    playHref,
    playLabel: isJudge ? 'Judge' : 'Play',
    playColour: isJudge ? 'var(--red)' : liveSessionId ? 'var(--green)' : RESTING,
  }
}
