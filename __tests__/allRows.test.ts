import { describe, it, expect } from 'vitest'
import { allRows, PAGE } from '@/lib/allRows'

// A fake PostgREST: `total` rows, at most PAGE per request, optionally failing
// on one page.
function fake(total: number, failAt?: number) {
  const calls: [number, number][] = []
  const q = async (from: number, to: number) => {
    calls.push([from, to])
    if (failAt === from) return { data: null, error: { message: 'boom' } }
    const end = Math.min(total, to + 1, from + PAGE)
    return { data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i), error: null }
  }
  return { q, calls }
}

describe('allRows', () => {
  it('reads past the 1000-row cap', async () => {
    const { q, calls } = fake(2500)
    const { rows, error } = await allRows<number>(q)
    expect(error).toBeNull()
    expect(rows).toHaveLength(2500)
    expect(rows[2499]).toBe(2499)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('asks once more when the total is an exact multiple of a page', async () => {
    const { q, calls } = fake(PAGE)
    const { rows } = await allRows<number>(q)
    expect(rows).toHaveLength(PAGE)
    expect(calls).toHaveLength(2)
  })

  it('returns the rows so far with the error of a failed page', async () => {
    const { q } = fake(2500, 1000)
    const { rows, error } = await allRows<number>(q)
    expect(error?.message).toBe('boom')
    expect(rows).toHaveLength(PAGE)
  })
})
