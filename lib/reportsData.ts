// Reads for the funder and school reports. Rules in lib/reports.ts and
// lib/successMeasures.ts. Kaiwhakawā only: every read here goes through
// policies that already limit it to a head (programmes, players, private
// profiles, timesheets) or a head-only function (programme_wellbeing).

import type { SupabaseClient } from '@supabase/supabase-js'
import { attendance, periodSummary } from '@/lib/successMeasures'
import { loadPeople, loadScoreData } from '@/lib/successMeasuresData'
import { funderReport, schoolReport, type FunderReport, type SchoolReport, type Student, type Wellbeing } from '@/lib/reports'

export type Programme = { id: string; name: string; funder: string; starts_on: string; ends_on: string }

export async function loadProgrammes(supabase: SupabaseClient): Promise<Programme[]> {
  const { data } = await supabase.from('programmes').select('id, name, funder, starts_on, ends_on').order('starts_on', { ascending: false })
  return (data ?? []) as Programme[]
}

/** Schools at least one player named, by name. */
export async function loadNamedSchools(supabase: SupabaseClient): Promise<{ id: number; name: string }[]> {
  const { data } = await supabase.from('player_profile_private').select('school_id').not('school_id', 'is', null)
  const ids = [...new Set(((data ?? []) as { school_id: number }[]).map(r => r.school_id))]
  if (!ids.length) return []
  const { data: schools } = await supabase.from('nz_schools').select('id, name').in('id', ids).order('name')
  return (schools ?? []) as { id: number; name: string }[]
}

/** Sessions from the start of the year before `from`, so first games are known. */
const historyFrom = (from: string) => `${Number(from.slice(0, 4)) - 1}-01-01`

export async function loadFunderReport(supabase: SupabaseClient, programmeId: string, from: string, to: string): Promise<FunderReport | null> {
  const [{ data: prog }, { data: games }] = await Promise.all([
    supabase.from('programmes').select('name, funder').eq('id', programmeId).maybeSingle(),
    supabase.from('weekly_games').select('id').eq('programme_id', programmeId),
  ])
  if (!prog) return null
  const gameIds = ((games ?? []) as { id: string }[]).map(g => g.id)
  const data = await loadScoreData(supabase, historyFrom(from), from)
  if (!data) return null
  const att = attendance(data.sessions, data.played)
  const summary = periodSummary({ att, games: new Set(gameIds), from, to, bookings: data.bookings, cancellations: data.cancellations })
  const [people, wb, lines] = await Promise.all([
    loadPeople(supabase, summary.players),
    supabase.rpc('programme_wellbeing', { p_programme_id: programmeId, p_from: from, p_to: to }),
    supabase.from('timesheet_lines').select('minutes, decision, approved_at')
      .eq('programme_id', programmeId).gte('game_date', from).lte('game_date', to),
  ])
  const wellbeing = wb.error ? null : (((wb.data ?? []) as Wellbeing[])[0] ?? null)
  const paidMinutes = ((lines.data ?? []) as { minutes: number; decision: string | null; approved_at: string | null }[])
    .filter(l => l.approved_at && l.decision !== 'no_pay').reduce((n, l) => n + l.minutes, 0)
  return funderReport({
    programme: prog as { name: string; funder: string }, from, to, games: gameIds, summary, att, people, wellbeing, paidMinutes,
  })
}

export async function loadSchoolReport(supabase: SupabaseClient, schoolId: number, from: string, to: string): Promise<SchoolReport | null> {
  const [{ data: school }, { data: profiles }] = await Promise.all([
    supabase.from('nz_schools').select('name').eq('id', schoolId).maybeSingle(),
    supabase.from('player_profile_private').select('player_id, share_with_school').eq('school_id', schoolId),
  ])
  if (!school) return null
  const rows = (profiles ?? []) as { player_id: string; share_with_school: boolean | null }[]
  const ids = rows.map(r => r.player_id)
  const players = new Map<string, { full_name: string | null; display_name: string | null; date_of_birth: string | null }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('players').select('id, full_name, display_name, date_of_birth').in('id', ids.slice(i, i + 200))
    for (const p of (data ?? []) as { id: string; full_name: string | null; display_name: string | null; date_of_birth: string | null }[]) players.set(p.id, p)
  }
  const students: Student[] = rows.map(r => {
    const p = players.get(r.player_id)
    return {
      id: r.player_id,
      name: p ? (p.full_name?.trim() || p.display_name) : null,
      dob: p?.date_of_birth ?? null,
      consent: r.share_with_school === true,
    }
  })
  const data = await loadScoreData(supabase, from, from)
  if (!data) return null
  return schoolReport({ school: (school as { name: string }).name, from, to, students, att: attendance(data.sessions, data.played) })
}
