'use client'

// ─── A player's own game report, in parts ────────────────────────────────────
// Shared by the session-end screen, /games/[sessionId] and /history, so the
// three show one game the same way. Props only (the pages call Supabase at
// module scope and sit behind a login), which is what lets
// __tests__/gameReportParts.test.tsx render them. The numbers come from
// lib/gameReport.ts.

import type { ReactNode } from 'react'
import EventIcon from '@/components/EventIcon'
import { GradeDot } from '@/components/GradeDot'
import { gradeForRung, gradeInk, gradeAccent } from '@/lib/grading'
import { DOMAIN_ORDER, getEventByName } from '@/lib/eventData'
import { NEUTRAL_ICON_TINT } from '@/lib/scoreColour'
import { MAX_GAME_POINTS } from '@/lib/leaderboardScores'
import { gameColourRung, nextStepLine, type NextStep } from '@/lib/gameReport'

export function ReportLabel({ children, colour = '#777' }: { children: ReactNode; colour?: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 600, color: colour,
      textTransform: 'uppercase', letterSpacing: '0.14em', margin: '20px 0 8px',
    }}>
      {children}
    </div>
  )
}

/**
 * The game's colour score: out of 120, the colour it plays at, and how it
 * compares with the player's average. `average` null (a first game) says nothing.
 */
export function ColourScore({ points, average }: { points: number; average: number | null }) {
  const g = gradeForRung(gameColourRung(points))
  const delta = average == null ? null : Math.round(points - average)
  return (
    <div data-testid="colour-score" style={{
      display: 'flex', alignItems: 'center', gap: 14, background: '#161616',
      border: '1px solid #1e1e1e', borderRadius: 14, padding: '14px 16px',
    }}>
      <GradeDot grade={g} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          Colour score
        </div>
        <div style={{ fontSize: 14, color: gradeInk(g), marginTop: 2 }}>
          Played at {g.name}
        </div>
        {delta != null && (
          <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>
            {delta === 0 ? 'Level with your average' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} on your average`}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, lineHeight: 1, color: '#fff' }}>{points}</span>
        <span style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: '#666' }}> / {MAX_GAME_POINTS}</span>
      </div>
    </div>
  )
}

/** The one event closest to its next colour. */
export function NextTime({ step }: { step: NextStep }) {
  const g = gradeForRung(step.nextRung)
  return (
    <div data-testid="next-time" style={{
      display: 'flex', alignItems: 'center', gap: 10, background: '#161616',
      border: `1px solid ${gradeAccent(g)}33`, borderRadius: 12, padding: '10px 14px', marginTop: 8,
    }}>
      <span style={{
        fontFamily: 'var(--font-label)', fontSize: 10, fontWeight: 700, color: '#aaa',
        letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0,
      }}>Next time</span>
      <span style={{ flex: 1, fontSize: 14, color: '#fff' }}>{nextStepLine(step)}</span>
      <GradeDot grade={g} size={14} />
    </div>
  )
}

/** Domain colours earned in this game, one row each. */
export function EarnedColours({ colours }: { colours: { domainNumber: number; rung: number }[] }) {
  if (colours.length === 0) return null
  return (
    <>
      <ReportLabel colour="#4DB26E">{colours.length > 1 ? 'New colours' : 'New colour'}</ReportLabel>
      {colours.map(c => {
        const g = gradeForRung(c.rung)
        return (
          <div key={`${c.domainNumber}:${c.rung}`} style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#161616',
            border: '1px solid #4DB26E33', borderRadius: 12, padding: '10px 14px', marginBottom: 6,
          }}>
            <GradeDot grade={g} size={14} />
            <span style={{ flex: 1, fontSize: 14, color: '#fff' }}>{g.name}</span>
            <span style={{ fontSize: 13, color: '#888' }}>{DOMAIN_ORDER[c.domainNumber - 1]}</span>
          </div>
        )
      })}
    </>
  )
}

function Tag({ children, colour }: { children: ReactNode; colour: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: colour, background: `${colour}22`, borderRadius: 4,
      padding: '2px 6px', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', flexShrink: 0,
    }}>{children}</span>
  )
}

export type ReportEventLine = {
  eventName: string
  scoreLabel: string | null
  /** Division rank in the event, or null when there is none to show. */
  placement: number | null
  rung: number
  isPR?: boolean
  firstTime?: boolean
  colourUp?: boolean
}

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** One event of the player's game: icon, name, score, colour, placement and what was new. */
export function ReportEventRow({ line }: { line: ReportEventLine }) {
  const ev = getEventByName(line.eventName)
  const played = line.scoreLabel != null
  const g = gradeForRung(line.rung)
  return (
    <div data-testid="report-event" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1a1a1a',
      opacity: played ? 1 : 0.55,
    }}>
      {ev && <EventIcon slug={ev.slug} emoji={ev.emoji} domainNumber={ev.domainNumber} size={28} tint={NEUTRAL_ICON_TINT} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#eee' }}>{line.eventName}</span>
          {line.isPR && <Tag colour="#F9B051">PR</Tag>}
          {line.firstTime && <Tag colour="#5A9BE0">First time</Tag>}
          {line.colourUp && <Tag colour="#4DB26E">Colour up</Tag>}
        </div>
        <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>
          {played ? line.scoreLabel : 'Not played · ranked last'}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <GradeDot grade={g} size={12} />
          <span style={{ fontSize: 13, color: gradeInk(g) }}>{g.name}</span>
        </div>
        {line.placement != null && (
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: '#666', marginTop: 2 }}>{ord(line.placement)}</div>
        )}
      </div>
    </div>
  )
}

/**
 * Colour scores across recent games, oldest on the left, each dot in the
 * colour that game played at. Needs two games to draw a line.
 */
export function ScoreTrend({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const W = 300, H = 64, PAD = 6
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (points.length - 1)
  const y = (p: number) => H - PAD - (p / MAX_GAME_POINTS) * (H - 2 * PAD)
  const last = points[points.length - 1]
  return (
    <div data-testid="score-trend" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          Colour score · last {points.length} games
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff' }}>{last}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
        aria-label={`Colour scores for your last ${points.length} games: ${points.join(', ')}`}>
        <polyline fill="none" stroke="#3a3a3a" strokeWidth={1.5}
          points={points.map((p, i) => `${x(i)},${y(p)}`).join(' ')} />
        {points.map((p, i) => {
          const g = gradeForRung(gameColourRung(p))
          return <circle key={i} cx={x(i)} cy={y(p)} r={i === points.length - 1 ? 4.5 : 3.2}
            fill={g.rung === 0 ? '#555' : gradeAccent(g)} />
        })}
      </svg>
    </div>
  )
}
