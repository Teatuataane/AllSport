'use client'

// ─── HOME's small parts ──────────────────────────────────────────────────────
// Presentational pieces of app/dashboard/page.tsx, split out because that page
// calls Supabase at module scope and is behind a login, so nothing in it can be
// rendered in a test. These take only props, which is what lets
// __tests__/homeParts.test.tsx pin them.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { gradeForRung, gradeAccent } from '@/lib/grading'
import { RAINBOW_CONIC } from '@/lib/domainColours'
import type { nextScheduledSession } from '@/lib/schedule'

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase',
      letterSpacing: '0.14em', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)',
    }}>
      {children}
    </span>
  )
}

/**
 * The avatar, ringed in the player's overall colour so it doubles as their
 * badge. Uenuku is a rainbow ring, Taniwha black with a white ring, Mā (and
 * still loading) a plain grey ring.
 */
export function ColourAvatar({ rung, icon, initial }: { rung: number | null; icon: string | null; initial: string }) {
  const g = gradeForRung(rung ?? 0)
  const ring = rung == null || g.rung === 0 ? '#555555' : gradeAccent(g)
  const fill = g.inverted ? '#000' : `${ring}1a`
  return (
    <div
      role="img"
      data-ring={g.rainbow ? 'rainbow' : g.inverted ? 'inverted' : 'solid'}
      aria-label={rung == null ? 'Your avatar' : `Your avatar, overall colour ${g.name}`}
      style={{
        width: 58, height: 58, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '3px solid transparent',
        // A CSS border cannot take a gradient, so Uenuku paints its ring as a
        // border-box background under a padding-box fill.
        background: g.rainbow
          ? `linear-gradient(#17121c, #17121c) padding-box, ${RAINBOW_CONIC} border-box`
          // The tint is translucent, so an opaque base sits under it inside the
          // padding box; without it the solid ring layer shows through the
          // whole avatar and hides the initial.
          : `linear-gradient(${fill}, ${fill}) padding-box, linear-gradient(var(--dark), var(--dark)) padding-box, linear-gradient(${ring}, ${ring}) border-box`,
        boxShadow: `0 0 0 4px ${ring}1c`,
        fontSize: icon ? 26 : 28,
        fontFamily: icon ? undefined : 'var(--font-display)',
        color: g.rung === 0 ? 'var(--white)' : ring,
      }}
    >
      {icon || initial}
    </div>
  )
}

/**
 * A game running right now: one JOIN button straight into it, at the very top.
 * Nobody types a join code any more (home colours rework, 24 September 2026);
 * the QR link's ?code= still joins silently.
 */
export function GameOnCard({ game, isJudge, error }: {
  game: { id: string; location: string | null }
  isJudge: boolean
  error: string
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#061a0d,#0d2e1a)',
      border: '1px solid #4DB26E55', borderRadius: 16, padding: 18, marginBottom: 18,
      boxShadow: '0 8px 30px rgba(77,178,110,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999, background: 'var(--green)',
          boxShadow: '0 0 0 4px #4DB26E2e', flexShrink: 0,
        }} />
        <SectionLabel>Game on now</SectionLabel>
      </div>
      <div style={{ fontSize: 13, color: '#9fc4ab', marginTop: 6 }}>
        {game.location ?? 'AllSport HQ'}
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}
      <Link href={`/scoring/${game.id}`} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50,
        marginTop: 14, borderRadius: 999, background: 'var(--green)', color: '#0a0a0a',
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 700, fontSize: 16,
      }}>
        {isJudge ? 'Open the game →' : 'Join →'}
      </Link>
    </div>
  )
}

/** No game running: when the next one is, in one slim line. Nothing to tap. */
export function NextSessionLine({ nextSession, firstRun, error }: {
  nextSession: ReturnType<typeof nextScheduledSession>
  firstRun: boolean
  error: string
}) {
  return (
    <div style={{ margin: '16px 0 18px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        border: `1px solid ${firstRun ? '#2371BB55' : 'var(--border)'}`, borderRadius: 999,
        fontSize: 13, color: 'var(--grey-light)',
      }}>
        <span aria-hidden style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: firstRun ? 'var(--blue)' : '#555',
        }} />
        <span style={{ minWidth: 0 }}>
          {firstRun ? 'Your first game' : 'Next game'}{' '}
          <b style={{ color: 'var(--white)', fontWeight: 600 }}>{nextSession.label}</b>
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {nextSession.relative}
        </span>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

/** The three ways off HOME, all in one style. */
export function HomeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      minHeight: 46, padding: '6px 8px', borderRadius: 999,
      border: '1px solid var(--border-strong)', color: 'var(--white)',
      fontFamily: 'var(--font-label)', textTransform: 'uppercase',
      letterSpacing: '0.1em', fontWeight: 600, fontSize: 12, lineHeight: 1.15,
    }}>
      {children}
    </Link>
  )
}
