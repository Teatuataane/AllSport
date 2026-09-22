'use client'

// ─── Set up a personal game ──────────────────────────────────────────────────
// What "/log" became. A player plans a workout with the SAME picker a
// kaiwhakawā uses for an official game, then plays it on the same live screen
// (app/workout/[id]). It is stored as a workout carrying a plan, never a
// sessions row: training, never ranked.
//
// Decisions (docs/designs/workout-customisation-spec.md): any number of
// events; "Draw for me" and "Copy today's official ten"; a date chip row for
// the last 7 days, so logging yesterday's session opens the same screen dated
// yesterday.
//
// The "how long" field and the free-text "something else" box were removed in
// September 2026 (Tāne's call, told what it costs): the form is events, effort
// and notes. `workouts.duration_minutes` and unfitted entries are NOT dropped —
// the column, the guards and /judge's Activity Report all still read them, so
// old logs keep their minutes and a future screen can set them again. What the
// report loses from here on is self-reported minutes and activities the roster
// has no event for; it still counts a game as GAME_MINUTES and reads any
// distance entry's own seconds.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { allowedDays, EFFORT_WORDS } from '@/lib/workouts'
import { drawPlan, planEvents, planFromEventNames, PLAN_MAX } from '@/lib/personalGame'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import EventPlanPicker from '@/components/play/EventPlanPicker'
import EventIcon from '@/components/EventIcon'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'

const supabase = createClient()

const label: React.CSSProperties = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
}
const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, marginBottom: 12,
}
const chip = (on: boolean, colour = 'var(--blue)'): React.CSSProperties => ({
  minHeight: 44, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13,
  fontFamily: 'var(--font-label)', letterSpacing: '0.04em', flexShrink: 0,
  background: on ? colour : '#151515', color: on ? '#fff' : 'var(--grey-light)',
  border: `1px solid ${on ? colour : 'var(--border)'}`,
})

const dayLabel = (day: string, today: string) => {
  if (day === today) return 'Today'
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function NewWorkoutPage() {
  const router = useRouter()
  const { loading, userId, self, activePlayerId, activePlayer } = useActivePlayer()
  const isJudge = (self as { role?: string } | null)?.role === 'judge'

  const days = allowedDays()
  const today = days[0]
  const [chosenDay, setDay] = useState<string | null>(null)
  const day = chosenDay && days.includes(chosenDay) ? chosenDay : today

  const [plan, setPlan] = useState<string[]>([])
  const [effort, setEffort] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [players, setPlayers] = useState<{ id: string; display_name: string }[]>([])
  const [forPlayer, setForPlayer] = useState<string | null>(null)
  const [officialTen, setOfficialTen] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [live, setLive] = useState(true)

  const targetId = (isJudge && forPlayer) || activePlayerId
  const events = useMemo(() => planEvents(plan), [plan])

  useEffect(() => {
    if (!loading && !userId) router.push('/play')
  }, [loading, userId, router])

  // The events of today's official game, for "Copy today's game". Its own
  // query: a game may not exist, and that is not an error.
  useEffect(() => {
    let cancelled = false
    supabase.from('sessions').select('id, session_date').eq('session_date', today).limit(1)
      .then(async ({ data }) => {
        const session = (data ?? [])[0] as { id: string } | undefined
        if (cancelled || !session) return
        const { data: evs } = await supabase.from('session_events').select('event_name').eq('session_id', session.id)
        if (cancelled) return
        const names = ((evs ?? []) as { event_name: string }[]).map(e => e.event_name)
        const slugs = planFromEventNames(names)
        if (slugs.length > 0) setOfficialTen(slugs)
      })
    return () => { cancelled = true }
  }, [today])

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

  const start = async () => {
    setError('')
    if (!targetId || !userId) return
    if (plan.length === 0) { setError('Pick at least one event.'); return }
    setBusy(true)
    const { data, error: e } = await supabase.from('workouts')
      .insert({
        player_id: targetId,
        logged_by: userId,
        performed_on: day,
        planned_events: plan,
        notes: notes.trim() || null,
        ...(effort ? { effort_rating: effort } : {}),
      })
      .select('id').single()
    setBusy(false)
    if (e || !data) {
      // 42703: planned_events is not there yet (the migration has not been
      // applied). PGRST205: no workouts table at all.
      setLive(e?.code !== '42703' && e?.code !== 'PGRST205')
      setError(
        e?.code === '42703' || e?.code === 'PGRST205' ? 'Personal games are not live yet.'
        : e?.code === '23514' ? 'That day is outside the last week. Pick another day.'
        : e?.message ?? 'The workout did not start. Try again.')
      return
    }
    // There is always a plan now, so there is always something to score.
    router.push(`/workout/${(data as { id: string }).id}`)
  }

  if (loading || !activePlayer) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading…</div>
  }

  return (
    <>
      <PlayerTabs />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 16px 48px', color: 'var(--white)' }}>
        <ViewingAsBanner />

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1, margin: '8px 0 6px', letterSpacing: '0.03em' }}>
          NEW WORKOUT
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 16px' }}>
          Plan what you are doing, then score it the same way you would at a game. What you do counts as training
          toward your next colour, and your best efforts count toward the standards.{' '}
          <Link href="/grades" style={{ color: 'var(--blue)' }}>What each colour asks →</Link>
        </p>

        {!live && (
          <div style={{ ...card, color: 'var(--text-muted)', fontSize: 14 }}>
            Personal games are not live yet. They will be once the database update is applied.
          </div>
        )}

        {/* ── Who and when ─────────────────────────────────────────────── */}
        <div style={card}>
          {isJudge && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...label, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Logging for</div>
              <select value={forPlayer ?? ''} onChange={e => setForPlayer(e.target.value || null)} aria-label="Logging for"
                style={{ width: '100%', background: '#0d0d0d', color: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', fontSize: 16, minHeight: 44 }}>
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
              <button key={d} type="button" onClick={() => setDay(d)} style={chip(day === d)}>{dayLabel(d, today)}</button>
            ))}
          </div>
        </div>

        {/* ── The plan ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPlan(drawPlan())} style={chip(false, 'var(--blue)')}>Draw me ten</button>
          {officialTen && (
            <button type="button" onClick={() => setPlan(officialTen)} style={chip(false, 'var(--blue)')}>Copy today&apos;s game</button>
          )}
          {plan.length > 0 && (
            <button type="button" onClick={() => setPlan([])} style={{ ...chip(false), background: 'none', color: 'var(--text-muted)' }}>Clear</button>
          )}
        </div>

        {events.length > 0 && (
          <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {events.map(e => (
              <span key={e.slug} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#ccc' }}>
                <EventIcon slug={e.slug} emoji={e.emoji} domainNumber={e.domainNumber} size={22} />
                {e.name}
              </span>
            ))}
          </div>
        )}

        <EventPlanPicker mode="personal" plan={plan} onChange={setPlan} />

        {/* ── How hard ─────────────────────────────────────────────────── */}
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ ...label, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>How hard (optional)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button key={n} type="button" onClick={() => setEffort(effort === n ? null : n)}
                aria-label={`${n} — ${EFFORT_WORDS[n]}`} style={{ ...chip(effort === n, 'var(--purple)'), minWidth: 44, padding: '0 10px' }}>{n}</button>
            ))}
          </div>
          {effort && <div style={{ fontSize: 12.5, color: 'var(--purple)', marginTop: 6 }}>{EFFORT_WORDS[effort]}</div>}
          <div style={{ ...label, fontSize: 11, color: 'var(--text-muted)', margin: '12px 0 6px' }}>Notes (optional)</div>
          <input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} placeholder="Anything worth remembering"
            aria-label="Notes"
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d0d', color: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', fontSize: 16, minHeight: 44 }} />
        </div>

        {error && (
          <div style={{ background: '#2e0d0d', border: '1px solid var(--red)', borderRadius: 10, padding: '12px 14px', color: 'var(--red)', fontSize: 14, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button onClick={start} disabled={busy || plan.length === 0} style={{
          width: '100%', minHeight: 58, borderRadius: 999, border: 'none',
          cursor: plan.length > 0 && !busy ? 'pointer' : 'not-allowed',
          background: plan.length > 0 ? 'var(--rainbow)' : '#1a1a1a',
          color: plan.length > 0 ? '#0a0a0a' : '#555',
          fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 16, fontWeight: 600,
        }}>
          {busy ? 'Starting…'
            : plan.length === 0 ? 'Pick your events'
            : `Start — ${plan.length} event${plan.length === 1 ? '' : 's'}`}
        </button>
        <div style={{ color: 'var(--text-muted)', fontSize: 12.5, textAlign: 'center', marginTop: 10 }}>
          Up to {PLAN_MAX} events. You can add more while you play.
        </div>
      </div>
    </>
  )
}
