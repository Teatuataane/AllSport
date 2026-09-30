// Value: protects=play history colouring a solo workout's lifts against the right bodyweight;
// fails_when=bodyweightOnDay stops reading the declaration in force on that day, reads a later
// declaration, or ignores the legacy band fallback before 20260922213125; why_new=bodyweightOnDay
// is new in this change and only reached from the login-gated /history page; seam=none
import { describe, it, expect } from 'vitest'
import { bodyweightOnDay, type GradeInputs } from '@/lib/loadGrades'

function inputs(over: Partial<GradeInputs>): GradeInputs {
  return {
    profile: { division: "Men's", age_years: 30 }, gender: 'Male', band: null,
    results: [], entries: [], exemptions: [], awards: [], matches: [],
    voids: new Set<string>(), schemaReady: true, workoutsReady: true, complete: true,
    ...over,
  }
}

describe('bodyweightOnDay', () => {
  const declared = inputs({
    bodyweightsLive: true,
    bodyweights: [
      { measured_on: '2026-09-01', kg: 80 },
      { measured_on: '2026-09-20', kg: 84 },
    ],
  })

  it('takes the declaration in force on that day, never a later one', () => {
    expect(bodyweightOnDay(declared, '2026-09-10')).toBe(80)
    expect(bodyweightOnDay(declared, '2026-09-20')).toBe(84)
    expect(bodyweightOnDay(declared, '2026-09-30')).toBe(84)
  })

  it('is unknown before the first declaration and for a missing day', () => {
    expect(bodyweightOnDay(declared, '2026-08-31')).toBeNull()
    expect(bodyweightOnDay(declared, null)).toBeNull()
    expect(bodyweightOnDay(declared, undefined)).toBeNull()
  })

  it('once declarations are live, a stored band is NOT a fallback', () => {
    expect(bodyweightOnDay(inputs({ bodyweightsLive: true, bodyweights: [], band: '60 to 70kg' }), '2026-09-10'))
      .toBeNull()
  })

  it('before declarations are live, grades on the first band, else the current one', () => {
    expect(bodyweightOnDay(inputs({ band: '60 to 70kg', firstBand: '50 to 60kg' }), '2026-09-10')).toBe(55)
    expect(bodyweightOnDay(inputs({ band: '60 to 70kg' }), '2026-09-10')).toBe(65)
    expect(bodyweightOnDay(inputs({}), '2026-09-10')).toBeNull()
  })
})
