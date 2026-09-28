import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publishLeaderboardScores, loadSeasonPoints } from '@/lib/leaderboardData'

// ─── The leaderboard's published numbers ─────────────────────────────────────
// A stub client that records every call and answers per table from `answers`.

type Answer = { data?: unknown; error?: { code?: string; message: string } | null }
type Call = { table: string; op: string; args: unknown[] }

function stub(answers: Record<string, Answer>) {
  const calls: Call[] = []
  const chain = (table: string, op: string, args: unknown[]) => {
    const call: Call = { table, op, args }
    calls.push(call)
    const answer = answers[`${op}:${table}`] ?? { data: [], error: null }
    const q = {
      eq: (...a: unknown[]) => { call.args.push(['eq', ...a]); return q },
      in: (...a: unknown[]) => { call.args.push(['in', ...a]); return q },
      lt: (...a: unknown[]) => { call.args.push(['lt', ...a]); return q },
      then: (resolve: (v: Answer) => void) => resolve({ data: answer.data ?? null, error: answer.error ?? null }),
    }
    return q
  }
  const db = {
    from: (table: string) => ({
      upsert: (...a: unknown[]) => chain(table, 'upsert', a),
      select: (...a: unknown[]) => chain(table, 'select', a),
      delete: () => chain(table, 'delete', []),
    }),
  } as unknown as SupabaseClient
  return { db, calls }
}

const READ_FROM = '2026-09-28T01:00:00.000Z'

const scores = {
  domainRungs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  games: [
    { session_id: 'g1', session_date: '2026-05-02', total: 40 },
    { session_id: 'g2', session_date: '2026-06-01', total: 48 },
  ],
}

describe('publishLeaderboardScores', () => {
  it('writes the domain colours and one row per game', async () => {
    const { db, calls } = stub({})
    expect(await publishLeaderboardScores(db, 'me', scores, READ_FROM)).toEqual({ error: null })
    const games = calls.find(c => c.op === 'upsert' && c.table === 'player_game_colours')!
    expect(games.args[0]).toEqual([
      expect.objectContaining({ player_id: 'me', session_id: 'g1', colour_total: 40 }),
      expect.objectContaining({ player_id: 'me', session_id: 'g2', colour_total: 48 }),
    ])
    expect(calls.find(c => c.op === 'upsert' && c.table === 'player_domain_colours')!.args[0])
      .toMatchObject({ player_id: 'me', domain_rungs: scores.domainRungs })
  })

  it('deletes only the stored games no longer counted, by id, for this player, written before this read', async () => {
    const { db, calls } = stub({ 'select:player_game_colours': { data: [{ session_id: 'g1' }, { session_id: 'gone' }] } })
    await publishLeaderboardScores(db, 'me', scores, READ_FROM)
    const del = calls.find(c => c.op === 'delete')!
    expect(del.table).toBe('player_game_colours')
    // The updated_at guard is what stops an older, overlapping recheck from
    // deleting a total a newer one just wrote.
    expect(del.args).toEqual([['eq', 'player_id', 'me'], ['in', 'session_id', ['gone']], ['lt', 'updated_at', READ_FROM]])
  })

  it('deletes nothing when every stored game is still counted', async () => {
    const { db, calls } = stub({ 'select:player_game_colours': { data: [{ session_id: 'g1' }, { session_id: 'g2' }] } })
    await publishLeaderboardScores(db, 'me', scores, READ_FROM)
    expect(calls.some(c => c.op === 'delete')).toBe(false)
  })

  it('clears every stored game for a player with none left', async () => {
    const { db, calls } = stub({ 'select:player_game_colours': { data: [{ session_id: 'g1' }] } })
    await publishLeaderboardScores(db, 'me', { domainRungs: scores.domainRungs, games: [] }, READ_FROM)
    expect(calls.some(c => c.op === 'upsert' && c.table === 'player_game_colours')).toBe(false)
    expect(calls.find(c => c.op === 'delete')!.args).toContainEqual(['in', 'session_id', ['g1']])
  })

  it('never deletes after a failed write', async () => {
    const { db, calls } = stub({ 'upsert:player_game_colours': { error: { message: 'boom' } } })
    expect(await publishLeaderboardScores(db, 'me', scores, READ_FROM)).toEqual({ error: 'boom' })
    expect(calls.some(c => c.op === 'select' || c.op === 'delete')).toBe(false)
  })

  it('never deletes when the stored games cannot be read', async () => {
    const { db, calls } = stub({ 'select:player_game_colours': { error: { message: 'read failed' } } })
    expect(await publishLeaderboardScores(db, 'me', scores, READ_FROM)).toEqual({ error: 'read failed' })
    expect(calls.some(c => c.op === 'delete')).toBe(false)
  })

  it('reports a failed delete', async () => {
    const { db } = stub({
      'select:player_game_colours': { data: [{ session_id: 'gone' }] },
      'delete:player_game_colours': { error: { message: 'nope' } },
    })
    expect(await publishLeaderboardScores(db, 'me', scores, READ_FROM)).toEqual({ error: 'nope' })
  })
})

describe('loadSeasonPoints', () => {
  const legacy = [{ player_id: 'a', points: 5, games: 1 }]

  it('reads the view', async () => {
    const view = [{ player_id: 'b', points: 199, games: 2 }]
    const { db } = stub({ 'select:season_points': { data: view }, 'select:player_season_points': { data: legacy } })
    expect(await loadSeasonPoints(db, 2026)).toEqual({ rows: view, failed: false })
  })

  it('falls back to the old table only while the view is missing', async () => {
    for (const code of ['PGRST205', '42P01']) {
      const { db } = stub({ 'select:season_points': { error: { code, message: 'missing' } }, 'select:player_season_points': { data: legacy } })
      expect(await loadSeasonPoints(db, 2026)).toEqual({ rows: legacy, failed: false })
    }
  })

  it('reports a failure rather than the old numbers on any other error', async () => {
    const { db } = stub({ 'select:season_points': { error: { code: '42501', message: 'denied' } }, 'select:player_season_points': { data: legacy } })
    expect(await loadSeasonPoints(db, 2026)).toEqual({ rows: [], failed: true })
  })
})
