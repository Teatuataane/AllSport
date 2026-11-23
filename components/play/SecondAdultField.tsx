'use client'

// ─── New Game: the second adult ──────────────────────────────────────────────
// Shown when the game needs two adults (a school game) or the Kaiako starting
// it is under 18 (20261123205536). The second is another Kaiārahi, or a named
// helper from the host (a teacher) with no account. A Kaiako under 18 must
// confirm the helper is 18 or over; the database checks a Kaiārahi's age.
//
// Props only: the page records it (set_second_adult) before starting.

import type { CSSProperties } from 'react'
import { LEVEL_NAME } from '@/lib/kaiarahi'
import type { SecondAdult } from '@/lib/roster'
import type { DirectoryRow } from '@/lib/rosterData'

const label: CSSProperties = {
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, color: '#777',
  letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 8,
}
const input: CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px',
  color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)', boxSizing: 'border-box', minHeight: 44, colorScheme: 'dark',
}

export default function SecondAdultField({ directory, meId, mustBeAdult, twoAdults, value, onChange }: {
  directory: DirectoryRow[]
  meId: string | null
  /** A Kaiako under 18: the second must be 18 or over. */
  mustBeAdult: boolean
  /** The game itself asks for two adults. */
  twoAdults: boolean
  value: SecondAdult
  onChange: (v: SecondAdult) => void
}) {
  const helper = value?.kind === 'helper' ? value : null
  const others = directory.filter(d => d.player_id !== meId)
  return (
    <div style={{ border: '1px solid var(--amber)', borderRadius: 10, padding: 14, display: 'grid', gap: 10 }}>
      <div>
        <span style={{ ...label, marginBottom: 4, color: 'var(--amber)' }}>Second adult</span>
        <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
          {twoAdults ? 'This game needs two adults before it starts.' : 'Kaiako under 18 run a game with an adult (18 or over).'}
        </div>
      </div>
      <label>
        <span style={label}>A Kaiārahi</span>
        <select value={value?.kind === 'kaiarahi' ? value.playerId : ''} style={input}
          onChange={e => onChange(e.target.value ? { kind: 'kaiarahi', playerId: e.target.value } : null)}>
          <option value="">Choose…</option>
          {others.map(d => <option key={d.player_id} value={d.player_id}>{d.display_name} · {LEVEL_NAME[d.level]}</option>)}
        </select>
      </label>
      <label>
        <span style={label}>Or a helper (a teacher, say)</span>
        <input value={helper?.name ?? ''} maxLength={80} placeholder="Their name" style={input}
          onChange={e => onChange(e.target.value ? { kind: 'helper', name: e.target.value, adult: helper?.adult ?? false } : null)} />
      </label>
      {helper && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={helper.adult} style={{ width: 18, height: 18 }}
            onChange={e => onChange({ ...helper, adult: e.target.checked })} />
          <span>{helper.name.trim() || 'They'} {mustBeAdult ? 'is 18 or over (needed)' : 'is 18 or over'}</span>
        </label>
      )}
    </div>
  )
}
