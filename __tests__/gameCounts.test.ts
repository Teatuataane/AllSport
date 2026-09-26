import { describe, it, expect } from 'vitest'
import { loadGameCounts } from '@/lib/gameCounts'
import type { SupabaseClient } from '@supabase/supabase-js'

// A fake client serving `results` in pages, the way PostgREST's max_rows does.
function fakeDb(rows: { player_id: string | null; session_id: string }[], opts: { cap?: number; notGames?: string[]; fail?: 'results' | 'sessions' } = {}) {
  const cap = opts.cap ?? 1000
  const keyed = rows.map((r, i) => ({ ...r, id: `r${String(i).padStart(6, '0')}` }))
  const calls: { from: number; to: number }[] = []
  const db = {
    from(table: string) {
      if (table === 'sessions') {
        return { select: () => ({ or: async () => opts.fail === 'sessions' ? { data: null, error: { code: 'x' } } : { data: (opts.notGames ?? []).map(id => ({ id })), error: null } }) }
      }
      let ids: string[] | null = null
      let after: string | null = null
      const q = {
        select: () => q,
        in: (_c: string, v: string[]) => { ids = v; return q },
        gt: (_c: string, v: string) => { after = v; return q },
        order: () => q,
        limit: async (n: number) => {
          calls.push({ from: 0, to: n })
          if (opts.fail === 'results') return { data: null, error: { code: 'x' } }
          const all = keyed.filter(r => (!ids || ids.includes(r.player_id ?? '')) && (!after || r.id > after))
          return { data: all.slice(0, Math.min(n, cap)), error: null }
        },
      }
      return q
    },
  }
  return { db: db as unknown as SupabaseClient, calls }
}

describe('loadGameCounts', () => {
  it('pages past the 1000-row cap instead of silently undercounting', async () => {
    const rows = Array.from({ length: 1383 }, (_, i) => ({ player_id: 'p', session_id: `s${i % 60}` }))
    const { db, calls } = fakeDb(rows)
    const out = await loadGameCounts(db, null)
    expect(out?.get('p')).toBe(60)
    expect(calls.length).toBe(2)
  })

  it('leaves out the running game and every voided one', async () => {
    const rows = [{ player_id: 'p', session_id: 'a' }, { player_id: 'p', session_id: 'live' }, { player_id: 'p', session_id: 'void' }, { player_id: null, session_id: 'a' }]
    const { db } = fakeDb(rows, { notGames: ['live', 'void'] })
    expect((await loadGameCounts(db, ['p']))?.get('p')).toBe(1)
  })

  it('returns null (unknown), never zero, when results cannot be read', async () => {
    const { db } = fakeDb([{ player_id: 'p', session_id: 'a' }], { fail: 'results' })
    expect(await loadGameCounts(db, ['p'])).toBeNull()
  })

  it('over-counts rather than failing when the sessions read fails', async () => {
    const { db } = fakeDb([{ player_id: 'p', session_id: 'a' }, { player_id: 'p', session_id: 'void' }], { fail: 'sessions', notGames: ['void'] })
    expect((await loadGameCounts(db, ['p']))?.get('p')).toBe(2)
  })

  it('reads nothing for an empty household', async () => {
    const { db, calls } = fakeDb([])
    expect((await loadGameCounts(db, []))?.size).toBe(0)
    expect(calls.length).toBe(0)
  })
})
