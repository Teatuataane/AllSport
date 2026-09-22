import { describe, it, expect } from 'vitest'
import { gradeStateFrom, type GradeInputs, type ResultRow } from '@/lib/loadGrades'

// ─── gradeStateFrom({ asOf }) ────────────────────────────────────────────────
// The replay's question: what could this player be graded on at that moment?
// Asserted directly here rather than only through replayAwards' outcomes.

const GAME_MS = 100 * 60 * 1000
const row = (session: string, start: string, event = 'Deadlift', kg = 200): ResultRow => ({
  raw_score: kg, weight_kg: kg, difficulty_tier: null, session_id: session, points_earned: null,
  created_at: start, session_events: { event_name: event },
  sessions: {
    is_active: false, points_awarded_at: start, started_at: start,
    ended_at: new Date(Date.parse(start) + GAME_MS).toISOString(),
  },
  bodyweight_band: '70 to 80kg',
})

const inputs = (results: ResultRow[]): GradeInputs => ({
  profile: { division: "Men's", age_years: 30 }, gender: 'Male', band: '70 to 80kg',
  results, entries: [], exemptions: [], awards: [], matches: [],
  voids: new Set<string>(), schemaReady: true, workoutsReady: true, complete: true,
})

const JAN = '2026-01-05T03:00:00.000Z'
const FEB = '2026-02-05T03:00:00.000Z'

describe('gradeStateFrom asOf', () => {
  it('ignores a result from after asOf, and counts it with no asOf', () => {
    const i = inputs([row('s1', JAN, 'Deadlift', 60), row('s2', FEB, 'Deadlift', 200)])
    const before = gradeStateFrom('p', i, { asOf: '2026-01-31T00:00:00Z' })
    const live = gradeStateFrom('p', i)
    expect(before.games).toBe(1)
    expect(live.games).toBe(2)
    expect(before.grades.events.get('deadlift')!.rung).toBeLessThan(live.grades.events.get('deadlift')!.rung)
  })

  it('does not count a game that had started but not yet closed at asOf', () => {
    const i = inputs([row('s1', JAN)])
    // Thirty minutes in: the game exists, but it is not yet a finished game.
    const midGame = new Date(Date.parse(JAN) + 30 * 60 * 1000).toISOString()
    expect(gradeStateFrom('p', i, { asOf: midGame }).games).toBe(0)
    const after = new Date(Date.parse(JAN) + GAME_MS).toISOString()
    expect(gradeStateFrom('p', i, { asOf: after }).games).toBe(1)
  })
})

describe('gradeStateFrom asOf: every other input respects the moment too', () => {
  const MID = '2026-01-20T00:00:00.000Z'

  it('ignores an exemption granted after asOf', () => {
    const i = { ...inputs([row('s1', JAN)]), exemptions: [{ event_slug: 'deadlift', created_at: FEB }] }
    expect(gradeStateFrom('p', i, { asOf: MID }).exemptions.has('deadlift')).toBe(false)
    expect(gradeStateFrom('p', i).exemptions.has('deadlift')).toBe(true)
  })

  it('ignores a logged workout saved after asOf', () => {
    const entry = {
      event_slug: 'deadlift', count: 1, volume_distance_m: null, raw_score: 300, weight_kg: 300,
      difficulty_tier: null, bodyweight_band: '70 to 80kg',
      workouts: { player_id: 'p', performed_on: '2026-02-05', witnessed: false, created_at: FEB, session_id: null },
    }
    const i = { ...inputs([row('s1', JAN, 'Deadlift', 60)]), entries: [entry] }
    const before = gradeStateFrom('p', i, { asOf: MID }).grades.events.get('deadlift')!.rung
    const after = gradeStateFrom('p', i).grades.events.get('deadlift')!.rung
    expect(before).toBeLessThan(after)
  })

  it('ignores a match recorded after asOf', () => {
    // Both players recorded the same game as their own win: a disputed game.
    // It exists from FEB, so at MID nothing is disputed yet.
    const rec = (id: string, winner: string, loser: string) => ({
      id, session_id: 's1', outcome: 'a', created_at: FEB, confirmed_at: null, event_name: 'Tennis',
      players: [{ player_id: winner, side: 'a' }, { player_id: loser, side: 'b' }],
    })
    const i = { ...inputs([row('s1', JAN)]), matches: [rec('m1', 'p', 'q'), rec('m2', 'q', 'p')] } as unknown as GradeInputs
    expect(gradeStateFrom('p', i).disputed.get('Tennis')).toBe(1)
    expect(gradeStateFrom('p', i, { asOf: MID }).disputed.get('Tennis') ?? 0).toBe(0)
  })
})
