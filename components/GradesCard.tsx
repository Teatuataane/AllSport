'use client'

// ─── YOUR COLOURS ────────────────────────────────────────────────────────────
// HOME's colours section, and since the home colours rework (24 September 2026,
// docs/designs/home-colours-rework-spec.md) the ONLY place a player's own colour
// detail lives: the COLOURS tab (/grades) is now a guide with no personal data.
//
// Top to bottom (layout settled with Tāne 2026-09-27): the thirteen-colour
// ladder with the overall colour marked, the overall colour's name with what
// it means (a punchy line and a population stat, colourBlurb), the two
// actions, then the ten domains. Very little text on purpose: each domain row
// is painted in its colour the way the game screen paints a scored button,
// and six squares show the best-six events that colour is the average of.
// A row expands to show every event as Event · Your best · Colour.
//
// Domain colours are what has been CONFERRED (automatically since
// auto-conferral). Before the grading migration lands nothing can be conferred,
// so the card shows the computed colours and says they are provisional. Event
// colours are always computed from the standards: they are how the player gets
// to the next domain colour, not an award.

import { useState } from 'react'
import Link from 'next/link'
import DomainIcon from '@/components/DomainIcon'
import { EVENTS } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'
import { RAINBOW } from '@/lib/domainColours'
import {
  GRADES, MA, gradeForRung, gradeInk, overallRung, averageRung, GAMES_REQUIRED, MIN_RATED_GAMES,
} from '@/lib/grading'
import { bestScoreLabel, colourBlurb, shownDomainRungs, topSlotRungs } from '@/lib/colourDisplay'
import { NEUTRAL_ICON_TINT, rungPaint } from '@/lib/scoreColour'
import { GradeDot } from '@/components/GradeDot'
import type { GradeState } from '@/lib/loadGrades'

const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')


const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', fontWeight: 600,
}

const pill = {
  flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 999, ...label, fontSize: 12.5,
}

export default function GradesCard({ state, askBand = false }: { state: GradeState; askBand?: boolean }) {
  const { grades, schemaReady } = state
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const toggle = (n: number) => setOpen(s => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })

  const shownRungs = shownDomainRungs(state)
  const rows = grades.domains.map(d => ({ d, shown: shownRungs.get(d.domainNumber) ?? 0 }))
  const overall = gradeForRung(overallRung(rows.map(r => r.shown), state.games))
  // The average before the games cap. Above `overall` only when the cap binds.
  const uncapped = averageRung(rows.map(r => r.shown))
  const blurb = colourBlurb(overall.rung)
  const unlock = gradeForRung(overall.rung + 1)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '18px 16px 14px', marginBottom: 16,
    }}>
      {/* ── The ladder, and where the overall colour sits on it ─────────── */}
      <ColourLadder rung={overall.rung} />

      <div style={{ margin: '14px 0 16px' }}>
        <div style={{ ...label, fontSize: 10.5, color: 'var(--text-muted)' }}>Overall colour</div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 38, lineHeight: 1, letterSpacing: '0.04em',
          color: overall.rung ? gradeInk(overall) : 'var(--white)', marginTop: 2,
        }}>
          {overall.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 15, color: 'var(--white)', marginTop: 6, lineHeight: 1.35 }}>{blurb.line}</div>
        {blurb.stat && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{blurb.stat}</div>
        )}
        {uncapped > overall.rung && (
          // The games cap is binding: the domains already say more.
          <div style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 6 }}>
            {unlock.name} unlocks at {GAMES_REQUIRED[overall.rung + 1]} {GAMES_REQUIRED[overall.rung + 1] === 1 ? 'game' : 'games'} · you&apos;ve played {state.games}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Link href="/workout/new" style={{ ...pill, background: 'var(--purple)', color: '#0a0a0a' }}>
          + Log a workout
        </Link>
        <Link href="/grades" style={{ ...pill, border: '1px solid var(--border-strong)', color: 'var(--white)' }}>
          Colours guide →
        </Link>
      </div>

      {/* Strength is graded against a bodyweight nothing else asks for. It is
          DECLARED on the scoring screen, not on /profile, so this points at
          somewhere they can actually do it. */}
      {askBand && !state.hasBand && (
        <Link href="/workout/new" style={{
          display: 'block', fontSize: 12.5, color: 'var(--text-muted)',
          background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 10,
          padding: '9px 11px', marginBottom: 12,
        }}>
          <span style={{ color: 'var(--white)' }}>Lifts need your bodyweight</span> ·{' '}
          <span style={{ color: 'var(--blue)' }}>Start a workout →</span>
        </Link>
      )}

      {!schemaReady && (
        <div style={{
          fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5,
          background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 10,
          padding: '9px 11px', marginBottom: 12,
        }}>
          Provisional: worked out from your scores. Colours are recorded once grading goes live.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ d, shown }) => {
          const g = gradeForRung(shown)
          // Painted like a scored button on the game screen. Mā has no paint.
          const paint = rungPaint(shown)
          const isOpen = open.has(d.domainNumber)
          const slots = topSlotRungs(d, grades.events)
          // A colour held from before outranks the notice: the row already
          // has a colour, so it shows the squares instead.
          const needsBodyweight = d.blockedByBodyweight && shown === 0
          return (
            <div key={d.domainNumber} style={{
              borderRadius: 12,
              background: paint ? paint.background : '#0d0d0d',
              border: paint ? paint.border : '1.5px solid var(--border)',
            }}>
              <button
                type="button"
                onClick={() => toggle(d.domainNumber)}
                aria-expanded={isOpen}
                aria-label={`${DOMAIN_NAMES[d.domainNumber - 1]}, ${g.name}${needsBodyweight ? ', needs bodyweight' : slots.length === 0 ? ', nothing to grade' : ''}`}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
                  background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer',
                  minHeight: 52,
                }}
              >
                <DomainIcon domainName={DOMAIN_NAMES[d.domainNumber - 1]} domainNumber={d.domainNumber} size={30} tint={NEUTRAL_ICON_TINT} />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {DOMAIN_NAMES[d.domainNumber - 1]}
                  </div>
                  {needsBodyweight ? (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Needs bodyweight</div>
                  ) : slots.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Nothing to grade</div>
                  ) : (
                    // Your best six events as they stand today. The row's
                    // colour is the one held, which never drops, so the two
                    // can differ after a score is deleted. An empty square is
                    // a slot still on Mā.
                    <div aria-hidden style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                      {slots.map((r, i) => <Swatch key={i} rung={r} width={14} height={14} radius={3} />)}
                    </div>
                  )}
                </div>
                <span style={{ ...label, fontSize: 12.5, flexShrink: 0, color: paint ? paint.ink : 'var(--text-muted)' }}>
                  {g.name}
                </span>
                <span aria-hidden style={{
                  color: 'var(--text-muted)', fontSize: 12, flexShrink: 0, width: 12, textAlign: 'center',
                  transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms',
                }}>›</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 12px' }}>
                  <DomainEvents state={state} domainNumber={d.domainNumber} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * One colour as a filled shape. Mā is an empty outline when it stands for "no
 * colour yet", and solid white on the ladder where it is a rung; Uenuku the
 * rainbow; Taniwha black with a white rim so it does not vanish on the card.
 */
function Swatch({ rung, width, height, radius, ma = 'empty' }: {
  rung: number; width: number | string; height: number; radius: number; ma?: 'empty' | 'white'
}) {
  const g = gradeForRung(rung)
  const empty = g.rung === 0 && ma === 'empty'
  return (
    <span style={{
      width, height, borderRadius: radius, flexShrink: 0, display: 'block', boxSizing: 'border-box',
      background: empty ? 'transparent' : g.rainbow ? RAINBOW : g.hex,
      border: empty ? '1.5px solid var(--grey)' : g.inverted ? '1.5px solid #fff' : 'none',
    }} />
  )
}

/** The whole ladder, Mā to Taniwha: reached colours solid, the rest dimmed, yours raised and marked. */
function ColourLadder({ rung }: { rung: number }) {
  const ladder = [MA, ...GRADES]
  return (
    <div role="img" aria-label={`Colour ${rung + 1} of ${ladder.length}: ${gradeForRung(rung).name}`}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
        {ladder.map(g => (
          <div key={g.rung} style={{ flex: 1, minWidth: 0, opacity: g.rung <= rung ? 1 : 0.25 }}>
            <Swatch rung={g.rung} width="100%" height={g.rung === rung ? 16 : 10} radius={3} ma="white" />
          </div>
        ))}
      </div>
      <div aria-hidden style={{ display: 'flex', gap: 3, marginTop: 3 }}>
        {ladder.map(g => (
          <div key={g.rung} style={{ flex: 1, textAlign: 'center', fontSize: 9, lineHeight: 1, color: 'var(--white)' }}>
            {g.rung === rung ? '▲' : ''}
          </div>
        ))}
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
            padding: '8px 0', borderTop: '1px solid #151515', color: 'inherit', minHeight: 44,
          }}>
            <span style={{ fontSize: 13, color: eg.played ? 'var(--white)' : 'var(--text-muted)', minWidth: 0 }}>
              {e.name}
              {waiting > 0 && (
                // A disputed game counts for nothing until settled, so a player
                // stuck short of ten games can see why.
                <span style={{ display: 'block', fontSize: 11, color: 'var(--amber)', marginTop: 1 }}>
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
                <GradeDot grade={colour} size={10} /> {colour.name}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
