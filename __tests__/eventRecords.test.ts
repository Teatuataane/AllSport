import { describe, it, expect } from 'vitest'
import { eventRecords, type RecordResultRow } from '@/lib/eventRecords'
import { EVENTS } from '@/lib/eventData'

const players = new Map([
  ['m1', { name: 'Bryn', division: "Men's" }],
  ['m2', { name: 'Hemi', division: "Men's" }],
  ['w1', { name: 'Aroha', division: "Women's" }],
  ['j1', { name: 'Cam', division: 'Juniors' }],
])

const r = (player_id: string, event_slug: string, raw_score: number, difficulty_tier: string | null = null, at = '2026-11-03T03:30:00Z'): RecordResultRow =>
  ({ player_id, event_slug, event_name: null, raw_score, difficulty_tier, at })

const find = (domains: ReturnType<typeof eventRecords>, slug: string) =>
  domains.flatMap(d => d.events).find(e => e.slug === slug)

describe('eventRecords', () => {
  it('keeps the best raw score per division', () => {
    const d = eventRecords([r('m1', 'deadlift', 150), r('m2', 'deadlift', 180), r('w1', 'deadlift', 110), r('j1', 'deadlift', 90)], players)
    const lift = find(d, 'deadlift')!
    expect(lift.records.men).toMatchObject({ name: 'Hemi', score: '180 kg 1RM', level: null })
    expect(lift.records.women?.name).toBe('Aroha')
    expect(lift.records.juniors?.name).toBe('Cam')
  })

  it('gives a tie to whoever did it first', () => {
    const d = eventRecords([r('m2', 'deadlift', 150, null, '2026-11-10T03:30:00Z'), r('m1', 'deadlift', 150, null, '2026-11-03T03:30:00Z')], players)
    expect(find(d, 'deadlift')!.records.men?.name).toBe('Bryn')
  })

  it('reads a level apart from the score, and a higher level beats more reps', () => {
    const d = eventRecords([
      r('m1', 'pause-dips', 2 * 10000 + 5, 'Dip Negatives'),
      r('m2', 'pause-dips', 1 * 10000 + 30, 'Dip Top Hold'),
    ], players)
    expect(find(d, 'pause-dips')!.records.men).toMatchObject({ name: 'Bryn', level: 'Dip Negatives', score: '5 reps' })
  })

  it('skips a row whose stored level is not the ladder level at its band', () => {
    const d = eventRecords([r('m1', 'pause-dips', 4 * 10000 + 5, 'Dip Top Hold')], players)
    expect(find(d, 'pause-dips')!.records.men).toBeNull()
  })

  it('skips a Game-rung row but keeps the drill', () => {
    const d = eventRecords([r('m1', 'touch-rugby', 10000 + 2, 'Game'), r('m2', 'touch-rugby', 14, 'Passing Drill')], players)
    expect(find(d, 'touch-rugby')!.records.men?.name).toBe('Hemi')
  })

  it('leaves pure contests off the list', () => {
    const d = eventRecords([r('m1', 'wrestling', 2)], players)
    expect(find(d, 'wrestling')).toBeUndefined()
    const listed = d.flatMap(x => x.events).length
    expect(listed).toBe(EVENTS.filter(e => e.inputMode !== 'sport').length)
  })

  it('skips players off the board and rows with no score', () => {
    const d = eventRecords([
      { ...r('guest', 'deadlift', 300) },
      { ...r('m1', 'deadlift', 0), raw_score: null },
    ], players)
    expect(find(d, 'deadlift')!.records.men).toBeNull()
  })

  it('falls back to the event name when the row has no slug', () => {
    const d = eventRecords([{ ...r('m1', '', 140), event_slug: null, event_name: 'Deadlift' }], players)
    expect(find(d, 'deadlift')!.records.men?.score).toBe('140 kg 1RM')
  })

  it('lists ten domains in order', () => {
    const d = eventRecords([], players)
    expect(d.map(x => x.domainNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('eventRecords wording', () => {
  it('says 1 rep, not 1 reps', () => {
    const d = eventRecords([r('m1', 'pause-dips', 2 * 10000 + 1, 'Dip Negatives'), r('w1', 'pause-dips', 2 * 10000 + 11, 'Dip Negatives')], players)
    const e = find(d, 'pause-dips')!
    expect(e.records.men?.score).toBe('1 rep')
    expect(e.records.women?.score).toBe('11 reps')
  })
})
