import { describe, it, expect } from 'vitest'
import { replayAwards, replayMoments } from '@/lib/replayColours'
import { gradeStateFrom, type GradeInputs, type ResultRow } from '@/lib/loadGrades'
import { awardsToConfer } from '@/lib/autoConfer'
import { EVENTS } from '@/lib/eventData'
import { GAMES_REQUIRED } from '@/lib/grading'

// ─── The history replay ──────────────────────────────────────────────────────
// Step 6. A mistake here misdates every colour anyone has, once, permanently,
// and nothing downstream would notice. So these assert the invariants the
// replay must keep rather than a table of hand-worked rungs.

const GAME_MS = 100 * 60 * 1000
const domain1 = EVENTS.filter(e => e.domainNumber === 1)

/** Weekly games, every Maximal Strength event maxed out in each. */
function history(games: number): GradeInputs {
  const results: ResultRow[] = []
  for (let i = 0; i < games; i++) {
    const start = new Date(Date.UTC(2026, 0, 5 + 7 * i, 3)).toISOString()
    const end = new Date(Date.parse(start) + GAME_MS).toISOString()
    for (const ev of domain1) {
      results.push({
        raw_score: 9_999_999, weight_kg: 500, difficulty_tier: null,
        session_id: `s${i}`, points_earned: null, created_at: start,
        session_events: { event_name: ev.name },
        sessions: { is_active: false, points_awarded_at: end, started_at: start, ended_at: end },
        bodyweight_band: '70 to 80kg',
      })
    }
  }
  return {
    profile: { division: "Men's", age_years: 30 }, gender: 'Male', band: '70 to 80kg',
    results, entries: [], exemptions: [], awards: [], matches: [],
    // A recorded, empty void set: nothing voided. (Null would fall back to the
    // legacy rule, which reads a pointless finished game as voided.)
    voids: new Set<string>(),
    schemaReady: true, workoutsReady: true, complete: true,
  }
}

const NOW = '2026-09-21T00:00:00.000Z'
const closeOf = (i: number) =>
  new Date(Date.parse(new Date(Date.UTC(2026, 0, 5 + 7 * i, 3)).toISOString()) + GAME_MS).toISOString()

describe('replayAwards', () => {
  it('confers nothing on an empty history', () => {
    expect(replayAwards('p1', history(0), NOW)).toEqual([])
  })

  it('confers the first colour when the first game closes, not before', () => {
    const [first] = replayAwards('p1', history(6), NOW)
    expect(first.rung).toBe(1)
    expect(first.domain_number).toBe(1)
    expect(first.conferred_at).toBe(closeOf(0))
  })

  it('climbs one colour at a time, in order, never two at once in a domain', () => {
    const planned = replayAwards('p1', history(12), NOW).filter(a => a.domain_number === 1)
    expect(planned.map(a => a.rung)).toEqual(planned.map((_, i) => i + 1))
    const instants = planned.map(a => Date.parse(a.conferred_at))
    expect(new Set(instants).size).toBe(instants.length)
    expect([...instants].sort((a, b) => a - b)).toEqual(instants)
  })

  it('never dates a colour before the games quota was met', () => {
    // The games gate is the binding one in this fixture, so each colour must
    // land at the close of exactly the game that met its quota.
    for (const a of replayAwards('p1', history(12), NOW)) {
      expect(a.conferred_at).toBe(closeOf(GAMES_REQUIRED[a.rung] - 1))
    }
  })

  it('leaves nothing for the live recheck to add', () => {
    // THE invariant. Run the replay, then ask the live path — gradeStateFrom
    // and awardsToConfer, exactly what the route does — whether anything is
    // still due. If the backfill and the app agree, the answer is nothing.
    const inputs = history(12)
    const planned = replayAwards('p1', inputs, NOW)
    const live = gradeStateFrom('p1', inputs, { awards: planned })
    expect(awardsToConfer('p1', live)).toEqual([])
  })

  it('only confers in domains the player actually played', () => {
    const domains = new Set(replayAwards('p1', history(12), NOW).map(a => a.domain_number))
    expect([...domains]).toEqual([1])
  })

  it('records every award as conferred by nobody', () => {
    for (const a of replayAwards('p1', history(6), NOW)) expect(a.conferred_by).toBeNull()
  })

  it('ignores evidence from after "now"', () => {
    // A game that has not closed yet by `now` cannot have earned anything.
    const early = new Date(Date.parse(closeOf(0)) + 1000).toISOString()
    expect(replayAwards('p1', history(6), early).map(a => a.rung)).toEqual([1])
  })

  it('confers nothing before the grading schema exists', () => {
    expect(replayAwards('p1', { ...history(6), schemaReady: false }, NOW)).toEqual([])
  })
})

describe('replayMoments', () => {
  it('dedupes one instant written in two formats', () => {
    // Postgres and JavaScript format the same instant differently; the replay
    // must see one moment, not two.
    const inputs = history(1)
    inputs.results[0].sessions!.ended_at = '2026-01-05T04:40:00+00:00'
    inputs.results[1].sessions!.ended_at = '2026-01-05T04:40:00.000Z'
    // The WHOLE output: counting one spelling would pass a dedupe that kept both.
    expect(replayMoments('p1', inputs, NOW)).toEqual(['2026-01-05T04:40:00.000Z', NOW])
  })

  it('ends at now, and is in time order', () => {
    const moments = replayMoments('p1', history(3), NOW)
    expect(moments.at(-1)).toBe(NOW)
    expect([...moments].sort()).toEqual(moments)
  })

  it('counts a game from its CLOSE, falling back to start plus 100 minutes', () => {
    const inputs = history(1)
    for (const r of inputs.results) r.sessions!.ended_at = null
    expect(replayMoments('p1', inputs, NOW)[0]).toBe(closeOf(0))
  })
})

describe('replayMoments: whose games move a colour', () => {
  it('ignores a match the player was not in', () => {
    const inputs = history(1)
    inputs.matches = [{
      id: 'm', session_id: 's0', outcome: 'a', created_at: '2026-02-01T00:00:00.000Z', confirmed_at: null,
      event_name: 'Tennis', players: [{ player_id: 'other', side: 'a' }, { player_id: 'third', side: 'b' }],
    }] as unknown as GradeInputs['matches']
    expect(replayMoments('p1', inputs, NOW)).not.toContain('2026-02-01T00:00:00.000Z')
  })
})
