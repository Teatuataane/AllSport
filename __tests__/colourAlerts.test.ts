import { describe, it, expect } from 'vitest'
import {
  divisionRanks,
  projectedPlacementPoints,
  colourAlerts,
  colourWatchlist,
  applyClaimedRung,
  buildRecentPointsMap,
  type AlertResultRow,
  type ColourAlertInput,
  type WatchlistInput,
} from '@/lib/colourAlerts'

const EVENTS = ['e1', 'e2', 'e3']

function row(player_id: string, event_id: string, raw_score: number): AlertResultRow {
  return { player_id, event_id, raw_score }
}

describe('divisionRanks', () => {
  const mens = () => "Men's"

  it('ranks by lowest total placement across all events', () => {
    const results = [
      row('a', 'e1', 100), row('a', 'e2', 100), row('a', 'e3', 100),
      row('b', 'e1', 50),  row('b', 'e2', 50),  row('b', 'e3', 50),
    ]
    const r = divisionRanks(results, EVENTS, mens)
    expect(r.get('a')!.rank).toBe(1)
    expect(r.get('b')!.rank).toBe(2)
    expect(r.get('a')!.totalPlacement).toBe(3) // 1st in all three
    expect(r.get('b')!.totalPlacement).toBe(6)
  })

  it('counts a missed event as one worse than the whole field', () => {
    const results = [
      row('a', 'e1', 100), row('a', 'e2', 100), row('a', 'e3', 100),
      row('b', 'e1', 50),  row('b', 'e2', 50),  // no e3
    ]
    const r = divisionRanks(results, EVENTS, mens)
    // b: 2nd + 2nd + (1 scorer in e3, so 2) = 6
    expect(r.get('b')!.totalPlacement).toBe(6)
  })

  it('takes a player’s BEST score when they submitted more than once', () => {
    const results = [
      row('a', 'e1', 10), row('a', 'e1', 90),
      row('b', 'e1', 50),
    ]
    const r = divisionRanks(results, ['e1'], mens)
    expect(r.get('a')!.rank).toBe(1)
  })

  it('shares a rank on a tie', () => {
    const results = [
      row('a', 'e1', 100), row('b', 'e1', 100), row('c', 'e1', 10),
    ]
    const r = divisionRanks(results, ['e1'], mens)
    expect(r.get('a')!.rank).toBe(1)
    expect(r.get('b')!.rank).toBe(1)
    expect(r.get('c')!.rank).toBe(3)
  })

  it('ranks each division separately', () => {
    const divisionOf = (p: string) => (p === 'w' ? "Women's" : "Men's")
    const results = [row('a', 'e1', 100), row('w', 'e1', 5)]
    const r = divisionRanks(results, ['e1'], divisionOf)
    expect(r.get('a')!.rank).toBe(1)
    expect(r.get('w')!.rank).toBe(1) // top of her own division, not 2nd overall
    expect(r.get('w')!.playerCount).toBe(1)
  })

  it('ignores guests and players with no division', () => {
    const results = [{ player_id: null, event_id: 'e1', raw_score: 100 }, row('a', 'e1', 5)]
    const r = divisionRanks(results, ['e1'], () => "Men's")
    expect(r.size).toBe(1)
  })
})

describe('projectedPlacementPoints', () => {
  it('matches the award formula, with no floor on the gap', () => {
    expect(projectedPlacementPoints(1, 5)).toBe(100)
    expect(projectedPlacementPoints(3, 5)).toBe(60)
    expect(projectedPlacementPoints(10, 20)).toBe(55)
  })
  it('floors the award at 10', () => {
    expect(projectedPlacementPoints(20, 20)).toBe(10)
  })
})

// ── colourAlerts ─────────────────────────────────────────────────────────────

function input(over: Partial<ColourAlertInput> = {}): ColourAlertInput {
  return {
    results: [row('a', 'e1', 100)],
    eventIds: ['e1'],
    playerIds: ['a'],
    nameOf: () => 'Meredith',
    divisionOf: () => "Women's",
    effortLevelOf: () => 0,
    totalsOf: () => ({ lifetime_points: 0, highest_rung: 1 }),
    ...over,
  }
}

describe('colourAlerts', () => {
  it('says nothing when the next colour is far away', () => {
    expect(colourAlerts(input({ totalsOf: () => ({ lifetime_points: 100, highest_rung: 1 }) }))).toEqual([])
  })

  it('fires "earned" only when the guaranteed floor clears the threshold', () => {
    // 940 lifetime, Whero at 1,000. Effort 6 guarantees 10 + 30 = 40. Not safe.
    const near = input({
      totalsOf: () => ({ lifetime_points: 940, highest_rung: 2 }),
      effortLevelOf: () => 6,
    })
    expect(colourAlerts(near)[0].state).toBe('on-track')

    // Effort 12 guarantees 10 + 60 = 70. Safe whatever the placement does.
    const safe = input({
      totalsOf: () => ({ lifetime_points: 940, highest_rung: 2 }),
      effortLevelOf: () => 12,
    })
    expect(colourAlerts(safe)[0].state).toBe('earned')
    expect(colourAlerts(safe)[0].colour.name).toBe('Whero')
    expect(colourAlerts(safe)[0].shortfall).toBe(0)
  })

  it('an "on-track" alert cannot be wrong about the colour, only the timing', () => {
    const alerts = colourAlerts(input({
      totalsOf: () => ({ lifetime_points: 940, highest_rung: 2 }),
      effortLevelOf: () => 6,
    }))
    // Solo in her division so she projects 100 placement + 30 effort = 130,
    // which clears it — but only 40 is guaranteed, so it stays "on-track".
    expect(alerts[0].projected).toBe(130)
    expect(alerts[0].guaranteed).toBe(40)
    expect(alerts[0].shortfall).toBe(20)
  })

  it('targets the rung above the highest AWARDED one, not the points', () => {
    // Judge already claimed Whero mid-session; points have not caught up.
    const alerts = colourAlerts(input({
      totalsOf: () => ({ lifetime_points: 940, highest_rung: 3 }),
      effortLevelOf: () => 20,
    }))
    // Next target is Karaka (2,000), which 940 + 110 does not reach.
    expect(alerts).toEqual([])
  })

  it('says nothing for a player who already holds Ngā Taniwha', () => {
    expect(colourAlerts(input({
      totalsOf: () => ({ lifetime_points: 100_000, highest_rung: 19 }),
      effortLevelOf: () => 20,
    }))).toEqual([])
  })

  it('treats a player with no player_totals row as Mā on zero', () => {
    const alerts = colourAlerts(input({
      totalsOf: () => undefined,
      effortLevelOf: () => 20, // guarantees 110, clears Kiwikiwi? no — 500
    }))
    expect(alerts).toEqual([])
  })

  it('orders earned before on-track, then by who is closest', () => {
    const alerts = colourAlerts(input({
      results: [row('a', 'e1', 100), row('b', 'e1', 80), row('c', 'e1', 60)],
      playerIds: ['a', 'b', 'c'],
      nameOf: (p) => p.toUpperCase(),
      effortLevelOf: () => 10, // guarantees 60
      totalsOf: (p) => ({
        a: { lifetime_points: 900, highest_rung: 2 },  // on-track, short by 40
        b: { lifetime_points: 960, highest_rung: 2 },  // earned
        c: { lifetime_points: 930, highest_rung: 2 },  // on-track, short by 10
      }[p]),
    }))
    expect(alerts.map(a => `${a.playerName}:${a.state}`)).toEqual([
      'B:earned', 'C:on-track', 'A:on-track',
    ])
  })
})

// ── colourWatchlist ──────────────────────────────────────────────────────────

function watchInput(over: Partial<WatchlistInput> = {}): WatchlistInput {
  return {
    players: [{ id: 'a', name: 'Meredith' }],
    totalsOf: () => ({ lifetime_points: 800, highest_rung: 2 }),
    recentPointsOf: () => [150, 150, 150],
    ...over,
  }
}

describe('colourWatchlist', () => {
  it('measures the gap in sessions, using recent form', () => {
    // 200 points from Whero, averaging 150/session → 2 sessions.
    const [entry] = colourWatchlist(watchInput())
    expect(entry.colour.name).toBe('Whero')
    expect(entry.pointsToGo).toBe(200)
    expect(entry.avgPointsPerSession).toBe(150)
    expect(entry.sessionsAway).toBe(2)
  })

  it('hides players further out than the limit', () => {
    // 500 to go at 100/session = 5 sessions.
    const far = watchInput({
      totalsOf: () => ({ lifetime_points: 500, highest_rung: 2 }),
      recentPointsOf: () => [100],
    })
    expect(colourWatchlist(far)).toEqual([])
    expect(colourWatchlist({ ...far, maxSessionsAway: 5 })).toHaveLength(1)
  })

  it('only averages the last 10 sessions, so old form does not drag', () => {
    const recent = Array(10).fill(150)
    const ancient = Array(20).fill(1)
    const [entry] = colourWatchlist(watchInput({ recentPointsOf: () => [...recent, ...ancient] }))
    expect(entry.avgPointsPerSession).toBe(150)
  })

  it('skips a player with no finished sessions to extrapolate from', () => {
    expect(colourWatchlist(watchInput({ recentPointsOf: () => [] }))).toEqual([])
  })

  it('skips a player who already holds Ngā Taniwha', () => {
    expect(colourWatchlist(watchInput({
      totalsOf: () => ({ lifetime_points: 100_000, highest_rung: 19 }),
    }))).toEqual([])
  })

  it('targets the rung above the highest awarded, not the points', () => {
    // Whero already claimed mid-session; points have not caught up.
    const [entry] = colourWatchlist(watchInput({
      totalsOf: () => ({ lifetime_points: 980, highest_rung: 3 }),
      recentPointsOf: () => [400],
      maxSessionsAway: 5,
    }))
    expect(entry.colour.name).toBe('Karaka')
    expect(entry.pointsToGo).toBe(1020)
  })

  it('always targets a rung strictly ahead, so sessionsAway is never 0', () => {
    // Degenerate state: points are past Whero but only Kiwikiwi was awarded
    // (a trigger failure would do this). The target skips to Karaka rather
    // than reporting a colour already banked, and stays a positive distance.
    const entries = colourWatchlist(watchInput({
      totalsOf: () => ({ lifetime_points: 1200, highest_rung: 2 }),
      recentPointsOf: () => [400],
      maxSessionsAway: 5,
    }))
    expect(entries[0].colour.name).toBe('Karaka')
    expect(entries[0].pointsToGo).toBe(800)
    expect(entries[0].sessionsAway).toBe(2)
    expect(entries.every(e => e.pointsToGo > 0 && e.sessionsAway >= 1)).toBe(true)
  })

  it('orders by soonest, then by smallest gap', () => {
    const list = colourWatchlist(watchInput({
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      totalsOf: p => ({
        a: { lifetime_points: 700, highest_rung: 2 },  // 300 to go
        b: { lifetime_points: 900, highest_rung: 2 },  // 100 to go
        c: { lifetime_points: 800, highest_rung: 2 },  // 200 to go
      }[p]),
      recentPointsOf: () => [200],
    }))
    // b: 1 session. c: 1 session. a: 2 sessions.
    expect(list.map(e => e.playerName)).toEqual(['B', 'C', 'A'])
  })
})

// ── applyClaimedRung ─────────────────────────────────────────────────────────

describe('applyClaimedRung', () => {
  it('bumps the awarded rung but NOT the points', () => {
    // The RPC awards the colour immediately; lifetime_points genuinely does not
    // move until the session closes. Bumping it here would be a lie.
    const next = applyClaimedRung({ p1: { lifetime_points: 940, highest_rung: 2 } }, 'p1', 3, 940)
    expect(next.p1).toEqual({ lifetime_points: 940, highest_rung: 3 })
  })

  it('seeds a player with no prior totals row', () => {
    expect(applyClaimedRung({}, 'p1', 3, 940).p1).toEqual({ lifetime_points: 940, highest_rung: 3 })
  })

  it('never lowers a held rung (a stale render must not demote)', () => {
    const next = applyClaimedRung({ p1: { lifetime_points: 9_000, highest_rung: 9 } }, 'p1', 3, 0)
    expect(next.p1.highest_rung).toBe(9)
  })

  it('leaves other players untouched', () => {
    const prev = {
      p1: { lifetime_points: 940, highest_rung: 2 },
      p2: { lifetime_points: 100, highest_rung: 1 },
    }
    const next = applyClaimedRung(prev, 'p1', 3, 940)
    expect(next.p2).toBe(prev.p2)
    expect(next).not.toBe(prev)
  })

  it('retires the alert: the next target moves past the claimed rung', () => {
    const next = applyClaimedRung({}, 'p1', 3, 940)
    const alerts = colourAlerts(input({
      totalsOf: () => next.p1,
      effortLevelOf: () => 20,
    }))
    expect(alerts).toEqual([])
  })
})

// ── buildRecentPointsMap ─────────────────────────────────────────────────────

describe('buildRecentPointsMap', () => {
  it('sums placement and effort per session, grouped by player', () => {
    const map = buildRecentPointsMap([
      { player_id: 'a', total_placement_points: 100, effort_points: 50 },
      { player_id: 'a', total_placement_points: 80, effort_points: 40 },
      { player_id: 'b', total_placement_points: 60, effort_points: 30 },
    ])
    expect(map).toEqual({ a: [150, 120], b: [90] })
  })

  it('preserves query order — the watchlist averages the most recent N', () => {
    const map = buildRecentPointsMap([
      { player_id: 'a', total_placement_points: 200, effort_points: 0 },
      { player_id: 'a', total_placement_points: 10, effort_points: 0 },
    ])
    expect(map.a).toEqual([200, 10])
  })

  it('treats null point columns as zero rather than NaN', () => {
    const map = buildRecentPointsMap([
      { player_id: 'a', total_placement_points: null, effort_points: 40 },
      { player_id: 'a', total_placement_points: 60, effort_points: null },
    ])
    expect(map.a).toEqual([40, 60])
  })

  it('returns an empty map for no rows', () => {
    expect(buildRecentPointsMap([])).toEqual({})
  })
})
