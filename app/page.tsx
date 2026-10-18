// Server component, cached and rebuilt at most hourly (the community counts are
// fetched with `revalidate: 3600`). The interactive parts are small client
// islands: the hero's background clip (HeroVideo), the "next game" line
// (NextGame) and the domain tiles' icons (DomainIcon). The roster itself stays on
// the server; only names and counts are passed down.
import Link from 'next/link'
import { EVENTS, DOMAIN_ORDER } from '@/lib/eventData'
import { DOMAIN_COLORS } from '@/lib/domainColours'
import { GRADES } from '@/lib/grading'
import { loadCommunityStats } from '@/lib/communityStats'
import HeroVideo from './HeroVideo'
import NextGame from './NextGame'
import DomainExplorer from './DomainExplorer'
import { ORGANISATION, jsonLd } from '@/lib/structuredData'

const RAINBOW = 'var(--rainbow)'

const rainbowText: React.CSSProperties = {
  background: RAINBOW,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

// Names come from lib/eventData.ts and colours from lib/domainColours.ts, so the
// homepage cannot drift from the rest of the app. It had its own hand-written
// palette until August 2026, which disagreed with BOTH the event icons and /prs.
const DOMAIN_META = DOMAIN_ORDER.map((name, i) => ({ name, color: DOMAIN_COLORS[i] }))

// Event counts are derived from lib/eventData.ts (the single source of truth for
// the roster) so domain moves, additions and removals propagate automatically.
// Only what the tiles show is passed to the client island.
const domains = DOMAIN_META.map((d, i) => ({
  ...d,
  number: i + 1,
  events: EVENTS.filter(e => e.domain === d.name).map(e => ({ slug: e.slug, name: e.name, emoji: e.emoji })),
}))

// Stills from the 2026 showcase film (public/media/, cut by hand from the 4K
// master). Alt text says what is happening, not who it is.
const photos = [
  { src: '/media/play-badminton.jpg', alt: 'A junior player returns a shuttlecock at badminton' },
  { src: '/media/play-carry.jpg', alt: 'A mother and daughter laugh while carrying a medicine ball' },
  { src: '/media/play-carrom.jpg', alt: 'Players lean in over a carrom board' },
  { src: '/media/play-sandbag.jpg', alt: 'Players carry sandbags and medicine balls down the lane' },
  { src: '/media/play-floor.jpg', alt: 'Two players work through floor events in the gym' },
  { src: '/media/play-hoodie.jpg', alt: 'A player in an AllSport hoodie watches a sprint' },
]

const nf = new Intl.NumberFormat('en-NZ')

const ethos = [
  { word: 'Mahi', mean: 'Effort', color: '#EA4742', desc: 'Show up. Give what you have today.' },
  { word: 'Mauri', mean: 'Spirit', color: '#4DB26E', desc: 'No cost, no kit, no experience. Come as you are.' },
  { word: 'Mana', mean: 'Standing', color: '#2371BB', desc: 'Earned rep by rep. Nobody can hand it to you.' },
]

const sessions = [
  { day: 'Tuesday', time: '4:30 PM', color: '#EA4742' },
  { day: 'Thursday', time: '4:30 PM', color: '#2371BB' },
  { day: 'Saturday', time: '9:00 AM', color: '#4DB26E' },
]

export const metadata = { alternates: { canonical: '/' } }

export default async function Home() {
  const stats = await loadCommunityStats()
  const proof = [
    { n: stats.players, l: 'Players' },
    { n: stats.games, l: 'Games played' },
    { n: stats.scores, l: 'Scores logged' },
  ].filter((p): p is { n: number; l: string } => p.n != null)

  return (
    <div className="landing">
      {/* Address and game times for Google (lib/structuredData.ts). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ORGANISATION) }} />
      <style>{`
        .landing { background: #0a0a0a; }
        .lp-hero { position: relative; overflow: hidden; background: #000; min-height: min(92vh, 860px); display: flex; align-items: center; padding: 120px 0 72px; }
        .lp-hero-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* Dark on the text side, opening up towards the footage; a phone has no
           "side", so there it is an even wash plus the fade at the bottom. */
        .lp-hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.3) 100%), linear-gradient(0deg, #0a0a0a 0%, transparent 30%); }
        @media (max-width: 768px) { .lp-hero-shade { background: linear-gradient(0deg, #0a0a0a 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.6) 100%); } }
        .lp-next { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-family: var(--font-label); font-size: 14px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 28px; }
        .lp-next-dot { width: 8px; height: 8px; border-radius: 50%; background: #EA4742; box-shadow: 0 0 0 4px rgba(234,71,66,0.25); }
        .lp-tile { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: #111; border: 1px solid #1e1e1e; border-radius: 10px; transition: border-color 0.2s, background 0.2s, transform 0.2s; }
        .lp-tile:hover { background: #161616; border-color: #333; transform: translateY(-2px); }
        .lp-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        @media (max-width: 768px) { .lp-photos { grid-template-columns: repeat(2, 1fr); } }
        .lp-photo { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; display: block; background: #111; }
        .lp-tag { display: inline-block; font-family: var(--font-label); font-size: 12px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; padding: 5px 14px; border: 1px solid #2a2a2a; color: #888; border-radius: 2px; }
        .lp-btn { display: inline-block; font-family: var(--font-display); font-size: 20px; letter-spacing: 0.08em; padding: 14px 40px; cursor: pointer; border: none; border-radius: 999px; transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s, border-color 0.2s; }
        .lp-btn:active { transform: scale(0.97); }
        .lp-primary { background: #EA4742; color: #fff; }
        .lp-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(234,71,66,0.4); }
        .lp-outline { background: transparent; color: #fff; border: 2px solid #2a2a2a; }
        .lp-outline:hover { border-color: #fff; transform: translateY(-2px); }
        .lp-rainbow { position: relative; background: #0a0a0a; color: #fff; }
        .lp-rainbow::before { content: ''; position: absolute; inset: 0; padding: 2px; border-radius: 999px; background: ${RAINBOW}; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
        .lp-rainbow:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(35,113,187,0.35); }
        .lp-rank { display: flex; align-items: center; gap: 18px; padding: 14px 20px; border: 1px solid #1a1a1a; background: #0d0d0d; border-radius: 6px; transition: background 0.2s, transform 0.2s; }
        .lp-rank:hover { background: #141414; transform: translateX(4px); }
        .lp-rank-name { min-width: 210px; }
        /* On a phone the row is dot + a 210px name + colour + condition inside a
           ~327px column, so every one of the twelve overflowed. Nobody saw it
           because body{overflow-x:hidden} clips the page — which also stretched
           the fixed rainbow stripe to the overflowing width and cut its green
           end off. Wrap to two lines instead: name on top, colour and condition
           beneath it. */
        /* 640, not the 768 the nav and .lb-* boundaries use: this is a row
           that stops fitting, not a switch between layout modes. The rows fit
           down to about 510px, so 640 wraps slightly early and never late. */
        @media (max-width: 640px) {
          .lp-rank { flex-wrap: wrap; gap: 4px 10px; padding: 12px 14px; }
          .lp-rank-name { min-width: 0; flex: 1 1 100%; font-size: 17px; }
        }
        .lp-free { margin: 0; padding: 9px 14px; text-align: center; font-family: var(--font-label); font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #4DB26E; background: rgba(77,178,110,0.1); border: 1.5px solid rgba(77,178,110,0.55); border-radius: 999px; }
        .lp-rainbow-line { height: 4px; background: ${RAINBOW}; border-radius: 2px; }
      `}</style>

      {/* HERO: real games behind the headline. The poster is a frame of the
          same footage and is what paints first (LCP). */}
      <section className="lp-hero">
        <HeroVideo />
        <div className="lp-hero-shade" />

        <div className="container" style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <div style={{ maxWidth: '620px' }}>
            <div className="lp-tag" style={{ background: 'rgba(0,0,0,0.4)' }}>Ōtautahi · Aotearoa</div>
            <h1 style={{ fontSize: 'clamp(44px, 7vw, 92px)', fontFamily: 'var(--font-display)', lineHeight: 0.92, letterSpacing: '0.03em', color: '#fff', margin: '18px 0 26px' }}>
              <span style={{ display: 'block' }}>10 EVENTS.</span>
              <span style={{ display: 'block' }}>100 MINUTES.</span>
              <span style={{ display: 'block', ...rainbowText }}>150+ SPORTS &amp; EXERCISES.</span>
            </h1>

            <div className="lp-rainbow-line" style={{ width: '88px', marginBottom: '26px' }} />

            <p style={{ fontSize: 'clamp(20px, 2.2vw, 26px)', color: '#fff', lineHeight: 1.4, marginBottom: '22px', maxWidth: '540px', fontWeight: 600 }}>
              The sport about getting good at EVERYTHING!
            </p>

            <NextGame />

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* The play button and its "free" line share one column, so the
                  line is exactly as wide as the button and sits square under it. */}
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '10px' }}>
                <Link href="/register" className="lp-btn lp-primary" style={{ textAlign: 'center' }}>Play Your First Game</Link>
                <p className="lp-free">Free to play · koha welcome</p>
              </div>
              <a href="#film" className="lp-btn lp-outline" style={{ background: 'rgba(0,0,0,0.35)' }}>Watch The Film</a>
            </div>

          </div>
        </div>
      </section>

      {/* SOCIAL PROOF: live counts, rebuilt hourly. A count that cannot be read
          is left out rather than shown as zero. */}
      <section style={{ background: '#0a0a0a', padding: '8px 0 56px' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', borderTop: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e' }}>
            {[
              { n: '10', l: 'Domains', g: 'linear-gradient(90deg,#EA4742,#F9B051)' },
              // 150+ rounds the roster plus its levels and variations, as the
              // hero does; EVENTS.length alone (144) undersold it.
              { n: '150+', l: 'Sports & Exercises', g: 'linear-gradient(90deg,#F9B051,#4DB26E)' },
              ...proof.map((p, i) => ({ n: nf.format(p.n), l: p.l, g: ['linear-gradient(90deg,#4DB26E,#2371BB)', 'linear-gradient(90deg,#2371BB,#B87DB5)', 'linear-gradient(90deg,#B87DB5,#EA4742)'][i] })),
            ].map(s => (
              <div key={s.l} style={{ flex: '1 1 140px', padding: '22px 12px 20px 0' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 5vw, 54px)', lineHeight: 1, background: s.g, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.n}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666', marginTop: '4px' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: '13px', letterSpacing: '0.08em', color: '#666', marginTop: '16px' }}>
            2026 Games champions: <span style={{ color: '#ccc' }}>Bodak · Naybay · Lennox</span>
          </p>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: '13px', letterSpacing: '0.08em', color: '#666', marginTop: '6px' }}>
            Selwyn Winter Jam 2026 champions: <span style={{ color: '#ccc' }}>kiwigyver · Meredith · Blair · Tarsh</span>
          </p>
        </div>
      </section>

      {/* WHAT IS ALLSPORT + DOMAINS */}
      <section id="domains" style={{ padding: '100px 0', background: '#0d0d0d', borderTop: '3px solid #EA4742' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="lp-tag">What is AllSport</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 5vw, 66px)', lineHeight: 0.9, letterSpacing: '0.03em', margin: '18px 0 8px', color: '#fff' }}>
                LEARN YOUR STATS,<br />EARN YOUR COLOURS,<br />GET GOOD AT <span style={rainbowText}>EVERYTHING!</span>
              </h2>
              <div className="lp-rainbow-line" style={{ width: '60px', margin: '18px 0 28px' }} />
              <Link href="/how-to-play" className="lp-btn lp-primary">Learn The Rules</Link>
            </div>

            <DomainExplorer domains={domains} />
          </div>
        </div>
      </section>

      {/* IN THE ROOM: stills from real games */}
      <section style={{ padding: '100px 0', background: '#0a0a0a', borderTop: '3px solid #F397C0' }}>
        <div className="container">
          <div className="lp-tag">Inside a game</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 5vw, 66px)', lineHeight: 0.9, letterSpacing: '0.03em', margin: '18px 0 28px', color: '#fff' }}>
            SWEAT. LAUGH. <span style={{ color: '#F397C0' }}>GO AGAIN.</span>
          </h2>
          <div className="lp-photos">
            {photos.map(p => (
              <img key={p.src} className="lp-photo" src={p.src} alt={p.alt} width={960} height={540} loading="lazy" decoding="async" />
            ))}
          </div>
        </div>
      </section>

      {/* EARN YOUR COLOURS */}
      <section id="colours" style={{ padding: '100px 0', background: '#0a0a0a', borderTop: '3px solid #2371BB' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px', alignItems: 'start' }}>
            <div>
              <div className="lp-tag">The Colours</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 6vw, 72px)', lineHeight: 0.9, letterSpacing: '0.03em', margin: '18px 0 10px', color: '#fff' }}>
                EARN YOUR<br /><span style={rainbowText}>COLOURS</span>
              </h2>
              <div className="lp-rainbow-line" style={{ width: '60px', marginBottom: '28px' }} />
              <p style={{ color: '#cccccc', fontSize: '17px', lineHeight: 1.7, marginBottom: '16px' }}>
                Twelve colours. Every event has a standard for each. Hit it and the colour is yours for the year.
              </p>
              <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
                Lift all ten domains to raise your overall colour. Age allowances built in.
              </p>
              <Link href="/grades" className="lp-btn lp-outline" style={{ fontSize: '17px', padding: '11px 28px' }}>See The Standards</Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {GRADES.map(g => (
                <div key={g.rung} className="lp-rank">
                  <span style={{
                    width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
                    background: g.rainbow ? RAINBOW : g.hex,
                    border: g.inverted ? '1px solid #555' : 'none',
                  }} />
                  <span className="lp-rank-name" style={{ fontFamily: 'var(--font-display)', fontSize: '19px', letterSpacing: '0.04em', color: '#fff' }}>
                    {g.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555' }}>
                    {g.colour}
                  </span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-label)', fontSize: '12px', color: '#444', letterSpacing: '0.06em' }}>
                    {g.populationTarget == null ? 'Anyone' : g.inverted ? 'One in a hundred' : g.rainbow ? 'Years of training' : `Top ${g.populationTarget}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* THE FILM: the full showcase, with sound. Nothing loads until play. */}
      <section id="film" style={{ padding: '100px 0', background: '#000', borderTop: '3px solid #B87DB5', scrollMarginTop: '72px' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div className="lp-tag">The film</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 0.9, letterSpacing: '0.03em', marginTop: '18px', color: '#fff' }}>
              ALLSPORT IN <span style={rainbowText}>ONE MINUTE</span>
            </h2>
          </div>
          <video
            controls
            playsInline
            preload="none"
            poster="/media/film-poster.jpg"
            src="/media/allsport-film.mp4"
            width={1280}
            height={720}
            style={{ display: 'block', width: '100%', maxWidth: '960px', height: 'auto', aspectRatio: '16 / 9', margin: '0 auto', borderRadius: '12px', background: '#111', border: '1px solid #1e1e1e' }}
          >
            Your browser cannot play this video.
          </video>
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
              Effort, spirit, standing. Every game is built on them.
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

      {/* CTA: over the team photo from the film */}
      <section style={{ padding: '130px 0', background: '#0a0a0a', textAlign: 'center', position: 'relative', overflow: 'hidden', borderTop: '3px solid #B87DB5' }}>
        <img src="/media/whanau.jpg" alt="" aria-hidden="true" width={1280} height={720} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.7) 55%, rgba(10,10,10,0.82) 100%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="lp-tag" style={{ background: 'rgba(0,0,0,0.5)' }}>Mahi. Mauri. Mana.</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 8vw, 92px)', lineHeight: 0.9, letterSpacing: '0.03em', margin: '18px 0 22px', color: '#fff' }}>
            JOIN THE <span style={rainbowText}>WHĀNAU</span>
          </h2>
          <div className="lp-rainbow-line" style={{ width: '88px', margin: '0 auto 30px' }} />
          <p style={{ color: '#ccc', fontSize: '18px', maxWidth: '480px', margin: '0 auto 38px', lineHeight: 1.7 }}>
            Turn up, play ten, earn your first colour. Koha only.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="lp-btn lp-primary" style={{ fontSize: '22px' }}>Play Your First Game</Link>
            <Link href="/koha" className="lp-btn lp-rainbow" style={{ fontSize: '22px' }}>Give Koha</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
