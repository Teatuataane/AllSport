'use client'

// ─── Bottom tab bar ──────────────────────────────────────────────────────────
// Five destinations, thumb-reachable, on every logged-in page. Replaces the
// hamburger, which held every link in the app behind one tap nobody made.
//
// PLAY is the only context-aware tab:
//
//   kaiwhakawā + live session → /scoring/{id}        label JUDGE, red
//   kaiwhakawā, nothing live  → /judge               label JUDGE, red
//   player + live session     → /scoring/{id}        green, pulse dot
//   player, nothing live      → /dashboard#join      grey
//
// Phones only. Above 768px `.bottom-nav` is display:none and the same five
// destinations render as text links in the top bar — see globals.css.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useNavState } from '@/lib/useNavState'

// Dynamic, not module scope. This bar renders on every route from the root
// layout, so a static import put the Supabase client and its realtime stack
// into every page's bundle (see lib/authCookie.ts) — for a single signOut call
// that only a signed-in player can ever reach.
const supabaseModule = () => import('@/lib/supabase-browser')

const BAR_HEIGHT = 64

type TabKey = 'play' | 'stats' | 'board' | 'events' | 'more'

const RESTING = '#5c5c5c'
const ACTIVE = '#ffffff'

function Icon({ tab, colour }: { tab: TabKey; colour: string }) {
  const common = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: colour, strokeWidth: 1.8, 'aria-hidden': true,
  } as const
  switch (tab) {
    case 'play':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" />
        </svg>
      )
    case 'stats':
      return (
        <svg {...common} strokeLinecap="round">
          <path d="M5 19V11" /><path d="M12 19V5" /><path d="M19 19v-5" />
        </svg>
      )
    case 'board':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4h10v6a5 5 0 01-10 0z" /><path d="M7 6H4v1a3 3 0 003 3" />
          <path d="M17 6h3v1a3 3 0 01-3 3" /><path d="M9 20h6" /><path d="M12 15v5" />
        </svg>
      )
    case 'events':
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" />
        </svg>
      )
    case 'more':
      return (
        <svg {...common} strokeLinecap="round">
          <circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" />
        </svg>
      )
  }
}

function Tab({ tab, label, colour, active, live, onClick, href }: {
  tab: TabKey
  label: string
  colour: string
  active: boolean
  live?: boolean
  onClick?: () => void
  href?: string
}) {
  const inner = (
    <>
      <Icon tab={tab} colour={colour} />
      <span style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600, fontSize: 10, color: colour, lineHeight: 1,
      }}>
        {label}
      </span>
      {live && (
        <span aria-hidden style={{
          position: 'absolute', top: -1, right: '50%', marginRight: -16,
          width: 7, height: 7, borderRadius: 999,
          background: colour, boxShadow: `0 0 0 3px ${colour}33`,
        }} />
      )}
    </>
  )
  const style: React.CSSProperties = {
    position: 'relative',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'flex-start', gap: 4,
    // The icon-plus-label stack is only ~38px tall, which is under the 44px
    // floor. The bar has the room, so the target fills it rather than floating
    // in the middle of it — the padding is the hit area, not decoration.
    minHeight: 44, paddingTop: 2, paddingBottom: 4, paddingLeft: 4, paddingRight: 4,
    background: 'transparent', border: 'none',
    cursor: 'pointer', textDecoration: 'none',
    WebkitTapHighlightColor: 'transparent',
  }
  if (href) {
    return <Link href={href} style={style} aria-current={active ? 'page' : undefined}>{inner}</Link>
  }
  return <button onClick={onClick} style={style} aria-current={active ? 'page' : undefined}>{inner}</button>
}

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { userId, isJudge, liveSessionId, playHref, playLabel, playColour } = useNavState()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Logged out: the public nav still owns the page.
  if (!userId) return null

  const on = (p: string) => pathname === p || pathname.startsWith(`${p}/`)

  return (
    <>
      {/* Keeps the last card clear of the bar. Matches the bar's own height. */}
      <div className="bottom-nav-spacer" aria-hidden
           style={{ height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }} />

      <nav
        className="bottom-nav"
        aria-label="Main"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 950,
          height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingTop: 9,
          background: 'rgba(10,10,10,0.97)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -12px 28px rgba(0,0,0,0.65)',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          alignItems: 'start',
        }}
      >
        <Tab tab="play" label={playLabel} colour={playColour}
             active={on('/scoring') || (isJudge && on('/judge'))}
             live={!!liveSessionId} href={playHref} />
        <Tab tab="stats" label="Stats" colour={on('/dashboard') ? ACTIVE : RESTING}
             active={on('/dashboard')} href="/dashboard" />
        <Tab tab="board" label="Board" colour={on('/leaderboard') ? ACTIVE : RESTING}
             active={on('/leaderboard')} href="/leaderboard" />
        <Tab tab="events" label="Events" colour={on('/prs') ? ACTIVE : RESTING}
             active={on('/prs')} href="/prs" />
        <Tab tab="more" label="More" colour={moreOpen ? ACTIVE : RESTING}
             active={moreOpen} onClick={() => setMoreOpen(o => !o)} />
      </nav>

      {moreOpen && (
        <MoreSheet
          isJudge={isJudge}
          onClose={() => setMoreOpen(false)}
          onSignOut={async () => {
            setMoreOpen(false)
            const { createClient } = await supabaseModule()
            await createClient().auth.signOut()
            router.push('/')
          }}
        />
      )}
    </>
  )
}

// ── The MORE sheet ───────────────────────────────────────────────────────────
// Absorbs the whole logged-in hamburger. Personal Bests is deliberately absent:
// it is the EVENTS tab now, and listing it twice teaches people the tab is
// something else.

function SheetRow({ href, label, accent, children, onClick }: {
  href?: string
  label: string
  accent?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const colour = accent ?? 'var(--grey-light)'
  const body = (
    <>
      {children}
      <span style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 600, fontSize: 15,
        color: colour, flexGrow: 1,
      }}>
        {label}
      </span>
      {href && <span style={{ color: accent ?? '#555555' }}>›</span>}
    </>
  )
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 20px', minHeight: 48,
    // `border: none` must come BEFORE borderBottom — the shorthand resets the
    // longhand, so the other order silently removes every divider.
    border: 'none',
    borderBottom: '1px solid var(--border)',
    // A var() cannot take a hex alpha suffix: `var(--red)0d` is not a colour and
    // the row just renders transparent. rgba of the same red instead.
    background: accent ? 'rgba(234,71,66,0.05)' : 'transparent',
    width: '100%', textAlign: 'left', cursor: 'pointer',
    textDecoration: 'none',
  }
  if (href) return <Link href={href} style={style}>{body}</Link>
  return <button onClick={onClick} style={{ ...style, borderBottom: 'none' }}>{body}</button>
}

function MoreSheet({ isJudge, onClose, onSignOut }: {
  isJudge: boolean
  onClose: () => void
  onSignOut: () => void
}) {
  const stroke = (colour = '#888888') => ({
    width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none',
    stroke: colour, strokeWidth: 1.8, 'aria-hidden': true,
  }) as const

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 960,
          background: 'rgba(0,0,0,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-label="More"
        style={{
          position: 'fixed', left: 0, right: 0, zIndex: 970,
          bottom: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '18px 18px 0 0',
          overflow: 'hidden',
          boxShadow: '0 -24px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>

        {isJudge && (
          <SheetRow href="/judge" label="Kaiwhakawā panel" accent="var(--red)">
            <svg {...stroke('var(--red)')} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3" /><path d="M5 8h14l-2 11H7z" /><path d="M9 12h6" />
            </svg>
          </SheetRow>
        )}

        <SheetRow href="/taniwha" label="My taniwha">
          <svg {...stroke()} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l3-9 6 5 6-5 3 9z" />
          </svg>
        </SheetRow>

        <SheetRow href="/profile" label="Profile &amp; family">
          <svg {...stroke()} strokeLinecap="round">
            <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
          </svg>
        </SheetRow>

        <SheetRow href="/schedule" label="Schedule">
          <svg {...stroke()} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" />
            <path d="M8 3v4" /><path d="M16 3v4" />
          </svg>
        </SheetRow>

        <SheetRow href="/koha" label="Koha">
          <svg {...stroke()} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.4-7 10-7 10z" />
          </svg>
        </SheetRow>

        <SheetRow href="/how-to-play" label="How to play">
          <svg {...stroke()} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 115 .5c0 1.5-2.5 2-2.5 3.5" /><path d="M12 17h.01" />
          </svg>
        </SheetRow>

        <SheetRow href="/supporters" label="Supporters">
          <svg {...stroke()} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20V6a2 2 0 012-2h12a2 2 0 012 2v14" /><path d="M8 8h8" /><path d="M8 12h8" />
          </svg>
        </SheetRow>

        <SheetRow label="Sign out" onClick={onSignOut}>
          <svg {...stroke('#666666')} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17l5-5-5-5" /><path d="M20 12H9" />
            <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" />
          </svg>
        </SheetRow>
      </div>
    </>
  )
}
