'use client'

// ─── A Swiss contest, in the scoring sheet ──────────────────────────────────
// Scoring v2 step 5. Props only (the hooks are lib/useContest.ts), so
// __tests__/contestCard.test.tsx can render every state.
//
// ContestCard is the player's: Ready, then waiting, then "Find Aroha", then
// record the result below as before. ContestJudgeCard is the kaiwhakawā's:
// who waits, who is paired, pair any two by hand, matches per player, mixed.

import { useState } from 'react'
import type { ContestState, ContestBoard } from '@/lib/useContest'

const card = {
  background: '#141414', border: '1px solid #262626', borderRadius: 14, padding: '14px 16px', marginBottom: 14,
} as const
const lbl = {
  fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 600, color: '#888',
  textTransform: 'uppercase' as const, letterSpacing: '0.14em',
}
const btn = (primary: boolean) => ({
  padding: '12px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 18,
  letterSpacing: '0.05em', border: primary ? '2px solid #2371BB' : '1px solid #333',
  background: primary ? '#2371BB' : '#1a1a1a', color: '#fff',
}) as const

/** The first word of a display name: what a player shouts across the room. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

export function ContestCard({ state, busy, error, locked, onReady, onLeave, onBye }: {
  state: ContestState
  busy: boolean
  error: string | null
  locked: boolean
  onReady: () => void
  onLeave: () => void
  /** Record a bye: a draw with no opponent. */
  onBye: () => void
}) {
  const done = state.played >= state.matches
  return (
    <div data-testid="contest-card" style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={lbl}>Contest</span>
        <span style={{ fontSize: 12.5, color: '#888' }}>
          {done ? `${state.played} played · extra matches count` : `Match ${state.played + 1} of ${state.matches}`}
        </span>
      </div>

      {state.status === 'paired' && state.pairing && (
        <div data-testid="contest-paired" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
          <div aria-hidden style={{
            width: 56, height: 56, borderRadius: 14, background: '#1f1f1f', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 30, fontFamily: 'var(--font-display)', color: '#fff', flexShrink: 0,
          }}>
            {state.pairing.opponent_icon || firstName(state.pairing.opponent_name).charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1, color: '#fff' }}>
              Find {firstName(state.pairing.opponent_name)}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
              {state.pairing.by_judge ? 'Paired by the kaiwhakawā. ' : ''}Play, then you both record the result below.
            </div>
          </div>
        </div>
      )}

      {state.status === 'waiting' && (
        <div data-testid="contest-waiting" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 15, color: '#fff' }}>Finding you an opponent…</div>
          <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>
            {state.waiting <= 1 ? 'Nobody else is waiting yet.' : `${state.waiting} waiting.`}
          </div>
          {state.noneEligible && (
            <div style={{ fontSize: 13, color: '#F9B051', marginTop: 8, lineHeight: 1.4 }}>
              Nobody in this game can be paired with you yet. Keep waiting, or take a bye: it counts as a draw.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" disabled={busy} onClick={onLeave} style={btn(false)}>Stop waiting</button>
            {state.noneEligible && <button type="button" disabled={busy} onClick={onBye} style={btn(false)}>Take a bye</button>}
          </div>
        </div>
      )}

      {state.status === 'needs_bodyweight' && (
        <div style={{ fontSize: 13.5, color: '#F9B051', marginTop: 10, lineHeight: 1.4 }}>
          This contest pairs by bodyweight. Enter today&apos;s bodyweight below, then tap Ready again.
        </div>
      )}

      {(state.status === 'idle' || state.status === 'needs_bodyweight') && !locked && (
        <button type="button" disabled={busy} onClick={onReady} style={{ ...btn(true), width: '100%', marginTop: 12 }}>
          {done ? 'Ready for another' : 'Ready for a match'}
        </button>
      )}

      {error && <div role="alert" style={{ color: '#EA4742', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

export function ContestJudgeCard({ board, error, onPair, onRules }: {
  board: ContestBoard
  error: string | null
  onPair: (a: string, b: string) => void
  onRules: (matches: number, mixed: boolean) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id].slice(-2))
  return (
    <div data-testid="contest-judge" style={card}>
      <div style={lbl}>Contest · kaiwhakawā</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, color: '#ccc' }}>Matches each</span>
        <button type="button" aria-label="Fewer matches" onClick={() => onRules(Math.max(1, board.matches - 1), board.mixed)} style={{ ...btn(false), padding: '4px 12px' }}>−</button>
        <span data-testid="contest-matches" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#fff' }}>{board.matches}</span>
        <button type="button" aria-label="More matches" onClick={() => onRules(Math.min(20, board.matches + 1), board.mixed)} style={{ ...btn(false), padding: '4px 12px' }}>+</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: '#ccc', marginLeft: 'auto' }}>
          <input type="checkbox" checked={board.mixed} onChange={e => onRules(board.matches, e.target.checked)} />
          Mixed allowed
        </label>
      </div>

      <div style={{ ...lbl, marginTop: 14 }}>Waiting</div>
      {board.waiting.length === 0 && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Nobody waiting.</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {board.waiting.map(w => (
          <button key={w.id} type="button" onClick={() => toggle(w.id)} aria-pressed={picked.includes(w.id)} style={{
            padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 14, color: '#fff',
            border: `1px solid ${picked.includes(w.id) ? '#2371BB' : '#333'}`, background: picked.includes(w.id) ? '#2371BB' : '#1a1a1a',
          }}>{w.name} · {w.points}</button>
        ))}
      </div>
      {picked.length === 2 && (
        <button type="button" onClick={() => { onPair(picked[0], picked[1]); setPicked([]) }} style={{ ...btn(true), width: '100%', marginTop: 10 }}>
          Pair these two
        </button>
      )}

      {board.paired.length > 0 && (
        <>
          <div style={{ ...lbl, marginTop: 14 }}>Playing now</div>
          {board.paired.map(p => (
            <div key={p.id} style={{ fontSize: 14, color: '#ccc', marginTop: 4 }}>{p.a} v {p.b}</div>
          ))}
        </>
      )}
      {error && <div role="alert" style={{ color: '#EA4742', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  )
}
