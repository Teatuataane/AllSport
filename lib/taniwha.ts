// ─── AllSport Taniwha ────────────────────────────────────────────────────────
// THE single source of truth for the grading system. Replaces lib/colours.ts.
// Full design, with the reasoning for every decision, in TANIWHA_SYSTEM_PLAN.md.
//
// A player collects TWELVE taniwha, each assembled from TEN named body parts.
//
//   1        Te Taniwha o te Whānau   the AllSport taniwha, gold
//   2 … 11   one taniwha per domain, in whatever order the player chooses
//   12       Te Kāhui                 the assembly, awarded for holding all eleven
//
// Nine parts of every taniwha are bought with lifetime points. The tenth, the
// CROWN, additionally needs an act:
//
//   Whānau   one qualified referral — someone you brought who has played 10 sessions
//   domain   win 9 of the 12 events in that domain
//   Kāhui    hold all eleven crowned
//
// THE POINTS MAP IS UNIFORM: every 1,000 points fills one slot, and every tenth
// slot is a crown. If a crown's condition is not met when its slot arrives the
// slot stays EMPTY, the next taniwha's Tinana arrives at the following 1,000,
// and the crown fills in retroactively whenever the condition lands. Points can
// therefore never stall, and crowns can never block them. This is what the plan
// calls "parking".
//
// Two numbers, not one. `rankings` is untouched and still seasonal, so
// /leaderboard still resets each January. Only the grading went lifetime.

import type { CSSProperties } from 'react'
import { DOMAIN_COLORS, RAINBOW } from './domainColours'

export { RAINBOW }

// ── The points economy ───────────────────────────────────────────────────────
// These moved here from lib/colours.ts when the colour ladder was retired: they
// describe how a session converts into points, which outlives any particular
// grading system built on top of it. The award trigger is the other half of
// this contract — change one and you must change the other.

/** Minimum placement award for anyone who takes part in a session. */
export const MIN_PLACEMENT_POINTS = 10
export const EFFORT_POINTS_PER_LEVEL = 5
export const MAX_EFFORT_LEVEL = 20
/** 100 placement + 100 effort. Nothing can score more in one session. */
export const MAX_SESSION_POINTS = 200

// ── The shape of the ladder ──────────────────────────────────────────────────

/** Lifetime points per part. Flat, forever, including the first taniwha. */
export const PART_POINTS = 1_000
export const PARTS_PER_TANIWHA = 10
/** The crown is part ten of every taniwha; parts one to nine are the body. */
export const CROWN_PART = 10
export const BODY_PARTS_PER_TANIWHA = 9
/** Whānau + ten domains. Te Kāhui is awarded, never built from parts. */
export const BUILT_TANIWHA = 11
export const TOTAL_TANIWHA = 12
/** 11 × 10. The last part slot on the ladder. */
export const TOTAL_SLOTS = BUILT_TANIWHA * PARTS_PER_TANIWHA
/** Lifetime points to fill every slot. Hard cap. */
export const PEAK_POINTS = TOTAL_SLOTS * PART_POINTS // 110,000
/** 11 × 9. Every body part on the ladder. */
export const TOTAL_BODY_PARTS = BUILT_TANIWHA * BODY_PARTS_PER_TANIWHA // 99
/** Whānau plus ten domains. Te Kāhui is not one of these. */
export const MAX_CROWNS = BUILT_TANIWHA

/** Distinct events that must be won in a domain to release its crown. */
export const WIN_TARGET = 9
/** Events per domain. Every domain holds exactly twelve. */
export const EVENTS_PER_DOMAIN = 12
/**
 * Minimum number of same-pool players who must have scored an event for a 1st
 * to count. Mirrors the `player_event_wins` view, which is the definition of
 * record — a field of one is a free win.
 */
export const WIN_MIN_FIELD = 3
/** Qualified referrals needed to crown Te Taniwha o te Whānau. */
export const WHANAU_REFERRALS = 1

// ── The ten parts ────────────────────────────────────────────────────────────
// Award order is the assembly order. Every taniwha is built the same way, so a
// player learns one sequence and uses it forever.
//
// `mauī` and `matau` keep the four limbs distinct without inventing anything.
// Arero at nine is deliberate: the protruding tongue is the wero, the
// challenge, so the taniwha issues its challenge and then takes its crown.
//
// PENDING A REO SPEAKER. See TANIWHA_SYSTEM_PLAN.md §13 — in particular whether
// `Tikitiki` (a topknot, carrying mana) or the literal `karauna` is right for
// the crown.

export type Part = {
  /** 1..10. Stable forever; the award row stores this. */
  number: number
  name: string
  english: string
  /** Asset filename under /taniwha/{taniwha}/. */
  slug: string
}

export const PARTS: Part[] = [
  { number: 1,  name: 'Tinana',        english: 'body',      slug: 'tinana' },
  { number: 2,  name: 'Kakī',          english: 'neck',      slug: 'kaki' },
  { number: 3,  name: 'Pane',          english: 'head',      slug: 'pane' },
  { number: 4,  name: 'Hiku',          english: 'tail',      slug: 'hiku' },
  { number: 5,  name: 'Ringa mauī',    english: 'left arm',  slug: 'ringa-maui' },
  { number: 6,  name: 'Ringa matau',   english: 'right arm', slug: 'ringa-matau' },
  { number: 7,  name: 'Waewae mauī',   english: 'left leg',  slug: 'waewae-maui' },
  { number: 8,  name: 'Waewae matau',  english: 'right leg', slug: 'waewae-matau' },
  { number: 9,  name: 'Arero',         english: 'tongue',    slug: 'arero' },
  { number: 10, name: 'Tikitiki',      english: 'crown',     slug: 'tikitiki' },
]

export function partByNumber(n: number): Part | null {
  return PARTS.find(p => p.number === n) ?? null
}

// ── The twelve taniwha ───────────────────────────────────────────────────────
// Descriptive names, in the Te Taniwha o te ___ form, rather than proper names.
// That needs nobody's permission and explains itself, and the award row stores
// a name snapshot so a later rename costs nothing. Real taniwha from pūrākau
// are iwi taonga — several Ōtautahi and Canterbury taniwha are named Ngāi Tahu
// ancestors — so they are neither borrowed nor invented here.
//
// ⚠ FOUR OF THE TEN DOMAIN WORDS ARE PLACEHOLDERS. Kaha, Tere and Manawaroa
// are solid; Ngāwari and Tika are likely; Hiko, Manawanui, Mataara and Ruruku
// are guesses and Ruruku especially is low confidence. There are also three
// near-collisions a reo speaker needs to rule on:
//   · Kaha (Maximal Strength) vs Kaha Tinana (Calisthenics)
//   · Manawanui (Anaerobic) vs Manawaroa (Aerobic)
//   · Hiko, the Power TANIWHA, vs Hiku, the tail PART — one letter apart
//
// The macron IS settled: the particle is the unmacronised `o`, decided August
// 2026. `Te Taniwha o te ___` across all twelve. Nothing stores the display
// name as a key — `slug` is the identity everywhere — so this was a display
// change only, but `app/leaderboard/page.tsx` strips the prefix by literal
// string match, so the two must not drift apart again.

export type TaniwhaKind = 'whanau' | 'domain' | 'kahui'

export type Taniwha = {
  kind: TaniwhaKind
  /** Full display name. */
  name: string
  /** Asset folder under /taniwha/, and the stable id in storage. */
  slug: string
  /** 1..10 for domain taniwha, null for Whānau and Te Kāhui. */
  domainNumber: number | null
  /** Te reo colour name. */
  colourName: string
  /** English name of the COLOUR — 'gold', 'red'. Not the taniwha's meaning. */
  english: string
  /**
   * Plain-English name, shown under the te reo one everywhere a player sees it.
   * "Taniwha of Connection" is Tāne's; the rest follow its form and are MINE,
   * so they need confirming alongside the four placeholder names above.
   */
  gloss: string
  /** Fill/accent. Hex, or RAINBOW. */
  accent: string
  /**
   * Pango cannot be rendered on the dark theme, so its card inverts: pale
   * surface, black creature. `accent` carries the legible tint used everywhere
   * else (chips, bars, icon masks).
   */
  inverted: boolean
  /** The crest treatment — black card, amber accent, the twin taniwha. */
  crest: boolean
}

const domainTaniwha = (
  domainNumber: number,
  word: string,
  slug: string,
  colourName: string,
  english: string,
  gloss: string,
  opts: { inverted?: boolean } = {},
): Taniwha => ({
  kind: 'domain',
  name: `Te Taniwha o te ${word}`,
  slug,
  domainNumber,
  colourName,
  english,
  gloss,
  accent: DOMAIN_COLORS[domainNumber - 1],
  inverted: opts.inverted ?? false,
  crest: false,
})

export const WHANAU: Taniwha = {
  kind: 'whanau',
  name: 'Te Taniwha o te Whānau',
  slug: 'whanau',
  domainNumber: null,
  colourName: 'Kōura',
  english: 'gold',
  gloss: 'Taniwha of Connection',
  accent: '#F9B051',
  inverted: false,
  crest: true,
}

export const KAHUI: Taniwha = {
  kind: 'kahui',
  name: 'Te Kāhui',
  slug: 'kahui',
  domainNumber: null,
  colourName: 'Uenuku',
  english: 'rainbow',
  gloss: 'The Assembly',
  accent: RAINBOW,
  inverted: false,
  crest: true,
}

/** Indexed by domainNumber - 1, so it matches DOMAIN_COLORS and DOMAIN_ORDER. */
export const DOMAIN_TANIWHA: Taniwha[] = [
  domainTaniwha(1,  'Kaha',        'kaha',        'Whero',    'red',    'Taniwha of Strength'),
  domainTaniwha(2,  'Kaha Tinana', 'kaha-tinana', 'Karaka',   'orange', 'Taniwha of Bodyweight Strength'),
  domainTaniwha(3,  'Hiko',        'hiko',        'Kōwhai',   'yellow', 'Taniwha of Power'),
  domainTaniwha(4,  'Tere',        'tere',        'Kākāriki', 'green',  'Taniwha of Speed'),
  domainTaniwha(5,  'Manawanui',   'manawanui',   'Kahurangi','blue',   'Taniwha of Endurance'),
  domainTaniwha(6,  'Manawaroa',   'manawaroa',   'Poroporo', 'purple', 'Taniwha of Stamina'),
  domainTaniwha(7,  'Ngāwari',     'ngawari',     'Māwhero',  'pink',   'Taniwha of Flexibility'),
  domainTaniwha(8,  'Mataara',     'mataara',     'Kōkōwai',  'brown',  'Taniwha of Awareness'),
  domainTaniwha(9,  'Ruruku',      'ruruku',      'Mā',       'white',  'Taniwha of Coordination'),
  domainTaniwha(10, 'Tika',        'tika',        'Pango',    'black',  'Taniwha of Precision', { inverted: true }),
]

/** Whānau, the ten domains, then Te Kāhui. Display order, NOT collection order. */
export const TANIWHA: Taniwha[] = [WHANAU, ...DOMAIN_TANIWHA, KAHUI]

export function taniwhaForDomain(domainNumber: number): Taniwha | null {
  return DOMAIN_TANIWHA.find(t => t.domainNumber === domainNumber) ?? null
}

export function taniwhaBySlug(slug: string): Taniwha | null {
  return TANIWHA.find(t => t.slug === slug) ?? null
}

// ── The points map ───────────────────────────────────────────────────────────
// Every 1,000 points fills one slot, and every tenth slot is a crown. Slots run
// 1..110 across the whole ladder, so slot 10 is your first crown, slot 20 your
// second, and slots 110 completes it.
//
// ⚠ A SLOT IS NOT A FIXED CELL IN A FIXED TANIWHA.
//
// The obvious reading — slot 15 is "taniwha two, part five" — is wrong, because
// a player may SWITCH which taniwha they are building and their parts stay on
// the one they were placed on (TANIWHA_SYSTEM_PLAN.md decision 10). Switch at
// four parts and the abandoned taniwha still holds four, resumable later. Under
// a fixed map those slots are gone and it could never be finished.
//
// So points grant a BUDGET, not an address:
//
//   body-part budget  floor(p/1000) − floor(p/10000), capped at 99
//   crown capacity    floor(p/10000), capped at 11
//
// At the peak that is exactly 99 body parts (11 × 9) and 11 crowns. Which
// taniwha the budget is spent on is the player's choice and lives in the
// database. Which crown is claimed first is whichever act lands first.

export type Slot = {
  slot: number
  points: number
  isCrown: boolean
  /** 1..11 when isCrown — your first crown, second, and so on. Never a domain. */
  crownOrdinal: number | null
}

/** Lifetime points that open your `nth` crown. Whānau's is normally 10,000. */
export function crownPoints(nth: number): number {
  return nth * PARTS_PER_TANIWHA * PART_POINTS
}

export function slotAt(slot: number): Slot | null {
  if (!Number.isInteger(slot) || slot < 1 || slot > TOTAL_SLOTS) return null
  const isCrown = slot % PARTS_PER_TANIWHA === 0
  return {
    slot,
    points: slot * PART_POINTS,
    isCrown,
    crownOrdinal: isCrown ? slot / PARTS_PER_TANIWHA : null,
  }
}

/** Total 1,000-point steps taken, capped at the peak. Drives the progress bar. */
export function slotsReached(points: number): number {
  if (!Number.isFinite(points) || points < 0) return 0
  return Math.min(Math.floor(points / PART_POINTS), TOTAL_SLOTS)
}

/** Body parts this lifetime total has earned, to spend on whichever taniwha. */
export function bodyPartBudget(points: number): number {
  const slots = slotsReached(points)
  const crownSlots = Math.floor(slots / PARTS_PER_TANIWHA)
  return Math.min(slots - crownSlots, TOTAL_BODY_PARTS)
}

/** The most crowns this lifetime total permits. Holding one still needs its act. */
export function crownCapacity(points: number): number {
  return Math.min(Math.floor(Math.max(points, 0) / (PARTS_PER_TANIWHA * PART_POINTS)), MAX_CROWNS)
}

/** Is there room for another crown, points-wise? */
export function hasCrownRoom(points: number, crownsHeld: number): boolean {
  return crownsHeld < crownCapacity(points)
}

/** The next slot to come, or null once the ladder is complete. */
export function nextSlot(points: number): (Slot & { pointsToGo: number }) | null {
  const reached = slotsReached(points)
  if (reached >= TOTAL_SLOTS) return null
  const s = slotAt(reached + 1)
  if (!s) return null
  return { ...s, pointsToGo: s.points - Math.max(points, 0) }
}

/** Percentage progress toward the next slot, 0–100. */
export function progressToNextSlot(points: number): number {
  const next = nextSlot(points)
  if (!next) return 100
  const from = next.points - PART_POINTS
  return Math.min(Math.max(((points - from) / PART_POINTS) * 100, 0), 100)
}

/**
 * Limbs held on one taniwha, counting the crown as the tenth.
 *
 * `body_parts` maxes at 9 because the crown is not bought with points, so a
 * crowned taniwha STORES 9 and must DISPLAY 10. Getting this wrong shows a
 * finished taniwha as "9 of 10" forever, which is the kind of off-by-one nobody
 * reports because it looks deliberate.
 */
export function limbsHeld(
  row: { body_parts: number; crowned_at: string | null } | null | undefined,
): number {
  if (!row) return 0
  return Math.min(Math.max(row.body_parts, 0), BODY_PARTS_PER_TANIWHA) + (row.crowned_at ? 1 : 0)
}

// ── When each limb landed ────────────────────────────────────────────────────
// `player_taniwha` stores a COUNT of limbs, not a row per limb, so there is no
// stored date for "when did I earn Ringa matau". There is no plan to add one —
// 110 award rows per player to render a list is not worth the write amplification
// on every session close.
//
// It is derivable instead. Points only ever arrive at a session close, so running
// the sessions in date order and watching for each 1,000-point boundary gives the
// exact session in which every limb landed. Same technique the colours backfill
// used to reconstruct real crossing dates rather than stamping them all with the
// migration's timestamp.
//
// What this deliberately does NOT claim is WHICH taniwha each limb went on. A
// player may switch at any time and that history is not stored either, so the
// list says "limb 5" and names the session, never "Ringa matau of Te Tere".

export type LimbCrossing = {
  /** 1-based across the whole ladder, 1..110. */
  limb: number
  /** Lifetime total the moment it landed. */
  points: number
  sessionId: string
  sessionDate: string
  location: string | null
}

export type PointsSession = {
  session_id: string
  session_date: string
  location: string | null
  /** placement + effort for that session. */
  points: number
}

/**
 * Sessions may arrive in any order; they are sorted here so a caller cannot get
 * it wrong. `startingPoints` covers adjustment_points, which are not attributable
 * to any session — they shift every crossing that follows.
 */
export function limbCrossings(sessions: PointsSession[], startingPoints = 0): LimbCrossing[] {
  const ordered = [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date))
  const out: LimbCrossing[] = []
  let total = Math.max(startingPoints, 0)
  let limb = Math.floor(total / PART_POINTS)

  for (const s of ordered) {
    total += Math.max(s.points, 0)
    const reached = Math.min(Math.floor(total / PART_POINTS), TOTAL_SLOTS)
    while (limb < reached) {
      limb += 1
      out.push({
        limb,
        points: total,
        sessionId: s.session_id,
        sessionDate: s.session_date,
        location: s.location,
      })
    }
    if (limb >= TOTAL_SLOTS) break
  }
  return out
}

// ── Crown conditions ─────────────────────────────────────────────────────────
// Every crown needs crown ROOM (the points) and its ACT. Crowns are fungible:
// the points open your Nth crown, and which taniwha takes it is whichever act
// you completed. A player who wins 9 of 12 before earning a referral crowns a
// domain first and Whānau second — that is fine, and it is why these take
// `crownsHeld` rather than a fixed position.

/** Te Taniwha o te Whānau: the only crown a player cannot earn alone. */
export function whanauCrownEarned(
  points: number,
  crownsHeld: number,
  qualifiedReferrals: number,
): boolean {
  return hasCrownRoom(points, crownsHeld) && qualifiedReferrals >= WHANAU_REFERRALS
}

/** A domain taniwha, once its nine body parts are placed. */
export function domainCrownEarned(
  points: number,
  crownsHeld: number,
  distinctEventsWon: number,
): boolean {
  return hasCrownRoom(points, crownsHeld) && distinctEventsWon >= WIN_TARGET
}

/** Te Kāhui. Not built from parts — it is what holding all eleven looks like. */
export function kahuiEarned(points: number, crownedCount: number): boolean {
  return points >= PEAK_POINTS && crownedCount >= BUILT_TANIWHA
}

/** Distinct events still to win in a domain. Never negative. */
export function winsToGo(distinctEventsWon: number): number {
  return Math.max(WIN_TARGET - distinctEventsWon, 0)
}

// ── Live-session predicates ──────────────────────────────────────────────────
// Points are only written when a session closes, so an alert built on stored
// data fires after everyone has gone home. These let the kaiwhakawā be told
// during the session instead, and must be mirrored exactly by the claim RPC.

/**
 * Points a player is guaranteed to bank from a session already under way,
 * whatever happens next: the minimum placement award plus effort already
 * earned. Uses NO placement ranking, so another player finishing strongly can
 * never invalidate it.
 */
export function guaranteedSessionPoints(effortLevel: number): number {
  const level = Math.min(Math.max(effortLevel, 0), MAX_EFFORT_LEVEL)
  return MIN_PLACEMENT_POINTS + level * EFFORT_POINTS_PER_LEVEL
}

/** "Has earned it" — safe to say out loud, because it holds at the worst case. */
export function hasEarnedDuringSession(
  lifetimePoints: number,
  effortLevel: number,
  threshold: number,
): boolean {
  return lifetimePoints + guaranteedSessionPoints(effortLevel) >= threshold
}

/** "On track today" — uses provisional placement, so it can retract. Never announce it. */
export function isOnTrackDuringSession(
  lifetimePoints: number,
  projectedSessionPoints: number,
  threshold: number,
): boolean {
  return lifetimePoints + projectedSessionPoints >= threshold
}

// ── Rank ─────────────────────────────────────────────────────────────────────
// Rank is PARTS HELD, 0–110. Two players on identical points differ only by
// crowns: points set the ceiling, crowns are how much of it has been claimed.
// The badge is the crowned count, the way a belt is.

export function rankLabel(crowned: number, parts: number): string {
  const t = `${crowned} taniwha`
  return parts > 0 ? `${t}, ${parts} part${parts === 1 ? '' : 's'}` : t
}

// ── Styling ──────────────────────────────────────────────────────────────────

const isGradient = (v: string) => v.startsWith('linear-gradient')

/** Full-bleed taniwha card (dashboard, session-end takeover). */
export function taniwhaCardStyle(t: Taniwha): CSSProperties {
  // Pango: the only one that inverts, because black on #0a0a0a is nothing.
  if (t.inverted) {
    return { background: '#F2F2F2', color: '#0a0a0a', border: '2px solid #0a0a0a' }
  }
  // Whānau and Te Kāhui wear the crest: black card, accent edge.
  if (t.crest) {
    return isGradient(t.accent)
      ? {
          background: '#000000',
          color: '#ffffff',
          border: '2px solid transparent',
          // CSS `border` cannot take a gradient and falls back SILENTLY to the
          // first colour. This two-layer clip is the only thing that works, and
          // forgetting it has shipped as a real bug twice.
          backgroundImage: `linear-gradient(#000,#000), ${t.accent}`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }
      : { background: '#000000', color: t.accent, border: `2px solid ${t.accent}` }
  }
  return { background: t.accent, color: '#0a0a0a', border: `2px solid ${t.accent}` }
}

/** The colour to render a taniwha's NAME in, on a dark page. */
export function taniwhaOnDark(t: Taniwha): string {
  if (isGradient(t.accent)) return '#F9B051' // rainbow cannot be a text colour
  return t.accent
}

/** Small chip: leaderboard rows, the timeline, the kaiwhakawā alert. */
export function taniwhaChipStyle(t: Taniwha): CSSProperties {
  if (isGradient(t.accent)) {
    const FILL = '#111111'
    return {
      background: FILL,
      border: '2px solid transparent',
      backgroundImage: `linear-gradient(${FILL},${FILL}), ${t.accent}`,
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
    }
  }
  return { background: t.accent, boxShadow: `0 0 5px ${t.accent}44` }
}

/**
 * Path to one assembled part, or null if the taniwha has no parts (Te Kāhui).
 *
 * Rendered as a CSS mask tinted `accent`, the same pipeline as EventIcon, so a
 * black silhouette export works on the dark theme automatically. All ten parts
 * of a taniwha MUST be exported on the same canvas with the same registration
 * or they will not layer. A filename that is not the exact slug falls back
 * silently, exactly as event icons do.
 */
export function partAssetSrc(t: Taniwha, part: Part): string | null {
  if (t.kind === 'kahui') return null
  return `/taniwha/${t.slug}/${part.slug}.png`
}
