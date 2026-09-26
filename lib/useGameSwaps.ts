'use client'

// ─── The swap store ──────────────────────────────────────────────────────────
// A player's swapped and extra events at an official game live in ONE workout
// linked to that game (workouts.session_id). This hook owns it: loading it,
// creating it the first time something is swapped, and reading and writing its
// entries.
//
// Nothing here touches `results`, which is the whole point — a swapped score
// must never reach a placement, a leaderboard or the game report.
//
// It degrades to "not available" rather than failing: before the migration
// lands, asking for session_id returns 42703 and the screen simply shows no
// swap controls. The pure half is lib/gameSwaps.ts.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getEventBySlug } from '@/lib/eventData'
import { entryPayload } from '@/lib/personalGame'
import { addChoices, removeChoice } from '@/lib/gameSwaps'
import { nzDay } from '@/lib/workouts'
import type { EntryRow } from '@/components/play/chrome'
import type { EntryVals } from '@/lib/scoring'

const supabase = createClient()

export type SwapEntry = EntryRow & { event_slug: string | null; count: number | null; volume_distance_m: number | null }

type Loaded = {
  /** Who these belong to: the hook clears when the judge switches player. */
  playerId: string
  workoutId: string | null
  chosen: string[]
  entries: SwapEntry[]
}

// count and volume_distance_m are read so an edit starts from what was stored.
const ENTRY_COLS = 'id, event_slug, count, volume_distance_m, raw_score, score_label, difficulty_tier, weight_kg, reps, time_seconds, distance_m, exercise_variation'

export type GameSwaps = {
  /** Slugs the player added on top of the official ten. */
  chosen: string[]
  entriesFor: (slug: string) => SwapEntry[]
  /** Slugs that already carry a score. */
  scoredSlugs: Set<string>
  /** False when the database has no session_id column yet: hide the controls. */
  available: boolean
  /** Several at once: the sheet lets a player tick more than one. */
  add: (slugs: readonly string[]) => Promise<string | null>
  remove: (slug: string) => Promise<string | null>
  submit: (
    slug: string,
    v: EntryVals,
    editingId: string | null,
    /** Opponent player ids to record as a match, or null to leave matches alone. */
    matchOpponents?: string[] | null,
  ) => Promise<{ error: string | null; isPR: boolean }>
  deleteEntry: (id: string) => Promise<string | null>
}

export function useGameSwaps(args: {
  sessionId: string
  /** The player being scored. Null for a guest, who has no workout to own. */
  playerId: string | null
  /** Who is writing: the signed-in user, for `logged_by`. */
  userId: string | null
  sessionOpen: boolean
}): GameSwaps {
  const { sessionId, playerId, userId, sessionOpen } = args
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [available, setAvailable] = useState(true)

  const load = useCallback(async () => {
    if (!playerId) { setLoaded(null); return }
    const { data, error } = await supabase
      .from('workouts')
      .select(`id, planned_events, workout_entries(${ENTRY_COLS})`)
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .maybeSingle()
    if (error) {
      // 42703: no session_id column. PGRST205: no workouts table at all.
      if (error.code === '42703' || error.code === 'PGRST205') setAvailable(false)
      setLoaded({ playerId, workoutId: null, chosen: [], entries: [] })
      return
    }
    const row = data as { id: string; planned_events: string[] | null; workout_entries: SwapEntry[] } | null
    setLoaded({
      playerId,
      workoutId: row?.id ?? null,
      chosen: row?.planned_events ?? [],
      entries: (row?.workout_entries ?? []).map(e => ({
        ...e,
        raw_score: Number(e.raw_score ?? 0),
        result_type: null, opponent_name: null, match_score: null,
      })),
    })
  }, [sessionId, playerId])

  // Clearing FIRST matters on the kaiwhakawā tab: without it the previous
  // player's swaps show as this one's until the load returns. The judge PR
  // loader had exactly this bug before the July 2026 rebuild.
  useEffect(() => { setLoaded(null); load() }, [load])

  const state = loaded && loaded.playerId === playerId ? loaded : null

  /** The workout that holds this player's swaps, created on first use. */
  const ensureWorkout = useCallback(async (): Promise<{ id: string | null; error: string | null }> => {
    if (state?.workoutId) return { id: state.workoutId, error: null }
    if (!playerId || !userId) return { id: null, error: 'Sign in to swap an event' }
    const { data, error } = await supabase.from('workouts')
      .insert({ player_id: playerId, logged_by: userId, performed_on: nzDay(), session_id: sessionId, planned_events: [] })
      .select('id').single()
    if (error || !data) {
      if (error?.code === '42703' || error?.code === 'PGRST205') { setAvailable(false); return { id: null, error: 'Swapping is not live yet' } }
      // 23505: two taps raced and the other one won (one workout per player per
      // game). Read back the winner rather than failing the tap.
      if (error?.code === '23505') {
        const { data: existing } = await supabase.from('workouts').select('id')
          .eq('session_id', sessionId).eq('player_id', playerId).maybeSingle()
        const winner = (existing as { id: string } | null)?.id ?? null
        if (winner) {
          setLoaded(prev => (prev && prev.playerId === playerId ? { ...prev, workoutId: winner } : prev))
          return { id: winner, error: null }
        }
      }
      return { id: null, error: error?.message ?? 'Could not start your swaps' }
    }
    const id = (data as { id: string }).id
    setLoaded(prev => (prev && prev.playerId === playerId ? { ...prev, workoutId: id } : prev))
    return { id, error: null }
  }, [state?.workoutId, playerId, userId, sessionId])

  const writeChosen = useCallback(async (next: string[]): Promise<string | null> => {
    const { id, error } = await ensureWorkout()
    if (!id) return error
    const { error: e } = await supabase.from('workouts').update({ planned_events: next }).eq('id', id)
    if (e) return e.message
    setLoaded(prev => (prev && prev.playerId === playerId ? { ...prev, chosen: next } : prev))
    return null
  }, [ensureWorkout, playerId])

  const scoredSlugs = new Set(
    (state?.entries ?? []).map(e => e.event_slug).filter((s): s is string => !!s))

  return {
    chosen: state?.chosen ?? [],
    scoredSlugs,
    available: available && sessionOpen && !!playerId,
    entriesFor: (slug: string) => (state?.entries ?? []).filter(e => e.event_slug === slug),

    add: (slugs: readonly string[]) => writeChosen(addChoices(state?.chosen ?? [], slugs)),
    remove: (slug: string) => writeChosen(removeChoice(state?.chosen ?? [], slug, scoredSlugs)),

    submit: async (slug, v, editingId, matchOpponents = null) => {
      const ev = getEventBySlug(slug)
      if (!ev) return { error: 'That event is no longer on the roster', isPR: false }
      // A swap IS at a game, so a Game rung keeps its win, draw or loss here —
      // and only here (20260920053207).
      const payload = entryPayload(ev, v, { allowGameScore: true })
      if (!payload) return { error: 'Enter a valid score first', isPR: false }
      const { id, error } = await ensureWorkout()
      if (!id) return { error: error ?? 'Could not save', isPR: false }
      const written = editingId
        ? await supabase.from('workout_entries').update(payload).eq('id', editingId).select('id').maybeSingle()
        : await supabase.from('workout_entries').insert({ ...payload, workout_id: id }).select('id').single()
      const e = written.error
      if (e) {
        return {
          error: e.code === '23514' ? 'One of the numbers is out of range. Check the weight, time and distance.'
            : e.code === '42501' ? 'That game has finished, so it can no longer be scored.'
            : e.message,
          isPR: false,
        }
      }
      // The score is the record; the match hangs off it. Best-effort, exactly
      // as match recording is on an official score: a failure here must never
      // turn a saved score into an error, and PGRST202 means the function is
      // not deployed yet.
      const entryId = (written.data as { id: string } | null)?.id ?? editingId
      if (entryId && matchOpponents !== null) {
        const { error: me } = await supabase.rpc('record_entry_match', {
          p_entry_id: entryId, p_opponent_ids: matchOpponents,
        })
        if (me && me.code !== 'PGRST202') console.warn('record_entry_match:', me.message)
      }
      await load()
      // A swap never sets a PR badge here: the badge on this screen means a
      // season best on an official event, and these are not ranked.
      return { error: null, isPR: false }
    },

    deleteEntry: async (id: string) => {
      const { error } = await supabase.from('workout_entries').delete().eq('id', id)
      if (error) return error.message
      await load()
      return null
    },
  }
}
