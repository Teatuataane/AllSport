'use client'

// ─── Bodyweight of the day ───────────────────────────────────────────────────
// Strength standards are a ratio of bodyweight, so a lift cannot be graded
// without one. This used to be a 10kg band on /profile: ONE player in 27 ever
// set it, because /profile is a page you visit once at registration. The
// question now sits where the lifting happens.
//
// It renders ONLY when the day actually holds a strength event. Asking someone
// their weight on a day of nothing but Flexibility and Coordination is a cost
// with no benefit, and the ask should land when it obviously matters.
//
// A declaration is written through record_bodyweight() — never a direct insert.
// The table grants no INSERT to anyone: the day is pinned server-side so a
// player cannot backdate a weight onto history they have already been graded
// on, and a PostgREST upsert would need the UPDATE privilege that pin depends
// on being absent.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { STANDARDS } from '@/lib/standards'

/** Does any of today's events grade on a ratio of bodyweight? */
export function needsBodyweight(eventSlugs: readonly (string | null | undefined)[]): boolean {
  return eventSlugs.some(s => !!s && STANDARDS[s]?.kind === 'ratio')
}

type Props = {
  /** Whose weight. Null for a guest, who has no profile and is never graded. */
  playerId: string | null
  /** The event slugs on this screen — the field hides when none is a ratio standard. */
  eventSlugs: readonly (string | null | undefined)[]
  /** The NZ day being scored, 'YYYY-MM-DD'. Today's games and today's workouts only. */
  day: string
  /** A closed game or a locked workout: show the value, refuse the edit. */
  locked?: boolean
  /** Shown when a kaiwhakawā is recording for somebody else. */
  forName?: string | null
  /** Told the new weight once it saves, so the screen can re-colour its lifts. */
  onSaved?: (kg: number) => void
}

export default function BodyweightField({ playerId, eventSlugs, day, locked, forName, onSaved }: Props) {
  const [kg, setKg] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const [carried, setCarried] = useState<{ kg: number; on: string } | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  // The table is not there until 20260922213125 is applied. Until then this
  // renders nothing and the band on /profile is still doing the job.
  const [live, setLive] = useState(true)

  const relevant = needsBodyweight(eventSlugs)

  const load = useCallback(async () => {
    if (!playerId || !relevant) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('player_bodyweights')
      .select('measured_on, kg')
      .eq('player_id', playerId)
      .lte('measured_on', day)
      .order('measured_on', { ascending: false })
      .limit(1)
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') setLive(false)
      return
    }
    const row = data?.[0] as { measured_on: string; kg: number } | undefined
    if (!row) return
    if (row.measured_on === day) { setSaved(Number(row.kg)); setKg(String(Number(row.kg))) }
    else { setCarried({ kg: Number(row.kg), on: row.measured_on }); setKg(String(Number(row.kg))) }
  }, [playerId, relevant, day])

  useEffect(() => { void load() }, [load])

  if (!playerId || !relevant || !live) return null

  const save = async () => {
    const n = Number(kg)
    if (!Number.isFinite(n) || n < 20 || n > 400) {
      setState('error'); setMsg('Enter a weight between 20 and 400kg.'); return
    }
    setState('saving'); setMsg('')
    const supabase = createClient()
    const { error } = await supabase.rpc('record_bodyweight', { p_player_id: playerId, p_kg: n })
    if (error) {
      setState('error')
      setMsg(error.code === '42501' ? 'You cannot record a weight for this player.' : 'Could not save that. Try again.')
      return
    }
    setSaved(n); setCarried(null); setState('done'); setMsg('')
    onSaved?.(n)
  }

  const dirty = saved === null || Number(kg) !== saved
  const label = forName ? `${forName}'s bodyweight today` : 'Bodyweight today'

  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 12,
      padding: '10px 12px', marginBottom: 12,
    }}>
      <div style={{
        fontFamily: 'var(--font-label)', fontSize: 11, color: '#777',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
      }}>
        {label}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          inputMode="decimal"
          value={kg}
          disabled={locked || state === 'saving'}
          onChange={e => { setKg(e.target.value.replace(/[^0-9.]/g, '')); setState('idle') }}
          placeholder="kg"
          aria-label={label}
          style={{
            width: 96, minHeight: 44, boxSizing: 'border-box', background: '#000',
            border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 12px',
            color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)',
          }}
        />
        {!locked && dirty && (
          <button
            onClick={save}
            disabled={state === 'saving' || !kg}
            style={{
              minHeight: 44, padding: '0 16px', borderRadius: 10, border: 'none',
              background: kg ? 'var(--blue)' : '#1a1a1a', color: '#fff', cursor: kg ? 'pointer' : 'default',
              fontFamily: 'var(--font-label)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}
          >
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
        )}
        {!dirty && saved !== null && (
          <span style={{ fontSize: 12.5, color: 'var(--green)', fontFamily: 'var(--font-body)' }}>Saved</span>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: '#555', fontFamily: 'var(--font-body)', marginTop: 6, lineHeight: 1.5 }}>
        {msg
          ? <span style={{ color: 'var(--red)' }}>{msg}</span>
          : carried
            ? <>Carried over from {carried.on}. Save today&apos;s to grade these lifts against it.</>
            : saved !== null
              ? <>Today&apos;s lifts are graded against this. Only you and your kaiwhakawā can see it.</>
              : <>Lifts are graded against your bodyweight. Without it they are not graded. Only you and your kaiwhakawā can see it.</>}
      </div>
    </div>
  )
}
