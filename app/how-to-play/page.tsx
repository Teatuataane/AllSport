'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RainbowText, SectionLabel } from '@/components/ui'

const domains = [
  {
    name: 'Maximal Strength',
    color: '#EA4742',
    desc: 'How much can you lift? Absolute strength tested to its limit.',
    events: ['1A Press', 'Deadlift', 'Clean & Press', 'Pause Dips', 'Pause Chin Up', 'Pause Squat', 'Zercher Dead', 'Ham Curl', 'Pause Bench', 'Turkish Get Up', 'Sandbag to Shoulder'],
  },
  {
    name: 'Calisthenics',
    color: '#F9B051',
    desc: 'Bodyweight mastery. Skills, levers, and control on full display.',
    events: ['1 Leg Squat', 'Flag', 'Windshield Wipers', 'Toe Lift', 'Planche', 'Back Lever', 'Iron Cross', 'Front Lever', 'Chin Hang', 'Climbing'],
  },
  {
    name: 'Power',
    color: '#F397C0',
    desc: 'Strength applied fast. Explosiveness through full range of motion.',
    events: ['Kelly Snatch', '1A Snatch', 'Triple Jump', 'Javelin', 'Shotput', 'Australian Football', 'Vertical Jump', 'Handbalance', 'Clean & Jerk', 'Snatch'],
  },
  {
    name: 'Speed',
    color: '#B87DB5',
    desc: 'React, accelerate, and leave them behind.',
    events: ['100m Sprint', 'Tag', 'T-Race', '400m Race', 'Beach Flags', '50m Sprint', '200m Sprint', 'Touch Rugby', 'Football Dribble', 'Repeat High Jump', 'Rats & Rabbits', 'Speed Chess'],
  },
  {
    name: 'Anaerobic Endurance',
    color: '#2371BB',
    desc: 'Maximum reps, maximum effort. How far can you push before you break?',
    events: ['Chinup Contest', 'Pushup Contest', 'Reverse Hyper', 'L-Sit Hold', 'Tibialis Curl', 'Headstand', 'Finger Push Up', 'GHD Situp', 'Leg Extension', 'Ab Rollout'],
  },
  {
    name: 'Aerobic Endurance',
    color: '#4DB26E',
    desc: 'Keep going, even when it hurts. The engine that runs everything else.',
    events: ['Burpee Broad Jump', 'Running', 'Cycling', 'Ski Erg', 'Row Erg', 'Breath Hold', 'Weighted Carry', 'Duck Walk', 'Bronco', 'Walking'],
  },
  {
    name: 'Flexibility',
    color: '#EA4742',
    desc: 'The range you have is the range you can use.',
    events: ['Rear Hand Clasp', 'Bridge', 'Forward Fold', 'Needle Pose', 'Forward Split', 'Middle Split', 'Standing Split', 'Foot Behind Head', 'Shoulder Dislocate', 'Pancake'],
  },
  {
    name: 'Body Awareness',
    color: '#F9B051',
    desc: 'Control your body in space. Without control there is no grace.',
    events: ['Tae Kwon Do', 'Breakdancing', 'Trampolining', 'Jump Rope', 'Wrestling', 'Gymnastics', 'Balance Ball', 'SKATE', 'Fencing', 'Juggling', 'Foot Juggling'],
  },
  {
    name: 'Coordination',
    color: '#2371BB',
    desc: 'Hand-eye, timing, anticipation. The athletic skills behind every sport.',
    events: ['Volleyball', 'Baseball', 'Teqball', 'Tennis', 'Cricket', 'Badminton', 'Basketball', 'Football', 'Hockey', 'Squash'],
  },
  {
    name: 'Aim & Precision',
    color: '#4DB26E',
    desc: 'When you shoot, it hits. Accuracy and composure under pressure.',
    events: ['Netball', 'Bocce', 'Dodgeball', 'Carrom', 'Archery', 'Kubb', 'Darts', 'Disc Golf', 'Golf', 'Ultimate Frisbee'],
  },
]

const ethos = [
  {
    word: 'Mahi',
    meaning: 'Work / Effort',
    desc: 'AllSport is built on showing up. Every session counts, every rep matters. Effort is the most honest measure of who you are.',
    color: 'var(--red)',
  },
  {
    word: 'Mauri',
    meaning: 'Spirit / Life Force',
    desc: 'We built AllSport to remove every barrier — cost, experience, fitness level. Your spirit, not your starting point, determines your journey.',
    color: 'var(--green)',
  },
  {
    word: 'Mana',
    meaning: 'Power / Influence',
    desc: "Earned through persistence, not talent. The more you put in, the more you earn. That's how mana works.",
    color: 'var(--blue)',
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
    desc: "At the start of each session, the 10 events are announced — one drawn from each discipline. Each event is explained before it begins. First time? You'll be guided through everything.",
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

const effortRules = [
  { label: 'Strength events', rule: '5 reps at 80% of your PR weight' },
  { label: 'Hold / timed events', rule: 'Hold for 2 minutes (or at target difficulty)' },
  { label: 'Sport / match events', rule: 'Play an extra match vs any opponent' },
  { label: 'Sprint events', rule: 'Each sprint within 80% of PR pace' },
  { label: 'Distance events', rule: 'Each attempt ≥80% of PR distance' },
  { label: 'Score events (Golf/Disc Golf)', rule: 'Complete an additional 4-hole round' },
]

const divisions = [
  { name: "Men's", age: '17–39' },
  { name: "Women's", age: '17–39' },
  { name: 'Juniors', age: '16 and under' },
  { name: 'Masters Men', age: '40–59' },
  { name: 'Masters Women', age: '40–59' },
  { name: 'Grandmaster Men', age: '60+' },
  { name: 'Grandmaster Women', age: '60+' },
]

const checklist = [
  'Wear comfortable training gear',
  'Bring water and a towel',
  'Arrive 10 minutes before the session starts',
  'Events are announced and explained at the start',
  'First timers are guided through every event',
  'Scores are logged digitally in real time',
]

const totalEvents = domains.reduce((n, d) => n + d.events.length, 0)

export default function HowToPlay() {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)

  return (
    <>
      <style>{`
        .domain-card-htp { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: all 0.2s; cursor: pointer; overflow: hidden; }
        .domain-card-htp:hover { background: #161616; border-color: var(--border-strong); }
        .event-pill { display: inline-block; font-family: var(--font-label); font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 10px; border-radius: 3px; background: #1a1a1a; color: var(--grey); border: 1px solid #242424; margin: 2px; }
        .ethos-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 40px 32px; position: relative; overflow: hidden; }
        .checklist-item { display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; }
        .info-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px; }
        .bonus-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1a1a1a; }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '120px', paddingBottom: '80px', background: 'var(--black)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(234,71,66,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">The Game</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.92, marginBottom: '8px' }}>
            HOW TO<br />
            <RainbowText>PLAY</RainbowText>
          </h1>
          <div className="rainbow-line" style={{ width: '88px', margin: '20px 0 28px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey-light)', fontSize: '20px', maxWidth: '620px', lineHeight: 1.7 }}>
            AllSport is the first sport designed to test your ability across every form of athleticism.
            Ten disciplines. {totalEvents} events in rotation. No two sessions are ever the same.
          </p>
        </div>
      </section>

      {/* What to expect */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--amber)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'start' }}>
            <div>
              <SectionLabel style={{ marginBottom: 16 }}>For First Timers</SectionLabel>
              <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>WHAT TO <span style={{ color: 'var(--amber)' }}>EXPECT</span></h2>
              <div className="divider" style={{ background: 'var(--amber)' }} />
              <p style={{ color: 'var(--grey-light)', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                Walk in knowing nothing — that&apos;s completely fine. Every event is explained before it starts. There are no prerequisites, no minimum fitness level, and no specialist equipment required.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
                AllSport is designed for the long term. It&apos;s meant to be fun, accessible, and sustainable. You don&apos;t need to push to your limit every session — showing up consistently is what creates results.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.8 }}>
                Scoring is placement-based — you compete relative to everyone else in the room, not against a fixed standard. Come last in every event today and still earn points. Come back next week and beat yourself.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {checklist.map(text => (
                <div key={text} className="checklist-item">
                  <span style={{ width: 20, height: 3, borderRadius: 3, background: 'var(--rainbow)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: '15px', color: 'var(--grey-light)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--green)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Step By Step</SectionLabel>
          <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>HOW IT <span style={{ color: 'var(--green)' }}>WORKS</span></h2>
          <div className="divider" style={{ background: 'var(--green)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
            {steps.map((step, i) => (
              <div key={step.number} style={{ display: 'grid', gridTemplateColumns: 'minmax(72px, 120px) 1fr', gap: '24px', alignItems: 'start', padding: '32px 0', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 7vw, 72px)', color: i === 0 ? 'var(--green)' : 'var(--border)', lineHeight: 1 }}>{step.number}</div>
                <div style={{ paddingTop: '8px' }}>
                  <h3 style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: 'var(--white)', marginBottom: '8px' }}>{step.title}</h3>
                  <p style={{ color: 'var(--grey)', fontSize: '16px', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--blue)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Scoring System</SectionLabel>
          <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>HOW YOU&apos;RE <span style={{ color: 'var(--blue)' }}>SCORED</span></h2>
          <div className="divider" style={{ background: 'var(--blue)' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginTop: '8px', alignItems: 'start' }}>
            {/* Placement explanation */}
            <div>
              <h3 style={{ fontSize: '28px', color: 'var(--white)', marginBottom: '12px' }}>Placement-Based</h3>
              <p style={{ color: 'var(--grey-light)', fontSize: '16px', lineHeight: 1.8, marginBottom: '16px' }}>
                In each event, players are ranked by their result. Your placement — 1st, 2nd, 3rd — is recorded. <strong style={{ color: 'var(--white)' }}>Lowest total placement score wins.</strong>
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
                This rewards consistency. A player who finishes 3rd in every event will beat one who wins two events but finishes last in the rest.
              </p>
              <p style={{ color: '#555555', fontSize: '14px', lineHeight: 1.8, fontStyle: 'italic' }}>
                Tied results share the same placement. If two players tie for 2nd, both receive 2nd place and the next player receives 4th.
              </p>
            </div>

            {/* Points formula */}
            <div className="info-card">
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '20px' }}>Points Formula</div>
              <p style={{ color: 'var(--grey)', fontSize: '14px', lineHeight: 1.7, marginBottom: '16px' }}>
                1st place always earns <strong style={{ color: 'var(--white)' }}>100 points</strong>. Each subsequent place drops by a gap calculated from session size.
              </p>
              {[
                { size: '5 players', gap: '20 pts', example: '100 / 80 / 60 / 40 / 20' },
                { size: '10 players', gap: '10 pts', example: '100 / 90 / 80 / ... / 10' },
                { size: '20+ players', gap: 'min 10 pts', example: '100 / 90 / 80 / ... / 10' },
              ].map(row => (
                <div key={row.size} style={{ padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', color: 'var(--grey-light)' }}>{row.size}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--blue)' }}>{row.gap}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#444', letterSpacing: '0.05em' }}>{row.example}</div>
                </div>
              ))}
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Minimum earn</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--blue)' }}>10 Points</div>
              </div>
            </div>

            {/* Effort Points */}
            <div className="info-card">
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Effort Points</div>
              <p style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.65, marginBottom: '16px' }}>
                After submitting your competition score, unlock repeatable effort tasks. Each qualifying extra effort earns <strong style={{ color: 'var(--green)' }}>+5 points</strong> (up to 100 per session).
              </p>
              {effortRules.map(r => (
                <div key={r.label} className="bonus-row">
                  <span style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: '13px', color: 'var(--grey-light)' }}>{r.label}</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', flexShrink: 0, marginLeft: '12px', textAlign: 'right' as const, maxWidth: '120px' }}>{r.rule}</span>
                </div>
              ))}
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Session cap</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--green)' }}>100 Points</div>
              </div>
            </div>

            {/* Divisions */}
            <div className="info-card">
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Divisions</div>
              <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>You compete only within your own division — 1st place is awarded once per division per session. Your division is auto-calculated from your age and gender at registration.</p>
              {divisions.map(d => (
                <div key={d.name} className="bonus-row">
                  <span style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: '14px', color: 'var(--grey-light)' }}>{d.name}</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '13px', color: '#555', flexShrink: 0, marginLeft: '12px' }}>{d.age}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 10 Disciplines — accordion */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--purple)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>The 10 Disciplines</SectionLabel>
          <h2 style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginBottom: '8px' }}>EVENT <span style={{ color: 'var(--purple)' }}>DOMAINS</span></h2>
          <div className="divider" style={{ background: 'var(--purple)' }} />
          <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '680px', marginBottom: '8px', lineHeight: 1.7 }}>
            Each session, one event is drawn at random from each of the 10 domains below — 10 events in total. Our annual Championship events are chosen by community vote.
          </p>
          <p style={{ color: '#555555', fontSize: '14px', maxWidth: '680px', marginBottom: '24px', lineHeight: 1.7 }}>
            {totalEvents} events in total across all domains. Tap any domain to see its full event list.
          </p>
          <Link href="/events" style={{ display: 'inline-block', marginBottom: '32px', padding: '10px 22px', borderRadius: '999px', background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--grey-light)', fontSize: '13px', fontFamily: 'var(--font-label)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Browse All {totalEvents} Events →
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
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: domain.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: isOpen ? domain.color : 'var(--white)', letterSpacing: '0.04em', lineHeight: 1 }}>
                        {domain.name}
                      </div>
                      {!isOpen && (
                        <div style={{ fontFamily: 'var(--font-label)', fontSize: '13px', color: '#555', marginTop: '2px' }}>{domain.desc}</div>
                      )}
                    </div>
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#555', marginRight: '8px', flexShrink: 0 }}>{domain.events.length} events</span>
                    <span style={{ color: '#444', fontSize: '13px' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${domain.color}33` }}>
                      <p style={{ fontFamily: 'var(--font-label)', fontSize: '14px', color: '#666', marginBottom: '12px', paddingTop: '12px' }}>{domain.desc}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {domain.events.map(event => (
                          <span key={event} className="event-pill">{event}</span>
                        ))}
                      </div>
                      <Link href="/events" style={{ display: 'inline-block', marginTop: '12px', fontSize: '12px', color: 'var(--blue)', fontFamily: 'var(--font-label)', fontWeight: 700, letterSpacing: '0.05em' }}>
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

      {/* Ethos */}
      <section className="section" style={{ background: '#0d0d0d', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--rainbow)' }} />
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="tag" style={{ display: 'inline-flex' }}>Our Kaupapa</div>
            <h2 style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>MAHI. MAURI. <span style={{ color: 'var(--green)' }}>MANA.</span></h2>
            <div className="rainbow-line" style={{ width: '80px', margin: '16px auto 0', borderRadius: '2px' }} />
            <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '560px', margin: '24px auto 0', lineHeight: 1.7 }}>
              Three kupu (words) that represent what we stand for — and what we expect of every competitor that steps through the door.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {ethos.map(e => (
              <div key={e.word} className="ethos-card">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: e.color }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', color: e.color, lineHeight: 1, marginBottom: '4px' }}>{e.word}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '16px' }}>{e.meaning}</div>
                <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.7 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: 'var(--black)', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            READY TO <RainbowText>PLAY?</RainbowText>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            No experience needed. No specialist skills required. Just show up and give what you have today.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '17px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}
