'use client'

// ─── Training tab (/judge) ───────────────────────────────────────────────────
// Personal training: pick a client, land on the play screen. Open sessions sit
// on top as chips so several clients can be run at once; below them a search
// box, and with nothing typed, the clients trained in the last 30 days.
// Nothing here scores anything: a session is a witnessed workout and the play
// screen (/workout/[id]) does the rest.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { formatNZDate } from '@/lib/dates'
import {
  loadAllOpenTraining, loadRecentTraining, openOrStartTraining, recentClients,
  type TrainingWorkout,
} from '@/lib/training'

const supabase = createClient()

type Person = { id: string; display_name: string; username: string | null }

const LBL: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666',
  margin: '18px 0 8px',
}

export default function TrainingTab({ kaiwhakawaId }: { kaiwhakawaId: string }) {
  const router = useRouter()
  const [people, setPeople] = useState<Person[] | null>(null)
  const [open, setOpen] = useState<TrainingWorkout[]>([])
  const [recent, setRecent] = useState<{ player_id: string; last: string }[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.from('players_public').select('id, display_name, username, is_guest')
      .eq('is_active', true).order('display_name')
      .then(({ data }) => {
        if (cancelled) return
        setPeople(((data ?? []) as (Person & { is_guest: boolean | null })[])
          .filter(p => !p.is_guest).map(({ id, display_name, username }) => ({ id, display_name, username })))
      })
    loadAllOpenTraining(supabase).then(w => { if (!cancelled) setOpen(w) })
    loadRecentTraining(supabase, kaiwhakawaId).then(rows => { if (!cancelled) setRecent(recentClients(rows, kaiwhakawaId)) })
    return () => { cancelled = true }
  }, [kaiwhakawaId])

  const byId = useMemo(() => new Map((people ?? []).map(p => [p.id, p])), [people])
  const q = query.trim().toLowerCase()
  const matches = useMemo(
    () => q ? (people ?? []).filter(p => p.display_name.toLowerCase().includes(q) || (p.username ?? '').toLowerCase().includes(q)).slice(0, 12) : [],
    [people, q],
  )

  const start = async (playerId: string) => {
    if (busy) return
    setError('')
    setBusy(playerId)
    const res = await openOrStartTraining(supabase, playerId, kaiwhakawaId)
    if ('error' in res) { setError(res.error); setBusy(null); return }
    router.push(`/workout/${res.id}`)
  }

  const row = (p: Person, note?: string) => (
    <button key={p.id} type="button" onClick={() => start(p.id)} disabled={busy !== null}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '8px 14px',
        background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
        color: '#fff', opacity: busy && busy !== p.id ? 0.5 : 1,
      }}>
      <span style={{ flex: 1, fontSize: 15 }}>{p.display_name}</span>
      {note && <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: '#777', letterSpacing: '0.06em' }}>{note}</span>}
      <span style={{ color: '#555' }}>›</span>
    </button>
  )

  return (
    <div style={{ marginBottom: 20 }}>
      {open.length > 0 && (
        <>
          <div style={{ ...LBL, marginTop: 4 }}>Open now</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {open.map(w => (
              <button key={w.id} type="button" onClick={() => router.push(`/workout/${w.id}`)}
                style={{
                  minHeight: 44, padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                  background: '#0d2e1a', border: '1px solid #4DB26E', color: '#fff', fontSize: 14,
                }}>
                {byId.get(w.player_id)?.display_name ?? 'Player'}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ ...LBL, marginTop: open.length > 0 ? 18 : 4 }}>Find a player</div>
      <input
        value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Name or username" aria-label="Search players"
        style={{
          width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '0 14px', borderRadius: 12,
          background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#fff', fontSize: 16,
        }}
      />

      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}

      {q ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {matches.map(p => row(p))}
          {people && matches.length === 0 && (
            <div style={{ color: '#666', fontSize: 14, padding: '10px 4px' }}>No player matches “{query.trim()}”.</div>
          )}
        </div>
      ) : (
        <>
          <div style={LBL}>Recent clients</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(r => {
              const p = byId.get(r.player_id)
              return p ? row(p, `last ${formatNZDate(r.last)}`) : null
            })}
            {recent.length === 0 && (
              <div style={{ color: '#666', fontSize: 14, padding: '4px 4px' }}>
                Nobody yet. Search for a player above to start their first session.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
