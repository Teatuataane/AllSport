// Reads and writes for timesheets. Rules in lib/timesheets.ts.
//
// timesheet_lines and its functions arrive with 20261124223426_timesheets.sql,
// applied after the code deploys (CLAUDE.md §12): a missing function reads as
// "not live yet" (null), never as an error.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Role, TimesheetLine } from '@/lib/timesheets'

const NOT_LIVE = new Set(['PGRST205', '42P01', 'PGRST202', '42883'])
const notLive = (e: { code?: string } | null | undefined) => !!e && NOT_LIVE.has(e.code ?? '')

/** The database's words are written for people already; strip the prefix. */
const say = (e: { message?: string } | null) => e?.message?.replace(/^timesheets: /, '') ?? null

/** A fortnight's lines: every line for a Kaiwhakawā, your own otherwise. Null when not live. */
export async function loadPeriod(supabase: SupabaseClient, start: string): Promise<TimesheetLine[] | null> {
  const { data, error } = await supabase.rpc('timesheet_period', { p_start: start })
  if (error) return notLive(error) ? null : []
  return (data ?? []) as TimesheetLine[]
}

export async function queryLine(supabase: SupabaseClient, lineId: string, note: string): Promise<string | null> {
  const { error } = await supabase.rpc('query_timesheet_line', { p_line_id: lineId, p_note: note })
  return say(error)
}

export async function settleLine(
  supabase: SupabaseClient, lineId: string, pay: boolean, minutes: number | null, answer: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('settle_timesheet_line', {
    p_line_id: lineId, p_pay: pay, p_minutes: minutes, p_answer: answer || null,
  })
  return say(error)
}

export async function addLine(
  supabase: SupabaseClient, a: { playerId: string; gameId: string; date: string; role: Role; minutes: number | null; note: string },
): Promise<string | null> {
  const { error } = await supabase.rpc('add_timesheet_line', {
    p_player_id: a.playerId, p_game_id: a.gameId, p_date: a.date, p_role: a.role, p_minutes: a.minutes, p_note: a.note || null,
  })
  return say(error)
}

/** Approve the fortnight's lines that are not held. Returns how many, or an error. */
export async function approvePeriod(supabase: SupabaseClient, start: string): Promise<{ count: number } | { error: string }> {
  const { data, error } = await supabase.rpc('approve_timesheet_period', { p_start: start })
  if (error) return { error: say(error) ?? 'Could not approve.' }
  return { count: (data as number | null) ?? 0 }
}
