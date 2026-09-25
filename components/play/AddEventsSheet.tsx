'use client'

// ─── Add events ──────────────────────────────────────────────────────────────
// What the + on an official event opens: the other events in that domain, to
// tick as many as the player likes and add in one go.
//
// Added events count toward colours and training, never toward the placement:
// the medal table compares the same ten events for everyone. The sheet says
// so, because a player who adds instead of playing the official event would
// otherwise be surprised at the end of the game.

import { useState } from 'react'
import { domainChoices } from '@/lib/gameSwaps'
import EventIcon from '@/components/EventIcon'

export default function AddEventsSheet({
  domainName, domainNumber, exclude, onAdd, onClose,
}: {
  domainName: string
  domainNumber: number
  /** Events already on the screen, so the same one cannot be added twice. */
  exclude: readonly string[]
  onAdd: (slugs: string[]) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const pool = domainChoices(domainNumber, exclude)
  const toggle = (slug: string) =>
    setPicked(p => (p.includes(slug) ? p.filter(s => s !== slug) : [...p, slug]))
  const n = picked.length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }} />
      <div role="dialog" aria-label={`Add ${domainName} events`} style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(640px, 100vw)', maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        background: '#141414', border: '1px solid #2a2a2a', borderBottom: 'none',
        borderRadius: '24px 24px 0 0', overflow: 'hidden',
      }}>
        <div style={{ height: 4, flexShrink: 0, background: 'var(--rainbow)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.03em', lineHeight: 1 }}>{domainName}</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 3 }}>
              Counts toward your colours, not your placement
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
            background: '#181818', border: '1px solid #2a2a2a', color: '#999', fontSize: 15,
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pool.map(e => {
            const on = picked.includes(e.slug)
            return (
              <button key={e.slug} onClick={() => toggle(e.slug)} aria-pressed={on} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                minHeight: 56, padding: '8px 12px', borderRadius: 14, cursor: 'pointer',
                background: on ? '#0f1a26' : '#111', border: `1px solid ${on ? '#2371BB' : '#1e1e1e'}`, color: '#fff',
              }}>
                <EventIcon slug={e.slug} emoji={e.emoji} domainNumber={e.domainNumber} size={34} tint="#bbbbbb" />
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.03em' }}>{e.name}</span>
                <span aria-hidden="true" style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0, boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  border: `1.5px solid ${on ? '#2371BB' : '#444'}`, background: on ? '#2371BB' : 'none',
                }}>{on ? '✓' : ''}</span>
              </button>
            )
          })}
          {pool.length === 0 && (
            <div style={{ color: '#777', fontSize: 14, padding: '20px 4px', textAlign: 'center' }}>
              Nothing left to add in this domain.
            </div>
          )}
        </div>

        <div style={{ padding: '4px 16px 20px', flexShrink: 0 }}>
          <button onClick={() => { if (n) onAdd(picked) }} style={{
            width: '100%', minHeight: 48, borderRadius: 999, border: 'none',
            cursor: n ? 'pointer' : 'default', background: n ? '#2371BB' : '#1a2a3a', color: n ? '#fff' : '#8aa4bd',
            fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>{n ? `Add ${n} event${n === 1 ? '' : 's'}` : 'Choose events to add'}</button>
        </div>
      </div>
    </div>
  )
}
