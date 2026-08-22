// Server component. Everything on this page except the viewer's personal best
// comes from lib/eventData.ts, which is static — so it is rendered on the server
// and the 2171-line roster never reaches the browser. The personal best is the
// one per-viewer piece and lives in its own client island.
//
// generateStaticParams prerenders all 120 event pages at build time; they were
// previously rendered on demand for every request despite the content being
// fixed. Unknown slugs still fall through to the "Event not found" branch below.
import Link from 'next/link'
import { EVENTS, getEventBySlug } from '@/lib/eventData'
import PersonalBestCard from './PersonalBestCard'

export function generateStaticParams() {
  return EVENTS.map(e => ({ slug: e.slug }))
}

const DOMAIN_COLOURS: Record<number, string> = {
  1: '#EA4742', 2: '#F9B051', 3: '#F397C0', 4: '#B87DB5', 5: '#2371BB',
  6: '#4DB26E', 7: '#EA4742', 8: '#F9B051', 9: '#B87DB5', 10: '#2371BB',
}

const INPUT_MODE_LABEL: Record<string, string> = {
  strength: 'Weight lifted (kg)',
  reps: 'Total repetitions',
  time: 'Time — lower is better',
  hold: 'Hold duration — longer is better',
  distance: 'Distance covered',
  sport: 'Win / Draw / Loss result',
  sprint: 'Time in seconds + centiseconds',
  'difficulty+time': 'Difficulty tier + hold time',
  'difficulty+reps': 'Difficulty tier + repetitions',
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = getEventBySlug(slug)

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '24px' }}>Event not found</div>
        <Link href="/events" style={{ color: 'var(--blue)' }}>← All Events</Link>
      </div>
    )
  }

  const domainColour = DOMAIN_COLOURS[event.domainNumber] || '#2371BB'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--white)' }}>
      {/* Header */}
      <div style={{ background: 'var(--black)', borderBottom: '1px solid #1a1a1a', padding: '20px 24px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Link href="/events" style={{ color: '#555', fontSize: '12px', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>
            ← All Events
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--white)', lineHeight: 1 }}>{event.name}</div>
              <div style={{ marginTop: '8px' }}>
                <span style={{
                  background: domainColour + '22', color: domainColour, border: `1px solid ${domainColour}44`,
                  padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                  fontFamily: 'var(--font-label)', letterSpacing: '0.05em',
                }}>
                  {event.domainNumber}. {event.domain.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Video placeholder */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
          paddingBottom: '56.25%', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '40px', opacity: 0.3 }}>▶</div>
            <div style={{ color: '#555', fontSize: '13px', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Video coming soon</div>
          </div>
        </div>

        {/* How to perform */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--white)', marginBottom: '12px', letterSpacing: '1px' }}>How to Perform</div>
          <p style={{ color: event.howToPerform === 'Content coming soon.' ? '#555' : '#ccc', fontSize: '14px', lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-body)' }}>
            {event.howToPerform}
          </p>
        </div>

        {/* Rules */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--white)', marginBottom: '12px', letterSpacing: '1px' }}>Rules</div>
          <p style={{ color: event.rules === 'Content coming soon.' ? '#555' : '#ccc', fontSize: '14px', lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-body)' }}>
            {event.rules}
          </p>
        </div>

        {/* Scoring method */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--white)', marginBottom: '12px', letterSpacing: '1px' }}>Scoring Method</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: domainColour + '22', border: `1px solid ${domainColour}44`, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', color: domainColour, fontFamily: 'var(--font-label)', letterSpacing: '0.05em', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {event.inputMode}
            </div>
          </div>
          <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.6, margin: '12px 0 0', fontFamily: 'var(--font-body)' }}>
            {INPUT_MODE_LABEL[event.inputMode] || event.inputMode}
          </p>
        </div>

        {/* Difficulty tiers */}
        {event.hasDifficultyTiers && event.difficultyTiers && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#B87DB5', marginBottom: '12px', letterSpacing: '1px' }}>
              Difficulty Tiers — D1 to D{event.difficultyTiers.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {event.difficultyTiers.map(t => (
                <div key={t.level} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#B87DB522', border: '1px solid #B87DB544',
                    fontFamily: 'var(--font-display)', fontSize: '14px', color: '#B87DB5',
                  }}>
                    D{t.level}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--grey-light)' }}>{t.name}</div>
                    {t.detail && <div style={{ fontSize: '12px', color: 'var(--grey)' }}>{t.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal best — the one per-viewer block on this page */}
        <PersonalBestCard eventName={event.name} isSport={event.inputMode === 'sport'} />

      </div>
    </div>
  )
}
