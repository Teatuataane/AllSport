import { describe, it, expect } from 'vitest'
import {
  taniwhaAlerts,
  taniwhaWatchlist,
  provisionalWins,
  crownHint,
  winsByDomain,
  type TaniwhaProgress,
} from '@/lib/taniwhaAlerts'
import { crownPoints, WIN_TARGET, guaranteedSessionPoints } from '@/lib/taniwha'
import { domainColor } from '@/lib/domainColours'

// A player whose body is finished and who is building the Speed taniwha.
const speedBuilder = (over: Partial<TaniwhaProgress> = {}): TaniwhaProgress => ({
  taniwha: [
    { taniwha_slug: 'whanau', domain_number: null, body_parts: 9, is_building: false, crowned_at: '2026-07-03T00:00:00Z' },
    { taniwha_slug: 'tere', domain_number: 4, body_parts: 9, is_building: true, crowned_at: null },
  ],
  lifetimePoints: 19_990,
  bankedWinsByDomain: { 4: WIN_TARGET },
  qualifiedReferrals: 1,
  ...over,
})

const input = (progress: TaniwhaProgress, over: any = {}) => ({
  results: [],
  eventIds: [],
  playerIds: ['p1'],
  nameOf: () => 'Meredith',
  divisionOf: () => "Women's",
  effortLevelOf: () => 0,
  progressOf: () => progress,
  ...over,
})

describe('the live crown alert', () => {
  it('says EARNED only when both halves hold at the worst case', () => {
    // 19,990 + the guaranteed 10 clears the second crown at 20,000, and the
    // nine wins are already banked.
    const a = taniwhaAlerts(input(speedBuilder()))
    expect(a).toHaveLength(1)
    expect(a[0].state).toBe('earned')
    expect(a[0].taniwha.name).toBe('Te Taniwha ō te Tere')
    expect(a[0].crownOrdinal).toBe(2)
    expect(a[0].pointsShortfall).toBe(0)
    expect(a[0].winsShortfall).toBe(0)
    expect(crownPoints(2)).toBe(20_000)
    expect(guaranteedSessionPoints(0)).toBe(10)
  })

  it('will not say EARNED on a win that has not been banked yet', () => {
    // Eight banked, one landing today. Another player can still beat that score
    // before the session closes, so this can only ever be "on track".
    const a = taniwhaAlerts(input(
      speedBuilder({ bankedWinsByDomain: { 4: WIN_TARGET - 1 } }),
      { provisionalWinsOf: () => ({ 4: 1 }) },
    ))
    expect(a).toHaveLength(1)
    expect(a[0].state).toBe('on-track')
    expect(a[0].winsShortfall).toBe(1)
  })

  it('says nothing at all when the wins are simply not there', () => {
    expect(taniwhaAlerts(input(speedBuilder({ bankedWinsByDomain: { 4: 3 } })))).toEqual([])
  })

  it('says nothing when the points room is not there', () => {
    // Nine wins banked, but 5,000 points short of the second crown.
    expect(taniwhaAlerts(input(speedBuilder({ lifetimePoints: 15_000 })))).toEqual([])
  })

  it('never alerts on a taniwha whose body is unfinished', () => {
    const p = speedBuilder()
    p.taniwha[1].body_parts = 8
    expect(taniwhaAlerts(input(p))).toEqual([])
  })

  it('never alerts on a taniwha nobody is building', () => {
    const p = speedBuilder()
    p.taniwha[1].is_building = false
    expect(taniwhaAlerts(input(p))).toEqual([])
  })

  it('charges the NEXT crown threshold, not the first', () => {
    // Four already crowned, so this would be the fifth: 50,000, not 20,000.
    const p = speedBuilder({ lifetimePoints: 49_995 })
    p.taniwha = [
      ...Array.from({ length: 4 }, (_, i) => ({
        taniwha_slug: ['whanau', 'kaha', 'hiko', 'ngawari'][i],
        domain_number: i === 0 ? null : [0, 1, 3, 7][i],
        body_parts: 9, is_building: false, crowned_at: '2026-07-03T00:00:00Z',
      })),
      { taniwha_slug: 'tere', domain_number: 4, body_parts: 9, is_building: true, crowned_at: null },
    ]
    const a = taniwhaAlerts(input(p))
    expect(a[0].crownOrdinal).toBe(5)
    expect(a[0].state).toBe('earned')
    expect(crownPoints(5)).toBe(50_000)
  })

  it('treats the whānau referral as banked, because it cannot un-qualify', () => {
    const p = speedBuilder()
    p.taniwha = [{ taniwha_slug: 'whanau', domain_number: null, body_parts: 9, is_building: true, crowned_at: null }]
    p.lifetimePoints = 9_995
    expect(taniwhaAlerts(input(p))[0].state).toBe('earned')

    p.qualifiedReferrals = 0
    expect(taniwhaAlerts(input(p))).toEqual([])
  })

  it('puts earned ahead of on-track', () => {
    const earned = speedBuilder()
    const close = speedBuilder({ bankedWinsByDomain: { 4: WIN_TARGET - 1 } })
    const a = taniwhaAlerts(input(earned, {
      playerIds: ['p1', 'p2'],
      nameOf: (id: string) => (id === 'p1' ? 'Close' : 'Done'),
      progressOf: (id: string) => (id === 'p1' ? close : earned),
      provisionalWinsOf: () => ({ 4: 1 }),
    }))
    expect(a.map(x => x.state)).toEqual(['earned', 'on-track'])
    expect(a[0].playerName).toBe('Done')
  })
})

describe('the standing watchlist', () => {
  const watch = (progress: TaniwhaProgress, over: any = {}) => taniwhaWatchlist({
    players: [{ id: 'p1', name: 'Meredith' }],
    progressOf: () => progress,
    recentPointsOf: () => [150, 150, 150],
    ...over,
  })

  it('names WINS as the blocker when the points are already there', () => {
    const e = watch(speedBuilder({ lifetimePoints: 25_000, bankedWinsByDomain: { 4: 5 } }))
    expect(e).toHaveLength(1)
    expect(e[0].blocker).toBe('wins')
    expect(e[0].winsToGo).toBe(4)
    expect(e[0].pointsToGo).toBe(0)
  })

  it('names POINTS as the blocker when the wins are already there', () => {
    const e = watch(speedBuilder({ lifetimePoints: 19_700 }))
    expect(e[0].blocker).toBe('points')
    expect(e[0].pointsToGo).toBe(300)
    expect(e[0].sessionsAway).toBe(2)
  })

  it('names BODY first, because a crown is not even in question yet', () => {
    const p = speedBuilder()
    p.taniwha[1].body_parts = 8
    const e = watch(p)
    expect(e[0].blocker).toBe('body')
    expect(e[0].partsToGo).toBe(1)
  })

  it('says READY when nothing is left, and never hides it', () => {
    const e = watch(speedBuilder({ lifetimePoints: 20_000 }), { maxSessionsAway: 1 })
    expect(e[0].blocker).toBe('ready')
    expect(e[0].sessionsAway).toBeNull()
  })

  it('hides a distant POINTS blocker but never a wins one', () => {
    // 8,000 points off at 150 a session is 54 sessions — noise for a coach.
    expect(watch(speedBuilder({ lifetimePoints: 12_000 }))).toEqual([])
    // 4 wins off is actionable however long it takes.
    expect(watch(speedBuilder({ lifetimePoints: 25_000, bankedWinsByDomain: { 4: 5 } }))).toHaveLength(1)
  })

  it('orders by what the coach can act on first', () => {
    const people: Record<string, TaniwhaProgress> = {
      body:   (() => { const p = speedBuilder(); p.taniwha[1].body_parts = 8; return p })(),
      wins:   speedBuilder({ lifetimePoints: 25_000, bankedWinsByDomain: { 4: 5 } }),
      points: speedBuilder({ lifetimePoints: 19_700 }),
      ready:  speedBuilder({ lifetimePoints: 20_000 }),
    }
    const e = taniwhaWatchlist({
      players: Object.keys(people).map(k => ({ id: k, name: k })),
      progressOf: (id: string) => people[id],
      recentPointsOf: () => [150, 150, 150],
    })
    expect(e.map(x => x.blocker)).toEqual(['ready', 'points', 'wins', 'body'])
  })

  it('skips anyone with nothing under construction', () => {
    const p = speedBuilder()
    p.taniwha[1].is_building = false
    expect(watch(p)).toEqual([])
  })
})

describe('provisional wins from the live standings', () => {
  const base = {
    domainOfEvent: () => 4,
    divisionOf: () => "Women's",
    alreadyWon: () => false,
  }
  const r = (player_id: string, event_id: string, raw_score: number) => ({ player_id, event_id, raw_score })

  it('counts a clear leader in a field of three', () => {
    const w = provisionalWins({ ...base, results: [r('a','e1',100), r('b','e1',90), r('c','e1',80)] })
    expect(w.get('a')).toEqual({ 4: 1 })
    expect(w.get('b')).toBeUndefined()
  })

  it('refuses a field of two, exactly like the SQL does', () => {
    const w = provisionalWins({ ...base, results: [r('a','e1',100), r('b','e1',90)] })
    expect(w.size).toBe(0)
  })

  it('shares a tie, matching the sport rule', () => {
    const w = provisionalWins({ ...base, results: [r('a','e1',100), r('b','e1',100), r('c','e1',80)] })
    expect(w.get('a')).toEqual({ 4: 1 })
    expect(w.get('b')).toEqual({ 4: 1 })
  })

  it('ignores guests and unscored rows', () => {
    const w = provisionalWins({ ...base, results: [
      { player_id: null, event_id: 'e1', raw_score: 999 },
      { player_id: 'a', event_id: 'e1', raw_score: null },
      r('b','e1',90), r('c','e1',80), r('d','e1',70),
    ] })
    expect(w.get('b')).toEqual({ 4: 1 })   // the guest's 999 does not beat them
  })

  it('does not double-count an event already banked', () => {
    const rows = [r('a','e1',100), r('b','e1',90), r('c','e1',80)]
    expect(provisionalWins({ ...base, results: rows, alreadyWon: () => true }).size).toBe(0)
  })

  it('keeps the pools separate — men do not beat women', () => {
    const w = provisionalWins({
      ...base,
      divisionOf: (id: string) => (id === 'm' ? "Men's" : "Women's"),
      results: [r('m','e1',999), r('a','e1',100), r('b','e1',90), r('c','e1',80)],
    })
    // The women's field is 3 and 'a' leads it; the men's field is 1, too small.
    expect(w.get('a')).toEqual({ 4: 1 })
    expect(w.get('m')).toBeUndefined()
  })

  it('takes each player\'s BEST score for an event, not their last', () => {
    const w = provisionalWins({ ...base, results: [
      r('a','e1',50), r('a','e1',100), r('b','e1',90), r('c','e1',80),
    ] })
    expect(w.get('a')).toEqual({ 4: 1 })
  })
})

describe('the in-session crown hint', () => {
  const p = (over: Partial<TaniwhaProgress> = {}): TaniwhaProgress => ({
    taniwha: [{ taniwha_slug: 'tere', domain_number: 4, body_parts: 9, is_building: true, crowned_at: null }],
    lifetimePoints: 20_000,
    bankedWinsByDomain: { 4: 6 },
    qualifiedReferrals: 0,
    bankedEventNames: new Set(['100m Sprint']),
    ...over,
  })

  it('counts the win they are about to attempt', () => {
    expect(crownHint(p(), 'Beach Flags', 4)).toBe('A win here takes you to 7 of 9')
  })

  it('stays quiet on an event from another domain', () => {
    expect(crownHint(p(), 'Deadlift', 1)).toBeNull()
  })

  it('stays quiet on an event they have already won', () => {
    // A repeat adds nothing: the crown counts DISTINCT events.
    expect(crownHint(p(), '100m Sprint', 4)).toBeNull()
  })

  it('stays quiet once the target is met — the crown waits on points now', () => {
    expect(crownHint(p({ bankedWinsByDomain: { 4: 9 } }), 'Beach Flags', 4)).toBeNull()
  })

  it('stays quiet with nothing under construction, or on whānau', () => {
    const idle = p()
    idle.taniwha[0].is_building = false
    expect(crownHint(idle, 'Beach Flags', 4)).toBeNull()
    expect(crownHint(p({
      taniwha: [{ taniwha_slug: 'whanau', domain_number: null, body_parts: 9, is_building: true, crowned_at: null }],
    }), 'Beach Flags', 4)).toBeNull()
    expect(crownHint(undefined, 'Beach Flags', 4)).toBeNull()
  })

  it('counts from zero when they have never won in the domain', () => {
    expect(crownHint(p({ bankedWinsByDomain: {} }), 'Beach Flags', 4)).toBe('A win here takes you to 1 of 9')
  })
})

describe('wins rolled up per domain', () => {
  it('counts DISTINCT events, not total wins', () => {
    // Three wins on one Speed event is still one event won.
    expect(winsByDomain({ '100m Sprint': 3 })).toEqual({ 4: 1 })
  })

  it('groups across domains through the current roster', () => {
    const w = winsByDomain({ 'Deadlift': 1, '1A Press': 1, '100m Sprint': 2 })
    expect(w).toEqual({ 1: 2, 4: 1 })
  })

  it('ignores events that are not on the roster any more', () => {
    // Removed in the August 2026 roster pass. A stale name must not land on a
    // domain by accident.
    expect(winsByDomain({ 'Reverse Hyper': 1, 'Triple Jump': 1 })).toEqual({})
  })

  it('ignores a zero count', () => {
    expect(winsByDomain({ 'Deadlift': 0 })).toEqual({})
  })

  it('handles an empty input', () => {
    expect(winsByDomain({})).toEqual({})
  })
})

describe('domainColor', () => {
  it('gives all ten domains a distinct colour', () => {
    const all = Array.from({ length: 10 }, (_, i) => domainColor(i + 1))
    expect(new Set(all).size).toBe(10)
  })

  it('wraps rather than returning undefined outside 1..10', () => {
    // The guard exists because callers pass session_events.domain_number,
    // which historical rows can carry out of the current range.
    expect(domainColor(11)).toBe(domainColor(1))
    expect(domainColor(0)).toBe(domainColor(10))
    expect(typeof domainColor(-5)).toBe('string')
  })
})
