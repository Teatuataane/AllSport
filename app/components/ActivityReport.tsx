'use client'
// Kaiwhakawā activity report: weekly active minutes by cohort, for funder
// evidence (Sport NZ and Tū Manawa report against weekly minutes). Games count
// as 100 minutes each; logged workouts count their own minutes. Aggregate only:
// weeks with fewer than MIN_COHORT players in a cohort are dropped, the same
// rule as the wellbeing report, and CSV export carries nothing more than the
// table shows.
//
// Computed in the browser from rows a kaiwhakawā can already read through RLS
// (workouts via can_log_for, results and sessions publicly), so it needs no
// SECURITY DEFINER function. Every read is its own query: before the training
// load migration the minutes column is missing (42703) and logged workouts
// fall back to their entries' durations.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  weeklyActivity, workoutMinutes, addDays, nzDay, weekStart, GUIDELINE_MINUTES, GAME_MINUTES, MIN_COHORT,
  type ActivityInput, type ActivityRow,
} from '@/lib/workouts'

const supabase = createClient()

/** How many weeks back the report covers. */
const WEEKS = 12
const PAGE = 1000

const COLS: { key: keyof ActivityRow; label: string }[] = [
  { key: 'week', label: 'Week of' },
  { key: 'cohort', label: 'Cohort' },
  { key: 'players', label: 'Active players' },
  { key: 'medianMinutes', label: 'Median min/week' },
  { key: 'meetingGuideline', label: 'Meeting guideline' },
  { key: 'gameMinutes', label: 'Game minutes' },
  { key: 'loggedMinutes', label: 'Logged minutes' },
]

/** Every row a query returns, a page at a time: PostgREST stops at 1000. */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<{ rows: T[]; error: { code?: string; message: string } | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await q(from, from + PAGE - 1)
    if (error) return { rows, error }
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE) return { rows, error: null }
  }
}

export default function ActivityReport() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const since = weekStart(addDays(nzDay(), -7 * (WEEKS - 1)))
    ;(async () => {
      const players = await all<{ id: string; division: string | null; is_guest: boolean | null }>(
        (a, b) => supabase.from('players_public').select('id, division, is_guest').range(a, b))
      const sessions = await all<{ id: string; session_date: string }>(
        (a, b) => supabase.from('sessions').select('id, session_date').gte('session_date', since).range(a, b))
      const workouts = await all<{ id: string; player_id: string; performed_on: string; workout_entries: { duration_seconds: number | null }[] }>(
        (a, b) => supabase.from('workouts').select('id, player_id, performed_on, workout_entries(duration_seconds)').gte('performed_on', since).range(a, b))
      if (cancelled) return
      const failed = players.error ?? sessions.error ?? (workouts.error?.code === 'PGRST205' ? null : workouts.error)
      if (failed) { setError(failed.message); return }

      // Minutes on the workout itself, when the migration has landed.
      const mins = await all<{ id: string; duration_minutes: number | null }>(
        (a, b) => supabase.from('workouts').select('id, duration_minutes').gte('performed_on', since).range(a, b))
      const ids = sessions.rows.map(s => s.id)
      const results: { player_id: string | null; session_id: string }[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const r = await all<{ player_id: string | null; session_id: string }>(
          (a, b) => supabase.from('results').select('player_id, session_id').in('session_id', ids.slice(i, i + 100)).not('player_id', 'is', null).range(a, b))
        if (r.error) { if (!cancelled) setError(r.error.message); return }
        results.push(...r.rows)
      }
      if (cancelled) return

      const minuteOf = new Map((mins.error ? [] : mins.rows).map(m => [m.id, m.duration_minutes]))
      const dayOf = new Map(sessions.rows.map(s => [s.id, s.session_date]))
      const playerOf = new Map(players.rows.map(p => [p.id, p]))
      const inputs = new Map<string, ActivityInput & { logged: { day: string; minutes: number }[]; games: string[] }>()
      const input = (id: string) => {
        let i = inputs.get(id)
        if (!i) {
          const p = playerOf.get(id)
          if (!p || p.is_guest) return null
          i = { playerId: id, rangatahi: p.division === 'Juniors' || p.division === 'Youth', logged: [], games: [] }
          inputs.set(id, i)
        }
        return i
      }
      for (const w of workouts.rows) {
        const m = workoutMinutes({
          performed_on: w.performed_on, duration_minutes: minuteOf.get(w.id) ?? null, effort_rating: null,
          entry_seconds: w.workout_entries.map(e => e.duration_seconds),
        })
        if (m > 0) input(w.player_id)?.logged.push({ day: w.performed_on, minutes: m })
      }
      const played = new Set<string>()
      for (const r of results) {
        const key = `${r.player_id}:${r.session_id}`
        if (!r.player_id || played.has(key)) continue
        played.add(key)
        const day = dayOf.get(r.session_id)
        if (day) input(r.player_id)?.games.push(day)
      }
      // The week in progress would drag every median down, so it waits until it ends.
      const thisWeek = weekStart(nzDay())
      setRows(weeklyActivity([...inputs.values()]).filter(r => r.week < thisWeek).reverse())
    })()
    return () => { cancelled = true }
  }, [])

  const downloadCsv = () => {
    if (!rows) return
    const csv = [
      COLS.map(c => c.label).join(','),
      ...rows.map(r => COLS.map(c => String(r[c.key]).replace(/,/g, ' ')).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `allsport-activity-report-${nzDay()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderLeft: '4px solid #F9B051', borderRadius: '16px', padding: '20px 22px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1 }}>
            Activity Report
          </div>
          <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '3px' }}>
            Weekly active minutes, last {WEEKS} weeks — individual players are never shown
          </div>
        </div>
        {rows && rows.length > 0 && (
          <button onClick={downloadCsv} style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: '999px', color: '#ccc',
            cursor: 'pointer', padding: '9px 16px', minHeight: 44, flexShrink: 0,
            fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
          }}>
            CSV ↓
          </button>
        )}
      </div>

      {error ? (
        <div style={{ fontSize: '13px', color: '#EA4742' }}>Could not load the report: {error}</div>
      ) : !rows ? (
        <div style={{ fontSize: '13px', color: '#555' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#555' }}>No week has {MIN_COHORT} or more active players yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr>
                {COLS.map(c => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '6px 8px', color: '#666', fontFamily: 'var(--font-label)', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid #1e1e1e' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.week}-${r.cohort}`}>
                  {COLS.map(c => (
                    <td key={c.key} style={{ padding: '6px 8px', color: r.cohort === 'all' ? '#ddd' : '#999', whiteSpace: 'nowrap', borderBottom: '1px solid #161616' }}>
                      {c.key === 'meetingGuideline' ? `${r.meetingGuideline} of ${r.players}` : String(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: '11.5px', color: '#555', marginTop: '10px', lineHeight: 1.5 }}>
        A game counts as {GAME_MINUTES} minutes. Guideline: {GUIDELINE_MINUTES.adult} minutes a week for adults, {GUIDELINE_MINUTES.rangatahi} for
        rangatahi (an hour a day). Only activity recorded through AllSport is counted, so these are floors, not totals.
      </div>
    </div>
  )
}
