import { describe, it, expect } from 'vitest'
import { bestScoreLabel, domainExtremesByColour, bestEventByColour, nextDomainColour } from '@/lib/colourDisplay'
import { getEventByName } from '@/lib/eventData'

const slug = (name: string) => getEventByName(name)!.slug

describe('bestScoreLabel', () => {
  it('writes the tier name where formatPR writes D-number', () => {
    const label = bestScoreLabel({ slug: slug('Pushup Contest'), best: { raw_score: 30001, weight_kg: null, difficulty_tier: '1 Arm Pushup' } })
    expect(label).toBe('1 Arm Pushup · 1 reps')
  })

  it('shows a lift as its weight', () => {
    expect(bestScoreLabel({ slug: slug('Deadlift'), best: { raw_score: 140, weight_kg: 140, difficulty_tier: null } })).toBe('140 kg')
  })

  it('falls back to the rating, and to nothing', () => {
    expect(bestScoreLabel({ slug: slug('Wrestling'), rating: { rating: 1123.6, games: 11 } })).toBe('Rating 1124 · 11 games')
    expect(bestScoreLabel({ slug: slug('Deadlift') })).toBeNull()
  })
})

describe('domainExtremesByColour', () => {
  it('ranks by colour held, Top % only breaking a tie', () => {
    const held = new Map([[1, 3], [2, 3], [3, 1]])
    const pct = new Map<number, number | null>([[1, 40], [2, 10], [3, 1]])
    const r = domainExtremesByColour(held, pct)!
    expect(r.best).toMatchObject({ domainNumber: 2, rung: 3 })
    // Domains with nothing held are the weakest, whatever their Top %.
    expect(r.weakest.rung).toBe(0)
  })

  it('names nothing while no domain holds a colour', () => {
    expect(domainExtremesByColour(new Map(), new Map())).toBeNull()
  })
})

describe('bestEventByColour', () => {
  it('takes the highest event colour, Top % breaking a tie', () => {
    const events = new Map([
      ['a', { slug: slug('Deadlift'), rung: 4 }],
      ['b', { slug: slug('Pushup Contest'), rung: 4 }],
      ['c', { slug: slug('Javelin'), rung: 2 }],
    ])
    const pct = new Map([['Deadlift', 30], ['Pushup Contest', 5]])
    expect(bestEventByColour(events, pct)).toEqual({ slug: slug('Pushup Contest'), rung: 4 })
    expect(bestEventByColour(new Map([['c', { slug: 'x', rung: 0 }]]))).toBeNull()
  })
})

describe('nextDomainColour', () => {
  it('counts the steps to the next colour across the six slots', () => {
    // 28 over six is Kōwhai; Kākāriki needs 30.
    expect(nextDomainColour({ slots: 6, average: 28 / 6 }, 0)).toEqual({ next: 5, steps: 2, progress: 4 / 6 })
  })
  it('aims above a colour already held, even when the scores sit below it', () => {
    // Held Kahurangi (6), scores now average 4: the next is Poroporo (7), 42 - 24.
    expect(nextDomainColour({ slots: 6, average: 4 }, 6)).toEqual({ next: 7, steps: 18, progress: 0 })
  })
  it('is null at the top, and when nothing can be graded', () => {
    expect(nextDomainColour({ slots: 6, average: 12 }, 12)).toBeNull()
    expect(nextDomainColour({ slots: 0, average: 0 }, 0)).toBeNull()
  })
})

describe('bestScoreLabel prefers the label written at the time', () => {
  it('keeps the estimate marker on a natural-format entry', () => {
    const label = bestScoreLabel({
      slug: slug('Deadlift'),
      best: { raw_score: 112.5, weight_kg: 112.5, difficulty_tier: null, score_label: '100kg × 5 · est. 1RM 112.5kg' },
    })
    expect(label).toBe('100kg × 5 · est. 1RM 112.5kg')
  })
})
