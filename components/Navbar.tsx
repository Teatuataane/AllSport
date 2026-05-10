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

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
  }

  const publicLinks = [
    { href: '/', label: 'HOME' },
    { href: '/how-to-play', label: 'HOW TO PLAY' },
    { href: '/schedule', label: 'SCHEDULE' },
    { href: '/leaderboard', label: 'LEADERBOARD' },
    { href: '/koha', label: 'KOHA' },
  ]

  const loggedInMenuLinks = [
    { href: '/', label: 'HOME' },
    { href: '/how-to-play', label: 'HOW TO PLAY' },
    { href: '/events', label: 'EVENTS' },
    { href: '/schedule', label: 'SCHEDULE' },
    { href: '/leaderboard', label: 'LEADERBOARD' },
    { href: '/koha', label: 'KOHA' },
    { href: '/prs', label: 'MY PERSONAL BESTS' },
  ]

  const isLoggedIn = !authLoading && !!user

  return (
    <>
      {/* Rainbow stripe */}
      <div style={{
        height: '4px',
        background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1001,
      }} />

      <nav style={{
        position: 'fixed', top: '4px', left: 0, right: 0, zIndex: 1000,
        background: '#000', borderBottom: '1px solid #1e1e1e',
        padding: '0 20px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link href={isLoggedIn ? '/dashboard' : '/'} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          textDecoration: 'none', flexShrink: 0,
        }}>
          <img src="/logo.png" alt="AllSport" style={{ height: '36px' }} />
          <span style={{
            fontFamily: 'var(--font-bebas)', fontSize: '22px',
            color: '#fff', letterSpacing: '2px',
          }}>
            ALL<span style={{ color: '#EA4742' }}>SPORT</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {!authLoading && (isLoggedIn ? (
            <>
              <Link href="/dashboard" style={{
                background: '#2371BB', color: '#fff',
                padding: '8px 18px', borderRadius: '6px',
                textDecoration: 'none',
                fontFamily: 'var(--font-barlow-condensed)',
                fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px',
              }}>
                DASHBOARD
              </Link>

              <button onClick={handleSignOut} style={{
                background: 'transparent', border: '1px solid #333',
                borderRadius: '4px', cursor: 'pointer',
                fontFamily: 'var(--font-barlow-condensed)',
                fontSize: '12px', fontWeight: 'bold',
                letterSpacing: '1px', color: '#888',
                padding: '6px 12px',
              }}>
                SIGN OUT
              </button>

              {/* Hamburger — always visible when logged in */}
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Menu"
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '6px',
                  display: 'flex', flexDirection: 'column',
                  gap: '5px', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{
                  display: 'block', width: '22px', height: '2px',
                  background: menuOpen ? '#EA4742' : '#fff',
                  transition: 'all 0.2s',
                  transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none',
                }} />
                <span style={{
                  display: 'block', width: '22px', height: '2px',
                  background: '#fff', transition: 'all 0.2s',
                  opacity: menuOpen ? 0 : 1,
                }} />
                <span style={{
                  display: 'block', width: '22px', height: '2px',
                  background: menuOpen ? '#EA4742' : '#fff',
                  transition: 'all 0.2s',
                  transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
                }} />
              </button>
            </>
          ) : (
            <>
              {/* Desktop links — logged-out only */}
              <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '24px', marginRight: '12px' }}>
                {publicLinks.map(link => (
                  <Link key={link.href} href={link.href} style={{
                    fontFamily: 'var(--font-barlow-condensed)', fontSize: '13px',
                    letterSpacing: '1px', color: pathname === link.href ? '#fff' : '#888',
                    textDecoration: 'none', fontWeight: 'bold',
                  }}>
                    {link.label}
                  </Link>
                ))}
              </div>

              <Link href="/play" style={{
                background: '#EA4742', color: '#fff',
                padding: '8px 24px', borderRadius: '6px',
                textDecoration: 'none',
                fontFamily: 'var(--font-barlow-condensed)',
                fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px',
              }}>
                PLAY NOW
              </Link>

              {/* Mobile hamburger — logged-out */}
              <button
                className="hamburger"
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Toggle menu"
                style={{
                  display: 'none', background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '6px', flexDirection: 'column',
                  gap: '5px', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{
                  display: 'block', width: '22px', height: '2px',
                  background: menuOpen ? '#EA4742' : '#fff', transition: 'all 0.2s',
                  transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none',
                }} />
                <span style={{
                  display: 'block', width: '22px', height: '2px',
                  background: '#fff', transition: 'all 0.2s', opacity: menuOpen ? 0 : 1,
                }} />
                <span style={{
                  display: 'block', width: '22px', height: '2px',
                  background: menuOpen ? '#EA4742' : '#fff', transition: 'all 0.2s',
                  transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
                }} />
              </button>
            </>
          ))}
        </div>
      </nav>

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: '64px', left: 0, right: 0, zIndex: 999,
          background: '#000', borderBottom: '1px solid #1e1e1e',
          display: 'flex', flexDirection: 'column',
        }}>
          {(isLoggedIn ? loggedInMenuLinks : publicLinks).map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '16px 24px', borderBottom: '1px solid #111',
                fontFamily: 'var(--font-barlow-condensed)',
                fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px',
                color: pathname === link.href ? '#EA4742' : '#ccc',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div style={{ height: '64px' }} />
    </>
  )
}
