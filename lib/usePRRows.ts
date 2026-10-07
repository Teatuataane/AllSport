'use client'

// ─── A player's scores on the events in front of them ────────────────────────
// Everything the PR board needs, loaded once for a set of events: game results
// and logged workout entries, lifetime, shaped as PRRow and grouped by event
// slug. The two reads are separate queries on purpose: a missing table or an
// RLS refusal on workout_entries only costs the logged rows, never the games.
//
// `reload` re-reads after a save, because a score the player just entered is a
// row in the database and the board must see it on the next tap.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getEventByName, getEventBySlug } from '@/lib/eventData'
import { loggedBestRows, trainingDistanceRows, type LoggedBestEntry } from '@/lib/workouts'
import type { PRRow } from '@/lib/prBoard'

const supabase = createClient()

export type PRRowsBySlug = Record<string, PRRow[]>
const NONE: PRRowsBySlug = {}

type ResultRow = {
  id: string
  raw_score: number | null
  score_label: string | null
  difficulty_tier: string | null
  distance_m: number | null
  time_seconds: number | null
  weight_kg: number | null
  session_events: { event_name: string } | null
  sessions: { session_date: string } | null
}

export function usePRRows(playerId: string | null, slugs: readonly string[]) {
  const slugKey = [...slugs].sort().join(',')
  const key = playerId && slugKey ? `${playerId}|${slugKey}` : null
  const [loaded, setLoaded] = useState<{ key: string; rows: PRRowsBySlug } | null>(null)
  const latest = useRef(key)
  latest.current = key

  const load = useCallback(async () => {
    if (!key || !playerId) return
    const asked = key
    const names = slugKey.split(',').map(s => getEventBySlug(s)?.name).filter((n): n is string => !!n)
    const out: PRRowsBySlug = {}
    const push = (slug: string, r: PRRow) => { (out[slug] ||= []).push(r) }

    const [games, entries] = await Promise.all([
      supabase
        .from('results')
        .select('id, raw_score, score_label, difficulty_tier, distance_m, time_seconds, weight_kg, session_events!inner(event_name), sessions!inner(session_date)')
        .eq('player_id', playerId)
        .in('session_events.event_name', names)
        .not('raw_score', 'is', null)
        .range(0, 4999),
      supabase
        .from('workout_entries')
        .select('id, event_slug, raw_score, score_label, difficulty_tier, distance_m, time_seconds, weight_kg, workouts!inner(player_id, performed_on, witnessed)')
        .eq('workouts.player_id', playerId)
        .in('event_slug', slugKey.split(','))
        // A distance effort with no raw_score is training under the reference
        // distance, still a record at its own distance (lib/prBoard.ts).
        .or('raw_score.not.is.null,distance_m.not.is.null')
        .range(0, 4999),
    ])

    if (!games.error) {
      for (const r of (games.data ?? []) as unknown as ResultRow[]) {
        const ev = r.session_events ? getEventByName(r.session_events.event_name) : undefined
        if (!ev || r.raw_score == null || !r.sessions) continue
        push(ev.slug, {
          id: r.id, raw_score: Number(r.raw_score), score_label: r.score_label ?? '',
          difficulty_tier: r.difficulty_tier, date: r.sessions.session_date, source: 'game',
          distance_m: r.distance_m, time_seconds: r.time_seconds, weight_kg: r.weight_kg,
        })
      }
    }
    if (!entries.error) {
      const logged = (entries.data ?? []) as unknown as LoggedBestEntry[]
      for (const r of [...loggedBestRows(logged), ...trainingDistanceRows(logged)]) {
        const ev = getEventByName(r.event_name)
        if (!ev) continue
        push(ev.slug, {
          id: r.id, raw_score: r.raw_score, score_label: r.score_label,
          difficulty_tier: r.difficulty_tier, date: r.session_date,
          source: r.witnessed ? 'witnessed' : 'logged',
          distance_m: r.distance_m, time_seconds: r.time_seconds, weight_kg: r.weight_kg,
        })
      }
    }
    // A fast player switch can resolve out of order: only the latest ask lands.
    if (latest.current === asked) setLoaded({ key: asked, rows: out })
  }, [key, playerId, slugKey])

  useEffect(() => { load() }, [load])

  // Derived, so a switch shows nothing until the new player's rows arrive
  // instead of the previous player's records.
  const rows = key && loaded?.key === key ? loaded.rows : NONE
  return { rows, reload: load }
}
