'use client'

// ─── Play history ────────────────────────────────────────────────────────────
// Every session a player has played, and the earlier points-ladder colours.
// This lived on the taniwha history page until the taniwha retired with the
// grading rebuild.
//
//   1  play history — every game AND every workout, one list, newest first,
//      each with its colour (Tāne, 30 Sept 2026: solo work was a bare row in a
//      separate block below every game, with no colour, and read as missing)
//   2  the points ladder — colours really awarded under the retired points
//      system, on the dates they were earned. Points themselves are retired, so
//      no point totals are shown anywhere on this page.
//
// Honours the family switcher like every other stats page.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { formatNZDate } from '@/lib/dates'
// The retired ladder, still the source of truth for what a past award LOOKED
// like. This page is its only consumer, by design.
import { colourByRung } from '@/lib/colours'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { isPersonalGame, isOpen as workoutOpen, planEvents, historyWorkouts, mergeHistory } from '@/lib/personalGame'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import { usePlayerGames } from '@/lib/usePlayerGames'
import { gameColourRung, gamesInOrder } from '@/lib/gameReport'
import { gradeForRung, type GradeRung } from '@/lib/grading'
import { bodyweightOnDay } from '@/lib/loadGrades'
import { workoutColourRung, workoutSlugs } from '@/lib/scoreColour'
import { getEventBySlug } from '@/lib/eventData'
import { GradeDot } from '@/components/GradeDot'
import { ScoreTrend } from '@/components/GameReportParts'

const supabase = createClient()

type Summary = {
  session_id: string
  player_id: string
  overall_placement: number | null
  session_date: string
  location: string | null
}

type Award = {
  player_id: string
  rung: number
  colour_name: string
  awarded_at: string
  session_date: string | null
  location: string | null
}

/**
 * A workout of this player's, for the two blocks /log used to carry: their own
 * workouts, and the entries that were never fitted to an event. Its own query,
 * and a database without the personal-game columns (42703) or the workout
 * tables (PGRST205) simply shows neither block.
 */
type WorkoutRow = {
  id: string
  player_id: string
  performed_on: string
  finished_at: string | null
  planned_events: string[] | null
  /** Set on a workout that holds a player's swaps at an official game. */
  session_id?: string | null
  workout_entries: {
    id: string
    activity: string
    event_slug: string | null
    difficulty_tier: string | null
    raw_score: number | null
    weight_kg: number | null
  }[]
}

/** One row of the merged list. */
type HistoryItem = ReturnType<typeof mergeHistory<Summary, WorkoutRow>>[number]

type Bundle = {
  summaries: Summary[]
  awards: Award[]
}

const PAGE = 20
/** Games drawn in the colour score trend. */
const TREND_GAMES = 12

export default function HistoryPage() {
  const router = useRouter()
  const { loading, userId, familyMembers, activePlayerId, activePlayer } = useActivePlayer()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  // Keyed by player, like `paging`: after a family switch the previous
  // player's workouts must never sit in the new player's list, graded against
  // the new player's ladder, while the new query is in flight.
  const [loadedWorkouts, setWorkouts] = useState<{ id: string; rows: WorkoutRow[] } | null>(null)
  const workouts = loadedWorkouts && loadedWorkouts.id === activePlayerId ? loadedWorkouts.rows : null
  // Keyed by player, so switching players starts from the first page without
  // resetting state inside an effect.
  const [paging, setPaging] = useState<{ id: string | null; shown: number }>({ id: null, shown: PAGE })
  const shown = paging.id === activePlayerId ? paging.shown : PAGE

  useEffect(() => {
    if (!loading && !userId) router.push('/play')
  }, [loading, userId, router])

  const householdIds = useMemo(
    () => (userId ? [userId, ...familyMembers.map(m => m.id)] : []),
    [userId, familyMembers],
  )

  useEffect(() => {
    if (householdIds.length === 0) return
    let cancelled = false
    supabase.rpc('player_dashboard', { p_player_ids: householdIds }).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setBundle(data as Bundle)
    })
    return () => { cancelled = true }
    // Keyed on the ids themselves, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdIds.join(',')])

  // Workouts: own query, so a missing column or table costs this block only.
  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    supabase
      .from('workouts')
      .select('id, player_id, performed_on, finished_at, planned_events, session_id, workout_entries(id, activity, event_slug, difficulty_tier, raw_score, weight_kg)')
      .eq('player_id', activePlayerId)
      .order('performed_on', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return
        setWorkouts({ id: activePlayerId, rows: error ? [] : (data ?? []) as WorkoutRow[] })
      })
    return () => { cancelled = true }
  }, [activePlayerId])

  // Each game's colour score, for the trend and the rows. Own player only.
  const games = usePlayerGames(supabase, activePlayerId)
  const trend = useMemo(
    () => (games ? gamesInOrder(games.scores).filter(g => g.closed).slice(-TREND_GAMES).map(g => g.points) : []),
    [games],
  )

  const myWorkouts = workouts ?? []
  const soloWorkouts = useMemo(() => historyWorkouts(workouts ?? []), [workouts])
  const unfitted = myWorkouts.flatMap(w => w.workout_entries.filter(e => !e.event_slug).map(e => ({ w, e })))

  const mySummaries = useMemo(
    () => (bundle?.summaries ?? [])
      .filter(s => s.player_id === activePlayerId)
      .sort((a, b) => b.session_date.localeCompare(a.session_date)),
    [bundle, activePlayerId],
  )

  const items = useMemo<HistoryItem[]>(() => mergeHistory(
    mySummaries.map(s => ({ date: s.session_date, item: s })),
    soloWorkouts.map(w => ({ date: w.performed_on, item: w })),
  ), [mySummaries, soloWorkouts])

  // Each workout's colour, graded as the workout screen grades it. Needs the
  // player's ladder and bodyweights, which the games load already carries.
  const workoutGrade = (w: WorkoutRow): GradeRung | null => {
    if (!games) return null
    const slugs = workoutSlugs(w.planned_events, w.workout_entries.map(e => e.event_slug))
    if (slugs.length === 0 || !w.workout_entries.some(e => e.event_slug)) return null
    const rung = workoutColourRung(
      slugs.map(slug => ({
        ev: getEventBySlug(slug),
        rows: w.workout_entries.filter(e => e.event_slug === slug)
          .map(e => ({ raw_score: e.raw_score == null ? null : Number(e.raw_score), weight_kg: e.weight_kg, difficulty_tier: e.difficulty_tier })),
      })),
      games.player, bodyweightOnDay(games.inputs, w.performed_on))
    return gradeForRung(rung)
  }

  const myAwards = useMemo(
    () => (bundle?.awards ?? []).filter(a => a.player_id === activePlayerId),
    [bundle, activePlayerId],
  )

  if (loading) return <Centered>Loading…</Centered>
  if (!activePlayer) return <Centered>No player profile found.</Centered>

  return (
    <>
      <PlayerTabs />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px 40px', color: 'var(--white)' }}>
        <BackLink href="/dashboard">Play history</BackLink>
        <ViewingAsBanner />

        <Section>Every game and workout</Section>
        {trend.length >= 2 && <div style={{ marginBottom: 10 }}><ScoreTrend points={trend} /></div>}
        <Panel>
          {!bundle || workouts === null ? (
            <Empty>Loading…</Empty>
          ) : items.length === 0 ? (
            <Empty>No games or workouts yet.</Empty>
          ) : (
            items.slice(0, shown).map(item => item.kind === 'game' ? (() => {
              const s = item.item
              return (
                <Row key={`g-${s.session_id}`}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: s.overall_placement === 1 ? 'rgba(249,176,81,0.13)' : '#1a1a1a',
                    border: `1px solid ${s.overall_placement === 1 ? 'rgba(249,176,81,0.33)' : 'var(--border-strong)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: 17,
                    color: s.overall_placement === 1 ? 'var(--amber)' : '#999',
                  }}>
                    {s.overall_placement ? ordinalShort(s.overall_placement) : '—'}
                  </div>
                  <Link href={`/games/${s.session_id}`} style={{ flexGrow: 1, minWidth: 0, color: 'inherit' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNZDate(s.session_date)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {s.location ?? 'AllSport HQ'}
                    </div>
                  </Link>
                  {(() => {
                    const points = games?.scores.get(s.session_id)?.points
                    if (points == null) return null
                    return <ColourTag grade={gradeForRung(gameColourRung(points))} />
                  })()}
                  <RowLink href={`/games/${s.session_id}`}>Report ›</RowLink>
                </Row>
              )
            })() : (() => {
              const w = item.item
              const open = isPersonalGame(w) && workoutOpen(w)
              const planned = planEvents(w.planned_events ?? []).length
              const scored = new Set(w.workout_entries.map(e => e.event_slug).filter(Boolean)).size
              const grade = workoutGrade(w)
              return (
                <Row key={`w-${w.id}`}>
                  <div aria-hidden style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: 'rgba(184,125,181,0.10)', border: '1px solid rgba(184,125,181,0.30)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14" /><path d="M5 12h14" /><rect x="3" y="3" width="18" height="18" rx="4" />
                    </svg>
                  </div>
                  <Link href={`/workout/${w.id}`} style={{ flexGrow: 1, minWidth: 0, color: 'inherit' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNZDate(w.performed_on)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Workout · {planned > 0
                        ? `${scored} of ${planned} scored`
                        : `${w.workout_entries.length} entr${w.workout_entries.length === 1 ? 'y' : 'ies'}`}
                    </div>
                  </Link>
                  {grade && <ColourTag grade={grade} />}
                  {open
                    ? <RowLink href={`/workout/${w.id}`} colour="var(--green)">Continue ›</RowLink>
                    : isPersonalGame(w) ? <RowLink href={`/workout/${w.id}`}>View ›</RowLink> : null}
                </Row>
              )
            })())
          )}
          {items.length > shown && (
            <button onClick={() => setPaging({ id: activePlayerId, shown: shown + PAGE })} style={{
              width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '13px 0', color: 'var(--blue)',
              fontFamily: 'var(--font-label)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: 600, fontSize: 12,
            }}>
              Show all {items.length}
            </button>
          )}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
            <Link href="/workout/new" style={{
              fontFamily: 'var(--font-label)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: 600, fontSize: 12, color: 'var(--purple)',
            }}>Log a workout →</Link>
          </div>
        </Panel>

        {/* Entries logged before the picker existed, which never earned
            anything because they were never fitted to an event. */}
        {unfitted.length > 0 && (
          <>
            <Section>Not fitted to an event</Section>
            <Panel>
              {unfitted.slice(0, 10).map(({ w, e }) => (
                <Row key={e.id}>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{e.activity}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatNZDate(w.performed_on)}</div>
                  </div>
                </Row>
              ))}
              <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5, padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                These were typed in before workouts were planned from the event list, so they earned no training.
                Log them again from the event list to have them count.
              </div>
            </Panel>
          </>
        )}

        {myAwards.length > 0 && (
          <>
            <Section>Earlier colours · points ladder</Section>
            <Panel>
              {myAwards.map(a => {
                // lib/colours.ts survives precisely so this row can be the
                // colour it commemorates.
                const c = colourByRung(a.rung)
                return (
                  <Row key={a.rung}>
                    <div style={{
                      width: 11, height: 11, borderRadius: 999, flexShrink: 0,
                      background: c ? (c.accent.startsWith('linear-gradient') ? undefined : c.accent) : 'var(--grey)',
                      backgroundImage: c?.accent.startsWith('linear-gradient') ? c.accent : undefined,
                      border: c?.english.toLowerCase() === 'white' ? '1px solid #333' : undefined,
                    }} />
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.04em' }}>
                        {a.colour_name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                        {a.session_date ? formatNZDate(a.session_date) : formatNZDate(a.awarded_at.slice(0, 10))}
                        {a.location ? ` · ${a.location}` : ''}
                      </div>
                    </div>
                  </Row>
                )
              })}
              <div style={{
                fontSize: 11, color: '#444', lineHeight: 1.5,
                padding: '12px 14px', borderTop: '1px solid var(--border)',
              }}>
                Earned under the points ladder AllSport used until September 2026, on the dates you
                earned them. Kept as history. Today&apos;s colours are earned against standards.
              </div>
            </Panel>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Link href="/dashboard" style={{
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 600, fontSize: 12, color: 'var(--blue)',
          }}>
            Your colours now →
          </Link>
        </div>
      </div>
    </>
  )
}

function ColourTag({ grade }: { grade: GradeRung }) {
  return (
    <div title={`Played at ${grade.name}`} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <GradeDot grade={grade} size={10} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.04em' }}>{grade.name}</span>
    </div>
  )
}

function RowLink({ href, colour = 'var(--text-muted)', children }: { href: string; colour?: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      flexShrink: 0, color: colour, fontFamily: 'var(--font-label)',
      textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </Link>
  )
}

function ordinalShort(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return (n + (s[(v - 20) % 10] || s[v] || s[0])).toUpperCase()
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
      {children}
    </div>
  )
}

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      color: 'var(--white)', textDecoration: 'none',
    }}>
      <span style={{ color: 'var(--grey)', fontSize: 19, lineHeight: 1 }}>‹</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.05em' }}>
        {String(children).toUpperCase()}
      </span>
    </Link>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase',
      letterSpacing: '0.14em', fontWeight: 600, fontSize: 11,
      color: 'var(--text-muted)', margin: '18px 0 10px',
    }}>
      {children}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      {children}
    </div>
  )
}
