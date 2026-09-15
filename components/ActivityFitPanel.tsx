'use client'

// ─── Fitting activities ──────────────────────────────────────────────────────
// Workout logging, decision 14: anything can be logged, and what someone typed
// is fitted to one of the 120 events by an alias. An activity that matches no
// alias is saved but earns nothing until it is fitted. This lists every such
// activity across the club, and fitting one through fit_activity() adds the
// alias AND fits every entry that typed it, earlier logs included.
//
// Kaiwhakawā only: RLS lets a kaiwhakawā read every entry, and fit_activity
// refuses anyone else. Before the workout migration lands the table is missing
// (PGRST205) and the panel says so.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS, DOMAIN_ORDER } from '@/lib/eventData'
import { normaliseActivity, suggestEvents } from '@/lib/workouts'

const supabase = createClient()

type Unfitted = { activity: string; count: number }

const label = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', color: '#555', letterSpacing: '0.08em' }
const btn = (enabled: boolean) => ({
  padding: '7px 12px', borderRadius: '8px', border: 'none', flexShrink: 0,
  background: enabled ? '#2371BB' : '#1a1a1a', color: enabled ? '#fff' : '#555',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '0.05em',
})

export default function ActivityFitPanel() {
  const [rows, setRows] = useState<Unfitted[] | null>(null)
  const [aliases, setAliases] = useState<Map<string, string>>(new Map())
  const [live, setLive] = useState(true)
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [entries, alias] = await Promise.all([
        supabase.from('workout_entries').select('activity').is('event_slug', null).range(0, 4999),
        supabase.from('activity_aliases').select('alias, event_slug'),
      ])
      if (cancelled) return
      if (entries.error) {
        setLive(entries.error.code !== 'PGRST205')
        if (entries.error.code !== 'PGRST205') setError(entries.error.message)
        setRows([])
        return
      }
      const counts = new Map<string, number>()
      for (const e of (entries.data ?? []) as { activity: string }[]) {
        const a = normaliseActivity(e.activity)
        counts.set(a, (counts.get(a) ?? 0) + 1)
      }
      setAliases(new Map(((alias.data ?? []) as { alias: string; event_slug: string }[]).map(a => [a.alias, a.event_slug])))
      setRows([...counts.entries()].map(([activity, count]) => ({ activity, count })).sort((a, b) => b.count - a.count || a.activity.localeCompare(b.activity)))
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  const fit = async (activity: string) => {
    const slug = choice[activity]
    if (!slug) return
    setBusy(activity)
    setError('')
    const { data, error: e } = await supabase.rpc('fit_activity', { p_activity: activity, p_event_slug: slug })
    setBusy(null)
    if (e) { setError(e.message); return }
    const ev = EVENTS.find(x => x.slug === slug)
    setError('')
    setRows(rs => rs?.filter(r => r.activity !== activity) ?? rs)
    setAliases(a => new Map(a).set(activity, slug))
    // Tell the kaiwhakawā what happened, briefly, in the same place errors go.
    setError(`"${activity}" now counts as ${ev?.name ?? slug}: ${data ?? 0} logged ${data === 1 ? 'entry' : 'entries'} fitted.`)
  }

  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#B87DB5', letterSpacing: '0.05em', lineHeight: 1 }}>
            Activities to fit
          </div>
          <div style={{ ...label, marginTop: '2px' }}>LOGGED WORKOUTS THAT MATCH NO EVENT YET</div>
        </div>
        <button onClick={() => { setRows(null); setReloadKey(k => k + 1) }} style={btn(true)}>Refresh</button>
      </div>

      {!live && (
        <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
          Workout logging is not live yet: its migration has not been applied.
        </div>
      )}
      {error && (
        <div style={{ color: error.startsWith('"') ? '#4DB26E' : '#EA4742', fontSize: '13px', fontFamily: 'Barlow, sans-serif', marginBottom: '12px' }}>{error}</div>
      )}

      {live && (!rows ? (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '12px 0' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '12px 0' }}>
          Everything logged fits an event.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map(r => {
            const guess = suggestEvents(r.activity, aliases, 1)[0]
            const value = choice[r.activity] ?? ''
            return (
              <div key={r.activity} style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'Barlow, sans-serif', marginBottom: '6px' }}>
                  {r.activity} <span style={{ color: '#555', fontSize: '12px' }}>· {r.count} logged</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={value} onChange={e => setChoice(c => ({ ...c, [r.activity]: e.target.value }))} aria-label={`Event for ${r.activity}`}
                    style={{ flex: 1, minWidth: 0, background: '#111', color: '#fff', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px', fontFamily: 'Barlow, sans-serif', fontSize: '13px' }}>
                    <option value="">{guess ? `Choose… (closest: ${guess.name})` : 'Choose an event…'}</option>
                    {DOMAIN_ORDER.map((d, i) => (
                      <optgroup key={d} label={d}>
                        {EVENTS.filter(e => e.domainNumber === i + 1).map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
                      </optgroup>
                    ))}
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
