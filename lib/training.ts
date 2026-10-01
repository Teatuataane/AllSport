// ─── Personal training sessions ──────────────────────────────────────────────
// A session a kaiwhakawā runs for one player. It is an ordinary WITNESSED
// workout (no new table): the kaiwhakawā creates it, both of them score in it
// while it is open, and it locks on Finish or when the NZ day ends. The rules
// are in the database (20260930222237_training_sessions.sql); this file is the
// pure half (what counts as open, who is a recent client) and the four queries
// the Training tab, the play screen and HOME make.
//
// Every query is its own call and degrades to "nothing" on an error: a missing
// table must hide the feature, never take a page down.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isOpen } from '@/lib/personalGame'
import { addDays, nzDay } from '@/lib/workouts'

export type TrainingWorkout = {
  id: string
  player_id: string
  performed_on: string
  witnessed: boolean
  finished_at: string | null
  planned_events: string[] | null
}

/** Days a client stays in "recent clients" after their last session. */
export const RECENT_DAYS = 30

/** An open training session: a witnessed workout still being played. */
export function isTrainingOpen(w: Pick<TrainingWorkout, 'witnessed' | 'performed_on' | 'finished_at'>, now: Date = new Date()): boolean {
  return w.witnessed && isOpen({ planned_events: null, performed_on: w.performed_on, finished_at: w.finished_at }, now)
}

export type RecentClient = { player_id: string; last: string }

/**
 * The players this kaiwhakawā has trained in the last RECENT_DAYS days, newest
 * first, each with the date of their last session. Only witnessed workouts the
 * kaiwhakawā logged count, so a workout a player logged for themselves never
 * makes them a "client".
 */
export function recentClients(
  rows: readonly { player_id: string; performed_on: string; witnessed: boolean; logged_by: string | null }[],
  kaiwhakawaId: string,
  now: Date = new Date(),
): RecentClient[] {
  const cutoff = addDays(nzDay(now), -RECENT_DAYS)
  const last = new Map<string, string>()
  for (const r of rows) {
    if (!r.witnessed || r.logged_by !== kaiwhakawaId || r.performed_on < cutoff) continue
    const cur = last.get(r.player_id)
    if (!cur || r.performed_on > cur) last.set(r.player_id, r.performed_on)
  }
  return [...last.entries()]
    .map(([player_id, l]) => ({ player_id, last: l }))
    .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
}

const COLS = 'id, player_id, performed_on, witnessed, finished_at, planned_events'

/** Open training sessions for these players, today. */
export async function loadOpenTraining(supabase: SupabaseClient, playerIds: readonly string[]): Promise<TrainingWorkout[]> {
  if (playerIds.length === 0) return []
  const { data, error } = await supabase.from('workouts').select(COLS)
    .in('player_id', playerIds).eq('witnessed', true).is('finished_at', null).eq('performed_on', nzDay())
  return error ? [] : ((data ?? []) as TrainingWorkout[])
}

/** Every open training session today, for the kaiwhakawā's chips. */
export async function loadAllOpenTraining(supabase: SupabaseClient): Promise<TrainingWorkout[]> {
  const { data, error } = await supabase.from('workouts').select(COLS)
    .eq('witnessed', true).is('finished_at', null).eq('performed_on', nzDay())
  return error ? [] : ((data ?? []) as TrainingWorkout[])
}

/** The workouts this kaiwhakawā logged for others lately, to work out recent clients. */
export async function loadRecentTraining(supabase: SupabaseClient, kaiwhakawaId: string) {
  const { data, error } = await supabase.from('workouts')
    .select('player_id, performed_on, witnessed, logged_by')
    .eq('witnessed', true).eq('logged_by', kaiwhakawaId)
    .gte('performed_on', addDays(nzDay(), -RECENT_DAYS))
    .order('performed_on', { ascending: false }).limit(500)
  return error ? [] : ((data ?? []) as { player_id: string; performed_on: string; witnessed: boolean; logged_by: string | null }[])
}

/**
 * Open the player's session for today, or start one. A second tap on a client
 * never makes a second session: the open one is found first.
 */
export async function openOrStartTraining(
  supabase: SupabaseClient, playerId: string, kaiwhakawaId: string,
): Promise<{ id: string } | { error: string }> {
  const open = await loadOpenTraining(supabase, [playerId])
  if (open[0]) return { id: open[0].id }
  const { data, error } = await supabase.from('workouts')
    .insert({ player_id: playerId, logged_by: kaiwhakawaId, performed_on: nzDay(), planned_events: [] })
    .select('id').single()
  if (error || !data) {
    return {
      error: error?.code === '42703' || error?.code === 'PGRST205'
        ? 'Training sessions are not live yet.'
        : error?.message ?? 'The session did not start. Try again.',
    }
  }
  return { id: (data as { id: string }).id }
}

/** The events of this player's previous training session, for "Repeat last session". */
export async function lastTrainingPlan(supabase: SupabaseClient, playerId: string, excludeId: string): Promise<string[]> {
  const { data, error } = await supabase.from('workouts')
    .select('id, planned_events')
    .eq('player_id', playerId).eq('witnessed', true).neq('id', excludeId)
    .order('performed_on', { ascending: false }).order('created_at', { ascending: false })
    .limit(10)
  if (error) return []
  const hit = ((data ?? []) as { planned_events: string[] | null }[]).find(w => (w.planned_events?.length ?? 0) > 0)
  return hit?.planned_events ?? []
}
