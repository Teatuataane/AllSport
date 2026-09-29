// ── Lifts rank on their estimated 1RM (29 Sept 2026) ─────────────────────────
// estimatedOneRm() scores every new lift; 20260928201510 re-encodes history
// with the same formula in SQL. If the two ever disagree, a lift scored today
// and the same lift from August rank differently, silently. These tests are
// what notices.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { estimatedOneRm, liftLabel, MAX_ESTIMATED_REPS } from '@/lib/scoring'
import { EVENTS, getEventBySlug } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20260928201510_estimated_one_rep_max.sql'), 'utf8')

/** Postgres numeric: exact w × 36 / (37 − r), rounded half away from zero to 0.1. */
function exactSql(weightKg: number, reps: number): number {
  const r = Math.min(reps, MAX_ESTIMATED_REPS)
  if (r <= 1) return weightKg
  // Exact rational in integers: hundredths × 36 / (37 − r), in hundredths.
  const num = BigInt(Math.round(weightKg * 100)) * BigInt(36) * BigInt(10)
  const den = BigInt(37 - r) * BigInt(100)
  const q = num / den, rem = num % den
  const tenths = rem * BigInt(2) >= den ? q + BigInt(1) : q
  return Number(tenths) / 10
}

describe('estimatedOneRm', () => {
  it('is Brzycki, and a single is the load itself', () => {
    expect(estimatedOneRm(100, 1)).toBe(100)
    expect(estimatedOneRm(100, null)).toBe(100)
    expect(estimatedOneRm(100, 5)).toBe(112.5)
    expect(estimatedOneRm(35, 5)).toBe(39.4)
  })

  it('counts reps past ten as ten', () => {
    expect(MAX_ESTIMATED_REPS).toBe(10)
    expect(estimatedOneRm(60, 15)).toBe(estimatedOneRm(60, 10))
    expect(estimatedOneRm(60, 11)).toBeGreaterThan(estimatedOneRm(60, 9))
  })

  it('never drops below the load, and more reps never score less', () => {
    for (let w = 2.5; w <= 250; w += 2.5) {
      let prev = w
      for (let r = 1; r <= 15; r++) {
        const e = estimatedOneRm(w, r)
        expect(e).toBeGreaterThanOrEqual(prev)
        prev = e
      }
    }
  })

  it('rounds exactly as Postgres numeric does, on every plate a player could load', () => {
    for (let w100 = 25; w100 <= 30000; w100 += 25) {
      const w = w100 / 100
      for (let r = 2; r <= 12; r++) expect(estimatedOneRm(w, r)).toBe(exactSql(w, r))
    }
  })

  it('rounds a load past two decimals on its decimal digits, as Postgres does', () => {
    // 39.375 × 100 is 3937.4999… in binary; round(39.375, 2) in SQL is 39.38.
    expect(estimatedOneRm(39.375, 5)).toBe(Math.round(3938 * 36 / (10 * 32)) / 10)
    expect(estimatedOneRm(1.005, 5)).toBe(Math.round(101 * 36 / (10 * 32)) / 10)
  })

  it('the database trigger uses the same formula and the same lift list', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.enforce_lift_estimate'))
    expect(fn).toContain('round(round(NEW.weight_kg, 2) * 36 / (37 - least(NEW.reps, 10)), 1)')
    const lifts = EVENTS.filter(e => e.inputMode === 'strength' && e.slug !== 'shoulder-dislocate')
    const list = (marker: string) => {
      const from = fn.indexOf(marker)
      const body = fn.slice(fn.indexOf('(', from) + 1, fn.indexOf(')', from))
      return [...body.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1]).sort()
    }
    expect(list('IF v_name IN')).toEqual(lifts.map(e => e.name).sort())
    expect(list('OR v_slug IN')).toEqual(lifts.map(e => e.slug).sort())
    // Named to fire after the guard and band-stamp BEFORE triggers.
    expect(MIGRATION).toContain('CREATE TRIGGER trg_zz_lift_estimate_results')
    expect(MIGRATION).toContain('CREATE TRIGGER trg_zz_lift_estimate_entries')
  })

  it('writes what was lifted, then the estimate', () => {
    expect(liftLabel(35, 5)).toBe('35kg × 5 reps · est. 1RM 39.4kg')
    expect(liftLabel(35, 1)).toBe('35kg × 1 rep')
    expect(liftLabel(35, 0)).toBe('35kg')
  })
})

describe('the history migration', () => {
  it('uses the same formula and cap', () => {
    const f = 'round(round(r.weight_kg, 2) * 36 / (37 - least(r.reps, 10)), 1)'
    expect(MIGRATION).toContain(f)
    expect(MIGRATION).toContain(f.replace(/r\./g, 'e.'))
  })

  it('re-encodes exactly the strength events, and never Shoulder Dislocate', () => {
    const lifts = EVENTS.filter(e => e.inputMode === 'strength' && e.slug !== 'shoulder-dislocate')
    for (const e of lifts) {
      expect(MIGRATION).toContain(`'${e.name}'`)
      expect(MIGRATION).toContain(`'${e.slug}'`)
    }
    expect(MIGRATION).not.toContain('shoulder-dislocate')
    expect(MIGRATION).not.toContain("'Shoulder Dislocate'")
  })

  it('re-encodes nothing but the strength events', () => {
    const lifts = EVENTS.filter(e => e.inputMode === 'strength' && e.slug !== 'shoulder-dislocate')
    const listAfter = (marker: string) => {
      const from = MIGRATION.indexOf(marker)
      const body = MIGRATION.slice(MIGRATION.indexOf('IN (', from) + 4, MIGRATION.indexOf(')', MIGRATION.indexOf('IN (', from)))
      return [...body.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1]).sort()
    }
    expect(listAfter('WHERE se.event_name IN (')).toEqual(lifts.map(e => e.name).sort())
    expect(listAfter('WHERE e.event_slug IN (')).toEqual(lifts.map(e => e.slug).sort())
  })

  it('writes the same label liftLabel does', () => {
    expect(MIGRATION).toContain("trim_scale(r.weight_kg)::text || 'kg × ' || r.reps || ' reps · est. 1RM '")
    expect(liftLabel(37.5, 4)).toMatch(/^37\.5kg × 4 reps · est\. 1RM [\d.]+kg$/)
  })

  it('never places a voided game, and archives only rows still on the old scale', () => {
    expect(MIGRATION).toContain('WHERE ss.is_active = false AND ss.voided_at IS NULL')
    expect(MIGRATION).toContain("(se.event_name = 'Toe Lift' AND r.time_seconds IS NULL)")
    expect(MIGRATION).toContain("(se.event_name = 'Tibialis Curl' AND r.difficulty_tier IS NULL)")
    expect(MIGRATION).toContain("(e.event_slug = 'toe-lift' AND e.time_seconds IS NULL)")
    expect(MIGRATION).toContain("(e.event_slug = 'tibialis-curl' AND e.difficulty_tier IS NULL)")
  })

  it('clears the recheck watermark of everyone whose scores moved', () => {
    expect(MIGRATION).toMatch(/UPDATE players SET grades_checked_at = NULL\s+WHERE id IN \(SELECT player_id FROM touched_players/)
  })

  it('archives before it deletes, and locks the archives', () => {
    expect(MIGRATION.indexOf('results_toe_tib_archive_20260928201510 AS'))
      .toBeLessThan(MIGRATION.indexOf('DELETE FROM results'))
    for (const t of ['results_toe_tib_archive', 'workout_entries_toe_tib_archive',
      'results_one_rep_max_preimage', 'workout_entries_one_rep_max_preimage']) {
      expect(MIGRATION).toContain(`${t}_20260928201510 ENABLE ROW LEVEL SECURITY`)
      expect(MIGRATION).toContain(`REVOKE ALL ON public.${t}_20260928201510 FROM anon, authenticated`)
    }
  })
})

describe('Toe Lift and Tibialis Curl', () => {
  it('Toe Lift is a weight and a hold, graded on raw thresholds', () => {
    const ev = getEventBySlug('toe-lift')!
    expect(ev.inputMode).toBe('weight+time')
    expect(ev.hasDifficultyTiers).toBe(false)
    expect(STANDARDS['toe-lift'].kind).toBe('raw')
  })

  it('Tibialis Curl is a 2-minute rep contest with load levels', () => {
    const ev = getEventBySlug('tibialis-curl')!
    expect(ev.inputMode).toBe('difficulty+reps')
    expect(ev.difficultyTiers?.map(t => t.name)).toEqual(['Bodyweight', '2.5kg', '5kg', '10kg', '15kg', '20kg'])
    expect(ev.rules).toContain('2 minutes')
    expect(STANDARDS['tibialis-curl'].kind).toBe('raw')
  })

  it('Anaerobic Endurance no longer needs a bodyweight', () => {
    const ratio = EVENTS.filter(e => e.domainNumber === 5 && STANDARDS[e.slug]?.kind === 'ratio')
    expect(ratio).toEqual([])
  })
})

describe('Anaerobic Endurance is a 2-minute contest', () => {
  it('every rep event states the 2 minutes; holds run as long as possible', () => {
    for (const e of EVENTS.filter(e => e.domainNumber === 5)) {
      const isHold = e.inputMode === 'hold' || e.inputMode === 'weight+time'
      if (!isHold) expect(e.rules, e.name).toMatch(/2 minutes|two minutes/i)
    }
  })
})
