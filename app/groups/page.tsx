'use client'

// ─── Groups ──────────────────────────────────────────────────────────────────
// Scoring v2 step 4 (Tāne, 15 Oct 2026; SCORING_V2_PLAN.md decisions 10 to 12).
// Public: the group board, ranked by average improvement per active member,
// groups only, never a name (group_board()). Signed in: the active player's
// groups, invitations to answer, groups they lead, and finding or starting
// one. One group of each kind per player.
//
// Every read is its own query, and a database without the groups migration
// (20261015004143) shows "not live yet" rather than an error.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import { nzYear } from '@/lib/seasonYear'
import {
  GROUP_KINDS, GROUP_KIND_NAMES, groupErrorMessage, groupsNotLive,
  type GroupBoardRow, type GroupKind,
} from '@/lib/groupBoard'
import { GroupBoardList, groupCard, groupLabel } from '@/components/GroupParts'
import { Button, Input, Select } from '@/components/ui'

const supabase = createClient()

type Membership = { group_id: string; status: 'pending' | 'invited' | 'member'; groups: { name: string; kind: GroupKind } | null }
type GroupRow = { id: string; name: string; kind: GroupKind }

export default function GroupsPage() {
  const router = useRouter()
  const year = nzYear()
  const { userId, activePlayerId, activePlayer } = useActivePlayer()
  const [board, setBoard] = useState<GroupBoardRow[] | null>(null)
  const [notLive, setNotLive] = useState(false)
  const [mine, setMine] = useState<Membership[]>([])
  const [led, setLed] = useState<GroupRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [search, setSearch] = useState('')
  const [found, setFound] = useState<GroupRow[] | null>(null)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<GroupKind>('club')

  useEffect(() => {
    let cancelled = false
    supabase.rpc('group_board', { p_year: year }).then(({ data, error: err }) => {
      if (cancelled) return
      if (groupsNotLive(err)) { setNotLive(true); setBoard([]); return }
      setBoard(err ? [] : (data ?? []) as GroupBoardRow[])
    })
    return () => { cancelled = true }
  }, [year])

  // Bumped after every change, so the lists re-read what the database now holds.
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!userId || !activePlayerId) return
    let cancelled = false
    Promise.all([
      supabase.from('group_members').select('group_id, status, groups(name, kind)').eq('player_id', activePlayerId),
      supabase.from('groups').select('id, name, kind').eq('leader_id', userId).order('name'),
    ]).then(([m, l]) => {
      if (cancelled) return
      if (groupsNotLive(m.error) || groupsNotLive(l.error)) { setNotLive(true); return }
      setMine((m.data ?? []) as unknown as Membership[])
      setLed((l.data ?? []) as GroupRow[])
    })
    return () => { cancelled = true }
  }, [userId, activePlayerId, nonce])

  const act = async (fn: () => PromiseLike<{ error: { code?: string; message?: string } | null }>) => {
    setBusy(true); setError(null)
    const { error: err } = await fn()
    setBusy(false)
    if (err) { setError(groupErrorMessage(err)); return false }
    setNonce(n => n + 1)
    return true
  }

  const find = async () => {
    const term = search.trim()
    if (term.length < 2) { setFound([]); return }
    const { data } = await supabase.from('groups').select('id, name, kind')
      .ilike('name', `%${term.replace(/[%_\\]/g, m => `\\${m}`)}%`).order('name').limit(20)
    setFound((data ?? []) as GroupRow[])
  }

  const create = async () => {
    setBusy(true); setError(null)
    const { data, error: err } = await supabase.rpc('create_group', { p_name: newName, p_kind: newKind })
    setBusy(false)
    if (err) { setError(groupErrorMessage(err)); return }
    router.push(`/groups/${data as string}`)
  }

  const heldKinds = new Set(mine.map(m => m.groups?.kind).filter(Boolean))
  const who = activePlayer ? playerLabel(activePlayer) : 'You'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'var(--white)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 48px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, letterSpacing: '0.03em', margin: '0 0 4px' }}>Groups</h1>
        <p style={{ fontSize: 14, color: 'var(--grey-light)', margin: '0 0 20px', lineHeight: 1.45 }}>
          Schools, clubs and whānau, ranked by how much their players improve this season.
          A player counts after 3 games.
        </p>

        {notLive && (
          <div style={{ ...groupCard, color: 'var(--amber)', fontSize: 14 }}>Groups are not live yet.</div>
        )}

        <div style={groupCard}>
          <div style={groupLabel}>{year} board</div>
          {board ? <GroupBoardList rows={board} /> : <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>Loading…</div>}
        </div>

        {userId && !notLive && (
          <>
            {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12 }}>{error}</div>}

            <div style={groupCard}>
              <div style={groupLabel}>{who === 'You' ? 'Your groups' : `${who}'s groups`}</div>
              {mine.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>Not in a group yet.</div>}
              {mine.map(m => (
                <div key={m.group_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {m.status === 'member'
                      ? <Link href={`/groups/${m.group_id}`} style={{ color: 'var(--white)', fontSize: 15 }}>{m.groups?.name}</Link>
                      : <span style={{ fontSize: 15 }}>{m.groups?.name}</span>}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {m.groups ? GROUP_KIND_NAMES[m.groups.kind] : ''}
                      {m.status === 'pending' ? ' · waiting for the leader' : m.status === 'invited' ? ' · invited' : ''}
                    </span>
                  </span>
                  {m.status === 'invited' && activePlayerId && (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => act(() => supabase.rpc('answer_group', { p_group_id: m.group_id, p_player_id: activePlayerId, p_accept: true }))}>Join</Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => supabase.rpc('answer_group', { p_group_id: m.group_id, p_player_id: activePlayerId, p_accept: false }))}>No thanks</Button>
                    </>
                  )}
                  {m.status !== 'invited' && activePlayerId && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => supabase.rpc('leave_group', { p_group_id: m.group_id, p_player_id: activePlayerId }))}>
                      {m.status === 'pending' ? 'Cancel' : 'Leave'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div style={groupCard}>
              <div style={groupLabel}>Find a group</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                <Input label="Group name" value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void find() }} wrapStyle={{ flex: 1 }} />
                <Button onClick={() => void find()}>Search</Button>
              </div>
              {found?.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>No group by that name.</div>}
              {found?.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: 1 }}>
                    {g.name}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{GROUP_KIND_NAMES[g.kind]}</span>
                  </span>
                  {heldKinds.has(g.kind)
                    ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Already in a {GROUP_KIND_NAMES[g.kind].toLowerCase()}</span>
                    : activePlayerId && (
                      <Button size="sm" disabled={busy} onClick={() => act(() => supabase.rpc('request_group', { p_group_id: g.id, p_player_id: activePlayerId }))}>Ask to join</Button>
                    )}
                </div>
              ))}
            </div>

            <div style={groupCard}>
              <div style={groupLabel}>Groups you lead</div>
              {led.map(g => (
                <Link key={g.id} href={`/groups/${g.id}`} style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border)', color: 'var(--white)', textDecoration: 'none' }}>
                  {g.name} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {GROUP_KIND_NAMES[g.kind]}</span>
                </Link>
              ))}
              <div style={{ fontSize: 13, color: 'var(--grey-light)', margin: '12px 0 8px' }}>
                Start a group for your school, club or whānau. You approve who joins.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Input label="Name" value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} wrapStyle={{ flex: '1 1 180px' }} />
                <Select label="Kind" value={newKind} onChange={e => setNewKind(e.target.value as GroupKind)} wrapStyle={{ flex: '0 0 120px' }}>
                  {GROUP_KINDS.map(k => <option key={k} value={k}>{GROUP_KIND_NAMES[k]}</option>)}
                </Select>
                <Button disabled={busy || newName.trim().length < 2} onClick={() => void create()}>Start</Button>
              </div>
            </div>
          </>
        )}

        {!userId && (
          <div style={{ fontSize: 14, color: 'var(--grey-light)' }}>
            <Link href="/play" style={{ color: 'var(--blue)' }}>Sign in</Link> to join or start a group.
          </div>
        )}
      </div>
    </div>
  )
}
