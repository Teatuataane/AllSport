'use client'

// A player's records on one event, in the sheet and on My Events. Tiered events
// list a best per level played; the rest list the top five. Pure display over
// lib/prBoard.ts: nothing here decides what a record is.

import { buildPRBoard, type PRRow } from '@/lib/prBoard'
import type { EventData } from '@/lib/eventData'
import { formatNZDate } from '@/lib/dates'

const ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
  borderRadius: '10px', border: '1px solid #1e1e1e', background: '#101010', width: '100%',
  textAlign: 'left',
}
const MUTED: React.CSSProperties = { fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', letterSpacing: '0.06em' }
const CHIP: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em',
  color: '#bbb', border: '1px solid #555', borderRadius: '4px', padding: '1px 5px', whiteSpace: 'nowrap',
}

function Source({ row }: { row: PRRow }) {
  if (row.source === 'game') return null
  return <span style={CHIP}>{row.source === 'witnessed' ? 'WITNESSED' : 'LOGGED'}</span>
}

export default function PRBoardView({
  ev, rows, currentLevel = null, showAllLevels = false, onPick, colour = '#F9B051',
}: {
  ev: EventData | undefined
  rows: readonly PRRow[]
  /** The level the player is about to score: shown even if they have no record there yet. */
  currentLevel?: number | null
  /** List every level of the ladder, played or not, each with its name.
      My Events sets it; the entry sheet does not, because a twelve-row ladder
      pushes the score boxes off a phone. */
  showAllLevels?: boolean
  /** Tapping a record pre-fills it. Omit for a read-only list. */
  onPick?: (row: PRRow) => void
  colour?: string
}) {
  const board = buildPRBoard(ev, rows)
  if (board.kind === 'none') return null

  const line = (row: PRRow | null, left: string, key: string, active = false, name?: string) => {
    const Tag = onPick && row ? 'button' : 'div'
    return (
      <Tag
        key={key}
        {...(onPick && row ? { type: 'button' as const, onClick: () => onPick(row) } : {})}
        style={{
          ...ROW, cursor: onPick && row ? 'pointer' : 'default',
          borderColor: active ? colour + '66' : '#1e1e1e',
          background: active ? colour + '11' : '#101010',
        }}
      >
        <span style={{ ...MUTED, color: active ? colour : '#999', minWidth: '28px' }}>{left}</span>
        {name && <span style={{ ...MUTED, color: active ? colour : '#999', whiteSpace: 'nowrap' }}>{name}</span>}
        {row ? (
          <>
            <span style={{ flex: 1, fontSize: '14px', color: '#fff', fontFamily: 'var(--font-body)' }}>{row.score_label}</span>
            <Source row={row} />
            <span style={MUTED}>{formatNZDate(row.date)}</span>
          </>
        ) : (
          <span style={{ flex: 1, fontSize: '13px', color: '#444', textAlign: name ? 'right' : 'left' }}>No record yet</span>
        )}
      </Tag>
    )
  }

  if (board.kind === 'levels') {
    const shown = showAllLevels ? board.levels : board.levels.filter(l => l.best || l.index === currentLevel)
    if (shown.length === 0) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {shown.map(l => line(l.best, `D${l.index + 1}`, `l${l.index}`, l.index === currentLevel, showAllLevels ? l.name : undefined))}
      </div>
    )
  }
  if (board.top.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {board.top.map((r, i) => line(r, `#${i + 1}`, r.id, i === 0))}
    </div>
  )
}
