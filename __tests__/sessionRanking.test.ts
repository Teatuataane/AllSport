// Moved here with divisionRanks, projectedPlacementPoints and
// buildRecentPointsMap when lib/colourAlerts.ts was deleted in v0.6.0.1. These
// helpers were never colour-specific — they rank players across a session's
// events, price a placement, and summarise recent form — so their coverage
// moves with them rather than being lost.

import { describe, it, expect } from 'vitest'
import {
  divisionRanks,
  projectedPlacementPoints,
  buildRecentPointsMap,
  type AlertResultRow,
} from '@/lib/taniwhaAlerts'

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
