import { describe, it, expect, vi, afterEach } from 'vitest'

// ─── lib/supabase-admin.ts ───────────────────────────────────────────────────
// The two throws are the only thing between a misconfigured deploy and an
// admin client that silently fails its writes, or a service key in a browser.

const created = vi.hoisted(() => ({ calls: [] as unknown[][] }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => { created.calls.push(args); return { from: () => ({}) } },
}))

import { createSupabaseAdminClient, hasServiceKey, SERVICE_KEY_ENV } from '@/lib/supabase-admin'

const saved = process.env[SERVICE_KEY_ENV]

afterEach(() => {
  if (saved === undefined) delete process.env[SERVICE_KEY_ENV]
  else process.env[SERVICE_KEY_ENV] = saved
  vi.unstubAllGlobals()
  created.calls = []
})

describe('supabase-admin', () => {
  it('throws when the service key is unset, and says it is unset', () => {
    delete process.env[SERVICE_KEY_ENV]
    expect(hasServiceKey()).toBe(false)
    expect(() => createSupabaseAdminClient()).toThrow(/is not set/)
    expect(created.calls).toHaveLength(0)
  })

  it('throws in a browser even with a key set', () => {
    process.env[SERVICE_KEY_ENV] = 'secret'
    vi.stubGlobal('window', {})
    expect(() => createSupabaseAdminClient()).toThrow(/never reach a browser/)
    expect(created.calls).toHaveLength(0)
  })

  it('builds a non-persisting client with the key on a server', () => {
    process.env[SERVICE_KEY_ENV] = 'secret'
    expect(hasServiceKey()).toBe(true)
    expect(() => createSupabaseAdminClient()).not.toThrow()
    expect(created.calls).toHaveLength(1)
    expect(created.calls[0][1]).toBe('secret')
    expect(created.calls[0][2]).toMatchObject({ auth: { persistSession: false, autoRefreshToken: false } })
  })
})
