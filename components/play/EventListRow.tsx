// ─── Event list row ──────────────────────────────────────────────────────────
// One planned event on a play screen: still to play, or scored. The RIGHT-HAND
// label differs between a game (your rank in your division) and a personal
// game (nothing to rank against), so the screen passes it in.
//
// On the live game the row is COLOURED BY GRADE (`gradeRung`): a scored button
// takes the colour its score reaches on the standards, and everything else on
// the row stays neutral so that colour is the only one that means anything.
// Without `gradeRung` the row keeps its original domain-coloured look, which
// the personal-game screen still uses.

'use client'

import type React from 'react'
import type { ReactNode } from 'react'
import EventIcon from '@/components/EventIcon'
import { NEUTRAL_ICON_TINT, rungPaint } from '@/lib/scoreColour'
import { RAINBOW } from '@/lib/domainColours'
import type { EventData } from '@/lib/eventData'
import { sportWDL, type PlayEvent, type EntryRow } from './chrome'

export default function EventListRow({
  se, eventData, myResults, note, onOpen, gradeRung, gameLine, tag, corner, quiet = false,
}: {
  se: PlayEvent
  eventData: EventData | undefined
  myResults: EntryRow[]
  /** The small line under the score. A game passes the division rank. */
  note?: { label: string; color: string }
  onOpen: () => void
  /** The colour today's score reaches (0 = none). Present only on the live game. */
  gradeRung?: number
  /** A win/draw/loss event's rating line: "7 games to a rating" or "Rating 1,148".
      It replaces the division rank on a scored button, and rides the domain
      line on one still to score. */
  gameLine?: string
  /** A small label under the name, such as "Added". */
  tag?: string
  /** A control pinned to the top-right corner (the + or the ✕). A sibling of
      the row, never inside it: a button inside a button is invalid HTML. */
  corner?: ReactNode
  /** An unscored row that is not the next one to play: a small ring instead of
      the "Tap to score" pill, so the list has one call to action (v0.50.0.0).
      Opt-in, so a row rendered alone keeps the pill. */
  quiet?: boolean
}) {
  const mode = (eventData?.inputMode || se.input_mode || 'strength') as string
  const myBestResult = myResults.length > 0
    ? myResults.reduce((best, r) => r.raw_score > best.raw_score ? r : best, myResults[0])
    : undefined
  const todo = !myBestResult
  const graded = gradeRung !== undefined
  const paint = graded && !todo ? rungPaint(gradeRung) : null

  const background = paint ? paint.background
    : graded ? 'var(--surface)'
    : todo ? 'linear-gradient(180deg, rgba(35,113,187,0.10), var(--surface) 70%)' : 'var(--surface)'
  const border = paint ? paint.border
    : graded ? `1px solid ${todo ? 'var(--border-strong)' : 'var(--border)'}`
    : `1px solid ${todo ? 'var(--blue-edge)' : 'var(--border)'}`
  const scoreInk = paint ? paint.ink : graded ? 'var(--white)' : 'var(--green)'

  return (
    <div style={{ position: 'relative', marginBottom: '8px' }}>
      <button className="press" onClick={onOpen} style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 14px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
        background, border, color: 'var(--white)', fontFamily: 'var(--font-body)',
      }}>
        <EventIcon slug={se.event_slug || eventData?.slug || ''} emoji={eventData?.emoji} domainNumber={se.domain_number}
          size={46} tint={graded ? NEUTRAL_ICON_TINT : undefined} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', letterSpacing: '0.03em', lineHeight: 1 }}>{se.event_name}</div>
          {/* The domain rides inside the button, in the same grey as the rest of
              the secondary text, so every button is the same height and the
              colour a score reaches stays the only colour on it. */}
          <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {se.domain_number} · {se.domain_name}
            {todo && gameLine && <span>· {gameLine}</span>}
            {tag && (
              <span style={{ fontSize: '12px', color: 'var(--grey-light)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', padding: '0 7px' }}>{tag}</span>
            )}
          </div>
        </div>
        {todo && quiet ? (
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', marginRight: corner ? '8px' : 0 }}>
            <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border-strong)', boxSizing: 'border-box' }} />
            <span style={SR_ONLY}>Not scored</span>
          </span>
        ) : todo ? (
          <span style={{
            fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em',
            fontSize: '12px', color: 'var(--white)', background: 'var(--blue)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', flexShrink: 0, fontWeight: 500,
          }}>Tap to score</span>
        ) : (
          <div style={{ textAlign: 'right', flexShrink: 1, maxWidth: '58%', marginRight: corner ? '8px' : 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: scoreInk }}>
              {mode === 'sport' ? sportWDL(myResults) : myBestResult!.score_label}
            </div>
            {(paint || note || gameLine) && (
              <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
                {paint && (
                  <span style={paint.rainbow
                    ? { background: RAINBOW, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                    : { color: paint.ink }}>{paint.name}</span>
                )}
                {paint && (gameLine || note) && <span style={{ color: 'var(--grey-light)' }}> · </span>}
                {gameLine
                  ? <span style={{ color: 'var(--grey-light)' }}>{gameLine}</span>
                  : note && <span style={{ color: paint ? 'var(--grey-light)' : note.color }}>{note.label}</span>}
              </div>
            )}
          </div>
        )}
      </button>
      {corner}
    </div>
  )
}

// Read by a screen reader, drawn as nothing.
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
}

/**
 * The round control on a row's top-right corner. 26px to the eye, 44px to the
 * thumb: the hit area overhangs the corner by the difference.
 */
export function RowCorner({ label, onClick, variant }: { label: string; onClick: () => void; variant: 'add' | 'remove' }) {
  const add = variant === 'add'
  return (
    <button className="press" onClick={onClick} aria-label={label} title={label} style={{
      position: 'absolute', top: -18, right: -14, width: 44, height: 44, padding: 0,
      background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span aria-hidden="true" style={{
        width: 26, height: 26, borderRadius: '50%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: add ? 'var(--blue)' : 'var(--surface-2)', border: `1px solid ${add ? 'var(--blue)' : 'var(--border-strong)'}`,
        color: add ? 'var(--white)' : 'var(--grey-light)', fontSize: add ? 18 : 12, lineHeight: 1, fontFamily: 'var(--font-body)',
      }}>{add ? '+' : '✕'}</span>
    </button>
  )
}
