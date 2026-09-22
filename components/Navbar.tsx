'use client'

// ─── Top bar ─────────────────────────────────────────────────────────────────
// Two quite different bars behind one component.
//
// LOGGED OUT — unchanged: brand, the five public links on desktop, PLAY NOW, and
// a hamburger on phones.
//
// LOGGED IN — slimmed from 60px to 48px and stripped to the logo. On phones the
// bottom bar carries every destination. On desktop (≥769px) the bottom bar is
// hidden by CSS, so the same tabs render here as text links AND the same MORE
// menu opens from here (`MoreMenu` from BottomNav). Until September 2026 the
// desktop bar had the tabs but no MORE, so a signed-in player on a laptop could
// not sign out or reach their profile. `useNavState` is shared with BottomNav
// so PLAY cannot point two different ways on two different widths.
//
// The one place the two bars deliberately differ: a kaiwhakawā gets no PLAY tab
// here, because this bar also has room for a KAIWHAKAWĀ link and the two were
// the same destination. That link carries `playHref`, so nothing is lost. The
// bottom bar has no such link (the panel is a MORE row), so its PLAY tab stays.

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { hasAuthCookie } from '@/lib/authCookie'
import { useNavState } from '@/lib/useNavState'
import { MoreMenu } from '@/components/BottomNav'

// Dynamic, not module scope: the navbar is in the root layout, so a static
// import shipped the Supabase client and its realtime stack on every route —
// including the marketing homepage, purely to decide whether this bar says
// "Sign in". See lib/authCookie.ts for the measurement.
const supabaseModule = () => import('@/lib/supabase-browser')

// The cookie cannot change without a navigation (sign-in and sign-out both
// route), and this component re-renders on `pathname` anyway — so there is
// nothing to subscribe to. Required by useSyncExternalStore all the same.
const subscribeNothing = () => () => {}

export const TOP_BAR_HEIGHT = 48
export const RAINBOW_HEIGHT = 5

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()
  const { isJudge, playHref, playLabel, playColour } = useNavState()

  // "No auth cookie" is knowable on the client with certainty and with no
  // network and no Supabase bundle — but NOT during prerender, where there is no
  // document. useSyncExternalStore is the sanctioned way to read a client-only
  // value on a prerendered component: it hands back the server snapshot while
  // hydrating and the real one immediately after, with no setState in an effect
  // and no hydration mismatch. A lazy useState initialiser would give one.
  //
  // The server snapshot is `false` — "not known to be signed out" — so the bar
  // prerenders in its neutral state exactly as it does today.
  const knownSignedOut = useSyncExternalStore(
    subscribeNothing,
    () => !hasAuthCookie(),
    () => false,
  )

  // Still waiting only if we have not ruled a session out AND have not confirmed
  // one. Derived, so nothing has to be set to `false` from inside an effect.
  const authLoading = !knownSignedOut && !authResolved

  // Loaded at most once per mount, then kept for the life of it.
  const auth = useRef<{ started: boolean; unsub?: () => void }>({ started: false })

  // Keyed on `pathname`, not `[]`, and that is load-bearing. Signing in from
  // /login calls router.push('/dashboard') — a CLIENT-side navigation — so this
  // component never remounts. Without the re-check, a visitor who arrived with
  // no cookie (the only people who ever see /login) would keep the logged-out
  // bar until a hard reload. The ref makes it idempotent, so navigating around
  // afterwards neither re-imports nor re-subscribes.
  useEffect(() => {
    if (auth.current.started) return
    // Nobody is signed in: don't spend 59 KB gzipped being told so. Checked
    // again on the next navigation, which is when it can have changed.
    if (!hasAuthCookie()) return
    auth.current.started = true

    void (async () => {
      try {
        const { createClient } = await supabaseModule()
        const supabase = createClient()

        const { data } = await supabase.auth.getSession()
        setUser(data.session?.user ?? null)
        setAuthResolved(true)

        // Keeps the bar honest for sign-in and sign-out that happen under a
        // client-side navigation, which is every one of them in this app.
        const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
          setUser(session?.user ?? null)
          setAuthResolved(true)
        })
        auth.current.unsub = () => listener.subscription.unsubscribe()
      } catch {
        // The code-split chunk failed to load, or the session read threw. This
        // is a NEW failure mode: the import used to be static and could not
        // fail. Without this catch, `authResolved` stays false while
        // `knownSignedOut` is false, so `authLoading` is pinned true and the
        // auth slot renders NOTHING — a signed-in player gets a bar with no
        // Dashboard and no Sign out, permanently, until a hard reload. On flaky
        // mobile, which is exactly what this pass is about.
        //
        // Resolve so the bar renders its logged-out state (wrong for a
        // signed-in player, but visible and actionable), and clear `started` so
        // the next navigation retries the import rather than giving up for the
        // life of the mount.
        auth.current.started = false
        setAuthResolved(true)
      }
    })()
  }, [pathname])

  // Unmount only — the subscription above must survive navigation.
  useEffect(() => () => { auth.current.unsub?.() }, [])

  useEffect(() => { setMenuOpen(false); setMoreOpen(false) }, [pathname])

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

  // The bottom bar's tabs, in the same order. Only rendered ≥769px.
  //
  // A kaiwhakawā does NOT get the PLAY tab here. For them it is labelled JUDGE
  // and points at /judge whenever nothing is live, which is the same place the
  // KAIWHAKAWĀ link below goes — so the bar carried the same destination twice,
  // under two names for the same word. The KAIWHAKAWĀ link takes over its
  // `playHref` instead, so the live-session route is not lost with it.
  const desktopTabs = [
    ...(isJudge ? [] : [{ href: playHref, label: playLabel.toUpperCase(), colour: playColour, match: '/scoring' }]),
    { href: '/dashboard', label: 'HOME', match: '/dashboard' },
    { href: '/grades', label: 'COLOURS', match: '/grades' },
    { href: '/leaderboard', label: 'BOARD', match: '/leaderboard' },
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
              // playHref, not '/judge': the live game while one is running, the
              // panel otherwise — exactly what the PLAY tab did for a judge
              // before it was folded into this one link.
              <Link href={playHref} style={{
                fontFamily: 'var(--font-label)', fontSize: 13,
                letterSpacing: '0.1em', fontWeight: 600, color: 'var(--red)',
                borderBottom: pathname.startsWith('/judge') || pathname.startsWith('/scoring')
                  ? '2px solid var(--red)' : '2px solid transparent',
                paddingBottom: 3, lineHeight: 1,
              }}>
                KAIWHAKAWĀ
              </Link>
            )}
            <button
              onClick={() => setMoreOpen(o => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              style={{
                fontFamily: 'var(--font-label)', fontSize: 13,
                letterSpacing: '0.1em', fontWeight: 600, lineHeight: 1,
                color: moreOpen ? 'var(--white)' : 'var(--grey)',
                background: 'transparent', border: '1px solid var(--border-strong)',
                borderRadius: 999, padding: '7px 14px', cursor: 'pointer',
              }}
            >
              MORE
            </button>
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

      {isLoggedIn && moreOpen && (
        <div className="desktop-nav">
          <MoreMenu isJudge={isJudge} placement="top" onClose={() => setMoreOpen(false)} />
        </div>
      )}

      {/* Spacer. Logged in this is 53px, against the old 65 — and nothing is
          buried behind a hamburger any more. */}
      <div style={{ height: (isLoggedIn ? TOP_BAR_HEIGHT : 60) + RAINBOW_HEIGHT }} />
    </>
  )
}
