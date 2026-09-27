'use client'

// ─── YOUR COLOURS ────────────────────────────────────────────────────────────
// HOME's colours section, and since the home colours rework (24 September 2026,
// docs/designs/home-colours-rework-spec.md) the ONLY place a player's own colour
// detail lives: the COLOURS tab (/grades) is a guide with no personal data.
//
// Top to bottom (redesigned with Tāne 2026-09-28): the overall colour's name,
// the thirteen-colour ladder as circles on a track under it, a proud headline
// for that colour and a second line (the climb, or from Kahurangi up the
// population stat), then the ten domains and the best event. Domain rows are
// NOT painted: each carries its icon, six small circles for the best-six
// events its colour averages, and a colour circle beside the colour's name.
// A row expands to show every event as Event · Your best · Colour.
//
// Domain colours are what has been CONFERRED (automatically since
// auto-conferral), or the computed ones on a database without grading. Event
// colours are always computed from the standards: they are how the player gets
// to the next domain colour, not an award.

import { useState } from 'react'
import Link from 'next/link'
import DomainIcon from '@/components/DomainIcon'
import { EVENTS, getEventBySlug } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'
import { RAINBOW_CONIC } from '@/lib/domainColours'
import {
  GRADES, MA, gradeForRung, gradeInk, gradeAccent, averageRung, GAMES_REQUIRED, MIN_RATED_GAMES,
} from '@/lib/grading'
import { bestScoreLabel, colourBlurb, shownDomainRungs, shownOverallRung, topSlotRungs } from '@/lib/colourDisplay'
import { NEUTRAL_ICON_TINT } from '@/lib/scoreColour'
import type { GradeState } from '@/lib/loadGrades'

const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')
const DOMAIN_EVENTS = Array.from({ length: 10 }, (_, i) => EVENTS.filter(e => e.domainNumber === i + 1).map(e => e.slug))

const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', fontWeight: 600,
}

export default function GradesCard({ state, bestEvent = null }: {
  state: GradeState
  /** The event holding the highest colour, from bestEventByColour. */
  bestEvent?: { slug: string; rung: number } | null
}) {
  const { grades } = state
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const toggle = (n: number) => setOpen(s => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })

  const shownRungs = shownDomainRungs(state)
  const rows = grades.domains.map(d => ({ d, shown: shownRungs.get(d.domainNumber) ?? 0 }))
  const overall = gradeForRung(shownOverallRung(state))
  // The average before the games cap. Above `overall` only when the cap binds.
  const uncapped = averageRung(rows.map(r => r.shown))
  const blurb = colourBlurb(overall.rung)
  const unlock = gradeForRung(overall.rung + 1)
  const best = bestEvent ? getEventBySlug(bestEvent.slug) : null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '18px 16px 14px', marginBottom: 16,
    }}>
      <div style={{ ...label, fontSize: 10.5, color: 'var(--text-muted)' }}>Your colour</div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 46, lineHeight: 0.95, letterSpacing: '0.04em',
        color: overall.rung ? gradeInk(overall) : 'var(--white)', marginTop: 2,
      }}>
        {overall.name.toUpperCase()}
      </div>

      <ColourLadder rung={overall.rung} />

      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--white)', marginTop: 12, lineHeight: 1.3 }}>
        {blurb.line}
      </div>
      <div style={{ fontSize: 13, color: 'var(--grey-light)', marginTop: 4 }}>{blurb.sub}</div>
      {uncapped > overall.rung && (
        // The games cap is binding: the domains already say more.
        <div style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 6 }}>
          {unlock.name} unlocks at {GAMES_REQUIRED[overall.rung + 1]} {GAMES_REQUIRED[overall.rung + 1] === 1 ? 'game' : 'games'} · you&apos;ve played {state.games}
        </div>
      )}

      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)' }}>
        {rows.map(({ d, shown }) => {
          const g = gradeForRung(shown)
          const isOpen = open.has(d.domainNumber)
          const slots = topSlotRungs(d, grades.events)
          // Any lift in the domain scored with no bodyweight for its day.
          // Not only d.blockedByBodyweight, which goes false the moment one
          // non-ratio event (Pause Dips, Pause Chinup) grades, while every
          // other lift still scores nothing. The separate bodyweight note is
          // gone from HOME (2026-09-28), so this row is the only place it shows.
          // An exempted lift has left the domain, so it never raises it.
          const needsBodyweight = d.blockedByBodyweight
            || DOMAIN_EVENTS[d.domainNumber - 1].some(slug =>
              !state.exemptions.has(slug) && grades.events.get(slug)?.bodyweightBlocked)
          return (
            <div key={d.domainNumber} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => toggle(d.domainNumber)}
                aria-expanded={isOpen}
                aria-label={`${DOMAIN_NAMES[d.domainNumber - 1]}, ${g.name}${needsBodyweight ? ', needs bodyweight' : slots.length === 0 ? ', nothing to grade' : ''}`}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px',
                  background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer',
                  minHeight: 56,
                }}
              >
                <DomainIcon domainName={DOMAIN_NAMES[d.domainNumber - 1]} domainNumber={d.domainNumber} size={32} tint={NEUTRAL_ICON_TINT} />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {DOMAIN_NAMES[d.domainNumber - 1]}
                  </div>
                  {slots.length === 0 && !needsBodyweight ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Nothing to grade</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 4, marginTop: 6 }}>
                      {/* Your best six events as they stand today. The row's
                          colour is the one held, which never drops, so the two
                          can differ after a score is deleted. An empty circle
                          is a slot still on Mā. */}
                      {slots.length > 0 && (
                        <div aria-hidden style={{ display: 'flex', gap: 5 }}>
                          {slots.map((r, i) => <ColourCircle key={i} rung={r} size={9} />)}
                        </div>
                      )}
                      {needsBodyweight && (
                        // Declared on the scoring screen on the day, so there is
                        // nowhere on HOME to send them: the row just says so.
                        <span style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1 }}>Needs bodyweight</span>
                      )}
                    </div>
                  )}
                </div>
                <span style={{
                  ...label, fontSize: 12.5, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
                  color: shown ? gradeInk(g) : 'var(--text-muted)',
                }}>
                  <ColourCircle rung={shown} size={14} />
                  {g.name}
                </span>
                <span aria-hidden style={{
                  color: 'var(--text-muted)', fontSize: 12, flexShrink: 0, width: 12, textAlign: 'center',
                  transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms',
                }}>›</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 2px 0 44px' }}>
                  <DomainEvents state={state} domainNumber={d.domainNumber} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {best && bestEvent && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          marginTop: 12, fontSize: 12.5, color: 'var(--text-muted)',
        }}>
          <span>Best event: <span style={{ color: 'var(--white)' }}>{best.name}</span></span>
          <span style={{ ...label, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 11.5, color: 'var(--white)' }}>
            <ColourCircle rung={bestEvent.rung} size={10} /> {gradeForRung(bestEvent.rung).name}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * One colour as a circle. Reached: solid (Uenuku the rainbow, Taniwha black
 * with a white rim so it does not vanish on the card). Not reached: a ring in
 * its OWN colour, in its readable ink and at full strength, so the colours
 * ahead stay easy to see rather than a dim grey.
 * Mā standing for "no colour yet" is an empty grey outline; on the ladder,
 * where it is a rung, it is solid white.
 */
function ColourCircle({ rung, size, reached = true, ma = 'empty' }: {
  rung: number; size: number; reached?: boolean; ma?: 'empty' | 'white'
}) {
  const g = gradeForRung(rung)
  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'block', boxSizing: 'border-box' as const,
  }
  if (g.rung === 0 && ma === 'empty') {
    return <span data-colour="empty" style={{ ...base, background: 'transparent', border: '1.5px solid var(--grey)' }} />
  }
  if (!reached) {
    if (g.rainbow) {
      return <span data-colour="ahead" style={{
        ...base,
        background: `radial-gradient(circle, var(--surface) 52%, transparent 54%), ${RAINBOW_CONIC}`,
      }} />
    }
    if (g.inverted) {
      return <span data-colour="ahead" style={{ ...base, background: '#000', border: '1.5px dashed #9a9a9a' }} />
    }
    return <span data-colour="ahead" style={{ ...base, background: 'var(--surface)', border: `2px solid ${gradeInk(g)}` }} />
  }
  return <span data-colour="reached" style={{
    ...base,
    background: g.rainbow ? RAINBOW_CONIC : g.hex,
    border: g.inverted ? '1.5px solid #fff' : 'none',
  }} />
}

/**
 * The whole ladder, Mā to Taniwha, as circles on a track: reached colours
 * solid, the rest rings in their own colour, yours bigger and ringed. Thirteen
 * equal columns, so each circle's centre sits at (i + 0.5) / 13 and the filled
 * track can end exactly on the current colour.
 */
function ColourLadder({ rung }: { rung: number }) {
  const ladder = [MA, ...GRADES]
  const n = ladder.length
  const centre = (i: number) => `${((i + 0.5) / n) * 100}%`
  const stops = ladder.slice(0, rung + 1).map(g => (g.rung === 0 ? '#ffffff' : gradeAccent(g)))
  const current = gradeForRung(rung)
  const ring = current.rung === 0 ? '#ffffff' : gradeAccent(current)
  return (
    <div role="img" aria-label={`Colour ${rung + 1} of ${n}: ${current.name}`} style={{ marginTop: 14 }}>
      <div style={{ position: 'relative', height: 28 }}>
        <div style={{
          position: 'absolute', top: '50%', height: 3, transform: 'translateY(-50%)', borderRadius: 3,
          left: centre(0), right: centre(0), background: 'var(--border-strong)',
        }} />
        {rung > 0 && (
          <div data-ladder-fill style={{
            position: 'absolute', top: '50%', height: 3, transform: 'translateY(-50%)', borderRadius: 3,
            left: centre(0), width: `${(rung / n) * 100}%`,
            background: `linear-gradient(90deg, ${stops.join(', ')})`,
          }} />
        )}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, height: '100%' }}>
          {ladder.map(g => (
            <div key={g.rung} data-rung={g.rung} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {g.rung === rung ? (
                // 18px plus a 4px ring is 26px across. At 320px the card's
                // content is about 254px, so a column is about 19.5px and a
                // 12px neighbour's edge sits 13.5px from this centre: clear.
                
                <span style={{ borderRadius: '50%', boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${ring}` }}>
                  <ColourCircle rung={g.rung} size={18} ma="white" />
                </span>
              ) : (
                <ColourCircle rung={g.rung} size={12} reached={g.rung < rung} ma="white" />
              )}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 6,
        ...label, fontSize: 10, color: 'var(--text-muted)',
      }}>
        <span>{MA.name}</span><span>{GRADES[GRADES.length - 1].name}</span>
      </div>
    </div>
  )
}

/** Event · Your best · Colour. The best column wraps: tier names run long. */
const COLS = 'minmax(0,1.15fr) minmax(0,1fr) 92px'

/** A domain, opened: every event as Event · Your best · Colour. */
function DomainEvents({ state, domainNumber }: { state: GradeState; domainNumber: number }) {
  const events = EVENTS.filter(e => e.domainNumber === domainNumber)
  const head = { ...label, fontSize: 10, color: 'var(--text-muted)' }
  return (
    <div style={{ padding: '0 0 10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '2px 0 6px' }}>
        <span style={head}>Event</span>
        <span style={{ ...head, textAlign: 'right' }}>Your best</span>
        <span style={head}>Colour</span>
      </div>
      {events.map(e => {
        const eg = state.grades.events.get(e.slug)
        if (!eg) return null
        const waiting = state.disputed.get(e.name) ?? 0
        const colour = gradeForRung(eg.rung)
        const best = eg.played ? bestScoreLabel(eg) : null
        // bodyweightBlocked, not !gradeable: a lift with no declared bodyweight
        // still COUNTS (as unmet), it just has no number to be graded against.
        const why = state.exemptions.has(e.slug)
          ? 'Exempt'
          : eg.bodyweightBlocked
            ? 'Needs bodyweight'
            : STANDARDS[e.slug]?.kind === 'rating' && eg.rung === 0
              ? `After ${MIN_RATED_GAMES} rated games`
              : !eg.played
                ? 'Not played'
                : null
        return (
          <Link key={e.slug} href={`/events/${e.slug}`} style={{
            display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center',
            padding: '8px 0', borderTop: '1px solid var(--border)', color: 'inherit', minHeight: 44,
          }}>
            <span style={{ fontSize: 13, color: eg.played ? 'var(--white)' : 'var(--text-muted)', minWidth: 0 }}>
              {e.name}
              {waiting > 0 && (
                // A disputed game counts for nothing until settled, so a player
                // stuck short of ten games can see why.
                <span style={{ display: 'block', fontSize: 12, color: 'var(--amber)', marginTop: 1 }}>
                  {waiting} disputed game{waiting > 1 ? 's' : ''} waiting for a kaiwhakawā
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, color: best ? 'var(--grey-light)' : 'var(--text-muted)', textAlign: 'right', lineHeight: 1.35 }}>
              {best ?? '—'}
            </span>
            {why ? (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{why}</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...label, fontSize: 11, color: eg.rung ? 'var(--white)' : 'var(--text-muted)' }}>
                <ColourCircle rung={colour.rung} size={10} /> {colour.name}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
