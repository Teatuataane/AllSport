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

import type { ReactNode } from 'react'
import EventIcon from '@/components/EventIcon'
import { rungPaint } from '@/lib/scoreColour'
import { RAINBOW } from '@/lib/domainColours'
import type { EventData } from '@/lib/eventData'
import { sportWDL, type PlayEvent, type EntryRow } from './chrome'

export default function EventListRow({
  se, eventData, myResults, note, onOpen, gradeRung, showDomain = true, tag, corner,
}: {
  se: PlayEvent
  eventData: EventData | undefined
  myResults: EntryRow[]
  /** The small line under the score. A game passes the division rank. */
  note?: { label: string; color: string }
  onOpen: () => void
  /** The colour today's score reaches (0 = none). Present only on the live game. */
  gradeRung?: number
  /** False where a domain title above the row already names it. */
  showDomain?: boolean
  /** A small label under the name, such as "Added". */
  tag?: string
  /** A control pinned to the top-right corner (the + or the ✕). A sibling of
      the row, never inside it: a button inside a button is invalid HTML. */
  corner?: ReactNode
}) {
  const mode = (eventData?.inputMode || se.input_mode || 'strength') as string
  const myBestResult = myResults.length > 0
    ? myResults.reduce((best, r) => r.raw_score > best.raw_score ? r : best, myResults[0])
    : undefined
  const todo = !myBestResult
  const graded = gradeRung !== undefined
  const paint = graded && !todo ? rungPaint(gradeRung) : null

  const background = paint ? paint.background
    : graded ? '#111'
    : todo ? 'linear-gradient(180deg, rgba(35,113,187,0.10), #111 70%)' : '#111'
  const border = paint ? paint.border
    : graded ? `1px solid ${todo ? '#262626' : '#1e1e1e'}`
    : `1px solid ${todo ? '#1c3a5e' : '#1e1e1e'}`
  const scoreInk = paint ? paint.ink : graded ? '#fff' : '#4DB26E'

  return (
    <div style={{ position: 'relative', marginBottom: '8px' }}>
      <button onClick={onOpen} style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 14px', borderRadius: '16px', cursor: 'pointer',
        background, border, color: '#fff', fontFamily: 'var(--font-body)',
      }}>
        <EventIcon slug={se.event_slug || eventData?.slug || ''} emoji={eventData?.emoji} domainNumber={se.domain_number}
          size={46} tint={graded ? '#bbbbbb' : undefined} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', letterSpacing: '0.03em', lineHeight: 1 }}>{se.event_name}</div>
          {(showDomain || tag) && (
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {showDomain && se.domain_name}
              {tag && (
                <span style={{ fontSize: '10.5px', color: '#aaa', border: '1px solid #444', borderRadius: '999px', padding: '0 7px' }}>{tag}</span>
              )}
            </div>
          )}
        </div>
        {todo ? (
          <span style={{
            fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em',
            fontSize: '12px', color: '#fff', background: '#2371BB', borderRadius: '999px', padding: '6px 12px', flexShrink: 0, fontWeight: 500,
          }}>Tap to score</span>
        ) : (
          <div style={{ textAlign: 'right', flexShrink: 0, marginRight: corner ? '8px' : 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: scoreInk }}>
              {mode === 'sport' ? sportWDL(myResults) : myBestResult!.score_label}
            </div>
            {(paint || note) && (
              <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
                {paint && (
                  <span style={paint.rainbow
                    ? { background: RAINBOW, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                    : { color: paint.ink }}>{paint.name}</span>
                )}
                {paint && note && <span style={{ color: '#aaa' }}> · </span>}
                {note && <span style={{ color: paint ? '#aaa' : note.color }}>{note.label}</span>}
              </div>
            )}
          </div>
        )}
      </button>
      {corner}
    </div>
  )
}

/**
 * The round control on a row's top-right corner. 26px to the eye, 44px to the
 * thumb: the hit area overhangs the corner by the difference.
 */
export function RowCorner({ label, onClick, variant }: { label: string; onClick: () => void; variant: 'add' | 'remove' }) {
  const add = variant === 'add'
  return (
    <button onClick={onClick} aria-label={label} title={label} style={{
      position: 'absolute', top: -18, right: -14, width: 44, height: 44, padding: 0,
      background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span aria-hidden="true" style={{
        width: 26, height: 26, borderRadius: '50%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: add ? '#2371BB' : '#181818', border: `1px solid ${add ? '#2371BB' : '#3a3a3a'}`,
        color: add ? '#fff' : '#aaa', fontSize: add ? 18 : 12, lineHeight: 1, fontFamily: 'var(--font-body)',
      }}>{add ? '+' : '✕'}</span>
    </button>
  )
}
