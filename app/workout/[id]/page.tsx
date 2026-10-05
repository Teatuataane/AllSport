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
//   · it has a colour of its own (workoutColourRung): each event's best score
//     graded as HOME grades it, averaged over the plan, a skipped event Mā.
//     Every button is coloured by the grade it reaches, as on the game screen;
//   · it is open until Finish, and the NZ day closes it. Entries stay editable
//     for 7 days, which is the database's window.

import { usePRRows } from '@/lib/usePRRows'
import { isNewPR } from '@/lib/prBoard'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { lastTrainingPlan } from '@/lib/training'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getEventBySlug } from '@/lib/eventData'
import { formatNZDate } from '@/lib/dates'
import { entryPayload, isOpen, planEvents, sortPlan, PLAN_MAX } from '@/lib/personalGame'
import QuickEntrySheet from '@/components/play/QuickEntrySheet'
import EventListRow from '@/components/play/EventListRow'
import { ProgressSegments, type PlayEvent, type EntryRow } from '@/components/play/chrome'
import BodyweightField from '@/components/play/BodyweightField'
import EventPlanPicker from '@/components/play/EventPlanPicker'
import { GradeDot } from '@/components/GradeDot'
import { useGradeProfile } from '@/lib/useGradeProfile'
import { scoreRung, rungSegment, workoutColourRung, workoutSlugs } from '@/lib/scoreColour'
import { gradeForRung } from '@/lib/grading'
import type { EntryVals } from '@/lib/scoring'

const supabase = createClient()

type Entry = EntryRow & { event_slug: string | null }

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
  // Domain 1 to 10, then the order planned: the same order the live game uses.
  // Array.sort is stable, so events in one domain keep their planned order.
  return [...planEvents(plan)].sort((a, b) => a.domainNumber - b.domainNumber).map(e => ({
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
  const [sheetSlug, setSheetSlug] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<{ eventName: string; label: string } | null>(null)
  const [error, setError] = useState('')
  const { self } = useActivePlayer()
  const [clientName, setClientName] = useState<string | null>(null)
  const [lastPlan, setLastPlan] = useState<string[]>([])
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('workouts')
      .select('id, player_id, performed_on, witnessed, finished_at, planned_events, notes, workout_entries(id, event_slug, raw_score, score_label, difficulty_tier, weight_kg, reps, time_seconds, distance_m, exercise_variation)')
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

  const plan = workout?.planned_events ?? []
  const events = useMemo(() => playEvents(plan), [plan])
  const { rows: prRows, reload: reloadPRs } = usePRRows(workout?.player_id ?? null, events.map(e => e.id))
  // Lifetime best per event, for the pre-fill and the "Your best" tile.
  const bestRaw = (slug: string): number | null => {
    const rs = prRows[slug] ?? []
    return rs.length > 0 ? Math.max(...rs.map(r => r.raw_score)) : null
  }
  const entriesFor = useCallback((slug: string) => entries.filter(e => e.event_slug === slug), [entries])
  const scoredSlugs = useMemo(
    () => new Set(entries.map(e => e.event_slug).filter((s): s is string => !!s)),
    [entries])
  // What colours a score: the player's ladder and the bodyweight declared for
  // the day the workout was trained. Any failure leaves the buttons neutral.
  const gradeProfile = useGradeProfile(workout?.player_id ?? null, workout?.performed_on ?? '')
  const rungFor = useCallback((slug: string) => scoreRung(
    getEventBySlug(slug), entries.filter(e => e.event_slug === slug), gradeProfile.player, gradeProfile.bodyweightKg,
  ), [entries, gradeProfile.player, gradeProfile.bodyweightKg])
  // Hidden until something is scored, as on the game screen: "Mā" beside
  // "0 of 4 scored" reads as a verdict, not an empty state.
  const workoutColour = gradeProfile.player && entries.length > 0
    ? gradeForRung(workoutColourRung(
        // workoutSlugs, not the plan alone: a scored event taken off the plan
        // still counts, exactly as play history counts it.
        workoutSlugs(plan, entries.map(e => e.event_slug))
          .map(slug => ({ ev: getEventBySlug(slug), rows: entriesFor(slug) })),
        gradeProfile.player, gradeProfile.bodyweightKg))
    : null
  const segmentFill = (ev: PlayEvent) => rungSegment(rungFor(ev.id)) ?? '#666'

  const open = workout ? isOpen(workout) : false
  const locked = !open
  // A witnessed workout is a training session a kaiwhakawā runs. Both of them
  // score in it while it is open; only the kaiwhakawā changes the plan or
  // finishes it (the database enforces the same split).
  const isJudge = self?.role === 'judge'
  const coached = !!workout?.witnessed
  const canRun = !coached || isJudge

  // Who the session is for, so the kaiwhakawā running several can tell them apart.
  useEffect(() => {
    if (!coached || !isJudge || !workout) return
    let cancelled = false
    supabase.from('players_public').select('display_name').eq('id', workout.player_id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setClientName((data as { display_name: string } | null)?.display_name ?? null) })
    return () => { cancelled = true }
  }, [coached, isJudge, workout?.player_id])

  // "Repeat last session": the previous session's events, offered on an empty one.
  const planIsEmpty = (workout?.planned_events?.length ?? 0) === 0
  useEffect(() => {
    if (!coached || !isJudge || !planIsEmpty || !workout) return
    let cancelled = false
    lastTrainingPlan(supabase, workout.player_id, workout.id).then(p => { if (!cancelled) setLastPlan(p) })
    return () => { cancelled = true }
  }, [coached, isJudge, planIsEmpty, workout?.player_id, workout?.id])


  const sheetEvent = sheetSlug ? events.find(e => e.id === sheetSlug) : undefined

  const setPlan = async (next: string[]) => {
    if (!workout) return
    const { error: e } = await supabase.from('workouts').update({ planned_events: next }).eq('id', workout.id)
    if (e) { setError(e.message); return }
    setWorkout({ ...workout, planned_events: next })
  }

  const submit = async (slug: string, v: EntryVals, editingId: string | null) => {
    const ev = getEventBySlug(slug)
    if (!ev || !workout) return { error: 'That event is no longer on the roster', isPR: false }
    const payload = entryPayload(ev, v)
    if (!payload) return { error: 'Enter a valid score first', isPR: false }
    const isPR = payload.raw_score !== undefined && isNewPR(ev, prRows[slug] ?? [], payload.raw_score, editingId ? `logged:${editingId}` : null)
    const { error: e } = editingId
      ? await supabase.from('workout_entries').update(payload).eq('id', editingId)
      : await supabase.from('workout_entries').insert({ ...payload, workout_id: workout.id })
    if (e) {
      return {
        error: e.code === '23514' ? 'One of the numbers is out of range. Check the weight, time and distance.' : e.message,
        isPR: false,
      }
    }
    await Promise.all([load(), reloadPRs()])
    return { error: null, isPR }
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
      router.push(coached ? '/judge' : '/workout/new')
      return
    }
    const { error: e } = await supabase.from('workouts').update({ finished_at: new Date().toISOString() }).eq('id', workout.id)
    if (e) { setError(e.message); return }
    router.push(coached ? '/judge' : '/history')
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
            {coached ? (isJudge && clientName ? clientName.toUpperCase() : 'TRAINING SESSION') : 'MY WORKOUT'}
          </div>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {formatNZDate(workout.performed_on)}
          </div>
        </div>
        <div style={{ margin: '10px 0 8px' }}>
          <ProgressSegments events={events} scoredIds={scoredSlugs} fillFor={segmentFill} />
        </div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 12px',
          fontFamily: 'var(--font-label)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {events.filter(e => scoredSlugs.has(e.id)).length} of {events.length} event{events.length === 1 ? '' : 's'} scored
          </span>
          {workoutColour && (
            <span data-testid="workout-colour" title="This workout's colour: each event's colour, averaged" style={{
              display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)',
            }}>
              This workout
              <GradeDot grade={workoutColour} size={10} />
              <span style={{ color: '#fff', fontWeight: 600 }}>{workoutColour.name}</span>
            </span>
          )}
        </div>
        {locked && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
            {workout.finished_at ? 'Finished.' : 'This workout is from an earlier day, so it is closed.'}{' '}
            {workout.witnessed ? 'Only a kaiwhakawā can change it.' : 'Your kaiwhakawā can still change it.'}
          </div>
        )}
      </div>

      {coached && !isJudge && open && (
        <div style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
          Your kaiwhakawā is running this session. Enter your scores here as you go.
        </div>
      )}

      {/* Strength is a ratio of bodyweight, so it is asked where the lifting
          happens rather than on a profile page nobody returns to. Renders
          nothing unless today's plan holds a ratio standard. */}
      <BodyweightField
        playerId={workout.player_id}
        eventSlugs={events.map(e => e.event_slug)}
        day={workout.performed_on}
        locked={locked}
        onSaved={gradeProfile.setBodyweightKg}
      />

      {/* One list in domain order, the same order the live game uses. Rows
          never move when scored. */}
      {events.map(ev => (
        <EventListRow
          key={ev.id}
          se={ev}
          eventData={getEventBySlug(ev.event_slug)}
          myResults={entriesFor(ev.id)}
          gradeRung={rungFor(ev.id)}
          onOpen={() => setSheetSlug(ev.id)}
        />
      ))}

      {events.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 4px' }}>
          {canRun ? 'Nothing planned yet. Add an event below.' : 'Nothing planned yet. Your kaiwhakawā will add the events.'}
        </div>
      )}

      {/* Repeat last session */}
      {!locked && canRun && coached && lastPlan.length > 0 && planIsEmpty && (
        <button type="button" onClick={() => setPlan(sortPlan(lastPlan).slice(0, PLAN_MAX))} style={{
          width: '100%', minHeight: 48, marginTop: 16, borderRadius: 999, cursor: 'pointer',
          background: '#0d1a2d', border: '1px solid #2371BB', color: '#fff',
          fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>Repeat last session ({lastPlan.length} event{lastPlan.length === 1 ? '' : 's'})</button>
      )}

      {/* Add more */}
      {!locked && canRun && (
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
      {!locked && canRun && (
        <button onClick={finish} style={{
          width: '100%', minHeight: 56, marginTop: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: entries.length > 0 ? 'var(--rainbow)' : '#151515',
          color: entries.length > 0 ? '#0a0a0a' : 'var(--text-muted)',
          fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 15, fontWeight: 600,
        }}>
          {entries.length > 0 ? (coached ? 'Finish session' : 'Finish workout') : (coached ? 'Cancel session' : 'Cancel workout')}
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
          seasonPR={bestRaw(sheetEvent.id)}
          prRows={prRows[sheetEvent.id] ?? []}
          locked={locked}
          bestLabel="Best today"
          prLabel="Your best"
          allowGames={false}
          natural
          standards={{
            player: gradeProfile.player, bodyweightKg: gradeProfile.bodyweightKg, reached: rungFor(sheetEvent.id),
            bodyweightPrompt: <BodyweightField playerId={workout.player_id} eventSlugs={[sheetEvent.event_slug]}
              day={workout.performed_on} locked={locked} onSaved={gradeProfile.setBodyweightKg} />,
          }}
          onClose={() => setSheetSlug(null)}
          onSubmit={(v, editingId) => submit(sheetEvent.id, v, editingId)}
          onDelete={remove}
          onSubmitted={(labelText) => {
            setSheetSlug(null)
            setToast({ eventName: sheetEvent.event_name, label: labelText })
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
        </div>
      )}
    </div>
  )
}
