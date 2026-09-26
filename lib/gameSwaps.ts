// ─── Added events at an official game ────────────────────────────────────────
// A player who is injured, or simply not interested in today's Deadlift, can
// add other Maximal Strength events on top, from the + on Deadlift's button.
// They count toward colours and training; never toward the placement, because
// the medal table compares the SAME ten events for everyone.
//
// An official event left unplayed is ranked exactly as a missed one: last in
// that event. That is the rule the sport already had, so nothing in the
// placement code changes.
//
// Storage: the added events live in a WORKOUT linked to the game
// (workouts.session_id), so nothing that ranks ever sees them. Code and tables
// still say "swap" (useGameSwaps, the migration), from when a first pick in a
// domain was called one. This module is the pure half: what the screen lists.

import { getEventBySlug, type EventData } from './eventData'
import { EVENTS } from './eventData'
import type { PlayEvent } from '@/components/play/chrome'

/** A session_events row, as the live screen loads one. */
export type OfficialEvent = {
  id: string
  domain_number: number
  domain_name: string
  event_name: string
  event_slug: string
  input_mode: string
}

/**
 * A row on the play list.
 *
 *   official — one of the ten. Scoring it is what places you.
 *   added    — chosen on top, in the same domain. Counts toward colours and
 *              training, never toward the placement.
 *
 * There used to be a third kind, a "swap", for the first event chosen in a
 * domain. Players never needed the difference (Tāne, 26 Sept 2026): an
 * official event not played is ranked last either way, so every choice is
 * simply added.
 */
export type SlotKind = 'official' | 'added'

export type PlaySlot = {
  kind: SlotKind
  se: PlayEvent
}

/** One domain on the play screen: its official event, then what was added. */
export type DomainGroup = {
  domainNumber: number
  domainName: string
  official: PlaySlot | null
  added: PlaySlot[]
}

/** The play-screen shape of a rostered event. An added event's id is its slug. */
export function slotEvent(ev: EventData): PlayEvent {
  return {
    id: ev.slug,
    domain_number: ev.domainNumber,
    domain_name: ev.domain,
    event_name: ev.name,
    event_slug: ev.slug,
    input_mode: ev.inputMode,
  }
}

/** The other events of a domain: what the + on its official event offers. */
export function domainChoices(domainNumber: number, exclude: readonly string[]): EventData[] {
  return EVENTS.filter(e => e.domainNumber === domainNumber && !exclude.includes(e.slug))
}

/**
 * The screen, domain by domain: each official event with whatever the player
 * added in its domain beneath it, in the order they were picked. The order
 * never changes as events are scored, so nothing moves under a player's thumb.
 *
 * A chosen event that IS the official event is dropped — scoring it is what the
 * official row already does, and showing it twice would let a player put the
 * same score in two places. A choice in a domain the game has no event for
 * (never today, since every game draws all ten) gets a group of its own.
 */
export function domainGroups(official: readonly OfficialEvent[], chosen: readonly string[]): DomainGroup[] {
  const officialSlugs = new Set(official.map(o => o.event_slug))
  const groups: DomainGroup[] = official.map(o => ({
    domainNumber: o.domain_number,
    domainName: o.domain_name,
    official: { kind: 'official', se: { ...o } },
    added: [],
  }))
  const seen = new Set<string>()
  for (const slug of chosen) {
    if (seen.has(slug) || officialSlugs.has(slug)) continue
    const ev = getEventBySlug(slug)
    if (!ev) continue
    seen.add(slug)
    let g = groups.find(x => x.domainNumber === ev.domainNumber)
    if (!g) {
      g = { domainNumber: ev.domainNumber, domainName: ev.domain, official: null, added: [] }
      groups.push(g)
    }
    g.added.push({ kind: 'added', se: slotEvent(ev) })
  }
  return groups
}

/** Every row on the screen, in screen order. */
export function playList(official: readonly OfficialEvent[], chosen: readonly string[]): PlaySlot[] {
  return domainGroups(official, chosen).flatMap(g => [...(g.official ? [g.official] : []), ...g.added])
}

/** Add chosen events, once each, keeping the order the player picked them in. */
export function addChoices(chosen: readonly string[], slugs: readonly string[]): string[] {
  const out = [...chosen]
  for (const s of slugs) if (!out.includes(s)) out.push(s)
  return out
}

/**
 * Take a chosen event back off the list. Refused once it has been scored:
 * removing it would leave its entries attached to nothing on screen, and the
 * player can delete the score itself in the sheet.
 */
export function removeChoice(chosen: readonly string[], slug: string, scoredSlugs: ReadonlySet<string>): string[] {
  return scoredSlugs.has(slug) ? [...chosen] : chosen.filter(s => s !== slug)
}

/**
 * How many of the ten domains the player has covered, official or added.
 * The progress bar counts an added event, because it is their workout; the
 * placement banner does not, because an unplayed official event is ranked last.
 */
export function domainsCovered(
  official: readonly OfficialEvent[],
  scoredOfficialIds: ReadonlySet<string>,
  scoredChosenSlugs: ReadonlySet<string>,
): Set<number> {
  const out = new Set<number>()
  for (const o of official) if (scoredOfficialIds.has(o.id)) out.add(o.domain_number)
  for (const slug of scoredChosenSlugs) {
    const ev = getEventBySlug(slug)
    if (ev) out.add(ev.domainNumber)
  }
  return out
}
