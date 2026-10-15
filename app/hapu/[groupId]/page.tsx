'use client'

// ─── One hapū ───────────────────────────────────────────────────────────────
// Scoring v2 step 4. Members and the leader see names here (group_detail(),
// which reads an under-13 in a school group as "First L." to everyone but the
// leader and their own family). Anyone else is told it is members only. The
// leader also answers requests, invites players by username (a teacher adding
// a class: each invitation is accepted by the player or their parent),
// removes members and can close the group.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { nzYear } from '@/lib/seasonYear'
import { GROUP_KIND_NAMES, groupErrorMessage, groupsNotLive, type GroupKind, type GroupMemberRow } from '@/lib/groupBoard'
import { GroupMemberList, groupCard, groupLabel } from '@/components/GroupParts'
import { Button, Input } from '@/components/ui'

const supabase = createClient()

type Group = { id: string; name: string; kind: GroupKind; leader_id: string }

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const year = nzYear()
  const { userId, loading } = useActivePlayer()
  const [group, setGroup] = useState<Group | null | undefined>(undefined)
  const [members, setMembers] = useState<GroupMemberRow[] | null>(null)
  const [refused, setRefused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [username, setUsername] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  // Bumped after every change, so the page re-reads what the database now holds.
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!groupId || !userId) return
    let cancelled = false
    Promise.all([
      supabase.from('groups').select('id, name, kind, leader_id').eq('id', groupId).maybeSingle(),
      supabase.rpc('group_detail', { p_group_id: groupId, p_year: year }),
    ]).then(([g, d]) => {
      if (cancelled) return
      if (groupsNotLive(g.error)) { setGroup(null); return }
      setGroup((g.data as Group | null) ?? null)
      setRefused(d.error?.code === '42501')
      setMembers(d.error ? [] : (d.data ?? []) as GroupMemberRow[])
    })
    return () => { cancelled = true }
  }, [groupId, userId, year, nonce])

  const isLeader = !!group && group.leader_id === userId

  const act = async (fn: () => PromiseLike<{ error: { code?: string; message?: string } | null }>) => {
    setBusy(true); setError(null); setNote(null)
    const { error: err } = await fn()
    setBusy(false)
    if (err) { setError(groupErrorMessage(err)); return false }
    setNonce(n => n + 1)
    return true
  }

  const invite = async () => {
    const name = username.trim().replace(/^@/, '')
    if (!name) return
    setError(null); setNote(null)
    const { data } = await supabase.from('players_public').select('id, display_name').eq('username', name).maybeSingle()
    const p = data as { id: string; display_name: string } | null
    if (!p) { setError('No player with that username.'); return }
    if (await act(() => supabase.rpc('invite_to_group', { p_group_id: groupId, p_player_id: p.id }))) {
      setUsername('')
      setNote(`Invited ${p.display_name}. They join once they or their parent say yes.`)
    }
  }

  const close = async () => {
    setBusy(true)
    const { error: err } = await supabase.rpc('delete_group', { p_group_id: groupId })
    setBusy(false)
    if (err) { setError(groupErrorMessage(err)); return }
    router.push('/hapu')
  }

  const waiting = (members ?? []).filter(m => m.status !== 'member')

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'var(--white)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 48px' }}>
        <Link href="/hapu" style={{ color: 'var(--blue)', fontFamily: 'var(--font-label)', fontSize: 14, textDecoration: 'none' }}>← Hapū</Link>

        {!loading && !userId && (
          <div style={{ ...groupCard, marginTop: 16, fontSize: 14 }}>
            <Link href="/play" style={{ color: 'var(--blue)' }}>Sign in</Link> to see this hapū.
          </div>
        )}
        {userId && group === null && (
          <div style={{ ...groupCard, marginTop: 16, fontSize: 14, color: 'var(--text-muted)' }}>Hapū not found.</div>
        )}

        {group && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, letterSpacing: '0.03em', margin: '12px 0 2px' }}>{group.name}</h1>
            <div style={{ ...groupLabel, marginBottom: 18 }}>{GROUP_KIND_NAMES[group.kind]}{isLeader ? ' · you lead it' : ''}</div>

            {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
            {note && <div style={{ color: 'var(--green)', fontSize: 14, marginBottom: 12 }}>{note}</div>}

            {refused ? (
              <div style={{ ...groupCard, fontSize: 14, color: 'var(--grey-light)' }}>
                Only members see who is in this hapū. Ask to join from <Link href="/hapu" style={{ color: 'var(--blue)' }}>Hapū</Link>.
              </div>
            ) : (
              <div style={groupCard}>
                <div style={groupLabel}>{year} members</div>
                {members ? (
                  <GroupMemberList rows={members} onRemove={isLeader
                    ? id => void act(() => supabase.rpc('leave_group', { p_group_id: groupId, p_player_id: id }))
                    : undefined} />
                ) : <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>Loading…</div>}
              </div>
            )}

            {isLeader && (
              <>
                <div style={groupCard}>
                  <div style={groupLabel}>Waiting</div>
                  {waiting.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>Nobody waiting.</div>}
                  {waiting.map(m => (
                    <div key={m.player_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ flex: 1 }}>
                        {m.name}
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                          {m.status === 'pending' ? 'Asked to join' : 'Invited, not answered yet'}
                        </span>
                      </span>
                      {m.status === 'pending' ? (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => act(() => supabase.rpc('answer_group', { p_group_id: groupId, p_player_id: m.player_id, p_accept: true }))}>Approve</Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => supabase.rpc('answer_group', { p_group_id: groupId, p_player_id: m.player_id, p_accept: false }))}>Decline</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => supabase.rpc('leave_group', { p_group_id: groupId, p_player_id: m.player_id }))}>Withdraw</Button>
                      )}
                    </div>
                  ))}
                </div>

                <div style={groupCard}>
                  <div style={groupLabel}>Invite a player</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                    <Input label="Username" value={username} onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void invite() }} wrapStyle={{ flex: 1 }} />
                    <Button disabled={busy || !username.trim()} onClick={() => void invite()}>Invite</Button>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  {confirmClose ? (
                    <span style={{ fontSize: 14 }}>
                      Close {group.name} for good?{' '}
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => void close()}>Close it</Button>{' '}
                      <Button size="sm" variant="ghost" onClick={() => setConfirmClose(false)}>Keep it</Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmClose(true)}>Close this hapū</Button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
