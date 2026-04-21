'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navLinks = [
    { href: '/', label: 'HOME' },
    { href: '/how-to-play', label: 'HOW TO PLAY' },
    { href: '/schedule', label: 'SCHEDULE' },
    { href: '/leaderboard', label: 'LEADERBOARD' },
    { href: '/koha', label: 'KOHA' },
  ]

  return (
    <>
      {/* Rainbow stripe */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1001 }} />

      <nav style={{ position: 'fixed', top: '4px', left: 0, right: 0, zIndex: 1000, background: '#000', borderBottom: '1px solid #1e1e1e', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src="/logo.png" alt="AllSport" style={{ height: '36px' }} />
          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', color: '#fff', letterSpacing: '2px' }}>
            ALL<span style={{ color: '#EA4742' }}>SPORT</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }} className="desktop-nav">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} style={{
              fontFamily: 'var(--font-barlow-condensed)', fontSize: '13px', letterSpacing: '1px',
              color: pathname === link.href ? '#fff' : '#888', textDecoration: 'none', fontWeight: 'bold',
            }}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTA — held until auth resolves to avoid flicker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '120px', justifyContent: 'flex-end' }}>
          {!authLoading && (user ? (
            <>
              <Link href="/dashboard" style={{
                background: '#2371BB', color: '#fff', padding: '8px 20px', borderRadius: '6px',
                textDecoration: 'none', fontFamily: 'var(--font-barlow-condensed)',
                fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px',
              }}>
                DASHBOARD
              </Link>
              <button onClick={handleSignOut} style={{
                background: 'transparent', border: '1px solid #333', color: '#888',
                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: 'var(--font-barlow-condensed)', fontSize: '13px', letterSpacing: '1px',
              }}>
                SIGN OUT
              </button>
            </>
          ) : (
            <Link href="/play" style={{
              background: '#EA4742', color: '#fff', padding: '8px 24px', borderRadius: '6px',
              textDecoration: 'none', fontFamily: 'var(--font-barlow-condensed)',
              fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px',
            }}>
              PLAY NOW
            </Link>
          ))}
        </div>
      </nav>

      {/* Spacer */}
      <div style={{ height: '64px' }} />
    </>
  )
}
