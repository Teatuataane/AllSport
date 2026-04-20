'use client'

import Link from 'next/link'

const categories = [
  {
    name: 'Core Strength',
    icon: '🏋️',
    color: '#e63946',
    examples: 'Deadlifts, Turkish Getups, Dragon Flags',
    desc: 'A strong spine carries everything else.',
  },
  {
    name: 'Upper Body',
    icon: '💪',
    color: '#f4a226',
    examples: 'Bench Press, Chinups, Curls',
    desc: 'Your arms are how you interact with the world.',
  },
  {
    name: 'Lower Body',
    icon: '🦵',
    color: '#f7e03c',
    examples: 'Back Squat, Clean & Jerk, Glute Thrusts',
    desc: 'Your legs literally carry you.',
  },
  {
    name: 'Grip & Extremities',
    icon: '🤌',
    color: '#2d9e4f',
    examples: 'Finger Pushups, Wrist Curls, Tibialis Curls',
    desc: 'The small muscles that hold everything together.',
  },
  {
    name: 'Flexibility',
    icon: '🤸',
    color: '#2563eb',
    examples: 'Forward Splits, Bridge, Standing Needle',
    desc: 'The range you have is the range you can use.',
  },
  {
    name: 'Body Control',
    icon: '🥋',
    color: '#9333ea',
    examples: 'Breakdancing, Gymnastics, Wrestling',
    desc: 'Without control there is no grace.',
  },
  {
    name: 'Sport Skills',
    icon: '🏒',
    color: '#e63946',
    examples: 'Basketball, Hockey, Tennis',
    desc: 'Smash EVERY sport.',
  },
  {
    name: 'Aim & Precision',
    icon: '🎯',
    color: '#f4a226',
    examples: 'Archery, Darts, Golf',
    desc: 'When you shoot, it hits.',
  },
  {
    name: 'Endurance',
    icon: '🫀',
    color: '#2d9e4f',
    examples: '1k Run, 1k Cycle, Burpee Broad Jump',
    desc: 'Keep going, even when it hurts.',
  },
  {
    name: 'Power & Speed',
    icon: '⚡',
    color: '#2563eb',
    examples: '100m Sprint, High Jump, Shotput',
    desc: 'Do it fast and with great OOMPH.',
  },
]

const ethos = [
  {
    word: 'Mahi',
    meaning: 'Work / Effort',
    desc: 'Effort and dedication represents outcome. Pride yourself on how you shape your life.',
    color: '#e63946',
  },
  {
    word: 'Mauri',
    meaning: 'Spirit / Intention',
    desc: 'Carry yourself with pride in your work and play.',
    color: '#2d9e4f',
  },
  {
    word: 'Mana',
    meaning: 'Power / Influence',
    desc: 'Earn the strength that you deserve.',
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
    desc: 'At the start of each session, the 10 events are announced — one drawn from each physical category. Each event is explained before it begins. First time? You\'ll be guided through everything.',
  },
  {
    number: '04',
    title: 'Compete',
    desc: 'Work through all 10 events across the 100-minute session. AllSport is designed for the long term — give what is appropriate for the day and come back next time.',
  },
  {
    number: '05',
    title: 'Get Scored',
    desc: 'Each event is scored 1–10 based on your performance. Scores are logged in real time. Your total score across all 10 events determines your result for the session.',
  },
  {
    number: '06',
    title: 'Earn Your Colours',
    desc: 'Your total score earns you points toward your colours. From Mā all the way to Taniwha.',
  },
]

export default function HowToPlay() {
  return (
    <>
      <style>{`
        .cat-card-htp { background: #111111; border: 1px solid #1e1e1e; padding: 24px; transition: all 0.2s; cursor: default; }
        .cat-card-htp:hover { background: #161616; border-color: #333; }
        .ethos-card { background: #111111; border: 1px solid #1e1e1e; padding: 40px 32px; position: relative; overflow: hidden; }
        .checklist-item { display: flex; align-items: center; gap: 16px; background: #111111; border: 1px solid #1e1e1e; padding: 16px 20px; }
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
            AllSport is the first sport designed to test your ability at every form of athleticism. Ten disciplines. One hundred events in the rotation. No two sessions are ever the same.
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
                The scoring is relative to your effort and ability. You are competing against your own standard — and improving it every session you attend.
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'start' }}>
            <div>
              <div className="tag">Scoring System</div>
              <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>HOW YOU'RE <span style={{ color: '#2563eb' }}>SCORED</span></h2>
              <div className="divider" style={{ background: '#2563eb' }} />
              <p style={{ color: '#cccccc', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                Each of the 10 events is scored <strong style={{ color: '#ffffff' }}>1 to 10</strong> based on your performance. At the end of the session, your 10 scores are added together. The <strong style={{ color: '#ffffff' }}>highest total score wins.</strong>
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
                This format rewards consistency across all disciplines. A player who scores 8 in every event will beat a player who scores 10 in one event and 5 in the rest. AllSport favours the complete athlete.
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8 }}>
                Over time, your scores improve as your all-round ability develops — which is the whole point.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid #1e1e1e', padding: '32px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '24px' }}>Score Scale — Per Event</div>
              {[
                { score: '9–10', label: 'Elite Performance', color: '#e63946' },
                { score: '7–8', label: 'Strong Performance', color: '#f4a226' },
                { score: '5–6', label: 'Solid Performance', color: '#2d9e4f' },
                { score: '3–4', label: 'Developing', color: '#2563eb' },
                { score: '1–2', label: 'Baseline', color: '#555555' },
              ].map(row => (
                <div key={row.score} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: row.color }}>{row.score}</span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: '14px', color: '#cccccc' }}>{row.label}</span>
                </div>
              ))}
              <div style={{ marginTop: '20px', padding: '16px', background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Max possible score</div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '48px', lineHeight: 1, background: 'linear-gradient(90deg, #e63946, #f4a226, #2d9e4f, #2563eb, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>100 Points</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10 Categories — purple */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #9333ea' }}>
        <div className="container">
          <div className="tag">The 10 Disciplines</div>
          <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>EVENT <span style={{ color: '#9333ea' }}>CATEGORIES</span></h2>
          <div className="divider" style={{ background: '#9333ea' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '680px', marginBottom: '8px', lineHeight: 1.7 }}>
            Each game, one event is drawn from each category. Our yearly competition's 10 are chosen by community vote. During training we rotate the 10 each session.
          </p>
          <p style={{ color: '#555555', fontSize: '14px', maxWidth: '680px', marginBottom: '48px', lineHeight: 1.7 }}>
            100 events in total — 10 per category. No two sessions are the same. Be ready for anything.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {categories.map(cat => (
              <div key={cat.name} className="cat-card-htp">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{cat.icon}</span>
                  <h3 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '24px', color: cat.color, letterSpacing: '0.05em' }}>{cat.name}</h3>
                </div>
                <p style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: '13px', color: '#555555', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  e.g. {cat.examples}
                </p>
                <p style={{ color: '#888888', fontSize: '14px', lineHeight: 1.6 }}>{cat.desc}</p>
              </div>
            ))}
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