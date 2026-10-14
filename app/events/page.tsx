// Server component. The roster lookup happens at build time; as a client
// component this page once dragged the whole lib/eventData.ts roster into the
// browser bundle purely to render a static list. The icons (EventIcon,
// DomainIcon) are small client islands; only slugs, names and emoji reach them.
//
// Laid out like the homepage's domain tiles opened up: a strip of domain icons
// to jump between sections, then each domain as a grid of icon tiles. Scoring
// jargon (input modes, level counts) stays off this page; each event page says
// how to do it and what counts.
import Link from 'next/link'
import { EVENTS, DOMAIN_ORDER, getEventsByDomain } from '@/lib/eventData'
import { DOMAIN_COLORS } from '@/lib/domainColours'
import DomainIcon from '@/components/DomainIcon'
import EventIcon from '@/components/EventIcon'

export default function EventsIndex() {
  const byDomain = getEventsByDomain()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <style>{`
        .ev-jump { display: flex; gap: 6px; overflow-x: auto; padding: 4px 0 2px; scrollbar-width: none; }
        .ev-jump::-webkit-scrollbar { display: none; }
        .ev-chip { flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px; background: #111; border: 1px solid #1e1e1e; color: #ddd; font-family: var(--font-label); font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; transition: border-color 0.15s; }
        .ev-chip:hover { border-color: #444; }
        .ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .ev-tile { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 10px 14px; border-radius: 12px; background: #111; border: 1px solid #1e1e1e; color: #ddd; text-align: center; font-family: var(--font-body); font-size: 14px; font-weight: 600; line-height: 1.2; transition: border-color 0.15s, background 0.15s, transform 0.15s; }
        .ev-tile:hover { background: #161616; border-color: var(--tile-c); transform: translateY(-2px); }
        @media (max-width: 480px) {
          .ev-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .ev-section { scroll-margin-top: 80px; }
      `}</style>

      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', position: 'relative', paddingTop: '28px', paddingBottom: '20px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rainbow)' }} />
        <div className="container">
          <Link href="/#domains" style={{ color: '#666', fontSize: '12px', display: 'inline-block', marginBottom: '10px', fontFamily: 'var(--font-label)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            ← Home
          </Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 6vw, 60px)', letterSpacing: '0.03em', lineHeight: 0.95, margin: 0 }}>
            THE <span style={{ background: 'var(--rainbow)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EVENTS</span>
          </h1>
          <p style={{ color: '#888', fontSize: '15px', margin: '8px 0 18px' }}>
            {EVENTS.length} events in {DOMAIN_ORDER.length} domains. A game draws one from each. Tap one to learn it.
          </p>
          <nav className="ev-jump" aria-label="Jump to a domain">
            {DOMAIN_ORDER.map((domain, i) => (
              <a key={domain} href={`#domain-${i + 1}`} className="ev-chip">
                <DomainIcon domainName={domain} domainNumber={i + 1} size={26} />
                {domain}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '32px', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {DOMAIN_ORDER.map((domain, i) => {
          const events = byDomain[domain] || []
          const colour = DOMAIN_COLORS[i]
          return (
            <section key={domain} id={`domain-${i + 1}`} className="ev-section" aria-labelledby={`domain-${i + 1}-h`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', paddingBottom: '12px', borderBottom: `2px solid ${colour}` }}>
                <DomainIcon domainName={domain} domainNumber={i + 1} size={44} />
                <div style={{ minWidth: 0 }}>
                  <h2 id={`domain-${i + 1}-h`} style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '0.04em', lineHeight: 1, margin: 0, color: '#fff' }}>
                    {domain}
                  </h2>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: colour, marginTop: '4px' }}>
                    Domain {i + 1} · {events.length} events
                  </div>
                </div>
              </div>
              <div className="ev-grid">
                {events.map(ev => (
                  <Link key={ev.slug} href={`/events/${ev.slug}`} className="ev-tile" style={{ '--tile-c': colour } as React.CSSProperties}>
                    <EventIcon slug={ev.slug} emoji={ev.emoji} domainNumber={i + 1} size={56} />
                    <span>{ev.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
