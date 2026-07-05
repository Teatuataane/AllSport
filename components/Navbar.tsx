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

  const hamburgerBar = (transform: string, opacity = 1): React.CSSProperties => ({
    display: 'block', width: 22, height: 2,
    background: menuOpen && transform !== 'mid' ? 'var(--red)' : 'var(--white)',
    transition: 'all 0.2s',
    transform: menuOpen ? transform : 'none',
    opacity,
  })

  return (
    <>
      {/* Rainbow stripe — the brand's signature edge */}
      <div style={{
        height: 5,
        background: 'var(--rainbow)',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1001,
      }} />

      <nav style={{
        position: 'fixed', top: 5, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(10,10,10,0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link href={isLoggedIn ? '/dashboard' : '/'} style={{
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <img src="/logo.png" alt="AllSport" style={{ height: 38 }} />
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            color: 'var(--white)', letterSpacing: '0.09em', lineHeight: 1,
          }}>
            ALL<span style={{ color: 'var(--red)' }}>SPORT</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!authLoading && (isLoggedIn ? (
            <>
              <Link href="/dashboard" style={{
                background: 'var(--blue)', color: 'var(--white)',
                padding: '9px 20px', borderRadius: 999,
                fontFamily: 'var(--font-label)',
                fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
                lineHeight: 1, boxShadow: 'var(--glow-blue)',
              }}>
                DASHBOARD
              </Link>

              <button onClick={handleSignOut} style={{
                background: 'transparent', border: '1px solid var(--border-strong)',
                borderRadius: 999, cursor: 'pointer',
                fontFamily: 'var(--font-label)',
                fontSize: 12, fontWeight: 600,
                letterSpacing: '0.08em', color: 'var(--grey)',
                padding: '8px 14px', lineHeight: 1,
              }}>
                SIGN OUT
              </button>

              {/* Hamburger — always visible when logged in */}
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Menu"
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: 6,
                  display: 'flex', flexDirection: 'column',
                  gap: 5, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={hamburgerBar('rotate(45deg) translate(5px, 5px)')} />
                <span style={hamburgerBar('mid', menuOpen ? 0 : 1)} />
                <span style={hamburgerBar('rotate(-45deg) translate(5px, -5px)')} />
              </button>
            </>
          ) : (
            <>
              {/* Desktop links — logged-out only */}
              <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 24, marginRight: 12 }}>
                {publicLinks.map(link => (
                  <Link key={link.href} href={link.href} style={{
                    fontFamily: 'var(--font-label)', fontSize: 13,
                    letterSpacing: '0.1em', fontWeight: 600,
                    color: pathname === link.href ? 'var(--white)' : 'var(--grey)',
                    transition: 'color 200ms',
                  }}>
                    {link.label}
                  </Link>
                ))}
              </div>

              <Link href="/play" style={{
                background: 'var(--red)', color: 'var(--white)',
                padding: '9px 24px', borderRadius: 999,
                fontFamily: 'var(--font-label)',
                fontSize: 14, fontWeight: 600, letterSpacing: '0.1em',
                lineHeight: 1, boxShadow: 'var(--glow-red)',
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
                  cursor: 'pointer', padding: 6, flexDirection: 'column',
                  gap: 5, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={hamburgerBar('rotate(45deg) translate(5px, 5px)')} />
                <span style={hamburgerBar('mid', menuOpen ? 0 : 1)} />
                <span style={hamburgerBar('rotate(-45deg) translate(5px, -5px)')} />
              </button>
            </>
          ))}
        </div>
      </nav>

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 65, left: 0, right: 0, zIndex: 999,
          background: 'rgba(10,10,10,0.96)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          {(isLoggedIn ? loggedInMenuLinks : publicLinks).map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '16px 24px', borderBottom: '1px solid var(--surface)',
                fontFamily: 'var(--font-label)',
                fontSize: 16, fontWeight: 600, letterSpacing: '0.08em',
                color: pathname === link.href ? 'var(--red)' : 'var(--grey-light)',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div style={{ height: 65 }} />
    </>
  )
}
