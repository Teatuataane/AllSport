'use client'

// ─── "You have a new colour" ─────────────────────────────────────────────────
// The moment, on HOME and on the colours page. A colour now arrives without
// anyone announcing it, so this is the announcement.
//
// A colour TAKEN BACK gets its own card, never a line inside the celebration:
// the spec says a withdrawal is told plainly and quietly, and a line under a
// rainbow stripe and a green "New colour" header is a celebration in reverse.
//
// Dismissal writes a watermark rather than a per-card flag, so a colour
// conferred while the player was nowhere near the app (a kaiwhakawā catching up
// on the release panel) still gets its moment the next time they open it. Both
// cards share it, so either "Got it" clears both — which is why the withdrawal
// card comes FIRST: a player must not dismiss it unread by answering the
// celebration above it.

import { gradeForRung } from '@/lib/grading'
import { DOMAIN_ORDER } from '@/lib/eventData'
import { RAINBOW } from '@/lib/domainColours'
import { GradeDot } from '@/components/GradesCard'
import type { AwardLike, WithdrawalLike } from '@/lib/newColours'

const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', fontWeight: 600,
}
const card = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: 0, marginBottom: 16, overflow: 'hidden' as const,
}

function Header({ title, colour, onDismiss, both }: { title: string; colour: string; onDismiss: () => void; both: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ ...label, fontSize: 12, color: colour }}>{title}</span>
      {/* The name starts with the visible "Got it" (WCAG 2.5.3, so voice
          control still finds it) and says honestly that one tap clears both. */}
      <button onClick={onDismiss} aria-label={`Got it, dismiss ${both ? 'both notices' : title}`} style={{
        ...label, fontSize: 11, color: 'var(--text-muted)', background: 'transparent',
        border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 2px',
      }}>
        Got it
      </button>
    </div>
  )
}

export default function NewColourCard({ awards, withdrawn = [], onDismiss }: {
  awards: readonly AwardLike[]
  /** Colours taken back. Told plainly, in their own card. */
  withdrawn?: readonly WithdrawalLike[]
  onDismiss: () => void
}) {
  if (awards.length === 0 && withdrawn.length === 0) return null

  return (
    <>
      {withdrawn.length > 0 && (
        <div data-card="withdrawn" style={card}>
          <div style={{ padding: '14px 16px 12px' }}>
            <Header title="Colours updated" colour="var(--text-muted)" onDismiss={onDismiss} both={awards.length > 0} />
            {withdrawn.map(w => (
              <div key={`w:${w.domain_number}:${w.rung}:${w.withdrawn_at}`}
                style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 8 }}>
                <span style={{ color: 'var(--white)' }}>{w.grade_name}</span> in {DOMAIN_ORDER[w.domain_number - 1]} was
                taken back. A logged score it relied on was removed by a kaiwhakawā.
                {w.reason && <span style={{ display: 'block', marginTop: 2 }}>{w.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {awards.length > 0 && (
        <div data-card="new-colours" style={card}>
          <div aria-hidden style={{ height: 3, background: RAINBOW }} />
          <div style={{ padding: '14px 16px 12px' }}>
            <Header title={awards.length > 1 ? `${awards.length} new colours` : 'New colour'} colour="var(--green)" onDismiss={onDismiss} both={withdrawn.length > 0} />
            {awards.map(a => (
              <div key={`${a.domain_number}:${a.rung}`} style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 6 }}>
                <GradeDot grade={gradeForRung(a.rung)} size={14} />
                {/* The stored name, not the ladder's: an award records what it
                    was called when it was conferred. */}
                <span style={{ fontSize: 15, color: 'var(--white)' }}>{a.grade_name}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>in {DOMAIN_ORDER[a.domain_number - 1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </>
  )
}
