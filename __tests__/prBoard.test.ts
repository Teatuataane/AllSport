import { describe, it, expect } from 'vitest'
import { getEventBySlug } from '@/lib/eventData'
import { buildPRBoard, isNewPR, levelOf, mergeRows, TOP_N, type PRRow } from '@/lib/prBoard'

let n = 0
const row = (raw: number, date = '2026-09-01', extra: Partial<PRRow> = {}): PRRow => ({
  id: `r${++n}`, raw_score: raw, score_label: String(raw), difficulty_tier: null, date, source: 'game', ...extra,
})

const dips = getEventBySlug('pause-dips')!       // difficulty+reps
const deadlift = getEventBySlug('deadlift')!     // strength, no levels
const wrestling = getEventBySlug('wrestling')!       // the one pure sport event

describe('levelOf', () => {
  it('reads the band of the raw score, not the tier name', () => {
    expect(levelOf(dips, 0 * 10000 + 12)).toBe(0)
    expect(levelOf(dips, 2 * 10000 + 5)).toBe(2)
  })
  it('is null off the ladder and on an untiered event', () => {
    expect(levelOf(dips, -5)).toBeNull()
    expect(levelOf(dips, 99 * 10000)).toBeNull()
    expect(levelOf(deadlift, 120)).toBeNull()
  })
})

describe('buildPRBoard', () => {
  it('keeps one best per level, every level present', () => {
    const b = buildPRBoard(dips, [row(10005), row(10009), row(30002), row(3)])
    if (b.kind !== 'levels') throw new Error('expected levels')
    expect(b.levels).toHaveLength(dips.difficultyTiers!.length)
    expect(b.levels[0].best?.raw_score).toBe(3)
    expect(b.levels[1].best?.raw_score).toBe(10009)
    expect(b.levels[2].best).toBeNull()
    expect(b.levels[3].best?.raw_score).toBe(30002)
  })
  it('gives a tie to whoever set it first', () => {
    const b = buildPRBoard(dips, [row(10005, '2026-09-10'), row(10005, '2026-08-01')])
    if (b.kind !== 'levels') throw new Error('expected levels')
    expect(b.levels[1].best?.date).toBe('2026-08-01')
  })
  it('keeps the top five on an event without levels, best first', () => {
    const b = buildPRBoard(deadlift, [100, 120, 90, 110, 130, 80, 105].map(v => row(v)))
    if (b.kind !== 'top') throw new Error('expected top')
    expect(b.top.map(r => r.raw_score)).toEqual([130, 120, 110, 105, 100])
    expect(b.top).toHaveLength(TOP_N)
  })
  it('holds no record on a win/draw/loss event or an unknown event', () => {
    expect(buildPRBoard(wrestling, [row(2)]).kind).toBe('none')
    expect(buildPRBoard(undefined, [row(2)]).kind).toBe('none')
  })
  it('ignores a non-finite score', () => {
    const b = buildPRBoard(deadlift, [row(Infinity), row(NaN), row(100)])
    if (b.kind !== 'top') throw new Error('expected top')
    expect(b.top.map(r => r.raw_score)).toEqual([100])
  })
})

describe('isNewPR', () => {
  it('is never a PR on a first-ever score', () => {
    expect(isNewPR(deadlift, [], 100)).toBe(false)
    expect(isNewPR(dips, [], 10005)).toBe(false)
  })
  it('tiered: beating your best at that level counts, even under a higher level', () => {
    const rows = [row(30002), row(10005)]
    expect(isNewPR(dips, rows, 10006)).toBe(true)
    expect(isNewPR(dips, rows, 10005)).toBe(false)
    expect(isNewPR(dips, rows, 10004)).toBe(false)
  })
  it('tiered: opening a level you have not tried counts once you have played the event', () => {
    expect(isNewPR(dips, [row(10005)], 20001)).toBe(true)
  })
  it('untiered: only a new number one', () => {
    const rows = [100, 120, 90].map(v => row(v))
    expect(isNewPR(deadlift, rows, 121)).toBe(true)
    expect(isNewPR(deadlift, rows, 110)).toBe(false)
  })
  it('leaves the row being edited out of its own comparison', () => {
    const mine = row(120)
    expect(isNewPR(deadlift, [mine, row(100)], 125, mine.id)).toBe(true)
    expect(isNewPR(deadlift, [mine, row(100)], 125)).toBe(true)
    expect(isNewPR(deadlift, [mine], 110, mine.id)).toBe(false)
  })
  it('is never a PR on a sport event', () => {
    expect(isNewPR(wrestling, [row(0)], 2)).toBe(false)
  })
})

describe('mergeRows', () => {
  it('lets the live copy replace the loaded one by id', () => {
    const a = row(100)
    const merged = mergeRows([a], [{ ...a, raw_score: 105 }, row(90)])
    expect(merged).toHaveLength(2)
    expect(merged.find(r => r.id === a.id)?.raw_score).toBe(105)
  })
})
