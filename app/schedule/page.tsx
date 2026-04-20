'use client'

import Link from 'next/link'

const sessions = [
  { day: 'Tuesday', time: '5:00 PM', duration: '100 mins', spots: 100 },
  { day: 'Thursday', time: '5:00 PM', duration: '100 mins', spots: 100 },
  { day: 'Saturday', time: '9:00 AM', duration: '100 mins', spots: 100 },
]

const dayColors = ['#e63946', '#2d9e4f', '#2563eb']

export default function Schedule() {
  return (
    <>
      <style>{`
        .session-card { background: #111111; border: 1px solid #1e1e1e; padding: 32px; transition: border-color 0.2s; }
        .session-card:hover { border-color: #333; }
        .info-card { background: #111111; border: 1px solid #1e1e1e; padding: 28px; }
      `}</style>

      {/* Hero — red */}
      <section style={{ paddingTop: '152px', paddingBottom: '80px', background: '#000000', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(45,158,79,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Ōtautahi, Aotearoa</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, marginBottom: '8px' }}>
            SESSION<br />
            <span style={{
              background: 'linear-gradient(90deg, #2d9e4f, #2563eb)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>SCHEDULE</span>
          </h1>
          <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />
          <p style={{ color: '#cccccc', fontSize: '20px', maxWidth: '560px', lineHeight: 1.7 }}>
            Three sessions per week at AllSport HQ in Ōtautahi. Register online, show up, and compete. No experience needed.
          </p>
        </div>
      </section>

      {/* Weekly schedule — green */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #2d9e4f' }}>
        <div className="container">
          <div className="tag">Weekly Sessions</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
            WHEN WE <span style={{ color: '#2d9e4f' }}>PLAY</span>
          </h2>
          <div className="divider" style={{ background: '#2d9e4f' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '32px' }}>
            {sessions.map((session, i) => (
              <div key={session.day} className="session-card" style={{ borderTop: `3px solid ${dayColors[i]}` }}>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '48px', color: dayColors[i], lineHeight: 1, marginBottom: '4px' }}>{session.day}</div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#ffffff', marginBottom: '16px' }}>{session.time}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Duration', value: session.duration },
                    { label: 'Capacity', value: `${session.spots} players` },
                    { label: 'Entry', value: 'Register online' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: '8px' }}>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555555' }}>{item.label}</span>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: '14px', color: '#cccccc' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register" className="btn btn-primary" style={{ width: '100%', marginTop: '20px', fontSize: '16px', padding: '12px', display: 'block', textAlign: 'center' }}>
                  Register
                </Link>
              </div>
            ))}
          </div>

          <p style={{ color: '#444444', fontSize: '13px', fontStyle: 'italic' }}>
            * Session times may vary on public holidays. Check back regularly or register to receive updates.
          </p>
        </div>
      </section>

      {/* Venue — blue */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #2563eb' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="tag">The Venue</div>
              <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
                ALLSPORT <span style={{ color: '#2563eb' }}>HQ</span>
              </h2>
              <div className="divider" style={{ background: '#2563eb' }} />
              <p style={{ color: '#cccccc', fontSize: '17px', lineHeight: 1.8, marginBottom: '8px' }}>
                26 Carbine Place<br />Sockburn, Ōtautahi
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '24px' }}>
                AllSport HQ is our dedicated training facility in Sockburn. All equipment needed for sessions is provided on site. Free parking available.
              </p>
              <p style={{ color: '#555555', fontSize: '14px', lineHeight: 1.7, fontStyle: 'italic' }}>
                More locations coming to Ōtautahi soon — register to be notified when new venues are added.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { icon: '📍', title: 'Address', desc: '26 Carbine Place, Sockburn, Ōtautahi' },
                { icon: '🚗', title: 'Parking', desc: 'Free parking available on site' },
                { icon: '🏋️', title: 'Equipment', desc: 'All equipment provided — just bring yourself' },
                { icon: '🚿', title: 'Facilities', desc: 'Changing rooms available on site' },
              ].map(item => (
                <div key={item.title} className="info-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '22px', marginTop: '2px' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555555', marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ color: '#cccccc', fontSize: '15px' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tournament — gold */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #f4a226' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, #0d0800 0%, #0d0d0d 100%)',
            border: '1px solid #f4a22633',
            padding: '56px 48px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(244,162,38,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #f4a226, #f7e03c)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'center' }}>
              <div>
                <div className="tag">Once a Year</div>
                <h2 style={{ fontSize: 'clamp(40px, 5vw, 68px)', marginBottom: '8px', lineHeight: 1 }}>
                  THE ANNUAL<br /><span style={{ color: '#f4a226' }}>GAMES</span>
                </h2>
                <div className="divider" style={{ background: '#f4a226' }} />
                <p style={{ color: '#cccccc', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                  Once per year, the AllSport community comes together for the annual tournament — the ultimate test of all-round athletic ability. Every discipline. Full competition. Maximum mana on the line.
                </p>
                <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '32px' }}>
                  Open to all registered players. Rankings, reputation, and the title of AllSport Champion decided in a single day.
                </p>
                <Link href="/register" className="btn btn-gold" style={{ fontSize: '18px' }}>
                  Register to Compete
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#0a0a0a', border: '1px solid #f4a22633', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Date</div>
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '36px', color: '#f4a226', lineHeight: 1 }}>Sunday 19 April 2026</div>
                </div>
                <div style={{ background: '#0a0a0a', border: '1px solid #f4a22633', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Location</div>
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#ffffff', lineHeight: 1 }}>AllSport HQ</div>
                  <div style={{ color: '#888888', fontSize: '14px', marginTop: '4px' }}>26 Carbine Place, Sockburn, Ōtautahi</div>
                </div>
                <div style={{ background: '#0a0a0a', border: '1px solid #f4a22633', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Entry</div>
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#ffffff', lineHeight: 1 }}>Open to all registered players</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: '#000000', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            SECURE YOUR <span style={{
              background: 'linear-gradient(90deg, #2d9e4f, #2563eb)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>SPOT</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Register once and you're in. Show up Tuesday, Thursday, or Saturday — give what you have on the day.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '20px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}