'use client'

// ─── YOUR COLOURS ────────────────────────────────────────────────────────────
// HOME's colours section, and since the home colours rework (24 September 2026,
// docs/designs/home-colours-rework-spec.md) the ONLY place a player's own colour
// detail lives: the COLOURS tab (/grades) is now a guide with no personal data.
//
// Top to bottom: the overall colour (the average of the ten, overallRung), the
// two actions, one line saying what a unit is, then the ten domains. Each domain
// row names its next colour's three checks in words and expands to show every
// event as Event · Your best · Colour.
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
import { gradeForRung, gradeInk, overallRung, type GradeRung, type ColourGate } from '@/lib/grading'
import { bestScoreLabel, unitLine } from '@/lib/colourDisplay'
import type { GradeState } from '@/lib/loadGrades'

const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')

/** A colour swatch. Uenuku is the rainbow; Taniwha a black dot with a rim. */
export function GradeDot({ grade, size = 12 }: { grade: GradeRung; size?: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background: grade.rainbow ? RAINBOW : grade.hex,
      boxShadow: grade.rung === 0 ? 'inset 0 0 0 1px #444' : grade.inverted ? '0 0 0 1px #555' : 'none',
    }} />
  )
}

const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', fontWeight: 600,
}

const pill = {
  flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 999, ...label, fontSize: 12.5,
}

export default function GradesCard({ state, askBand = false }: { state: GradeState; askBand?: boolean }) {
  const { grades, held, schemaReady, gates } = state
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const toggle = (n: number) => setOpen(s => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })

  const rows = grades.domains.map(d => {
    const gate = gates.find(g => g.domainNumber === d.domainNumber)!
    const shown = schemaReady ? (held.get(d.domainNumber) ?? 0) : d.rung
    return { d, gate, shown }
  })
  const overall = gradeForRung(overallRung(rows.map(r => r.shown)))
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
            The average of your ten domains · {graded} of 10 hold a colour
          </div>
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

      {/* What each domain row counts. Said once, always visible, because
          "2/3 units" is meaningless to anyone who has not read the guide. */}
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 6 }}>
        Each new colour needs <span style={{ color: 'var(--white)' }}>the standard</span> in six of that
        domain&apos;s events, <span style={{ color: 'var(--white)' }}>games</span> played in the room, and{' '}
        <span style={{ color: 'var(--white)' }}>training units</span>. {unitLine()}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(({ d, gate, shown }) => {
          const g = gradeForRung(shown)
          const isOpen = open.has(d.domainNumber)
          const next = gate.next ? gradeForRung(gate.next) : null
          const showBar = schemaReady && !!next && gate.unitsNeeded > 0 && !gate.releasable
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
                    <NextLine state={state} gate={gate} d={d} />
                  </div>
                  {showBar && (
                    <div aria-hidden style={{ height: 3, borderRadius: 99, background: '#1c1c1c', marginTop: 5, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, width: `${Math.min(100, (gate.units / gate.unitsNeeded) * 100)}%`,
                        background: next!.rainbow ? RAINBOW : next!.inverted ? '#555' : next!.hex,
                      }} />
                    </div>
                  )}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, ...label, fontSize: 12, color: shown ? 'var(--white)' : '#555' }}>
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

/** "Next Karaka: ✓ standard · 3/5 games · 2/3 units", or why there is no next. */
function NextLine({ state, gate, d }: {
  state: GradeState
  gate: ColourGate
  d: GradeState['grades']['domains'][number]
}) {
  if (d.availableCount === 0) return <>Nothing here can be graded for you yet</>
  if (!state.schemaReady) {
    const n = d.nextRung ? gradeForRung(d.nextRung) : null
    return <>{n ? `Next ${n.name}: ${d.metAtNextRung} of ${d.required} events at the standard` : 'The top of the ladder'}</>
  }
  if (!gate.next) return <>The top of the ladder</>
  const next = gradeForRung(gate.next)
  if (gate.releasable) return <span style={{ color: 'var(--green)' }}>{next.name} earned</span>
  const check = (ok: boolean, text: string) => (
    <span style={{ color: ok ? 'var(--green)' : undefined, whiteSpace: 'nowrap' }}>{ok ? '✓ ' : ''}{text}</span>
  )
  return (
    <>
      <span style={{ color: 'var(--white)' }}>Next {next.name}:</span>{' '}
      {check(gate.standardsMet, gate.standardsMet ? 'standard' : `standard in ${d.metAtNextRung}/${d.required} events`)}
      {' · '}
      {check(gate.gamesMet, `${Math.min(gate.games, gate.gamesNeeded)}/${gate.gamesNeeded} games`)}
      {/* Kiwikiwi asks for no units, so there is nothing to count. */}
      {gate.unitsNeeded > 0 && <>
        {' · '}
        {check(gate.trainingMet, `${Math.min(Math.floor(gate.units + 1e-6), gate.unitsNeeded)}/${gate.unitsNeeded} units`)}
      </>}
    </>
  )
}

/** Event · Your best · Colour. The best column wraps: tier names run long. */
const COLS = 'minmax(0,1.15fr) minmax(0,1fr) 92px'

/** A domain, opened: every event as Event · Your best · Colour. */
function DomainEvents({ state, domainNumber }: { state: GradeState; domainNumber: number }) {
  const events = EVENTS.filter(e => e.domainNumber === domainNumber)
  const head = { ...label, fontSize: 10, color: '#555' }
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
              ? 'After 10 rated games'
              : !eg.played
                ? 'Not played'
                : null
        return (
          <Link key={e.slug} href={`/events/${e.slug}`} style={{
            display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center',
            padding: '8px 0', borderTop: '1px solid #151515', color: 'inherit', minHeight: 36,
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
            <span style={{ fontSize: 12, color: best ? 'var(--grey-light)' : '#444', textAlign: 'right', lineHeight: 1.35 }}>
              {best ?? '—'}
            </span>
            {why ? (
              <span style={{ fontSize: 11.5, color: '#555' }}>{why}</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...label, fontSize: 11, color: eg.rung ? 'var(--white)' : '#555' }}>
                <GradeDot grade={colour} size={10} /> {colour.name}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
