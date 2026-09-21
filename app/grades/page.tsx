'use client'

// ─── Colours, in full ────────────────────────────────────────────────────────
// Every domain and every event: the colour each event gives today, and what
// holds a domain back. The dashboard card is the summary; this is the detail.
// Honours the family switcher like every other stats page.
//
// Colours a kaiwhakawā has conferred are the ones a player HOLDS (decision 9).
// Event colours here are always computed from the standards: they are how the
// player gets to the next one, not an award.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EVENTS } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'
import { gradeForRung, AGE_SHIFT, type ColourGate } from '@/lib/grading'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import { loadGradeState, type GradeState } from '@/lib/loadGrades'
import { unitRulesSummary } from '@/lib/units'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import DomainIcon from '@/components/DomainIcon'
import { GradeDot } from '@/components/GradesCard'

const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')

const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', fontWeight: 600,
}

const BAND_WORDS: Record<string, string> = {
  U12: 'under 14', U14: 'under 14', U16: '14 to 16', Open: 'Open', Masters: 'Masters', Grandmaster: 'Grandmaster',
}

export default function GradesPage() {
  const router = useRouter()
  const { loading, userId, activePlayerId, activePlayer } = useActivePlayer()
  // Keyed by the player it was loaded for, so switching players shows nothing
  // until that player's grades arrive, without resetting state in the effect.
  const [loaded, setLoaded] = useState<{ id: string; state: GradeState | null } | null>(null)
  const state = loaded && loaded.id === activePlayerId ? loaded.state : null

  useEffect(() => {
    if (!loading && !userId) router.push('/play')
  }, [loading, userId, router])

  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    loadGradeState(activePlayerId).then(s => { if (!cancelled) setLoaded({ id: activePlayerId, state: s }) })
    return () => { cancelled = true }
  }, [activePlayerId])

  if (loading || !activePlayer) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading…</div>
  }

  const shift = state ? AGE_SHIFT[state.grades.band] : 0

  return (
    <>
      <PlayerTabs />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 16px 48px', color: 'var(--white)' }}>
        <ViewingAsBanner />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '8px 0 6px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1, margin: 0, letterSpacing: '0.03em' }}>
            COLOURS
          </h1>
          {/* Logging is how a player moves a domain between games, so it lives
              on the page that shows what each domain still needs. */}
          <Link href="/workout/new" style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 16px',
            borderRadius: 999, background: 'var(--purple)', color: '#0a0a0a',
            ...label, fontSize: 13,
          }}>
            + Log a workout
          </Link>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 16px' }}>
          {playerLabel(activePlayer)} holds a colour in each domain: the highest colour met in at least six of
          that domain&apos;s events. The overall colour is the lowest of the ten, so it is only as strong as
          the domain you train least.
          {shift > 0 && <> As {BAND_WORDS[state!.grades.band]}, every standard is shifted {shift} colour{shift > 1 ? 's' : ''} in your favour.</>}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 16px' }}>
          Each new colour also needs <span style={{ color: 'var(--white)' }}>games</span>, played in the room, and{' '}
          <span style={{ color: 'var(--white)' }}>training</span> in that domain since your last colour there. Game scores
          count toward both; so does anything you <Link href="/workout/new" style={{ color: 'var(--purple)' }}>log between games</Link>.
        </p>

        {/* "3 of 5 units" is counted on every domain below, so the word is
            defined here rather than only on How To Play, which a signed-in
            player never goes back to. */}
        <details style={{
          background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 12,
          padding: '10px 13px', marginBottom: 16, fontSize: 13.5, color: 'var(--text-muted)',
        }}>
          <summary style={{ cursor: 'pointer', color: 'var(--white)', ...label, fontSize: 12 }}>What is a unit?</summary>
          <p style={{ margin: '8px 0 6px', lineHeight: 1.55 }}>
            A unit is one piece of training in an event. Any effort counts; there is no intensity floor.
          </p>
          {unitRulesSummary().map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '1px solid #181818' }}>
              <span style={{ color: 'var(--grey-light)' }}>{r.label}</span>
              <span style={{ textAlign: 'right' }}>{r.rule}</span>
            </div>
          ))}
        </details>

        {state && !state.hasBand && !/Junior|Youth/.test(activePlayer.division ?? '') && (
          <Link href="/profile" style={{
            display: 'block', background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 12,
            padding: '11px 13px', marginBottom: 16, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5,
          }}>
            <span style={{ color: 'var(--white)' }}>Lifts and loaded carries are not graded yet.</span> They are measured
            against your bodyweight band, which you have not set. <span style={{ color: 'var(--blue)' }}>Set it on your profile →</span>
          </Link>
        )}

        {!state ? (
          <div style={{ color: '#555', padding: '40px 0', textAlign: 'center' }}>Working out your colours…</div>
        ) : state.grades.domains.map(d => {
          const held = state.held.get(d.domainNumber) ?? 0
          const shown = state.schemaReady ? held : d.rung
          const g = gradeForRung(shown)
          const events = EVENTS.filter(e => e.domainNumber === d.domainNumber)
          return (
            <section key={d.domainNumber} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
              padding: '14px 14px 6px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6 }}>
                <DomainIcon domainName={DOMAIN_NAMES[d.domainNumber - 1]} domainNumber={d.domainNumber} size={34} />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, letterSpacing: '0.03em', lineHeight: 1.05 }}>
                    {d.domainNumber}. {DOMAIN_NAMES[d.domainNumber - 1].toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {d.availableCount === 0
                      ? 'Nothing here can be graded for you yet'
                      : `${d.required} of ${d.availableCount} events must meet a colour to hold it`}
                  </div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, ...label, fontSize: 12.5, color: shown ? 'var(--white)' : '#555' }}>
                  <GradeDot grade={g} size={14} /> {g.name}
                </span>
              </div>
              {state.schemaReady && <GateRow gate={state.gates.find(g => g.domainNumber === d.domainNumber)!} />}

              {events.map(e => {
                const eg = state.grades.events.get(e.slug)!
                const waiting = state.disputed.get(e.name) ?? 0
                const eventColour = gradeForRung(eg.rung)
                const why = state.exemptions.has(e.slug)
                  ? 'Exempt, confirmed by a kaiwhakawā'
                  : !eg.gradeable
                    ? 'Needs a bodyweight band'
                    : STANDARDS[e.slug]?.kind === 'rating' && eg.rung === 0
                      ? 'Graded by head-to-head rating, after ten games'
                      : !eg.played
                        ? 'Not played yet'
                        : eg.rung === 0
                          ? 'Below Kiwikiwi'
                          : null
                return (
                  <Link key={e.slug} href={`/events/${e.slug}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px',
                    borderTop: '1px solid #181818', color: 'inherit',
                  }}>
                    <span style={{ flexGrow: 1, minWidth: 0, fontSize: 14, color: why ? 'var(--text-muted)' : 'var(--white)' }}>
                      {e.name}
                      {waiting > 0 && (
                        // A disputed game counts for nothing until settled, so a
                        // player stuck short of ten games can see why.
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--amber)', marginTop: 2 }}>
                          {waiting} disputed game{waiting > 1 ? 's' : ''} waiting for a kaiwhakawā
                        </span>
                      )}
                    </span>
                    {why ? (
                      <span style={{ fontSize: 12, color: '#555', textAlign: 'right' }}>{why}</span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, ...label, fontSize: 11.5 }}>
                        <GradeDot grade={eventColour} size={10} /> {eventColour.name}
                      </span>
                    )}
                  </Link>
                )
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}

/** The three gates on a domain's next colour, each ticked or counted. */
function GateRow({ gate }: { gate: ColourGate }) {
  if (!gate.next) return null
  const next = gradeForRung(gate.next)
  const item = (ok: boolean, text: string) => (
    <span style={{ color: ok ? 'var(--green)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ok ? '✓' : '○'} {text}</span>
  )
  return (
    <div style={{ fontSize: 12.5, margin: '2px 0 8px', lineHeight: 1.6 }}>
      <div style={{ color: gate.releasable ? 'var(--green)' : 'var(--white)', marginBottom: 2 }}>
        {gate.releasable ? `${next.name} is ready: a kaiwhakawā confirms it.` : `Toward ${next.name}`}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
        {item(gate.standardsMet, 'Standards')}
        {item(gate.gamesMet, `${Math.min(gate.games, gate.gamesNeeded)} of ${gate.gamesNeeded} games`)}
        {item(gate.trainingMet, `${Math.min(Math.floor(gate.units), gate.unitsNeeded)} of ${gate.unitsNeeded} units`)}
      </div>
    </div>
  )
}
