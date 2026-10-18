// Server component. This page has no state of its own; RainbowText and the
// copy button are small client islands.
//
// Shortened 14 Oct 2026: give first, then where the money goes, then coaching
// and the thank-you ladder. The ladder itself lives in lib/kohaTiers.ts so
// /my-koha shows the same rewards.
import Link from 'next/link'
import { RainbowText } from '@/components/ui'
import { CopyButton } from '@/components/CopyButton'
import { KOHA_BANK, KOHA_EMAIL, KOHA_TIERS } from '@/lib/kohaTiers'

// Campaign figures are typed in by hand; update them here as funding lands.
const campaigns = [
  {
    title: 'Weekly Games at HQ',
    color: 'var(--green)',
    body: 'Three games a week: Tuesday and Thursday 4:30pm, Saturday 9:00am. Funded by players’ koha alone, with no outside funding.',
  },
  {
    title: 'Wheels for AllSport',
    color: 'var(--blue)',
    body: 'A van to take AllSport to parks, beaches and schools across Ōtautahi. Thanks to Lion Foundation for the first $7,000.',
    raised: 7000,
    goal: 40000,
  },
  {
    title: 'AllSport in Schools',
    color: 'var(--amber)',
    body: 'A Term 1 pilot in schools, with $5,300 committed by Sport Canterbury.',
  },
]

const mailto = (subject: string) => `mailto:${KOHA_EMAIL}?subject=${encodeURIComponent(subject)}`

const labelStyle = { fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--grey)', marginBottom: '6px' }
const h2Style = { fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px', lineHeight: 1 }
const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' as const }

export const metadata = {
  title: 'Koha · AllSport',
  description:
    'AllSport is koha-based: no set fee. See where koha goes and how to give, from weekly games at HQ to taking AllSport into schools.',
  alternates: { canonical: '/koha' },
}

export default function Koha() {
  return (
    <>
      {/* Hero */}
      <section style={{ paddingTop: '120px', paddingBottom: '56px', background: 'var(--black)' }}>
        <div className="container">
          <div className="tag">Registered Charity CC62657</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.92, marginBottom: '8px' }}>
            <RainbowText>KOHA</RainbowText>
          </h1>
          <div className="rainbow-line" style={{ width: '88px', margin: '20px 0 28px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey-light)', fontSize: '20px', maxWidth: '640px', lineHeight: 1.6 }}>
            No fees. Ever. Koha is a gift from the heart: give what&apos;s right for you and your wh&#257;nau.
          </p>
        </div>
      </section>

      {/* How to give: the one thing this page must make easy */}
      <section id="give" className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--green)', scrollMarginTop: '72px' }}>
        <div className="container">
          <h2 style={h2Style}>GIVE <span style={{ color: 'var(--green)' }}>KOHA</span></h2>
          <div className="divider" style={{ background: 'var(--green)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', maxWidth: '880px' }}>
            <div style={cardStyle}>
              <div style={labelStyle}>Account number</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--white)', lineHeight: 1.1, letterSpacing: '0.03em', userSelect: 'all' }}>{KOHA_BANK.account}</div>
                <CopyButton value={KOHA_BANK.account} />
              </div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Account name</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--white)', lineHeight: 1.1, letterSpacing: '0.03em' }}>{KOHA_BANK.name}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Reference</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--white)', lineHeight: 1.1, letterSpacing: '0.03em' }}>Your name</div>
            </div>
          </div>
          <p style={{ color: 'var(--grey-light)', fontSize: '15px', lineHeight: 1.7, marginTop: '20px', maxWidth: '640px' }}>
            We are an IRD approved donee organisation. Claim <strong style={{ color: 'var(--white)' }}>33% back</strong>: a $100 koha costs you $67.{' '}
            <a href={mailto('Koha receipt')} style={{ color: 'var(--green)' }}>Email us for a receipt</a>.
          </p>
        </div>
      </section>

      {/* Where it goes */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--blue)' }}>
        <div className="container">
          <h2 style={h2Style}>WHERE IT <span style={{ color: 'var(--blue)' }}>GOES</span></h2>
          <div className="divider" style={{ background: 'var(--blue)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {campaigns.map(c => (
              <div key={c.title} style={{ ...cardStyle, padding: '28px 24px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: c.color }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--white)', lineHeight: 1, marginBottom: '12px' }}>{c.title}</div>
                <p style={{ color: 'var(--grey-light)', fontSize: '14px', lineHeight: 1.6 }}>{c.body}</p>
                {c.goal && c.raised !== undefined && (
                  <div style={{ marginTop: '18px' }}>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((c.raised / c.goal) * 100, 100)}%`, height: '100%', background: c.color }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--grey-light)', marginTop: '8px' }}>
                      ${c.raised.toLocaleString()} of ${c.goal.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coaching: its own offer, not a tier */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--purple)' }}>
        <div className="container">
          <h2 style={h2Style}>PERSONAL <span style={{ color: 'var(--purple)' }}>COACHING</span></h2>
          <div className="divider" style={{ background: 'var(--purple)' }} />
          <p style={{ color: 'var(--grey-light)', fontSize: '16px', maxWidth: '560px', lineHeight: 1.7, marginBottom: '24px' }}>
            One-on-one sessions built around your goals. Every session helps fund the weekly games.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {[{ price: '$40', len: '30 minutes' }, { price: '$60', len: '1 hour' }].map(o => (
              <div key={o.len} style={{ ...cardStyle, flex: '1 1 130px', maxWidth: '240px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '44px', color: 'var(--purple)', lineHeight: 1 }}>{o.price}</div>
                <div style={{ ...labelStyle, color: 'var(--white)', marginBottom: 0, marginTop: '4px' }}>{o.len}</div>
              </div>
            ))}
          </div>
          <p style={{ color: 'var(--grey)', fontSize: '14px', lineHeight: 1.6 }}>
            Recommended koha.{' '}
            <a href={mailto('Personal coaching')} style={{ color: 'var(--purple)' }}>Email us to book</a>.
          </p>
        </div>
      </section>

      {/* Thank you ladder */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--amber)' }}>
        <div className="container">
          <h2 style={h2Style}>OUR <span style={{ color: 'var(--amber)' }}>THANKS</span></h2>
          <div className="divider" style={{ background: 'var(--amber)' }} />
          <p style={{ color: 'var(--grey)', fontSize: '15px', maxWidth: '560px', marginBottom: '24px', lineHeight: 1.7 }}>
            A thank you, not a purchase. Colours are earned by playing, never by giving.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '720px' }}>
            {KOHA_TIERS.map(t => (
              <div key={t.tier} style={{ ...cardStyle, padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: '20px', flexWrap: 'wrap', borderLeft: `4px solid ${t.color}` }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: t.color, lineHeight: 1, minWidth: '96px' }}>
                  {t.donationMin === 0 ? 'Any' : `$${t.donationMin.toLocaleString()}+`}
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--white)' }}>{t.reward}</div>
                  <p style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.5, marginTop: '2px' }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.7, marginTop: '28px' }}>
            <strong style={{ color: 'var(--white)' }}>Can&apos;t give money?</strong> Bring a friend to a game. <Link href="/schedule" style={{ color: 'var(--amber)' }}>See the schedule</Link>.
          </p>
        </div>
      </section>
    </>
  )
}
