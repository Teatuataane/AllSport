'use client'

// ─── A Swiss contest, in the scoring sheet ──────────────────────────────────
// Scoring v2 step 5, redesigned 18 Oct 2026: no Ready button. Props only (the
// data comes from lib/useContest.ts and lib/swiss.ts), so
// __tests__/contestCard.test.tsx can render every state.
//
// ContestCard is the player's. Before their first match it just says to play
// anyone; after it, "Play next" names up to three opponents with a record
// like theirs, and tapping one fills in the opponent below. "Unbeaten today"
// says who the room is chasing. ContestJudgeCard is the kaiwhakawā's: the
// day's table, and the mixed switch on a contact event.

import { recordLabel, type ContestRecord } from '@/lib/swiss'

const card = {
  background: '#141414', border: '1px solid #262626', borderRadius: 14, padding: '14px 16px', marginBottom: 14,
} as const
const lbl = {
  fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 600, color: '#888',
  textTransform: 'uppercase' as const, letterSpacing: '0.14em',
}

/** The first word of a display name: what a player shouts across the room. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

export type ContestName = { id: string; name: string; record: ContestRecord }

function Unbeaten({ list }: { list: readonly ContestName[] }) {
  if (list.length === 0) return null
  const shown = list.slice(0, 3)
  return (
    <div data-testid="contest-unbeaten" style={{ fontSize: 13, color: '#ccc', marginTop: 10 }}>
      <span style={{ color: '#F9B051' }}>Unbeaten today: </span>
      {shown.map(u => `${firstName(u.name)} (${recordLabel(u.record)})`).join(', ')}
      {list.length > shown.length ? ` and ${list.length - shown.length} more` : ''}
    </div>
  )
}

export function ContestCard({ me, suggestions, unbeaten, needsBodyweight, pickedId, locked, onPick }: {
  /** This player's record today, or null before their first match. */
  me: ContestRecord | null
  suggestions: readonly ContestName[]
  unbeaten: readonly ContestName[]
  needsBodyweight: boolean
  /** The opponent picked below, to mark the matching name. */
  pickedId: string | null
  locked: boolean
  onPick: (id: string, name: string) => void
}) {
  const first = !me || me.games === 0
  return (
    <div data-testid="contest-card" style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={lbl}>{first ? 'Contest' : 'Play next'}</span>
        {me && me.games > 0 && <span style={{ fontSize: 12.5, color: '#888' }}>You: {recordLabel(me)}</span>}
      </div>

      {needsBodyweight ? (
        <div style={{ fontSize: 13.5, color: '#F9B051', marginTop: 8, lineHeight: 1.4 }}>
          This contest is matched by bodyweight. Enter today&apos;s bodyweight to see who is safe to play.
        </div>
      ) : first ? (
        <div data-testid="contest-first" style={{ fontSize: 13.5, color: '#ccc', marginTop: 8, lineHeight: 1.4 }}>
          Play anyone for your first match. After that, this shows who to play next: winners play winners.
        </div>
      ) : suggestions.length === 0 ? (
        <div data-testid="contest-none" style={{ fontSize: 13.5, color: '#ccc', marginTop: 8, lineHeight: 1.4 }}>
          Nobody to suggest yet. Play anyone the list below allows.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {suggestions.map(s => {
              const on = pickedId === s.id
              return (
                <button key={s.id} type="button" disabled={locked} data-testid="contest-suggestion"
                  aria-pressed={on} onClick={() => onPick(s.id, s.name)} style={{
                    padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${on ? '#2371BB' : '#333'}`, background: on ? '#2371BB' : '#1a1a1a', color: '#fff',
                  }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1 }}>{firstName(s.name)}</div>
                  <div style={{ fontSize: 12, color: on ? '#dce9f7' : '#888', marginTop: 3 }}>{recordLabel(s.record)}</div>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 12.5, color: '#888', marginTop: 8, lineHeight: 1.4 }}>
            Find whoever is free, tap their name, then record the result.
          </div>
        </>
      )}

      <Unbeaten list={unbeaten} />
    </div>
  )
}

export function ContestJudgeCard({ table, unbeaten, contact, mixed, error, onMixed }: {
  /** Everyone's record today, best first. */
  table: readonly ContestName[]
  unbeaten: readonly ContestName[]
  contact: boolean
  mixed: boolean
  error: string | null
  onMixed: (mixed: boolean) => void
}) {
  return (
    <div data-testid="contest-judge" style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={lbl}>Contest today</span>
        {contact && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: '#ccc' }}>
            <input type="checkbox" checked={mixed} onChange={e => onMixed(e.target.checked)} />
            Mixed allowed
          </label>
        )}
      </div>
      <Unbeaten list={unbeaten} />
      {table.length === 0
        ? <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>No matches recorded yet.</div>
        : (
          <div data-testid="contest-table" style={{ marginTop: 8 }}>
            {table.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#ccc', padding: '3px 0' }}>
                <span>{t.name}</span><span style={{ color: '#888' }}>{recordLabel(t.record)}</span>
              </div>
            ))}
          </div>
        )}
      {error && <div role="alert" style={{ color: '#EA4742', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  )
}
