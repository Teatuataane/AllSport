// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  encodeSaved, decodeSaved, readPageCache, writePageCache, clearPageCache, MAX_AGE_MS,
} from '@/lib/pageCache'
import { isPageChangeClick, startLoading, isLoading, subscribeLoading } from '@/lib/loadingBar'

describe('saved page copies (lib/pageCache.ts)', () => {
  beforeEach(() => localStorage.clear())

  it('keeps Maps and Sets through a round trip', () => {
    const value = { held: new Map([[1, 4], [2, 7]]), ex: new Set(['a', 'b']), n: 3 }
    const back = decodeSaved<typeof value>(encodeSaved(value))
    expect(back.held).toBeInstanceOf(Map)
    expect([...back.held]).toEqual([[1, 4], [2, 7]])
    expect(back.ex).toBeInstanceOf(Set)
    expect([...back.ex]).toEqual(['a', 'b'])
    expect(back.n).toBe(3)
  })

  it('never writes a bodyweight to the device', () => {
    const text = encodeSaved({ grades: { events: [{ slug: 'deadlift', bodyweightKg: 82.4, rung: 5 }] } })
    expect(text).not.toContain('bodyweightKg')
    expect(text).not.toContain('82.4')
    expect(text).toContain('deadlift')
  })

  it('reads back what was written, only under the same version', () => {
    writePageCache('home-grades:p1', 'v1', { a: 1 })
    expect(readPageCache('home-grades:p1', 'v1')).toEqual({ a: 1 })
    expect(readPageCache('home-grades:p1', 'v2')).toBeNull()
    expect(readPageCache('home-grades:p2', 'v1')).toBeNull()
  })

  it('ignores a copy older than a month', () => {
    const now = Date.now()
    writePageCache('k', 'v', 1, now - MAX_AGE_MS - 1)
    expect(readPageCache('k', 'v', now)).toBeNull()
    writePageCache('k', 'v', 2, now - 1000)
    expect(readPageCache('k', 'v', now)).toBe(2)
  })

  it('treats a damaged copy as none', () => {
    localStorage.setItem('allsport_saved:k', '{not json')
    expect(readPageCache('k', 'v')).toBeNull()
  })

  it('clears every saved copy and nothing else', () => {
    writePageCache('a', 'v', 1)
    writePageCache('b', 'v', 2)
    localStorage.setItem('allsport_active_player_id', 'child')
    clearPageCache()
    expect(readPageCache('a', 'v')).toBeNull()
    expect(readPageCache('b', 'v')).toBeNull()
    expect(localStorage.getItem('allsport_active_player_id')).toBe('child')
  })
})

describe('sign out wipes the saved copies', () => {
  it('both sign out paths clear them', () => {
    expect(readFileSync('components/NavTabs.tsx', 'utf8')).toMatch(/signOut\(\)[\s\S]{0,400}clearPageCache\(\)/)
    expect(readFileSync('app/profile/page.tsx', 'utf8')).toMatch(/forgetSavedPlayer\(\)\s*\n\s*await supabase\.auth\.signOut\(\)/)
  })

  it('a lost session forgets the saved household', () => {
    const src = readFileSync('lib/useActivePlayer.ts', 'utf8')
    expect(src).toMatch(/if \(!hasAuthCookie\(\)\) \{[\s\S]{0,300}if \(memo \|\| hasPageCache\(SAVED_KEY\)\) forgetSavedPlayer\(\)/)
    expect(src).toMatch(/if \(!fresh\) \{[\s\S]{0,120}forgetSavedPlayer\(\)/)
  })
})

describe('the loading bar (lib/loadingBar.ts)', () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }
  const here = { origin: 'https://allsport.nz', pathname: '/dashboard' }
  const link = (href: string, extra: Partial<{ target: string; hasDownload: boolean }> = {}) =>
    ({ href, target: '', hasDownload: false, ...extra })

  it('starts on a plain tap to another page of the site', () => {
    expect(isPageChangeClick(click, link('https://allsport.nz/prs'), here)).toBe(true)
    expect(isPageChangeClick(click, link('/leaderboard'), here)).toBe(true)
  })

  it('does not start for the same page, a query or hash change, another site, or a new tab', () => {
    expect(isPageChangeClick(click, link('/dashboard'), here)).toBe(false)
    expect(isPageChangeClick(click, link('/dashboard?code=AB12'), here)).toBe(false)
    expect(isPageChangeClick(click, link('/dashboard#join'), here)).toBe(false)
    expect(isPageChangeClick(click, link('https://example.com/x'), here)).toBe(false)
    expect(isPageChangeClick(click, link('/prs', { target: '_blank' }), here)).toBe(false)
    expect(isPageChangeClick(click, link('/file.pdf', { hasDownload: true }), here)).toBe(false)
    expect(isPageChangeClick({ ...click, metaKey: true }, link('/prs'), here)).toBe(false)
    expect(isPageChangeClick({ ...click, button: 1 }, link('/prs'), here)).toBe(false)
  })

  it('stays up until the last piece of work is done, and each done counts once', () => {
    const seen: boolean[] = []
    const stop = subscribeLoading(b => seen.push(b))
    const a = startLoading()
    const b = startLoading()
    a(); a()
    expect(isLoading()).toBe(true)
    b()
    expect(isLoading()).toBe(false)
    expect(seen).toEqual([true, false])
    stop()
  })
})
