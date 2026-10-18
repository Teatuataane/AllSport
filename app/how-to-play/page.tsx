// Server component. Reworked 14 Oct 2026 (Tāne): the old page ran to thirteen
// phone screens of copy and still described the pre-v0.22 rule (lowest total
// placement wins). This one is four pictures. The full colour rules live on
// /grades and the roster on /events; this page only gives the shape of it.
import Link from 'next/link'
import { RainbowText, SectionLabel } from '@/components/ui'
import DomainIcon from '@/components/DomainIcon'
import { DOMAIN_ORDER, EVENTS } from '@/lib/eventData'
import { GRADES, MA } from '@/lib/grading'
import { MAX_GAME_COLOUR_TOTAL } from '@/lib/leaderboardScores'
import { domainColor, RAINBOW } from '@/lib/domainColours'

// Mā at the bottom, Taniwha at the top: the ladder reads as a climb.
const ladder = [MA, ...GRADES]

// A sample game for the step diagram: one colour per domain, as a game report
// would paint it. Illustrative only.
const sampleRungs = [5, 3, 6, 4, 2, 5, 7, 3, 4, 6]

const firstGame = ['Training gear', 'Water', 'Arrive 10 min early', 'Koha, no fee']

function rungFill(rung: number): string {
  const g = ladder[rung]
  return g.rainbow ? RAINBOW : g.hex
}

export const metadata = { alternates: { canonical: '/how-to-play' } }

export default function HowToPlay() {
  return (
    <>
      <style>{`
        .htp-steps { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 12px; align-items: stretch; }
        .htp-arrow { align-self: center; color: var(--grey); font-family: var(--font-display); font-size: 32px; }
        .htp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
        .htp-domains { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        @media (max-width: 720px) {
          .htp-steps { grid-template-columns: 1fr; }
          .htp-arrow { justify-self: center; transform: rotate(90deg); line-height: 1; }
          .htp-domains { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* Hero: the whole sport in one line over a photo of it being played. */}
      <section style={{ position: 'relative', overflow: 'hidden', paddingTop: '120px', paddingBottom: '72px', background: 'var(--black)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/play-sandbag.jpg" alt="" aria-hidden="true" width={960} height={540} decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, var(--black) 100%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">The Game</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.92, marginBottom: '20px' }}>
            HOW TO <RainbowText>PLAY</RainbowText>
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 28px', fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1, color: 'var(--white)' }}>
            <span>10 events</span>
            <span style={{ color: 'var(--grey)' }}>·</span>
            <span>100 minutes</span>
            <span style={{ color: 'var(--grey)' }}>·</span>
            <span>1 game</span>
          </div>
        </div>
      </section>

      {/* 1. The ten domains, as pictures. */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 12 }}>One from each</SectionLabel>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '24px' }}>TEN <span style={{ color: 'var(--red)' }}>DOMAINS</span></h2>
          <div className="htp-domains">
            {DOMAIN_ORDER.map((name, i) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
                <DomainIcon domainName={name} domainNumber={i + 1} size={64} />
                <span style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: '13px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--grey-light)', lineHeight: 1.2 }}>{name}</span>
              </div>
            ))}
          </div>
          <Link href="/events" style={{ display: 'inline-block', marginTop: '28px', fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--blue)' }}>
            See all {EVENTS.length} events →
          </Link>
        </div>
      </section>

      {/* 2. A game, as a three-step diagram. */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 12 }}>A game</SectionLabel>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '24px' }}>HOW IT <span style={{ color: 'var(--green)' }}>WORKS</span></h2>
          <div className="htp-steps">
            <div className="htp-card">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', maxWidth: 160, marginBottom: '16px' }}>
                {DOMAIN_ORDER.map((name, i) => (
                  <span key={name} style={{ aspectRatio: '1', borderRadius: '50%', background: domainColor(i + 1) }} />
                ))}
              </div>
              <h3 style={{ fontSize: '26px', color: 'var(--white)', marginBottom: '4px' }}>Ten drawn</h3>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.5, margin: 0 }}>One event from each domain.</p>
            </div>
            <div className="htp-arrow" aria-hidden="true">→</div>
            <div className="htp-card">
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '44px', lineHeight: 1, color: 'var(--amber)', marginBottom: '16px' }}>100:00</div>
              <h3 style={{ fontSize: '26px', color: 'var(--white)', marginBottom: '4px' }}>Shown, then played</h3>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.5, margin: 0 }}>Every event is explained first. Injured? Swap it.</p>
            </div>
            <div className="htp-arrow" aria-hidden="true">→</div>
            <div className="htp-card" style={{ borderColor: 'var(--border-strong)' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                {sampleRungs.map((r, i) => (
                  <span key={i} style={{ flex: 1, height: 28, borderRadius: 3, background: rungFill(r) }} />
                ))}
              </div>
              <h3 style={{ fontSize: '26px', color: 'var(--white)', marginBottom: '4px' }}>Add up your colours</h3>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.5, margin: 0 }}>Each score earns a colour, up to {MAX_GAME_COLOUR_TOTAL} a game.</p>
            </div>
          </div>
          <div style={{ marginTop: '32px', fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 8vw, 88px)', lineHeight: 0.95, textAlign: 'center' }}>
            HIGHEST COLOUR <RainbowText>WINS!</RainbowText>
          </div>
        </div>
      </section>

      {/* 3. The colour ladder, as a picture. */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', alignItems: 'center' }}>
          <div>
            <SectionLabel style={{ marginBottom: 12 }}>Between games</SectionLabel>
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '16px' }}>CLIMB THE <span style={{ color: 'var(--amber)' }}>COLOURS</span></h2>
            <p style={{ color: 'var(--grey-light)', fontSize: '17px', lineHeight: 1.6, marginBottom: '12px' }}>
              Hit an event&apos;s standard and the colour is yours for the year. Every 1 January starts fresh.
            </p>
            <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
              Measured against a standard, not the room. Coming last costs you nothing.
            </p>
            <Link href="/grades" style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--blue)' }}>
              How colours work →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px', maxWidth: 360, width: '100%', justifySelf: 'center' }}>
            {ladder.map(g => (
              <div key={g.rung} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 26, padding: '0 12px', borderRadius: 4,
                background: rungFill(g.rung),
                border: g.inverted ? '1px solid var(--border-strong)' : 'none',
                width: `${55 + g.rung * 3.75}%`,
              }}>
                <span style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em', color: g.inverted || g.rung === 1 || g.rung === 6 ? '#fff' : '#111' }}>{g.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. First game + CTA. */}
      <section style={{ padding: '72px 0 80px', background: 'var(--black)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '24px' }}>
            YOUR FIRST <RainbowText>GAME</RainbowText>
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
            {firstGame.map(text => (
              <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '999px', padding: '10px 18px', fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: '15px', color: 'var(--grey-light)' }}>
                <span style={{ width: 16, height: 3, borderRadius: 3, background: 'var(--rainbow)' }} />
                {text}
              </span>
            ))}
          </div>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '17px' }}>Play Your First Game</Link>
        </div>
      </section>
    </>
  )
}
