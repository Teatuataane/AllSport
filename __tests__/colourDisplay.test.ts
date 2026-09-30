import { describe, it, expect } from 'vitest'
import { bestScoreLabel, bestEventByColour, colourBlurb, topSlotRungs, STAT_FROM_RUNG, shownOverallRung } from '@/lib/colourDisplay'
import { getEventByName } from '@/lib/eventData'
import { GRADES } from '@/lib/grading'

const slug = (name: string) => getEventByName(name)!.slug

describe('bestScoreLabel', () => {
  it('writes the tier name where formatPR writes D-number', () => {
    const label = bestScoreLabel({ slug: slug('Pushups'), best: { raw_score: 40001, weight_kg: null, difficulty_tier: '1 Arm Pushup' } })
    expect(label).toBe('1 Arm Pushup · 1 reps')
  })

  it('shows a lift as its estimated 1RM', () => {
    expect(bestScoreLabel({ slug: slug('Deadlift'), best: { raw_score: 140, weight_kg: 140, difficulty_tier: null } })).toBe('140 kg 1RM')
  })

  it('falls back to the rating, and to nothing', () => {
    expect(bestScoreLabel({ slug: slug('Wrestling'), rating: { rating: 1123.6, games: 11 } })).toBe('Rating 1124 · 11 games')
    expect(bestScoreLabel({ slug: slug('Deadlift') })).toBeNull()
  })
})

describe('bestEventByColour', () => {
  it('takes the highest event colour, Top % breaking a tie', () => {
    const events = new Map([
      ['a', { slug: slug('Deadlift'), rung: 4 }],
      ['b', { slug: slug('Pushups'), rung: 4 }],
      ['c', { slug: slug('Javelin'), rung: 2 }],
    ])
    const pct = new Map([['Deadlift', 30], ['Pushups', 5]])
    expect(bestEventByColour(events, pct)).toEqual({ slug: slug('Pushups'), rung: 4 })
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
  it('counts the climb below Kahurangi, then reads the stat off the ladder', () => {
    expect(colourBlurb(0)).toEqual({ line: 'Everyone starts here. Your climb begins with your first game.', sub: '12 colours to climb' })
    expect(colourBlurb(1)).toEqual({ line: "You're on the ladder.", sub: '1 colour climbed' })
    expect(colourBlurb(4)).toEqual({ line: 'Kōwhai earned. The work is showing.', sub: '4 colours climbed' })
    expect(colourBlurb(5).sub).toBe('5 colours climbed')
    expect(colourBlurb(6).sub).toBe('Better than half of people')
    expect(colourBlurb(7).sub).toBe('Better than 6 in 10 people')
    expect(colourBlurb(9).sub).toBe('Better than 8 in 10 people')
    expect(colourBlurb(10).sub).toBe('Top 10%')
    expect(colourBlurb(12)).toEqual({ line: 'Taniwha. The top of AllSport.', sub: 'Top 1%' })
  })
  it('switches from the climb to the stat at Kahurangi', () => {
    expect(STAT_FROM_RUNG).toBe(6)
    expect(colourBlurb(STAT_FROM_RUNG - 1).sub).toMatch(/climbed$/)
    expect(colourBlurb(STAT_FROM_RUNG).sub).not.toMatch(/climbed$/)
  })
})

describe('topSlotRungs — the six circles on a domain row', () => {
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
  it('has a headline naming the colour from Whero up, and a well-formed second line', () => {
    for (let r = 0; r <= GRADES.length; r++) {
      const b = colourBlurb(r)
      expect(b.line, `rung ${r}`).toBeTruthy()
      if (r >= 2) expect(b.line.startsWith(GRADES[r - 1].name), `rung ${r}`).toBe(true)
      expect(b.sub).toMatch(/^(\d+ colours? (climbed|to climb)|Top \d+%|Better than half of people|Better than [1-9] in 10 people)$/)
    }
  })
})

describe('shownOverallRung — the one overall colour HOME shows', () => {
  // Only the fields the function reads; the domains carry a computed rung.
  const st = (opts: { computed: number; held: Map<number, number>; schemaReady: boolean; games: number }) => ({
    grades: { domains: Array.from({ length: 10 }, (_, i) => ({ domainNumber: i + 1, rung: opts.computed })) },
    held: opts.held, schemaReady: opts.schemaReady, games: opts.games,
  }) as unknown as Parameters<typeof shownOverallRung>[0]

  it('averages the CONFERRED colours once grading is live', () => {
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 6 : 3]))
    expect(shownOverallRung(st({ computed: 1, held, schemaReady: true, games: 100 }))).toBe(4)
  })

  it('averages the COMPUTED colours on a database without grading', () => {
    expect(shownOverallRung(st({ computed: 5, held: new Map(), schemaReady: false, games: 100 }))).toBe(5)
  })

  it('is capped by games played', () => {
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, 4]))
    expect(shownOverallRung(st({ computed: 0, held, schemaReady: true, games: 7 }))).toBe(3)
    expect(shownOverallRung(st({ computed: 0, held, schemaReady: true, games: 0 }))).toBe(0)
  })
})
