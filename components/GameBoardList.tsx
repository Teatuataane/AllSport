'use client'
// ─── Everyone in one game, by colour score ───────────────────────────────────
// One list for the whole game, ranked on colour total, because the colour score
// is what makes a woman of 65, a boy of 10 and a man of 25 comparable (Tāne,
// 3 Nov 2026). Nobody else's score is shown, only the order (2026-09-29).
//
// Props only, so it is tested without Supabase. lib/gameReport.ts boardOrder
// builds the entries.

import { useState } from 'react'

export type GameBoardLine = { eventName: string; scoreLabel: string | null }
export type GameBoardEntry = {
  key: string
  name: string
  /** Null for a guest, who holds no place, or a player whose total is not in yet. */
  place: number | null
  isMe?: boolean
  /** Shown when the row is opened. Omit for a row that does not open. */
  events?: readonly GameBoardLine[]
}

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
const medal = (place: number | null) =>
  place === 1 ? '#F9B051' : place === 2 ? '#C0C0C0' : place === 3 ? '#CD7F32' : '#555'

export function GameBoardList({ entries }: { entries: readonly GameBoardEntry[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div data-testid="game-board">
      {entries.map(e => {
        const isOpen = open === e.key
        return (
          <div key={e.key} data-testid="game-board-row" style={{
            background: e.isMe ? '#0d1020' : '#111', border: `1px solid ${e.isMe ? '#2371BB55' : '#1e1e1e'}`,
            borderRadius: 12, marginBottom: 8, overflow: 'hidden',
          }}>
            <button disabled={!e.events} onClick={() => setOpen(isOpen ? null : e.key)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: 'none', border: 'none', cursor: e.events ? 'pointer' : 'default', textAlign: 'left',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: medal(e.place), minWidth: 40 }}>
                {e.place != null ? ord(e.place) : '—'}
              </div>
              <div style={{ flex: 1, minWidth: 0, color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, overflowWrap: 'anywhere' }}>
                {e.name}
              </div>
              {e.events && <div style={{ color: '#555', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</div>}
            </button>
            {isOpen && e.events && (
              <div style={{ borderTop: '1px solid #1e1e1e', padding: '4px 16px 12px' }}>
                {e.events.map(line => (
                  <div key={line.eventName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #161616' }}>
                    <div style={{ flex: 1, minWidth: 0, color: line.scoreLabel != null ? '#ddd' : '#555', fontFamily: 'var(--font-body)', fontSize: 14 }}>
                      {line.eventName}
                    </div>
                    <div style={{ color: line.scoreLabel != null ? '#aaa' : '#444', fontFamily: 'var(--font-body)', fontSize: 13, textAlign: 'right' }}>
                      {line.scoreLabel ?? 'No score'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
