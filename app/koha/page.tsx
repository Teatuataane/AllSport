'use client'

import Link from 'next/link'

const tiers = [
  {
    amount: 'Any Amount',
    reward: 'Supporters Wall',
    desc: 'Your name goes on the AllSport supporters wall. Every contribution, no matter the size, is acknowledged.',
    icon: '🫶',
    color: '#888888',
    isBase: true,
  },
  {
    amount: '>$50',
    reward: 'Digital Certificate',
    desc: 'A digital certificate acknowledging your koha — a formal record of your contribution to AllSport.',
    icon: '📜',
    color: '#2d9e4f',
  },
  {
    amount: '>$200',
    reward: 'Sticker Pack + Certificate',
    desc: 'AllSport sticker pack plus your digital certificate. Represent the community.',
    icon: '🎁',
    color: '#2563eb',
  },
  {
    amount: '>$500',
    reward: 'Grading T-Shirt',
    desc: 'A t-shirt in the colour of your highest grade achieved. Wear your mana.',
    icon: '👕',
    color: '#9333ea',
  },
  {
    amount: '>$2,000',
    reward: 'AllSport Clothing Stack',
    desc: 'The full AllSport clothing set — everything we produce, in your grade colours.',
    icon: '🎽',
    color: '#e63946',
  },
  {
    amount: '>$5,000',
    reward: 'Personal Coaching',
    desc: '50 personal coaching sessions per year. One-on-one training built around your goals.',
    icon: '🏆',
    color: '#f4a226',
  },
  {
    amount: '>$10,000',
    reward: 'AllSport Comes To You',
    desc: 'We bring AllSport to your workplace or community. Full corporate sessions, run by AllSport.',
    icon: '🌍',
    color: '#f4a226',
    isPremium: true,
  },
]

export default function Koha() {
  return (
    <>
      <style>{`
        .tier-card { background: #111111; border: 1px solid #1e1e1e; padding: 28px 24px; position: relative; overflow: hidden; transition: border-color 0.2s; }
        .tier-card:hover { border-color: #333; }
        .tier-card-premium { background: #0d0d0d; border: 1px solid #f4a22644; padding: 28px 24px; position: relative; overflow: hidden; transition: border-color 0.2s; }
        .tier-card-premium:hover { border-color: #f4a226; }
        .fact-card { display: flex; align-items: flex-start; gap: 16px; background: #111111; border: 1px solid #1e1e1e; padding: 16px 20px; }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '152px', paddingBottom: '80px', background: '#000000', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(45,158,79,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Community-Led Charitable Initiative</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, marginBottom: '8px' }}>
            <span style={{
              background: 'linear-gradient(90deg, #2d9e4f, #2563eb)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>KOHA</span>
          </h1>
          <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />
          <p style={{ color: '#cccccc', fontSize: '20px', maxWidth: '640px', lineHeight: 1.7 }}>
            AllSport is a community-led charitable initiative. We want everyone to be able to engage in sport and exercise regardless of cost. We do not set fees — we only accept koha. Only give what is reasonable for you and your whānau.
          </p>
        </div>
      </section>

      {/* What is Koha — green */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #2d9e4f' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'center' }}>
            <div>
              <div className="tag">What Is Koha</div>
              <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px', lineHeight: 1 }}>
                SPORT FOR<br /><span style={{ color: '#2d9e4f' }}>EVERYONE.</span>
              </h2>
              <div className="divider" style={{ background: '#2d9e4f' }} />
              <p style={{ color: '#cccccc', fontSize: '17px', lineHeight: 1.8, marginBottom: '20px' }}>
                Koha is a Māori concept of giving — a voluntary contribution made from the heart, not from obligation. AllSport runs entirely on koha because we believe access to sport and health should never be limited by money.
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
                There are no membership fees, no session costs, and no financial barriers to competing. Give what you can, when you can. Your participation and effort are contribution enough.
              </p>
              <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.8 }}>
                To acknowledge those who contribute generously, we offer seven tiers of appreciation — each a gift of gratitude, not a purchase.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { icon: '💚', text: 'No set fees — give only what is right for you and your whānau' },
                { icon: '🏛️', text: 'AllSport is a community-led charitable initiative' },
                { icon: '💸', text: 'IRD 33% tax rebate applies to all koha contributions' },
                { icon: '🎽', text: 'Koha acknowledgements range from the supporters wall to personal coaching' },
                { icon: '🌈', text: 'Your grade is earned through performance — not through giving' },
                { icon: '🤝', text: 'We collaborate with local sports clubs so more people benefit from more sport' },
              ].map(item => (
                <div key={item.text} className="fact-card">
                  <span style={{ fontSize: '20px', marginTop: '2px' }}>{item.icon}</span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: '15px', color: '#cccccc', lineHeight: 1.5 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Koha tiers — gold */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #f4a226' }}>
        <div className="container">
          <div className="tag">Acknowledgement Tiers</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
            KOHA <span style={{ color: '#f4a226' }}>APPRECIATION</span>
          </h2>
          <div className="divider" style={{ background: '#f4a226' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '560px', marginBottom: '48px', lineHeight: 1.7 }}>
            These are gifts of gratitude — not purchases, not memberships. Every tier is our way of saying thank you for believing in what we're building.
          </p>

          {/* Base tier — any amount, full width */}
          <div style={{ background: '#111111', border: '1px solid #1e1e1e', padding: '24px 28px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#333' }} />
            <div style={{ fontSize: '32px' }}>{tiers[0].icon}</div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '36px', color: '#888', lineHeight: 1 }}>{tiers[0].amount}</span>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff' }}>{tiers[0].reward}</span>
              </div>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.6 }}>{tiers[0].desc}</p>
            </div>
          </div>

          {/* Remaining tiers — grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {tiers.slice(1).map(tier => (
              <div key={tier.amount} className={tier.isPremium ? 'tier-card-premium' : 'tier-card'}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: tier.color }} />
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{tier.icon}</div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '40px', color: tier.color, lineHeight: 1, marginBottom: '2px' }}>{tier.amount}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff', marginBottom: '12px' }}>{tier.reward}</div>
                <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.65 }}>{tier.desc}</p>
              </div>
            ))}
          </div>

          {/* IRD callout */}
          <div style={{ background: '#111111', border: '1px solid #f4a22633', padding: '28px 32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginTop: '32px' }}>
            <div style={{ fontSize: '32px' }}>💸</div>
            <div>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#f4a226', marginBottom: '4px' }}>IRD Tax Rebate</div>
              <p style={{ color: '#cccccc', fontSize: '15px', lineHeight: 1.7, maxWidth: '600px' }}>
                Any koha donated to AllSport can be claimed with the IRD to receive <strong style={{ color: '#ffffff' }}>33% of your donation back</strong> as a tax credit. Your generosity goes further than you think.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: '#000000', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            JOIN THE <span style={{ background: 'linear-gradient(90deg, #2d9e4f, #2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>WHĀNAU</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            No fees. No barriers. Just sport, community, and the chance to become the most complete athlete you can be.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '20px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}
