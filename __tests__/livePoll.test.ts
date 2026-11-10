// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { isLiveSession, pollWhileVisible } from '@/lib/livePoll'

// Second Disk IO warning (11 Nov 2026): see lib/livePoll.ts.

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => { vi.useRealTimers(); setVisibility('visible') })

describe('isLiveSession', () => {
  const start = '2026-11-11T03:30:00Z'
  const t = (mins: number) => new Date(start).getTime() + mins * 60_000

  it('an open game inside its 100 minutes is live', () => {
    expect(isLiveSession({ is_active: true, started_at: start }, t(99))).toBe(true)
  })
  it('a game past 100 minutes is over before pg_cron closes it', () => {
    expect(isLiveSession({ is_active: true, started_at: start }, t(100))).toBe(false)
  })
  it('an open game not yet started is live', () => {
    expect(isLiveSession({ is_active: true, started_at: null }, t(500))).toBe(true)
  })
  it('no row, or a closed one, is not live', () => {
    expect(isLiveSession(null)).toBe(false)
    expect(isLiveSession({ is_active: false, started_at: null })).toBe(false)
  })
})

describe('pollWhileVisible', () => {
  it('checks at once, then on the interval while visible', () => {
    vi.useFakeTimers()
    const check = vi.fn()
    const stop = pollWhileVisible(check, 60_000)
    expect(check).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(120_000)
    expect(check).toHaveBeenCalledTimes(3)
    stop()
  })

  it('a hidden tab makes no requests, and catches up when shown', () => {
    vi.useFakeTimers()
    const check = vi.fn()
    const stop = pollWhileVisible(check, 60_000)
    setVisibility('hidden')
    vi.advanceTimersByTime(60 * 60_000)
    expect(check).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    expect(check).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(60_000)
    expect(check).toHaveBeenCalledTimes(3)
    stop()
    vi.advanceTimersByTime(10 * 60_000)
    setVisibility('hidden'); setVisibility('visible')
    expect(check).toHaveBeenCalledTimes(3)
  })
})

describe('background checks stay cheap', () => {
  // These run on every page (the navbar) and on HOME. pg_cron closes expired
  // games every 5 minutes; calling the RPC from them was a write per poll.
  it.each(['lib/useNavState.ts', 'app/dashboard/page.tsx'])('%s does not call close_expired_sessions', f => {
    expect(readFileSync(f, 'utf8')).not.toMatch(/rpc\('close_expired_sessions'\)/)
  })
  it.each(['lib/useNavState.ts', 'app/dashboard/page.tsx'])('%s polls only while visible', f => {
    const src = readFileSync(f, 'utf8')
    expect(src).toMatch(/pollWhileVisible\(/)
    expect(src).not.toMatch(/setInterval\(/)
  })
})
