import { describe, it, expect } from 'vitest'
import {
  buildJudgeRoster, resolveJudgeTarget, resultsForTarget, scoredEventIds,
  scoredEventIdsByTarget, rosterKeyFor, NO_SCORES,
  type RosterResult, type RosterPlayer,
} from '@/lib/judgeRoster'

const r = (player_id: string | null, player_name: string, event_id: string): RosterResult =>
  ({ player_id, player_name, event_id })

// Two registered players and one guest, each with results across a 3-event session.
const players: RosterPlayer[] = [
  { id: 'p1', name: 'kiwigyver' },
  { id: 'p2', name: 'Meredith' },
  { id: 'p3', name: 'Blair' },       // registered but has no results this session
]

const results: RosterResult[] = [
  r('p2', 'Meredith', 'e1'),
  r('p1', 'kiwigyver', 'e1'),
  r('p1', 'kiwigyver', 'e2'),        // second result for p1 — must not duplicate the chip
  r(null, 'Sione', 'e1'),
  r(null, 'Sione', 'e3'),            // second guest row — must not duplicate either
]

describe('buildJudgeRoster', () => {
  it('lists only players with results in this session', () => {
    const roster = buildJudgeRoster(results, players)
    expect(roster.registered.map(p => p.id)).toEqual(['p1', 'p2'])
    expect(roster.registeredIds.has('p3')).toBe(false)
  })

  it('de-duplicates a player who scored several events', () => {
    const roster = buildJudgeRoster(results, players)
    expect(roster.registered.filter(p => p.id === 'p1')).toHaveLength(1)
    expect(roster.guests.filter(g => g.name === 'Sione')).toHaveLength(1)
  })

  it('sorts registered players and guests by name', () => {
    const roster = buildJudgeRoster(
      [r('p2', 'Meredith', 'e1'), r('p1', 'kiwigyver', 'e1'), r(null, 'Zara', 'e1'), r(null, 'Anaru', 'e1')],
      players,
    )
    expect(roster.registered.map(p => p.name)).toEqual(['kiwigyver', 'Meredith'])
    expect(roster.guests.map(g => g.name)).toEqual(['Anaru', 'Zara'])
  })

  it('separates guests from registered players', () => {
    const roster = buildJudgeRoster(results, players)
    expect(roster.guests).toEqual([{ key: 'guest:Sione', name: 'Sione' }])
    expect(roster.guestNames.has('Sione')).toBe(true)
  })

  it('falls back to the name on the result row when the player list has not loaded', () => {
    const roster = buildJudgeRoster([r('p9', 'Late Loader', 'e1')], [])
    expect(roster.registered[0].name).toBe('Late Loader')
  })

  it("falls back to 'Unknown' rather than rendering a blank chip", () => {
    const roster = buildJudgeRoster([r('p9', '', 'e1')], [])
    expect(roster.registered[0].name).toBe('Unknown')
  })

  it('ignores rows with neither an id nor a name', () => {
    const roster = buildJudgeRoster([r(null, '', 'e1')], players)
    expect(roster.registered).toHaveLength(0)
    expect(roster.guests).toHaveLength(0)
  })

  it('ignores a whitespace-only guest name rather than making a blank chip', () => {
    expect(buildJudgeRoster([r(null, '   ', 'e1')], players).guests).toHaveLength(0)
  })

  it('returns empty lists before anyone has scored', () => {
    const roster = buildJudgeRoster([], players)
    expect(roster.registered).toEqual([])
    expect(roster.guests).toEqual([])
  })
})

describe('resolveJudgeTarget', () => {
  it('returns null when nothing is selected — this is what shows the roster', () => {
    expect(resolveJudgeTarget('', '', players, results)).toBeNull()
  })

  it('treats a whitespace-only guest name as no selection', () => {
    expect(resolveJudgeTarget('', '   ', players, results)).toBeNull()
  })

  it('resolves a registered player from the loaded player list', () => {
    expect(resolveJudgeTarget('p1', '', players, results))
      .toEqual({ id: 'p1', name: 'kiwigyver', isGuest: false })
  })

  it('falls back to the result row name when the player list lacks the id', () => {
    expect(resolveJudgeTarget('p1', '', [], results))
      .toEqual({ id: 'p1', name: 'kiwigyver', isGuest: false })
  })

  it("falls back to 'Unknown' when neither source has the id", () => {
    expect(resolveJudgeTarget('ghost', '', [], []))
      .toEqual({ id: 'ghost', name: 'Unknown', isGuest: false })
  })

  it('resolves a guest and trims the typed name', () => {
    expect(resolveJudgeTarget('', '  Sione  ', players, results))
      .toEqual({ id: null, name: 'Sione', isGuest: true })
  })

  it('prefers a selected registered player over a lingering guest name', () => {
    const target = resolveJudgeTarget('p1', 'Sione', players, results)
    expect(target).toEqual({ id: 'p1', name: 'kiwigyver', isGuest: false })
  })
})

describe('resultsForTarget', () => {
  it('matches a registered player on id', () => {
    const rows = resultsForTarget(results, { id: 'p1', name: 'kiwigyver', isGuest: false })
    expect(rows.map(x => x.event_id)).toEqual(['e1', 'e2'])
  })

  it('matches a guest on name', () => {
    const rows = resultsForTarget(results, { id: null, name: 'Sione', isGuest: true })
    expect(rows.map(x => x.event_id)).toEqual(['e1', 'e3'])
  })

  it("never picks up a registered player's rows for a guest of the same name", () => {
    const shared: RosterResult[] = [r('p1', 'Sam', 'e1'), r(null, 'Sam', 'e2')]
    expect(resultsForTarget(shared, { id: null, name: 'Sam', isGuest: true }).map(x => x.event_id))
      .toEqual(['e2'])
    expect(resultsForTarget(shared, { id: 'p1', name: 'Sam', isGuest: false }).map(x => x.event_id))
      .toEqual(['e1'])
  })

  it('returns nothing for a player who has not scored', () => {
    expect(resultsForTarget(results, { id: 'p3', name: 'Blair', isGuest: false })).toEqual([])
  })
})

describe('scoredEventIds', () => {
  it('reports only session events the target has scored', () => {
    const rows = resultsForTarget(results, { id: 'p1', name: 'kiwigyver', isGuest: false })
    const scored = scoredEventIds(rows, ['e1', 'e2', 'e3'])
    expect([...scored].sort()).toEqual(['e1', 'e2'])
    expect(scored.has('e3')).toBe(false)
  })

  it('ignores results for events not in this session', () => {
    expect([...scoredEventIds([r('p1', 'kiwigyver', 'other')], ['e1'])]).toEqual([])
  })

  it('is empty for a player with no results', () => {
    expect([...scoredEventIds([], ['e1', 'e2'])]).toEqual([])
  })
})

describe('rosterKeyFor', () => {
  it('keys a registered player by id and a guest by name', () => {
    expect(rosterKeyFor(r('p1', 'kiwigyver', 'e1'))).toBe('p1')
    expect(rosterKeyFor(r(null, 'Sione', 'e1'))).toBe('guest:Sione')
  })

  it('matches the keys buildJudgeRoster puts on its entries', () => {
    const roster = buildJudgeRoster(results, players)
    expect(roster.registered.map(p => p.key)).toContain(rosterKeyFor(r('p1', 'kiwigyver', 'e1')))
    expect(roster.guests.map(g => g.key)).toContain(rosterKeyFor(r(null, 'Sione', 'e1')))
  })
})

describe('scoredEventIdsByTarget', () => {
  const byTarget = scoredEventIdsByTarget(results, ['e1', 'e2', 'e3'])

  it('agrees with the per-target computation for every roster entry', () => {
    const eventIds = ['e1', 'e2', 'e3']
    for (const p of buildJudgeRoster(results, players).registered) {
      const expected = scoredEventIds(
        resultsForTarget(results, { id: p.id, name: p.name, isGuest: false }), eventIds,
      )
      expect([...(byTarget.get(p.key) ?? NO_SCORES)].sort()).toEqual([...expected].sort())
    }
    for (const g of buildJudgeRoster(results, players).guests) {
      const expected = scoredEventIds(
        resultsForTarget(results, { id: null, name: g.name, isGuest: true }), eventIds,
      )
      expect([...(byTarget.get(g.key) ?? NO_SCORES)].sort()).toEqual([...expected].sort())
    }
  })

  it('keeps guests separate from registered players', () => {
    expect([...(byTarget.get('p1') ?? [])].sort()).toEqual(['e1', 'e2'])
    expect([...(byTarget.get('guest:Sione') ?? [])].sort()).toEqual(['e1', 'e3'])
  })

  it('omits players with no results rather than storing empty sets', () => {
    expect(byTarget.has('p3')).toBe(false)
    expect(byTarget.get('p3') ?? NO_SCORES).toBe(NO_SCORES)
  })

  it('ignores results for events outside this session', () => {
    const m = scoredEventIdsByTarget([r('p1', 'kiwigyver', 'gone')], ['e1'])
    expect(m.size).toBe(0)
  })

  it('returns an empty map before anyone has scored', () => {
    expect(scoredEventIdsByTarget([], ['e1']).size).toBe(0)
  })
})
