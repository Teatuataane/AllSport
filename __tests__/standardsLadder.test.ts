// ── The standards a player sees ──────────────────────────────────────────────
// standardsLadder must read the same ladder grading does: the player's sex, the
// age shift, the ratio against bodyweight, and the split of a Game-rung event
// into drills and rating. These pin it to rungForScore so the two cannot drift.

import { describe, it, expect } from 'vitest'
import { standardsLadder, needsBodyweight, RATING_ONLY_NOTE } from '@/lib/standardsLadder'
import { getEventBySlug, EVENTS } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'
import { AGE_SHIFT, ageBand, rungForScore } from '@/lib/grading'
import { ladderFor, type GradePlayer } from '@/lib/playerGrades'

const open: GradePlayer = { division: "Men's", ageYears: 30, gender: null }
const ev = (slug: string) => getEventBySlug(slug)!

describe('standardsLadder', () => {
  it('lists all twelve colours on a plain ladder', () => {
    const rows = standardsLadder(ev('high-jump'), open, null)
    expect(rows.map(r => r.rung)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(rows[0].name).toBe('Kiwikiwi')
    expect(rows[0].label).toBe('60cm')
    expect(rows[11].name).toBe('Taniwha')
  })

  it("reads the player's own sex ladder", () => {
    const m = standardsLadder(ev('high-jump'), open, null)[0].label
    const f = standardsLadder(ev('high-jump'), { division: "Women's", ageYears: 30, gender: null }, null)[0].label
    expect(m).toBe('60cm')
    expect(f).toBe('50cm')
  })

  it('moves the ladder up for age, so Masters need the Open threshold one colour later', () => {
    const o = standardsLadder(ev('high-jump'), open, null)
    const m = standardsLadder(ev('high-jump'), { division: 'Masters Men', ageYears: 45, gender: null }, null)
    // Masters earn rung r on the Open threshold for rung r - 1.
    expect(m[1].label).toBe(o[0].label)
    expect(m[5].label).toBe(o[4].label)
    const u14 = standardsLadder(ev('high-jump'), { division: 'Junior', ageYears: 13, gender: 'M' }, null)
    expect(u14[2].label).toBe(o[0].label)
  })

  it('says "any score" below the Open floor', () => {
    const u14 = standardsLadder(ev('pause-dips'), { division: 'Junior', ageYears: 13, gender: 'M' }, null)
    expect(u14[0].label).toBe('Any score')
    expect(u14[1].label).toBe('Any score')
    expect(u14[2].label).toBe('D1 · 5 reps')
  })

  it('shows strength as a ratio always, and in kilograms once a bodyweight is known', () => {
    const noBw = standardsLadder(ev('deadlift'), open, null)
    expect(noBw[1].label).toBe('0.56× bodyweight')
    expect(noBw.every(r => r.kind === 'ratio')).toBe(true)
    const bw = standardsLadder(ev('deadlift'), open, 80)
    expect(bw[1].label).toBe('0.56× bodyweight · 45 kg')
    expect(bw[0].label).toBe('Any lift')
    expect(needsBodyweight(ev('deadlift'))).toBe(true)
    expect(needsBodyweight(ev('high-jump'))).toBe(false)
  })

  it('stops a Game-rung event\'s drills at Kahurangi and gives the rest as ratings', () => {
    const rows = standardsLadder(ev('tennis'), open, null)
    expect(rows.slice(0, 6).every(r => r.kind === 'drill')).toBe(true)
    expect(rows[5].name).toBe('Kahurangi')
    expect(rows.slice(6).map(r => [r.name, r.label])).toEqual([
      ['Poroporo', 'Rating 1,100'], ['Parahi', 'Rating 1,200'], ['Hiriwa', 'Rating 1,300'],
      ['Kōura', 'Rating 1,400'], ['Uenuku', 'Rating 1,500'], ['Taniwha', 'Rating 1,600'],
    ])
  })

  it('does not age-shift a rating, and does not shift a drill past Kahurangi', () => {
    const gm = standardsLadder(ev('tennis'), { division: 'Grandmaster Men', ageYears: 65, gender: null }, null)
    expect(gm.filter(r => r.kind === 'drill')).toHaveLength(6)
    expect(gm[6].label).toBe('Rating 1,100')
  })

  it('gives a rating-only event just the rating rows', () => {
    const rows = standardsLadder(ev('wrestling'), open, null)
    expect(rows.map(r => r.name)).toEqual(['Poroporo', 'Parahi', 'Hiriwa', 'Kōura', 'Uenuku', 'Taniwha'])
    expect(rows.every(r => r.kind === 'rating')).toBe(true)
    expect(RATING_ONLY_NOTE).toMatch(/graded on games/)
  })

  it('writes a raced event\'s "just finish it" threshold as any time, not three hours', () => {
    const rows = standardsLadder(ev('animal-crawl'), open, null)
    expect(rows[0].label).toMatch(/any time/)
    // No ladder anywhere reads a "just finish it" as a multi-hour time.
    for (const e of EVENTS) {
      for (const r of standardsLadder(e, open, null)) {
        const m = r.label.match(/(\d+):\d\d/)
        expect(!m || Number(m[1]) < 100, `${e.slug} ${r.name}: ${r.label}`).toBe(true)
      }
    }
  })

  it('agrees with grading: the score a row names earns exactly that colour (raw ladders)', () => {
    // For every plain raw ladder, the Open threshold for each listed rung is the
    // lowest score that rungForScore awards that rung.
    for (const e of EVENTS) {
      const s = STANDARDS[e.slug]
      if (!s || s.kind !== 'raw') continue
      const ladder = s.all ?? s[ladderFor(open)] ?? []
      const rows = standardsLadder(e, open, null)
      const top = s.game ? 6 : 12
      expect(rows.filter(r => r.kind === 'drill')).toHaveLength(Math.min(top, ladder.length))
      ladder.slice(0, top).forEach((t, i) => {
        if (e.inputMode === 'weight+time') return
        expect(rungForScore(t, ladder, ageBand("Men's", 30), { cap: top })).toBeGreaterThanOrEqual(i + 1)
      })
    }
    expect(AGE_SHIFT.Open).toBe(0)
  })

  it('returns nothing for an event with no standards', () => {
    expect(standardsLadder({ ...ev('high-jump'), slug: 'not-an-event' }, open, null)).toEqual([])
  })
})
