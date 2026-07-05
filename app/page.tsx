'use client'

import { useState } from 'react'
import Link from 'next/link'

const RAINBOW = 'var(--rainbow)'

const rainbowText: React.CSSProperties = {
  background: RAINBOW,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const domains = [
  { name: 'Maximal Strength', color: '#EA4742', events: ['1A Press', 'Deadlift', 'Clean & Press', 'Pause Dips', 'Pause Chin Up', 'Pause Squat', 'Zercher Dead', 'Ham Curl', 'Pause Bench', 'Turkish Get Up', 'Sandbag to Shoulder'] },
  { name: 'Calisthenics', color: '#F9B051', events: ['1 Leg Squat', 'Flag', 'Windshield Wipers', 'Toe Lift', 'Planche', 'Back Lever', 'Iron Cross', 'Front Lever', 'Chin Hang', 'Climbing'] },
  { name: 'Power', color: '#F397C0', events: ['Kelly Snatch', '1A Snatch', 'Triple Jump', 'Javelin', 'Shotput', 'Australian Football', 'Vertical Jump', 'Handbalance', 'Clean & Jerk', 'Snatch'] },
  { name: 'Speed', color: '#B87DB5', events: ['100m Sprint', 'Tag', 'T-Race', '400m Race', 'Beach Flags', '50m Sprint', '200m Sprint', 'Touch Rugby', 'Football Dribble', 'Repeat High Jump', 'Rats & Rabbits', 'Speed Chess'] },
  { name: 'Anaerobic Endurance', color: '#2371BB', events: ['Chinup Contest', 'Pushup Contest', 'Reverse Hyper', 'L-Sit Hold', 'Tibialis Curl', 'Headstand', 'Finger Push Up', 'GHD Situp', 'Leg Extension', 'Ab Rollout'] },
  { name: 'Aerobic Endurance', color: '#4DB26E', events: ['Burpee Broad Jump', 'Running', 'Cycling', 'Ski Erg', 'Row Erg', 'Breath Hold', 'Weighted Carry', 'Duck Walk', 'Bronco', 'Walking'] },
  { name: 'Flexibility', color: '#EA4742', events: ['Rear Hand Clasp', 'Bridge', 'Forward Fold', 'Needle Pose', 'Forward Split', 'Middle Split', 'Standing Split', 'Foot Behind Head', 'Shoulder Dislocate', 'Pancake'] },
  { name: 'Body Awareness', color: '#F9B051', events: ['Tae Kwon Do', 'Breakdancing', 'Trampolining', 'Jump Rope', 'Wrestling', 'Gymnastics', 'Balance Ball', 'SKATE', 'Fencing', 'Juggling', 'Foot Juggling'] },
  { name: 'Coordination', color: '#2371BB', events: ['Volleyball', 'Baseball', 'Teqball', 'Tennis', 'Cricket', 'Badminton', 'Basketball', 'Football', 'Hockey', 'Squash'] },
  { name: 'Aim & Precision', color: '#4DB26E', events: ['Netball', 'Bocce', 'Dodgeball', 'Carrom', 'Archery', 'Kubb', 'Darts', 'Disc Golf', 'Golf', 'Ultimate Frisbee'] },
]

const ranks = [
  { te: 'Mā', en: 'White', c: '#e8e8e8', p: '0–499' },
  { te: 'Kiwikiwi', en: 'Grey', c: '#888888', p: '500' },
  { te: 'Whero', en: 'Red', c: '#EA4742', p: '1,000' },
  { te: 'Karaka', en: 'Orange', c: '#F9B051', p: '2,000' },
  { te: 'Kōwhai', en: 'Yellow', c: '#F9E051', p: '3,000' },
  { te: 'Kākāriki', en: 'Green', c: '#4DB26E', p: '4,000' },
  { te: 'Kahurangi', en: 'Blue', c: '#2371BB', p: '5,000' },
  { te: 'Poroporo', en: 'Purple', c: '#B87DB5', p: '6,000' },
  { te: 'Uenuku', en: 'Rainbow', c: 'rainbow', p: '8,000' },
  { te: 'Taniwha', en: 'The highest', c: '#000000', p: '10,000+' },
]

const ethos = [
  { word: 'Mahi', mean: 'Effort', color: '#EA4742', desc: "Effort is the only measure that counts here. Show up and give what you've got — that's the whole game." },
  { word: 'Mauri', mean: 'Spirit', color: '#4DB26E', desc: 'Every barrier removed — cost, kit, experience. Come exactly as you are, at any level or age.' },
  { word: 'Mana', mean: 'Standing', color: '#2371BB', desc: "Earned rep by rep, session by session. The more you put in, the more you grow. That's how mana works." },
]

const sessions = [
  { day: 'Tuesday', time: '4:30 PM', color: '#EA4742' },
  { day: 'Thursday', time: '4:30 PM', color: '#2371BB' },
  { day: 'Saturday', time: '9:00 AM', color: '#4DB26E' },
]

export default function Home() {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)

  return (
    <div className="landing">
      <style>{`
        .landing { background: #0a0a0a; }
        @keyframes lpfloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
        .lp-float { animation: lpfloat 6s ease-in-out infinite; }
        .lp-tag { display: inline-block; font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; padding: 5px 14px; border: 1px solid #2a2a2a; color: #888; border-radius: 2px; }
        .lp-btn { display: inline-block; font-family: 'Bebas Neue', cursive; font-size: 20px; letter-spacing: 0.08em; padding: 14px 40px; cursor: pointer; border: none; border-radius: 999px; transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s, border-color 0.2s; }
        .lp-btn:active { transform: scale(0.97); }
        .lp-primary { background: #EA4742; color: #fff; }
        .lp-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(234,71,66,0.4); }
        .lp-outline { background: transparent; color: #fff; border: 2px solid #2a2a2a; }
        .lp-outline:hover { border-color: #fff; transform: translateY(-2px); }
        .lp-rainbow { position: relative; background: #0a0a0a; color: #fff; }
        .lp-rainbow::before { content: ''; position: absolute; inset: 0; padding: 2px; border-radius: 999px; background: ${RAINBOW}; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
        .lp-rainbow:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(35,113,187,0.35); }
        .lp-domain { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; cursor: pointer; transition: border-color 0.2s, background 0.2s; overflow: hidden; }
        .lp-domain:hover { background: #161616; border-color: #333; }
        .lp-pill { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 10px; border-radius: 3px; background: #1a1a1a; color: #888; border: 1px solid #242424; }
        .lp-rank { display: flex; align-items: center; gap: 18px; padding: 14px 20px; border: 1px solid #1a1a1a; background: #0d0d0d; border-radius: 6px; transition: background 0.2s, transform 0.2s; }
        .lp-rank:hover { background: #141414; transform: translateX(4px); }
        .lp-rainbow-line { height: 4px; background: ${RAINBOW}; border-radius: 2px; }
      `}</style>

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden', background: '#000', padding: '140px 0 90px' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.35 }} />
        <div style={{ position: 'absolute', top: '8%', right: '4%', width: '460px', height: '460px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,71,66,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '6%', left: '2%', width: '460px', height: '460px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(35,113,187,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px', alignItems: 'center' }}>
            <div>
              <div className="lp-tag">Ōtautahi · Aotearoa</div>
              <h1 style={{ fontSize: 'clamp(52px, 8vw, 104px)', fontFamily: 'var(--font-display)', lineHeight: 0.9, letterSpacing: '0.03em', color: '#fff', margin: '18px 0 2px' }}>ONE SPORT,</h1>
              <h1 style={{ fontSize: 'clamp(52px, 8vw, 104px)', fontFamily: 'var(--font-display)', lineHeight: 0.9, letterSpacing: '0.03em', marginBottom: '26px', whiteSpace: 'nowrap', ...rainbowText }}>EVERY SPORT.</h1>

              <div className="lp-rainbow-line" style={{ width: '88px', marginBottom: '26px' }} />

              <p style={{ fontSize: 'clamp(18px, 2vw, 22px)', color: '#fff', lineHeight: 1.55, marginBottom: '14px', maxWidth: '540px' }}>
                One sport that makes you better at everything. One sport for everyone.
              </p>
              <p style={{ fontSize: '16px', color: '#cccccc', lineHeight: 1.7, marginBottom: '12px', maxWidth: '540px' }}>
                Strength, speed, flexibility, coordination and endurance — trained together, every session.
              </p>
              <p style={{ fontSize: '16px', color: '#888', lineHeight: 1.7, marginBottom: '26px', maxWidth: '540px' }}>
                The best part? No experience needed. Scale to any level and ability. Play solo or together with whānau!
              </p>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '12px', fontWeight: 700, color: '#4DB26E', border: '1px solid rgba(77,178,110,0.4)', background: 'rgba(77,178,110,0.08)', padding: '6px 14px', borderRadius: '999px', marginBottom: '28px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4DB26E' }} />
                Koha only — free, always
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '52px' }}>
                <Link href="/register" className="lp-btn lp-primary">Register Now</Link>
                <Link href="/how-to-play" className="lp-btn lp-outline">How It Works</Link>
              </div>

              <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #1e1e1e', flexWrap: 'wrap' }}>
                <div style={{ padding: '24px 40px 0 0', marginRight: '40px', borderRight: '1px solid #1e1e1e' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '54px', lineHeight: 1, background: 'linear-gradient(90deg,#EA4742,#F9B051)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>10</div>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666', marginTop: '4px' }}>Disciplines</div>
                </div>
                <div style={{ padding: '24px 40px 0 0', marginRight: '40px', borderRight: '1px solid #1e1e1e' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '54px', lineHeight: 1, background: 'linear-gradient(90deg,#4DB26E,#2371BB)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>100+</div>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666', marginTop: '4px' }}>Events</div>
                </div>
                <div style={{ padding: '24px 0 0 0' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '54px', lineHeight: 1, background: 'linear-gradient(90deg,#2371BB,#B87DB5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>0</div>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666', marginTop: '4px' }}>Experience needed</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img className="lp-float" src="/logo.png" alt="AllSport crest" style={{ width: '100%', maxWidth: '440px', objectFit: 'contain', filter: 'drop-shadow(0 0 60px rgba(234,71,66,0.22))' }} />
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IS ALLSPORT + DOMAINS */}
      <section id="domains" style={{ padding: '100px 0', background: '#0d0d0d', borderTop: '3px solid #EA4742' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="lp-tag">What is AllSport</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 5vw, 66px)', lineHeight: 0.9, letterSpacing: '0.03em', margin: '18px 0 8px', color: '#fff' }}>
                DESIGNED TO IMPROVE YOU<br />AT <span style={{ color: '#EA4742' }}>EVERY SPORT.</span>
              </h2>
              <div className="lp-rainbow-line" style={{ width: '60px', margin: '18px 0 28px' }} />
              <p style={{ color: '#cccccc', fontSize: '17px', lineHeight: 1.8, marginBottom: '20px' }}>
                Every sport you&apos;ve played tested only a fraction of you. Running tests speed, not strength. Gymnastics tests control, not hand-eye. <strong style={{ color: '#fff' }}>AllSport tests all of you — at once.</strong>
              </p>
              <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.8, marginBottom: '24px' }}>
                Ten domains, drawn from over one hundred events. One event per domain, chosen fresh each session. The same system that challenges an elite competitor rebuilds someone returning from injury. That&apos;s the design.
              </p>

              <div style={{ display: 'flex', gap: '36px', flexWrap: 'wrap', padding: '22px 0 6px', borderTop: '1px solid #1e1e1e', marginBottom: '28px' }}>
                {[
                  { n: '10', l: 'Disciplines', c: '#EA4742' },
                  { n: '100', l: 'Minutes a session', c: '#2371BB' },
                  { n: 'Lowest', l: 'Total placement wins', c: '#4DB26E' },
                ].map((s) => (
                  <div key={s.l}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '38px', lineHeight: 1, color: s.c }}>{s.n}</div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#666', marginTop: '4px' }}>{s.l}</div>
                  </div>
                ))}
              </div>

              <Link href="/how-to-play" className="lp-btn lp-primary">Learn The Rules</Link>
            </div>

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
          </div>
        </div>
      </section>

      {/* EARN YOUR COLOURS */}
      <section id="colours" style={{ padding: '100px 0', background: '#0a0a0a', borderTop: '3px solid #2371BB' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="lp-tag">The Colour System</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 6vw, 72px)', lineHeight: 0.9, letterSpacing: '0.03em', margin: '18px 0 10px', color: '#fff' }}>
                EARN YOUR<br /><span style={rainbowText}>COLOURS</span>
              </h2>
              <div className="lp-rainbow-line" style={{ width: '60px', marginBottom: '28px' }} />
              <p style={{ color: '#cccccc', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                AllSport&apos;s grades follow the light spectrum — a mirror of your growing mana. Each colour is earned through effort and persistence. There are no shortcuts.
              </p>
              <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
                The journey from Mā to Taniwha is the journey from beginner to complete all-round athlete.
              </p>
              <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.8, fontStyle: 'italic' }}>
                Taniwha — our highest grade — is the taniwha in our emblem. Few will ever earn it.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ranks.map((r) => {
                const bg = r.c === 'rainbow' ? 'linear-gradient(135deg,#EA4742,#F9B051,#4DB26E,#2371BB,#B87DB5)' : r.c
                const teColor = r.te === 'Taniwha' ? '#fff' : r.c === 'rainbow' ? '#fff' : r.c
                return (
                  <div key={r.te} className="lp-rank">
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0, background: bg, border: r.te === 'Taniwha' ? '1px solid #555' : 'none' }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', minWidth: '150px', letterSpacing: '0.04em', color: teColor }}>{r.te}</span>
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555' }}>{r.en}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-label)', fontSize: '13px', color: '#444', letterSpacing: '0.06em' }}>{r.p} pts</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ETHOS */}
      <section style={{ padding: '100px 0', background: '#0d0d0d', borderTop: '3px solid #4DB26E' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '620px', margin: '0 auto 44px' }}>
            <div className="lp-tag">Our kaupapa</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(34px, 4.5vw, 52px)', lineHeight: 0.9, letterSpacing: '0.03em', marginTop: '18px' }}>
              MAHI <span style={{ color: '#333' }}>·</span> MAURI <span style={{ color: '#333' }}>·</span> <span style={{ color: '#4DB26E' }}>MANA</span>
            </h2>
            <p style={{ color: '#888', fontSize: '16px', marginTop: '16px', lineHeight: 1.7 }}>
              Effort, spirit, standing — the three words we build every session around.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1px', background: '#1e1e1e', border: '1px solid #1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
            {ethos.map((e) => (
              <div key={e.word} style={{ background: '#0d0d0d', padding: '34px 30px' }}>
                <div style={{ width: '26px', height: '4px', borderRadius: '2px', background: e.color, marginBottom: '18px' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '34px', letterSpacing: '0.04em', color: e.color }}>{e.word}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666', margin: '4px 0 14px' }}>{e.mean}</div>
                <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.7 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SESSIONS */}
      <section id="sessions" style={{ padding: '100px 0', background: '#0a0a0a', borderTop: '3px solid #F9B051' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <div className="lp-tag">Train with us</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 0.9, letterSpacing: '0.03em', marginTop: '18px' }}>
              SESSIONS IN <span style={{ color: '#F9B051' }}>ŌTAUTAHI</span>
            </h2>
            <p style={{ color: '#888', fontSize: '15px', marginTop: '16px', letterSpacing: '0.02em' }}>AllSport HQ · 26 Carbine Place, Sockburn</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', maxWidth: '900px', margin: '0 auto' }}>
            {sessions.map((s) => (
              <div key={s.day} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '22px 26px', background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', letterSpacing: '0.04em', minWidth: '150px', color: s.color }}>{s.day}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '17px', letterSpacing: '0.06em', color: '#cccccc' }}>{s.time}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '36px' }}>
            <Link href="/schedule" className="lp-btn lp-outline">View Full Schedule</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '110px 0', background: '#0a0a0a', textAlign: 'center', position: 'relative', overflow: 'hidden', borderTop: '3px solid #B87DB5' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.3 }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(184,125,181,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="lp-tag">Mahi. Mauri. Mana.</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 8vw, 92px)', lineHeight: 0.9, letterSpacing: '0.03em', margin: '18px 0 22px', color: '#fff' }}>
            READY TO <span style={{ color: '#B87DB5' }}>PLAY?</span>
          </h2>
          <div className="lp-rainbow-line" style={{ width: '88px', margin: '0 auto 30px' }} />
          <p style={{ color: '#888', fontSize: '18px', maxWidth: '480px', margin: '0 auto 38px', lineHeight: 1.7 }}>
            Koha only. No fees, no barriers. Bring what you&apos;ve got and earn your first colour.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="lp-btn lp-primary" style={{ fontSize: '22px' }}>Register Now</Link>
            <Link href="/koha" className="lp-btn lp-rainbow" style={{ fontSize: '22px' }}>Give Koha</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
