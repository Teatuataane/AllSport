'use client'

// ─── Fitting activities ──────────────────────────────────────────────────────
// Workout logging, decision 14: anything can be logged, and what someone typed
// is fitted to one of the 120 events by an alias. An activity that matches no
// alias is saved but earns nothing until it is fitted. This lists every such
// activity across the club, and fitting one through fit_activity() adds the
// alias AND fits every entry that typed it, earlier logs included.
//
// The list comes from unfitted_activities(), grouped in the database by the
// same normaliser fit_activity() matches with, so what is listed is exactly
// what a fit will reach. Kaiwhakawā only: RLS lets a kaiwhakawā read every
// entry, and fit_activity refuses anyone else. Before the workout migration
// lands the function is missing (PGRST202) and the panel says so.
//
// Fitting PUBLISHES the words as a club-wide alias every signed-in player's log
// form reads, so the panel says so beside each one: an activity that names a
// person or an injury should be fitted by the player instead.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import { suggestEvents } from '@/lib/workouts'
import EventOptions from '@/components/EventOptions'

const supabase = createClient()

type Unfitted = { activity: string; entries: number }
type Message = { kind: 'ok' | 'error'; text: string }

const label = { fontFamily: 'var(--font-label)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em' }
const btn = (enabled: boolean) => ({
  minHeight: 44, padding: '10px 14px', borderRadius: '10px', border: 'none', flexShrink: 0,
  background: enabled ? 'var(--blue)' : '#1a1a1a', color: enabled ? '#fff' : '#555',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'var(--font-label)', fontSize: '13px', letterSpacing: '0.05em',
})

export default function ActivityFitPanel() {
  const [rows, setRows] = useState<Unfitted[] | null>(null)
  const [aliases, setAliases] = useState<Map<string, string>>(new Map())
  const [live, setLive] = useState(true)
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [unfitted, alias] = await Promise.all([
        supabase.rpc('unfitted_activities'),
        supabase.from('activity_aliases').select('alias, event_slug'),
      ])
      if (cancelled) return
      if (unfitted.error) {
        const missing = unfitted.error.code === 'PGRST202' || unfitted.error.code === 'PGRST205'
        setLive(!missing)
        if (!missing) setMessage({ kind: 'error', text: unfitted.error.message })
        setRows([])
        return
      }
      setAliases(new Map(((alias.data ?? []) as { alias: string; event_slug: string }[]).map(a => [a.alias, a.event_slug])))
      setRows(((unfitted.data ?? []) as Unfitted[]).map(r => ({ activity: r.activity, entries: Number(r.entries) })))
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  const fit = async (activity: string) => {
    const slug = choice[activity]
    if (!slug) return
    setBusy(activity)
    setMessage(null)
    const { data, error } = await supabase.rpc('fit_activity', { p_activity: activity, p_event_slug: slug })
    setBusy(null)
    if (error) { setMessage({ kind: 'error', text: error.message }); return }
    const ev = EVENTS.find(x => x.slug === slug)
    setRows(rs => rs?.filter(r => r.activity !== activity) ?? rs)
    setAliases(a => new Map(a).set(activity, slug))
    setMessage({ kind: 'ok', text: `"${activity}" now counts as ${ev?.name ?? slug}: ${data ?? 0} logged ${data === 1 ? 'entry' : 'entries'} fitted.` })
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--purple)', letterSpacing: '0.05em', lineHeight: 1 }}>
            Activities to fit
          </div>
          <div style={{ ...label, marginTop: '4px' }}>LOGGED WORKOUTS THAT MATCH NO EVENT YET</div>
        </div>
        <button onClick={() => { setRows(null); setReloadKey(k => k + 1) }} style={btn(true)}>Refresh</button>
      </div>

      {!live && (
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Workout logging is not live yet: its migration has not been applied.
        </div>
      )}
      {message && (
        <div role="status" aria-live="polite"
          style={{ color: message.kind === 'ok' ? 'var(--green)' : 'var(--red)', fontSize: '14px', marginBottom: '12px' }}>
          {message.text}
        </div>
      )}

      {live && (!rows ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '12px 0' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '12px 0' }}>
          Everything logged fits an event.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Fitting one adds its words to the club&apos;s alias list, which every player&apos;s log form reads. If an
            activity names a person or an injury, leave it for the player to fit on their own log.
          </div>
          {rows.map(r => {
            const guess = suggestEvents(r.activity, aliases, 1)[0]
            const value = choice[r.activity] ?? ''
            return (
              <div key={r.activity} style={{ background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ fontSize: '15px', color: 'var(--white)', marginBottom: '8px' }}>
                  {r.activity} <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>· {r.entries} logged</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={value} onChange={e => setChoice(c => ({ ...c, [r.activity]: e.target.value }))} aria-label={`Event for ${r.activity}`}
                    style={{ flex: 1, minWidth: 0, minHeight: 44, background: '#111', color: 'var(--white)', border: '1px solid var(--border-strong, #2a2a2a)', borderRadius: '10px', padding: '8px', fontSize: '16px' }}>
                    <option value="">{guess ? `Choose… (closest: ${guess.name})` : 'Choose an event…'}</option>
                    <EventOptions />
                  </select>
                  <button onClick={() => fit(r.activity)} disabled={!value || busy === r.activity} style={btn(!!value && busy !== r.activity)}>
                    {busy === r.activity ? 'Fitting…' : 'Fit'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
