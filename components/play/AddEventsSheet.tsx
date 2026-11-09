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
import { NEUTRAL_ICON_TINT } from '@/lib/scoreColour'

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1110 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }} />
      <div role="dialog" aria-label={`Add ${domainName} events`} style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(640px, 100vw)', maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border-strong)', borderBottom: 'none',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', overflow: 'hidden',
      }}>
        <div style={{ height: 4, flexShrink: 0, background: 'var(--rainbow)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.03em', lineHeight: 1 }}>{domainName}</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 3 }}>
              Counts toward your colours, not your placement
            </div>
          </div>
          <button className="press" onClick={onClose} aria-label="Close" style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--grey)', fontSize: 15,
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pool.map(e => {
            const on = picked.includes(e.slug)
            return (
              <button className="press" key={e.slug} onClick={() => toggle(e.slug)} aria-pressed={on} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                minHeight: 56, padding: '8px 12px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                background: on ? 'var(--blue-tint)' : 'var(--surface)', border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`, color: 'var(--white)',
              }}>
                <EventIcon slug={e.slug} emoji={e.emoji} domainNumber={e.domainNumber} size={34} tint={NEUTRAL_ICON_TINT} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.03em' }}>{e.name}</span>
                <span aria-hidden="true" style={{
                  width: 22, height: 22, borderRadius: 'var(--radius-sm)', flexShrink: 0, boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  border: `1.5px solid ${on ? 'var(--blue)' : 'var(--border-strong)'}`, background: on ? 'var(--blue)' : 'none',
                }}>{on ? '✓' : ''}</span>
              </button>
            )
          })}
          {pool.length === 0 && (
            <div style={{ color: 'var(--grey)', fontSize: 14, padding: '20px 4px', textAlign: 'center' }}>
              Nothing left to add in this domain.
            </div>
          )}
        </div>

        <div style={{ padding: '4px 16px 20px', flexShrink: 0 }}>
          <button className="press" onClick={() => { if (n) onAdd(picked) }} style={{
            width: '100%', minHeight: 48, borderRadius: 'var(--radius-pill)', border: 'none',
            cursor: n ? 'pointer' : 'default', background: n ? 'var(--blue)' : 'var(--blue-tint)', color: n ? 'var(--white)' : 'var(--grey-light)',
            fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>{n ? `Add ${n} event${n === 1 ? '' : 's'}` : 'Choose events to add'}</button>
        </div>
      </div>
    </div>
  )
}
