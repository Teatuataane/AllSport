'use client'

// ─── Game screen: who said they are coming ───────────────────────────────────
// MULTI_LOCATION_PLAN.md step 8: "A Yes shows on the game screen so the
// Kaiārahi can tick people off." Shown on the Kaiārahi tab of a game tied to a
// weekly game. A name is ticked once that player has a score in this game, or
// when the Kaiārahi taps it (kept on this screen only: playing is the record
// that counts, and the show-up rate will read scores, not ticks).
//
// Read once when the tab opens: no polling (CLAUDE.md §4). RLS shows the names
// only to whoever runs that date.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { loadComing, type ComingPlayer } from '@/lib/bookingsData'
import { nzWallClock } from '@/lib/weeklyGames'

export function ComingListView({ coming, notComing, hereIds, ticked, onTick }: {
  coming: ComingPlayer[]
  notComing: number
  /** Players with a score in this game: here for certain. */
  hereIds: Set<string>
  /** Tapped by the Kaiārahi on this screen. */
  ticked: Set<string>
  onTick: (id: string) => void
}) {
  if (coming.length === 0 && notComing === 0) return null
  const here = coming.filter(p => hereIds.has(p.id) || ticked.has(p.id)).length
  return (
    <section aria-label="Said they are coming" style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      padding: '12px', marginBottom: '12px',
    }}>
      <div style={{
        fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase',
        letterSpacing: '0.14em', marginBottom: coming.length > 0 ? '10px' : 0,
      }}>
        {coming.length > 0 ? `Said they're coming · ${here} of ${coming.length} here` : 'Nobody said yes'}
        {notComing > 0 ? ` · ${notComing} not` : ''}
      </div>
      {coming.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {coming.map(p => {
            const scored = hereIds.has(p.id)
            const on = scored || ticked.has(p.id)
            return (
              <button key={p.id} type="button" className="press" aria-pressed={on} disabled={scored}
                onClick={() => onTick(p.id)} style={{
                  fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em',
                  minHeight: '40px', padding: '0 14px', borderRadius: 'var(--radius-pill)', cursor: scored ? 'default' : 'pointer',
                  background: on ? 'var(--green)' : 'var(--surface-2)', color: on ? 'var(--black)' : 'var(--grey-light)',
                  border: `1px solid ${on ? 'var(--green)' : 'var(--border-strong)'}`,
                }}>
                {p.name}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function ComingList({ weeklyGameId, startedAt, hereIds }: {
  weeklyGameId: string
  startedAt: string
  hereIds: Set<string>
}) {
  const [loaded, setLoaded] = useState<{ coming: ComingPlayer[]; notComing: number } | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    // The game's date is the NZ day it started on.
    const date = nzWallClock(new Date(startedAt)).date
    loadComing(createClient(), weeklyGameId, date)
      .then(r => { if (!cancelled) setLoaded(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [weeklyGameId, startedAt])

  if (!loaded) return null
  const onTick = (id: string) => setTicked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  return <ComingListView coming={loaded.coming} notComing={loaded.notComing} hereIds={hereIds} ticked={ticked} onTick={onTick} />
}
