'use client'

// ─── Kaiwhakawā: Kaiārahi ────────────────────────────────────────────────────
// Who may run games, at which level (lib/kaiarahi.ts), and their check dates.
// Granting, changing, suspending and removing all go through head-only
// database functions (20261123024501_kaiarahi_levels.sql); this panel only
// calls them. The database refuses anything that would leave no Kaiwhakawā.
//
// Hidden until that migration is live.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { KAIARAHI_LEVELS, LEVEL_NAME, type KaiarahiLevel } from '@/lib/kaiarahi'
import {
  loadKaiarahiList, grantKaiarahi, setKaiarahiChecks, suspendKaiarahi, removeKaiarahi, type KaiarahiRow,
} from '@/lib/kaiarahiData'
import { formatNZDate, parseLocalDate } from '@/lib/dates'

const supabase = createClient()

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, color: '#777',
  letterSpacing: '0.12em', textTransform: 'uppercase',
}
const inputStyle: CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8,
  padding: '10px 12px', color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)',
  boxSizing: 'border-box', minHeight: 44, colorScheme: 'dark',
}
const buttonStyle: CSSProperties = {
  background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, color: '#ddd',
  padding: '0 14px', minHeight: 44, cursor: 'pointer',
  fontFamily: 'var(--font-label)', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
}

const WHAT: Record<KaiarahiLevel, string> = {
  head: 'Head staff. Everything, including this panel.',
  staff: 'Paid staff. Runs the games they start.',
  community: 'Weekend course. Runs the games they start.',
}

type Person = { id: string; name: string }

/** Days from today (NZ) to a DATE, negative once past. */
function daysUntil(day: string | null): number | null {
  if (!day) return null
  const d = parseLocalDate(day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function CheckDate({ label, day }: { label: string; day: string | null }) {
  const left = daysUntil(day)
  const colour = left == null ? '#666' : left < 0 ? 'var(--red)' : left <= 60 ? 'var(--amber)' : '#999'
  return (
    <span style={{ fontSize: 13, color: colour }}>
      {label}: {day ? `${left != null && left < 0 ? 'expired ' : ''}${formatNZDate(day)}` : 'not recorded'}
    </span>
  )
}

export default function KaiarahiAdmin() {
  const [rows, setRows] = useState<KaiarahiRow[] | null | undefined>(undefined)
  const [people, setPeople] = useState<Person[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const [newLevel, setNewLevel] = useState<KaiarahiLevel>('community')
  const [via, setVia] = useState('')
  const [reason, setReason] = useState('')
  const [vetting, setVetting] = useState('')
  const [firstAid, setFirstAid] = useState('')

  const reload = useCallback(async () => {
    try {
      setRows(await loadKaiarahiList(supabase))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Kaiārahi')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadKaiarahiList(supabase).then(r => { if (!cancelled) setRows(r) }).catch(() => { if (!cancelled) setRows(null) })
    // Names only, from the public view: the panel never needs contact details.
    supabase.from('players_public').select('id, display_name, username').order('display_name').then(({ data }) => {
      if (cancelled || !data) return
      setPeople(data.map(p => ({ id: p.id as string, name: (p.display_name || p.username || 'Unknown') as string })))
    })
    return () => { cancelled = true }
  }, [])

  const nameOf = useMemo(() => new Map(people.map(p => [p.id, p.name])), [people])
  const held = useMemo(() => new Set((rows ?? []).map(r => r.player_id)), [rows])
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return people.filter(p => !held.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 8)
  }, [people, held, search])

  // Not live yet: show nothing, as the other panels do.
  if (rows === undefined || rows === null) return null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save')
    }
    setBusy(false)
  }

  const openRow = (r: KaiarahiRow | null) => {
    setOpen(r ? r.player_id : null)
    setReason('')
    setVetting(r?.vetting_expires ?? '')
    setFirstAid(r?.first_aid_expires ?? '')
  }

  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 14, padding: 16, marginTop: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.04em' }}>Kaiārahi</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
        Who may run games. Kaiwhakawā, Kaimahi and Kaiako.
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 14, marginBottom: 10 }}>{error}</div>}

      {rows.map(r => {
        const isOpen = open === r.player_id
        return (
          <div key={r.player_id} style={{ borderTop: '1px solid #1d1d1d', padding: '10px 0' }}>
            <button className="press" onClick={() => openRow(isOpen ? null : r)} style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              background: 'none', border: 'none', color: '#fff', padding: 0, minHeight: 44, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{nameOf.get(r.player_id) ?? 'Unknown'}</span>
                <span style={{ display: 'block', fontSize: 13, color: r.suspended_at ? 'var(--red)' : '#888' }}>
                  {LEVEL_NAME[r.level]}{r.suspended_at ? ` · suspended: ${r.suspended_reason}` : ''}
                  {r.qualified_via ? ` · ${r.qualified_via}` : ''}
                </span>
              </span>
              <span style={{ color: '#666', fontSize: 13 }}>{isOpen ? 'Close' : 'Edit'}</span>
            </button>
            {r.level !== 'community' && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
                <CheckDate label="Vetting" day={r.vetting_expires} />
                <CheckDate label="First aid" day={r.first_aid_expires} />
              </div>
            )}

            {isOpen && (
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <div>
                  <div style={labelStyle}>Level</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {KAIARAHI_LEVELS.map(l => (
                      <button key={l} className="press" disabled={busy || (l === r.level && !r.suspended_at)}
                        onClick={() => run(() => grantKaiarahi(supabase, r.player_id, l, ''))}
                        style={{ ...buttonStyle, borderColor: l === r.level ? 'var(--red)' : '#2a2a2a', color: l === r.level ? '#fff' : '#bbb' }}>
                        {LEVEL_NAME[l]}
                      </button>
                    ))}
                  </div>
                  {r.suspended_at && <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Choosing a level lifts the suspension.</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>
                    <div style={labelStyle}>Vetting expires</div>
                    <input type="date" value={vetting} onChange={e => setVetting(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
                  </label>
                  <label>
                    <div style={labelStyle}>First aid expires</div>
                    <input type="date" value={firstAid} onChange={e => setFirstAid(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
                  </label>
                </div>
                <button className="press" disabled={busy} style={buttonStyle}
                  onClick={() => run(() => setKaiarahiChecks(supabase, r.player_id, vetting || null, firstAid || null))}>
                  Save dates
                </button>

                {!r.suspended_at && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for suspending" style={inputStyle} />
                    <button className="press" disabled={busy || !reason.trim()} style={{ ...buttonStyle, flexShrink: 0 }}
                      onClick={() => run(() => suspendKaiarahi(supabase, r.player_id, reason))}>
                      Suspend
                    </button>
                  </div>
                )}
                <button className="press" disabled={busy} style={{ ...buttonStyle, color: 'var(--red)' }}
                  onClick={() => {
                    if (window.confirm(`Remove ${nameOf.get(r.player_id) ?? 'this person'} as a Kaiārahi?`)) {
                      void run(() => removeKaiarahi(supabase, r.player_id))
                    }
                  }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        )
      })}

      {!adding ? (
        <button className="press" onClick={() => setAdding(true)} style={{ ...buttonStyle, marginTop: 12, width: '100%' }}>
          + Add a Kaiārahi
        </button>
      ) : (
        <div style={{ borderTop: '1px solid #1d1d1d', marginTop: 10, paddingTop: 12, display: 'grid', gap: 12 }}>
          <label>
            <div style={labelStyle}>Player</div>
            <input value={search} onChange={e => { setSearch(e.target.value); setPick(null) }}
              placeholder="Type a name" style={{ ...inputStyle, marginTop: 6 }} />
          </label>
          {matches.length > 0 && !pick && (
            <div style={{ display: 'grid', gap: 4 }}>
              {matches.map(p => (
                <button key={p.id} className="press" onClick={() => { setPick(p.id); setSearch(p.name) }}
                  style={{ ...buttonStyle, textAlign: 'left', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 15 }}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div>
            <div style={labelStyle}>Level</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
              {KAIARAHI_LEVELS.map(l => (
                <button key={l} className="press" onClick={() => setNewLevel(l)} style={{
                  ...buttonStyle, textAlign: 'left', display: 'block', padding: '8px 12px',
                  borderColor: newLevel === l ? 'var(--red)' : '#2a2a2a',
                }}>
                  <span style={{ display: 'block', color: '#fff' }}>{LEVEL_NAME[l]}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, color: '#888', letterSpacing: 0 }}>{WHAT[l]}</span>
                </button>
              ))}
            </div>
          </div>
          <label>
            <div style={labelStyle}>How they qualified</div>
            <input value={via} onChange={e => setVia(e.target.value)} placeholder="e.g. Hired Jan 2027, or Kaiako course Feb 2027"
              style={{ ...inputStyle, marginTop: 6 }} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="press" disabled={busy || !pick} style={{ ...buttonStyle, flex: 1, background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
              onClick={() => {
                if (!pick) return
                void run(async () => {
                  await grantKaiarahi(supabase, pick, newLevel, via)
                  setAdding(false); setSearch(''); setPick(null); setVia('')
                })
              }}>
              Grant {LEVEL_NAME[newLevel]}
            </button>
            <button className="press" onClick={() => { setAdding(false); setSearch(''); setPick(null) }} style={buttonStyle}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
