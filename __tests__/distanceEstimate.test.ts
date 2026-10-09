// ── Short distance efforts rank on their estimate (9 Oct 2026) ──────────────
// Tāne: "A 1km time should be estimated from scores less than 1km, but the rule
// should stand that any 1km time is better than an estimated 1km time." An
// estimate ranks, never earns a colour, and notes the colour it points to.
//
// Also pins the guard behind the same day's other report: an Endurance colour
// of Uenuku with no score near it, conferred while old distance-ladder rows
// (raw ~29,900) were read against the new 1km standards.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  EVENTS, getEventBySlug, DT_CAP, ESTIMATE_BAND,
  encodeDistanceEffort, decodeDistanceEffort, predictedEffortSecs, minEstimateMetres,
} from '@/lib/eventData'
import { EMPTY_VALS, computeScoreVals, type EntryVals } from '@/lib/scoring'
import { eventGrade, type GradePlayer } from '@/lib/playerGrades'
import { estimateRung, scoreRung } from '@/lib/scoreColour'
import { formatPR } from '@/lib/scoreFormat'

const ev = (slug: string) => getEventBySlug(slug)!
const vals = (p: Partial<EntryVals>): EntryVals => ({ ...EMPTY_VALS, ...p })
const effort = (slug: string, metres: number, secs: number, tier = '') =>
  computeScoreVals('distance+time', ev(slug), vals({
    distanceVal: String(metres), distanceUnit: 'm', timeMins: '0', timeSecs: String(secs), difficultyTier: tier,
  }))
const player: GradePlayer = { division: "Men's", ageYears: 30, gender: 'Male' }
const OPEN_DISTANCE = EVENTS.filter(e => e.inputMode === 'distance+time')

describe('the encoding', () => {
  it('puts every covered effort above every estimate in the same level', () => {
    const slowKm = effort('row-erg', 1000, 4999)!   // 83 minutes, the slowest that ranks
    const fast500 = effort('row-erg', 500, 60)!
    expect(slowKm.raw_score).toBeGreaterThan(fast500.raw_score)
    expect(decodeDistanceEffort(slowKm.raw_score)).toEqual({ tierIdx: 0, secs: 4999, estimated: false })
    expect(decodeDistanceEffort(fast500.raw_score).estimated).toBe(true)
  })

  it('ranks estimates among themselves on the time they predict', () => {
    expect(effort('row-erg', 500, 100)!.raw_score).toBeGreaterThan(effort('row-erg', 500, 110)!.raw_score)
    expect(effort('row-erg', 500, 100)!.raw_score).toBeGreaterThan(effort('row-erg', 300, 70)!.raw_score)
  })

  it('round-trips through decode, covered or estimated, at every level', () => {
    for (const est of [false, true]) {
      for (const tier of [0, 3]) {
        const raw = encodeDistanceEffort(tier, 223, est)!
        expect(decodeDistanceEffort(raw)).toEqual({ tierIdx: tier, secs: 223, estimated: est })
      }
    }
    expect(encodeDistanceEffort(0, ESTIMATE_BAND, false)).toBeNull()
    expect(encodeDistanceEffort(0, 0, true)).toBeNull()
  })

  it('estimates from a quarter of the reference on every open distance event, and not below', () => {
    for (const e of OPEN_DISTANCE) {
      const ref = e.referenceMetres!
      expect(minEstimateMetres(ref), e.slug).toBe(ref / 4)
      expect(predictedEffortSecs(ref, ref / 4, 30), e.slug).not.toBeNull()
      expect(predictedEffortSecs(ref, ref / 4 - 1, 30), e.slug).toBeNull()
    }
  })

  it('labels and formats an estimate as one', () => {
    const r = effort('row-erg', 500, 107)!
    expect(r.score_label).toBe('500m · 1:47 · est. 1km 3:43')
    expect(formatPR(r.raw_score, 'distance+time', 'row-erg', ev('row-erg'))).toBe('est. 1km 3:43')
    expect(formatPR(effort('row-erg', 1000, 223)!.raw_score, 'distance+time', 'row-erg', ev('row-erg'))).toBe('1km 3:43')
  })
})

describe('colours', () => {
  const row = (raw: number) => ({ event_name: 'Row Erg', raw_score: raw, weight_kg: null, difficulty_tier: null })

  it('never come from an estimate, however fast', () => {
    const fast500 = effort('row-erg', 500, 80)!.raw_score
    expect(eventGrade(ev('row-erg'), [row(fast500)], player).rung).toBe(0)
  })

  it('come from a covered effort beside an estimate, as before', () => {
    const km = effort('row-erg', 1000, 200)!.raw_score
    const fast500 = effort('row-erg', 500, 80)!.raw_score
    const g = eventGrade(ev('row-erg'), [row(fast500), row(km)], player)
    expect(g.rung).toBe(eventGrade(ev('row-erg'), [row(km)], player).rung)
    expect(g.rung).toBeGreaterThan(0)
  })

  it('an estimate notes the colour it points to, and only above the colour held', () => {
    const fast500 = { raw_score: effort('row-erg', 500, 85)!.raw_score, weight_kg: null, difficulty_tier: null }
    const pointsTo = estimateRung(ev('row-erg'), [fast500], player)
    expect(pointsTo).toBeGreaterThan(0)
    expect(scoreRung(ev('row-erg'), [fast500], player, null)).toBe(0)
    // A covered effort at the same pace already holds it: nothing to note.
    const km = { raw_score: encodeDistanceEffort(0, decodeDistanceEffort(fast500.raw_score).secs, false)!, weight_kg: null, difficulty_tier: null }
    expect(estimateRung(ev('row-erg'), [fast500, km], player)).toBe(0)
  })
})

describe('the Endurance Uenuku (9 Oct 2026)', () => {
  it('an old distance-ladder row (a 1000m at band 2) no longer grades on a 1km event', () => {
    for (const slug of ['running', 'cycling', 'ski-erg', 'row-erg', 'scooting']) {
      const g = eventGrade(ev(slug), [
        { event_name: ev(slug).name, raw_score: 2 * DT_CAP + 9700, weight_kg: null, difficulty_tier: '1000m' },
      ], player)
      expect(g.rung, slug).toBe(0)
    }
  })

  it('a laddered distance event still grades every band it has', () => {
    const crawl = ev('animal-crawl')
    const top = crawl.difficultyTiers!.length - 1
    const raw = encodeDistanceEffort(top, 60, false)!
    expect(eventGrade(crawl, [{ event_name: crawl.name, raw_score: raw, weight_kg: null, difficulty_tier: crawl.difficultyTiers![top].name }], player).rung)
      .toBeGreaterThan(0)
  })
})

describe('the backfill migration', () => {
  const sql = readFileSync('supabase/migrations/20261008223803_rescore_short_distance_efforts.sql', 'utf8')

  it('lists every open distance event with its reference distance', () => {
    for (const e of OPEN_DISTANCE) expect(sql, e.slug).toContain(`('${e.slug}', ${e.referenceMetres},`)
    const crawl = ev('animal-crawl')
    crawl.difficultyTiers!.forEach((t, i) => expect(sql).toContain(`('animal-crawl', '${t.name}', ${i})`))
  })

  it('encodes as encodeDistanceEffort does, from a quarter of the reference', () => {
    expect(sql).toContain('c.idx * 10000 + 5000 - c.predicted')
    expect(sql).toContain('e.distance_m >= d.ref / 4.0 AND e.distance_m < d.ref')
    expect(sql).toContain('power(x.ref::float8 / x.metres::float8, 1.06)')
    expect(sql).toContain('WHERE e.raw_score IS NULL')
  })
})
