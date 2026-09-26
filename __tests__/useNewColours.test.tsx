// @vitest-environment jsdom
//
// ── useNewColours, rendered ──────────────────────────────────────────────────
// The recheck-once guard, the cold-start seed and the reload-only-on-news rule
// are effects. A regex over the source would still match if the guard moved
// inside the `.then` and reopened the reload loop, so these render the hook.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => ({
  recheck: vi.fn(async () => ({ conferred: [] as unknown[], writable: true })),
}))

vi.mock('@/lib/recheckGrades', () => ({ recheckGrades: h.recheck }))
vi.mock('@/lib/supabase-browser', () => ({
  createClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {}
      b.select = () => b; b.eq = () => b
      b.gt = async () => ({ data: [], error: null })
      return b
    },
  }),
}))

import { useNewColours } from '@/lib/useNewColours'
import { coloursSeenKey } from '@/lib/newColours'
import type { GradeState } from '@/lib/loadGrades'

const award = (conferred_at: string) => ({ domain_number: 1, rung: 1, grade_name: 'Kiwikiwi', conferred_at })
const state = (awards: ReturnType<typeof award>[]) => ({ awards } as unknown as GradeState)

beforeEach(() => {
  localStorage.clear()
  h.recheck.mockReset()
  h.recheck.mockResolvedValue({ conferred: [], writable: true })
})
afterEach(cleanup)

describe('useNewColours', () => {
  it('asks the server once per player, however often the state or reload change', async () => {
    const { rerender } = renderHook(({ s, r }) => useNewColours('p1', s, r), {
      initialProps: { s: state([]), r: () => {} },
    })
    rerender({ s: state([]), r: () => {} })
    rerender({ s: state([award('2026-09-01T00:00:00Z')]), r: () => {} })
    await waitFor(() => expect(h.recheck).toHaveBeenCalledTimes(1))
    // First visit under these rules: forced, because a rules deploy writes no rows.
    expect(h.recheck).toHaveBeenCalledWith({ playerId: 'p1', force: true })
  })

  it('asks again for a different player (a family switch)', async () => {
    // Stable references, as the pages hold them in useState: a fresh object on
    // every render is a render loop, in a test or in the app.
    const s0 = state([]); const r0 = () => {}
    const { rerender } = renderHook(({ id }) => useNewColours(id, s0, r0), { initialProps: { id: 'p1' } })
    rerender({ id: 'p2' })
    await waitFor(() => expect(h.recheck).toHaveBeenCalledTimes(2))
  })

  it('waits for the state before asking, so the cold-start seed predates the recheck', async () => {
    const r0 = () => {}
    renderHook(() => useNewColours('p1', null, r0))
    await new Promise(r => setTimeout(r, 0))
    expect(h.recheck).not.toHaveBeenCalled()
  })

  it('seeds a player with no colours to the epoch, so their first colour is news', () => {
    const s0 = state([]); const r0 = () => {}
    renderHook(() => useNewColours('p1', s0, r0))
    expect(localStorage.getItem(coloursSeenKey('p1'))).toBe(new Date(0).toISOString())
  })

  it('seeds a returning player to their latest colour, so history is not news', () => {
    const s0 = state([award('2026-03-01T00:00:00Z'), award('2026-09-01T00:00:00Z')]); const r0 = () => {}
    const { result } = renderHook(() => useNewColours('p1', s0, r0))
    expect(localStorage.getItem(coloursSeenKey('p1'))).toBe('2026-09-01T00:00:00Z')
    expect(result.current.unseen).toEqual([])
  })

  it('reloads exactly once when something landed, and not at all when nothing did', async () => {
    const reload = vi.fn()
    h.recheck.mockResolvedValue({ conferred: [{ domainNumber: 1, rung: 1, name: 'Kiwikiwi', events: 6 }], writable: true })
    const s1 = state([])
    renderHook(() => useNewColours('p1', s1, reload))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))

    const quiet = vi.fn()
    h.recheck.mockResolvedValue({ conferred: [], writable: true })
    const s2 = state([])
    renderHook(() => useNewColours('p2', s2, quiet))
    await waitFor(() => expect(h.recheck).toHaveBeenCalledTimes(2))
    expect(quiet).not.toHaveBeenCalled()
  })

  it('shows what arrived after the watermark, and dismiss clears it', async () => {
    localStorage.setItem(coloursSeenKey('p1'), '2026-08-01T00:00:00Z')
    const s0 = state([award('2026-09-01T00:00:00Z')]); const r0 = () => {}
    const { result } = renderHook(() => useNewColours('p1', s0, r0))
    expect(result.current.unseen).toHaveLength(1)
    result.current.dismiss()
    await waitFor(() => expect(result.current.unseen).toEqual([]))
  })
})

describe('dismiss', () => {
  it('writes the newest SERVER timestamp shown, not the phone clock', async () => {
    // A clock running ahead would otherwise hide a colour conferred just after.
    localStorage.setItem(coloursSeenKey('p1'), '2026-08-01T00:00:00Z')
    const s0 = state([award('2026-09-01T00:00:00Z'), award('2026-09-05T00:00:00Z')]); const r0 = () => {}
    const { result } = renderHook(() => useNewColours('p1', s0, r0))
    result.current.dismiss()
    await waitFor(() => expect(localStorage.getItem(coloursSeenKey('p1'))).toBe('2026-09-05T00:00:00Z'))
  })
})
