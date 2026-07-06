'use client'

import Link from 'next/link'
import { EVENTS, DOMAIN_ORDER, getEventsByDomain } from '@/lib/eventData'

const DOMAIN_COLOURS = [
  '#EA4742', '#F9B051', '#F397C0', '#B87DB5', '#2371BB',
  '#4DB26E', '#EA4742', '#F9B051', '#B87DB5', '#2371BB',
]

export default function EventsIndex() {
  const byDomain = getEventsByDomain()
  const totalEvents = EVENTS.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--white)' }}>
      <style>{`
        .event-row { transition: border-color 0.15s, background 0.15s; }
        .event-row:hover { border-color: var(--border-strong) !important; background: #161616 !important; }
      `}</style>
      {/* Header */}
      <div style={{ background: 'var(--black)', borderBottom: '1px solid var(--border)', padding: '24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rainbow)' }} />
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Link href="/how-to-play" style={{ color: '#555', fontSize: '12px', display: 'block', marginBottom: '8px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ← How To Play
          </Link>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', color: 'var(--white)', lineHeight: 1 }}>ALL EVENTS</div>
          <div style={{ color: '#555', fontSize: '13px', marginTop: '6px' }}>{totalEvents} events across {DOMAIN_ORDER.length} domains</div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px' }}>
        {DOMAIN_ORDER.map((domain, domainIdx) => {
          const events = byDomain[domain] || []
          const colour = DOMAIN_COLOURS[domainIdx]
          return (
            <div key={domain} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: colour, flexShrink: 0 }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: colour, letterSpacing: '0.05em' }}>
                  {domainIdx + 1}. {domain.toUpperCase()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {events.map(ev => (
                  <Link
                    key={ev.slug}
                    href={`/events/${ev.slug}`}
                    className="event-row"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--surface)', borderRadius: '10px', padding: '12px 14px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--white)' }}>{ev.name}</div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-label)' }}>
                        {ev.inputMode}
                        {ev.hasDifficultyTiers && ev.difficultyTiers && (
                          <span style={{ marginLeft: '8px', color: 'var(--purple)' }}>
                            D1–D{ev.difficultyTiers.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ color: '#444', fontSize: '14px' }}>→</div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
