'use client'

// ─── Log a workout ───────────────────────────────────────────────────────────
// Workout logging (September 2026). Anything can be logged and fitted to one of
// the 120 events, then graded through the same framework as a game:
//
//   · the VOLUME (sets, holds, attempts, games, or the whole ride's distance)
//     becomes effort units toward the next colour in that domain;
//   · an optional BEST EFFORT (the fastest 1km split of a ride, a heaviest set)
//     is encoded exactly like a game score and counts toward the standards.
//
// Decisions: every logged workout counts, on trust (a kaiwhakawā moderates in
// person at games); a player, their parent or a kaiwhakawā can log, and a
// kaiwhakawā's log for someone else is marked witnessed; logs are private and
// never reach a public ranking; a workout can be dated up to 7 days back; an
// activity that matches no event is saved as "not fitted yet" and earns nothing
// until it is fitted. Full record: docs/designs/workout-logging-spec.md.
//
// Every read here is its own query: before the migration lands the tables are
// missing (PGRST205) and the page says logging is not live.

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS, DOMAIN_ORDER, getEventBySlug, type EventData } from '@/lib/eventData'
import { computeScoreVals, scoreColumns, tierScoring, EMPTY_VALS, type EntryVals } from '@/lib/scoring'
import { unitRule, unitsForVolume, fmtUnits, RULE_WORDS } from '@/lib/units'
import {
  fitActivity, suggestEvents, allowedDays, nzDay, workoutEvidence, recentUnitsByDomain, type WorkoutEntryRow,
} from '@/lib/workouts'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import EventIcon from '@/components/EventIcon'
import DomainIcon from '@/components/DomainIcon'

const supabase = createClient()

// ─── Shapes ──────────────────────────────────────────────────────────────────

type Draft = {
  key: number
  activity: string
  /** The event it is fitted to, or null. */
  slug: string | null
  /** Picked by hand: typing no longer re-fits it. */
  chosen: boolean
  count: string
  distanceKm: string
  durationMin: string
  bestOn: boolean
  best: EntryVals
}

type Entry = {
  id: string
  activity: string
  event_slug: string | null
  count: number | null
  volume_distance_m: number | null
  duration_seconds: number | null
  raw_score: number | null
  score_label: string | null
  difficulty_tier: string | null
  weight_kg: number | null
}

type Workout = {
  id: string
  player_id: string
  performed_on: string
  witnessed: boolean
  created_at: string
  notes: string | null
  workout_entries: Entry[]
}

let nextKey = 1
const newDraft = (): Draft => ({
  key: nextKey++, activity: '', slug: null, chosen: false,
  count: '', distanceKm: '', durationMin: '', bestOn: false, best: { ...EMPTY_VALS },
})

/** The best-effort columns workout_entries holds. Opponent and match columns are game-only. */
function bestColumns(ev: EventData, v: EntryVals) {
  const c = scoreColumns(ev.inputMode, ev, v)
  if (!c) return null
  return {
    raw_score: c.raw_score, score_label: c.score_label, difficulty_tier: c.difficulty_tier ?? null,
    exercise_variation: c.exercise_variation ?? null, weight_kg: c.weight_kg ?? null, reps: c.reps ?? null,
    time_seconds: c.time_seconds ?? null, distance_m: c.distance_m ?? null,
  }
}

/** A game-only event has nothing to enter as a solo best: its colours above the drills come from matches. */
function canLogBest(ev: EventData): boolean {
  if (ev.inputMode === 'sport' || ev.inputMode === 'score') return false
  const tiers = ev.difficultyTiers ?? []
  return tiers.length === 0 || tiers.some(t => t.scoring !== 'sport')
}

const dayLabel = (day: string, today: string) => {
  if (day === today) return 'Today'
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Style ───────────────────────────────────────────────────────────────────

const label: CSSProperties = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
}
const field: CSSProperties = {
  background: '#0d0d0d', color: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '10px 11px', fontSize: 15, fontFamily: 'var(--font-body)', width: '100%', minWidth: 0,
}
const chip = (on: boolean, colour = 'var(--blue)'): CSSProperties => ({
  padding: '8px 12px', minHeight: 36, borderRadius: 999, cursor: 'pointer', fontSize: 13,
  fontFamily: 'var(--font-label)', letterSpacing: '0.04em',
  background: on ? colour : '#151515', color: on ? '#fff' : 'var(--grey-light)',
  border: `1px solid ${on ? colour : 'var(--border)'}`,
})
const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, marginBottom: 12,
}

function Num({ value, onChange, placeholder, step = 'any', width }: {
  value: string; onChange: (v: string) => void; placeholder: string; step?: string; width?: number
}) {
  return (
    <input inputMode="decimal" type="number" min="0" step={step} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} aria-label={placeholder}
      style={{ ...field, width: width ?? '100%' }} />
  )
}

// ─── Best effort fields ──────────────────────────────────────────────────────
// The event's own score fields, the same ones the live quick-entry sheet asks
// for, without the game-only parts (Game rungs, opponents).

function BestFields({ ev, v, set }: { ev: EventData; v: EntryVals; set: (p: Partial<EntryVals>) => void }) {
  const mode = ev.inputMode
  const drills = (ev.difficultyTiers ?? []).filter(t => t.scoring !== 'sport')
  const special = v.difficultyTier ? tierScoring(ev, { name: v.difficultyTier }) : null
  const showTiers = drills.length > 0 && mode !== 'strength' && mode !== 'weight+time'
  const weight = mode === 'strength' || mode === 'weight+time' || special === 'weight'
  const reps = mode === 'strength' || mode === 'reps' || mode === 'difficulty+reps'
  const time = ['time', 'hold', 'difficulty+time', 'weight+time'].includes(mode)
  const isSplit = unitRule(ev).rule === 'distance'
  const scored = computeScoreVals(mode, ev, v)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {showTiers && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {drills.map(t => (
            <button key={t.name} type="button" onClick={() => set({ difficultyTier: t.name })} style={chip(v.difficultyTier === t.name)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {weight && <Num value={v.weightKg} onChange={x => set({ weightKg: x })} placeholder={ev.slug === 'shoulder-dislocate' ? 'Grip width (cm)' : 'Weight (kg)'} width={140} />}
        {reps && <Num value={v.repCount} onChange={x => set({ repCount: x })} placeholder={special === 'weight' || mode === 'strength' ? 'Reps' : 'Reps'} step="1" width={110} />}
        {time && <>
          <Num value={v.timeMins} onChange={x => set({ timeMins: x })} placeholder="Min" step="1" width={90} />
          <Num value={v.timeSecs} onChange={x => set({ timeSecs: x })} placeholder="Sec" width={90} />
        </>}
        {mode === 'sprint' && <>
          <Num value={v.timeSecs} onChange={x => set({ timeSecs: x })} placeholder="Seconds" step="1" width={110} />
          <Num value={v.sprintCs} onChange={x => set({ sprintCs: x })} placeholder="Hundredths" step="1" width={120} />
        </>}
        {(mode === 'distance' || mode === 'difficulty+distance') && (
          <Num value={v.distanceVal} onChange={x => set({ distanceVal: x })}
            placeholder={mode === 'distance' ? (v.distanceUnit === 'cm' ? 'Distance (cm)' : 'Distance (m)') : 'Metres'} width={150} />
        )}
        {mode === 'distance' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {(['m', 'cm'] as const).map(u => (
              <button key={u} type="button" onClick={() => set({ distanceUnit: u })} style={chip(v.distanceUnit === u)}>{u}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: scored ? 'var(--green)' : 'var(--text-muted)' }}>
        {scored
          ? `Counts toward your colours as ${scored.score_label}`
          : isSplit ? 'Pick the split distance and enter your fastest time over it.' : 'Enter your best to count it.'}
      </div>
    </div>
  )
}

// ─── The page ────────────────────────────────────────────────────────────────

export default function LogPage() {
  const router = useRouter()
  const { loading, userId, self, activePlayerId, activePlayer } = useActivePlayer()
  const isJudge = (self as { role?: string } | null)?.role === 'judge'

  const [aliases, setAliases] = useState<Map<string, string>>(new Map())
  const [live, setLive] = useState(true)
  const [players, setPlayers] = useState<{ id: string; display_name: string }[]>([])
  const [forPlayer, setForPlayer] = useState<string | null>(null)
  const [day, setDay] = useState(() => nzDay())
  const [notes, setNotes] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>(() => [newDraft()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loaded, setLoaded] = useState<{ id: string; workouts: Workout[] } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const targetId = (isJudge && forPlayer) || activePlayerId
  const workouts = loaded && loaded.id === targetId ? loaded.workouts : null
  const days = useMemo(() => allowedDays(), [])
  const today = days[0]

  useEffect(() => {
    if (!loading && !userId) router.push('/play')
  }, [loading, userId, router])

  useEffect(() => {
    let cancelled = false
    supabase.from('activity_aliases').select('alias, event_slug').then(({ data, error: e }) => {
      if (cancelled) return
      if (e) { setLive(e.code !== 'PGRST205'); return }
      setAliases(new Map(((data ?? []) as { alias: string; event_slug: string }[]).map(a => [a.alias, a.event_slug])))
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isJudge) return
    let cancelled = false
    supabase.from('players_public').select('id, display_name, is_guest').eq('is_active', true).order('display_name')
      .then(({ data }) => {
        if (cancelled) return
        setPlayers(((data ?? []) as { id: string; display_name: string; is_guest: boolean | null }[])
          .filter(p => !p.is_guest).map(({ id, display_name }) => ({ id, display_name })))
      })
    return () => { cancelled = true }
  }, [isJudge])

  useEffect(() => {
    if (!targetId) return
    let cancelled = false
    supabase.from('workouts')
      .select('id, player_id, performed_on, witnessed, created_at, notes, workout_entries(id, activity, event_slug, count, volume_distance_m, duration_seconds, raw_score, score_label, difficulty_tier, weight_kg)')
      .eq('player_id', targetId)
      .order('performed_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) { if (e.code === 'PGRST205') setLive(false); setLoaded({ id: targetId, workouts: [] }); return }
        setLoaded({ id: targetId, workouts: (data ?? []) as Workout[] })
      })
    return () => { cancelled = true }
  }, [targetId, reloadKey])

  const recent = useMemo(() => {
    const rows: WorkoutEntryRow[] = (workouts ?? []).flatMap(w => w.workout_entries.map(e => ({
      event_slug: e.event_slug, count: e.count, volume_distance_m: e.volume_distance_m,
      raw_score: e.raw_score, weight_kg: e.weight_kg, difficulty_tier: e.difficulty_tier,
      workouts: { player_id: w.player_id, performed_on: w.performed_on, witnessed: w.witnessed, created_at: w.created_at },
    })))
    return recentUnitsByDomain(workoutEvidence(rows).units, 7)
  }, [workouts])
  const recentMax = Math.max(1, ...recent.values())

  const unfitted = (workouts ?? []).flatMap(w => w.workout_entries.filter(e => !e.event_slug).map(e => ({ w, e })))

  const update = (key: number, p: Partial<Draft>) => setDrafts(ds => ds.map(d => (d.key === key ? { ...d, ...p } : d)))

  const typeActivity = (d: Draft, text: string) => {
    if (d.chosen) { update(d.key, { activity: text }); return }
    const ev = fitActivity(text, aliases)
    update(d.key, { activity: text, slug: ev?.slug ?? null })
  }

  const draftUnits = (d: Draft) => {
    const ev = d.slug ? getEventBySlug(d.slug) : undefined
    if (!ev) return 0
    return unitsForVolume(ev, { count: parseInt(d.count) || 0, distanceM: (parseFloat(d.distanceKm) || 0) * 1000 })
  }

  const save = async () => {
    setError('')
    setNotice('')
    if (!targetId || !userId) return
    const filled = drafts.filter(d => d.activity.trim() || d.slug)
    if (filled.length === 0) { setError('Add what you did first.'); return }
    const rows: Record<string, unknown>[] = []
    for (const d of filled) {
      const ev = d.slug ? getEventBySlug(d.slug) : undefined
      const name = d.activity.trim() || ev?.name || ''
      const count = parseInt(d.count) || null
      const distM = d.distanceKm ? Math.round((parseFloat(d.distanceKm) || 0) * 1000) || null : null
      const durS = d.durationMin ? Math.round((parseFloat(d.durationMin) || 0) * 60) || null : null
      let best: ReturnType<typeof bestColumns> = null
      if (ev && d.bestOn && canLogBest(ev)) {
        best = bestColumns(ev, d.best)
        if (!best) { setError(`${ev.name}: finish your best effort, or switch it off.`); return }
      }
      const volume = ev ? unitsForVolume(ev, { count, distanceM: distM }) > 0 : !!(count || distM || durS)
      if (!volume && !best) { setError(`${name}: add how much you did.`); return }
      rows.push({
        activity: name, event_slug: ev?.slug ?? null, count, volume_distance_m: distM, duration_seconds: durS,
        ...(best ?? {}),
      })
    }

    setBusy(true)
    const { data: w, error: e1 } = await supabase.from('workouts')
      .insert({ player_id: targetId, logged_by: userId, performed_on: day, notes: notes.trim() || null })
      .select('id').single()
    if (e1 || !w) {
      setBusy(false)
      setError(e1?.code === 'PGRST205' ? 'Workout logging is not live yet.' : e1?.message ?? 'The workout did not save. Try again.')
      return
    }
    const { error: e2 } = await supabase.from('workout_entries').insert(rows.map(r => ({ ...r, workout_id: (w as { id: string }).id })))
    if (e2) {
      // Never leave an empty workout behind.
      await supabase.from('workouts').delete().eq('id', (w as { id: string }).id)
      setBusy(false)
      setError(e2.message)
      return
    }
    const units = filled.reduce((s, d) => s + draftUnits(d), 0)
    const waiting = filled.filter(d => !d.slug).length
    setBusy(false)
    setDrafts([newDraft()])
    setNotes('')
    setNotice(`Logged${units > 0 ? ` · ${fmtUnits(units)} unit${units === 1 ? '' : 's'}` : ''}${waiting ? ` · ${waiting} not fitted yet` : ''}`)
    setReloadKey(k => k + 1)
  }

  const fitEntry = async (entryId: string, slug: string) => {
    const { error: e } = await supabase.from('workout_entries').update({ event_slug: slug }).eq('id', entryId)
    if (e) setError(e.message)
    else setReloadKey(k => k + 1)
  }

  const deleteWorkout = async (id: string) => {
    if (!window.confirm('Delete this workout? Its units and best efforts stop counting.')) return
    const { error: e } = await supabase.from('workouts').delete().eq('id', id)
    if (e) setError(e.message)
    else setReloadKey(k => k + 1)
  }

  if (loading || !activePlayer) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading…</div>
  }

  const targetName = isJudge && forPlayer
    ? players.find(p => p.id === forPlayer)?.display_name ?? 'this player'
    : playerLabel(activePlayer)

  return (
    <>
      <PlayerTabs />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 16px 48px', color: 'var(--white)' }}>
        <ViewingAsBanner />

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1, margin: '8px 0 6px', letterSpacing: '0.03em' }}>
          LOG A WORKOUT
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 16px' }}>
          Anything you do between games counts. Fit it to an event: how much you did becomes training toward your next
          colour in that domain, and your best effort counts toward the standards, just like a game score.{' '}
          <Link href="/grades" style={{ color: 'var(--blue)' }}>What each colour asks →</Link>
        </p>

        {!live && (
          <div style={{ ...card, color: 'var(--text-muted)', fontSize: 14 }}>
            Workout logging is not live yet. It will be once its database update is applied.
          </div>
        )}

        {/* ── Who and when ─────────────────────────────────────────────── */}
        <div style={card}>
          {isJudge && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...label, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Logging for</div>
              <select value={forPlayer ?? ''} onChange={e => setForPlayer(e.target.value || null)} style={field} aria-label="Logging for">
                <option value="">{playerLabel(activePlayer)} (you{activePlayerId !== userId ? ', active profile' : ''})</option>
                {players.filter(p => p.id !== activePlayerId).map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              {forPlayer && forPlayer !== userId && (
                <div style={{ fontSize: 12.5, color: 'var(--green)', marginTop: 6 }}>Logged by you, so it is marked witnessed.</div>
              )}
            </div>
          )}
          <div style={{ ...label, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Trained</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {days.map(d => (
              <button key={d} type="button" onClick={() => setDay(d)} style={{ ...chip(day === d), flexShrink: 0 }}>{dayLabel(d, today)}</button>
            ))}
          </div>
        </div>

        {/* ── What was done ────────────────────────────────────────────── */}
        {drafts.map((d, i) => {
          const ev = d.slug ? getEventBySlug(d.slug) : undefined
          const rule = ev ? unitRule(ev) : null
          const words = rule ? RULE_WORDS[rule.rule] : null
          const suggestions = !ev ? suggestEvents(d.activity, aliases, 5) : []
          const units = draftUnits(d)
          return (
            <div key={d.key} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ ...label, fontSize: 11, color: 'var(--text-muted)' }}>What you did{drafts.length > 1 ? ` · ${i + 1}` : ''}</span>
                {drafts.length > 1 && (
                  <button type="button" onClick={() => setDrafts(ds => ds.filter(x => x.key !== d.key))}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                )}
              </div>
              <input value={d.activity} onChange={e => typeActivity(d, e.target.value)} placeholder="Road ride, deadlifts, 5k run…"
                aria-label="What you did" style={field} />

              {ev ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <EventIcon slug={ev.slug} emoji={ev.emoji} domainNumber={ev.domainNumber} size={40} />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.03em', lineHeight: 1 }}>{ev.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ev.domain}</div>
                  </div>
                  <button type="button" onClick={() => update(d.key, { slug: null, chosen: false, bestOn: false })}
                    style={{ ...chip(false), minHeight: 32, padding: '6px 10px' }}>Change</button>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  {suggestions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {suggestions.map(s => (
                        <button key={s.slug} type="button" onClick={() => update(d.key, { slug: s.slug, chosen: true })} style={chip(false)}>{s.name}</button>
                      ))}
                    </div>
                  )}
                  <select value="" onChange={e => e.target.value && update(d.key, { slug: e.target.value, chosen: true })} style={field} aria-label="Choose an event">
                    <option value="">Choose the closest event…</option>
                    {DOMAIN_ORDER.map((dn, di) => (
                      <optgroup key={dn} label={dn}>
                        {EVENTS.filter(e => e.domainNumber === di + 1).map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {d.activity.trim().length > 1 && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                      No event matches yet. Save it anyway: it waits in your not fitted list and counts once it is fitted.
                    </div>
                  )}
                </div>
              )}

              {/* Volume */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {ev && rule?.rule === 'distance' ? (
                  <>
                    <Num value={d.distanceKm} onChange={x => update(d.key, { distanceKm: x })} placeholder="Distance (km)" width={150} />
                    <Num value={d.durationMin} onChange={x => update(d.key, { durationMin: x })} placeholder="Time (min)" width={120} />
                  </>
                ) : ev ? (
                  <Num value={d.count} onChange={x => update(d.key, { count: x })} placeholder={words!.many[0].toUpperCase() + words!.many.slice(1)} step="1" width={130} />
                ) : (
                  <>
                    <Num value={d.count} onChange={x => update(d.key, { count: x })} placeholder="Sets / rounds" step="1" width={130} />
                    <Num value={d.distanceKm} onChange={x => update(d.key, { distanceKm: x })} placeholder="Km" width={90} />
                    <Num value={d.durationMin} onChange={x => update(d.key, { durationMin: x })} placeholder="Min" width={90} />
                  </>
                )}
                {ev && (
                  <span style={{ ...label, fontSize: 12, color: units > 0 ? 'var(--purple)' : '#555' }}>
                    = {fmtUnits(units)} unit{units === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {ev && rule && (
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  One unit is {rule.rule === 'distance' ? `${rule.per / 1000 >= 1 ? `${rule.per / 1000}km` : `${rule.per}m`}` : rule.per === 1 ? `one ${words!.one}` : `${rule.per} ${words!.many}`}, at any effort.
                </div>
              )}

              {/* Best effort */}
              {ev && canLogBest(ev) && (
                <div style={{ marginTop: 12, borderTop: '1px solid #181818', paddingTop: 10 }}>
                  <button type="button" onClick={() => update(d.key, { bestOn: !d.bestOn })}
                    style={{ ...chip(d.bestOn, 'var(--green)'), minHeight: 34 }}>
                    {d.bestOn ? '✓ ' : '+ '}{rule?.rule === 'distance' ? 'Best split' : 'Best effort'}: counts toward your colours
                  </button>
                  {d.bestOn && <BestFields ev={ev} v={d.best} set={p => update(d.key, { best: { ...d.best, ...p } })} />}
                </div>
              )}
            </div>
          )
        })}

        <button type="button" onClick={() => setDrafts(ds => [...ds, newDraft()])}
          style={{ ...chip(false), width: '100%', marginBottom: 12, borderStyle: 'dashed' }}>
          + Add another
        </button>

        <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))} placeholder="Notes (optional): how it felt, what was modified"
          aria-label="Notes" rows={2} style={{ ...field, resize: 'vertical', marginBottom: 12 }} />

        {error && <div style={{ color: 'var(--red)', fontSize: 14, marginBottom: 10 }}>{error}</div>}
        {notice && <div style={{ color: 'var(--green)', fontSize: 14, marginBottom: 10 }}>{notice}</div>}

        <button type="button" onClick={save} disabled={busy || !live}
          style={{
            width: '100%', minHeight: 48, borderRadius: 999, border: 'none', cursor: busy || !live ? 'not-allowed' : 'pointer',
            background: busy || !live ? '#1a1a1a' : 'var(--red)', color: busy || !live ? '#555' : '#fff',
            ...label, fontSize: 15,
          }}>
          {busy ? 'Saving…' : `Save for ${targetName}`}
        </button>

        {/* ── The last seven days ─────────────────────────────────────── */}
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '0.03em', margin: '28px 0 4px' }}>LAST 7 DAYS</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Units logged by domain. Game scores count too, on your colours page.</div>
        <div style={card}>
          {DOMAIN_ORDER.map((dn, i) => {
            const u = recent.get(i + 1) ?? 0
            return (
              <div key={dn} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                <DomainIcon domainName={dn} domainNumber={i + 1} size={24} />
                <span style={{ width: 150, flexShrink: 0, fontSize: 13, color: u ? 'var(--white)' : '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dn}</span>
                <div style={{ flexGrow: 1, height: 6, borderRadius: 99, background: '#1a1a1a', overflow: 'hidden' }}>
                  <div style={{ width: `${(u / recentMax) * 100}%`, height: '100%', background: 'var(--purple)', borderRadius: 99 }} />
                </div>
                <span style={{ width: 30, textAlign: 'right', fontSize: 12.5, color: u ? 'var(--white)' : '#555' }}>{fmtUnits(u)}</span>
              </div>
            )
          })}
        </div>

        {/* ── Not fitted yet ──────────────────────────────────────────── */}
        {unfitted.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '0.03em', margin: '24px 0 4px' }}>NOT FITTED YET</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              Saved, but earning nothing until each one is fitted to an event. Pick one, or a kaiwhakawā can fit it for everyone.
            </div>
            {unfitted.map(({ w, e }) => (
              <div key={e.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 14 }}>
                  {e.activity} <span style={{ color: '#666', fontSize: 12.5 }}>· {dayLabel(w.performed_on, today)}</span>
                </div>
                <select value="" onChange={x => x.target.value && fitEntry(e.id, x.target.value)} style={field} aria-label={`Fit ${e.activity}`}>
                  <option value="">Fit to an event…</option>
                  {DOMAIN_ORDER.map((dn, di) => (
                    <optgroup key={dn} label={dn}>
                      {EVENTS.filter(x => x.domainNumber === di + 1).map(x => <option key={x.slug} value={x.slug}>{x.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </>
        )}

        {/* ── Recent workouts ─────────────────────────────────────────── */}
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '0.03em', margin: '24px 0 10px' }}>RECENT</h2>
        {!workouts ? (
          <div style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>Loading…</div>
        ) : workouts.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>Nothing logged yet.</div>
        ) : workouts.map(w => (
          <div key={w.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ ...label, fontSize: 12, color: 'var(--white)' }}>
                {dayLabel(w.performed_on, today)}
                {w.witnessed && <span style={{ color: 'var(--green)', marginLeft: 8 }}>Witnessed</span>}
              </span>
              <button type="button" onClick={() => deleteWorkout(w.id)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 13 }}>Delete</button>
            </div>
            {w.workout_entries.map(e => {
              const ev = e.event_slug ? getEventBySlug(e.event_slug) : undefined
              const u = ev ? unitsForVolume(ev, { count: e.count, distanceM: e.volume_distance_m == null ? null : Number(e.volume_distance_m) }) : 0
              return (
                <div key={e.id} style={{ fontSize: 13.5, padding: '4px 0', color: 'var(--grey-light)', lineHeight: 1.45 }}>
                  <span style={{ color: 'var(--white)' }}>{ev?.name ?? e.activity}</span>
                  {ev && e.activity.toLowerCase() !== ev.name.toLowerCase() && <span style={{ color: '#666' }}> ({e.activity})</span>}
                  {!ev && <span style={{ color: 'var(--amber)' }}> · not fitted</span>}
                  {u > 0 && <span style={{ color: 'var(--purple)' }}> · {fmtUnits(u)} unit{u === 1 ? '' : 's'}</span>}
                  {e.score_label && <span style={{ color: 'var(--green)' }}> · best {e.score_label}</span>}
                </div>
              )
            })}
            {w.notes && <div style={{ fontSize: 12.5, color: '#777', marginTop: 4 }}>{w.notes}</div>}
          </div>
        ))}
      </div>
    </>
  )
}
