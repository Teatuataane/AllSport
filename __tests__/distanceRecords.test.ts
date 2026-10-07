// ── Records per distance (8 Oct 2026) ────────────────────────────────────────
// Tāne: the runs, rides and ergs keep a best at 250m, 500m, 1km, 2km, 5km and
// longer; the crawls, carries and the swim at 25m, 50m, 100m, 200m, 500m and
// longer. An effort counts at the longest record distance it covered, on the
// time it predicts there, and past the top distance also for the open record.
// Colours and game places still rank on the reference distance (1km; 100m for
// Animal Crawl and Swim), so a short training effort is a record only.

import { describe, it, expect } from 'vitest'
import { EVENTS, getEventBySlug, LONG_RECORD_DISTANCES, SHORT_RECORD_DISTANCES, RIEGEL_EXPONENT } from '@/lib/eventData'
import { buildPRBoard, isNewPR, distanceRecordName, type PRRow, type DistanceRecord } from '@/lib/prBoard'
import { computeScoreVals, EMPTY_VALS } from '@/lib/scoring'
import { trainingDistanceRows, type LoggedBestEntry } from '@/lib/workouts'

let n = 0
const run = (metres: number, secs: number, date = '2026-10-01', extra: Partial<PRRow> = {}): PRRow => {
  const raw = computeScoreVals('distance+time', running, {
    ...EMPTY_VALS, distanceVal: String(metres), distanceUnit: 'm', timeMins: '0', timeSecs: String(secs),
  })?.raw_score ?? null
  return {
    id: `r${++n}`, raw_score: raw, score_label: `${metres}m`, difficulty_tier: null, date,
    source: 'logged', distance_m: metres, time_seconds: secs, ...extra,
  }
}

const running = getEventBySlug('running')!
const farmer = getEventBySlug('farmer-carry')!
const crawl = getEventBySlug('animal-crawl')!

const records = (ev = running, rows: PRRow[]): DistanceRecord[] => {
  const b = buildPRBoard(ev, rows)
  if (b.kind !== 'distances') throw new Error('expected distances')
  return b.records
}
const at = (recs: DistanceRecord[], metres: number, open = false, level: number | null = null) =>
  recs.find(r => r.metres === metres && r.open === open && r.level === level)!

describe('the roster', () => {
  it('gives every open distance event and carry its set of record distances', () => {
    const long = ['running', 'cycling', 'ski-erg', 'row-erg', 'scooting', 'walking']
    const short = ['swim', 'animal-crawl', 'sandbag-carry', 'farmer-carry', 'weighted-drag']
    for (const s of long) expect(getEventBySlug(s)!.recordDistances, s).toBe(LONG_RECORD_DISTANCES)
    for (const s of short) expect(getEventBySlug(s)!.recordDistances, s).toBe(SHORT_RECORD_DISTANCES)
    // Nothing else, and none missed.
    const withDistance = EVENTS.filter(e => e.inputMode === 'distance+time' || e.inputMode === 'weight+distance+time')
    expect(withDistance.map(e => e.slug).sort()).toEqual([...long, ...short].sort())
    expect(EVENTS.filter(e => e.recordDistances).length).toBe(long.length + short.length)
  })

  it('ranks the crawl on 100m and the runs on 1km', () => {
    expect(crawl.referenceMetres).toBe(100)
    expect(running.referenceMetres).toBe(1000)
  })
})

describe('buildPRBoard on a distance event', () => {
  it('lists every distance and the open record', () => {
    const recs = records(running, [])
    expect(recs.map(distanceRecordName)).toEqual(['250m', '500m', '1km', '2km', '5km', '5km+'])
    expect(recs.every(r => r.best === null)).toBe(true)
  })

  it('keeps a short training effort as the record at its own distance', () => {
    const r = run(500, 107)
    expect(r.raw_score).toBeNull()
    const rec = at(records(running, [r]), 500)
    expect(rec.best?.id).toBe(r.id)
    expect(rec.label).toBe('500m · 1:47')
    // A 1km never fills the 500m record above it.
    expect(at(records(running, [r]), 1000).best).toBeNull()
  })

  it('files an in-between effort at the distance below, on the time it predicts', () => {
    const r = run(700, 140)
    const rec = at(records(running, [r]), 500)
    const pred = Math.round(140 * Math.pow(500 / 700, RIEGEL_EXPONENT))
    expect(rec.best?.id).toBe(r.id)
    expect(rec.label).toBe(`1:${String(pred - 60).padStart(2, '0')} · est. from 700m 2:20`)
    expect(at(records(running, [r]), 250).best).toBeNull()
  })

  it('takes the faster predicted time at a distance', () => {
    const slow = run(500, 120), fast = run(600, 125)
    expect(at(records(running, [slow, fast]), 500).best?.id).toBe(fast.id)
  })

  it('gives the open record to the longest effort past the top distance', () => {
    const tenK = run(10000, 3000), half = run(21100, 7000), fiveK = run(5000, 1200)
    const recs = records(running, [tenK, half, fiveK])
    expect(at(recs, 5000, true).best?.id).toBe(half.id)
    // An exact 5km is not "longer".
    expect(at(records(running, [fiveK]), 5000, true).best).toBeNull()
    // The 10km also predicts a 5km, but a real 20:00 5km is faster.
    expect(at(recs, 5000).best?.id).toBe(fiveK.id)
  })

  it('ignores an effort under the shortest distance', () => {
    const recs = records(running, [run(200, 30)])
    expect(recs.every(r => r.best === null)).toBe(true)
  })

  it('ranks a carry heavier first, then faster', () => {
    const carry = (kg: number, m: number, s: number): PRRow => ({
      id: `c${++n}`, raw_score: null, score_label: '', difficulty_tier: null, date: '2026-10-01',
      source: 'logged', distance_m: m, time_seconds: s, weight_kg: kg,
    })
    const light = carry(32, 50, 20), heavy = carry(40, 50, 40), heavyFast = carry(40, 60, 35)
    const recs = records(farmer, [light, heavy, heavyFast])
    // 60m in 35s predicts about 29s over 50m: faster than 40s at the same load.
    expect(at(recs, 50).best?.id).toBe(heavyFast.id)
    expect(at(recs, 50).label).toMatch(/^40kg · 0:29 · est\. from 60m 0:35$/)
  })

  it('keeps the crawl records per crawl', () => {
    const d1 = crawl.difficultyTiers![0].name, d4 = crawl.difficultyTiers![3].name
    const rows: PRRow[] = [
      { id: 'a', raw_score: null, score_label: '', difficulty_tier: d1, date: '2026-10-01', source: 'logged', distance_m: 25, time_seconds: 15 },
      { id: 'b', raw_score: null, score_label: '', difficulty_tier: d4, date: '2026-10-01', source: 'logged', distance_m: 25, time_seconds: 25 },
    ]
    const recs = records(crawl, rows)
    expect(recs).toHaveLength(4 * 6)
    expect(at(recs, 25, false, 0).best?.id).toBe('a')
    expect(at(recs, 25, false, 3).best?.id).toBe('b')
  })
})

describe('isNewPR on a distance event', () => {
  it('is a PR at a distance not done before, once the event has been played', () => {
    const prior = [run(1000, 240)]
    expect(isNewPR(running, prior, { raw_score: null, difficulty_tier: null, distance_m: 500, time_seconds: 110 })).toBe(true)
    // The first effort on an event is never a PR.
    expect(isNewPR(running, [], { raw_score: null, difficulty_tier: null, distance_m: 500, time_seconds: 110 })).toBe(false)
  })

  it('is a PR only when it beats the record at its distance', () => {
    const prior = [run(500, 110), run(1000, 240)]
    expect(isNewPR(running, prior, { raw_score: null, difficulty_tier: null, distance_m: 500, time_seconds: 115 })).toBe(false)
    expect(isNewPR(running, prior, { raw_score: null, difficulty_tier: null, distance_m: 500, time_seconds: 105 })).toBe(true)
  })

  it('leaves out the row being edited', () => {
    const r = run(500, 100)
    const prior = [r, run(1000, 240)]
    expect(isNewPR(running, prior, { raw_score: null, difficulty_tier: null, distance_m: 500, time_seconds: 105 }, r.id)).toBe(true)
  })
})

describe('trainingDistanceRows', () => {
  const entry = (slug: string, extra: Partial<LoggedBestEntry> = {}): LoggedBestEntry => ({
    id: `e${++n}`, event_slug: slug, raw_score: null, score_label: '500m · 1:47 · training', difficulty_tier: null,
    workouts: { performed_on: '2026-10-08', witnessed: false }, distance_m: 500, time_seconds: 107, ...extra,
  })

  it('keeps an unranked distance effort for the records', () => {
    const rows = trainingDistanceRows([entry('row-erg')])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: expect.stringMatching(/^logged:/), raw_score: null, distance_m: 500, time_seconds: 107, event_name: 'Row Erg' })
  })

  it('skips ranked rows, other events and rows without a distance or time', () => {
    expect(trainingDistanceRows([
      entry('row-erg', { raw_score: 9760 }),
      entry('deadlift'),
      entry('row-erg', { distance_m: null }),
      entry('row-erg', { time_seconds: 0 }),
    ])).toEqual([])
  })
})
