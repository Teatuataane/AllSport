'use client'

// ─── What the live screen needs to colour a score ────────────────────────────
// A score's colour depends on who scored it: the division picks the ladder and
// the age shift, gender breaks a junior's tie, and a strength lift is graded
// against the bodyweight declared for the day. This loads those three for one
// player. The pure half is lib/scoreColour.ts.
//
// Every read is its own query and every failure degrades to "no colour": a
// neutral button is always a safe answer, a wrong colour is not.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { GradePlayer } from '@/lib/playerGrades'

const supabase = createClient()

export type GradeProfile = {
  player: GradePlayer | null
  /** The declaration in force on `day`, or null when none has been made. */
  bodyweightKg: number | null
  /** Set the day's weight straight after BodyweightField saves one. */
  setBodyweightKg: (kg: number) => void
}

type Loaded = { key: string; player: GradePlayer | null; bodyweightKg: number | null }

export function useGradeProfile(playerId: string | null, day: string): GradeProfile {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = `${playerId ?? ''}|${day}`

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    ;(async () => {
      const [pub, priv, bw] = await Promise.all([
        supabase.from('players_public').select('division, age_years').eq('id', playerId).maybeSingle(),
        // Gender is only read for juniors, who share one division. RLS lets the
        // player, their parent and a kaiwhakawā read it; anyone else gets no
        // row, and a junior then takes the boys' ladder, as ladderFor does.
        supabase.from('players').select('gender').eq('id', playerId).maybeSingle(),
        supabase.from('player_bodyweights').select('kg').eq('player_id', playerId)
          .lte('measured_on', day).order('measured_on', { ascending: false }).limit(1),
      ])
      if (cancelled) return
      const p = pub.data as { division: string | null; age_years: number | null } | null
      const kg = (bw.data as { kg: number }[] | null)?.[0]?.kg
      setLoaded({
        key,
        player: p ? {
          division: p.division,
          ageYears: p.age_years,
          gender: (priv.data as { gender: string | null } | null)?.gender ?? null,
        } : null,
        bodyweightKg: kg == null ? null : Number(kg),
      })
    })()
    return () => { cancelled = true }
  }, [playerId, day, key])

  const current = loaded && loaded.key === key ? loaded : null
  const setBodyweightKg = useCallback((kg: number) => {
    setLoaded(prev => (prev && prev.key === key ? { ...prev, bodyweightKg: kg } : prev))
  }, [key])

  return { player: current?.player ?? null, bodyweightKg: current?.bodyweightKg ?? null, setBodyweightKg }
}
