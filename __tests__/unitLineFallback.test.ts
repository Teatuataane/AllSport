// unitLine quotes two numbers from the unit sheet. It used to regex-parse them
// out of display copy and fall back to hard-coded values, so rewording that copy
// silently put the wrong numbers on HOME. It now reads unitFacts directly.
import { describe, it, expect } from 'vitest'
import { unitLine } from '@/lib/colourDisplay'
import { unitFacts, unitRulesSummary } from '@/lib/units'

describe('unitLine', () => {
  it('quotes the same numbers the sheet counts', () => {
    const { rideKm, throws } = unitFacts()
    expect(unitLine()).toBe(`1 unit = one set, one hold, one game, ${throws} throws or jumps, or ${rideKm}km of distance work, in that domain's events.`)
  })

  it('agrees with the rules How To Play and the guide show', () => {
    const { rideKm, throws } = unitFacts()
    const rules = unitRulesSummary().map(r => r.rule).join(' | ')
    expect(rules).toContain(`${rideKm}km is 1 unit`)
    expect(rules).toContain(`Every ${throws} attempts`)
  })
})
