'use client'

import { useState } from 'react'
import Link from 'next/link'

const domains = [
  {
    name: 'Maximal Strength',
    icon: '🏋️',
    color: '#e63946',
    desc: 'How much can you lift? Absolute strength tested to its limit.',
    events: ['1A Press', 'Deadlift', 'OHP', 'Pause Dips', 'Pause Chinup', 'Pause Squat', 'Zercher Dead', 'Ham Curl', 'Pause Bench', 'Turkish'],
  },
  {
    name: 'Relative Strength',
    icon: '💪',
    color: '#f4a226',
    desc: 'Strength relative to your bodyweight. Calisthenics, skills, and feats.',
    events: ['1L Squat', 'Flag', 'Windshield Wipers', 'Toe Lift', 'Planche', 'Back Lever', 'Iron Cross', 'Front Lever', 'Chin Lift', 'Climbing'],
  },
  {
    name: 'Muscular Endurance',
    icon: '🔄',
    color: '#f7e03c',
    desc: 'How long can you keep going? Sustained output under fatigue.',
    events: ['Chinup Contest', 'Pushup Contest', 'Reverse Hyper', 'L Sit Hold', 'Tib Curl', 'Headstand', 'Finger Pushup', 'Calf Raise', 'Leg Ext', 'Ab Rollout'],
  },
  {
    name: 'Flexibility & Mobility',
    icon: '🤸',
    color: '#2d9e4f',
    desc: 'The range you have is the range you can use.',
    events: ['Rear Hand Clasp', 'Bridge', 'Forward Fold', 'Needle Pose', 'F Split', 'M Split', 'Standing Split', 'Foot Behind Head Pose', 'Shoulder Dislocate', 'Side Bend'],
  },
  {
    name: 'Power',
    icon: '⚡',
    color: '#2563eb',
    desc: 'Strength applied fast. Explosiveness through full range of motion.',
    events: ['Kelly Snatch', '1A Snatch', 'Triple Jump', 'Javelin', 'Shotput', 'AFL', 'Vert Jump', 'Glute Bridge', 'Clean & Jerk', 'Snatch'],
  },
  {
    name: 'Aerobic Endurance',
    icon: '🫀',
    color: '#9333ea',
    desc: 'Keep going, even when it hurts. The engine that runs everything else.',
    events: ['Burpee Broad Jump', '1k Run', '1k Cycle', 'Ski 1k', '1k Row', 'Iron Lungs', '200m Carry', '2k Run', '200m Repeats', 'Bronco'],
  },
  {
    name: 'Speed & Agility',
    icon: '🏃',
    color: '#e63946',
    desc: 'React faster, move better, change direction without losing a step.',
    events: ['100m Sprint', 'Tag', 'T Race', '400m Race', 'Beach Flags', '50m Sprint', '200m Sprint', 'Touch Rugby', 'Football Dribble', 'Repeat High Jump'],
  },
  {
    name: 'Body Awareness',
    icon: '🥋',
    color: '#f4a226',
    desc: 'Control your body in space. Without control there is no grace.',
    events: ['Tae Kwon Do', 'Breakdancing', 'Trampolining', 'Jump Rope', 'Wrestling', 'Gymnastics', 'Balance Ball', 'Skate', 'Fencing', 'Juggling'],
  },
  {
    name: 'Co-ordination',
    icon: '🏐',
    color: '#2d9e4f',
    desc: 'Hand-eye, timing, anticipation. The athletic skills behind every sport.',
    events: ['Volleyball', 'Baseball', 'Teqball', 'Tennis', 'Cricket', 'Badminton', 'Basketball', 'Football', 'Hockey', 'Squash'],
  },
  {
    name: 'Aim & Precision',
    icon: '🎯',
    color: '#2563eb',
    desc: 'When you shoot, it hits. Accuracy and composure under pressure.',
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

const steps = [
  {
    number: '01',
    title: 'Register',
    desc: 'Sign up online — no experience required. If you can move, you can play.',
  },
  {
    number: '02',
    title: 'Show Up',
    desc: 'Arrive at your local session. Wear comfortable training gear. Bring water. Everything else is provided or explained on the day.',
  },
  {
    number: '03',
    title: 'Learn The Events',
    desc: 'At the start of each session, the 10 events are announced — one drawn from each discipline. Each event is explained before it begins. First time? You\'ll be guided through everything.',
  },
  {
    number: '04',
    title: 'Compete',
    desc: 'Work through all 10 events across the 100-minute session. AllSport is designed for the long term — give what is appropriate for the day and come back next time.',
  },
  {
    number: '05',
    title: 'Get Placed',
    desc: 'In each event, players are ranked by their result. Your placement in each event (1st, 2nd, 3rd...) is recorded. Lowest total placement across all 10 events wins. Points are awarded based on placement, and stack across sessions toward your grade.',
  },
  {
    number: '06',
    title: 'Earn Your Colours',
    desc: 'Your session points build your annual total. From Mā (White) all the way to Taniwha (Black) — the AllSport equivalent of a black belt.',
  },
]

const bonuses = [
  { label: 'Attend a session', points: '+10' },
  { label: 'Set a personal best', points: '+10 per event' },
  { label: 'Top performance in an event', points: '+10 per division' },
  { label: 'First session ever', points: '+10' },
  { label: 'Consistency streak (4 of last 5)', points: '+10' },
  { label: 'Championship participation', points: '+100' },
  { label: 'Championship podium', points: '+500' },
]

const divisions = [
  { name: 'Youth', age: 'Under 12' },
  { name: 'Juniors', age: 'Under 17' },
  { name: "Men's", age: '17–39' },
  { name: "Women's", age: '17–39' },
  { name: 'Masters Men', age: '40–59' },
  { name: 'Masters Women', age: '40–59' },
  { name: 'Grandmasters Men', age: '60+' },
  { name: 'Grandmasters Women', age: '60+' },
]

export default function HowToPlay() {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)

  return (
    <>
      <style>{`
        .domain-card-htp { background: #111111; border: 1px solid #1e1e1e; transition: all 0.2s; cursor: pointer; }
        .domain-card-htp:hover { background: #161616; border-color: #333; }
        .event-pill { display: inline-block; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; background: #1a1a1a; color: #666; border: 1px solid #222; margin: 2px; }
        .ethos-card { background: #111111; border: 1px solid #1e1e1e; padding: 40px 32px; position: relative; overflow: hidden; }
        .checklist-item { display: flex; align-items: center; gap: 16px; background: #111111; border: 1px solid #1e1e1e; padding: 16px 20px; }
        .bonus-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1a1a1a; }
      `}</style>

      {/* Hero — red */}
      <section style={{ paddingTop: '152px', paddingBottom: '80px', background: '#000000', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(230,57,70,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">The Game</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, marginBottom: '8px' }}>
            HOW TO<br />
            <span style={{ background: 'linear-gradient(90deg, #e63946, #f4a226)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>PLAY</span>
          </h1>
          <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />
          <p style={{ color: '#cccccc', fontSize: '20px', maxWidth: '620px', lineHeight: 1.7 }}>
            AllSport is the first sport designed to test your ability across every form of athleticism. Ten disciplines. One hundred events in rotation. No two sessions are ever the same.
          </p>
        </div>
      </section>

      {/* What to expect — orange */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #f4a226' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'start' }}>
            <div>
              <div className="tag">For First Timers</div>
              <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>WHAT TO <span style={{ color: '#f4a226' }}>EXPECT</span></h2>
              <div className="divider" style={{ background: '#f4a226' }} />
              <p style={{ color: '#cccccc', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                Walk in knowing nothing — that's completely fine. Every event is explained before it starts. There are no prerequisites, no minimum fitness level, and no specialist equipment required.
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
                AllSport is designed for the long term. It's meant to be fun, accessible, and sustainable. You don't need to push to your limit every session — showing up consistently is what creates results.
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8 }}>
                Scoring is placement-based — you compete relative to everyone else in the room, not against a fixed standard. Come last in every event today and still earn points. Come back next week and beat yourself.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { icon: '👟', text: 'Wear comfortable training gear' },
                { icon: '💧', text: 'Bring water and a towel' },
                { icon: '⏰', text: 'Arrive 10 minutes before the session starts' },
                { icon: '📋', text: 'Events are announced and explained at the start' },
                { icon: '🤝', text: 'First timers are guided through every event' },
                { icon: '📱', text: 'Scores are logged digitally in real time' },
              ].map(item => (
                <div key={item.text} className="checklist-item">
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: '15px', color: '#cccccc' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Steps — green */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #2d9e4f' }}>
        <div className="container">
          <div className="tag">Step By Step</div>
          <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>HOW IT <span style={{ color: '#2d9e4f' }}>WORKS</span></h2>
          <div className="divider" style={{ background: '#2d9e4f' }} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
            {steps.map((step, i) => (
              <div key={step.number} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '32px', alignItems: 'start', padding: '32px 0', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '72px', color: i === 0 ? '#2d9e4f' : '#1e1e1e', lineHeight: 1 }}>{step.number}</div>
                <div style={{ paddingTop: '8px' }}>
                  <h3 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '36px', color: '#ffffff', marginBottom: '8px' }}>{step.title}</h3>
                  <p style={{ color: '#888888', fontSize: '16px', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring — blue */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #2563eb' }}>
        <div className="container">
          <div className="tag">Scoring System</div>
          <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>HOW YOU'RE <span style={{ color: '#2563eb' }}>SCORED</span></h2>
          <div className="divider" style={{ background: '#2563eb' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', marginTop: '8px', alignItems: 'start' }}>
            {/* Placement explanation */}
            <div>
              <h3 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#fff', marginBottom: '12px' }}>Placement-Based</h3>
              <p style={{ color: '#cccccc', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                In each event, players are ranked by their result. Your placement — 1st, 2nd, 3rd — is recorded. <strong style={{ color: '#ffffff' }}>Lowest total placement score wins.</strong>
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
                This rewards consistency. A player who finishes 3rd in every event will beat one who wins two events but finishes last in the rest.
              </p>
              <p style={{ color: '#555555', fontSize: '14px', lineHeight: 1.8, fontStyle: 'italic' }}>
                Tied results share the same placement. If two players tie for 2nd, both receive 2nd place and the next player receives 4th.
              </p>
            </div>

            {/* Points formula */}
            <div style={{ background: '#111111', border: '1px solid #1e1e1e', padding: '28px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '20px' }}>Points Formula</div>
              <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.7, marginBottom: '16px' }}>
                1st place always earns <strong style={{ color: '#fff' }}>100 points</strong>. Each subsequent place drops by a gap calculated from session size.
              </p>
              {[
                { size: '5 players', gap: '20 pts', example: '100 / 80 / 60 / 40 / 20' },
                { size: '10 players', gap: '10 pts', example: '100 / 90 / 80 / ... / 10' },
                { size: '20+ players', gap: 'min 10 pts', example: '100 / 90 / 80 / ... / 10' },
              ].map(row => (
                <div key={row.size} style={{ padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '13px', color: '#ccc' }}>{row.size}</span>
                    <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '16px', color: '#2563eb' }}>{row.gap}</span>
                  </div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', color: '#444', letterSpacing: '0.05em' }}>{row.example}</div>
                </div>
              ))}
              <div style={{ marginTop: '16px', padding: '12px', background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Minimum earn</div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '32px', color: '#2563eb' }}>10 Points</div>
              </div>
            </div>

            {/* Bonuses */}
            <div style={{ background: '#111111', border: '1px solid #1e1e1e', padding: '28px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '20px' }}>Bonus Points</div>
              {bonuses.map(b => (
                <div key={b.label} className="bonus-row">
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: '14px', color: '#cccccc' }}>{b.label}</span>
                  <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '18px', color: '#2d9e4f', flexShrink: 0, marginLeft: '12px' }}>{b.points}</span>
                </div>
              ))}
            </div>

            {/* Divisions */}
            <div style={{ background: '#111111', border: '1px solid #1e1e1e', padding: '28px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Divisions</div>
              <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>You compete only within your own division — 1st place is awarded once per division per session. Your division is auto-calculated from your age and gender at registration.</p>
              {divisions.map(d => (
                <div key={d.name} className="bonus-row">
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: '14px', color: '#cccccc' }}>{d.name}</span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: '#555', flexShrink: 0, marginLeft: '12px' }}>{d.age}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 10 Disciplines — purple, with accordion */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #9333ea' }}>
        <div className="container">
          <div className="tag">The 10 Disciplines</div>
          <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>EVENT <span style={{ color: '#9333ea' }}>DOMAINS</span></h2>
          <div className="divider" style={{ background: '#9333ea' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '680px', marginBottom: '8px', lineHeight: 1.7 }}>
            Each session, one event is drawn at random from each of the 10 domains below — 10 events in total. Our annual Championship events are chosen by community vote.
          </p>
          <p style={{ color: '#555555', fontSize: '14px', maxWidth: '680px', marginBottom: '24px', lineHeight: 1.7 }}>
            100 events in total across all domains. Click any domain to see its full event list.
          </p>
          <Link href="/events" style={{ display: 'inline-block', marginBottom: '32px', padding: '9px 20px', borderRadius: '8px', background: '#111', border: '1px solid #333', color: '#ccc', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none', textTransform: 'uppercase' }}>
            Browse All 100 Events →
          </Link>
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
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{domain.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: isOpen ? domain.color : '#ffffff', letterSpacing: '0.04em', lineHeight: 1 }}>
                        {domain.name}
                      </div>
                      {!isOpen && (
                        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: '#555', marginTop: '2px' }}>{domain.desc}</div>
                      )}
                    </div>
                    <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', color: '#333', marginRight: '8px', flexShrink: 0 }}>10 events</span>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: domain.color, flexShrink: 0 }} />
                    <span style={{ color: '#333', fontSize: '13px', marginLeft: '6px' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${domain.color}33` }}>
                      <p style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', color: '#666', marginBottom: '12px', paddingTop: '12px' }}>{domain.desc}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {domain.events.map(event => (
                          <span key={event} className="event-pill">{event}</span>
                        ))}
                      </div>
                      <Link href="/events" style={{ display: 'inline-block', marginTop: '12px', fontSize: '12px', color: '#2371BB', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.05em', textDecoration: 'none' }}>
                        View full event details →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Ethos — rainbow */}
      <section className="section" style={{ background: '#0d0d0d' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #e63946, #f4a226, #f7e03c, #2d9e4f, #2563eb, #9333ea)', marginTop: '-80px', marginBottom: '80px' }} />
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="tag" style={{ display: 'inline-block' }}>Our Ethos</div>
            <h2 style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>MAHI. MAURI. <span style={{ color: '#2d9e4f' }}>MANA.</span></h2>
            <div className="rainbow-line" style={{ width: '80px', margin: '16px auto 0' }} />
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

      {/* CTA */}
      <section style={{ padding: '80px 0', background: '#000000', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            READY TO <span style={{ background: 'linear-gradient(90deg, #e63946, #f4a226)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>PLAY?</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px' }} />
          <p style={{ color: '#888888', fontSize: '16px', marginBottom: '32px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            No experience needed. No specialist skills required. Just show up and give what you have today.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '20px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}
