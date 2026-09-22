import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { unseenAwards, unseenWithdrawals, latestConferredAt, coloursSeenKey, type AwardLike, type WithdrawalLike } from '@/lib/newColours'

// ─── The new-colour moment ───────────────────────────────────────────────────
// Step 4 of docs/designs/auto-conferral-spec.md. The cold-start rule is the
// part worth testing: the history replay (decision 9) confers every colour a
// player has ever earned in one go, and treating those as news would open the
// app on a stack of cards about months-old results.

const award = (domain_number: number, rung: number, conferred_at: string): AwardLike =>
  ({ domain_number, rung, grade_name: `G${rung}`, conferred_at })

const history = [
  award(1, 1, '2026-03-01T00:00:00Z'),
  award(2, 1, '2026-06-01T00:00:00Z'),
  award(1, 2, '2026-09-01T00:00:00Z'),
]

describe('what counts as news', () => {
  it('shows nothing at all on a cold start', () => {
    // No watermark yet. Every one of these is old news the player already knows.
    expect(unseenAwards(history, null)).toEqual([])
  })

  it('shows only what was conferred after the watermark', () => {
    expect(unseenAwards(history, '2026-05-01T00:00:00Z').map(a => a.domain_number)).toEqual([1, 2])
  })

  it('puts the newest first', () => {
    const out = unseenAwards(history, '2026-01-01T00:00:00Z')
    expect(out.map(a => a.conferred_at)).toEqual([
      '2026-09-01T00:00:00Z', '2026-06-01T00:00:00Z', '2026-03-01T00:00:00Z',
    ])
  })

  it('treats the watermark as exclusive, so nothing repeats', () => {
    // Dismissing writes `now`; an award conferred at exactly that instant must
    // not come back on the next load.
    expect(unseenAwards(history, '2026-09-01T00:00:00Z')).toEqual([])
  })

  it('finds the latest conferral to seed the watermark', () => {
    expect(latestConferredAt(history)).toBe('2026-09-01T00:00:00Z')
    expect(latestConferredAt([])).toBeNull()
  })

  it('keys the watermark per player, so a family switch does not share it', () => {
    expect(coloursSeenKey('a')).not.toBe(coloursSeenKey('b'))
    expect(coloursSeenKey('a')).toContain('a')
  })
})

describe('the hook', () => {
  const src = readFileSync('lib/useNewColours.ts', 'utf8')

  it('seeds an empty history to the epoch, so a FIRST colour is still news', () => {
    // latestConferredAt is null for a player who holds nothing. Seeding `now`
    // there would swallow the colour they are about to be given.
    expect(src).toMatch(/latestConferredAt\(state\.awards\) \?\? new Date\(0\)\.toISOString\(\)/)
  })

  it('asks the server once per player, not once per reload', () => {
    // The recheck triggers a reload, which re-runs the effect: without the
    // guard that is a loop.
    expect(src).toMatch(/asked\.current === playerId/)
    expect(src).toMatch(/asked\.current = playerId/)
  })

  it('reloads only when something was actually conferred', () => {
    expect(src).toMatch(/if \(r\.conferred\.length > 0\) reload\(\)/)
  })

  it('survives localStorage throwing', () => {
    // Private windows and some embedded views throw on access; the colours
    // still have to render.
    expect(src).toMatch(/try \{ return localStorage\.getItem/)
    expect(src).toMatch(/catch \{ return null \}/)
  })
})

// The client helpers' request and response contract is tested by behaviour,
// against a stubbed fetch, in recheckClient.test.ts.

describe('colours taken back', () => {
  const w = (withdrawn_at: string): WithdrawalLike =>
    ({ domain_number: 3, rung: 4, grade_name: 'Kōwhai', withdrawn_at, reason: null })

  it('shares the cold-start rule: no watermark, no notice', () => {
    expect(unseenWithdrawals([w('2026-09-01T00:00:00Z')], null)).toEqual([])
  })

  it('shows only what was taken back after the watermark', () => {
    const rows = [w('2026-08-01T00:00:00Z'), w('2026-09-10T00:00:00Z')]
    expect(unseenWithdrawals(rows, '2026-09-01T00:00:00Z').map(x => x.withdrawn_at)).toEqual(['2026-09-10T00:00:00Z'])
  })

  it('is cleared by the same dismissal as new colours', () => {
    // One watermark, one "Got it".
    const src = readFileSync('lib/useNewColours.ts', 'utf8')
    const dismiss = src.slice(src.indexOf('const dismiss'))
    expect(dismiss).toMatch(/setUnseen\(\[\]\)/)
    expect(dismiss).toMatch(/setWithdrawn\(\[\]\)/)
  })

  it('treats a missing withdrawals table as nothing withdrawn', () => {
    const src = readFileSync('lib/useNewColours.ts', 'utf8')
    expect(src).toMatch(/return error \|\| !data \? \[\] :/)
  })
})

describe('timestamps are instants, not strings', () => {
  // Every case here gives the WRONG answer under a string comparison, which is
  // what the code did before. A test that agreed either way would prove nothing.
  const award = (conferred_at: string) => ({ domain_number: 1, rung: 1, grade_name: 'Kiwikiwi', conferred_at })

  it('sees an award 20ms after the watermark, across the two formats', () => {
    // Postgres ".52+00:00" vs JavaScript ".5Z": as strings '2' < 'Z', so the
    // award reads as EARLIER and a real new colour is never announced.
    expect(unseenAwards([award('2026-09-22T06:00:00.52+00:00')], '2026-09-22T06:00:00.5Z')).toHaveLength(1)
  })

  it('does not re-announce an award from before the watermark written with an offset', () => {
    // 05:00+13:00 is 16:00 UTC the day before, four hours BEFORE the watermark;
    // as strings the "22" date sorts after "21" and it would show again.
    expect(unseenAwards([award('2026-09-22T05:00:00+13:00')], '2026-09-21T20:00:00.000Z')).toEqual([])
  })

  it('picks the latest award by instant when seeding the watermark', () => {
    const early = award('2026-09-22T05:00:00+13:00')   // 16:00Z on the 21st
    const late = award('2026-09-21T20:00:00.000Z')
    expect(latestConferredAt([early, late])).toBe(late.conferred_at)
  })
})
