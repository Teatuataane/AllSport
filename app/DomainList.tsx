'use client'

import { useState } from 'react'

export type LandingDomain = {
  name: string
  color: string
  events: string[]
}

/**
 * The one interactive piece of the homepage, split out so the rest of that page
 * can be a server component.
 *
 * `domains` is derived on the server and passed in already flattened to name
 * strings — deliberately, and for the same reason as /how-to-play's
 * DomainAccordion. Deriving it here would pull lib/eventData.ts into the client
 * bundle to render ~120 names, and that module carries the full howToPerform and
 * rules prose for all 120 events: 112 KB of source, measured at 20 KB gzipped in
 * the homepage's chunk. The homepage is where first-time visitors land, so it is
 * the worst page in the app to spend that on.
 *
 * Styling comes from the `.lp-domain` / `.lp-pill` rules in the page's <style>
 * block, which are shared with the rest of the page and stay there.
 */
export default function DomainList({ domains }: { domains: LandingDomain[] }) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {domains.map((domain) => {
        const isOpen = expandedDomain === domain.name
        return (
          <div key={domain.name} className="lp-domain" onClick={() => setExpandedDomain(isOpen ? null : domain.name)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: domain.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1, color: isOpen ? domain.color : '#cccccc' }}>{domain.name}</span>
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', letterSpacing: '0.06em' }}>{domain.events.length} events</span>
              <span style={{ color: '#444', fontSize: '12px' }}>{isOpen ? '▴' : '▾'}</span>
            </div>
            {isOpen && (
              <div style={{ padding: '0 18px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: `1px solid ${domain.color}22` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '12px' }}>
                  {domain.events.map((event) => (
                    <span key={event} className="lp-pill">{event}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
