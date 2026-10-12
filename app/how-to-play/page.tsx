// Server component. The only interactive part of this page is the domain
// accordion, which now lives in its own client island (DomainAccordion) so the
// other ~350 lines of static marketing copy no longer ship as client JS — and
// lib/eventData.ts (2171 lines) stays on the server, since `domains` is derived
// here and passed down already flattened.
import Link from 'next/link'
import { RainbowText, SectionLabel } from '@/components/ui'
import { EVENTS } from '@/lib/eventData'
import { GRADES, GAMES_REQUIRED, DOMAIN_TOP_EVENTS } from '@/lib/grading'
import DomainAccordion from './DomainAccordion'

const DOMAIN_META = [
  {
    name: 'Maximal Strength',
    color: '#EA4742',
    desc: 'How much can you lift? Absolute strength tested to its limit.',
  },
  {
    name: 'Calisthenics',
    color: '#F9B051',
    desc: 'Bodyweight mastery. Skills, levers, and control on full display.',
  },
  {
    name: 'Power',
    color: '#F397C0',
    desc: 'Strength applied fast. Explosiveness through full range of motion.',
  },
  {
    name: 'Speed',
    color: '#B87DB5',
    desc: 'React, accelerate, and leave them behind.',
  },
  {
    name: 'Stamina',
    color: '#2371BB',
    desc: 'Most reps, longest holds. How far can you push before you break?',
  },
  {
    name: 'Endurance',
    color: '#4DB26E',
    desc: 'Keep going, even when it hurts. The engine that runs everything else.',
  },
  {
    name: 'Flexibility',
    color: '#EA4742',
    desc: 'The range you have is the range you can use.',
  },
  {
    name: 'Body Awareness',
    color: '#F9B051',
    desc: 'Control your body in space. Without control there is no grace.',
  },
  {
    name: 'Coordination',
    color: '#2371BB',
    desc: 'Hand-eye, timing, anticipation. The athletic skills behind every sport.',
  },
  {
    name: 'Aim & Precision',
    color: '#4DB26E',
    desc: 'When you shoot, it hits. Accuracy and composure under pressure.',
  },
]

// Event lists are derived from lib/eventData.ts (the single source of truth for
// the roster) so domain moves, additions and removals propagate automatically.
const domains = DOMAIN_META.map(d => ({
  ...d,
  events: EVENTS.filter(e => e.domain === d.name).map(e => e.name),
}))

const steps = [
  { number: '01', title: 'Register', desc: 'Two minutes online. If you can move, you can play.' },
  { number: '02', title: 'Show Up', desc: 'Training gear and water. Everything else is here.' },
  { number: '03', title: 'Play Ten', desc: 'Ten events, one from each domain, each explained before it starts. Injured? Swap it for another from the same domain.' },
  { number: '04', title: 'Get Placed', desc: 'Lowest total placement across the ten wins the game. Every game also earns season points.' },
  { number: '05', title: 'Earn Your Colours', desc: 'Hit an event\u2019s standard and the colour is yours for the year. Every 1 January starts fresh.' },
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
  'Wear training gear, bring water',
  'Arrive 10 minutes early',
  'Every event is explained first',
  'First timers are guided through',
]

const totalEvents = domains.reduce((n, d) => n + d.events.length, 0)

export default function HowToPlay() {
  return (
    <>
      <style>{`
        .domain-card-htp { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: all 0.2s; cursor: pointer; overflow: hidden; }
        .domain-card-htp:hover { background: #161616; border-color: var(--border-strong); }
        .event-pill { display: inline-block; font-family: var(--font-label); font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 10px; border-radius: 3px; background: #1a1a1a; color: var(--grey); border: 1px solid #242424; margin: 2px; }
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
            Ten events. One from each domain. 100 minutes. No two games the same.
          </p>
        </div>
      </section>

      {/* The whole sport in three lines. The page below is thirteen screens on a
          phone, and what a colour is used to sit at the last step, seven screens
          down. A newcomer gets the shape of it before any of the detail. */}
      <section style={{ background: '#0d0d0d', borderTop: '1px solid var(--border)', padding: '40px 0' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 18 }}>AllSport in 30 seconds</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {[
              { title: 'Play a game', color: 'var(--red)', desc: 'Ten events in 100 minutes. Lowest total placement wins.' },
              { title: 'Earn your colours', color: 'var(--amber)', desc: 'Hit the standard, keep the colour. Twelve to climb.' },
              { title: 'Train between games', color: 'var(--green)', desc: 'Log any workout. It counts toward your next colour.' },
            ].map(c => (
              <div key={c.title} className="info-card" style={{ padding: '20px 22px' }}>
                <div style={{ width: 24, height: 3, borderRadius: 2, background: c.color, marginBottom: 12 }} />
                <h3 style={{ fontSize: '26px', color: 'var(--white)', marginBottom: '6px' }}>{c.title}</h3>
                <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
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
              <p style={{ color: 'var(--grey-light)', fontSize: '17px', lineHeight: 1.7, marginBottom: '12px' }}>
                Walk in knowing nothing. That&apos;s fine.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.7 }}>
                No minimum fitness, no special gear. Your colours are measured against a standard, not the room, so coming last costs you nothing.
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
              <p style={{ color: 'var(--grey-light)', fontSize: '16px', lineHeight: 1.7, marginBottom: '12px' }}>
                Each event ranks you 1st, 2nd, 3rd. <strong style={{ color: 'var(--white)' }}>Lowest total wins.</strong>
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.7, marginBottom: '12px' }}>
                Third in everything beats winning two and coming last in the rest.
              </p>
              <p style={{ color: '#555555', fontSize: '14px', lineHeight: 1.7, fontStyle: 'italic' }}>
                Ties share a place. A missed event counts as last.
              </p>
            </div>

            {/* The colour ladder */}
            <div className="info-card">
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>The Colours</div>
              <p style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.65, marginBottom: '16px' }}>
                Twelve per domain. They land the moment you earn them, fresh each calendar year.
              </p>
              {[
                { label: 'Each event', rule: 'Its own colour, against twelve standards' },
                { label: 'Each domain', rule: `The average of your best ${DOMAIN_TOP_EVENTS} events. Unplayed counts as Mā` },
                { label: 'Overall', rule: `The average of your ten, capped by games played that year: ${GAMES_REQUIRED[1]} for ${GRADES[0].name}, ${GAMES_REQUIRED[12]} for ${GRADES[11].name}` },
              ].map(r => (
                <div key={r.label} className="bonus-row">
                  <span style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: '13px', color: 'var(--grey-light)' }}>{r.label}</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', flexShrink: 0, marginLeft: '12px', textAlign: 'right' as const, maxWidth: '180px' }}>{r.rule}</span>
                </div>
              ))}
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Go wide</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--blue)', lineHeight: 1.1 }}>Your best six count</div>
              </div>
            </div>

            {/* Divisions */}
            <div className="info-card">
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555555', marginBottom: '8px' }}>Divisions</div>
              <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>You place within your division, set from your age and gender.</p>
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
          <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '680px', marginBottom: '24px', lineHeight: 1.7 }}>
            One event is drawn from each domain every game. Tap a domain to see its events.
          </p>
                    <Link href="/events" style={{ display: 'inline-block', marginBottom: '32px', padding: '10px 22px', borderRadius: '999px', background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--grey-light)', fontSize: '13px', fontFamily: 'var(--font-label)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Browse All {totalEvents} Events →
          </Link>
          <DomainAccordion domains={domains} />
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
            No experience needed. Just show up.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '17px' }}>Play Your First Game</Link>
        </div>
      </section>
    </>
  )
}
