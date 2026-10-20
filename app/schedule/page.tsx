// Server component. This page has no state, no effects and no event handlers,
// so the client directive it used to carry only cost bundle size. RainbowText
// comes from the client-side ui module and stays a small client island.
import Link from 'next/link'
import { RainbowText } from '@/components/ui'

// Without its own title Google wrote one from the page ("session schedule").
export const metadata = {
  title: 'Game Schedule – AllSport',
  description: 'Three AllSport games a week in Sockburn, Ōtautahi: Tuesday and Thursday 4:30pm, Saturday 9:00am. 100 minutes, 10 events. Koha-based.',
  alternates: { canonical: '/schedule' },
}

const sessions = [
  { day: 'Tuesday', time: '4:30 PM', duration: '100 mins', spots: 100 },
  { day: 'Thursday', time: '4:30 PM', duration: '100 mins', spots: 100 },
  { day: 'Saturday', time: '9:00 AM', duration: '100 mins', spots: 100 },
]

const dayColors = ['var(--red)', 'var(--blue)', 'var(--green)']

export default function Schedule() {
  return (
    <>
      <style>{`
        .session-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; transition: border-color 0.2s, transform 0.2s; overflow: hidden; position: relative; }
        .session-card:hover { border-color: var(--border-strong); transform: translateY(-4px); }
        .info-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px; }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '120px', paddingBottom: '80px', background: 'var(--black)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(77,178,110,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Ōtautahi, Aotearoa</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.92, marginBottom: '8px' }}>
            GAME<br />
            <RainbowText>SCHEDULE</RainbowText>
          </h1>
          <div className="rainbow-line" style={{ width: '88px', margin: '20px 0 28px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey-light)', fontSize: '20px', maxWidth: '560px', lineHeight: 1.7 }}>
            Three games a week in Sockburn. Register once, then just turn up.
          </p>
        </div>
      </section>

      {/* Weekly schedule */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--green)' }}>
        <div className="container">
          <div className="tag">Weekly Games</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
            WHEN WE <span style={{ color: 'var(--green)' }}>PLAY</span>
          </h2>
          <div className="divider" style={{ background: 'var(--green)' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '32px' }}>
            {sessions.map((session, i) => (
              <div key={session.day} className="session-card">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: dayColors[i] }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: dayColors[i], lineHeight: 1, marginBottom: '4px' }}>{session.day}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--white)', marginBottom: '16px' }}>{session.time}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666' }}>
                  {session.duration} · up to {session.spots} players
                </div>
                <Link href="/register" className="btn btn-primary" style={{ width: '100%', marginTop: '20px', fontSize: '15px', display: 'flex' }}>
                  Register
                </Link>
              </div>
            ))}
          </div>

          <p style={{ color: '#555555', fontSize: '13px', fontStyle: 'italic' }}>
            Times may change on public holidays.
          </p>
        </div>
      </section>

      {/* Venue */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--blue)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="tag">The Venue</div>
              <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
                ALLSPORT <span style={{ color: 'var(--blue)' }}>HQ</span>
              </h2>
              <div className="divider" style={{ background: 'var(--blue)' }} />
              <p style={{ color: 'var(--grey-light)', fontSize: '17px', lineHeight: 1.7, marginBottom: '20px' }}>
                26 Carbine Place<br />Sockburn, Ōtautahi
              </p>
              <a
                href="https://www.google.com/maps/search/?api=1&query=26+Carbine+Place+Sockburn+Christchurch"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ fontSize: '15px' }}
              >
                Get Directions
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { title: 'Parking', desc: 'Free, on site' },
                { title: 'Equipment', desc: 'All gear provided. Just bring yourself' },
                { title: 'Facilities', desc: 'Changing rooms on site' },
              ].map(item => (
                <div key={item.title} className="info-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <span style={{ width: 20, height: 3, borderRadius: 3, background: 'var(--rainbow)', flexShrink: 0, marginTop: 8 }} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555555', marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ color: 'var(--grey-light)', fontSize: '15px' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Annual Championship */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--amber)' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, #0d0800 0%, #0a0a0a 100%)',
            border: '1px solid rgba(249,176,81,0.2)',
            borderRadius: '16px',
            padding: 'clamp(32px, 5vw, 56px) clamp(24px, 4vw, 48px)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(249,176,81,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--amber), var(--red))' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'center' }}>
              <div>
                <div className="tag">Annual Championship</div>
                <h2 style={{ fontSize: 'clamp(40px, 5vw, 68px)', marginBottom: '8px', lineHeight: 1 }}>
                  THE ANNUAL<br /><span style={{ color: 'var(--amber)' }}>CHAMPIONSHIP</span>
                </h2>
                <div className="divider" style={{ background: 'var(--amber)' }} />
                <p style={{ color: 'var(--grey-light)', fontSize: '16px', lineHeight: 1.7, marginBottom: '28px' }}>
                  One day. Ten events picked by community vote. Open to every registered player. Who is the most complete athlete in Ōtautahi?
                </p>
                <Link href="/register" className="btn btn-gold" style={{ fontSize: '16px' }}>
                  Register to Compete
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'var(--dark)', border: '1px solid rgba(249,176,81,0.2)', borderRadius: '12px', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Date</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--amber)', lineHeight: 1 }}>Sunday 14 March 2027</div>
                </div>
                <div style={{ background: 'var(--dark)', border: '1px solid rgba(249,176,81,0.2)', borderRadius: '12px', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Location</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--white)', lineHeight: 1 }}>AllSport HQ</div>
                  <div style={{ color: 'var(--grey)', fontSize: '14px', marginTop: '4px' }}>26 Carbine Place, Sockburn</div>
                </div>
                <div style={{ background: 'var(--dark)', border: '1px solid rgba(249,176,81,0.2)', borderRadius: '12px', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Divisions</div>
                  <div style={{ color: 'var(--grey-light)', fontSize: '14px', lineHeight: 1.7 }}>
                    Men · Women · Juniors (U17)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Selwyn Winter Jam */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--purple)' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, #0a0010 0%, #0d0d0d 100%)',
            border: '1px solid rgba(184,125,181,0.2)',
            borderRadius: '16px',
            padding: 'clamp(32px, 5vw, 56px) clamp(24px, 4vw, 48px)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(184,125,181,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--purple), var(--red))' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'center' }}>
              <div>
                <div className="tag">Event Recap</div>
                <h2 style={{ fontSize: 'clamp(40px, 5vw, 68px)', marginBottom: '8px', lineHeight: 1 }}>
                  SELWYN<br /><span style={{ color: 'var(--purple)' }}>WINTER JAM</span>
                </h2>
                <div className="divider" style={{ background: 'var(--purple)' }} />
                <p style={{ color: 'var(--grey-light)', fontSize: '16px', lineHeight: 1.7 }}>
                  Our first public competition, 4 July 2026. Ten events, four divisions, four champions. Ngā mihi to everyone who played.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'var(--dark)', border: '1px solid rgba(184,125,181,0.2)', borderRadius: '12px', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Saturday 4 July 2026 — Champions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    {[
                      { division: "Men's", winner: 'kiwigyver' },
                      { division: "Women's", winner: 'Meredith' },
                      { division: 'Masters Men (40+)', winner: 'Blair' },
                      { division: 'Masters Women (40+)', winner: 'Tarsh' },
                    ].map(w => (
                      <div key={w.division} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', borderBottom: '1px solid #1e1e1e', paddingBottom: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--grey)' }}>{w.division}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--purple)', lineHeight: 1, textAlign: 'right' }}>{w.winner}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: 'var(--black)', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            SECURE YOUR <RainbowText>SPOT</RainbowText>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Register once. Turn up Tuesday, Thursday or Saturday.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '17px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}
