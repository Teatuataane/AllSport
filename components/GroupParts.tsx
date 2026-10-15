// ─── Hapū, in parts ────────────────────────────────────────────────────────
// Props only, so __tests__/groupParts.test.tsx can render them. The pages
// (/hapu and /hapu/[groupId]) do the reads; the rule is lib/groupBoard.ts.

import Link from 'next/link'
import { GROUP_KIND_NAMES, improvementLabel, type GroupBoardRow, type GroupMemberRow } from '@/lib/groupBoard'

export const groupCard = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 16,
} as const

export const groupLabel = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const, letterSpacing: '0.1em',
  fontWeight: 600, fontSize: 11, color: 'var(--text-muted)',
}

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** The public board: hapū only, never a name. */
export function GroupBoardList({ rows }: { rows: readonly GroupBoardRow[] }) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>No hapū yet.</div>
  }
  return (
    <div data-testid="group-board">
      {rows.map(r => (
        <Link key={r.group_id} href={`/hapu/${r.group_id}`} data-testid="group-row" style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px', borderBottom: '1px solid var(--border)',
          color: 'inherit', textDecoration: 'none',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, width: 44, color: r.place ? 'var(--white)' : 'var(--text-muted)' }}>
            {r.place ? ord(r.place) : '—'}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {GROUP_KIND_NAMES[r.kind]} · {r.active_members} active · {r.games} {r.games === 1 ? 'game' : 'games'}
            </span>
          </span>
          <span style={{ fontSize: 13.5, color: r.improvement == null ? 'var(--text-muted)' : r.improvement >= 0 ? 'var(--green)' : 'var(--amber)', flexShrink: 0 }}>
            {improvementLabel(r.improvement)}
          </span>
        </Link>
      ))}
    </div>
  )
}

/** Members inside a hapū, as group_detail() names them. */
export function GroupMemberList({ rows, onRemove }: {
  rows: readonly GroupMemberRow[]
  /** Set for the leader: shows a remove button per member. */
  onRemove?: (playerId: string) => void
}) {
  const members = rows.filter(r => r.status === 'member')
  if (members.length === 0) {
    return <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>No members yet.</div>
  }
  return (
    <div data-testid="group-members">
      {members.map(m => (
        <div key={m.player_id} data-testid="group-member" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, color: 'var(--white)' }}>{m.name}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {m.games} {m.games === 1 ? 'game' : 'games'} this season
            </span>
          </span>
          <span style={{ fontSize: 13, color: m.improvement == null ? 'var(--text-muted)' : 'var(--white)' }}>
            {improvementLabel(m.improvement)}
          </span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(m.player_id)} aria-label={`Remove ${m.name}`} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)',
              padding: '6px 10px', cursor: 'pointer', fontSize: 12,
            }}>Remove</button>
          )}
        </div>
      ))}
    </div>
  )
}
