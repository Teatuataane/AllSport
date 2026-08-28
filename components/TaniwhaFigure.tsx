'use client'

// ─── The taniwha, assembling ─────────────────────────────────────────────────
// Eleven pieces: ten body parts bought with points, then the crown, which is
// earned. The whole point of the grading system is that you can SEE the creature
// come together, so a progress bar will not do.
//
// TWO RENDERERS, and which one runs depends on whether the art exists yet.
//
//  1. ITS OWN ART — /taniwha/{slug}/{piece}.png layered as CSS masks and filled
//     with the taniwha's ink, the same pipeline as EventIcon. Every piece is
//     exported on one 1000×1000 canvas with the same registration, so stacking
//     them at identical size is what makes them line up. See public/taniwha/README.md.
//  2. WHĀNAU'S ART, IN ITS OWN INK — for the eleven taniwha not yet drawn.
//     Whānau is the only one drawn, and its pieces are the placeholder for the
//     rest until each is illustrated. They still read as distinct creatures
//     because the ink is the taniwha's own, not Whānau's.
//  3. FILLER GEOMETRY — the shapes below. Only reachable if Whānau's art is
//     missing too, and for Te Kāhui, which is assembled from the other eleven
//     rather than drawn in pieces at all.
//
// Falling back to Whānau means BORROWING ITS IMPLEMENT: piece ten is the only
// piece that differs between taniwha, and Kaha's barbell.png does not exist
// yet. A borrowed pair of hands is better than a taniwha missing a piece it has
// actually earned.
//
// The probe is one HEAD-equivalent image load per taniwha per page load, cached
// at module scope. A missing folder falls back silently, exactly as event icons
// do; it must never render half a creature.

import { useEffect, useState } from 'react'
import {
  PARTS, CROWN_PART, IMPLEMENT_PART, BODY_PARTS_PER_TANIWHA,
  WHANAU, partFor, partAssetSrc, type Taniwha,
} from '@/lib/taniwha'

// ── Filler geometry ──────────────────────────────────────────────────────────
// The last resort, not the normal path: an undrawn taniwha borrows Whānau's art
// now, so these shapes are only reached if Whānau's own PNGs go missing, and for
// Te Kāhui. Kept because the figure must never render nothing.
//
// Keyed by PART NUMBER so it tracks PARTS exactly. Head is one piece now — neck
// merged into it in the August 2026 pass, because "you have unlocked a neck" was
// never going to feel like anything.
const SHAPES: Record<number, { d?: string; ellipse?: { cx: number; cy: number; rx: number; ry: number } }> = {
  11: { d: 'M34,20 L40,6 L48,15 L56,4 L63,20 Z' },                   // Tikitiki    crown
  10: { d: 'M120,104 L150,96 L152,104 L122,112 Z' },                 // Taputapu    implement
  9:  { d: 'M30,37 L13,43 L15,50 L32,44 Z' },                        // Arero       tongue
  8:  { d: 'M86,60 Q112,26 148,30 Q120,52 108,72 Z' },               // Parirau     wings
  7:  { d: 'M108,94 L115,121 L127,117 L118,92 Z' },                  // Waewae matau
  6:  { d: 'M96,98 L96,125 L108,125 L106,98 Z' },                    // Waewae mauī
  5:  { d: 'M78,100 L74,125 L86,128 L92,104 Z' },                    // Ringa matau
  4:  { d: 'M60,94 L48,119 L60,125 L72,100 Z' },                     // Ringa mauī
  3:  { d: 'M112,76 Q142,64 154,38 Q146,74 118,94 Z' },              // Hiku        tail
  2:  { ellipse: { cx: 80, cy: 78, rx: 34, ry: 25 } },               // Tinana      body
  1:  { d: 'M58,70 L45,45 L34,38 Q30,20 50,17 Q70,20 66,40 L71,62 Z' }, // Pane     head + neck
}

/** Back to front. Wings and tail sit behind the body, crown and tool in front. */
const PAINT_ORDER = [8, 3, 2, 11, 1, 9, 6, 7, 4, 5, 10]

// ── Art probe ────────────────────────────────────────────────────────────────
// slug -> has art of its own. `undefined` while unknown, so the first paint
// uses the fallback rather than flashing an empty frame.
const artStatus: Record<string, boolean> = {}

/**
 * Which taniwha's PNGs to draw: this one if it has been illustrated, otherwise
 * Whānau's as the stand-in, otherwise null for geometry.
 *
 * Te Kāhui never has art — it is the assembly of the other eleven, not a
 * creature drawn in pieces — so it is answered without a network request and
 * does NOT borrow Whānau's, which would misrepresent what it is.
 */
function probeArt(t: Taniwha, onResult: (source: Taniwha | null) => void): void {
  if (t.kind === 'kahui') { onResult(null); return }

  const settle = (ownArt: boolean) => {
    if (ownArt) { onResult(t); return }
    // Whānau standing in for itself would be an infinite regress; if its own
    // art is missing there is nothing left but geometry.
    onResult(t.slug === WHANAU.slug ? null : WHANAU)
  }

  const cached = artStatus[t.slug]
  if (cached !== undefined) { settle(cached); return }

  const src = partAssetSrc(t, PARTS[0])
  if (!src) { settle(false); return }

  const img = new Image()
  img.onload = () => { artStatus[t.slug] = true; settle(true) }
  img.onerror = () => { artStatus[t.slug] = false; settle(false) }
  img.src = src
}

export type TaniwhaFigureProps = {
  taniwha: Taniwha
  /** 0–11. The eleventh is the crown and only fills when the crown is held. */
  limbsEarned: number
  /** Solid fill for earned pieces — the card's ink, not always the accent. */
  ink: string
  /** Ghost fill for locked pieces, as an rgba string. */
  ghost: string
  /** Ghost stroke for locked pieces. */
  ghostStroke: string
  width?: number
  /** Hide the eye — used on the small figures where it reads as noise. */
  showEye?: boolean
}

export default function TaniwhaFigure({
  taniwha, limbsEarned, ink, ghost, ghostStroke, width = 150, showEye = true,
}: TaniwhaFigureProps) {
  // Whose art to draw. Starts on the best answer available without a request:
  // this taniwha's if a previous probe proved it, otherwise Whānau's — so an
  // undrawn taniwha paints a real creature immediately instead of showing
  // geometry for a frame and then swapping.
  const [artSource, setArtSource] = useState<Taniwha | null>(() =>
    taniwha.kind === 'kahui' ? null
      : artStatus[taniwha.slug] ? taniwha
      : taniwha.slug === WHANAU.slug ? null
      : WHANAU
  )

  useEffect(() => {
    let cancelled = false
    probeArt(taniwha, src => { if (!cancelled) setArtSource(src) })
    return () => { cancelled = true }
  }, [taniwha.slug])

  // The crown is the eleventh and is earned by an ACT, never bought, so a player
  // on ten body parts has a complete body and no crown — `building` must not
  // point at it as if the next 1,000 points would fill it.
  const building = limbsEarned < BODY_PARTS_PER_TANIWHA ? limbsEarned + 1 : null
  const height = Math.round((width / 165) * 150)

  const stateOf = (n: number): 'earned' | 'building' | 'locked' => {
    if (n === CROWN_PART) return limbsEarned >= CROWN_PART ? 'earned' : 'locked'
    if (n <= limbsEarned) return 'earned'
    return n === building ? 'building' : 'locked'
  }

  const label = `${taniwha.name}, ${limbsEarned} of ${PARTS.length} pieces`

  if (artSource) {
    return (
      <div
        role="img"
        aria-label={label}
        style={{ position: 'relative', width, height: width, flexShrink: 0 }}
      >
        {PARTS.map(p => {
          // partFor, not partByNumber: piece ten is the implement and its file is
          // named for the tool, so Kaha loads barbell.png and Tika loads bow.png.
          //
          // Both calls take artSource, never `taniwha`. When Whānau is standing
          // in, piece ten must resolve to ITS implement (hands.png) — asking
          // `taniwha` would request Kaha's barbell.png from Whānau's folder and
          // drop the one piece that differs between them.
          const part = partFor(artSource, p.number) ?? p
          const src = partAssetSrc(artSource, part)
          if (!src) return null
          const state = stateOf(p.number)
          return (
            <div
              key={p.number}
              aria-hidden
              style={{
                position: 'absolute', inset: 0,
                backgroundColor: ink,
                opacity: state === 'earned' ? 1 : state === 'building' ? 0.38 : 0.12,
                WebkitMaskImage: `url(${src})`,
                maskImage: `url(${src})`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                transition: 'opacity 220ms var(--ease)',
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <svg
      viewBox="0 0 165 150"
      width={width}
      height={height}
      style={{ flexShrink: 0, display: 'block' }}
      role="img"
      aria-label={label}
    >
      {PAINT_ORDER.map(n => {
        const shape = SHAPES[n]
        if (!shape) return null
        const state = stateOf(n)
        const isBuilding = state === 'building'

        const common = {
          fill: state === 'earned' ? ink : ghost,
          stroke: isBuilding ? ink : state === 'locked' ? ghostStroke : undefined,
          strokeWidth: isBuilding ? 1.6 : state === 'locked' ? 1 : undefined,
          strokeDasharray: isBuilding ? '3 2.5' : state === 'locked' ? '2 2' : undefined,
        }

        return shape.ellipse
          ? <ellipse key={n} {...shape.ellipse} {...common} />
          : <path key={n} d={shape.d} {...common} />
      })}

      {showEye && limbsEarned >= 1 && (
        <circle cx="46" cy="30" r="2.6" fill={taniwha.inverted ? '#F2F2F2' : '#000000'} />
      )}
    </svg>
  )
}

/**
 * The ink / ghost triple a figure needs, derived from the card it sits on.
 * Kept here so the card and the figure cannot disagree about what "ghost" means.
 */
export function figureInk(t: Taniwha, cardInk: string): { ink: string; ghost: string; ghostStroke: string } {
  // On a flood-filled or inverted card the ink is near-black, so the ghosts are
  // black at low alpha. On the crest cards (Whānau, Te Kāhui) the ink is the
  // accent on black, so the ghosts are that accent at low alpha instead.
  const dark = cardInk === '#0a0a0a' || cardInk === '#000000'
  if (dark) {
    return { ink: cardInk, ghost: 'rgba(0,0,0,0.09)', ghostStroke: 'rgba(0,0,0,0.3)' }
  }
  const rgb = hexToRgb(cardInk) ?? { r: 249, g: 176, b: 81 }
  return {
    ink: cardInk,
    ghost: `rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`,
    ghostStroke: `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`,
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export { IMPLEMENT_PART }
