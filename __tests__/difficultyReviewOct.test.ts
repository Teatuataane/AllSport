import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { EVENTS, getEventBySlug, predictedEffortSecs, DT_CAP } from '@/lib/eventData'
import {
  computeScoreVals, scoreColumns, valsFromRaw, valsFromResult, encodeCarry, decodeCarry,
  EMPTY_VALS, type EntryVals,
} from '@/lib/scoring'
import { formatPR } from '@/lib/scoreFormat'
import { meetsCarry, rungForCompound, isCompoundMode } from '@/lib/grading'

// The 5 Oct 2026 difficulty review: three new input modes, a time beside a
// raced contest's result, and the migration that re-files history onto them.

const vals = (p: Partial<EntryVals>): EntryVals => ({ ...EMPTY_VALS, ...p })
const running = getEventBySlug('running')!
const crawl = getEventBySlug('animal-crawl')!
const tib = getEventBySlug('tibialis-curl')!
const farmer = getEventBySlug('farmer-carry')!
const sprint = getEventBySlug('100m-sprint')!

describe('distance + time: the best effort wins', () => {
  it('ranks a 4:00 km above a 15:00 3km, which predicts about 4:41 (the review example)', () => {
    expect(predictedEffortSecs(1000, 3000, 900)).toBe(281)
    const km = computeScoreVals('distance+time', running, vals({ distanceVal: '1', distanceUnit: 'km', timeMins: '4', timeSecs: '0' }))!
    const threeK = computeScoreVals('distance+time', running, vals({ distanceVal: '3000', timeMins: '15', timeSecs: '0' }))!
    expect(km.raw_score).toBe(DT_CAP - 240)
    expect(threeK.raw_score).toBe(DT_CAP - 281)
    expect(km.raw_score).toBeGreaterThan(threeK.raw_score)
    expect(km.score_label).toBe('1km · 4:00')
    expect(threeK.score_label).toBe('3km · 15:00 · est. 1km 4:41')
  })

  it('refuses an effort shorter than the reference, and only ever shortens', () => {
    expect(predictedEffortSecs(1000, 999, 200)).toBeNull()
    expect(computeScoreVals('distance+time', running, vals({ distanceVal: '400', timeMins: '1', timeSecs: '0' }))).toBeNull()
    // Going long never games it: a 3:30 marathon predicts a slower km than a 3:20 km.
    expect(predictedEffortSecs(1000, 42195, 12600)!).toBeGreaterThan(200)
  })

  it('keeps the crawl level as the band, the predicted 25m inside it', () => {
    const d2 = crawl.difficultyTiers![1].name
    const r = computeScoreVals('distance+time', crawl, vals({ difficultyTier: d2, distanceVal: '100', timeMins: '2', timeSecs: '0' }))!
    expect(r.raw_score).toBe(1 * DT_CAP + DT_CAP - predictedEffortSecs(25, 100, 120)!)
    // Any effort on a harder crawl beats every effort on an easier one.
    const fastD1 = computeScoreVals('distance+time', crawl, vals({ difficultyTier: crawl.difficultyTiers![0].name, distanceVal: '25', timeSecs: '5' }))!
    expect(r.raw_score).toBeGreaterThan(fastD1.raw_score)
    expect(computeScoreVals('distance+time', crawl, vals({ distanceVal: '25', timeSecs: '20' }))).toBeNull()
  })

  it('writes what was done and prefills it back', () => {
    const v = vals({ distanceVal: '5', distanceUnit: 'km', timeMins: '26', timeSecs: '10' })
    const c = scoreColumns('distance+time', running, v)!
    expect(c).toMatchObject({ distance_m: 5000, time_seconds: 1570 })
    const p = valsFromResult('distance+time', { ...c, difficulty_tier: null, result_type: null, opponent_name: null, match_score: null, weight_kg: null, reps: null, time_seconds: 1570, distance_m: 5000 })
    expect(computeScoreVals('distance+time', running, vals(p))!.raw_score).toBe(c.raw_score)
    // A PR prefills as the predicted time over the reference.
    const back = valsFromRaw('distance+time', running, c.raw_score)
    expect(computeScoreVals('distance+time', running, vals(back))!.raw_score).toBe(c.raw_score)
    expect(formatPR(c.raw_score, 'distance+time', running.slug, running)).toBe('1km 4:45')
  })
})

describe('weight + distance + time: heaviest, then furthest, then fastest', () => {
  const score = (kg: string, m: string, secs: string) =>
    computeScoreVals('weight+distance+time', farmer, vals({ weightKg: kg, distanceVal: m, timeSecs: secs }))!.raw_score

  it('orders the three keys', () => {
    expect(score('60', '20', '30')).toBeGreaterThan(score('59.9', '500', '10'))
    expect(score('60', '101', '300')).toBeGreaterThan(score('60', '100', '10'))
    expect(score('60', '100', '50')).toBeGreaterThan(score('60', '100', '51'))
  })

  it('round-trips the packed keys and refuses what they cannot hold', () => {
    expect(decodeCarry(encodeCarry(72.5, 340, 95)!)).toEqual({ weightKg: 72.5, metres: 340, secs: 95 })
    expect(encodeCarry(0, 100, 60)).toBeNull()
    expect(encodeCarry(1000, 100, 60)).toBeNull()
    expect(encodeCarry(50, 100000, 60)).toBeNull()
    expect(encodeCarry(50, 100, DT_CAP)).toBeNull()
    expect(Number.isSafeInteger(encodeCarry(999.9, 99999, 1)!)).toBe(true)
    const c = scoreColumns('weight+distance+time', farmer, vals({ weightKg: '40', distanceVal: '100', timeMins: '1', timeSecs: '5' }))!
    expect(c).toMatchObject({ weight_kg: 40, distance_m: 100, time_seconds: 65, score_label: '40kg · 100m · 1:05' })
    expect(formatPR(c.raw_score, 'weight+distance+time', farmer.slug, farmer)).toBe('40kg · 100m · 1:05')
  })

  it('gives a colour only for the load AND the distance', () => {
    const t = encodeCarry(40, 100, 1)! - (DT_CAP - 1) // a threshold carries no time term
    expect(meetsCarry(encodeCarry(40, 100, 500)!, t)).toBe(true)
    expect(meetsCarry(encodeCarry(80, 99, 10)!, t)).toBe(false)
    expect(isCompoundMode('weight+distance+time')).toBe(true)
    expect(rungForCompound('distance+time', 1, [1], 'Open')).toBeNull()
  })
})

describe('weight + reps: Tibialis Curl, heavier wins', () => {
  it('ranks any load above any lighter one, reps breaking the tie, bodyweight lowest', () => {
    const s = (kg: string, reps: string) => computeScoreVals('weight+reps', tib, vals({ weightKg: kg, repCount: reps }))!
    expect(s('5', '10').raw_score).toBeGreaterThan(s('2.5', '80').raw_score)
    expect(s('5', '11').raw_score).toBeGreaterThan(s('5', '10').raw_score)
    expect(s('', '40').raw_score).toBe(40)
    expect(s('', '40').score_label).toBe('Bodyweight × 40 reps')
    expect(s('10', '1').score_label).toBe('10kg × 1 rep')
    expect(computeScoreVals('weight+reps', tib, vals({ weightKg: '5' }))).toBeNull()
    const back = valsFromRaw('weight+reps', tib, s('7.5', '22').raw_score)
    expect(back).toMatchObject({ weightKg: '7.5', repCount: '22' })
  })
})

describe('a raced contest records its time beside the result', () => {
  it('keeps the time in the label and column, never in the rank', () => {
    const win = computeScoreVals('sport', sprint, vals({ sportResult: 'win', timeSecs: '12.34' }))!
    expect(win).toEqual({ raw_score: 2, score_label: 'Win · 12.34s' })
    expect(scoreColumns('sport', sprint, vals({ sportResult: 'win', timeSecs: '12.34' }))!.time_seconds).toBe(12.34)
    // Wrestling is not raced: a stray time is ignored.
    const wrestling = getEventBySlug('wrestling')!
    expect(scoreColumns('sport', wrestling, vals({ sportResult: 'win', timeSecs: '30' }))!.time_seconds).toBeUndefined()
    expect(computeScoreVals('sport', sprint, vals({ timeSecs: '12' }))).toBeNull()
  })
})

describe('20261005012108 redefines the functions it must', () => {
  const dir = 'supabase/migrations'
  const sql = readFileSync(`${dir}/${readdirSync(dir).find(n => n.endsWith('_difficulty_review_oct.sql'))!}`, 'utf8')
  const fn = (name: string) => {
    const i = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)
    return sql.slice(i, sql.indexOf('$$;', i))
  }

  it('keeps the lift estimate on exactly the lifts, and refuses an old-format Tibialis Curl', () => {
    const body = fn('enforce_lift_estimate')
    expect(body).toContain('round(round(NEW.weight_kg, 2) * 36 / (37 - least(NEW.reps, 10)), 1)')
    const list = (marker: string) => {
      const from = body.indexOf(marker)
      return [...body.slice(body.indexOf('(', from) + 1, body.indexOf(')', from)).matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1]).sort()
    }
    // The lifts as they stood on 5 Oct 2026. Steinborn joined on 6 Oct, in
    // 20261005222950, which redefines this trigger (estimatedOneRm.test.ts
    // pins the newest definition to the full roster).
    const lifts = EVENTS.filter(e => e.inputMode === 'strength' && e.slug !== 'steinborn')
    expect(list('IF v_name IN')).toEqual(lifts.map(e => e.name).sort())
    expect(list('OR v_slug IN')).toEqual(lifts.map(e => e.slug).sort())
    expect(body).toContain("(v_name = 'Tibialis Curl' OR v_slug = 'tibialis-curl') AND NEW.difficulty_tier IS NOT NULL")
  })

  it('pins search_path on the definer functions it redefines', () => {
    for (const name of ['guard_workout_entries_write', 'record_entry_match']) {
      expect(fn(name), name).toMatch(/SECURITY DEFINER\s+SET search_path = public/)
    }
  })

  it('defines the functions before it rewrites a single row', () => {
    expect(sql.indexOf('CREATE OR REPLACE FUNCTION public.enforce_lift_estimate'))
      .toBeLessThan(sql.indexOf('UPDATE results'))
  })
})
