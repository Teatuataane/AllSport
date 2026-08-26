'use client'

// ─── Top bar ─────────────────────────────────────────────────────────────────
// Two quite different bars behind one component.
//
// LOGGED OUT — unchanged: brand, the five public links on desktop, PLAY NOW, and
// a hamburger on phones.
//
// LOGGED IN — slimmed from 60px to 48px and stripped to the logo. The DASHBOARD
// pill, SIGN OUT and the entire hamburger are gone: every link they held is now
// either a bottom-bar tab or a row in the MORE sheet. On desktop (≥769px) the
// bottom bar is hidden by CSS, so the same five destinations render here as text
// links instead — `useNavState` is shared with BottomNav so PLAY cannot point
// two different ways on two different widths.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useNavState } from '@/lib/useNavState'

export const TOP_BAR_HEIGHT = 48
export const RAINBOW_HEIGHT = 5

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const supabase = createClient()
  const { isJudge, playHref, playLabel, playColour } = useNavState()

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

  const publicLinks = [
    { href: '/', label: 'HOME' },
    { href: '/how-to-play', label: 'HOW TO PLAY' },
    { href: '/schedule', label: 'SCHEDULE' },
    { href: '/leaderboard', label: 'LEADERBOARD' },
    { href: '/koha', label: 'KOHA' },
  ]

  const isLoggedIn = !authLoading && !!user

  const hamburgerBar = (transform: string, opacity = 1): React.CSSProperties => ({
    display: 'block', width: 22, height: 2,
    background: menuOpen && transform !== 'mid' ? 'var(--red)' : 'var(--white)',
    transition: 'all 0.2s',
    transform: menuOpen ? transform : 'none',
    opacity,
  })

  const brand = (
    <Link href={isLoggedIn ? '/dashboard' : '/'} style={{
      display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0,
    }}>
      <img src="/logo-mark.webp" alt="AllSport" width={50} height={30}
           style={{ height: 30, width: 'auto' }} />
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 20,
        color: 'var(--white)', letterSpacing: '0.09em', lineHeight: 1,
      }}>
        ALL<span style={{ color: 'var(--red)' }}>SPORT</span>
      </span>
    </Link>
  )

  // Mirrors the bottom bar, one for one. Only rendered ≥769px.
  const desktopTabs = [
    { href: playHref, label: playLabel.toUpperCase(), colour: playColour, match: '/scoring' },
    { href: '/dashboard', label: 'STATS', match: '/dashboard' },
    { href: '/leaderboard', label: 'BOARD', match: '/leaderboard' },
    { href: '/prs', label: 'EVENTS', match: '/prs' },
    { href: '/taniwha', label: 'TANIWHA', match: '/taniwha' },
  ]

  return (
    <>
      <div style={{
        height: RAINBOW_HEIGHT,
        background: 'var(--rainbow)',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1001,
      }} />

      <nav style={{
        position: 'fixed', top: RAINBOW_HEIGHT, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(10,10,10,0.86)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
        height: isLoggedIn ? TOP_BAR_HEIGHT : 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24,
      }}>
        {brand}

        {!authLoading && (isLoggedIn ? (
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            {desktopTabs.map(t => {
              const on = pathname === t.match || pathname.startsWith(`${t.match}/`)
              return (
                <Link key={t.label} href={t.href} style={{
                  fontFamily: 'var(--font-label)', fontSize: 13,
                  letterSpacing: '0.1em', fontWeight: 600,
                  color: t.colour ?? (on ? 'var(--white)' : 'var(--grey)'),
                  borderBottom: on ? '2px solid var(--blue)' : '2px solid transparent',
                  paddingBottom: 3, lineHeight: 1,
                  transition: 'color 200ms',
                }}>
                  {t.label}
                </Link>
              )
            })}
            {isJudge && (
              <Link href="/judge" style={{
                fontFamily: 'var(--font-label)', fontSize: 13,
                letterSpacing: '0.1em', fontWeight: 600, color: 'var(--red)',
                lineHeight: 1,
              }}>
                KAIWHAKAWĀ
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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

            <button
              className="hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
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
          </div>
        ))}
      </nav>

      {/* Logged-out phones only. The logged-in menu is the bottom bar's MORE sheet. */}
      {menuOpen && !isLoggedIn && (
        <div style={{
          position: 'fixed', top: 65, left: 0, right: 0, zIndex: 999,
          background: 'rgba(10,10,10,0.96)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          {publicLinks.map(link => (
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

      {/* Spacer. Logged in this is 53px, against the old 65 — and nothing is
          buried behind a hamburger any more. */}
      <div style={{ height: (isLoggedIn ? TOP_BAR_HEIGHT : 60) + RAINBOW_HEIGHT }} />
    </>
  )
}
