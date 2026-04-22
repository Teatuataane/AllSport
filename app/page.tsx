'use client'

import { useState } from 'react'
import Link from 'next/link'

const domains = [
  {
    name: 'Maximal Strength',
    icon: '🏋️',
    color: '#e63946',
    events: ['1A Press', 'Deadlift', 'OHP', 'Pause Dips', 'Pause Chinup', 'Pause Squat', 'Zercher Dead', 'Ham Curl', 'Pause Bench', 'Turkish'],
  },
  {
    name: 'Relative Strength',
    icon: '💪',
    color: '#f4a226',
    events: ['1L Squat', 'Flag', 'Windshield Wipers', 'Toe Lift', 'Planche', 'Back Lever', 'Iron Cross', 'Front Lever', 'Chin Lift', 'Climbing'],
  },
  {
    name: 'Muscular Endurance',
    icon: '🔄',
    color: '#f7e03c',
    events: ['Chinup Contest', 'Pushup Contest', 'Reverse Hyper', 'L Sit Hold', 'Tib Curl', 'Headstand', 'Finger Pushup', 'Calf Raise', 'Leg Ext', 'Ab Rollout'],
  },
  {
    name: 'Flexibility & Mobility',
    icon: '🤸',
    color: '#2d9e4f',
    events: ['Rear Hand Clasp', 'Bridge', 'Forward Fold', 'Needle Pose', 'F Split', 'M Split', 'Standing Split', 'Foot Behind Head Pose', 'Shoulder Dislocate', 'Side Bend'],
  },
  {
    name: 'Power',
    icon: '⚡',
    color: '#2563eb',
    events: ['Kelly Snatch', '1A Snatch', 'Triple Jump', 'Javelin', 'Shotput', 'AFL', 'Vert Jump', 'Glute Bridge', 'Clean & Jerk', 'Snatch'],
  },
  {
    name: 'Aerobic Endurance',
    icon: '🫀',
    color: '#9333ea',
    events: ['Burpee Broad Jump', '1k Run', '1k Cycle', 'Ski 1k', '1k Row', 'Iron Lungs', '200m Carry', '2k Run', '200m Repeats', 'Bronco'],
  },
  {
    name: 'Speed & Agility',
    icon: '🏃',
    color: '#e63946',
    events: ['100m Sprint', 'Tag', 'T Race', '400m Race', 'Beach Flags', '50m Sprint', '200m Sprint', 'Touch Rugby', 'Football Dribble', 'Repeat High Jump'],
  },
  {
    name: 'Body Awareness',
    icon: '🥋',
    color: '#f4a226',
    events: ['Tae Kwon Do', 'Breakdancing', 'Trampolining', 'Jump Rope', 'Wrestling', 'Gymnastics', 'Balance Ball', 'Skate', 'Fencing', 'Juggling'],
  },
  {
    name: 'Co-ordination',
    icon: '🏐',
    color: '#2d9e4f',
    events: ['Volleyball', 'Baseball', 'Teqball', 'Tennis', 'Cricket', 'Badminton', 'Basketball', 'Football', 'Hockey', 'Squash'],
  },
  {
    name: 'Aim & Precision',
    icon: '🎯',
    color: '#2563eb',
    events: ['Netball', 'Handball', 'Cornhole', 'Dodgeball', 'Carrom', 'Archery', 'Bowling', 'Darts', 'Disc Golf', 'Golf'],
  },
]

const ethos = [
  {
    word: 'Mahi',
    meaning: 'Work / Effort',
    desc: 'AllSport is built on showing up. Every session counts, every rep matters. Effort is the most honest measure of who you are.',
    color: '#e63946',
  },
  {
    word: 'Mauri',
    meaning: 'Spirit / Life Force',
    desc: 'We built AllSport to remove every barrier — cost, experience, fitness level. Your spirit, not your starting point, determines your journey.',
    color: '#2d9e4f',
  },
  {
    word: 'Mana',
    meaning: 'Power / Influence',
    desc: 'Earned through persistence, not talent. The more you put in, the more you earn. That\'s how mana works.',
    color: '#2563eb',
  },
]

const ranks = [
  { name: 'Mā', meaning: 'White', color: '#e8e8e8', num: 1 },
  { name: 'Kiwikiwi', meaning: 'Grey', color: '#888888', num: 2 },
  { name: 'Whero', meaning: 'Red', color: '#e63946', num: 3 },
  { name: 'Karaka', meaning: 'Orange', color: '#f4a226', num: 4 },
  { name: 'Kōwhai', meaning: 'Yellow', color: '#f7e03c', num: 5 },
  { name: 'Kākāriki', meaning: 'Green', color: '#2d9e4f', num: 6 },
  { name: 'Kahurangi', meaning: 'Blue', color: '#2563eb', num: 7 },
  { name: 'Poroporo', meaning: 'Purple', color: '#9333ea', num: 8 },
  { name: 'Uenuku', meaning: 'Rainbow', color: '#f4a226', num: 9 },
  { name: 'Taniwha', meaning: 'The Highest', color: '#000000', num: 10 },
]

const stats = [
  { value: '10', label: 'Disciplines', color: 'linear-gradient(90deg, #e63946, #f4a226)' },
  { value: '100', label: 'Events', color: 'linear-gradient(90deg, #2d9e4f, #2563eb)' },
  { value: '0', label: 'Experience needed', color: 'linear-gradient(90deg, #2563eb, #9333ea)' },
]

export default function Home() {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)

  return (
    <>
      <style>{`
        .domain-card { background: #111111; border: 1px solid #1e1e1e; transition: all 0.2s; cursor: pointer; }
        .domain-card:hover { background: #161616; border-color: #333; }
        .ethos-card { background: #111111; border: 1px solid #1e1e1e; padding: 40px 32px; position: relative; overflow: hidden; }
        .rank-row { display: flex; align-items: center; gap: 20px; padding: 14px 20px; border: 1px solid #1a1a1a; background: #0d0d0d; transition: background 0.2s; }
        .rank-row:hover { background: #141414; }
        .event-pill { display: inline-block; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; background: #1a1a1a; color: #666; border: 1px solid #222; margin: 2px; }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }
      `}</style>

      {/* HERO */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: '#000000',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.3 }} />
        <div style={{ position: 'absolute', top: '10%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(230,57,70,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, paddingTop: '120px', paddingBottom: '80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'center' }}>

            {/* Left — text */}
            <div>
              <div className="tag">Ōtautahi, Aotearoa</div>

              <h1 style={{ fontSize: 'clamp(56px, 9vw, 120px)', color: '#ffffff', lineHeight: 0.9, fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.03em', marginBottom: '4px' }}>PLAY</h1>
              <h1 style={{
                fontSize: 'clamp(40px, 7vw, 96px)',
                lineHeight: 0.9,
                fontFamily: 'Bebas Neue, cursive',
                letterSpacing: '0.03em',
                marginBottom: '32px',
                background: 'linear-gradient(90deg, #e63946, #f4a226, #f7e03c, #2d9e4f, #2563eb, #9333ea)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                whiteSpace: 'nowrap',
              }}>EVERYTHING</h1>

              <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />

              <p style={{ fontSize: 'clamp(17px, 2vw, 21px)', color: '#cccccc', lineHeight: 1.65, marginBottom: '16px' }}>
                Get good at everything, all at once. Strength, flexibility, power, coordination, endurance — trained simultaneously, every session.
              </p>
              <p style={{ fontSize: 'clamp(15px, 1.6vw, 17px)', color: '#888888', lineHeight: 1.7, marginBottom: '40px' }}>
                Save time. Avoid injury. Spend less. Have some damn fun doing it.
              </p>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '56px' }}>
                <Link href="/register" className="btn btn-primary" style={{ fontSize: '20px' }}>Register Now</Link>
                <Link href="/how-to-play" className="btn btn-outline" style={{ fontSize: '20px' }}>How It Works</Link>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '0', borderTop: '1px solid #1e1e1e', flexWrap: 'wrap' }}>
                {stats.map((stat, i) => (
                  <div key={stat.label} style={{ padding: '24px 40px 24px 0', marginRight: '40px', borderRight: i < stats.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
                    <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '52px', lineHeight: 1, background: stat.color, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{stat.value}</div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555555', marginTop: '4px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — logo */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src="/logo.png"
                alt="AllSport"
                style={{
                  width: '100%',
                  maxWidth: '460px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 60px rgba(230,57,70,0.2))',
                  animation: 'float 6s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#333333', fontSize: '11px', letterSpacing: '0.2em', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
          Scroll
          <div style={{ width: '1px', height: '40px', background: 'linear-gradient(to bottom, #333333, transparent)' }} />
        </div>
      </section>

      {/* WHAT IS ALLSPORT — red */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #e63946' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="tag">What Is AllSport</div>
              <h2 style={{ fontSize: 'clamp(40px, 5vw, 68px)', marginBottom: '8px', lineHeight: 1 }}>
                DESIGNED TO IMPROVE YOU<br />AT <span style={{ color: '#e63946' }}>EVERY SPORT.</span>
              </h2>
              <div className="divider" />
              <p style={{ color: '#cccccc', fontSize: '17px', lineHeight: 1.8, marginBottom: '20px' }}>
                Every sport you've ever played only tested a fraction of your ability. Running tests speed and endurance, but not strength. Gymnastics tests strength, flexibility and body awareness, but not hand-eye coordination. <strong style={{ color: '#ffffff' }}>AllSport tests all of you — simultaneously.</strong>
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
                Every session covers 10 disciplines drawn from 100 events. One event per domain, chosen fresh each session. Strength, flexibility, power, coordination, endurance — all in 100 minutes.
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '32px' }}>
                The same system that challenges elite competitors will rebuild someone returning from injury. That's not a coincidence — it's the design.
              </p>
              <Link href="/how-to-play" className="btn btn-primary">Learn The Rules</Link>
            </div>

            {/* Domain accordion */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {domains.map((domain, idx) => {
                const isOpen = expandedDomain === domain.name
                return (
                  <div
                    key={domain.name}
                    className="domain-card"
                    onClick={() => setExpandedDomain(isOpen ? null : domain.name)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{domain.icon}</span>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: isOpen ? domain.color : '#cccccc', flex: 1 }}>
                        {domain.name}
                      </span>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', color: '#444', marginRight: '4px' }}>10 events</span>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: domain.color, flexShrink: 0 }} />
                      <span style={{ color: '#444', fontSize: '14px', marginLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '0 16px 12px', borderTop: `1px solid ${domain.color}22` }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', paddingTop: '10px' }}>
                          {domain.events.map(event => (
                            <span key={event} className="event-pill">{event}</span>
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

      {/* EARN YOUR COLOURS — blue */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #2563eb' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="tag">The Colour System</div>
              <h2 style={{ fontSize: 'clamp(44px, 6vw, 72px)', lineHeight: 1, marginBottom: '8px' }}>
                EARN YOUR<br />
                <span style={{ background: 'linear-gradient(90deg, #e63946, #f4a226, #f7e03c, #2d9e4f, #2563eb, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>COLOURS</span>
              </h2>
              <div className="rainbow-line" style={{ width: '60px', marginBottom: '32px' }} />
              <p style={{ color: '#cccccc', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                AllSport's colour system follows the light spectrum — mirroring your growth in mana. Each colour must be earned through effort and persistence. There are no shortcuts.
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
                The journey from Mā to Taniwha is the journey from beginner to all-round athlete.
              </p>
              <p style={{ color: '#555555', fontSize: '14px', lineHeight: 1.8, fontStyle: 'italic' }}>
                The Taniwha — our highest grade — is depicted in the AllSport emblem. Few will ever earn it.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {ranks.map(rank => (
                <div key={rank.name} className="rank-row">
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: rank.name === 'Uenuku'
                      ? 'linear-gradient(135deg, #e63946, #f4a226, #2d9e4f, #2563eb, #9333ea)'
                      : rank.name === 'Taniwha' ? '#000000' : rank.color,
                    border: rank.name === 'Taniwha' ? '1px solid #555555' : 'none',
                    boxShadow: rank.name === 'Taniwha' ? '0 0 6px #ffffff33' : `0 0 6px ${rank.color}55`,
                  }} />
                  <div style={{
                    fontFamily: 'Bebas Neue, cursive', fontSize: '20px',
                    color: rank.name === 'Taniwha' ? '#ffffff' : rank.color,
                    minWidth: '150px', letterSpacing: '0.05em',
                  }}>{rank.name}</div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444444' }}>{rank.meaning}</div>
                  <div style={{ marginLeft: 'auto', fontFamily: 'Bebas Neue, cursive', fontSize: '16px', color: '#2a2a2a' }}>{rank.num}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ETHOS — green */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #2d9e4f' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="tag" style={{ display: 'inline-block' }}>Our Ethos</div>
            <h2 style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>MAHI. MAURI. <span style={{ color: '#2d9e4f' }}>MANA.</span></h2>
            <div className="divider" style={{ background: '#2d9e4f', margin: '16px auto 0' }} />
            <p style={{ color: '#888888', fontSize: '16px', maxWidth: '560px', margin: '24px auto 0', lineHeight: 1.7 }}>
              Three kupu (words) that represent what we stand for — and what we expect of every competitor that steps through the door.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {ethos.map(e => (
              <div key={e.word} className="ethos-card">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: e.color }} />
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '64px', color: e.color, lineHeight: 1, marginBottom: '4px' }}>{e.word}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '13px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '16px' }}>{e.meaning}</div>
                <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.7 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — purple */}
      <section style={{ padding: '100px 0', background: '#0a0a0a', textAlign: 'center', position: 'relative', overflow: 'hidden', borderTop: '3px solid #9333ea' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.3 }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag" style={{ display: 'inline-block' }}>Sessions in Ōtautahi</div>
          <h2 style={{ fontSize: 'clamp(48px, 8vw, 96px)', marginBottom: '24px' }}>
            READY TO <span style={{ color: '#9333ea' }}>PLAY?</span>
          </h2>
          <div className="rainbow-line" style={{ width: '80px', margin: '0 auto 32px' }} />
          <p style={{ color: '#888888', fontSize: '18px', maxWidth: '480px', margin: '0 auto 40px', lineHeight: 1.7 }}>
            No experience needed. No specialist skills required. Just show up and give what you have today.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary" style={{ fontSize: '22px' }}>Register Now</Link>
            <Link href="/schedule" className="btn btn-outline" style={{ fontSize: '22px' }}>View Schedule</Link>
          </div>
        </div>
      </section>
    </>
  )
}
