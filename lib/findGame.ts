// ─── Find a game ─────────────────────────────────────────────────────────────
// MULTI_LOCATION_PLAN.md §2 "Find a game", step 10; database:
// 20261123234843_find_a_game.sql. Agreed with Tāne 24 Nov 2026:
//
//   · One card per listed game, for its next date: site, map, day and time,
//     On / Cancelled / Moved. Unlisted games never appear.
//   · Soonest first. "Near me" asks for location only when tapped, and then
//     sorts by distance; the position stays in the browser.
//   · Signed-in players also see the Kaiārahi and how many are coming.
//   · One-off games show in the four weeks before their date.
//
// PURE: no Supabase, no React (__tests__/findGame.test.ts).

import {
  dayStatus, isUpcoming, nextGameDate, nzWallClock, timeMins, addDays,
  type DayStatus, type GameNotice, type Site, type WeeklyGame,
} from '@/lib/weeklyGames'
import { distanceMetres, pinOf, type Pin } from '@/lib/sites'

/** A one-off shows this many days ahead of its date. */
export const ONE_OFF_DAYS = 28

export type FindCard = {
  game: WeeklyGame
  site: Site
  /** The date this card is about: the next game (today's until it ends). */
  date: string
  status: DayStatus
  /** Metres from the visitor, when they tapped Near me and the site is pinned. */
  metres: number | null
}

/** Minutes from now to the start of this date's game (negative once started). */
function startsIn(game: Pick<WeeklyGame, 'start_time'>, date: string, now: Date): number {
  const wall = nzWallClock(now)
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${wall.date}T00:00:00Z`)) / 86_400_000)
  return days * 1440 + timeMins(game.start_time) - wall.mins
}

/**
 * The cards to show: active, listed, at an active site, upcoming; a one-off
 * only within ONE_OFF_DAYS. Soonest first, or nearest first when `here` is
 * given (unpinned sites after the pinned, soonest among themselves).
 */
export function findCards(args: {
  games: readonly WeeklyGame[]
  sites: readonly Site[]
  notices: readonly GameNotice[]
  now?: Date
  here?: Pin | null
}): FindCard[] {
  const { games, sites, notices, now = new Date(), here = null } = args
  const siteById = new Map(sites.filter(s => s.is_active).map(s => [s.id, s]))
  const today = nzWallClock(now).date
  const cards: (FindCard & { soon: number })[] = []
  for (const game of games) {
    if (!game.is_active || game.listed === false || !isUpcoming(game, now)) continue
    const site = siteById.get(game.site_id)
    if (!site) continue
    if (game.one_off_date && game.one_off_date > addDays(today, ONE_OFF_DAYS)) continue
    const date = nextGameDate(game, now)
    const pin = pinOf(site)
    cards.push({
      game, site, date,
      status: dayStatus(game.id, date, [...notices]),
      metres: here && pin ? distanceMetres(here, pin) : null,
      soon: startsIn(game, date, now),
    })
  }
  cards.sort((a, b) => {
    if (here) {
      if (a.metres != null && b.metres == null) return -1
      if (a.metres == null && b.metres != null) return 1
      if (a.metres != null && b.metres != null && a.metres !== b.metres) return a.metres - b.metres
    }
    return a.soon - b.soon
  })
  return cards.map(c => ({ game: c.game, site: c.site, date: c.date, status: c.status, metres: c.metres }))
}

/** "On", "Cancelled", or "Moved: <where>". */
export function statusLabel(s: DayStatus): string {
  if (s.cancelled) return 'Cancelled'
  if (s.venue) return `Moved: ${s.venue}`
  return 'On'
}

/** A map link for the site: its own link, else its pin, else a search for its address. */
export function mapLink(site: Site): string | null {
  if (site.map_url) return site.map_url
  const pin = pinOf(site)
  if (pin) return `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`
  if (site.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`
  return null
}

/**
 * The homepage's "Next game" line: the soonest listed game still to start (or
 * being played), with its label. Null when there is none.
 */
export function nextListedGame(cards: readonly FindCard[]): FindCard | null {
  return cards.find(c => !c.status.cancelled) ?? null
}
