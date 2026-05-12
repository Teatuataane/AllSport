'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

interface Partner {
  id: string
  club_name: string
  sport: string | null
  description: string | null
  website_url: string | null
  logo_url: string | null
  display_order: number
}

export default function Supporters() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
      setPartners(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <style>{`
        .partner-card {
          background: #111; border: 1px solid #1e1e1e;
          padding: 28px 24px; position: relative; overflow: hidden;
          transition: border-color 0.2s;
        }
        .partner-card:hover { border-color: #333; }
        .supporter-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 0; border-bottom: 1px solid #111;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 15px; color: #888;
        }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '152px', paddingBottom: '80px', background: '#000', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(45,158,79,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Community &amp; Whānau</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, marginBottom: '8px' }}>
            <span style={{ background: 'linear-gradient(90deg, #2d9e4f, #2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              SUPPORTERS
            </span>
          </h1>
          <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />
          <p style={{ color: '#cccccc', fontSize: '20px', maxWidth: '640px', lineHeight: 1.7 }}>
            AllSport exists because of the people and organisations who believe sport should be accessible to everyone. This page honours those who make it possible.
          </p>
        </div>
      </section>

      {/* Partner Clubs */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #2371BB' }}>
        <div className="container">
          <div className="tag">Club Partnerships</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
            PARTNER <span style={{ color: '#2371BB' }}>CLUBS</span>
          </h2>
          <div className="divider" style={{ background: '#2371BB' }} />
          <p style={{ color: '#888', fontSize: '16px', maxWidth: '600px', marginBottom: '40px', lineHeight: 1.7 }}>
            AllSport partners with local sports clubs across Ōtautahi to run sessions on their turf — bringing new people into their sport while expanding the AllSport community. Their facilities and equipment help AllSport grow beyond AllSport HQ.
          </p>

          {loading ? (
            <div style={{ color: '#444', fontFamily: 'Barlow, sans-serif', padding: '40px 0' }}>Loading partners...</div>
          ) : partners.length === 0 ? (
            <div style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderLeft: '4px solid #2371BB', borderRadius: '12px',
              padding: '40px 32px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '32px', color: '#2371BB', marginBottom: '8px' }}>Partnerships Coming Soon</div>
              <p style={{ color: '#666', fontSize: '15px', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto' }}>
                We are actively building relationships with clubs across Ōtautahi. If your club is interested in hosting an AllSport session, get in touch.
              </p>
              <a
                href="mailto:tane.clement@gmail.com?subject=AllSport Club Partnership"
                style={{
                  display: 'inline-block', marginTop: '20px',
                  padding: '12px 28px', background: '#2371BB', color: '#fff',
                  borderRadius: '8px', textDecoration: 'none',
                  fontFamily: 'Bebas Neue, cursive', fontSize: '18px', letterSpacing: '0.05em',
                }}
              >
                Enquire About Partnering
              </a>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {partners.map(p => (
                <div key={p.id} className="partner-card" style={{ borderTop: '3px solid #2371BB' }}>
                  {p.logo_url && (
                    <img src={p.logo_url} alt={p.club_name} style={{ width: '64px', height: '64px', objectFit: 'contain', marginBottom: '16px', borderRadius: '8px', background: '#0d0d0d', padding: '8px' }} />
                  )}
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#fff', lineHeight: 1, marginBottom: '4px' }}>{p.club_name}</div>
                  {p.sport && (
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2371BB', marginBottom: '12px' }}>{p.sport}</div>
                  )}
                  {p.description && (
                    <p style={{ color: '#777', fontSize: '14px', lineHeight: 1.65, marginBottom: '16px' }}>{p.description}</p>
                  )}
                  {p.website_url && (
                    <a href={p.website_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, color: '#2371BB', textDecoration: 'none', letterSpacing: '0.05em' }}>
                      Visit website →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Koha Supporters Wall */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #4DB26E' }}>
        <div className="container">
          <div className="tag">Koha Supporters</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
            SUPPORTERS <span style={{ color: '#4DB26E' }}>WALL</span>
          </h2>
          <div className="divider" style={{ background: '#4DB26E' }} />
          <p style={{ color: '#888', fontSize: '16px', maxWidth: '560px', marginBottom: '40px', lineHeight: 1.7 }}>
            Every koha — no matter the amount — is acknowledged here. These are the people and organisations who have chosen to invest in AllSport's mission.
          </p>

          {/* Placeholder wall — to be populated when koha supporters table exists */}
          <div style={{
            background: '#111', border: '1px solid #1e1e1e',
            borderLeft: '4px solid #4DB26E', borderRadius: '12px',
            padding: '32px',
          }}>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.7, fontStyle: 'italic' }}>
              Supporter names will appear here as koha is received. Be the first to have your name on the wall — visit the{' '}
              <Link href="/koha" style={{ color: '#4DB26E', textDecoration: 'none' }}>Koha page</Link>{' '}
              to learn more.
            </p>
          </div>
        </div>
      </section>

      {/* CTA — become a supporter */}
      <section style={{ padding: '80px 0', background: '#000', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            BACK THE <span style={{ background: 'linear-gradient(90deg, #2d9e4f, #2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>KAUPAPA</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '480px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            AllSport is a registered charity (CC62657) built on koha. Any contribution — large or small — goes directly toward keeping sessions free and growing the sport.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/koha" className="btn btn-primary" style={{ fontSize: '20px' }}>Give Koha</Link>
            <a href="mailto:tane.clement@gmail.com?subject=AllSport Partnership Enquiry" className="btn btn-outline" style={{ fontSize: '20px' }}>Partner with Us</a>
          </div>
        </div>
      </section>
    </>
  )
}
