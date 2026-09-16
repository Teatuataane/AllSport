import { describe, it, expect } from 'vitest'
import { loggedBestRows, type LoggedBestEntry } from '@/lib/workouts'

const entry = (e: Partial<LoggedBestEntry>): LoggedBestEntry => ({
  id: 'e1', event_slug: 'cycling', raw_score: 29900, score_label: 'D3 1000m · 1:40', difficulty_tier: '1000m',
  workouts: { performed_on: '2026-09-15', witnessed: false }, ...e,
})

describe('logged bests on My Events', () => {
  it('shapes a best effort like a game result, filed under the day trained', () => {
    expect(loggedBestRows([entry({})])).toEqual([{
      id: 'logged:e1', score_label: 'D3 1000m · 1:40', raw_score: 29900, difficulty_tier: '1000m',
      session_date: '2026-09-15', event_name: 'Cycling', domain_number: 6, witnessed: false,
    }])
  })

  it('keys every row apart from game result ids, so React never merges the two', () => {
    expect(loggedBestRows([entry({ id: 'abc' })])[0].id).toBe('logged:abc')
  })

  it('carries whether a kaiwhakawā witnessed it', () => {
    expect(loggedBestRows([entry({ workouts: { performed_on: '2026-09-15', witnessed: true } })])[0].witnessed).toBe(true)
  })

  it('reads a numeric raw_score that PostgREST returned as a string', () => {
    expect(loggedBestRows([entry({ raw_score: '29900' as unknown as number })])[0].raw_score).toBe(29900)
  })

  it('drops volume-only, unfitted, retired and orphaned entries', () => {
    expect(loggedBestRows([
      entry({ raw_score: null }),
      entry({ score_label: null }),
      entry({ event_slug: null }),
      entry({ event_slug: 'walking' }),
      entry({ workouts: null }),
    ])).toEqual([])
  })
})
