// ─── Swaps and extras at an official game ────────────────────────────────────
// A player who is injured, or simply not interested in today's Deadlift, can
// swap it for another Maximal Strength event, or add extra events on top. Both
// count toward their colours and their training; neither counts toward the
// placement, because the medal table compares the SAME ten events for everyone.
//
// A swapped event is ranked exactly as a missed one: last in that event. That
// is the rule the sport already had, so nothing in the placement code changes.
//
// Storage: the swapped and extra events live in a WORKOUT linked to the game
// (workouts.session_id), so nothing that ranks ever sees them. This module is
// the pure half — what the play list looks like once a player has swapped.

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
 *   swap     — chosen instead of the official event in that domain.
 *   extra    — chosen on top, in a domain that already has its event covered.
 *
 * A swap and an extra are the same thing to the database; the difference is
 * what the screen says, and a swap is what the player reaches for when they
 * cannot do the official event.
 */
export type SlotKind = 'official' | 'swap' | 'extra'

export type PlaySlot = {
  kind: SlotKind
  se: PlayEvent
  /** For a swap: the official event it stands in for. */
  replaces?: OfficialEvent
}

/** The play-screen shape of a rostered event. A swap's id is its slug. */
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

/** The other events of a domain — what a swap can choose from (decision 4). */
export function swapChoices(domainNumber: number, exclude: readonly string[]): EventData[] {
  return EVENTS.filter(e => e.domainNumber === domainNumber && !exclude.includes(e.slug))
}

/**
 * The list a player sees: the ten official events, each followed by whatever
 * they chose in its place, then anything chosen in a domain the roster no
 * longer has.
 *
 * The FIRST chosen event in a domain is that domain's swap; any further one is
 * an extra. A chosen event that IS the official event is dropped — scoring it
 * is what the official row already does, and showing it twice would let a
 * player put the same score in two places.
 */
export function playList(official: readonly OfficialEvent[], chosen: readonly string[]): PlaySlot[] {
  const officialSlugs = new Set(official.map(o => o.event_slug))
  const used = new Set<string>()
  const out: PlaySlot[] = []

  for (const o of official) {
    out.push({ kind: 'official', se: { ...o } })
    let first = true
    for (const slug of chosen) {
      if (used.has(slug) || officialSlugs.has(slug)) continue
      const ev = getEventBySlug(slug)
      if (!ev || ev.domainNumber !== o.domain_number) continue
      used.add(slug)
      out.push({ kind: first ? 'swap' : 'extra', se: slotEvent(ev), ...(first ? { replaces: o } : {}) })
      first = false
    }
  }

  // Anything left: a domain the game has no event for (never today, since every
  // game draws all ten), or an event the roster dropped.
  for (const slug of chosen) {
    if (used.has(slug) || officialSlugs.has(slug)) continue
    const ev = getEventBySlug(slug)
    if (ev) out.push({ kind: 'extra', se: slotEvent(ev) })
  }
  return out
}

/** Add a chosen event, keeping the order the player picked them in. */
export function addChoice(chosen: readonly string[], slug: string): string[] {
  return chosen.includes(slug) ? [...chosen] : [...chosen, slug]
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
 * How many of the ten domains the player has covered, official or swapped.
 * The progress bar counts a swap, because it is their workout; the placement
 * banner does not, because a swapped event is ranked last.
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
