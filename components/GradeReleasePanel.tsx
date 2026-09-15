'use client'

// ─── Confirming colours ──────────────────────────────────────────────────────
// The kaiwhakawā half of decision 9: colours are computed automatically and
// RELEASED by a kaiwhakawā. This lists every player whose events now meet a
// colour above the one they hold, and confers it through confer_grade(), the
// only write path into grade_awards. It also records exemptions (decision 4):
// events a player cannot do, which leave both sides of the half-the-domain rule.
//
// It computes with lib/loadGrades.ts, the same code the player's own view uses,
// so the colour offered here is exactly the colour the player sees as ready.
//
// Before the grading migration lands, confer_grade does not exist (PGRST202)
// and grade_exemptions is missing (PGRST205): the panel still shows what is
// ready, says grading is not live, and disables the buttons.

import { useEffect, useState } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import { gradeForRung } from '@/lib/grading'
import { releasable } from '@/lib/playerGrades'
import { loadGradeState, loadMatches, type GradeState } from '@/lib/loadGrades'
import { GradeDot } from '@/components/GradesCard'

const supabase = createClient()
const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')

type Player = { id: string; display_name: string; division: string | null }
type Row = { player: Player; state: GradeState }

/** Each player is six small queries, so they load a few at a time. */
async function inBatches<T, R>(items: readonly T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)))
  return out
}

// One colour per domain at a time, and only once standards, games and
// training all pass (lib/grading.ts colourGate).
const pending = (r: Row) => releasable(r.state.gates)

const label = {
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', color: '#555', letterSpacing: '0.08em',
}
const btn = (enabled: boolean) => ({
  padding: '7px 12px', borderRadius: '8px', border: 'none', flexShrink: 0,
  background: enabled ? '#2371BB' : '#1a1a1a', color: enabled ? '#fff' : '#555',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '0.05em',
})

export default function GradeReleasePanel() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [judgeId, setJudgeId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exemptSlug, setExemptSlug] = useState('')
  const [exemptReason, setExemptReason] = useState('')
  // Bumped by Refresh, which reloads everyone.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const user = await getSessionUser()
      const { data, error: e } = await supabase
        .from('players_public').select('id, display_name, division, is_guest').eq('is_active', true)
      if (cancelled) return
      setJudgeId(user?.id ?? null)
      if (e) { setError(e.message); return }
      const players: Player[] = ((data ?? []) as (Player & { is_guest: boolean | null })[])
        .filter(p => !p.is_guest)
        .map(({ id, display_name, division }) => ({ id, display_name, division }))
      const matches = await loadMatches()
      const loaded = await inBatches(players, 5, async (p): Promise<Row | null> => {
        const state = await loadGradeState(p.id, matches)
        return state ? { player: p, state } : null
      })
      if (cancelled) return
      setRows(loaded
        .filter((r): r is Row => r != null)
        .sort((a, b) => pending(b).length - pending(a).length || a.player.display_name.localeCompare(b.player.display_name)))
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  const refresh = async (p: Player) => {
    const s = await loadGradeState(p.id)
    if (s) setRows(rs => rs?.map(x => (x.player.id === p.id ? { player: p, state: s } : x)) ?? rs)
  }

  const live = !!rows?.some(r => r.state.schemaReady)

  const confer = async (r: Row, domain: number, rung: number) => {
    setBusy(`${r.player.id}:${domain}`)
    setError('')
    const events = EVENTS
      .filter(e => e.domainNumber === domain && (r.state.grades.events.get(e.slug)?.rung ?? 0) >= rung)
      .map(e => e.slug)
    const { error: e } = await supabase.rpc('confer_grade', {
      p_player_id: r.player.id, p_domain_number: domain, p_rung: rung, p_events: events,
    })
    if (e) setError(e.code === 'PGRST202' ? 'Grading is not live yet: the grading migration has not been applied.' : e.message)
    else await refresh(r.player)
    setBusy(null)
  }

  const addExemption = async (r: Row) => {
    if (!exemptSlug || !judgeId) return
    setError('')
    const { error: e } = await supabase.from('grade_exemptions').insert({
      player_id: r.player.id, event_slug: exemptSlug, reason: exemptReason.trim() || null, confirmed_by: judgeId,
    })
    if (e) { setError(e.code === 'PGRST205' ? 'Exemptions are not live yet: the grading migration has not been applied.' : e.message); return }
    setExemptSlug('')
    setExemptReason('')
    await refresh(r.player)
  }

  const removeExemption = async (r: Row, slug: string) => {
    setError('')
    const { error: e } = await supabase.from('grade_exemptions').delete().eq('player_id', r.player.id).eq('event_slug', slug)
    if (e) setError(e.message)
    else await refresh(r.player)
  }

  const ready = (rows ?? []).filter(r => pending(r).length > 0)

  return (
    <div style={{ background: '#111', border: '1px solid #1e3a5f', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#4DB26E', letterSpacing: '0.05em', lineHeight: 1 }}>
            Colours to confirm
          </div>
          <div style={{ ...label, marginTop: '2px' }}>STANDARDS · GAMES · TRAINING · YOU RELEASE THEM</div>
        </div>
        <button onClick={() => { setRows(null); setReloadKey(k => k + 1) }} style={btn(true)}>Refresh</button>
      </div>

      {rows && !live && (
        <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5, marginBottom: '12px' }}>
          Grading is not live yet: nothing can be confirmed until the grading migration is applied. The list below
          shows what the standards give today.
        </div>
      )}
      {error && (
        <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'Barlow, sans-serif', marginBottom: '12px' }}>{error}</div>
      )}

      {!rows ? (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '20px 0' }}>
          Working out everyone&apos;s colours…
        </div>
      ) : ready.length === 0 ? (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '12px 0 18px' }}>
          Nobody has a colour waiting.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
          {ready.map(r => (
            <div key={r.player.id} style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'Barlow, sans-serif', marginBottom: '6px' }}>
                {r.player.display_name} <span style={{ color: '#555', fontSize: '12px' }}>{r.player.division}</span>
              </div>
              {pending(r).map(d => {
                const from = gradeForRung(d.held)
                const to = gradeForRung(d.releasable)
                const key = `${r.player.id}:${d.domainNumber}`
                // What stands behind it. Every source counts; the kaiwhakawā
                // moderates in person, so solo evidence is named, not hidden.
                const behind = EVENTS
                  .filter(e => e.domainNumber === d.domainNumber)
                  .map(e => r.state.grades.events.get(e.slug))
                  .filter(g => g && g.rung >= d.releasable)
                const solo = behind.filter(g => g!.source === 'solo').length
                const witnessed = behind.filter(g => g!.source === 'witnessed').length
                return (
                  <div key={d.domainNumber} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderTop: '1px solid #161616' }}>
                    <div style={{ flexGrow: 1, minWidth: 0, fontSize: '13px', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>
                      {DOMAIN_NAMES[d.domainNumber - 1]}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', fontSize: '12px', color: '#888' }}>
                        <GradeDot grade={from} size={9} /> {from.name} → <GradeDot grade={to} size={9} /> <span style={{ color: '#fff' }}>{to.name}</span>
                        <span style={{ color: '#555' }}>· {behind.length} events · {d.games} games · {Math.floor(d.units)} units</span>
                      </div>
                      {(solo > 0 || witnessed > 0) && (
                        <div style={{ fontSize: '11.5px', marginTop: '2px', color: solo ? '#F9B051' : '#888' }}>
                          {[solo && `${solo} solo`, witnessed && `${witnessed} witnessed`].filter(Boolean).join(' · ')} from logged workouts
                        </div>
                      )}
                    </div>
                    <button disabled={!live || busy === key} onClick={() => confer(r, d.domainNumber, d.releasable)} style={btn(live && busy !== key)}>
                      {busy === key ? 'Confirming…' : `Confirm ${to.name}`}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div style={{ ...label, margin: '4px 0 8px' }}>EXEMPTIONS · EVENTS A PLAYER CANNOT DO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rows.map(r => {
              const open = expanded === r.player.id
              const exempt = [...r.state.exemptions]
              return (
                <div key={r.player.id} style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    onClick={() => { setExpanded(open ? null : r.player.id); setExemptSlug(''); setExemptReason('') }}
                    style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#ccc', fontFamily: 'Barlow, sans-serif', fontSize: '13px' }}
                  >
                    <span>{r.player.display_name}</span>
                    <span style={{ color: '#555' }}>{exempt.length ? `${exempt.length} exempt` : ''} {open ? '▴' : '▾'}</span>
                  </button>
                  {open && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {exempt.map(slug => (
                        <div key={slug} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: '13px', color: '#aaa', fontFamily: 'Barlow, sans-serif' }}>
                          {EVENTS.find(e => e.slug === slug)?.name ?? slug}
                          <button onClick={() => removeExemption(r, slug)} style={btn(live)} disabled={!live}>Remove</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        <select value={exemptSlug} onChange={e => setExemptSlug(e.target.value)} aria-label="Event to exempt"
                          style={{ background: '#111', color: '#fff', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px', fontFamily: 'Barlow, sans-serif', fontSize: '13px' }}>
                          <option value="">Choose an event…</option>
                          {EVENTS.filter(e => !r.state.exemptions.has(e.slug)).map(e => (
                            <option key={e.slug} value={e.slug}>{DOMAIN_NAMES[e.domainNumber - 1]} · {e.name}</option>
                          ))}
                        </select>
                        <input value={exemptReason} onChange={e => setExemptReason(e.target.value)} placeholder="Reason (private: the player, their parent and kaiwhakawā only)"
                          style={{ background: '#111', color: '#fff', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px', fontFamily: 'Barlow, sans-serif', fontSize: '13px' }} />
                        <button onClick={() => addExemption(r)} disabled={!live || !exemptSlug} style={btn(live && !!exemptSlug)}>Add exemption</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
