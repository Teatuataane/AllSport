import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── POST /api/grades/recheck, driven for real ──────────────────────────────
// autoConferral.test.ts pins the route's source text. These call the handler
// with stubbed clients, so each guard is shown to actually return, not merely
// to be written down.

const h = vi.hoisted(() => ({
  user: { id: 'me' } as { id: string } | null,
  rpc: {} as Record<string, { data: unknown; error: unknown }>,
  rpcCalls: [] as string[],
  loadCalls: [] as string[],
  state: { schemaReady: true } as unknown,
  pending: [] as unknown[],
  withdraw: [] as unknown[],
  hasKey: true,
  adminOps: [] as string[],
  adminCreated: 0,
  upsertData: null as unknown,
  upsertError: null as unknown,
  deleteError: null as unknown,
  /** Rows the delete reports removing. Null means "every id asked for". */
  deleteData: null as { id: string }[] | null,
  insertError: null as unknown,
  updateError: null as unknown,
  // Arguments, recorded: an assertion on WHAT was written, not just that
  // something was, is what catches a write aimed at the wrong player.
  upsertArgs: null as { rows: unknown; opts: unknown } | null,
  deleteIds: null as unknown,
  inserts: [] as unknown[],
  updates: [] as { table: string; values: Record<string, unknown>; col: string; val: unknown }[],
  loadTakesMs: 0,
  scoresThrow: false,
  scoreError: null as unknown,
  scoreRows: [] as { table: string; row: unknown }[],
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    rpc: async (name: string) => {
      h.rpcCalls.push(name)
      return h.rpc[name] ?? { data: null, error: { code: 'PGRST202' } }
    },
  }),
}))
vi.mock('@/lib/loadGrades', () => {
  const load = (id: string) => {
    h.loadCalls.push(id)
    // Lets a test make the load take time, so "stamped before" and "stamped
    // after" the read are different instants.
    if (h.loadTakesMs) vi.setSystemTime(Date.now() + h.loadTakesMs)
  }
  return {
    loadGradeState: async (_db: unknown, id: string) => { load(id); return h.state },
    // The conferral path reads inputs once and derives the state from them, so
    // the leaderboard numbers ride on the same read.
    loadGradeInputs: async (_db: unknown, id: string) => { load(id); return h.state && { inputs: true } },
    gradeStateFrom: () => h.state,
    leaderboardScoresFrom: () => {
      if (h.scoresThrow) throw new Error('boom')
      return { domainRungs: [4, 4, 4, 4, 4, 4, 4, 4, 5, 5], points: 88, games: 2 }
    },
  }
})
vi.mock('@/lib/autoConfer', () => ({
  awardsToConfer: () => h.pending,
  awardsToWithdraw: () => h.withdraw,
}))
vi.mock('@/lib/supabase-admin', () => ({
  hasServiceKey: () => h.hasKey,
  createSupabaseAdminClient: () => (h.adminCreated++, {
    from: (table: string) => ({
      upsert: (rows: unknown, opts: unknown) => ({
        // Awaited directly (no select) by the leaderboard-score writes.
        then: (resolve: (v: unknown) => void) => {
          h.adminOps.push(`score:${table}`)
          h.scoreRows.push({ table, row: rows })
          resolve({ error: h.scoreError })
        },
        select: async () => {
          h.adminOps.push(`upsert:${table}`)
          h.upsertArgs = { rows, opts }
          return { data: h.upsertData, error: h.upsertError }
        },
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (col: string, val: unknown) => {
          h.adminOps.push(`update:${table}`)
          h.updates.push({ table, values, col, val })
          return { error: h.updateError }
        },
      }),
      delete: () => ({
        in: (_col: string, ids: string[]) => ({
          select: async () => {
            h.adminOps.push(`delete:${table}`)
            h.deleteIds = ids
            return h.deleteError
              ? { data: null, error: h.deleteError }
              : { data: h.deleteData ?? ids.map(id => ({ id })), error: null }
          },
        }),
      }),
      insert: async (rows: unknown) => {
        h.adminOps.push(`insert:${table}`)
        h.inserts.push(rows)
        return { error: h.insertError }
      },
    }),
  }),
}))

import { POST } from '@/app/api/grades/recheck/route'

const post = (body?: unknown) => POST(new Request('http://x/api/grades/recheck', {
  method: 'POST', body: body === undefined ? undefined : JSON.stringify(body),
}))

const award = (domain: number, rung: number) => ({
  player_id: 'me', domain_number: domain, rung, grade_name: `G${rung}`, events: ['deadlift'], conferred_by: null,
})

beforeEach(() => {
  h.user = { id: 'me' }
  h.rpc = {}
  h.rpcCalls = []
  h.loadCalls = []
  h.scoresThrow = false
  h.scoreError = null
  h.scoreRows = []
  h.state = { schemaReady: true }
  h.pending = []
  h.withdraw = []
  h.hasKey = true
  h.adminOps = []
  h.adminCreated = 0
  h.upsertData = null
  h.upsertError = null
  h.deleteError = null
  h.deleteData = null
  h.insertError = null
  h.updateError = null
  h.upsertArgs = null
  h.deleteIds = null
  h.inserts = []
  h.updates = []
  h.loadTakesMs = 0
  vi.useRealTimers()
})

describe('recheck route: access', () => {
  it('401s with no signed-in user, before reading anything', async () => {
    h.user = null
    const res = await post({})
    expect(res.status).toBe(401)
    expect(h.loadCalls).toEqual([])
  })

  it('403s when the caller cannot act for another player', async () => {
    h.rpc.can_log_for = { data: false, error: null }
    const res = await post({ playerId: 'stranger' })
    expect(res.status).toBe(403)
    expect(h.loadCalls).toEqual([])
  })

  it('treats an empty or unparseable body as "me"', async () => {
    h.rpc.grades_need_recheck = { data: false, error: null }
    const res = await POST(new Request('http://x', { method: 'POST', body: 'not json' }))
    expect(res.status).toBe(200)
    expect(h.rpcCalls).toEqual(['grades_need_recheck'])
  })
})

describe('recheck route: the cheap probe', () => {
  it('returns early, without loading grades, when nothing changed', async () => {
    h.rpc.grades_need_recheck = { data: false, error: null }
    const res = await post({})
    expect(await res.json()).toEqual({ conferred: [], checked: false })
    expect(h.loadCalls).toEqual([])
  })

  it('does the full run when the probe errors (missing function)', async () => {
    const res = await post({})
    expect(res.status).toBe(200)
    expect(h.loadCalls).toEqual(['me'])
  })

  it('skips the probe entirely when forced', async () => {
    h.rpc.grades_need_recheck = { data: false, error: null }
    await post({ force: true })
    expect(h.rpcCalls).not.toContain('grades_need_recheck')
    expect(h.loadCalls).toEqual(['me'])
  })

})

describe('recheck route: writing', () => {
  it('503s with the pending list and writes nothing when there is no service key', async () => {
    h.hasKey = false
    h.pending = [award(1, 1)]
    const res = await post({ force: true })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.writable).toBe(false)
    expect(body.pending).toHaveLength(1)
    expect(h.adminOps).toEqual([])
  })

  it('writes no award when nothing is due, but still moves the watermark', async () => {
    const res = await post({ force: true })
    expect(await res.json()).toEqual({ conferred: [], checked: true, scored: true })
    expect(h.adminOps).toEqual(['score:player_domain_colours', 'score:player_season_points', 'update:players'])
  })

  it('reports only the rows the upsert actually inserted', async () => {
    h.pending = [award(1, 1), award(2, 3)]
    h.upsertData = [{ domain_number: 2, rung: 3 }]
    const body = await (await post({ force: true })).json()
    expect(body.conferred).toEqual([{ domainNumber: 2, rung: 3, name: 'G3', events: 1 }])
    expect(h.adminOps).toEqual(['upsert:grade_awards', 'score:player_domain_colours', 'score:player_season_points', 'update:players'])
  })

  it('500s on a failed write and leaves the watermark where it was', async () => {
    h.pending = [award(1, 1)]
    h.upsertError = { message: 'boom' }
    expect((await post({ force: true })).status).toBe(500)
    expect(h.adminOps).not.toContain('update:players')
  })
})

describe('recheck route: leaderboard numbers', () => {
  it('publishes domain colours and this NZ season\'s points for the player checked', async () => {
    await post({ force: true })
    const domains = h.scoreRows.find(r => r.table === 'player_domain_colours')!.row as Record<string, unknown>
    const season = h.scoreRows.find(r => r.table === 'player_season_points')!.row as Record<string, unknown>
    expect(domains).toMatchObject({ player_id: 'me', domain_rungs: [4, 4, 4, 4, 4, 4, 4, 4, 5, 5] })
    expect(season).toMatchObject({ player_id: 'me', points: 88, games: 2 })
    expect(season.season_year).toBeGreaterThanOrEqual(2026)
  })

  it('never fails the recheck when the numbers cannot be written', async () => {
    h.scoreError = { code: 'PGRST205' }
    const res = await post({ force: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ conferred: [], checked: true, scored: false })
    expect(h.adminOps).toContain('update:players')
  })

  it('never fails the recheck when the scoring itself throws', async () => {
    h.scoresThrow = true
    const res = await post({ force: true })
    expect(res.status).toBe(200)
    expect((await res.json()).scored).toBe(false)
  })

  it('writes nothing for a player the cheap probe says is unchanged', async () => {
    h.rpc.grades_need_recheck = { data: false, error: null }
    await post()
    expect(h.scoreRows).toEqual([])
  })
})

describe('recheck route: withdrawal', () => {
  it('403s for a non-kaiwhakawā, before loading anything', async () => {
    h.rpc.is_judge = { data: false, error: null }
    const res = await post({ withdraw: { domain: 3 } })
    expect(res.status).toBe(403)
    expect(h.loadCalls).toEqual([])
    expect(h.adminOps).toEqual([])
  })

  it('refuses a malformed withdraw rather than quietly running a recheck', async () => {
    // Run as a recheck, it would confer instead of re-judging, and the panel
    // would tell a kaiwhakawā the colours "still stand" when nothing was checked.
    for (const withdraw of [{ domain: 11 }, { domain: '3' }, { domain: 0 }, 'x', null]) {
      h.loadCalls = []
      const res = await post({ withdraw })
      expect(res.status).toBe(400)
      expect(h.loadCalls).toEqual([])
    }
    expect(h.rpcCalls).not.toContain('is_judge')
    expect(h.adminCreated).toBe(0)
  })

  it('reports and logs only what THIS request actually deleted', async () => {
    // Two kaiwhakawā deleting at once: the second must not announce, or log,
    // a colour the first already took back.
    h.rpc.is_judge = { data: true, error: null }
    h.withdraw = [
      { id: 'a1', domain_number: 3, rung: 4, grade_name: 'Kōwhai', conferred_at: 't' },
      { id: 'a2', domain_number: 3, rung: 3, grade_name: 'Karaka', conferred_at: 't' },
    ]
    h.deleteData = [{ id: 'a2' }]
    const body = await (await post({ withdraw: { domain: 3 } })).json()
    expect(body.withdrawn).toEqual([{ domainNumber: 3, rung: 3, name: 'Karaka' }])
    expect((h.inserts[0] as { rung: number }[]).map(r => r.rung)).toEqual([3])
  })

  it('logs nothing when the other request got there first', async () => {
    h.rpc.is_judge = { data: true, error: null }
    h.withdraw = [{ id: 'a1', domain_number: 3, rung: 4, grade_name: 'Kōwhai', conferred_at: 't' }]
    h.deleteData = []
    const body = await (await post({ withdraw: { domain: 3 } })).json()
    expect(body).toEqual({ withdrawn: [], logged: true })
    expect(h.adminOps).not.toContain('insert:grade_withdrawals')
  })

  it('deletes, logs, and reports what was taken back', async () => {
    h.rpc.is_judge = { data: true, error: null }
    h.withdraw = [{ id: 'a1', domain_number: 3, rung: 4, grade_name: 'Kōwhai', conferred_at: 't' }]
    const body = await (await post({ playerId: 'me', withdraw: { domain: 3, reason: 'bad' } })).json()
    expect(body).toEqual({ withdrawn: [{ domainNumber: 3, rung: 4, name: 'Kōwhai' }], logged: true })
    // No watermark: a withdrawal ran no conferral pass, so it has not examined
    // anything in the other nine domains.
    expect(h.adminOps).toEqual(['delete:grade_awards', 'insert:grade_withdrawals'])
  })

  it('says so when the award went but the log did not', async () => {
    h.rpc.is_judge = { data: true, error: null }
    h.withdraw = [{ id: 'a1', domain_number: 3, rung: 4, grade_name: 'Kōwhai', conferred_at: 't' }]
    h.insertError = { code: 'PGRST205' }
    const body = await (await post({ withdraw: { domain: 3 } })).json()
    expect(body.logged).toBe(false)
    expect(body.withdrawn).toHaveLength(1)
  })

})

describe('recheck route: second pass', () => {
  const judged = () => { h.rpc.is_judge = { data: true, error: null } }
  const one = [{ id: 'a1', domain_number: 3, rung: 4, grade_name: 'Kōwhai', conferred_at: 't' }]

  it('404s on a normal recheck when the player cannot be found', async () => {
    h.state = null
    expect((await post({ force: true })).status).toBe(404)
    expect(h.adminOps).toEqual([])
  })

  it('500s when can_log_for errors, and loads and writes nothing', async () => {
    h.rpc.can_log_for = { data: null, error: { code: '500' } }
    expect((await post({ playerId: 'stranger' })).status).toBe(500)
    expect(h.loadCalls).toEqual([])
    expect(h.adminOps).toEqual([])
  })

  it('never asks can_log_for when the caller rechecks themselves', async () => {
    h.rpc.grades_need_recheck = { data: false, error: null }
    await post({ playerId: 'me' })
    expect(h.rpcCalls).not.toContain('can_log_for')
  })

  it('withdraw: 500s when is_judge errors, and loads nothing', async () => {
    h.rpc.is_judge = { data: null, error: { code: '500' } }
    expect((await post({ withdraw: { domain: 3 } })).status).toBe(500)
    expect(h.loadCalls).toEqual([])
  })

  it('withdraw: 404s for a player the loader cannot find', async () => {
    judged()
    h.state = null
    expect((await post({ withdraw: { domain: 3 } })).status).toBe(404)
    expect(h.adminOps).toEqual([])
  })

  it('withdraw: nothing to take back means no admin client and no writes', async () => {
    judged()
    const res = await post({ withdraw: { domain: 3 } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ withdrawn: [] })
    expect(h.adminCreated).toBe(0)
    expect(h.adminOps).toEqual([])
  })

  it('withdraw: 503s with the pending list and deletes nothing when there is no key', async () => {
    judged()
    h.hasKey = false
    h.withdraw = one
    const res = await post({ withdraw: { domain: 3 } })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.writable).toBe(false)
    expect(body.pending).toEqual([{ domainNumber: 3, rung: 4, name: 'Kōwhai' }])
    expect(h.adminOps).toEqual([])
  })

  it('withdraw: a failed delete 500s, never logs and never moves the watermark', async () => {
    judged()
    h.withdraw = one
    h.deleteError = { message: 'boom' }
    expect((await post({ withdraw: { domain: 3 } })).status).toBe(500)
    expect(h.adminOps).toEqual(['delete:grade_awards'])
  })
})

describe('recheck route: what gets written, and to whom', () => {
  it('a parent rechecking a child loads, writes and stamps the CHILD', async () => {
    h.rpc.can_log_for = { data: true, error: null }
    h.pending = [{ ...award(1, 1), player_id: 'child' }]
    h.upsertData = [{ domain_number: 1, rung: 1 }]
    await post({ playerId: 'child', force: true })
    expect(h.loadCalls).toEqual(['child'])
    expect(h.updates).toEqual([expect.objectContaining({ table: 'players', col: 'id', val: 'child' })])
    // ignoreDuplicates is what makes the select return only NEW rows; a merge
    // upsert would return the conflicting ones and announce a colour twice.
    expect(h.upsertArgs!.opts).toEqual({ onConflict: 'player_id,domain_number,rung', ignoreDuplicates: true })
  })

  it('a withdrawal names the kaiwhakawā who caused it and the player who lost it', async () => {
    h.user = { id: 'judge' }
    h.rpc.can_log_for = { data: true, error: null }
    h.rpc.is_judge = { data: true, error: null }
    h.withdraw = [{ id: 'a1', domain_number: 3, rung: 4, grade_name: 'Kōwhai', conferred_at: 't' }]
    await post({ playerId: 'kid', withdraw: { domain: 3, reason: 'bad log' } })
    expect(h.deleteIds).toEqual(['a1'])
    expect(h.inserts[0]).toEqual([expect.objectContaining({ player_id: 'kid', withdrawn_by: 'judge', reason: 'bad log' })])
  })

  it('stamps the watermark with the time the READ began, not when the work ended', async () => {
    // A score written while the engine ran is newer than a start-time stamp,
    // so the next probe still finds it. An end-time stamp would skip it.
    vi.useFakeTimers({ now: new Date('2026-09-22T06:00:00.000Z'), toFake: ['Date'] })
    h.loadTakesMs = 5000
    h.rpc.grades_need_recheck = { data: true, error: null }
    await post({})
    expect(h.updates[0].values.grades_checked_at).toBe('2026-09-22T06:00:00.000Z')
  })

  it('says checked:false when the watermark did not move', async () => {
    h.rpc.grades_need_recheck = { data: true, error: null }
    h.updateError = { message: 'nope' }
    const body = await (await post({})).json()
    expect(body.checked).toBe(false)
  })
})

describe('recheck route: an erased or retired profile', () => {
  it('is never conferred a colour, and nothing is written', async () => {
    // Erasure nulls the date of birth, and a junior with no age grades as U14:
    // a colour easier than U16, with the login and a parent's access intact.
    h.rpc.grades_need_recheck = { data: true, error: null }
    h.state = { schemaReady: true, active: false }
    h.pending = [award(1, 1)]
    const res = await post({})
    expect(await res.json()).toEqual({ conferred: [], inactive: true })
    expect(h.adminCreated).toBe(0)
  })
})

describe('recheck route: never acts on a partial read', () => {
  // A failed results read looks like a player with no scores. On the withdraw
  // path that took back every colour in the domain; on the confer path a failed
  // voids read would confer on voided games, permanently.
  it('confers nothing, and says it failed, when a read was incomplete', async () => {
    h.rpc.grades_need_recheck = { data: true, error: null }
    h.state = { schemaReady: true, complete: false }
    h.pending = [award(1, 1)]
    const res = await post({})
    expect(res.status).toBe(500)          // not 503, which the client reads as "no key"
    expect(h.adminCreated).toBe(0)
  })

  it('withdraws nothing when a read was incomplete', async () => {
    h.rpc.is_judge = { data: true, error: null }
    h.state = { schemaReady: true, complete: false }
    h.withdraw = [{ id: 'a1', domain_number: 3, rung: 4, grade_name: 'Kōwhai', conferred_at: 't' }]
    const res = await post({ withdraw: { domain: 3 } })
    expect(res.status).toBe(500)
    expect(h.adminCreated).toBe(0)
  })

  it('never confers on a guest', async () => {
    h.rpc.grades_need_recheck = { data: true, error: null }
    h.state = { schemaReady: true, guest: true }
    h.pending = [award(1, 1)]
    expect(await (await post({})).json()).toEqual({ conferred: [], guest: true })
    expect(h.adminCreated).toBe(0)
  })
})
