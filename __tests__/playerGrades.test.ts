import { describe, it, expect } from 'vitest'
import {
  ladderFor, eventGrade, computePlayerGrades, voidedSessionIds, heldRungs, releasable, shownRung, colourGates,
  type GradePlayer, type GradeResultRow,
} from '@/lib/playerGrades'
import { getEventByName, EVENTS } from '@/lib/eventData'
import { DOMAIN_COUNT, overallGrade } from '@/lib/grading'

const ev = (name: string) => {
  const e = getEventByName(name)
  if (!e) throw new Error(`${name} is not on the roster`)
  return e
}
const openMan: GradePlayer = { division: "Men's", ageYears: 30, gender: 'Male' }
const master: GradePlayer = { division: 'Masters Men', ageYears: 45, gender: 'Male' }
const under14: GradePlayer = { division: 'Juniors', ageYears: 12, gender: 'Female' }
/** 75kg was the middle of the old "70 to 80kg" band, so the numbers below hold. */
const BW = 75
const row = (event_name: string, raw_score: number, extra: Partial<GradeResultRow> = {}): GradeResultRow =>
  ({ event_name, raw_score, weight_kg: null, difficulty_tier: null, ...extra })

describe('which ladder applies', () => {
  it('takes an adult\'s from their division', () => {
    expect(ladderFor({ division: "Women's", gender: null })).toBe('F')
    expect(ladderFor({ division: 'Masters Women', gender: 'Male' })).toBe('F')
    expect(ladderFor({ division: 'Grandmaster Men', gender: null })).toBe('M')
  })
  it('takes a junior\'s from the registration answer, in either case', () => {
    expect(ladderFor({ division: 'Juniors', gender: 'Female' })).toBe('F')
    expect(ladderFor({ division: 'Juniors', gender: 'female' })).toBe('F')
    expect(ladderFor({ division: 'Juniors', gender: 'Male' })).toBe('M')
  })
  it('gives a junior who answered Other the boys\' standards, as Tāne decided', () => {
    expect(ladderFor({ division: 'Juniors', gender: 'Other' })).toBe('M')
  })
})

describe('an event\'s colour', () => {
  it('reproduces the review: one 1-arm push-up is Hiriwa for a Master', () => {
    const g = eventGrade(ev('Pushup Contest'), [row('Pushup Contest', 30001, { difficulty_tier: '1 Arm Pushup' })], master)
    expect(g).toEqual({ slug: ev('Pushup Contest').slug, rung: 9, gradeable: true, played: true })
  })

  it('takes the best row, not the latest', () => {
    const rows = [row('Pushup Contest', 20049), row('Pushup Contest', 20010)]
    expect(eventGrade(ev('Pushup Contest'), rows, openMan).rung).toBe(8)
  })

  it('never counts a Game-rung result as a drill', () => {
    // A win on Jump Rope's Game rung is a far bigger raw_score than any drill.
    const rope = ev('Jump Rope')
    const gameIdx = rope.difficultyTiers!.findIndex(t => t.scoring === 'sport')
    const win = row('Jump Rope', gameIdx * 10000 + 2, { difficulty_tier: 'Game' })
    expect(eventGrade(rope, [win], openMan).rung).toBe(0)
    expect(eventGrade(rope, [win], openMan).played).toBe(true)
  })

  it('lets the rating lift a game event past the drill cap, after ten games', () => {
    const rope = ev('Jump Rope')
    const drills = [row('Jump Rope', 4 * 10000 + 10, { difficulty_tier: 'Single Dutch' })]
    expect(eventGrade(rope, drills, openMan).rung).toBe(6)
    expect(eventGrade(rope, drills, openMan, { rating: 1215, games: 12 }).rung).toBe(8)
    expect(eventGrade(rope, drills, openMan, { rating: 1215, games: 9 }).rung).toBe(6)
  })

  it('grades a lift against the declared bodyweight, and counts it unmet without one', () => {
    const bench = ev('Pause Bench')
    const lift = [row('Pause Bench', 95, { weight_kg: 95, bodyweightKg: BW })]
    expect(eventGrade(bench, lift, openMan).rung).toBe(11) // 1.25x of 75kg is 95kg
    // No declaration: unmet and still in the denominator, NOT removed from it.
    const undeclared = [row('Pause Bench', 95, { weight_kg: 95 })]
    expect(eventGrade(bench, undeclared, master))
      .toMatchObject({ rung: 0, gradeable: true, bodyweightBlocked: true })
  })

  it('grades a junior against their own declaration, on their own ladder, then shifts it', () => {
    const lift = [row('Pause Bench', 15, { weight_kg: 15, bodyweightKg: 50 })]
    // A boy: 15kg is under the men's second rung (17.5kg), so Kiwikiwi, then +2.
    expect(eventGrade(ev('Pause Bench'), lift, { ...under14, gender: 'Male' }).rung).toBe(3)
    // A girl: 15kg meets the women's third rung (0.3 x 50kg), so Karaka, then +2.
    // The review page graded every junior on the men's ladder only because
    // public data carries no sex; the real grade reads the registration answer.
    expect(eventGrade(ev('Pause Bench'), lift, under14).rung).toBe(5)
  })

  it('reads Wrestling from the rating alone', () => {
    const w = ev('Wrestling')
    expect(eventGrade(w, [row('Wrestling', 2)], openMan).rung).toBe(0)
    expect(eventGrade(w, [], openMan, { rating: 1310, games: 10 }).rung).toBe(9)
  })
})

describe('a player\'s grades', () => {
  const none = { results: [], ratings: new Map(), exemptions: new Set<string>() }

  it('grades all ten domains, and withholds the overall until every one holds a colour', () => {
    const g = computePlayerGrades({ player: openMan, ...none })
    expect(g.domains).toHaveLength(DOMAIN_COUNT)
    expect(g.overall.rung).toBeNull()
    expect(g.overall.ungraded).toHaveLength(DOMAIN_COUNT)
  })

  it('KEEPS lifts in the denominator for an adult who has not declared a bodyweight', () => {
    // The loophole this closed: they used to leave it. 12 of Maximal Strength's
    // 14 events are ratio standards, so an undeclared player had the domain
    // judged on 2 events needing 1 — skipping the question was the winning
    // move, and 26 of 27 real players were on that path.
    const inDomain1 = EVENTS.filter(e => e.domainNumber === 1).length
    const lifts = [
      row('Deadlift', 200, { weight_kg: 200 }),
      row('Pause Bench', 150, { weight_kg: 150 }),
    ]
    const strength = computePlayerGrades({ player: master, ...none, results: lifts }).domains[0]
    expect(strength.availableCount).toBe(inDomain1)
    expect(strength.required).toBe(6)
    expect(strength.rung).toBe(0)
    expect(strength.blockedByBodyweight).toBe(true)
  })

  it('does not blame a bodyweight for a domain nobody has played', () => {
    // A brand new player has no lifts, so nothing is blocked — they just have
    // not turned up yet, and the domain must not tell them otherwise.
    const strength = computePlayerGrades({ player: master, ...none }).domains[0]
    expect(strength.blockedByBodyweight).toBe(false)
  })

  it('an undeclared player still gets an overall colour from the other domains', () => {
    // Blocking strength must not delete someone's whole grade: overallGrade
    // returns null while ANY domain is ungraded, so without this a player
    // could be Hiriwa in nine domains and display nothing at all.
    const blocked = { domainNumber: 1, rung: 0, availableCount: 14, required: 6, metAtRung: 0, nextRung: 1, metAtNextRung: 2, blockedByBodyweight: true }
    const rest = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => ({ domainNumber: d, rung: 6, availableCount: 12, required: 6, metAtRung: 6, nextRung: 7, metAtNextRung: 0 }))
    expect(overallGrade([blocked, ...rest]).rung).toBe(6)
    // An ordinary ungraded domain still withholds it.
    expect(overallGrade([{ ...blocked, blockedByBodyweight: false }, ...rest]).rung).toBeNull()
  })

  it('ignores rows from retired events', () => {
    const g = computePlayerGrades({ player: openMan, ...none, results: [row('Walking', 5000)] })
    expect([...g.events.values()].every(e => !e.played)).toBe(true)
  })

  it('removes an exempt event from both sides of the rule', () => {
    const slug = ev('Pause Dips').slug
    const g = computePlayerGrades({ player: openMan, ...none, exemptions: new Set([slug]) })
    expect(g.domains[0].availableCount).toBe(EVENTS.filter(e => e.domainNumber === 1).length - 1)
  })
})

describe('voided sessions', () => {
  it('are closed, stamped, and paid nobody', () => {
    const sessions = [
      { id: 'voided', is_active: false, points_awarded_at: '2026-05-01' },
      { id: 'closed', is_active: false, points_awarded_at: '2026-05-02' },
      { id: 'live', is_active: true, points_awarded_at: null },
      { id: 'closing', is_active: false, points_awarded_at: null },
    ]
    const points = [{ session_id: 'closed', points_earned: 90 }, { session_id: 'voided', points_earned: null }]
    expect([...voidedSessionIds(sessions, points)]).toEqual(['voided'])
  })
})

describe('releasing colours', () => {
  it('offers only domains where the standards give more than has been conferred, one colour at a time', () => {
    const held = heldRungs([{ domain_number: 1, rung: 3 }, { domain_number: 1, rung: 5 }, { domain_number: 2, rung: 2 }])
    expect(held.get(1)).toBe(5)
    const domains = [1, 2, 3].map(d => ({ domainNumber: d, rung: 4, availableCount: 12, required: 6, metAtRung: 6, nextRung: 5, metAtNextRung: 0 }))
    // Plenty of games and units: only the standards decide here.
    const units = new Map([[1, 99], [2, 99], [3, 99]])
    expect(releasable(colourGates(domains, held, 100, units)).map(g => [g.domainNumber, g.releasable])).toEqual([[2, 3], [3, 1]])
  })

  it('never shows a conferred colour going down', () => {
    expect(shownRung(3, 5)).toBe(5)
    expect(shownRung(6, 5)).toBe(6)
    expect(shownRung(2, undefined)).toBe(2)
  })
})
