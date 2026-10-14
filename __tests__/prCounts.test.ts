import { describe, it, expect } from 'vitest'
import { prMoments, prsAtGame, prsByYear } from '@/lib/prCounts'
import type { ResultRow } from '@/lib/loadGrades'
import type { WorkoutEntryRow } from '@/lib/workouts'

const result = (session: string, day: string, event: string, raw: number, tier: string | null = null): ResultRow => ({
  raw_score: raw, weight_kg: null, difficulty_tier: tier, session_id: session, points_earned: null,
  created_at: `${day}T05:00:00Z`, session_events: { event_name: event },
  sessions: { is_active: false, points_awarded_at: null, started_at: `${day}T04:30:00Z`, session_date: day },
})

const entry = (day: string, slug: string, raw: number, sessionId: string | null = null): WorkoutEntryRow => ({
  event_slug: slug, raw_score: raw, weight_kg: null, difficulty_tier: null,
  workouts: { player_id: 'p', performed_on: day, witnessed: false, created_at: `${day}T06:00:00Z`, session_id: sessionId },
})

const run = (results: ResultRow[], entries: WorkoutEntryRow[] = [], voids: Set<string> = new Set()) =>
  prMoments({ results, entries, voids })

describe('prMoments', () => {
  it('a first attempt is never a PR', () => {
    expect(run([result('g1', '2026-10-01', 'Deadlift', 100)])).toEqual([])
  })

  it('beating an earlier game is a PR at the later game', () => {
    const m = run([result('g1', '2026-10-01', 'Deadlift', 100), result('g2', '2026-10-03', 'Deadlift', 110)])
    expect(m).toEqual([{ eventName: 'Deadlift', day: '2026-10-03', sessionId: 'g2' }])
  })

  it('equalling the record is not a PR', () => {
    expect(run([result('g1', '2026-10-01', 'Deadlift', 100), result('g2', '2026-10-03', 'Deadlift', 100)])).toEqual([])
  })

  it('several attempts in one game count once, and never against each other', () => {
    const m = run([
      result('g1', '2026-10-01', 'Deadlift', 100),
      result('g2', '2026-10-03', 'Deadlift', 105), result('g2', '2026-10-03', 'Deadlift', 110),
      result('g3', '2026-10-05', 'Deadlift', 90), result('g3', '2026-10-05', 'Deadlift', 95),
    ])
    expect(m.map(x => x.sessionId)).toEqual(['g2'])
  })

  it('a logged workout sets the bar a game must beat', () => {
    const m = run([result('g1', '2026-10-05', 'Deadlift', 110)], [
      entry('2026-10-01', 'deadlift', 100), entry('2026-10-03', 'deadlift', 120),
    ])
    expect(m).toEqual([{ eventName: 'Deadlift', day: '2026-10-03', sessionId: null }])
  })

  it('a voided game neither sets nor holds a record', () => {
    const m = run([
      result('g1', '2026-10-01', 'Deadlift', 100),
      result('void', '2026-10-02', 'Deadlift', 200),
      result('g2', '2026-10-03', 'Deadlift', 110),
    ], [], new Set(['void']))
    expect(m.map(x => x.sessionId)).toEqual(['g2'])
  })

  it('a new level counts once the event has been played', () => {
    // Pushups: level index × 10000 + reps. Knee Pushup (1) then Elevated Pushup (2).
    const m = run([
      result('g1', '2026-10-01', 'Pushups', 10030, 'Knee Pushup'),
      result('g2', '2026-10-03', 'Pushups', 20010, 'Elevated Pushup'),
    ])
    expect(m.map(x => x.sessionId)).toEqual(['g2'])
  })
})

describe('prsAtGame and prsByYear', () => {
  const m = run([
    result('g1', '2025-12-01', 'Deadlift', 100), result('g2', '2025-12-20', 'Deadlift', 110),
    result('g3', '2026-01-10', 'Deadlift', 120),
  ])
  it('names the events PR\'d at a game', () => {
    expect([...prsAtGame(m, 'g3')]).toEqual(['Deadlift'])
    expect(prsAtGame(m, 'g1').size).toBe(0)
  })
  it('counts PRs per NZ year', () => {
    expect(prsByYear(m)).toEqual(new Map([[2025, 1], [2026, 1]]))
  })
})
