/**
 * @vitest-environment jsdom
 */
// The live game's save path (v0.48.0.0): a score is on screen before the
// server answers, a failure takes it back off with Try again, and a re-read
// mid-write never drops it.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

type Resolver = (v: { data: unknown; error: unknown }) => void
const state = {
  readRows: [] as unknown[],
  inserts: [] as Resolver[],
  insertCalls: 0,
  readCalls: 0,
}

// A tiny stand-in for the query builder: a read resolves with `readRows`, an
// insert waits until the test resolves it by hand.
function fakeFrom() {
  return {
    select: () => ({
      eq: () => { state.readCalls++; return Promise.resolve({ data: state.readRows, error: null }) },
    }),
    insert: () => ({
      select: () => { state.insertCalls++; return new Promise(res => { state.inserts.push(res as Resolver) }) },
    }),
  }
}

vi.mock('@/lib/supabase-browser', () => ({
  createClient: () => ({ from: fakeFrom, rpc: () => Promise.resolve({ error: null }) }),
}))
vi.mock('@/lib/liveSession', () => ({
  onResultsChanged: () => () => {},
  announceResultsChanged: vi.fn(),
}))

import { useSessionResults, type SaveJob, type SessionResult } from '@/lib/useSessionResults'

const base: SessionResult = {
  id: '', player_id: 'p1', player_name: 'Aroha', event_id: 'ev1', raw_score: 100, score_label: '100kg',
  placement: null, points_earned: null, difficulty_tier: null, result_type: null, opponent_name: null,
  match_score: null, weight_kg: 100, reps: 1, time_seconds: null, distance_m: null, is_pr: false,
}
const job = (): SaveJob => ({
  payload: { session_id: 's1', event_id: 'ev1', player_id: 'p1', raw_score: 100, score_label: '100kg' },
  row: base, editingId: null, matchOpponents: null, what: 'Deadlift 100kg',
})

beforeEach(() => {
  state.readRows = []
  state.inserts = []
  state.insertCalls = 0
  state.readCalls = 0
})

describe('useSessionResults', () => {
  it('draws a score at once, while the insert has not answered', async () => {
    const { result } = renderHook(() => useSessionResults('s1'))
    await waitFor(() => expect(state.readCalls).toBe(1))
    act(() => { result.current.save(job()) })
    expect(state.insertCalls).toBe(1)
    expect(result.current.results).toHaveLength(1)
    expect(result.current.results[0]).toMatchObject({ score_label: '100kg', pending: true })
    // Not confirmed, so the one-time moments do not see it yet.
    expect(result.current.confirmed).toHaveLength(0)
  })

  it('swaps in the stored row when the server answers, without a re-read', async () => {
    const { result } = renderHook(() => useSessionResults('s1'))
    await waitFor(() => expect(state.readCalls).toBe(1))
    act(() => { result.current.save(job()) })
    // The database rewrote raw_score on the way in (enforce_lift_estimate).
    await act(async () => { state.inserts[0]({ data: [{ ...base, id: 'real1', raw_score: 101 }], error: null }) })
    expect(result.current.results).toEqual([{ ...base, id: 'real1', raw_score: 101 }])
    expect(result.current.confirmed.map(r => r.id)).toEqual(['real1'])
    expect(state.readCalls).toBe(1)
  })

  it('takes a failed score back off, says why, and Try again sends it again', async () => {
    const { result } = renderHook(() => useSessionResults('s1'))
    await waitFor(() => expect(state.readCalls).toBe(1))
    act(() => { result.current.save(job()) })
    await act(async () => { state.inserts[0]({ data: null, error: { code: '42501', message: 'rls' } }) })
    expect(result.current.results).toHaveLength(0)
    expect(result.current.failure).toMatchObject({
      what: 'Deadlift 100kg', message: 'That game has finished, so it can no longer be scored.',
    })
    act(() => { result.current.failure!.retry() })
    expect(state.insertCalls).toBe(2)
    expect(result.current.failure).toBeNull()
    expect(result.current.results[0]).toMatchObject({ pending: true })
  })

  it('keeps the score when a poll lands mid-write', async () => {
    const { result } = renderHook(() => useSessionResults('s1'))
    await waitFor(() => expect(state.readCalls).toBe(1))
    act(() => { result.current.save(job()) })
    state.readRows = [{ ...base, id: 'other', player_id: 'p2', score_label: '90kg' }]
    await act(async () => { await result.current.reload() })
    expect(result.current.results.map(r => r.score_label).sort()).toEqual(['100kg', '90kg'])
  })
})
