'use client'

// ─── Skill across the ten domains ────────────────────────────────────────────
// One spoke per domain, in that domain's colour, reaching `100 − Top%`. Further
// out is stronger.
//
// Why a radar and not ten bars: the shape is the point. AllSport's whole claim is
// that you should be able to do everything, so a lopsided outline says something
// a sorted bar list does not — and the same outline six months later says whether
// it got rounder. Ten axes is at the top of what a radar can carry, which is
// exactly ten here and will never grow, because there are ten domains.
//
// An unplayed domain sits at the centre rather than being dropped, so the gaps in
// someone's coverage are visible as dents in the shape.

import { DOMAIN_COLORS } from '@/lib/domainColours'
import type { DomainPercentile } from '@/lib/percentile'

const CX = 100
const CY = 100
const MAX_R = 78
const LABEL_R = 96

/** Short enough to sit outside the shape at 10px on a 375px screen. */
const SHORT_NAMES = [
  'STRENGTH', 'CALIS', 'POWER', 'SPEED', 'ANAEROBIC',
  'AEROBIC', 'FLEX', 'BODY', 'COORD', 'AIM',
]

/** Domain i sits at -90° + 36i, so domain 1 is due north and it reads clockwise. */
function angle(i: number): number {
  return ((-90 + 36 * i) * Math.PI) / 180
}

function point(i: number, r: number): [number, number] {
  const a = angle(i)
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function ring(r: number): string {
  return Array.from({ length: 10 }, (_, i) => point(i, r).map(n => n.toFixed(1)).join(',')).join(' ')
}

export type DomainRadarProps = {
  /** One entry per domain the player has anything rated in. Order does not matter. */
  domains: DomainPercentile[]
  /** Outline and fill colour — the accent of the taniwha being built. */
  accent: string
  width?: number
}

export default function DomainRadar({ domains, accent, width = 326 }: DomainRadarProps) {
  const byDomain = new Map(domains.map(d => [d.domainNumber, d]))

  // 0 at the centre for an unrated domain: no data is not the same as no skill,
  // but a dent is the honest picture of a domain you have never played.
  const radii = Array.from({ length: 10 }, (_, i) => {
    const d = byDomain.get(i + 1)
    const skill = d?.topPct == null ? 0 : Math.max(0, Math.min(100, 100 - d.topPct))
    return (skill / 100) * MAX_R
  })

  const shape = radii
    .map((r, i) => point(i, r).map(n => n.toFixed(1)).join(','))
    .join(' ')

  const anchorFor = (i: number): 'start' | 'middle' | 'end' => {
    const [x] = point(i, LABEL_R)
    if (Math.abs(x - CX) < 6) return 'middle'
    return x > CX ? 'start' : 'end'
  }

  return (
    <svg
      viewBox="-32 -24 264 248"
      width={width}
      height={Math.round((width / 264) * 248)}
      style={{ display: 'block', margin: '0 auto' }}
      role="img"
      aria-label="Skill across the ten domains"
    >
      <polygon points={ring(MAX_R)} fill="none" stroke="var(--border)" strokeWidth="1" />
      <polygon points={ring(MAX_R / 2)} fill="none" stroke="var(--border)" strokeWidth="1" />

      {Array.from({ length: 10 }, (_, i) => {
        const [x, y] = point(i, MAX_R)
        return <line key={`s${i}`} x1={CX} y1={CY} x2={x} y2={y} stroke="#1a1a1a" strokeWidth="1" />
      })}

      <polygon
        points={shape}
        fill={`${accent}29`}
        stroke={accent}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {radii.map((r, i) => {
        const [x, y] = point(i, r)
        return <circle key={`v${i}`} cx={x} cy={y} r="3.6" fill={DOMAIN_COLORS[i]} />
      })}

      {SHORT_NAMES.map((name, i) => {
        const [x, y] = point(i, LABEL_R)
        return (
          <text
            key={`l${i}`}
            x={x}
            y={y + 3}
            fill={DOMAIN_COLORS[i]}
            fontFamily="var(--font-label)"
            fontSize="10"
            letterSpacing="0.08em"
            textAnchor={anchorFor(i)}
          >
            {name}
          </text>
        )
      })}
    </svg>
  )
}
