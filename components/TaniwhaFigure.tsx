'use client'

// ─── The taniwha, assembling ─────────────────────────────────────────────────
// Ten limbs as ten discrete shapes: earned solid, the one under construction
// dashed, the rest ghosted. The whole point of the grading system is that you
// can SEE the creature come together, so a progress bar will not do.
//
// ⚠ THIS GEOMETRY IS FILLER. Tāne is drawing the twelve in Canva, ten
// registered layers each, to be exported as /taniwha/{slug}/{limb}.png and
// rendered through the same CSS-mask pipeline as EventIcon — see
// `partAssetSrc()` in lib/taniwha.ts, which already returns those paths. Swapping
// this file's <path>s for masked layers is the whole of that change; nothing
// else needs to know.
//
// All ten layers of a taniwha MUST be exported on the same canvas with the same
// registration, or they will not line up when stacked.

import { PARTS, CROWN_PART, type Taniwha } from '@/lib/taniwha'

/**
 * Limb geometry, keyed by part number so it matches PARTS exactly. Drawn on a
 * 165×150 canvas, side-on, facing left. Order here is PAINT order (back to
 * front), which is not award order — the tail sits behind the body, the crown
 * above the head.
 */
const SHAPES: Record<number, { d?: string; ellipse?: { cx: number; cy: number; rx: number; ry: number } }> = {
  10: { d: 'M34,20 L40,6 L48,15 L56,4 L63,20 Z' },              // Tikitiki  crown
  9:  { d: 'M30,37 L13,43 L15,50 L32,44 Z' },                    // Arero     tongue
  4:  { d: 'M112,76 Q142,64 154,38 Q146,74 118,94 Z' },          // Hiku      tail
  1:  { ellipse: { cx: 80, cy: 78, rx: 34, ry: 25 } },           // Tinana    body
  2:  { d: 'M58,70 L45,45 L60,37 L71,62 Z' },                    // Kakī      neck
  3:  { ellipse: { cx: 48, cy: 32, rx: 20, ry: 15 } },           // Pane      head
  5:  { d: 'M60,94 L48,119 L60,125 L72,100 Z' },                 // Ringa mauī
  6:  { d: 'M78,100 L74,125 L86,128 L92,104 Z' },                // Ringa matau
  7:  { d: 'M96,98 L96,125 L108,125 L106,98 Z' },                // Waewae mauī
  8:  { d: 'M108,94 L115,121 L127,117 L118,92 Z' },              // Waewae matau
}

/** Back to front. */
const PAINT_ORDER = [10, 9, 4, 1, 2, 3, 5, 6, 7, 8]

export type TaniwhaFigureProps = {
  taniwha: Taniwha
  /** 0–10. The tenth is the crown and only fills when the crown is held. */
  limbsEarned: number
  /** Solid fill for earned limbs — the card's ink, not always the accent. */
  ink: string
  /** Ghost fill for locked limbs, as an rgba string. */
  ghost: string
  /** Ghost stroke for locked limbs. */
  ghostStroke: string
  width?: number
  /** Hide the eye — used on the small figures where it reads as noise. */
  showEye?: boolean
}

export default function TaniwhaFigure({
  taniwha, limbsEarned, ink, ghost, ghostStroke, width = 150, showEye = true,
}: TaniwhaFigureProps) {
  // The crown is limb 10 and is earned by an ACT, never bought, so a player on
  // nine limbs has a complete body and no crown — `building` must not point at
  // it as if the next 1,000 points would fill it.
  const building = limbsEarned < PARTS.length - 1 ? limbsEarned + 1 : null
  const headEarned = limbsEarned >= 3

  return (
    <svg
      viewBox="0 0 165 150"
      width={width}
      height={Math.round((width / 165) * 150)}
      style={{ flexShrink: 0, display: 'block' }}
      role="img"
      aria-label={`${taniwha.name}, ${limbsEarned} of ${PARTS.length} limbs`}
    >
      {PAINT_ORDER.map(n => {
        const shape = SHAPES[n]
        const earned = n <= limbsEarned && n !== CROWN_PART
        const crowned = n === CROWN_PART && limbsEarned >= CROWN_PART
        const isBuilding = n === building

        const fill = earned || crowned ? ink : ghost
        const stroke = isBuilding ? ink : earned || crowned ? undefined : ghostStroke
        const strokeWidth = isBuilding ? 1.6 : stroke ? 1 : undefined
        const dash = isBuilding ? '3 2.5' : stroke ? '2 2' : undefined
        const buildFill = isBuilding ? ghost : fill

        const common = {
          fill: buildFill,
          stroke,
          strokeWidth,
          strokeDasharray: dash,
        }

        return shape.ellipse
          ? <ellipse key={n} {...shape.ellipse} {...common} />
          : <path key={n} d={shape.d} {...common} />
      })}

      {showEye && headEarned && (
        <circle cx="42" cy="28" r="2.6" fill={taniwha.inverted ? '#F2F2F2' : '#000000'} />
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
