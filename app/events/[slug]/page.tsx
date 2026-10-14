// Server component. Everything on this page comes from lib/eventData.ts, which
// is static, so it is rendered on the server and the roster never reaches the
// browser; the event icon is the only client island.
//
// generateStaticParams prerenders every event page at build time. Unknown slugs
// still fall through to the "Event not found" branch below.
//
// Deliberately short (Oct 2026): the icon, how to do it, and the rules. The
// video placeholder, scoring method, level list and personal best were cut; a
// player sees levels and their records where they score (QuickEntrySheet, /prs).
// How To and Rules are the one-line versions in lib/eventSummaries.ts; the full
// text is the fallback for an event that has none yet.
import Link from 'next/link'
import { EVENTS, getEventBySlug } from '@/lib/eventData'
import { domainColor } from '@/lib/domainColours'
import EventIcon from '@/components/EventIcon'
import { EVENT_SUMMARIES } from '@/lib/eventSummaries'

export function generateStaticParams() {
  return EVENTS.map(e => ({ slug: e.slug }))
}

const label: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.05em', color: '#fff', margin: '0 0 6px',
}
const body: React.CSSProperties = {
  color: '#ccc', fontSize: '15px', lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-body)',
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = getEventBySlug(slug)

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '24px' }}>Event not found</div>
        <Link href="/events" style={{ color: 'var(--blue)' }}>← All Events</Link>
      </div>
    )
  }

  const colour = domainColor(event.domainNumber)
  const back = `/events#domain-${event.domainNumber}`
  const summary = EVENT_SUMMARIES[event.slug]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '28px 16px 72px' }}>
        <Link href={back} style={{ color: '#666', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          ← All Events
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', margin: '20px 0 28px' }}>
          <EventIcon slug={event.slug} emoji={event.emoji} domainNumber={event.domainNumber} size={112} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px, 8vw, 52px)', letterSpacing: '0.03em', lineHeight: 0.95, margin: 0 }}>
            {event.name}
          </h1>
          <Link href={back} style={{
            color: colour, border: `1px solid ${colour}66`, background: colour + '1e',
            padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
            fontFamily: 'var(--font-label)', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {event.domainNumber}. {event.domain}
          </Link>
        </div>

        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderTop: `3px solid ${colour}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section>
            <h2 style={label}>How To</h2>
            <p style={body}>{summary?.how ?? event.howToPerform}</p>
          </section>
          <section>
            <h2 style={label}>Rules</h2>
            <p style={body}>{summary?.rules ?? event.rules}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
