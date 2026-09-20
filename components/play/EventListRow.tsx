// ─── Event list row ──────────────────────────────────────────────────────────
// One planned event on a play screen: still to play, or scored. The RIGHT-HAND
// label differs between a game (your rank in your division) and a personal
// game (nothing to rank against), so the screen passes it in.

'use client'

import EventIcon from '@/components/EventIcon'
import { unitsIn, fmtUnitsLabel } from '@/lib/units'
import type { EventData } from '@/lib/eventData'
import { sportWDL, type PlayEvent, type EntryRow } from './chrome'

export default function EventListRow({
  se, eventData, myResults, note, onOpen,
}: {
  se: PlayEvent
  eventData: EventData | undefined
  myResults: EntryRow[]
  /** The small line under the score. A game passes the division rank. */
  note?: { label: string; color: string }
  onOpen: () => void
}) {
  const mode = (eventData?.inputMode || se.input_mode || 'strength') as string
  const myBestResult = myResults.length > 0
    ? myResults.reduce((best, r) => r.raw_score > best.raw_score ? r : best, myResults[0])
    : undefined
  const unitsHere = unitsIn(eventData, myResults)
  const todo = !myBestResult

  return (
    <button onClick={onOpen} style={{
      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 14px', marginBottom: '8px', borderRadius: '16px', cursor: 'pointer',
      background: todo ? 'linear-gradient(180deg, rgba(35,113,187,0.10), #111 70%)' : '#111',
      border: `1px solid ${todo ? '#1c3a5e' : '#1e1e1e'}`,
      color: '#fff', fontFamily: 'var(--font-body)',
    }}>
      <EventIcon slug={se.event_slug || eventData?.slug || ''} emoji={eventData?.emoji} domainNumber={se.domain_number} size={46} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', letterSpacing: '0.03em', lineHeight: 1 }}>{se.event_name}</div>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {se.domain_name}
          {unitsHere > 0 && (
            <span style={{ fontSize: '10.5px', color: '#B87DB5', border: '1px solid #B87DB566', borderRadius: '999px', padding: '0 7px' }}>{fmtUnitsLabel(unitsHere)}</span>
          )}
        </div>
      </div>
      {todo ? (
        <span style={{
          fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em',
          fontSize: '12px', color: '#fff', background: '#2371BB', borderRadius: '999px', padding: '6px 12px', flexShrink: 0, fontWeight: 500,
        }}>Tap to score</span>
      ) : (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#4DB26E' }}>
            {mode === 'sport' ? sportWDL(myResults) : myBestResult!.score_label}
          </div>
          {note && (
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: note.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
              {note.label}
            </div>
          )}
        </div>
      )}
    </button>
  )
}