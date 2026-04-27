'use client'

import Link from 'next/link'
import { EVENTS, DOMAIN_ORDER, getEventsByDomain } from '@/lib/eventData'

const DOMAIN_COLOURS = [
  '#EA4742', '#F9B051', '#F397C0', '#B87DB5', '#2371BB',
  '#4DB26E', '#EA4742', '#F9B051', '#B87DB5', '#2371BB',
]

export default function EventsIndex() {
  const byDomain = getEventsByDomain()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '24px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Link href="/how-to-play" style={{ color: '#555', fontSize: '12px', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>
            ← How To Play
          </Link>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '40px', color: '#fff', lineHeight: 1 }}>All Events</div>
          <div style={{ color: '#555', fontSize: '13px', marginTop: '6px' }}>100 events across 10 domains</div>
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
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '20px', color: colour, letterSpacing: '1px' }}>
                  {domainIdx + 1}. {domain.toUpperCase()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {events.map(ev => (
                  <Link
                    key={ev.slug}
                    href={`/events/${ev.slug}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#111', borderRadius: '8px', padding: '12px 14px',
                      textDecoration: 'none', border: '1px solid #1e1e1e',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>{ev.name}</div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {ev.inputMode}
                        {ev.hasDifficultyTiers && ev.difficultyTiers && (
                          <span style={{ marginLeft: '8px', color: '#B87DB5' }}>
                            D1–D{ev.difficultyTiers.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ color: '#333', fontSize: '14px' }}>→</div>
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
