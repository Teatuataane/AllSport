import { describe, it, expect } from 'vitest'
import {
  brzycki, bestSet, riegel, estimateFromSets, estimateFromDistance, paceLabel,
  distanceRungs, takesDistance, takesSets, MAX_ESTIMATED_REPS, MAX_DISTANCE_RATIO,
} from '@/lib/naturalFormats'
import { getEventBySlug, decodeDiffTime, isTimedEffort } from '@/lib/eventData'

const running = getEventBySlug('running')!
const deadlift = getEventBySlug('deadlift')!

describe('Brzycki', () => {
  it('returns the load itself for a single', () => {
    expect(brzycki(100, 1)).toBe(100)
  })

  it('matches the published formula', () => {
    // 100 × 36 / (37 − 5) = 112.5
    expect(brzycki(100, 5)).toBe(112.5)
  })

  it('is the conservative of the two — never above Epley inside its range', () => {
    for (let r = 2; r <= MAX_ESTIMATED_REPS; r++) {
      const epley = 100 * (1 + r / 30)
      expect(brzycki(100, r)!).toBeLessThanOrEqual(epley + 1e-9)
    }
    // They meet at 10, to the 0.1kg the estimate is rounded to.
    expect(brzycki(100, 10)).toBeCloseTo(100 * (1 + 10 / 30), 1)
  })

  it('refuses reps it cannot estimate from', () => {
    expect(brzycki(100, 11)).toBeNull()
    expect(brzycki(100, 0)).toBeNull()
    expect(brzycki(0, 5)).toBeNull()
  })

  it('picks the best set by estimated 1RM, not by load', () => {
    const best = bestSet([{ weightKg: 105, reps: 1 }, { weightKg: 100, reps: 5 }])
    expect(best?.set.reps).toBe(5)
    expect(best?.oneRm).toBe(112.5)
  })

  it('ignores a set outside the range rather than dropping the whole entry', () => {
    const best = bestSet([{ weightKg: 60, reps: 20 }, { weightKg: 100, reps: 3 }])
    expect(best?.set.weightKg).toBe(100)
  })
})

describe('Riegel', () => {
  it('predicts a shorter distance from a longer one', () => {
    // 5km in 26:10 -> 1000m. T2 = 1570 × (1000/5000)^1.06
    const t = riegel(1570, 5000, 1000)!
    expect(t).toBe(Math.round(1570 * Math.pow(0.2, 1.06)))
    expect(t).toBeLessThan(1570 / 5 + 10)
  })

  it('never lengthens: a 1km does not predict a 5km', () => {
    expect(riegel(300, 1000, 5000)).toBeNull()
  })

  it('stops past the distance ratio, where the formula says more than the runner does', () => {
    expect(riegel(3600, 1000 * MAX_DISTANCE_RATIO, 1000)).not.toBeNull()
    expect(riegel(3600, 1000 * MAX_DISTANCE_RATIO + 1, 1000)).toBeNull()
  })
})

describe('what an entry becomes', () => {
  it('shows what was lifted first, then the estimate', () => {
    const e = estimateFromSets([{ weightKg: 100, reps: 5 }])!
    expect(e.score_label).toBe('100kg × 5 · est. 1RM 112.5kg')
    expect(e.raw_score).toBe(112.5)
    // What was actually done is what gets stored in the columns.
    expect(e.weight_kg).toBe(100)
    expect(e.reps).toBe(5)
  })

  it('calls a single what it is, with no estimate', () => {
    expect(estimateFromSets([{ weightKg: 100, reps: 1 }])!.score_label).toBe('100kg × 1')
  })

  it('converts a long run to the highest rung it covers', () => {
    const e = estimateFromDistance(running, 5000, 1570)!
    const rungs = distanceRungs(running).sort((a, b) => a.metres - b.metres)
    const top = rungs[rungs.length - 1]
    expect(e.difficulty_tier).toBe(top.name)
    expect(e.score_label).toContain('est.')
    // The score decodes to the predicted time on that rung.
    const { tierIdx, secs } = decodeDiffTime(e.raw_score, isTimedEffort(running.slug))
    expect(running.difficultyTiers![tierIdx].name).toBe(top.name)
    expect(secs).toBe(e.time_seconds)
  })

  it('does not call an exact rung an estimate', () => {
    const rung = distanceRungs(running).sort((a, b) => a.metres - b.metres)[0]
    const e = estimateFromDistance(running, rung.metres, 60)!
    expect(e.score_label).not.toContain('est.')
    expect(e.time_seconds).toBe(60)
  })

  it('earns nothing toward the standards below the shortest rung', () => {
    const shortest = Math.min(...distanceRungs(running).map(r => r.metres))
    expect(estimateFromDistance(running, shortest - 1, 60)).toBeNull()
  })

  it('works out the pace', () => {
    expect(paceLabel(5000, 1570)).toBe('5:14/km')
  })
})

describe('which events take which format', () => {
  it('sets belong to lifts', () => {
    expect(takesSets(deadlift)).toBe(true)
    expect(takesSets(running)).toBe(false)
    // Shoulder Dislocate borrows `strength` to measure a grip width in cm.
    expect(takesSets(getEventBySlug('shoulder-dislocate')!)).toBe(false)
  })

  it('distance belongs to raced distance events', () => {
    expect(takesDistance(running)).toBe(true)
    expect(takesDistance(deadlift)).toBe(false)
    // A hold ladder is not a distance ladder, even when it is timed.
    expect(takesDistance(getEventBySlug('wall-sit')!)).toBe(false)
  })
})
