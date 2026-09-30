import { describe, it, expect } from 'vitest'
import { getEventBySlug } from '@/lib/eventData'
import { scoreRung, rungPaint, rungSegment, workoutColourRung, workoutSlugs } from '@/lib/scoreColour'
import { RAINBOW } from '@/lib/domainColours'

// The live screen colours a scored button by the grade its score reaches.
// It must agree with HOME, so these pin it to eventGrade's answers.

const man = { division: "Men's", ageYears: 30, gender: 'male' }
const deadlift = getEventBySlug('deadlift')!
const lift = (kg: number) => ({ raw_score: kg, weight_kg: kg, difficulty_tier: null })

describe('the colour a score reaches', () => {
  it('grades a lift against the day’s bodyweight', () => {
    // 140kg at 100kg bodyweight clears 1.36× (135kg) but not 1.49× (150kg): Poroporo.
    expect(scoreRung(deadlift, [lift(140)], man, 100)).toBe(7)
    // The same lift at a heavier bodyweight is worth less.
    expect(scoreRung(deadlift, [lift(140)], man, 120)).toBeLessThan(7)
  })

  it('takes the best of the day’s rows', () => {
    expect(scoreRung(deadlift, [lift(60), lift(140), lift(100)], man, 100)).toBe(7)
  })

  it('gives no colour to a lift with no bodyweight declared', () => {
    expect(scoreRung(deadlift, [lift(140)], man, null)).toBe(0)
  })

  it('gives no colour when the player is unknown, as a guest is', () => {
    expect(scoreRung(deadlift, [lift(140)], null, 100)).toBe(0)
  })

  it('gives no colour before anything is scored', () => {
    expect(scoreRung(deadlift, [], man, 100)).toBe(0)
  })

  it('gives a won game no drill colour: game colours come from the rating', () => {
    const tennis = getEventBySlug('tennis')!
    const game = tennis.difficultyTiers!.find(t => t.scoring === 'sport')!
    const idx = tennis.difficultyTiers!.indexOf(game)
    expect(scoreRung(tennis, [{ raw_score: idx * 10000 + 2, weight_kg: null, difficulty_tier: game.name }], man, null)).toBe(0)
  })
})

describe('how a colour is drawn', () => {
  it('draws nothing below Kiwikiwi', () => {
    expect(rungPaint(0)).toBeNull()
    expect(rungSegment(0)).toBeNull()
  })

  it('draws a plain colour as a tint and a border', () => {
    const p = rungPaint(5)!
    expect(p.name).toBe('Kākāriki')
    expect(p.border).toContain('#4DB26E')
    expect(p.ink).toBe('#4DB26E')
  })

  it('draws Uenuku with a rainbow border and Taniwha as a black card', () => {
    expect(rungPaint(11)!.rainbow).toBe(true)
    expect(rungPaint(11)!.background).toContain(RAINBOW)
    expect(rungPaint(12)!.background).toBe('#000')
    expect(rungPaint(12)!.border).toContain('#ffffff')
  })

  it('never fills a progress segment black, which would vanish on the dark theme', () => {
    expect(rungSegment(12)).toBe('#ffffff')
    expect(rungSegment(11)).toBe(RAINBOW)
  })
})

// A personal workout has a colour of its own (Tāne, 30 Sept 2026). Each event
// takes the colour its best score reaches, a planned event not scored counts
// as Mā, and the workout is the average, rounded down: a game's rule, over the
// workout's own event count.
describe('a workout’s colour', () => {
  const lunge = getEventBySlug('loaded-lunge')

  it('is the event’s colour when it holds one event', () => {
    expect(workoutColourRung([{ ev: deadlift, rows: [lift(140)] }], man, 100)).toBe(7)
  })

  it('averages over every planned event, a skipped one counting as Mā', () => {
    // Poroporo (7) and nothing: 3.5, rounded down.
    expect(workoutColourRung([
      { ev: deadlift, rows: [lift(140)] },
      { ev: lunge, rows: [] },
    ], man, 100)).toBe(3)
  })

  it('is Mā for an unknown player or an empty plan', () => {
    expect(workoutColourRung([{ ev: deadlift, rows: [lift(140)] }], null, 100)).toBe(0)
    expect(workoutColourRung([], man, 100)).toBe(0)
  })

  it('counts a scored event dropped from the plan, and never counts one twice', () => {
    expect(workoutSlugs(['deadlift'], ['deadlift', 'loaded-lunge', null, 'deadlift']))
      .toEqual(['deadlift', 'loaded-lunge'])
    expect(workoutSlugs(null, ['wall-sit'])).toEqual(['wall-sit'])
  })
})
