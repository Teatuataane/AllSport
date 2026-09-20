'use client'

// ─── Playing a personal game ─────────────────────────────────────────────────
// The same screen an official game uses — progress header, "Still to play" and
// "Scored" lists, the quick-entry sheet — over a WORKOUT instead of a session.
// Everything drawn here comes from components/play/*, so a change to scoring
// lands in both places at once.
//
// What differs from a game, and why:
//   · no division rank on a row and no leaderboard: a personal game is
//     training, never ranked, and a solo score never ranks anyone in public;
//   · a Game rung records no win or loss (the database refuses a logged game
//     result), so playing one is recorded as training;
//   · it is open until Finish, and the NZ day closes it. Entries stay editable
//     for 7 days, which is the database's window.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getEventBySlug } from '@/lib/eventData'
import { fmtUnitsLabel, unitsForEntryRow } from '@/lib/units'
import { formatNZDate } from '@/lib/dates'
import { entryPayload, isOpen, planEvents, sortPlan, unitsForPayload, PLAN_MAX } from '@/lib/personalGame'
import QuickEntrySheet from '@/components/play/QuickEntrySheet'
import EventListRow from '@/components/play/EventListRow'
import { sectionLabel, ProgressSegments, type PlayEvent, type EntryRow } from '@/components/play/chrome'
import EventPlanPicker from '@/components/play/EventPlanPicker'
import type { EntryVals } from '@/lib/scoring'

const supabase = createClient()

type Entry = EntryRow & { event_slug: string | null; count: number | null; volume_distance_m: number | null }

type Workout = {
  id: string
  player_id: string
  performed_on: string
  witnessed: boolean
  finished_at: string | null
  planned_events: string[] | null
  notes: string | null
}

/** A planned event as the play screen draws it. The slug IS the id here. */
function playEvents(plan: readonly string[]): PlayEvent[] {
  return planEvents(plan).map(e => ({
    id: e.slug,
    domain_number: e.domainNumber,
    domain_name: e.domain,
    event_name: e.name,
    event_slug: e.slug,
    input_mode: e.inputMode,
  }))
}

export default function PersonalGamePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [prs, setPRs] = useState<Record<string, number>>({})
  const [sheetSlug, setSheetSlug] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<{ eventName: string; label: string; units: number } | null>(null)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('workouts')
      .select('id, player_id, performed_on, witnessed, finished_at, planned_events, notes, workout_entries(id, event_slug, count, volume_distance_m, raw_score, score_label, difficulty_tier, weight_kg, reps, time_seconds, distance_m, exercise_variation)')
      .eq('id', id)
      .maybeSingle()
    if (e || !data) { setNotFound(true); return }
    const w = data as Workout & { workout_entries: Entry[] }
    setWorkout(w)
    setEntries((w.workout_entries ?? []).map(r => ({
      ...r,
      raw_score: Number(r.raw_score ?? 0),
      result_type: null,
      opponent_name: null,
      match_score: null,
    })))
  }, [id])

  useEffect(() => { load() }, [load])

  // Lifetime bests, so the sheet can pre-fill and show a PR hint. Its own
  // query, and a failure only costs the hint.
  useEffect(() => {
    if (!workout?.player_id) return
    let cancelled = false
    supabase
      .from('workout_entries')
      .select('event_slug, raw_score, workouts!inner(player_id)')
      .eq('workouts.player_id', workout.player_id)
      .not('raw_score', 'is', null)
      .then(({ data }) => {
        if (cancelled) return
        const best: Record<string, number> = {}
        for (const r of (data ?? []) as { event_slug: string | null; raw_score: number }[]) {
          if (!r.event_slug) continue
          const v = Number(r.raw_score)
          if (!Number.isFinite(v)) continue
          if (best[r.event_slug] === undefined || v > best[r.event_slug]) best[r.event_slug] = v
        }
        setPRs(best)
      })
    return () => { cancelled = true }
  }, [workout?.player_id])

  const plan = workout?.planned_events ?? []
  const events = useMemo(() => playEvents(plan), [plan])
  const entriesFor = useCallback((slug: string) => entries.filter(e => e.event_slug === slug), [entries])
  const scoredSlugs = useMemo(
    () => new Set(entries.map(e => e.event_slug).filter((s): s is string => !!s)),
    [entries])
  const open = workout ? isOpen(workout) : false
  const locked = !open

  // Read off the VOLUME each entry stored, so a 5km run pays five units rather
  // than the one its converted rung would.
  const entryUnits = (e: Entry) => unitsForEntryRow({
    event_slug: e.event_slug, count: e.count,
    volume_distance_m: e.volume_distance_m == null ? null : Number(e.volume_distance_m),
  })?.units ?? 0
  const units = useMemo(() => entries.reduce((sum, e) => sum + entryUnits(e), 0), [entries])

  const todo = events.filter(e => !scoredSlugs.has(e.id))
  const done = events.filter(e => scoredSlugs.has(e.id))
  const sheetEvent = sheetSlug ? events.find(e => e.id === sheetSlug) : undefined

  const setPlan = async (next: string[]) => {
    if (!workout) return
    const { error: e } = await supabase.from('workouts').update({ planned_events: next }).eq('id', workout.id)
    if (e) { setError(e.message); return }
    setWorkout({ ...workout, planned_events: next })
  }

  const submit = async (slug: string, v: EntryVals, editingId: string | null) => {
    const ev = getEventBySlug(slug)
    if (!ev || !workout) return { error: 'That event is no longer on the roster', isPR: false, units: 0 }
    const payload = entryPayload(ev, v)
    if (!payload) return { error: 'Enter a valid score first', isPR: false, units: 0 }
    const best = prs[slug]
    const isPR = payload.raw_score !== undefined && (best === undefined || payload.raw_score > best)
    const { error: e } = editingId
      ? await supabase.from('workout_entries').update(payload).eq('id', editingId)
      : await supabase.from('workout_entries').insert({ ...payload, workout_id: workout.id })
    if (e) {
      return {
        error: e.code === '23514' ? 'One of the numbers is out of range. Check the weight, time and distance.' : e.message,
        isPR: false, units: 0,
      }
    }
    if (isPR && payload.raw_score !== undefined) setPRs(p => ({ ...p, [slug]: payload.raw_score! }))
    await load()
    // An edit replaces a completion, it does not add one.
    return { error: null, isPR, units: editingId ? 0 : unitsForPayload(ev, payload) }
  }

  const remove = async (entryId: string): Promise<string | null> => {
    const { error: e } = await supabase.from('workout_entries').delete().eq('id', entryId)
    if (e) return e.message
    await load()
    return null
  }

  const finish = async () => {
    if (!workout) return
    // An empty personal game is deleted rather than kept: nothing was trained.
    if (entries.length === 0) {
      await supabase.from('workouts').delete().eq('id', workout.id)
      router.push('/workout/new')
      return
    }
    const { error: e } = await supabase.from('workouts').update({ finished_at: new Date().toISOString() }).eq('id', workout.id)
    if (e) { setError(e.message); return }
    router.push('/history')
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 16px', color: 'var(--white)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>WORKOUT NOT FOUND</h1>
        <p style={{ color: 'var(--text-muted)' }}>It may have been deleted, or it belongs to another player.</p>
        <Link href="/workout/new" style={{ color: 'var(--blue)' }}>Start a new one →</Link>
      </div>
    )
  }
  if (!workout) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading…</div>
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 16px 120px', color: 'var(--white)' }}>
      {/* Header */}
      <div style={{ background: '#111', border: '1px solid var(--border)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '0.03em', lineHeight: 1 }}>
            MY WORKOUT
          </div>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {formatNZDate(workout.performed_on)}
          </div>
        </div>
        <div style={{ margin: '10px 0 8px' }}>
          <ProgressSegments events={events} scoredIds={scoredSlugs} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-label)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {done.length} of {events.length} event{events.length === 1 ? '' : 's'} scored
          </span>
          <span style={{ color: 'var(--purple)' }}>{fmtUnitsLabel(units)}</span>
        </div>
        {locked && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
            {workout.finished_at ? 'Finished.' : 'This workout is from an earlier day, so it is closed.'}{' '}
            {workout.witnessed ? 'Only a kaiwhakawā can change it.' : 'Your kaiwhakawā can still change it.'}
          </div>
        )}
      </div>

      {/* Still to play */}
      {todo.length > 0 && sectionLabel('Still to play')}
      {todo.map(ev => (
        <EventListRow
          key={ev.id}
          se={ev}
          eventData={getEventBySlug(ev.event_slug)}
          myResults={entriesFor(ev.id)}
          onOpen={() => setSheetSlug(ev.id)}
        />
      ))}

      {/* Scored */}
      {done.length > 0 && sectionLabel('Scored')}
      {done.map(ev => {
        const rows = entriesFor(ev.id)
        const evData = getEventBySlug(ev.event_slug)
        const u = rows.reduce((s, r) => s + entryUnits(r), 0)
        return (
          <EventListRow
            key={ev.id}
            se={ev}
            eventData={evData}
            myResults={rows}
            note={{ label: fmtUnitsLabel(u), color: 'var(--purple)' }}
            onOpen={() => setSheetSlug(ev.id)}
          />
        )
      })}

      {events.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 4px' }}>
          Nothing planned yet. Add an event below.
        </div>
      )}

      {/* Add more */}
      {!locked && (
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={() => setAdding(a => !a)} style={{
            width: '100%', minHeight: 48, borderRadius: 999, cursor: 'pointer',
            background: 'none', border: '1px dashed #2a2a2a', color: 'var(--text-muted)',
            fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>{adding ? 'Done adding' : '+ Add an event'}</button>
          {adding && (
            <div style={{ marginTop: 12 }}>
              <EventPlanPicker
                mode="personal"
                plan={plan}
                onChange={next => setPlan(sortPlan(next).slice(0, PLAN_MAX))}
              />
            </div>
          )}
        </div>
      )}

      {/* Finish */}
      {!locked && (
        <button onClick={finish} style={{
          width: '100%', minHeight: 56, marginTop: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: entries.length > 0 ? 'var(--rainbow)' : '#151515',
          color: entries.length > 0 ? '#0a0a0a' : 'var(--text-muted)',
          fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 15, fontWeight: 600,
        }}>
          {entries.length > 0 ? 'Finish workout' : 'Cancel workout'}
        </button>
      )}

      {error && (
        <div style={{ background: '#2e0d0d', border: '1px solid var(--red)', borderRadius: 10, padding: '12px 14px', color: 'var(--red)', fontSize: 14, marginTop: 12 }}>
          {error}
        </div>
      )}

      {/* The sheet — the same one an official game uses */}
      {sheetEvent && (
        <QuickEntrySheet
          key={sheetEvent.id}
          se={sheetEvent}
          eventData={getEventBySlug(sheetEvent.event_slug)}
          myResults={entriesFor(sheetEvent.id)}
          opponents={[]}
          seasonPR={prs[sheetEvent.id] ?? null}
          locked={locked}
          bestLabel="Best today"
          prLabel="Your best"
          allowGames={false}
          natural
          onClose={() => setSheetSlug(null)}
          onSubmit={(v, editingId) => submit(sheetEvent.id, v, editingId)}
          onDelete={remove}
          onSubmitted={(labelText, meta) => {
            setSheetSlug(null)
            setToast({ eventName: sheetEvent.event_name, label: labelText, units: meta.units })
            setTimeout(() => setToast(null), 3000)
          }}
          onDeleted={() => { /* load() already ran */ }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', zIndex: 120,
          background: '#111', border: '1px solid var(--green)', borderRadius: 14, padding: '12px 18px',
          maxWidth: 'calc(100vw - 32px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: '#fff' }}>
            {toast.eventName} — {toast.label}
          </span>
          {toast.units > 0 && (
            <span style={{ color: 'var(--purple)', fontSize: 13, marginLeft: 8 }}>+{fmtUnitsLabel(toast.units)}</span>
          )}
        </div>
      )}
    </div>
  )
}
