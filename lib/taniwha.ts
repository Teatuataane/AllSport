// ─── AllSport Taniwha ────────────────────────────────────────────────────────
// THE single source of truth for the grading system. Replaces lib/colours.ts.
// Full design, with the reasoning for every decision, in TANIWHA_SYSTEM_PLAN.md.
//
// A player collects TWELVE taniwha, each assembled from TEN named body parts.
//
//   1        Te Taniwha ō te Whānau   the AllSport taniwha, gold
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
/** Ten body parts plus the crown. */
export const PARTS_PER_TANIWHA = 11
/** The crown is the eleventh; parts one to ten are the body. */
export const CROWN_PART = 11
/** Part ten. The only part whose identity depends on which taniwha it is. */
export const IMPLEMENT_PART = 10
export const BODY_PARTS_PER_TANIWHA = 10
/** Whānau + ten domains. Te Kāhui is awarded, never built from parts. */
export const BUILT_TANIWHA = 11
export const TOTAL_TANIWHA = 12
/** 11 × 10. Every body part on the ladder. */
export const TOTAL_BODY_PARTS = BUILT_TANIWHA * BODY_PARTS_PER_TANIWHA // 110
/** Lifetime points to fill every body part. Hard cap. */
export const PEAK_POINTS = TOTAL_BODY_PARTS * PART_POINTS // 110,000
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
/** Qualified referrals needed to crown Te Taniwha ō te Whānau. */
export const WHANAU_REFERRALS = 1

// ── The ten parts ────────────────────────────────────────────────────────────
// Award order is the assembly order, and it tells a story: the head comes
// first, the body forms beneath it, it grows limbs and wings, issues the wero,
// picks up the tool of its discipline, and only then earns its crown.
//
// The head leads deliberately. It is the most recognisable single piece, so a
// player's very first award already looks like a taniwha — where a headless
// torso would not.
//
// `mauī` and `matau` keep the four limbs distinct without inventing anything.
// Neck and head are ONE part — "you have unlocked a neck" was never going to
// feel like anything, and a merged head reads far better in silhouette.
//
// Part 10, the implement, is the only part that differs between taniwha. Every
// one is drawn from a real event in that domain rather than invented, which is
// also how the two domains with no obvious equipment (Speed, Flexibility) got
// one: Beach Flags and Capture the Flag give Speed a flag, and Forward Split and
// Middle Split are literally scored as block height from the ground.
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
  { number: 1,  name: 'Pane',         english: 'head',      slug: 'pane' },
  { number: 2,  name: 'Tinana',       english: 'body',      slug: 'tinana' },
  { number: 3,  name: 'Hiku',         english: 'tail',      slug: 'hiku' },
  { number: 4,  name: 'Ringa mauī',   english: 'left arm',  slug: 'ringa-maui' },
  { number: 5,  name: 'Ringa matau',  english: 'right arm', slug: 'ringa-matau' },
  { number: 6,  name: 'Waewae mauī',  english: 'left leg',  slug: 'waewae-maui' },
  { number: 7,  name: 'Waewae matau', english: 'right leg', slug: 'waewae-matau' },
  { number: 8,  name: 'Parirau',      english: 'wings',     slug: 'parirau' },
  { number: 9,  name: 'Arero',        english: 'tongue',    slug: 'arero' },
  // Part TEN is the implement, and it is the only part that differs between
  // taniwha: each carries the tool of its own discipline. Resolve it with
  // partFor(taniwha, 10), never partByNumber(10).
  { number: 10, name: 'Taputapu',     english: 'implement', slug: 'taputapu' },
  { number: 11, name: 'Tikitiki',     english: 'crown',     slug: 'tikitiki' },
]

export function partByNumber(n: number): Part | null {
  return PARTS.find(p => p.number === n) ?? null
}

// ── The twelve taniwha ───────────────────────────────────────────────────────
// Descriptive names, in the Te Taniwha ō te ___ form, rather than proper names.
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
// And the macron on `ō` is itself unsettled; in this construction the particle
// is usually the unmacronised `o`.

export type TaniwhaKind = 'whanau' | 'domain' | 'kahui'

/**
 * Part ten. The only part that differs between taniwha — each carries the tool
 * of its own discipline, drawn from a real event in that domain rather than
 * invented.
 *
 * ⚠ FOUR OF THESE TE REO NAMES ARE PLACEHOLDERS, marked below. Tao, Hoe,
 * Kōpere, Taura, Kara, Porowhita and Ringaringa are attested; Pou Taumaha,
 * Wīra, Papa and Rākete are my best attempts and go to the reo review with the
 * domain words.
 */
export type Implement = {
  name: string
  english: string
  slug: string
  /** The event it comes from, so nobody has to re-derive the reasoning. */
  from: string
}

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
  english: string
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
  /** Part ten. */
  implement: Implement
}

const domainTaniwha = (
  domainNumber: number,
  word: string,
  slug: string,
  colourName: string,
  english: string,
  implement: Implement,
  opts: { inverted?: boolean } = {},
): Taniwha => ({
  kind: 'domain',
  name: `Te Taniwha ō te ${word}`,
  slug,
  domainNumber,
  colourName,
  english,
  accent: DOMAIN_COLORS[domainNumber - 1],
  inverted: opts.inverted ?? false,
  crest: false,
  implement,
})

export const WHANAU: Taniwha = {
  kind: 'whanau',
  name: 'Te Taniwha ō te Whānau',
  slug: 'whanau',
  domainNumber: null,
  colourName: 'Kōura',
  english: 'gold',
  accent: '#F9B051',
  inverted: false,
  crest: true,
  // No domain, so no equipment. It carries MANY HANDS instead: its crown is a
  // referral, so the thing it holds out is the invitation — and the sport's
  // whole pitch is that you need no equipment to start.
  implement: {
    name: 'Ngā Ringaringa', english: 'many hands', slug: 'hands',
    from: 'the invitation — this crown is a qualified referral',
  },
}

export const KAHUI: Taniwha = {
  kind: 'kahui',
  name: 'Te Kāhui',
  slug: 'kahui',
  domainNumber: null,
  colourName: 'Uenuku',
  english: 'rainbow',
  accent: RAINBOW,
  inverted: false,
  crest: true,
  // The assembly carries the other eleven. Nothing else says "all of them".
  implement: {
    name: 'Ngā Taniwha', english: 'the other eleven', slug: 'taniwha',
    from: 'holding all eleven crowned',
  },
}

/** Indexed by domainNumber - 1, so it matches DOMAIN_COLORS and DOMAIN_ORDER. */
const imp = (name: string, english: string, slug: string, from: string): Implement =>
  ({ name, english, slug, from })

export const DOMAIN_TANIWHA: Taniwha[] = [
  domainTaniwha(1,  'Kaha',        'kaha',        'Whero',    'red',
    imp('Pou Taumaha', 'barbell',  'barbell',  'Deadlift, Clean & Press')),      // reo TBC
  domainTaniwha(2,  'Kaha Tinana', 'kaha-tinana', 'Karaka',   'orange',
    imp('Porowhita',   'rings',    'rings',    'Iron Cross, Front Lever')),
  domainTaniwha(3,  'Hiko',        'hiko',        'Kōwhai',   'yellow',
    imp('Tao',         'javelin',  'javelin',  'Javelin')),
  domainTaniwha(4,  'Tere',        'tere',        'Kākāriki', 'green',
    imp('Kara',        'flag',     'flag',     'Beach Flags, Capture the Flag')),
  domainTaniwha(5,  'Manawanui',   'manawanui',   'Kahurangi','blue',
    imp('Wīra',        'ab wheel', 'ab-wheel', 'Ab Rollout')),                   // reo TBC
  domainTaniwha(6,  'Manawaroa',   'manawaroa',   'Poroporo', 'purple',
    imp('Hoe',         'oar',      'oar',      'Row Erg, Ski Erg')),
  domainTaniwha(7,  'Ngāwari',     'ngawari',     'Māwhero',  'pink',
    imp('Papa',        'block',    'block',    'Forward Split, Middle Split')),             // reo TBC
  domainTaniwha(8,  'Mataara',     'mataara',     'Kōkōwai',  'brown',
    imp('Taura',       'jump rope','jump-rope','Jump Rope')),
  domainTaniwha(9,  'Ruruku',      'ruruku',      'Mā',       'white',
    imp('Rākete',      'racquet',  'racquet',  'Tennis, Badminton, Squash')),    // reo TBC
  domainTaniwha(10, 'Tika',        'tika',        'Pango',    'black',
    imp('Kōpere',      'bow',      'bow',      'Archery'), { inverted: true }),
]

/** Whānau, the ten domains, then Te Kāhui. Display order, NOT collection order. */
export const TANIWHA: Taniwha[] = [WHANAU, ...DOMAIN_TANIWHA, KAHUI]

/**
 * The part a given taniwha earns at position `n`.
 *
 * Identical to partByNumber for parts 1-9 and the crown, but part TEN is the
 * implement and differs per taniwha — Kaha earns a barbell, Tika earns a bow.
 * Use this anywhere a part is named to a player; partByNumber alone would tell
 * everyone they earned a generic "Taputapu".
 */
export function partFor(taniwha: Taniwha, n: number): Part | null {
  if (n !== IMPLEMENT_PART) return partByNumber(n)
  return {
    number: IMPLEMENT_PART,
    name: taniwha.implement.name,
    english: taniwha.implement.english,
    slug: taniwha.implement.slug,
  }
}

export function taniwhaForDomain(domainNumber: number): Taniwha | null {
  return DOMAIN_TANIWHA.find(t => t.domainNumber === domainNumber) ?? null
}

export function taniwhaBySlug(slug: string): Taniwha | null {
  return TANIWHA.find(t => t.slug === slug) ?? null
}

// ── The points map ───────────────────────────────────────────────────────────
// Every 1,000 lifetime points is one body part. That is the whole rule.
//
// Crowns are a SEPARATE track: they are not bought with points and do not
// consume a part slot. Points open crown ROOM — one per 10,000 — and the act
// (a referral, or 9 of 12 event wins) fills it.
//
//   body-part budget  floor(p/1000), capped at 110  (11 taniwha × 10 parts)
//   crown capacity    floor(p/10000), capped at 11
//
// At the peak that is exactly 110 body parts and 11 crowns, which is why
// PEAK_POINTS is 110,000.
//
// ⚠ A PART IS NOT A FIXED CELL IN A FIXED TANIWHA.
//
// The obvious reading — part 15 is "taniwha two, part five" — is wrong, because
// a player may SWITCH which taniwha they are building and their parts stay on
// the one they were placed on (TANIWHA_SYSTEM_PLAN.md decision 10). Switch at
// four parts and the abandoned taniwha still holds four, resumable later. Under
// a fixed map those slots are gone and it could never be finished. So points
// grant a BUDGET, and where it is spent is the player's choice, held in the
// database.

export type Slot = { slot: number; points: number }

/** Lifetime points that open your `nth` crown. Whānau's is normally 10,000. */
export function crownPoints(nth: number): number {
  return nth * BODY_PARTS_PER_TANIWHA * PART_POINTS
}

/** Body parts this lifetime total has earned, to spend on whichever taniwha. */
export function bodyPartBudget(points: number): number {
  if (!Number.isFinite(points) || points < 0) return 0
  return Math.min(Math.floor(points / PART_POINTS), TOTAL_BODY_PARTS)
}

/** Alias kept for the progress UI: parts and slots are now the same thing. */
export const slotsReached = bodyPartBudget

export function slotAt(slot: number): Slot | null {
  if (!Number.isInteger(slot) || slot < 1 || slot > TOTAL_BODY_PARTS) return null
  return { slot, points: slot * PART_POINTS }
}

/** The most crowns this lifetime total permits. Holding one still needs its act. */
export function crownCapacity(points: number): number {
  return Math.min(
    Math.floor(Math.max(points, 0) / (BODY_PARTS_PER_TANIWHA * PART_POINTS)),
    MAX_CROWNS,
  )
}

/** Is there room for another crown, points-wise? */
export function hasCrownRoom(points: number, crownsHeld: number): boolean {
  return crownsHeld < crownCapacity(points)
}

/** The next part to come, or null once every one is earned. */
export function nextSlot(points: number): (Slot & { pointsToGo: number }) | null {
  const reached = bodyPartBudget(points)
  if (reached >= TOTAL_BODY_PARTS) return null
  const s = slotAt(reached + 1)
  if (!s) return null
  return { ...s, pointsToGo: s.points - Math.max(points, 0) }
}

/** Percentage progress toward the next part, 0–100. */
export function progressToNextSlot(points: number): number {
  const next = nextSlot(points)
  if (!next) return 100
  const from = next.points - PART_POINTS
  return Math.min(Math.max(((points - from) / PART_POINTS) * 100, 0), 100)
}

// ── Crown conditions ─────────────────────────────────────────────────────────
// Every crown needs crown ROOM (the points) and its ACT. Crowns are fungible:
// the points open your Nth crown, and which taniwha takes it is whichever act
// you completed. A player who wins 9 of 12 before earning a referral crowns a
// domain first and Whānau second — that is fine, and it is why these take
// `crownsHeld` rather than a fixed position.

/** Te Taniwha ō te Whānau: the only crown a player cannot earn alone. */
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
  // Te Kāhui is assembled from the other eleven rather than drawn in parts.
  if (t.kind === 'kahui') return null
  const slug = part.number === IMPLEMENT_PART ? t.implement.slug : part.slug
  return `/taniwha/${t.slug}/${slug}.png`
}
