// ── A lift grades on its estimated 1RM, everywhere (29 Sept 2026) ────────────
// Every older lift test stores raw_score equal to weight_kg, so none of them
// could tell whether grading reads the estimate or the load on the bar. These
// rows deliberately differ, which is what pins the switch.
//
// What this pins:
//   1. liftKg reads raw_score, and falls back to weight_kg only when there is
//      no usable score (a legacy or broken row).
//   2. The colour a lift reaches, live and on HOME, comes from the estimate.
//   3. liveEventRung (the game screen's "This game" colour) is the same rung
//      the game report counts, and is 0 whenever it cannot know.
//   4. The next-time gap is measured from the estimate, not the load.
//   5. estimatedOneRm / liftLabel / brzycki treat odd rep counts safely.

import { describe, it, expect } from 'vitest'
import { liftKg, type GradePlayer } from '@/lib/playerGrades'
import { scoreRung, liveEventRung } from '@/lib/scoreColour'
import { eventRungInGame } from '@/lib/leaderboardScores'
import { getEventBySlug, getEventByName } from '@/lib/eventData'
import { estimatedOneRm, liftLabel } from '@/lib/scoring'
import { brzycki } from '@/lib/naturalFormats'
import { nextStep, nextStepLine } from '@/lib/gameReport'
import { gradeStateFrom, type GradeInputs, type ResultRow } from '@/lib/loadGrades'

const man: GradePlayer = { division: "Men's", ageYears: 30, gender: 'male' }
const deadlift = getEventBySlug('deadlift')!
const liftRow = (raw: number | null, kg: number | null) => ({ raw_score: raw, weight_kg: kg, difficulty_tier: null })

describe('liftKg', () => {
  it('reads the estimated 1RM, not the load on the bar', () => {
    expect(liftKg({ raw_score: 39.4, weight_kg: 35 })).toBe(39.4)
  })

  it('falls back to the load when the row has no usable score', () => {
    expect(liftKg({ raw_score: null, weight_kg: 35 })).toBe(35)
    expect(liftKg({ raw_score: 0, weight_kg: 35 })).toBe(35)
    expect(liftKg({ raw_score: -5, weight_kg: 35 })).toBe(35)
    expect(liftKg({ raw_score: Number.NaN, weight_kg: 35 })).toBe(35)
    expect(liftKg({ raw_score: Number.POSITIVE_INFINITY, weight_kg: 35 })).toBe(35)
  })

  it('is 0 when there is neither', () => {
    expect(liftKg({ raw_score: null, weight_kg: null })).toBe(0)
  })
})

describe('the colour a lift reaches', () => {
  it('grades the estimate: 130kg for reps (est. 140kg) is Poroporo at 100kg bodyweight', () => {
    // 1.36× is 135kg. The load alone (130kg) would not clear it; the estimate does.
    expect(scoreRung(deadlift, [liftRow(140, 130)], man, 100)).toBe(7)
    expect(scoreRung(deadlift, [liftRow(130, 130)], man, 100)).toBeLessThan(7)
  })

  it('grades on the load when the score is unusable (0), rather than dropping the lift', () => {
    expect(scoreRung(deadlift, [liftRow(0, 140)], man, 100)).toBe(7)
  })

  it('never grades a row with no score at all: eventGrade drops it before liftKg sees it', () => {
    expect(scoreRung(deadlift, [liftRow(null, 140)], man, 100)).toBe(0)
  })
})

describe('liveEventRung: this game\'s colour on the game screen', () => {
  it('is the rung the game report counts for the same rows', () => {
    const rows = [liftRow(140, 130)]
    const live = liveEventRung(deadlift, rows, man, 100)
    expect(live).toBe(7)
    expect(live).toBe(eventRungInGame('Deadlift', rows.map(r => ({ ...r, event_name: 'Deadlift', bodyweightKg: 100 })), man))
  })

  it('is 0 when it cannot know: no event, no player (a guest), or nothing scored', () => {
    expect(liveEventRung(undefined, [liftRow(140, 130)], man, 100)).toBe(0)
    expect(liveEventRung(deadlift, [liftRow(140, 130)], null, 100)).toBe(0)
    expect(liveEventRung(deadlift, [], man, 100)).toBe(0)
  })

  it('gives a lift with no bodyweight for the day nothing', () => {
    expect(liveEventRung(deadlift, [liftRow(140, 130)], man, null)).toBe(0)
  })

  it('pays a game result its floor: a win is Kahurangi (6)', () => {
    const tennis = getEventBySlug('tennis')!
    const game = tennis.difficultyTiers!.find(t => t.scoring === 'sport')!
    const idx = tennis.difficultyTiers!.indexOf(game)
    const win = { raw_score: idx * 10000 + 2, weight_kg: null, difficulty_tier: game.name }
    expect(liveEventRung(tennis, [win], man, null)).toBe(6)
  })
})

describe('next time, for a lift', () => {
  it('measures the gap from the estimate, not the load', () => {
    const JAN = '2026-01-10T09:00:00.000Z'
    const row: ResultRow = {
      // 95kg for reps, estimated 100kg. At 80kg bodyweight Poroporo is 110kg.
      raw_score: 100, weight_kg: 95, difficulty_tier: null, session_id: 'a', points_earned: null,
      created_at: JAN, session_events: { event_name: 'Deadlift' },
      sessions: {
        is_active: false, points_awarded_at: JAN, started_at: JAN,
        ended_at: new Date(Date.parse(JAN) + 100 * 60 * 1000).toISOString(), session_date: '2026-01-10',
      },
    }
    const i: GradeInputs = {
      profile: { division: "Men's", age_years: 30 }, gender: 'Male', band: null,
      bodyweights: [{ measured_on: '2026-01-01', kg: 80 }], bodyweightsLive: true,
      results: [row], entries: [], exemptions: [], awards: [], matches: [],
      voids: new Set<string>(), schemaReady: true, workoutsReady: true, complete: true,
    }
    const step = nextStep(['Deadlift'], gradeStateFrom('p', i).grades, { ...man, gender: 'Male' }, i.bodyweights!, '2026-03-01')!
    expect(getEventByName('Deadlift')).toBeTruthy()
    expect(nextStepLine(step)).toBe('Deadlift: est. 1RM 10kg higher for Poroporo')
  })
})

describe('odd rep counts', () => {
  it('estimatedOneRm treats zero, negative and non-numeric reps as a single', () => {
    expect(estimatedOneRm(100, 0)).toBe(100)
    expect(estimatedOneRm(100, -3)).toBe(100)
    expect(estimatedOneRm(100, Number.NaN)).toBe(100)
    expect(estimatedOneRm(100, undefined)).toBe(100)
  })

  it('estimatedOneRm counts a fractional rep as the whole reps below it', () => {
    expect(estimatedOneRm(100, 5.7)).toBe(estimatedOneRm(100, 5))
  })

  it('liftLabel writes only the load when reps are missing', () => {
    expect(liftLabel(35, null)).toBe('35kg')
    expect(liftLabel(35, undefined)).toBe('35kg')
    expect(liftLabel(35, -2)).toBe('35kg')
  })

  it('brzycki refuses a set with no countable reps', () => {
    expect(brzycki(100, Number.NaN)).toBeNull()
    expect(brzycki(100, Number.POSITIVE_INFINITY)).toBeNull()
    expect(brzycki(-10, 5)).toBeNull()
  })
})

// ── Load-and-hold colours ask for both halves (Tāne, 29 Sept 2026) ───────────
// A weight+time score ranks heavier-first, so read as one number "5kg · 30s"
// was passed by 15kg held for a second. A colour now needs the load AND the time.

import { meetsLoadHold, rungForLoadHold } from '@/lib/grading'
import { describeRawGap } from '@/lib/gameReport'
import { computeScoreVals, EMPTY_VALS } from '@/lib/scoring'
import { liveGameColourRung } from '@/lib/scoreColour'
import { STANDARDS } from '@/lib/standards'

const toeLift = getEventBySlug('toe-lift')!
const hold = (kg: number, secs: number) =>
  computeScoreVals('weight+time', toeLift, { ...EMPTY_VALS, weightKg: String(kg), timeMins: '0', timeSecs: String(secs) })!.raw_score
const toeLadder = STANDARDS['toe-lift'].all!

describe('load-and-hold colours', () => {
  it('a heavier load held for one second earns nothing the load alone would', () => {
    expect(meetsLoadHold(hold(15, 1), hold(5, 30))).toBe(false)
    expect(rungForLoadHold(hold(15, 1), toeLadder, 'Open')).toBeLessThan(4)
  })

  it('needs at least the load and at least the time', () => {
    expect(meetsLoadHold(hold(5, 30), hold(5, 30))).toBe(true)
    expect(meetsLoadHold(hold(7.5, 45), hold(5, 30))).toBe(true)
    expect(meetsLoadHold(hold(5, 29), hold(5, 30))).toBe(false)
    expect(meetsLoadHold(hold(2.5, 90), hold(5, 30))).toBe(false)
  })

  it('reaches the top only with 15kg for 30 seconds', () => {
    expect(rungForLoadHold(hold(15, 30), toeLadder, 'Open')).toBe(12)
    // Strictly both: one second short of every 30-second colour leaves only
    // the 15-second bodyweight hold, however heavy the load.
    expect(rungForLoadHold(hold(15, 29), toeLadder, 'Open')).toBe(1)
  })

  it('grades a bodyweight hold on its seconds', () => {
    expect(rungForLoadHold(hold(0, 30), toeLadder, 'Open')).toBe(2)
  })

  it('is what the live colour and HOME use (eventGrade)', () => {
    const row = (raw: number) => ({ raw_score: raw, weight_kg: null, difficulty_tier: null })
    expect(scoreRung(toeLift, [row(hold(15, 1))], man, null)).toBe(rungForLoadHold(hold(15, 1), toeLadder, 'Open'))
    // The best row is the one reaching the highest colour, not the heaviest.
    expect(scoreRung(toeLift, [row(hold(15, 1)), row(hold(5, 60))], man, null)).toBe(8)
  })

  it('names both halves when the load must go up, and only the time when it need not', () => {
    expect(describeRawGap(toeLift, hold(2.5, 60), hold(5, 30))).toBe('5kg for 30s')
    expect(describeRawGap(toeLift, hold(5, 20), hold(5, 30))).toBe('10s longer')
    expect(describeRawGap(toeLift, hold(15, 1), hold(5, 30))).toBe('29s longer')
  })
})

describe('the live game colour', () => {
  const row = (raw: number) => ({ raw_score: raw, weight_kg: null, difficulty_tier: null })
  const ten = Array.from({ length: 10 }, () => ({ official: true, ev: toeLift, rows: [row(hold(15, 30))] }))

  it('is the official events’ rungs summed and divided by ten', () => {
    expect(liveGameColourRung(ten, man, null)).toBe(12)
  })

  it('never counts an added or swapped event', () => {
    const added = ten.map((s, i) => (i === 0 ? { ...s, official: false } : s))
    expect(liveGameColourRung(added, man, null)).toBe(Math.floor((12 * 9) / 10))
  })

  it('is 0 for a guest', () => {
    expect(liveGameColourRung(ten, null, null)).toBe(0)
  })
})
