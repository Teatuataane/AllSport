'use client'

import Link from 'next/link'
import { RainbowText } from '@/components/ui'

const tiers = [
  {
    amount: 'Any Amount',
    referrals: '1 referral',
    reward: 'Supporters Wall',
    desc: 'Your name goes on the AllSport supporters wall. Every contribution, no matter the size, is acknowledged.',
    color: 'var(--grey)',
    isBase: true,
    referralPath: true,
  },
  {
    amount: '>$50',
    referrals: '3 referrals',
    reward: 'Digital Certificate',
    desc: 'A digital certificate acknowledging your koha — a formal record of your contribution to AllSport.',
    color: 'var(--green)',
    referralPath: true,
  },
  {
    amount: '>$200',
    referrals: '6 referrals',
    reward: 'Sticker Pack',
    desc: 'AllSport sticker pack plus your digital certificate. Represent the community.',
    color: 'var(--blue)',
    referralPath: true,
  },
  {
    amount: '>$500',
    referrals: '12 referrals',
    reward: 'Colours T-Shirt',
    desc: 'A t-shirt in the colour of your highest Colour achieved. Wear your mana.',
    color: 'var(--purple)',
    referralPath: true,
  },
  {
    amount: '>$1,000',
    referrals: '18 referrals',
    reward: 'Grading Hoodie',
    desc: 'A hoodie in the colour of your highest Colour achieved. The next level of representing your mana.',
    color: 'var(--red)',
    referralPath: true,
  },
  {
    amount: '>$2,000',
    referrals: '25 referrals',
    reward: 'Clothing Stack',
    desc: '$2,000 worth of AllSport merch — your choice of hoodies, shirts, or any combination. In your Colour.',
    color: 'var(--pink)',
    referralPath: true,
  },
  {
    amount: '>$2,500',
    reward: 'Personal Coaching — 20hrs',
    desc: '20 personal coaching sessions with AllSport. One-on-one training built around your goals.',
    color: 'var(--amber)',
    referralPath: false,
  },
  {
    amount: '>$5,000',
    reward: 'Personal Coaching — 50hrs',
    desc: '50 personal coaching sessions per year. The full AllSport coaching experience.',
    color: 'var(--amber)',
    referralPath: false,
  },
  {
    amount: '>$10,000',
    reward: 'AllSport Comes To You',
    desc: 'We bring AllSport to your workplace or community. Full corporate sessions, run by AllSport.',
    color: 'var(--amber)',
    isPremium: true,
    referralPath: false,
  },
]

const campaign = {
  title: 'Wheels for AllSport',
  goal: 8000,
  milestones: [
    { amount: 1000, label: 'Transport van', desc: 'Get AllSport sessions to parks and public venues across Ōtautahi' },
    { amount: 3000, label: 'Equipment trailer', desc: 'Carry a full set of gear to any outdoor location in the city' },
    { amount: 8000, label: 'Mobile AllSport setup', desc: 'A complete mobile competition kit — we come to you, anywhere' },
  ],
}

const kohaFacts = [
  'No set fees — give only what is right for you and your whānau',
  'AllSport is a community-led charitable initiative',
  'IRD 33% tax rebate applies to all koha contributions',
  'Koha acknowledgements range from the supporters wall to personal coaching',
  'Your grade is earned through performance — not through giving',
  'We collaborate with local sports clubs so more people benefit from more sport',
]

export default function Koha() {
  return (
    <>
      <style>{`
        .tier-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px 24px; position: relative; overflow: hidden; transition: border-color 0.2s; }
        .tier-card:hover { border-color: var(--border-strong); }
        .tier-card-premium { background: #0d0d0d; border: 1px solid rgba(249,176,81,0.3); border-radius: 12px; padding: 28px 24px; position: relative; overflow: hidden; transition: border-color 0.2s; }
        .tier-card-premium:hover { border-color: var(--amber); }
        .fact-card { display: flex; align-items: flex-start; gap: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '120px', paddingBottom: '80px', background: 'var(--black)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(77,178,110,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Registered Charity CC62657</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.92, marginBottom: '8px' }}>
            <RainbowText>KOHA</RainbowText>
          </h1>
          <div className="rainbow-line" style={{ width: '88px', margin: '20px 0 28px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey-light)', fontSize: '20px', maxWidth: '640px', lineHeight: 1.7 }}>
            AllSport is a registered charity (CC62657) built on koha. We want everyone to be able to engage in sport and exercise regardless of cost. We do not set fees — we only accept koha. Only give what is reasonable for you and your whānau.
          </p>
        </div>
      </section>

      {/* Wheels for AllSport campaign */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--blue)' }}>
        <div className="container">
          <div className="tag">Current Campaign</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px', lineHeight: 1 }}>
            WHEELS FOR <span style={{ color: 'var(--blue)' }}>ALLSPORT</span>
          </h2>
          <div className="divider" style={{ background: 'var(--blue)' }} />
          <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '560px', marginBottom: '40px', lineHeight: 1.7 }}>
            AllSport is built for parks, beaches, and public spaces — not just AllSport HQ. This campaign funds the transport and equipment to take sessions anywhere in Ōtautahi.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {campaign.milestones.map(m => (
              <div key={m.amount} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--blue)' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--blue)', lineHeight: 1, marginBottom: '4px' }}>${m.amount.toLocaleString()}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: '10px' }}>{m.label}</div>
                <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>{m.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid rgba(35,113,187,0.25)', borderRadius: '12px', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', color: 'var(--blue)', lineHeight: 1 }}>$8,000 Goal</div>
            <p style={{ color: 'var(--grey)', fontSize: '14px', lineHeight: 1.6, maxWidth: '560px' }}>
              100% of Wheels for AllSport koha goes toward transport and equipment. IRD 33% tax rebate applies — your $100 koha costs you $67.{' '}
              <a href="mailto:tane.clement@gmail.com?subject=Wheels for AllSport" style={{ color: 'var(--blue)' }}>Get in touch to contribute →</a>
            </p>
          </div>
        </div>
      </section>

      {/* What is Koha */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--green)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'center' }}>
            <div>
              <div className="tag">What Is Koha</div>
              <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px', lineHeight: 1 }}>
                SPORT FOR<br /><span style={{ color: 'var(--green)' }}>EVERYONE.</span>
              </h2>
              <div className="divider" style={{ background: 'var(--green)' }} />
              <p style={{ color: 'var(--grey-light)', fontSize: '17px', lineHeight: 1.8, marginBottom: '20px' }}>
                Koha is a Māori concept of giving — a voluntary contribution made from the heart, not from obligation. AllSport runs entirely on koha because we believe access to sport and health should never be limited by money.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
                There are no membership fees, no session costs, and no financial barriers to competing. Give what you can, when you can. Your participation and effort are contribution enough.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.8 }}>
                To acknowledge those who contribute generously, we offer tiers of appreciation — each a gift of gratitude, not a purchase.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {kohaFacts.map(text => (
                <div key={text} className="fact-card">
                  <span style={{ width: 20, height: 3, borderRadius: 3, background: 'var(--rainbow)', flexShrink: 0, marginTop: 9 }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: '15px', color: 'var(--grey-light)', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Koha tiers */}
      <section className="section" style={{ background: 'var(--dark)', borderTop: '3px solid var(--amber)' }}>
        <div className="container">
          <div className="tag">Acknowledgement Tiers</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
            KOHA <span style={{ color: 'var(--amber)' }}>APPRECIATION</span>
          </h2>
          <div className="divider" style={{ background: 'var(--amber)' }} />
          <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '560px', marginBottom: '16px', lineHeight: 1.7 }}>
            These are gifts of gratitude — not purchases, not memberships. Every tier is our way of saying thank you for believing in what we&apos;re building.
          </p>
          <div style={{ background: '#0d0d0d', border: '1px solid rgba(35,113,187,0.25)', borderLeft: '4px solid var(--blue)', borderRadius: '8px', padding: '14px 20px', marginBottom: '40px', maxWidth: '560px' }}>
            <p style={{ color: '#aaa', fontSize: '14px', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--white)' }}>Two paths to tiers 1–6:</strong> donate koha OR refer enough new players. Tiers 7–9 (coaching and corporate) require a koha donation. Referrals qualify when your referred player completes their 10th session.
            </p>
          </div>

          {/* Base tier — any amount, full width */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px 28px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--rainbow)' }} />
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--grey)', lineHeight: 1 }}>{tiers[0].amount}</span>
                <span style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--white)' }}>{tiers[0].reward}</span>
                {tiers[0].referralPath && (
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', borderLeft: '2px solid #333', paddingLeft: '10px' }}>
                    or {tiers[0].referrals}
                  </span>
                )}
              </div>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.6 }}>{tiers[0].desc}</p>
            </div>
          </div>

          {/* Remaining tiers — grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {tiers.slice(1).map(tier => (
              <div key={tier.amount} className={tier.isPremium ? 'tier-card-premium' : 'tier-card'}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: tier.color }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '2px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', color: tier.color, lineHeight: 1 }}>{tier.amount}</div>
                  {tier.referralPath && 'referrals' in tier && (
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', borderLeft: '2px solid #333', paddingLeft: '10px' }}>
                      or {tier.referrals}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: '12px' }}>{tier.reward}</div>
                <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.65 }}>{tier.desc}</p>
              </div>
            ))}
          </div>

          {/* IRD callout */}
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(249,176,81,0.25)', borderRadius: '12px', padding: '28px 32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginTop: '32px' }}>
            <div style={{ width: 26, height: 4, borderRadius: 3, background: 'var(--rainbow)', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--amber)', marginBottom: '4px' }}>IRD Tax Rebate</div>
              <p style={{ color: 'var(--grey-light)', fontSize: '15px', lineHeight: 1.7, maxWidth: '600px' }}>
                Any koha donated to AllSport can be claimed with the IRD to receive <strong style={{ color: 'var(--white)' }}>33% of your donation back</strong> as a tax credit. Your generosity goes further than you think.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: 'var(--black)', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            JOIN THE <RainbowText>WHĀNAU</RainbowText>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey)', fontSize: '16px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            No fees. No barriers. Just sport, community, and the chance to become the most complete athlete you can be.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '17px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}
