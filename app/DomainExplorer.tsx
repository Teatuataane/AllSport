'use client'

// The homepage's ten domain tiles. A tile opens to show that domain's events
// with their icons; one domain is open at a time. The roster is read on the
// server (app/page.tsx) and only names, slugs and emoji are passed down.
//
// The open panel spans the whole grid row and the grid is `dense`, so the tiles
// after the open one back-fill its row and the panel lands directly beneath the
// row that holds the tile, at any column count (one on a phone, two on desktop).
import { useState } from 'react'
import Link from 'next/link'
import DomainIcon from '@/components/DomainIcon'
import EventIcon from '@/components/EventIcon'

export type ExplorerDomain = {
  name: string
  number: number
  color: string
  events: { slug: string; name: string; emoji: string }[]
}

export default function DomainExplorer({ domains }: { domains: ExplorerDomain[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gridAutoFlow: 'row dense', gap: '8px' }}>
      {domains.map(d => {
        const isOpen = open === d.number
        const panelId = `domain-panel-${d.number}`
        return [
          <button
            key={d.name}
            type="button"
            className="lp-tile"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setOpen(isOpen ? null : d.number)}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', borderColor: isOpen ? d.color : undefined }}
          >
            <DomainIcon domainName={d.name} domainNumber={d.number} size={44} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '0.04em', color: '#fff', lineHeight: 1.05 }}>{d.name}</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: d.color, marginTop: '3px' }}>{d.events.length} events</span>
            </span>
            <span aria-hidden="true" style={{ color: '#666', fontSize: '14px', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>,
          isOpen && (
            <div
              key={panelId}
              id={panelId}
              role="region"
              aria-label={`${d.name} events`}
              style={{ gridColumn: '1 / -1', background: '#111', border: `1px solid ${d.color}`, borderRadius: '10px', padding: '14px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px' }}>
                {d.events.map(e => (
                  <Link
                    key={e.slug}
                    href={`/events/${e.slug}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', background: '#0d0d0d', color: '#ddd', fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: 1.2, textDecoration: 'none' }}
                  >
                    <EventIcon slug={e.slug} emoji={e.emoji} domainNumber={d.number} size={30} />
                    <span style={{ minWidth: 0 }}>{e.name}</span>
                  </Link>
                ))}
              </div>
              <Link href="/events" style={{ display: 'inline-block', marginTop: '12px', fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: d.color }}>
                Full event guide →
              </Link>
            </div>
          ),
        ]
      })}
    </div>
  )
}
