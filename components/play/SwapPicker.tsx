'use client'

// ─── Swap picker ─────────────────────────────────────────────────────────────
// "I cannot do today's Deadlift." A sheet of the other events in that domain,
// or of every event when the player is adding an extra on top.
//
// A swap does not place you: the official event is still ranked as missed, the
// rule the sport already had. The sheet says so, because a player who swaps
// without knowing that would be surprised at the end of the game.

import { useState } from 'react'
import { EVENTS, type EventData } from '@/lib/eventData'
import { swapChoices } from '@/lib/gameSwaps'
import EventIcon, { domainColor } from '@/components/EventIcon'

export default function SwapPicker({
  title, domainNumber, exclude, onPick, onClose,
}: {
  title: string
  /** The domain to choose within, or null for every event (an extra). */
  domainNumber: number | null
  /** Events already in play, so the same one cannot be added twice. */
  exclude: readonly string[]
  onPick: (slug: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const pool: EventData[] = domainNumber
    ? swapChoices(domainNumber, exclude)
    : EVENTS.filter(e => !exclude.includes(e.slug))
  const q = query.trim().toLowerCase()
  const shown = q.length >= 2 ? pool.filter(e => e.name.toLowerCase().includes(q)) : pool

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(640px, 100vw)', maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        background: '#141414', border: '1px solid #2a2a2a', borderBottom: 'none',
        borderRadius: '24px 24px 0 0', overflow: 'hidden',
      }}>
        <div style={{ height: 4, flexShrink: 0, background: 'var(--rainbow)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.03em', lineHeight: 1 }}>{title}</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 3 }}>
              Counts toward your colours, not your placement
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
            background: '#181818', border: '1px solid #2a2a2a', color: '#999', fontSize: 15,
          }}>✕</button>
        </div>

        {!domainNumber && (
          <div style={{ padding: '0 16px 10px' }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search events" aria-label="Search events"
              style={{
                width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '11px 12px', color: '#fff', fontSize: 16, minHeight: 44,
              }} />
          </div>
        )}

        <div style={{ overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map(e => (
            <button key={e.slug} onClick={() => onPick(e.slug)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
              minHeight: 56, padding: '8px 12px', borderRadius: 14, cursor: 'pointer',
              background: '#111', border: '1px solid #1e1e1e', color: '#fff',
            }}>
              <EventIcon slug={e.slug} emoji={e.emoji} domainNumber={e.domainNumber} size={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.03em' }}>{e.name}</span>
                <span style={{
                  display: 'block', fontFamily: 'var(--font-label)', fontSize: 10.5,
                  color: domainColor(e.domainNumber), textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2,
                }}>{e.domain}</span>
              </span>
            </button>
          ))}
          {shown.length === 0 && (
            <div style={{ color: '#777', fontSize: 14, padding: '20px 4px', textAlign: 'center' }}>
              Nothing left to add in this domain.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
