'use client'

import { useState } from 'react'
import Link from 'next/link'

export type AccordionDomain = {
  name: string
  color: string
  desc: string
  events: string[]
}

/**
 * The one interactive piece of /how-to-play, split out so the rest of that page
 * can be a server component.
 *
 * `domains` is derived on the server from lib/eventData.ts and passed in already
 * flattened — deliberately. Deriving it here instead would pull the 2171-line
 * event roster into the client bundle just to render ~120 name strings, which is
 * the cost this split exists to avoid.
 *
 * Styling comes from the `.domain-card-htp` / `.event-pill` rules in the page's
 * <style> block; those classes are shared with the rest of the page, so they
 * stay there rather than being duplicated here.
 */
export default function DomainAccordion({ domains }: { domains: AccordionDomain[] }) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {domains.map((domain) => {
        const isOpen = expandedDomain === domain.name
        return (
          <div
            key={domain.name}
            className="domain-card-htp"
            onClick={() => setExpandedDomain(isOpen ? null : domain.name)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: domain.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: isOpen ? domain.color : 'var(--white)', letterSpacing: '0.04em', lineHeight: 1 }}>
                  {domain.name}
                </div>
                {!isOpen && (
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '13px', color: '#555', marginTop: '2px' }}>{domain.desc}</div>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#555', marginRight: '8px', flexShrink: 0 }}>{domain.events.length} events</span>
              <span style={{ color: '#444', fontSize: '13px' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${domain.color}33` }}>
                <p style={{ fontFamily: 'var(--font-label)', fontSize: '14px', color: '#666', marginBottom: '12px', paddingTop: '12px' }}>{domain.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {domain.events.map(event => (
                    <span key={event} className="event-pill">{event}</span>
                  ))}
                </div>
                <Link href="/events" style={{ display: 'inline-block', marginTop: '12px', fontSize: '12px', color: 'var(--blue)', fontFamily: 'var(--font-label)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  View full event details →
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
