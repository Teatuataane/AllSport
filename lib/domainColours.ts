// ─── AllSport domain colours ─────────────────────────────────────────────────
//
// Also the home of RAINBOW. It used to live in lib/colours.ts, but both that
// module and lib/taniwha.ts need it and neither can import the other without a
// cycle, so it sits in the palette module that depends on nothing.
// THE single source of truth for the ten domain accent colours.
//
// This lives in lib/ rather than in components/EventIcon.tsx because
// app/events/page.tsx is a SERVER component, and importing from a 'use client'
// module there would pull a client component into the server graph — the exact
// thing that file's header comment says it was refactored to avoid.
//
// Before August 2026 there were THREE copies of this array (EventIcon.tsx,
// app/scoring/page.tsx, app/events/page.tsx) and all three held the same bug.

// Domain accent colours, indexed by domainNumber - 1. THE single source of truth —
// /scoring imported its own copy until August 2026.
//
// Ten distinct hues, one per domain. This used to be six colours stretched over ten
// domains (1 and 7 both red, 2 and 8 both amber, 4 and 9 both purple, 5 and 10 both
// blue), which was survivable while a domain colour only tinted an icon and is not
// survivable now that the colour IS the domain's identity.
//
// The set is the ten basic colour categories rather than a spectrum walk: basic
// categories are the most separable ten the eye holds, and they reuse all six brand
// hexes unchanged instead of inventing teal and sky in the green-to-blue stretch
// where discrimination is worst.
//
// Domain 10 is Pango, black. Black cannot be rendered on the #0a0a0a theme — these
// values are used as CSS mask fills, so a black tint is literally invisible — so the
// tint is the achromatic-dark member of the set and the true black lives on the
// domain's card, which inverts to a pale surface. Domain 9 (Mā, near-white) and
// domain 10 are told apart by value, which is all achromatic colours have to work
// with on a dark ground.
export const DOMAIN_COLORS = [
  '#EA4742', // 1  Maximal Strength     Whero      red
  '#F9B051', // 2  Calisthenics         Karaka     orange
  '#F9E051', // 3  Power                Kōwhai     yellow
  '#4DB26E', // 4  Speed                Kākāriki   green
  '#2371BB', // 5  Anaerobic Endurance  Kahurangi  blue
  '#B87DB5', // 6  Aerobic Endurance    Poroporo   purple
  '#F397C0', // 7  Flexibility          Māwhero    pink
  '#B87333', // 8  Body Awareness       Kōkōwai    brown / red ochre
  '#F2F2F2', // 9  Coordination         Mā         white
  '#8C9199', // 10 Aim & Precision      Pango      black (see note above)
]

export function domainColor(domainNumber: number): string {
  return DOMAIN_COLORS[(domainNumber - 1 + 10) % 10] || '#888'
}

/** The brand gradient. Uenuku, and Te Kāhui's accent. */
export const RAINBOW =
  'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)'
