import { describe, it, expect } from 'vitest'
import { EVENTS } from '@/lib/eventData'
import { EVENT_SUMMARIES } from '@/lib/eventSummaries'

// The public event pages show these one-liners instead of the full text, so a
// new event without one would fall back to the long version unnoticed, and a
// removed event's line would linger as dead copy.
describe('event summaries', () => {
  it('has a line for every event on the roster', () => {
    const missing = EVENTS.filter(e => !EVENT_SUMMARIES[e.slug]).map(e => e.slug)
    expect(missing).toEqual([])
  })

  it('has no line for an event that is not on the roster', () => {
    const slugs = new Set(EVENTS.map(e => e.slug))
    expect(Object.keys(EVENT_SUMMARIES).filter(s => !slugs.has(s))).toEqual([])
  })

  it('keeps every line short and non-empty', () => {
    for (const [slug, { how, rules }] of Object.entries(EVENT_SUMMARIES)) {
      expect(how.length, slug).toBeGreaterThan(0)
      expect(rules.length, slug).toBeGreaterThan(0)
      expect(how.length, `${slug} how`).toBeLessThanOrEqual(110)
      expect(rules.length, `${slug} rules`).toBeLessThanOrEqual(110)
    }
  })
})
