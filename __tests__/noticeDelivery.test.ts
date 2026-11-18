import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import {
  noticeText, emailTargets, emailText, isGone, pushState, urlBase64ToUint8Array, whenWords, type NoticeInfo,
} from '@/lib/noticeDelivery'

// Saturday 21 Nov 2026, 7am NZDT.
const now = new Date('2026-11-21T07:00:00+13:00')
const n = (over: Partial<NoticeInfo>): NoticeInfo => ({
  id: 'n1', kind: 'message', message: null, game_date: '2026-11-21',
  dow: 6, start_time: '09:00:00', site_name: 'AllSport HQ', ...over,
})

describe('noticeText', () => {
  it('names the game in the title', () => {
    expect(noticeText(n({ kind: 'on' }), now).title).toBe('Saturday 9:00am · AllSport HQ')
  })
  it('does not say cancelled twice with the default rain text', () => {
    const t = noticeText(n({ kind: 'cancelled', message: 'Cancelled because of rain.' }), now)
    expect(t.body).toBe('Cancelled because of rain today.')
    expect(t.subject).toBe('Cancelled: Saturday 9:00am · AllSport HQ')
  })
  it('words a bare or reasoned cancel', () => {
    expect(noticeText(n({ kind: 'cancelled' }), now).body).toBe('No game today.')
    expect(noticeText(n({ kind: 'cancelled', message: 'Field is flooded.' }), now).body).toBe('No game today. Field is flooded.')
  })
  it('says where for a move, and when for a later date', () => {
    expect(noticeText(n({ kind: 'moved', message: 'Jellie Park, by the pavilion' }), now).body)
      .toBe('Today the game is at Jellie Park, by the pavilion.')
    expect(noticeText(n({ kind: 'moved', message: 'Hagley Park', game_date: '2026-11-28' }), now).body)
      .toBe('On Sat 28 Nov the game is at Hagley Park.')
  })
  it('passes a message through and lands on HOME', () => {
    const t = noticeText(n({ message: 'Bring a water bottle.' }), now)
    expect(t.body).toBe('Bring a water bottle.')
    expect(t.url).toBe('/dashboard')
  })
  it('says tomorrow', () => {
    expect(whenWords('2026-11-22', now)).toBe('tomorrow')
  })
})

describe('emailTargets', () => {
  it('emails only accounts no phone took, once each, with an address', () => {
    const accounts = [
      { id: 'a', email: 'a@x.nz' }, { id: 'b', email: 'b@x.nz' },
      { id: 'c', email: null }, { id: 'b', email: 'b@x.nz' },
    ]
    expect(emailTargets(accounts, new Set(['a']))).toEqual([{ id: 'b', email: 'b@x.nz' }])
  })
})

describe('emailText', () => {
  it('says why they got it and how to stop', () => {
    const s = emailText(noticeText(n({ kind: 'on' }), now), 'https://allsport.nz')
    expect(s).toContain('https://allsport.nz/dashboard')
    expect(s).toContain('leave it on HOME')
  })
})

describe('isGone', () => {
  it('drops 404 and 410 only', () => {
    expect([404, 410, 429, 500, undefined].map(isGone)).toEqual([true, true, false, false, false])
  })
})

describe('pushState', () => {
  const base = {
    hasServiceWorker: true, hasPushManager: true, hasNotification: true,
    isIOS: false, standalone: false, permission: 'default' as const, subscribed: false,
  }
  it('asks iPhone Safari to add to Home Screen first', () => {
    expect(pushState({ ...base, isIOS: true, hasPushManager: false })).toBe('ios-install')
    expect(pushState({ ...base, isIOS: true, standalone: true })).toBe('off')
  })
  it('reads support, refusal and on', () => {
    expect(pushState({ ...base, hasPushManager: false })).toBe('unsupported')
    expect(pushState({ ...base, permission: 'denied' })).toBe('denied')
    expect(pushState({ ...base, permission: 'granted', subscribed: false })).toBe('off')
    expect(pushState({ ...base, permission: 'granted', subscribed: true })).toBe('on')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url', () => {
    expect([...urlBase64ToUint8Array('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })
})

describe('phase 2 migration', () => {
  const sql = readFileSync('supabase/migrations/20261118234820_weekly_game_push.sql', 'utf8')
  it('keeps recipients and the send record kaiwhakawā-only', () => {
    expect(sql).toMatch(/FUNCTION public\.notice_recipients[\s\S]*?IF NOT public\.is_judge\(\)/)
    expect(sql).toMatch(/FUNCTION public\.record_notice_sent[\s\S]*?IF NOT public\.is_judge\(\)/)
  })
  it('pins search_path on every definer function and never grants anon', () => {
    const defs = sql.match(/SECURITY DEFINER\s+SET search_path = public/g) ?? []
    expect(defs.length).toBe(3)
    expect(sql).not.toMatch(/GRANT [^;]*TO [^;]*anon/)
  })
  it('lets a player read and delete only their own subscriptions', () => {
    expect(sql).toMatch(/push_subscriptions_own_read[\s\S]*?player_id = auth\.uid\(\)/)
    expect(sql).not.toMatch(/GRANT [^;]*(INSERT|UPDATE)[^;]*push_subscriptions/)
  })
  it('skips players away that date and reaches a child through the parent', () => {
    expect(sql).toMatch(/NOT EXISTS[\s\S]*?weekly_game_absences[\s\S]*?a\.game_date = n\.game_date/)
    expect(sql).toMatch(/coalesce\(p\.parent_id, p\.id\)/)
  })
})

describe('the service worker', () => {
  it('exists and opens the notice url on tap', () => {
    expect(existsSync('public/sw.js')).toBe(true)
    const sw = readFileSync('public/sw.js', 'utf8')
    expect(sw).toMatch(/addEventListener\('push'/)
    expect(sw).toMatch(/addEventListener\('notificationclick'/)
  })
})

describe('the send route', () => {
  const src = readFileSync('app/api/notices/send/route.ts', 'utf8')
  it('verifies the caller and never touches the service key', () => {
    expect(src).toMatch(/auth\.getUser\(\)/)
    expect(src).not.toMatch(/auth\.getSession\(\)/)
    expect(src).not.toMatch(/supabase-admin/)
  })
  it('reads recipients only through the kaiwhakawā-only function', () => {
    expect(src).toMatch(/rpc\('notice_recipients'/)
    expect(src).not.toMatch(/\.from\(/)
  })
})
