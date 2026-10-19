'use client'

// ─── What the live screen needs to colour a score ────────────────────────────
// A score's colour depends on who scored it: the division picks the ladder,
// the age turned in the day's year picks the age shift, gender breaks a
// junior's tie, and a strength lift is graded
// against the bodyweight declared for the day. This loads those three for one
// player. The pure half is lib/scoreColour.ts.
//
// Every read is its own query and every failure degrades to "no colour": a
// neutral button is always a safe answer, a wrong colour is not.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { playerInYear, type GradePlayer } from '@/lib/playerGrades'
import { yearOfDay, nzYear } from '@/lib/seasonYear'

const supabase = createClient()

export type GradeProfile = {
  player: GradePlayer | null
  /** The declaration in force on `day`, or null when none has been made. */
  bodyweightKg: number | null
  /** The day that declaration was made, 'YYYY-MM-DD', or null when none. */
  bodyweightOn: string | null
  /** Set the day's weight straight after BodyweightField saves one. */
  setBodyweightKg: (kg: number) => void
}

type Loaded = { key: string; player: GradePlayer | null; bodyweightKg: number | null; bodyweightOn: string | null }

export function useGradeProfile(playerId: string | null, day: string): GradeProfile {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = `${playerId ?? ''}|${day}`

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    ;(async () => {
      const [pub, birth, priv, bw] = await Promise.all([
        supabase.from('players_public').select('division, age_years').eq('id', playerId).maybeSingle(),
        // Its own read: a database without birth_year (42703) must not cost the
        // division and age above. The age today then stands in.
        supabase.from('players_public').select('birth_year').eq('id', playerId).maybeSingle(),
        // Gender is only read for juniors, who share one division. RLS lets the
        // player, their parent and a kaiwhakawā read it; anyone else gets no
        // row, and a junior then takes the boys' ladder, as ladderFor does.
        supabase.from('players').select('gender').eq('id', playerId).maybeSingle(),
        supabase.from('player_bodyweights').select('kg, measured_on').eq('player_id', playerId)
          .lte('measured_on', day).order('measured_on', { ascending: false }).limit(1),
      ])
      if (cancelled) return
      const p = pub.data as { division: string | null; age_years: number | null } | null
      const latest = (bw.data as { kg: number; measured_on: string }[] | null)?.[0]
      const kg = latest?.kg
      setLoaded({
        key,
        player: p ? playerInYear({
          division: p.division,
          ageYears: p.age_years,
          birthYear: birth.error ? undefined : (birth.data as { birth_year?: number | null } | null)?.birth_year ?? null,
          gender: (priv.data as { gender: string | null } | null)?.gender ?? null,
        }, yearOfDay(day) ?? nzYear()) : null,
        bodyweightKg: kg == null ? null : Number(kg),
        bodyweightOn: latest?.measured_on ?? null,
      })
    })()
    return () => { cancelled = true }
  }, [playerId, day, key])

  const current = loaded && loaded.key === key ? loaded : null
  const setBodyweightKg = useCallback((kg: number) => {
    setLoaded(prev => (prev && prev.key === key ? { ...prev, bodyweightKg: kg, bodyweightOn: day } : prev))
  }, [key, day])

  return {
    player: current?.player ?? null, bodyweightKg: current?.bodyweightKg ?? null,
    bodyweightOn: current?.bodyweightOn ?? null, setBodyweightKg,
  }
}
