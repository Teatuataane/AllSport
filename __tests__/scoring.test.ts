import { describe, it, expect } from 'vitest'
import {
  fmtTime,
  computeScoreVals,
  valsFromResult,
  valsFromRaw,
  isWeightScoredTierByIdx,
  isWeightScoredTierByName,
  tierScoring,
  valsFromRaw as _vfr,
  EMPTY_VALS,
  type EntryVals,
} from '@/lib/scoring'
import { getEventBySlug, encodeDiffTime, isTimedEffort } from '@/lib/eventData'

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

  it('weight-scored tiers stay ON the tier band, heaviest first', () => {
    // Before Sept 2026 this returned a BARE weight (raw_score 20), which put the
    // hardest rung below D2's 10,005 — the hardest thing you can do scored lower
    // than the second-easiest. It is now banded like every other rung.
    const ev = getEventBySlug('pause-dips')!
    const idx = ev.difficultyTiers!.findIndex(t => t.scoring === 'weight')
    const rung = ev.difficultyTiers![idx].name
    const r = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, weightKg: '20', repCount: '5' }))
    expect(r).toEqual({
      raw_score: idx * 10000 + 2000,
      score_label: `D${idx + 1} ${rung} · 20kg × 5`,
    })
    // Heavier wins; reps are recorded but never rank.
    const heavier = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, weightKg: '22.5', repCount: '1' }))
    expect(heavier!.raw_score).toBeGreaterThan(r!.raw_score)
    // And it outranks every rung below it, which was the bug.
    const d2 = ev.difficultyTiers![1].name
    const below = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: d2, repCount: '99' }))
    expect(r!.raw_score).toBeGreaterThan(below!.raw_score)
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

  it('weight-scored tier detection matches GHD Situp D4, Pause Dips D5, Pause Chinup D5', () => {
    expect(isWeightScoredTierByIdx('GHD Situp', 3)).toBe(true)
    expect(isWeightScoredTierByIdx('Pause Dips', 4)).toBe(true)
    expect(isWeightScoredTierByIdx('Pause Dips', 3)).toBe(false)
    expect(isWeightScoredTierByName('Pause Chinup', 'Weighted Chinup')).toBe(true)
    expect(isWeightScoredTierByName('Pushup Contest', 'Push Up')).toBe(false)
  })

  it('Pause Chinup weight tier still resolves under its pre-rename name', () => {
    // session_events rows created before the Aug 2026 rename still say 'Pause Chin Up'
    expect(isWeightScoredTierByIdx('Pause Chin Up', 4)).toBe(true)
    expect(isWeightScoredTierByName('Pause Chin Up', 'Weighted Chinup')).toBe(true)
    // and the current name works
    expect(isWeightScoredTierByIdx('Pause Chinup', 4)).toBe(true)
  })
})

// ─── The Sept 2026 difficulty review: `Game` rungs, weight rungs, throw ladders ──

describe('Game rungs', () => {
  const gameIdx = (slug: string) => {
    const ev = getEventBySlug(slug)!
    return ev.difficultyTiers!.findIndex(t => t.scoring === 'sport')
  }

  it('records win/draw/loss and ranks win above draw above loss', () => {
    const ev = getEventBySlug('volleyball')!
    const idx = gameIdx('volleyball')
    const rung = ev.difficultyTiers![idx].name
    const mk = (res: 'win' | 'draw' | 'loss') =>
      computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, sportResult: res }))!
    expect(mk('win').raw_score).toBe(idx * 10000 + 2)
    expect(mk('draw').raw_score).toBe(idx * 10000 + 1)
    expect(mk('loss').raw_score).toBe(idx * 10000 + 0)
    expect(mk('win').score_label).toBe(`D${idx + 1} ${rung} · Win`)
  })

  it('a loss at the Game rung still outranks a perfect drill below it', () => {
    // The whole point of the ladder: playing the real contest is harder than
    // drilling, whatever the result.
    const ev = getEventBySlug('volleyball')!
    const idx = gameIdx('volleyball')
    const loss = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: ev.difficultyTiers![idx].name, sportResult: 'loss' }))!
    const drill = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: ev.difficultyTiers![idx - 1].name, repCount: '9999' }))!
    expect(loss.raw_score).toBeGreaterThan(drill.raw_score)
  })

  it('does NOT invert the result on a timed-effort ladder', () => {
    // T-Race is a timed effort, so its seconds term is stored as DT_CAP - secs.
    // Inverting the win/draw/loss term too would make a loss beat a win.
    const ev = getEventBySlug('t-race')!
    expect(isTimedEffort(ev.slug)).toBe(true)
    const idx = gameIdx('t-race')
    const rung = ev.difficultyTiers![idx].name
    const win = computeScoreVals('difficulty+time', ev, vals({ difficultyTier: rung, sportResult: 'win' }))!
    const loss = computeScoreVals('difficulty+time', ev, vals({ difficultyTier: rung, sportResult: 'loss' }))!
    expect(win.raw_score).toBeGreaterThan(loss.raw_score)
  })

  it('refuses to score a Game rung with no result entered', () => {
    const ev = getEventBySlug('volleyball')!
    const rung = ev.difficultyTiers![gameIdx('volleyball')].name
    expect(computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, repCount: '20' }))).toBeNull()
  })

  it('Golf carries the round\'s strokes alongside the result', () => {
    const ev = getEventBySlug('golf')!
    const idx = gameIdx('golf')
    const rung = ev.difficultyTiers![idx].name
    expect(ev.difficultyTiers![idx].records).toBe('strokes')
    const r = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, sportResult: 'win', scoreInput: '17' }))!
    expect(r.raw_score).toBe(idx * 10000 + 2)
    expect(r.score_label).toContain('17 strokes')
  })
})

describe('weight rungs', () => {
  it('are declared on the tier, not matched by event name', () => {
    const ev = getEventBySlug('pause-chin-up')!
    const idx = ev.difficultyTiers!.findIndex(t => t.scoring === 'weight')
    expect(idx).toBeGreaterThan(-1)
    expect(tierScoring(ev, idx)).toBe('weight')
    expect(tierScoring(ev, 0)).toBeNull()
    // The legacy name list still answers for a row whose event cannot be resolved
    // — session_events may hold a name getEventByName no longer knows.
    expect(isWeightScoredTierByName('Pause Chin Up', 'Weighted Chinup')).toBe(true)
    expect(isWeightScoredTierByIdx('GHD Situp', 3)).toBe(true)
  })

  it('rank heaviest first and record the reps without ranking on them', () => {
    const ev = getEventBySlug('ghd-situp')!
    const idx = ev.difficultyTiers!.findIndex(t => t.scoring === 'weight')
    const rung = ev.difficultyTiers![idx].name
    const light = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, weightKg: '10', repCount: '30' }))!
    const heavy = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, weightKg: '20', repCount: '1' }))!
    expect(heavy.raw_score).toBeGreaterThan(light.raw_score)
    expect(light.score_label).toBe(`D${idx + 1} ${rung} · 10kg × 30`)
  })
})

describe('difficulty+distance (throw ladders)', () => {
  it('bands the throw under its implement, to 0.1m', () => {
    const ev = getEventBySlug('javelin-throw')!
    expect(ev.inputMode).toBe('difficulty+distance')
    const r = computeScoreVals('difficulty+distance', ev, vals({ difficultyTier: ev.difficultyTiers![2].name, distanceVal: '31.4' }))!
    expect(r.raw_score).toBe(2 * 10000 + 314)
    expect(r.score_label).toBe(`D3 ${ev.difficultyTiers![2].name} · 31.4m`)
  })

  it('a short throw with the hard implement still beats a long one with the easy implement', () => {
    const ev = getEventBySlug('javelin-throw')!
    const hard = computeScoreVals('difficulty+distance', ev, vals({ difficultyTier: ev.difficultyTiers![2].name, distanceVal: '5' }))!
    const easy = computeScoreVals('difficulty+distance', ev, vals({ difficultyTier: ev.difficultyTiers![0].name, distanceVal: '90' }))!
    expect(hard.raw_score).toBeGreaterThan(easy.raw_score)
  })
})

describe('weight+time (Leg Ext Hold)', () => {
  const ev = () => getEventBySlug('leg-extension')!
  const mk = (kg: string, mins: string, secs: string) =>
    computeScoreVals('weight+time', ev(), vals({ weightKg: kg, timeMins: mins, timeSecs: secs }))!

  it('ranks heavier first, with the hold breaking the tie', () => {
    expect(ev().inputMode).toBe('weight+time')
    const heavyShort = mk('12', '0', '10')
    const lightLong = mk('8', '2', '0')
    expect(heavyShort.raw_score).toBeGreaterThan(lightLong.raw_score)

    const sameLoadLonger = mk('8', '3', '0')
    expect(sameLoadLonger.raw_score).toBeGreaterThan(lightLong.raw_score)
  })

  it('puts a bodyweight hold below every loaded one, and labels it', () => {
    const bw = mk('', '5', '0')
    expect(bw.raw_score).toBeLessThan(mk('2', '0', '1').raw_score)
    expect(bw.score_label).toBe('Bodyweight · 5:00')
  })

  it('refuses a hold with no time', () => {
    expect(computeScoreVals('weight+time', ev(), vals({ weightKg: '8' }))).toBeNull()
  })
})

describe('the new modes reject what they cannot encode', () => {
  const legExt = getEventBySlug('leg-extension')!
  const javelin = getEventBySlug('javelin-throw')!

  it('weight+time refuses a negative load instead of inventing a score', () => {
    // Before the guard this encoded raw -4999970 under the label "Bodyweight",
    // i.e. a score the player never set, described wrongly.
    expect(computeScoreVals('weight+time', legExt, vals({ weightKg: '-5', timeSecs: '30' }))).toBeNull()
    expect(computeScoreVals('weight+time', legExt, vals({ weightKg: '8' }))).toBeNull()
  })

  it('weight+time refuses a load past what the encoding can hold', () => {
    expect(computeScoreVals('weight+time', legExt, vals({ weightKg: '150', timeSecs: '30' }))).toBeNull()
  })

  it('difficulty+distance refuses a non-positive throw, a missing rung, and an over-band one', () => {
    const rung = javelin.difficultyTiers![0].name
    expect(computeScoreVals('difficulty+distance', javelin, vals({ difficultyTier: rung, distanceVal: '-5' }))).toBeNull()
    expect(computeScoreVals('difficulty+distance', javelin, vals({ distanceVal: '30' }))).toBeNull()
    // 1000m would encode as 10000 and spill into the next rung entirely.
    expect(computeScoreVals('difficulty+distance', javelin, vals({ difficultyTier: rung, distanceVal: '1000' }))).toBeNull()
  })

  it('a weight rung never spills into the rung above it', () => {
    const ev = getEventBySlug('pause-dips')!
    const idx = ev.difficultyTiers!.findIndex(t => t.scoring === 'weight')
    const rung = ev.difficultyTiers![idx].name
    const max = computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, weightKg: '99.99' }))!
    expect(max.raw_score).toBe(idx * 10000 + 9999)
    expect(computeScoreVals('difficulty+reps', ev, vals({ difficultyTier: rung, weightKg: '200' }))).toBeNull()
  })
})

describe('prefill round-trips for the new modes', () => {
  it('valsFromRaw reproduces a difficulty+distance score', () => {
    const ev = getEventBySlug('javelin-throw')!
    const raw = 2 * 10000 + 314
    const p = _vfr('difficulty+distance', ev, raw)
    expect(p.difficultyTier).toBe(ev.difficultyTiers![2].name)
    expect(computeScoreVals('difficulty+distance', ev, vals(p))!.raw_score).toBe(raw)
  })

  it('valsFromRaw reproduces a weight+time score', () => {
    const ev = getEventBySlug('leg-extension')!
    const raw = computeScoreVals('weight+time', ev, vals({ weightKg: '12.5', timeMins: '1', timeSecs: '30' }))!.raw_score
    expect(computeScoreVals('weight+time', ev, vals(_vfr('weight+time', ev, raw)))!.raw_score).toBe(raw)
  })

  it('valsFromResult reproduces a weight+time score from its row', () => {
    const ev = getEventBySlug('leg-extension')!
    const first = computeScoreVals('weight+time', ev, vals({ weightKg: '12', timeMins: '1', timeSecs: '30' }))!
    const p = valsFromResult('weight+time', {
      raw_score: first.raw_score, difficulty_tier: null, result_type: null, opponent_name: null,
      match_score: null, weight_kg: 12, reps: null, time_seconds: 90,
    })
    expect(computeScoreVals('weight+time', ev, vals(p))!.raw_score).toBe(first.raw_score)
  })
})

describe('isWeightScoredTier* : tier flag beats the legacy table', () => {
  const dips = getEventBySlug('pause-dips')!
  it('reads the flag when the event resolves, the frozen index when it does not', () => {
    const idx = dips.difficultyTiers!.findIndex(t => t.scoring === 'weight')
    expect(isWeightScoredTierByIdx('Pause Dips', idx, dips)).toBe(true)
    expect(isWeightScoredTierByIdx('Pause Dips', 4, dips)).toBe(false)
    // No event data: the legacy table answers with the PRE-review index.
    expect(isWeightScoredTierByIdx('Pause Dips', 4)).toBe(true)
    expect(isWeightScoredTierByIdx('Pause Dips', 3)).toBe(false)
  })

  it('matches one index per event — GHD Situp is 3, never 4', () => {
    expect(isWeightScoredTierByIdx('GHD Situp', 3)).toBe(true)
    expect(isWeightScoredTierByIdx('GHD Situp', 4)).toBe(false)
  })

  it('an unknown rung or out-of-range index is false', () => {
    expect(isWeightScoredTierByIdx('Pause Dips', 99, dips)).toBe(false)
    expect(isWeightScoredTierByName('Pause Dips', 'Nope', dips)).toBe(false)
  })
})
