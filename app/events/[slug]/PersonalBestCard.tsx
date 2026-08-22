'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { formatNZDate } from '@/lib/dates'

const supabase = createClient()

// One result row as selected below. `sessions` is a to-one embed, so PostgREST
// returns it as an object (or null when the join misses) — matching how the
// original inline version read `personalBest.sessions?.session_date`.
type ResultRow = {
  score_label: string | null
  placement: number | null
  raw_score: number | null
  sessions: { session_date: string | null } | null
}

/**
 * The only per-viewer part of /events/[slug], split out so the rest of the page
 * (how to perform, rules, tiers — all of it derived from lib/eventData.ts) can
 * be a server component prerendered for every event.
 *
 * Takes the event's NAME rather than its slug because results are joined to
 * `session_events.event_name`, which is how PR history is keyed everywhere else
 * in the app. See the rename note in CLAUDE.md.
 */
export default function PersonalBestCard({
  eventName,
  isSport,
}: {
  eventName: string
  isSport: boolean
}) {
  const [player, setPlayer] = useState<{ id: string } | null>(null)
  const [personalBest, setPersonalBest] = useState<ResultRow | null>(null)
  const [sportRecord, setSportRecord] = useState<{ w: number; d: number; l: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const user = await getSessionUser()
      if (!user) { if (!cancelled) setLoading(false); return }

      const { data: p } = await supabase
        .from('players').select('id, display_name, username').eq('id', user.id).single()
      if (cancelled) return
      setPlayer(p)

      const { data: seData } = await supabase
        .from('session_events').select('id').eq('event_name', eventName)
      const eventIds = (seData ?? []).map(e => e.id)

      if (eventIds.length > 0) {
        if (isSport) {
          // Sport events show a W/D/L record, so every result is needed
          const { data } = await supabase
            .from('results')
            .select('score_label, placement, raw_score, sessions(session_date)')
            .eq('player_id', user.id)
            .in('event_id', eventIds)
          const rows = (data ?? []) as unknown as ResultRow[]
          if (!cancelled && rows.length > 0) {
            setPersonalBest(rows[0])
            setSportRecord({
              w: rows.filter(r => r.raw_score === 2).length,
              d: rows.filter(r => r.raw_score === 1).length,
              l: rows.filter(r => r.raw_score === 0).length,
            })
          }
        } else {
          const { data } = await supabase
            .from('results')
            .select('score_label, placement, raw_score, sessions(session_date)')
            .eq('player_id', user.id)
            .in('event_id', eventIds)
            .order('raw_score', { ascending: false })
            .limit(1)
          const rows = (data ?? []) as unknown as ResultRow[]
          if (!cancelled && rows.length > 0) setPersonalBest(rows[0])
        }
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventName, isSport])

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--white)', marginBottom: '12px', letterSpacing: '1px' }}>Personal Best</div>
      {loading ? (
        <div style={{ color: '#555', fontSize: '13px' }}>Loading...</div>
      ) : !player ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#555', fontSize: '13px', fontFamily: 'var(--font-body)' }}>Log in to see your personal best</div>
          <Link href="/play" style={{ color: 'var(--blue)', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none' }}>Log In →</Link>
        </div>
      ) : personalBest ? (
        <div>
          {sportRecord ? (
            <div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--green)', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
                {[sportRecord.w > 0 && `${sportRecord.w}W`, sportRecord.d > 0 && `${sportRecord.d}D`, sportRecord.l > 0 && `${sportRecord.l}L`].filter(Boolean).join(' ')}
              </div>
              <div style={{ fontSize: '12px', color: '#555', marginTop: '4px', fontFamily: 'var(--font-body)' }}>
                {sportRecord.w + sportRecord.d + sportRecord.l} match{sportRecord.w + sportRecord.d + sportRecord.l !== 1 ? 'es' : ''} played
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--green)' }}>{personalBest.score_label}</div>
              {personalBest.sessions?.session_date && (
                <div style={{ fontSize: '12px', color: '#555', marginTop: '4px', fontFamily: 'var(--font-body)' }}>
                  {formatNZDate(personalBest.sessions.session_date)}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'var(--font-body)' }}>No result yet — participate in a session to set your first score!</div>
      )}
    </div>
  )
}
