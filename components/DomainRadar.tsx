'use client'

// ─── Colours across the ten domains ──────────────────────────────────────────
// One spoke per domain, reaching the colour HELD there and drawn in it. Twelve
// rings, one per colour, Kiwikiwi at the centre to Taniwha on the edge, each
// faintly tinted, so a player can see how far every domain is from Taniwha.
//
// It spoke Top % until the home colours rework (24 September 2026,
// docs/designs/home-colours-rework-spec.md). Colours are the one progression
// system now, so the radar and the list above it tell the same story.
//
// Why a radar and not ten bars: the shape is the point. AllSport's whole claim
// is that you should be able to do everything, so a lopsided outline says
// something a sorted list does not, and the same outline six months later says
// whether it got rounder. A domain on Mā sits at the centre rather than being
// dropped, so a gap is a visible dent.

import { GRADES, TOP_RUNG, gradeForRung, gradeInk } from '@/lib/grading'
import { RAINBOW_STOPS } from '@/lib/domainColours'
import { GradeDot } from '@/components/GradeDot'

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

/** Radius of a colour: rung 0 (Mā) at the centre, Taniwha on the edge. */
export function radiusFor(rung: number): number {
  return (Math.max(0, Math.min(TOP_RUNG, rung)) / TOP_RUNG) * MAX_R
}

/** A colour's stroke on a dark page. Taniwha is black, so it draws white. */
function ink(rung: number): string {
  const g = gradeForRung(rung)
  return g.rainbow ? 'url(#radar-rainbow)' : gradeInk(g)
}

export type DomainRadarProps = {
  /** Domain number -> colour rung held. Missing = Mā. */
  held: ReadonlyMap<number, number>
  width?: number
}

export default function DomainRadar({ held, width = 326 }: DomainRadarProps) {
  const rungs = Array.from({ length: 10 }, (_, i) => held.get(i + 1) ?? 0)
  const shape = rungs.map((r, i) => point(i, radiusFor(r)).map(n => n.toFixed(1)).join(',')).join(' ')

  const anchorFor = (i: number): 'start' | 'middle' | 'end' => {
    const [x] = point(i, LABEL_R)
    if (Math.abs(x - CX) < 6) return 'middle'
    return x > CX ? 'start' : 'end'
  }

  return (
    <div>
      <svg
        viewBox="-32 -24 264 248"
        width={width}
        height={Math.round((width / 264) * 248)}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
        role="img"
        aria-label={`Colours across the ten domains: ${rungs.map((r, i) => `${SHORT_NAMES[i].toLowerCase()} ${gradeForRung(r).name}`).join(', ')}`}
      >
        <defs>
          {/* userSpaceOnUse, not the default bounding box: a due-north or
              due-south spoke is a vertical line with zero width, and a
              bounding-box gradient on it paints nothing at all. */}
          <linearGradient id="radar-rainbow" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200">
            {RAINBOW_STOPS.map((c, i) => (
              <stop key={c} offset={`${(i / (RAINBOW_STOPS.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>

        {/* One ring per colour, tinted faintly in it. Taniwha, the edge, is the
            one ring drawn solid, because it is the goal. */}
        {GRADES.map(g => (
          <polygon
            key={g.rung}
            points={ring(radiusFor(g.rung))}
            fill="none"
            stroke={g.rung === TOP_RUNG ? '#bbbbbb' : g.rainbow ? 'url(#radar-rainbow)' : g.hex}
            strokeOpacity={g.rung === TOP_RUNG ? 0.6 : 0.4}
            strokeWidth={g.rung === TOP_RUNG ? 1.2 : 0.9}
          />
        ))}

        {Array.from({ length: 10 }, (_, i) => {
          const [x, y] = point(i, MAX_R)
          return <line key={`s${i}`} x1={CX} y1={CY} x2={x} y2={y} stroke="#1a1a1a" strokeWidth="1" />
        })}

        <polygon points={shape} fill="#ffffff0f" stroke="#ffffff55" strokeWidth="1.2" strokeLinejoin="round" />

        {/* Each domain's spoke in the colour it holds. */}
        {rungs.map((r, i) => {
          if (r <= 0) return null
          const [x, y] = point(i, radiusFor(r))
          return <line key={`c${i}`} x1={CX} y1={CY} x2={x} y2={y} stroke={ink(r)} strokeWidth="3" strokeLinecap="round" />
        })}
        {rungs.map((r, i) => {
          const [x, y] = point(i, radiusFor(r))
          return (
            <circle key={`v${i}`} cx={x} cy={y} r="4"
              fill={r > 0 ? ink(r) : '#0a0a0a'}
              stroke={gradeForRung(r).inverted ? '#ffffff' : r > 0 ? 'none' : '#555'}
              strokeWidth="1.2" />
          )
        })}

        <text x={CX + 3} y={CY - MAX_R - 3} fill="#bbbbbb" fontFamily="var(--font-label)" fontSize="6.5" letterSpacing="0.1em">
          TANIWHA
        </text>

        {SHORT_NAMES.map((name, i) => {
          const [x, y] = point(i, LABEL_R)
          return (
            <text key={`l${i}`} x={x} y={y + 3} fill="#8a8a8a" fontFamily="var(--font-label)"
              fontSize="10" letterSpacing="0.08em" textAnchor={anchorFor(i)}>
              {name}
            </text>
          )
        })}
      </svg>

      {/* The ring key: Mā at the centre, one dot per ring, Taniwha the edge. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--font-label)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Mā
        </span>
        <span style={{ display: 'inline-flex', gap: 3 }} aria-hidden>
          {GRADES.map(g => <GradeDot key={g.rung} grade={g} size={9} />)}
        </span>
        <span style={{ fontFamily: 'var(--font-label)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Taniwha
        </span>
      </div>
    </div>
  )
}
