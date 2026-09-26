'use client'

// ─── YOUR COLOURS ────────────────────────────────────────────────────────────
// HOME's colours section, and since the home colours rework (24 September 2026,
// docs/designs/home-colours-rework-spec.md) the ONLY place a player's own colour
// detail lives: the COLOURS tab (/grades) is now a guide with no personal data.
//
// Top to bottom: the overall colour (the average of the ten, capped by games
// played; overallRung), the two actions, one line saying how a domain colour
// is worked out, then the ten domains. Each domain row says how far its next
// colour is and expands to show every event as Event · Your best · Colour.
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
  gradeForRung, gradeInk, overallRung, averageRung, DOMAIN_TOP_EVENTS, GAMES_REQUIRED, MIN_RATED_GAMES,
  type ColourGate,
} from '@/lib/grading'
import { bestScoreLabel, nextDomainColour, shownDomainRungs } from '@/lib/colourDisplay'
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
  const { grades, schemaReady, gates } = state
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const toggle = (n: number) => setOpen(s => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })

  const shownRungs = shownDomainRungs(state)
  const rows = grades.domains.map(d => {
    const gate = gates.find(g => g.domainNumber === d.domainNumber)!
    return { d, gate, shown: shownRungs.get(d.domainNumber) ?? 0 }
  })
  const overall = gradeForRung(overallRung(rows.map(r => r.shown), state.games))
  // The average before the games cap. Above `overall` only when the cap binds.
  const uncapped = averageRung(rows.map(r => r.shown))
  const graded = rows.filter(r => r.shown > 0).length

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '18px 16px 8px', marginBottom: 16,
    }}>
      <span style={{ ...label, fontSize: 12, color: 'var(--text-muted)' }}>Your colours</span>

      {/* ── The overall colour ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, margin: '12px 0 14px',
        padding: '14px', borderRadius: 14, background: '#0b0b0b',
        border: `1px solid ${overall.rung ? `${gradeInk(overall)}55` : 'var(--border)'}`,
      }}>
        <GradeDot grade={overall} size={46} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...label, fontSize: 10.5, color: 'var(--text-muted)' }}>Overall colour</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1, letterSpacing: '0.04em',
            color: overall.rung ? gradeInk(overall) : 'var(--white)', marginTop: 2,
          }}>
            {overall.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>
            {uncapped > overall.rung ? 'The average of your ten domains, capped by games played' : 'The average of your ten domains'} · {graded} of 10 hold a colour
          </div>
          {uncapped > overall.rung && (
            // The games cap is binding: the domains already say more.
            <div style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 3, lineHeight: 1.45 }}>
              Your domains average {gradeForRung(uncapped).name}. {gradeForRung(overall.rung + 1).name} needs{' '}
              {GAMES_REQUIRED[overall.rung + 1]} games, and you have played {state.games}.
            </div>
          )}
        </div>
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
          display: 'block', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5,
          background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 10,
          padding: '9px 11px', marginBottom: 12,
        }}>
          <span style={{ color: 'var(--white)' }}>Lifts and loaded carries need your bodyweight.</span>{' '}
          You are asked at the top of the screen next time you play or train.{' '}
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

      {/* How a domain colour is worked out. Said once, always visible, because
          "3 steps to go" is meaningless to anyone who has not read the guide. */}
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 6 }}>
        Each domain&apos;s colour is <span style={{ color: 'var(--white)' }}>the average of your best {DOMAIN_TOP_EVENTS} events</span> there,
        and an event you have not played counts as Mā, so until six are on the board every new event lifts it. A step is one event
        up one colour. Your overall colour also needs <span style={{ color: 'var(--white)' }}>games</span> played in the room.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(({ d, gate, shown }) => {
          const g = gradeForRung(shown)
          const isOpen = open.has(d.domainNumber)
          const ahead = nextDomainColour(d, shown)
          const next = ahead ? gradeForRung(ahead.next) : null
          // No bar while the colour held sits above the scores: it would read 0% and look broken.
          const showBar = !!ahead && !gate.releasable && !d.blockedByBodyweight && shown <= d.rung
          return (
            <div key={d.domainNumber} style={{ borderTop: '1px solid #181818' }}>
              <button
                type="button"
                onClick={() => toggle(d.domainNumber)}
                aria-expanded={isOpen}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0',
                  background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                <DomainIcon domainName={DOMAIN_NAMES[d.domainNumber - 1]} domainNumber={d.domainNumber} size={30} />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {DOMAIN_NAMES[d.domainNumber - 1]}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                    <NextLine state={state} gate={gate} d={d} shown={shown} />
                  </div>
                  {showBar && (
                    <div aria-hidden style={{ height: 3, borderRadius: 99, background: '#1c1c1c', marginTop: 5, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, width: `${Math.round(ahead!.progress * 100)}%`,
                        background: next!.rainbow ? RAINBOW : next!.inverted ? '#555' : next!.hex,
                      }} />
                    </div>
                  )}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, ...label, fontSize: 12, color: shown ? 'var(--white)' : 'var(--text-muted)' }}>
                  <GradeDot grade={g} /> {g.name}
                </span>
                <span aria-hidden style={{
                  color: '#555', fontSize: 12, flexShrink: 0, width: 12, textAlign: 'center',
                  transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms',
                }}>›</span>
              </button>
              {isOpen && <DomainEvents state={state} domainNumber={d.domainNumber} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** "Next Karaka: 3 steps to go · 4 of 6 events hold a colour", or why there is no next. */
function NextLine({ state, gate, d, shown }: {
  state: GradeState
  gate: ColourGate
  d: GradeState['grades']['domains'][number]
  shown: number
}) {
  if (d.availableCount === 0) return <>Nothing here can be graded for you yet</>
  if (d.blockedByBodyweight) return <>Needs your bodyweight — you are asked when you next play or train a lift</>
  // Earned, and the recheck has not written it yet.
  if (state.schemaReady && gate.releasable) {
    return <span style={{ color: 'var(--green)' }}>{gradeForRung(gate.releasable).name} earned</span>
  }
  const ahead = nextDomainColour(d, shown)
  if (!ahead) return <>The top of the ladder</>
  const next = gradeForRung(ahead.next)
  return (
    <>
      <span style={{ color: 'var(--white)' }}>Next {next.name}:</span>{' '}
      {ahead.steps} step{ahead.steps === 1 ? '' : 's'} to go · {d.counted.length} of {d.slots} events hold a colour
    </>
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
