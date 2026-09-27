import { describe, it, expect } from 'vitest'
import { bestScoreLabel, domainExtremesByColour, bestEventByColour, colourBlurb, topSlotRungs } from '@/lib/colourDisplay'
import { getEventByName } from '@/lib/eventData'
import { GRADES } from '@/lib/grading'

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

describe('bestScoreLabel prefers the label written at the time', () => {
  it('keeps the estimate marker on a natural-format entry', () => {
    const label = bestScoreLabel({
      slug: slug('Deadlift'),
      best: { raw_score: 112.5, weight_kg: 112.5, difficulty_tier: null, score_label: '100kg × 5 · est. 1RM 112.5kg' },
    })
    expect(label).toBe('100kg × 5 · est. 1RM 112.5kg')
  })
})

describe('colourBlurb — what an overall colour means', () => {
  it('reads the stat off the ladder: none below Whero, "N in 10", half, then Top %', () => {
    expect(colourBlurb(0)).toEqual({ line: 'Everyone starts here', stat: null })
    expect(colourBlurb(1).stat).toBeNull()
    expect(colourBlurb(2)).toEqual({ line: 'Past the beginner stage', stat: 'Better than 1 in 10 people' })
    expect(colourBlurb(6).stat).toBe('Better than half of people')
    expect(colourBlurb(9).stat).toBe('Better than 8 in 10 people')
    expect(colourBlurb(10).stat).toBe('Top 10%')
    expect(colourBlurb(12)).toEqual({ line: 'One in a hundred', stat: 'Top 1%' })
  })
  it('has a line for every rung', () => {
    for (let r = 0; r <= 12; r++) expect(colourBlurb(r).line.length).toBeGreaterThan(0)
  })
})

describe('topSlotRungs — the six squares on a domain row', () => {
  it('is the counted events best first, padded with Mā to the slots', () => {
    const events = new Map([['a', { rung: 5 }], ['b', { rung: 3 }]])
    expect(topSlotRungs({ slots: 6, counted: ['a', 'b'] }, events)).toEqual([5, 3, 0, 0, 0, 0])
    expect(topSlotRungs({ slots: 0, counted: [] }, events)).toEqual([])
  })
})

describe('topSlotRungs — edges', () => {
  it('drops counted events past the slots, and reads an unknown event as Mā', () => {
    const events = new Map([['a', { rung: 7 }], ['b', { rung: 6 }], ['c', { rung: 5 }]])
    expect(topSlotRungs({ slots: 2, counted: ['a', 'b', 'c'] }, events)).toEqual([7, 6])
    expect(topSlotRungs({ slots: 3, counted: ['a', 'gone'] }, events)).toEqual([7, 0, 0])
  })
})

describe('colourBlurb — every rung', () => {
  it('Kiwikiwi has a line and no stat; Uenuku reads Top 5%', () => {
    expect(colourBlurb(1)).toEqual({ line: 'On the ladder', stat: null })
    expect(colourBlurb(11)).toEqual({ line: 'Rare air', stat: 'Top 5%' })
  })

  it('has a line for every colour on the ladder, and a whole-number stat', () => {
    for (let r = 0; r <= GRADES.length; r++) {
      const b = colourBlurb(r)
      expect(b.line, `rung ${r}`).toBeTruthy()
      if (b.stat) expect(b.stat).toMatch(/^(Top \d+%|Better than half of people|Better than [1-9] in 10 people)$/)
    }
  })
})
