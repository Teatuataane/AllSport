import { describe, it, expect } from 'vitest'
import {
  gameColourRung, gameScores, gamesInOrder, eventFlags, averageBefore, awardsForGame,
  describeRawGap, nextStep, nextStepLine, AWARD_WINDOW_MS,
} from '@/lib/gameReport'
import { gradeStateFrom, leaderboardScoresFrom, type GradeInputs, type ResultRow, type GradeAward } from '@/lib/loadGrades'
import { getEventByName } from '@/lib/eventData'
import type { GradePlayer } from '@/lib/playerGrades'

// ─── A player's own game report ──────────────────────────────────────────────
// What this pins:
//   1. A game's colour score is exactly what it added to the Season board.
//   2. The game's colour is the score over ten events, rounded down.
//   3. "First time" and "Colour up" are judged against EARLIER games only.
//   4. Colours earned belong to the game they landed during or just after.
//   5. The next-time line speaks the event's units and picks the closest event.

const GAME_MS = 100 * 60 * 1000
const MEN: GradePlayer = { division: "Men's", ageYears: 30, gender: 'Male' }

const row = (session: string, start: string, event: string, raw: number, over: Partial<ResultRow> = {}): ResultRow => ({
  raw_score: raw, weight_kg: null, difficulty_tier: null, session_id: session, points_earned: null,
  created_at: start, session_events: { event_name: event },
  sessions: {
    is_active: false, points_awarded_at: start, started_at: start,
    ended_at: new Date(Date.parse(start) + GAME_MS).toISOString(),
    session_date: start.slice(0, 10),
  },
  ...over,
})

const inputs = (results: ResultRow[], awards: GradeAward[] = []): GradeInputs => ({
  profile: { division: "Men's", age_years: 30 }, gender: 'Male', band: null,
  bodyweights: [{ measured_on: '2026-01-01', kg: 80 }], bodyweightsLive: true,
  results, entries: [], exemptions: [], awards, matches: [],
  voids: new Set<string>(), schemaReady: true, workoutsReady: true, complete: true,
})

const JAN = '2026-01-05T03:00:00.000Z'
const FEB = '2026-02-05T03:00:00.000Z'
const MAR = '2026-03-05T03:00:00.000Z'

describe('colour score', () => {
  it('matches what the game adds to the Season board', () => {
    const i = inputs([
      row('a', JAN, 'Forward Fold', 20030),
      row('b', FEB, 'Forward Fold', 30030),
      row('b', FEB, 'Deadlift', 100, { weight_kg: 100 }),
    ])
    const scores = gameScores('p', i)
    const total = [...scores.values()].reduce((s, g) => s + g.points, 0)
    expect(total).toBe(leaderboardScoresFrom('p', i, gradeStateFrom('p', i), 2026).points)
    expect(scores.get('a')!.points).toBe(6)
    expect(scores.get('b')!.rungs.get('Deadlift')).toBe(6)
  })

  it('includes a game still in progress, marked open', () => {
    const live = row('live', MAR, 'Forward Fold', 20030)
    live.sessions!.is_active = true
    const g = gameScores('p', inputs([live])).get('live')!
    expect(g.closed).toBe(false)
    expect(g.points).toBe(6)
  })

  it('plays at the score over ten events, rounded down, never past Taniwha', () => {
    expect(gameColourRung(0)).toBe(0)
    expect(gameColourRung(74)).toBe(7)
    expect(gameColourRung(79)).toBe(7)
    expect(gameColourRung(120)).toBe(12)
    expect(gameColourRung(500)).toBe(12)
  })
})

describe('what was new', () => {
  const i = inputs([
    row('a', JAN, 'Forward Fold', 20030),
    row('b', FEB, 'Forward Fold', 30030),
    row('b', FEB, 'Bridge', 60),
    row('c', MAR, 'Forward Fold', 20030),
  ])
  const scores = gameScores('p', i)

  it('orders games by when they closed', () => {
    expect(gamesInOrder(scores).map(g => g.sessionId)).toEqual(['a', 'b', 'c'])
  })

  it('marks a first event and a colour reached for the first time', () => {
    const f = eventFlags(scores, 'b')
    expect(f.get('Bridge')).toEqual({ firstTime: true, colourUp: false })
    expect(f.get('Forward Fold')).toEqual({ firstTime: false, colourUp: true })
  })

  it('does not call a colour new when an earlier game already reached it', () => {
    expect(eventFlags(scores, 'c').get('Forward Fold')).toEqual({ firstTime: false, colourUp: false })
  })

  it('averages only the games before, and says nothing for a first game', () => {
    expect(averageBefore(scores, 'a')).toBeNull()
    expect(averageBefore(scores, 'c')).toBe((scores.get('a')!.points + scores.get('b')!.points) / 2)
  })
})

describe('colours earned in a game', () => {
  const award = (at: string, domain = 7): GradeAward => ({ domain_number: domain, rung: 3, grade_name: 'Karaka', conferred_at: at })
  const close = (start: string) => Date.parse(start) + GAME_MS
  const scores = gameScores('p', inputs([row('a', JAN, 'Forward Fold', 20030), row('b', FEB, 'Forward Fold', 20030)]))

  it('takes an award from the game or the hours after it', () => {
    const during = new Date(close(JAN) - 1000).toISOString()
    const evening = new Date(close(JAN) + 3 * 60 * 60 * 1000).toISOString()
    expect(awardsForGame([award(during), award(evening, 8)], scores, 'a')).toHaveLength(2)
  })

  it('leaves out an award from days later, or from before the game', () => {
    const later = new Date(close(JAN) + AWARD_WINDOW_MS + 1000).toISOString()
    const before = new Date(Date.parse(JAN) - 60_000).toISOString()
    expect(awardsForGame([award(later), award(before)], scores, 'a')).toEqual([])
  })
})

describe('next time', () => {
  it('puts the gap in the event\'s own units', () => {
    const fold = getEventByName('Forward Fold')!
    expect(describeRawGap(fold, 20020, 20030)).toBe('10s longer')
    expect(describeRawGap(fold, 20030, 30010)).toBe('move up to Standing · Straight')
    // Running is raced: the within-tier term is 10000 minus the seconds.
    expect(describeRawGap(getEventByName('Running')!, 19860, 19875)).toBe('15s faster')
    expect(describeRawGap(getEventByName('Pause Dips')!, 20005, 20015)).toBe('10 more reps')
    expect(describeRawGap(fold, 20030, 20030)).toBeNull()
  })

  it('states a lift in kilograms at the player\'s latest bodyweight', () => {
    // 80kg: Kahurangi is 95kg, Poroporo 110kg, so a 100kg best is 10kg short.
    const i = inputs([row('a', JAN, 'Deadlift', 100, { weight_kg: 100 })])
    const step = nextStep(['Deadlift'], gradeStateFrom('p', i).grades, MEN, i.bodyweights!, '2026-03-01')!
    expect(nextStepLine(step)).toBe('Deadlift: 10kg more for Poroporo')
  })

  it('leaves a lift out when no bodyweight has been declared', () => {
    const i = inputs([row('a', JAN, 'Deadlift', 100, { weight_kg: 100 })])
    expect(nextStep(['Deadlift'], gradeStateFrom('p', i).grades, MEN, [], '2026-03-01')).toBeNull()
  })

  it('picks the event sitting closest to its next colour', () => {
    // Forward Fold 20029 is one second short; Bridge 60 sits at the bottom of its step.
    const i = inputs([row('a', JAN, 'Forward Fold', 20029), row('a', JAN, 'Bridge', 60)])
    const step = nextStep(['Forward Fold', 'Bridge'], gradeStateFrom('p', i).grades, MEN, [], '2026-03-01')!
    expect(step.eventName).toBe('Forward Fold')
    expect(step.gap).toBe('1s longer')
  })
})
