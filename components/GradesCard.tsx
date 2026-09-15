'use client'

// ─── The grades card ─────────────────────────────────────────────────────────
// The dashboard's centrepiece since the grading rebuild: a colour in each of the
// ten domains, and the overall colour once all ten hold one (decision 10 — the
// ten lead; the overall appears only when it means something).
//
// What a player sees is what a kaiwhakawā has CONFERRED (decision 9). Each
// domain's next colour needs three things (workout logging, September 2026):
// the standards, the games quota and training units in that domain. The row
// says which is missing, and a thin bar shows the training toward it. Before
// the grading migration lands nothing can be conferred, so the card shows the
// computed colours and says they are provisional.

import Link from 'next/link'
import DomainIcon from '@/components/DomainIcon'
import { EVENTS } from '@/lib/eventData'
import { RAINBOW } from '@/lib/domainColours'
import { gradeForRung, type GradeRung } from '@/lib/grading'
import { shownRung, gateBlocker } from '@/lib/playerGrades'
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

export default function GradesCard({ state }: { state: GradeState }) {
  const { grades, held, schemaReady, gates } = state
  const rows = grades.domains.map(d => {
    const gate = gates.find(g => g.domainNumber === d.domainNumber)!
    const shown = schemaReady ? (held.get(d.domainNumber) ?? 0) : d.rung
    return { d, gate, shown, ready: schemaReady && gate.releasable > 0 }
  })
  const heldAll = rows.every(r => r.shown > 0)
  const overall = heldAll ? gradeForRung(Math.min(...rows.map(r => r.shown))) : null
  const graded = rows.filter(r => r.shown > 0).length

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '18px 16px 14px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <span style={{ ...label, fontSize: 12, color: 'var(--text-muted)' }}>Your colours</span>
        {overall ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...label, fontSize: 12, color: 'var(--white)' }}>
            Overall <GradeDot grade={overall} /> {overall.name}
          </span>
        ) : (
          <span style={{ ...label, fontSize: 11, color: 'var(--text-muted)' }}>
            {graded} of 10 domains graded · {state.games} game{state.games === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {!schemaReady && (
        <div style={{
          fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5,
          background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 10,
          padding: '9px 11px', marginBottom: 12,
        }}>
          Provisional: worked out from your scores. A kaiwhakawā confirms each colour once grading goes live.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(({ d, gate, shown, ready }) => {
          const g = gradeForRung(shownRung(shown, 0))
          const next = gate.next ? gradeForRung(gate.next) : null
          const standardsNext = d.nextRung ? gradeForRung(d.nextRung) : null
          const blocker = gateBlocker(gate)
          const status = ready
            ? <span style={{ color: 'var(--green)' }}>{next!.name} is ready for a kaiwhakawā to confirm</span>
            : d.availableCount === 0
              ? 'Nothing here can be graded for you yet'
              : !schemaReady
                ? standardsNext ? `${d.metAtNextRung} of ${d.required} events at ${standardsNext.name}` : 'The top of the ladder'
                : !next
                  ? 'The top of the ladder'
                  : !gate.standardsMet
                    ? `${d.metAtNextRung} of ${d.required} events at ${next.name}`
                    : `${next.name} needs ${blocker}`
          const showBar = schemaReady && !!next && gate.unitsNeeded > 0
          return (
            <div key={d.domainNumber} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0',
              borderTop: d.domainNumber === 1 ? 'none' : '1px solid #181818',
            }}>
              <DomainIcon domainName={DOMAIN_NAMES[d.domainNumber - 1]} domainNumber={d.domainNumber} size={30} />
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {DOMAIN_NAMES[d.domainNumber - 1]}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{status}</div>
                {showBar && (
                  <div title={`${Math.floor(gate.units)} of ${gate.unitsNeeded} training units toward ${next!.name}`}
                    style={{ height: 3, borderRadius: 99, background: '#1c1c1c', marginTop: 5, overflow: 'hidden' }}>
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
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', marginTop: 6 }}>
        <Link href="/log" style={{ flex: 1, textAlign: 'center', paddingTop: 13, ...label, fontSize: 12, color: 'var(--purple)' }}>
          Log a workout
        </Link>
        <Link href="/grades" style={{ flex: 1, textAlign: 'center', paddingTop: 13, ...label, fontSize: 12, color: 'var(--blue)' }}>
          What each colour asks →
        </Link>
      </div>
    </div>
  )
}
