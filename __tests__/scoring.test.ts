import { describe, it, expect } from 'vitest'
import {
  fmtTime,
  computeScoreVals,
  valsFromResult,
  valsFromRaw,
  isWeightScoredTierByIdx,
  isWeightScoredTierByName,
  EMPTY_VALS,
  type EntryVals,
} from '@/lib/scoring'
import { getEventBySlug, encodeDiffTime } from '@/lib/eventData'

function vals(patch: Partial<EntryVals>): EntryVals {
  return { ...EMPTY_VALS, ...patch }
}

// ─── computeScoreVals — raw_score encoding per input mode ─────────────────────

describe('computeScoreVals: strength', () => {
  it('encodes weight as raw_score with kg × reps label', () => {
    const r = computeScoreVals('strength', getEventBySlug('deadlift'), vals({ weightKg: '120', repCount: '3' }))
    expect(r).toEqual({ raw_score: 120, score_label: '120kg × 3 reps' })
  })

  it('omits reps from the label when reps are empty', () => {
    const r = computeScoreVals('strength', getEventBySlug('deadlift'), vals({ weightKg: '140' }))
    expect(r).toEqual({ raw_score: 140, score_label: '140kg' })
  })

  it('returns null without a weight', () => {
    expect(computeScoreVals('strength', getEventBySlug('deadlift'), vals({ repCount: '5' }))).toBeNull()
  })

  it('shoulder-dislocate stores NEGATIVE cm so narrower ranks better', () => {
    const r = computeScoreVals('strength', getEventBySlug('shoulder-dislocate'), vals({ weightKg: '55', repCount: '5' }))
    expect(r).toEqual({ raw_score: -55, score_label: '55cm × 5 reps' })
  })
})

describe('computeScoreVals: reps', () => {
  it('encodes rep count directly', () => {
    const r = computeScoreVals('reps', undefined, vals({ repCount: '42' }))
    expect(r).toEqual({ raw_score: 42, score_label: '42 reps' })
  })

  it('returns null with zero reps', () => {
    expect(computeScoreVals('reps', undefined, vals({ repCount: '0' }))).toBeNull()
  })
})

describe('computeScoreVals: time / hold', () => {
  it('time mode stores NEGATIVE seconds so faster ranks better', () => {
    const r = computeScoreVals('time', undefined, vals({ timeMins: '4', timeSecs: '20' }))
    expect(r).toEqual({ raw_score: -260, score_label: '4:20' })
  })

  it('hold mode (no tiers) stores positive seconds so longer ranks better', () => {
    const r = computeScoreVals('hold', undefined, vals({ timeMins: '1', timeSecs: '30' }))
    expect(r).toEqual({ raw_score: 90, score_label: '1:30' })
  })
})

describe('computeScoreVals: difficulty+time', () => {
  it('HOLD events encode tierIdx*10000 + seconds (longer wins within tier)', () => {
    const bridge = getEventBySlug('bridge')! // hold semantics
    const tierName = bridge.difficultyTiers![2].name // D3, tierIdx 2
    const r = computeScoreVals('difficulty+time', bridge, vals({ difficultyTier: tierName, timeSecs: '45' }))
    expect(r!.raw_score).toBe(2 * 10000 + 45)
    expect(r!.score_label).toBe(`D3 ${tierName} · 0:45`)
  })

  it('TIMED EFFORT events invert the within-tier term (faster wins within tier)', () => {
    const running = getEventBySlug('running')! // in TIMED_EFFORT_SLUGS
    const tierName = running.difficultyTiers![1].name // D2, tierIdx 1
    const fast = computeScoreVals('difficulty+time', running, vals({ difficultyTier: tierName, timeMins: '1', timeSecs: '35' }))
    const slow = computeScoreVals('difficulty+time', running, vals({ difficultyTier: tierName, timeMins: '1', timeSecs: '40' }))
    expect(fast!.raw_score).toBe(encodeDiffTime(1, 95, true))
    expect(fast!.raw_score).toBeGreaterThan(slow!.raw_score) // faster = higher = better
  })

  it('a higher tier always outranks a lower tier, regardless of time', () => {
    const running = getEventBySlug('running')!
    const d1 = running.difficultyTiers![0].name
    const d2 = running.difficultyTiers![1].name
    const fastD1 = computeScoreVals('difficulty+time', running, vals({ difficultyTier: d1, timeSecs: '30' }))
    const slowD2 = computeScoreVals('difficulty+time', running, vals({ difficultyTier: d2, timeMins: '10', timeSecs: '0' }))
    expect(slowD2!.raw_score).toBeGreaterThan(fastD1!.raw_score)
  })

  it('returns null without a tier or without a time', () => {
    const running = getEventBySlug('running')!
    expect(computeScoreVals('difficulty+time', running, vals({ timeSecs: '90' }))).toBeNull()
    expect(computeScoreVals('difficulty+time', running, vals({ difficultyTier: running.difficultyTiers![0].name }))).toBeNull()
  })
})

describe('computeScoreVals: difficulty+reps', () => {
  it('encodes tierIdx*10000 + reps', () => {
    const ev = getEventBySlug('push-up-contest')!
    const tierName = ev.difficultyTiers![2].name // D3
    const r = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: tierName, repCount: '12' }))
    expect(r!.raw_score).toBe(2 * 10000 + 12)
  })

  it('weight-scored tiers (Pause Dips D5) encode added weight instead of reps', () => {
    const ev = getEventBySlug('pause-dips')!
    const d5 = ev.difficultyTiers![4].name // Weighted RTO Dip
    const r = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: d5, weightKg: '20' }))
    expect(r).toEqual({ raw_score: 20, score_label: `D5 ${d5} · 20kg` })
  })
})

describe('computeScoreVals: distance / sprint / sport / score', () => {
  it('distance in metres stores centimetres', () => {
    expect(computeScoreVals('distance', undefined, vals({ distanceVal: '8.4', distanceUnit: 'm' }))!.raw_score).toBe(840)
  })

  it('distance in cm stores cm directly', () => {
    expect(computeScoreVals('distance', undefined, vals({ distanceVal: '55', distanceUnit: 'cm' }))!.raw_score).toBe(55)
  })

  it('sprint stores NEGATIVE total centiseconds so faster ranks better', () => {
    const r = computeScoreVals('sprint', undefined, vals({ timeSecs: '13', sprintCs: '42' }))
    expect(r).toEqual({ raw_score: -1342, score_label: '13s.42' })
  })

  it('sport encodes win=2 / draw=1 / loss=0 with opponent in the label', () => {
    const win = computeScoreVals('sport', undefined, vals({ sportResult: 'win', opponentName: 'Zeke', sportScore: '21–18' }))
    expect(win).toEqual({ raw_score: 2, score_label: 'Win vs Zeke (21–18)' })
    expect(computeScoreVals('sport', undefined, vals({ sportResult: 'draw' }))!.raw_score).toBe(1)
    expect(computeScoreVals('sport', undefined, vals({ sportResult: 'loss' }))!.raw_score).toBe(0)
    expect(computeScoreVals('sport', undefined, vals({}))).toBeNull()
  })

  it('score mode stores NEGATIVE strokes so fewer ranks better', () => {
    const r = computeScoreVals('score', undefined, vals({ scoreInput: '18' }))
    expect(r).toEqual({ raw_score: -18, score_label: '18 strokes (4 holes)' })
  })
})

// ─── Prefill helpers ──────────────────────────────────────────────────────────

const RESULT_BASE = {
  raw_score: 0, difficulty_tier: null, result_type: null,
  opponent_name: null, match_score: null, weight_kg: null, reps: null, time_seconds: null,
}

describe('valsFromResult', () => {
  it('strength result prefills weight and reps', () => {
    const p = valsFromResult('strength', { ...RESULT_BASE, raw_score: 120, weight_kg: 120, reps: 3 })
    expect(p.weightKg).toBe('120')
    expect(p.repCount).toBe('3')
  })

  it('sprint result decodes centiseconds from raw_score', () => {
    const p = valsFromResult('sprint', { ...RESULT_BASE, raw_score: -1342 })
    expect(p.timeSecs).toBe('13')
    expect(p.sprintCs).toBe('42')
  })

  it('difficulty+time result prefills tier and mm:ss from time_seconds', () => {
    const p = valsFromResult('difficulty+time', { ...RESULT_BASE, raw_score: 20045, difficulty_tier: 'Bridge', time_seconds: 45 })
    expect(p.difficultyTier).toBe('Bridge')
    expect(p.timeMins).toBe('0')
    expect(p.timeSecs).toBe('45')
  })
})

describe('valsFromRaw (season PR prefill)', () => {
  it('round-trips a strength PR', () => {
    expect(valsFromRaw('strength', getEventBySlug('deadlift'), 140).weightKg).toBe('140')
  })

  it('decodes a timed-effort difficulty+time PR back to tier + seconds', () => {
    const running = getEventBySlug('running')!
    const raw = encodeDiffTime(1, 95, true)
    const p = valsFromRaw('difficulty+time', running, raw)
    expect(p.difficultyTier).toBe(running.difficultyTiers![1].name)
    expect((parseFloat(p.timeMins!) || 0) * 60 + (parseFloat(p.timeSecs!) || 0)).toBe(95)
  })

  it('decodes a difficulty+reps PR back to tier + reps', () => {
    const ev = getEventBySlug('push-up-contest')!
    const p = valsFromRaw('difficulty+reps', ev, 2 * 10000 + 12)
    expect(p.difficultyTier).toBe(ev.difficultyTiers![2].name)
    expect(p.repCount).toBe('12')
  })

  it('prefill → computeScoreVals reproduces the original raw_score (encode/decode round trip)', () => {
    const running = getEventBySlug('running')!
    const raw = encodeDiffTime(2, 240, true)
    const p = valsFromRaw('difficulty+time', running, raw)
    const r = computeScoreVals('difficulty+time', running, vals(p))
    expect(r!.raw_score).toBe(raw)
  })
})

// ─── Adversarial inputs — typed negatives must never flip the raw_score sign ──

describe('computeScoreVals: rejects hostile/invalid input', () => {
  it('negative time is rejected (would rank first in faster-wins events)', () => {
    expect(computeScoreVals('time', undefined, vals({ timeSecs: '-30' }))).toBeNull()
    expect(computeScoreVals('time', undefined, vals({ timeMins: '-1', timeSecs: '30' }))).toBeNull()
  })

  it('negative sprint seconds are rejected', () => {
    expect(computeScoreVals('sprint', undefined, vals({ timeSecs: '-10' }))).toBeNull()
    expect(computeScoreVals('sprint', undefined, vals({ timeSecs: '0', sprintCs: '-5' }))).toBeNull()
  })

  it('negative grip width is rejected for Shoulder Dislocate', () => {
    expect(computeScoreVals('strength', getEventBySlug('shoulder-dislocate'), vals({ weightKg: '-5', repCount: '5' }))).toBeNull()
  })

  it('negative weight / reps / distance / hold are rejected', () => {
    expect(computeScoreVals('strength', getEventBySlug('deadlift'), vals({ weightKg: '-100' }))).toBeNull()
    expect(computeScoreVals('reps', undefined, vals({ repCount: '-42' }))).toBeNull()
    expect(computeScoreVals('distance', undefined, vals({ distanceVal: '-8', distanceUnit: 'm' }))).toBeNull()
    expect(computeScoreVals('hold', undefined, vals({ timeSecs: '-90' }))).toBeNull()
  })

  it('difficulty+time rejects negative and tier-band-overflow times', () => {
    const running = getEventBySlug('running')!
    const tier = running.difficultyTiers![0].name
    expect(computeScoreVals('difficulty+time', running, vals({ difficultyTier: tier, timeSecs: '-30' }))).toBeNull()
    // ≥10000s would leak into the next tier's band
    expect(computeScoreVals('difficulty+time', running, vals({ difficultyTier: tier, timeMins: '170', timeSecs: '0' }))).toBeNull()
  })

  it('difficulty+reps rejects negative and tier-band-overflow reps', () => {
    const ev = getEventBySlug('push-up-contest')!
    const tier = ev.difficultyTiers![0].name
    expect(computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: tier, repCount: '-5' }))).toBeNull()
    expect(computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: tier, repCount: '10000' }))).toBeNull()
  })
})

// ─── Small helpers ────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('fmtTime formats seconds as m:ss and ignores sign', () => {
    expect(fmtTime(260)).toBe('4:20')
    expect(fmtTime(-90)).toBe('1:30')
  })

  it('fmtTime carries :60 into the next minute (119.6s is 2:00, not 1:60)', () => {
    expect(fmtTime(119.6)).toBe('2:00')
  })

  it('weight-scored tier detection matches GHD Situp D4, Pause Dips D5, Pause Chin Up D5', () => {
    expect(isWeightScoredTierByIdx('GHD Situp', 3)).toBe(true)
    expect(isWeightScoredTierByIdx('Pause Dips', 4)).toBe(true)
    expect(isWeightScoredTierByIdx('Pause Dips', 3)).toBe(false)
    expect(isWeightScoredTierByName('Pause Chin Up', 'Weighted Chinup')).toBe(true)
    expect(isWeightScoredTierByName('Pushup Contest', 'Push Up')).toBe(false)
  })
})
