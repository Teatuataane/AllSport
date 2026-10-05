'use client'

// The player's rating in every sport, for the win/draw/loss buttons. Neither
// play screen loaded matches before. One read of every recorded match, the same
// one HOME uses (lib/loadGrades.ts), shaped by ratingsFor.
//
// A failed read gives null, never an empty map: an empty map would tell every
// player they were ten games from a rating. The buttons then fall back to the
// result colour, which needs nothing loaded. The rating needs BOTH sides'
// records, so it moves only when the opponent's arrives; reload() on reopening
// the screen or after recording a match is enough, with no realtime.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { loadMatchesChecked, ratingsFor } from '@/lib/loadGrades'
import type { SportRating } from '@/lib/headToHead'

const supabase = createClient()

export type SportRatings = {
  /** Keyed by event name. Null until loaded, or when the read failed. */
  ratings: ReadonlyMap<string, SportRating> | null
  reload: () => void
}

export function useSportRatings(playerId: string | null): SportRatings {
  const [loaded, setLoaded] = useState<{ id: string; ratings: ReadonlyMap<string, SportRating> | null } | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    ;(async () => {
      const { rows, failed } = await loadMatchesChecked(supabase)
      if (cancelled) return
      setLoaded({ id: playerId, ratings: failed ? null : ratingsFor(playerId, rows) })
    })()
    return () => { cancelled = true }
  }, [playerId, nonce])

  const reload = useCallback(() => setNonce(n => n + 1), [])
  return { ratings: loaded && loaded.id === playerId ? loaded.ratings : null, reload }
}
