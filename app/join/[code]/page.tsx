'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!code) { setLoading(false); return }
    const fetch = async () => {
      const { data } = await supabase.rpc('get_referrer_by_code', { p_code: code.toUpperCase() })
      if (data && data.length > 0) setReferrerName(data[0].display_name)
      setLoading(false)
    }
    fetch()
  }, [code])

  const registerUrl = `/register?ref=${code?.toUpperCase() ?? ''}`

  const domains = [
    { icon: '🏋️', name: 'Strength' },
    { icon: '🤸', name: 'Flexibility' },
    { icon: '⚡', name: 'Power' },
    { icon: '🫀', name: 'Endurance' },
    { icon: '🏃', name: 'Speed' },
    { icon: '🥋', name: 'Body Awareness' },
    { icon: '🎯', name: 'Aim' },
    { icon: '🏐', name: 'Coordination' },
    { icon: '💪', name: 'Relative Strength' },
    { icon: '🔄', name: 'Muscle Endurance' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <style>{`
        .domain-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: #111; border: 1px solid #1e1e1e;
          padding: 6px 12px; border-radius: 20px; margin: 4px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: #888;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#000',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.5 }} />

        {/* Rainbow top stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '480px', width: '100%', textAlign: 'center' }}>

          {/* Logo */}
          <img
            src="/logo.png"
            alt="AllSport"
            style={{ width: '120px', objectFit: 'contain', marginBottom: '32px', animation: 'float 5s ease-in-out infinite' }}
          />

          {/* Invite message */}
          {referrerName ? (
            <div style={{
              background: '#0d0d0d', border: '1px solid #1e1e1e',
              borderLeft: '4px solid #2371BB',
              borderRadius: '12px', padding: '16px 20px',
              marginBottom: '32px', textAlign: 'left',
            }}>
              <div style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Personal invitation from
              </div>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#2371BB', letterSpacing: '0.04em', lineHeight: 1 }}>
                {referrerName}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '32px' }} />
          )}

          {/* Main headline */}
          <h1 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 'clamp(48px, 12vw, 80px)', lineHeight: 0.9, marginBottom: '8px' }}>
            PLAY
          </h1>
          <h1 style={{
            fontFamily: 'Bebas Neue, cursive', fontSize: 'clamp(36px, 9vw, 64px)',
            lineHeight: 0.9, marginBottom: '24px',
            background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            EVERYTHING
          </h1>

          <div style={{ height: '3px', width: '60px', margin: '0 auto 24px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', borderRadius: '2px' }} />

          {/* Description */}
          <p style={{ color: '#cccccc', fontSize: '17px', lineHeight: 1.75, marginBottom: '12px' }}>
            AllSport is a new sport built in Ōtautahi. Every session, you compete across <strong style={{ color: '#fff' }}>10 disciplines</strong> — one from each domain of human movement — in 100 minutes.
          </p>
          <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.75, marginBottom: '28px' }}>
            No experience needed. No specialist skills required. Koha only — no fixed fees. Just show up and give what you have.
          </p>

          {/* Domain chips */}
          <div style={{ marginBottom: '36px' }}>
            {domains.map(d => (
              <span key={d.name} className="domain-chip">
                {d.icon} {d.name}
              </span>
            ))}
          </div>

          {/* Key facts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '36px' }}>
            {[
              { value: '10', label: 'Disciplines' },
              { value: '100', label: 'Events' },
              { value: '$0', label: 'Min. cost' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '14px 8px' }}>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '32px', background: 'linear-gradient(90deg, #EA4742, #2371BB)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginTop: '4px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            href={registerUrl}
            style={{
              display: 'block', width: '100%', padding: '18px',
              background: '#EA4742', color: '#fff',
              fontFamily: 'Bebas Neue, cursive', fontSize: '24px',
              letterSpacing: '0.06em', textDecoration: 'none',
              borderRadius: '12px', marginBottom: '12px',
              transition: 'opacity 0.15s',
            }}
          >
            Register Free
          </Link>

          <Link
            href="/how-to-play"
            style={{
              display: 'block', width: '100%', padding: '14px',
              background: 'transparent', color: '#555',
              fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
              fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase',
              textDecoration: 'none', borderRadius: '12px',
              border: '1px solid #1e1e1e',
            }}
          >
            Learn how it works →
          </Link>

          <p style={{ color: '#333', fontSize: '12px', marginTop: '24px', fontFamily: 'Barlow, sans-serif' }}>
            AllSport Aotearoa — Registered Charity CC62657
          </p>
        </div>
      </div>
    </>
  )
}
