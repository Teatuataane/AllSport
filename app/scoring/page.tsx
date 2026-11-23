'use client'

// ─── New official game ───────────────────────────────────────────────────────
// A Kaiārahi picks which game this is (a game they may start, or a pop-up)
// and one event per domain, and starts it. The picker is
// the SAME component a player uses to set up a personal game
// (components/play/EventPlanPicker), so setting up a workout and setting up a
// game are one experience — the first thing the September 2026 customisation
// review asked for.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { DOMAIN_ORDER } from '@/lib/eventData'
import { DOMAIN_COLORS } from '@/lib/domainColours'
import { sessionStart } from '@/lib/dates'
import { drawPlan, planEvents } from '@/lib/personalGame'
import EventPlanPicker from '@/components/play/EventPlanPicker'
import { loadWeeklyBoard, gamesV2Live, createGame, createSite, type WeeklyBoard } from '@/lib/weeklyGamesData'
import { matchWeeklyGame, nzWallClock, startableGames } from '@/lib/weeklyGames'
import { loadOwnKaiarahi } from '@/lib/kaiarahiData'
import { startableToday, rosterWindow, type RosterRow } from '@/lib/roster'
import { loadRoster } from '@/lib/rosterData'
import GamePicker, { choiceReady, type GameChoice } from '@/components/play/GamePicker'
import type { Pin } from '@/lib/sites'
import { LIVE_GAME_COLUMNS, gameAlreadyLive, liveOnly, type LiveGameRow } from '@/lib/liveGames'

export default function ScoringSetup() {
  const router = useRouter()
  const [location, setLocation] = useState('AllSport HQ')
  const [isChampionship, setIsChampionship] = useState(false)
  const [startTime, setStartTime] = useState(() => {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  })
  const [plan, setPlan] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Which game this is. Since 20261123035106 every session belongs to a game
  // (MULTI_LOCATION_PLAN.md): one this Kaiārahi may start, or a pop-up made
  // here. Pre-picked by weekday and start time. Null board = not live yet.
  const [weekly, setWeekly] = useState<WeeklyBoard | null>(null)
  const [mine, setMine] = useState<{ id: string; level: 'head' | 'staff' | 'community' | null; checksCurrent: boolean } | null>(null)
  const [choice, setChoice] = useState<GameChoice>(null)
  const [here, setHere] = useState<Pin | null>(null)
  const [locating, setLocating] = useState(false)
  // Today's roster (20261123202226): who leads which game. Null before it is
  // live, when the older rule (startableGames) decides.
  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const user = await getSessionUser()
      const today = nzWallClock(new Date()).date
      const [b, me, r] = await Promise.all([
        loadWeeklyBoard(supabase, null),
        user
          ? supabase.from('players').select('role').eq('id', user.id).maybeSingle()
              .then(res => loadOwnKaiarahi(supabase, user.id, (res.data as { role?: string } | null)?.role, today))
          : Promise.resolve(null),
        loadRoster(supabase, rosterWindow(new Date()).from, today),
      ])
      if (cancelled) return
      setWeekly(b)
      setRoster(r)
      if (user && me) setMine({ id: user.id, ...me })
      if (!b || !user || !me) return
      const who = { id: user.id, ...me }
      const startable = r ? startableToday(b.games, who, r, today) : startableGames(b.games, who)
      const match = matchWeeklyGame(startable, new Date())
      if (match) {
        setChoice({ kind: 'game', gameId: match.id })
        const site = b.sites.find(s => s.id === match.site_id)
        if (site) setLocation(site.name)
      }
    })().catch(() => {})
    return () => { cancelled = true }
  }, [])
  const v2 = gamesV2Live(weekly)
  const startable = !weekly || !mine ? []
    : roster ? startableToday(weekly.games, mine, roster, nzWallClock(new Date()).date)
    : startableGames(weekly.games, mine)
  const pick = (c: GameChoice) => {
    setChoice(c)
    const siteId = c?.kind === 'game' ? weekly?.games.find(g => g.id === c.gameId)?.site_id
      : c?.kind === 'popup' && c.popup.kind === 'site' ? c.popup.siteId : undefined
    const site = siteId ? weekly?.sites.find(s => s.id === siteId) : undefined
    if (site) setLocation(site.name)
    else if (c?.kind === 'popup' && c.popup.kind === 'new-site' && c.popup.name.trim()) setLocation(c.popup.name.trim())
  }
  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setError('This phone cannot share where it is. Paste a map link instead.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      () => { setLocating(false); setError('Could not find where you are. Paste a map link instead.') },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }
  // Before the migration a game may still be started with no weekly game.
  const gameReady = v2 ? choiceReady(choice) : true

  const events = planEvents(plan)
  const allSelected = events.length === 10

  const handleStart = async () => {
    if (!allSelected || !gameReady) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()

      // Several games may be live at once (v0.64.0.0), but not the same game
      // twice: two sessions of one game would split its players and places.
      if (choice?.kind === 'game') {
        const { data: live } = await supabase.from('sessions')
          .select(LIVE_GAME_COLUMNS).eq('is_active', true).eq('weekly_game_id', choice.gameId)
        if (gameAlreadyLive(liveOnly((live ?? []) as LiveGameRow[]), choice.gameId)) {
          setError('That game is already on. Open it from HOME, or end it first.')
          setLoading(false)
          return
        }
      }

      // started_at and session_date come from ONE derivation so they cannot
      // disagree — deriving the date separately from toISOString() is what
      // stamped every NZ morning game with the previous day. See sessionStart.
      const { startedAt: started, sessionDate: today } = sessionStart(startTime)

      const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Which game. A pop-up makes its site (if new) and a one-off community
      // game for today first; the database stamps created_by on both, and
      // can_start_game() lets the creator start it.
      let gameId: string | null = choice?.kind === 'game' ? choice.gameId : null
      let place = location
      if (v2 && choice?.kind === 'popup') {
        let siteId = choice.popup.kind === 'site' ? choice.popup.siteId : ''
        if (choice.popup.kind === 'new-site') {
          const made = await createSite(supabase, {
            name: choice.popup.name, address: choice.popup.address,
            lat: choice.popup.pin?.lat ?? null, lng: choice.popup.pin?.lng ?? null,
          })
          if ('error' in made) throw new Error(made.error)
          siteId = made.id
          place = choice.popup.name.trim()
        }
        const game = await createGame(supabase, {
          site_id: siteId, dow: nzWallClock(started).dow, start_time: startTime + ':00',
          one_off_date: today, kind: 'community', listed: choice.popup.listed, two_adults: false,
        })
        if ('error' in game) throw new Error(game.error)
        gameId = game.id
      }

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          session_date: today,
          start_time: startTime + ':00',
          location: place,
          is_championship: isChampionship,
          is_active: true,
          started_at: started.toISOString(),
          session_code: sessionCode,
          // Only sent when chosen: before the v0.54 migration the column does
          // not exist and sending it would refuse the whole insert (42703).
          // Since 20261123035106 it is required, and gameReady makes sure.
          ...(gameId ? { weekly_game_id: gameId } : {}),
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const eventsToInsert = events.map(ev => ({
        session_id: session.id,
        domain_number: ev.domainNumber,
        domain_name: ev.domain,
        event_name: ev.name,
        event_slug: ev.slug,
        input_mode: ev.inputMode,
        display_order: ev.domainNumber,
      }))

      const { error: eventsError } = await supabase
        .from('session_events')
        .insert(eventsToInsert)

      if (eventsError) throw eventsError

      router.push(`/scoring/${session.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#2371BB', lineHeight: 1 }}>New Game</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Select one event per domain</div>
          </div>
          {/* Progress ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {DOMAIN_ORDER.map((_, i) => (
                <div key={i} style={{
                  width: '6px', height: '24px', borderRadius: '3px', transition: 'background 0.2s',
                  background: events.some(e => e.domainNumber === i + 1) ? DOMAIN_COLORS[i] : '#222',
                }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: allSelected ? '#4DB26E' : '#555' }}>
              {events.length}/10
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px' }}>
        {/* Session config */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: v2 ? 'auto' : '1fr auto', gap: '12px' }}>
            {/* Once every game has a site, the site names the location. */}
            {!v2 && <div>
              <label htmlFor="location" style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '11px', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Location</label>
              <input
                id="location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '16px', fontFamily: 'var(--font-body)', boxSizing: 'border-box' as const, minHeight: '44px' }}
              />
            </div>}
            <div>
              <label htmlFor="start-time" style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '11px', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Start Time</label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '16px', fontFamily: 'var(--font-body)', minHeight: '44px', colorScheme: 'dark' as const }}
              />
            </div>
          </div>
          {weekly && (v2 || weekly.games.length > 0) && (
            <GamePicker
              games={v2 ? startable : weekly.games}
              sites={weekly.sites}
              choice={choice}
              onChange={pick}
              canPopUp={v2}
              here={here}
              onLocate={locate}
              locating={locating}
            />
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isChampionship}
              onChange={e => setIsChampionship(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#F9B051' }}
            />
            <div>
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', color: isChampionship ? '#F9B051' : '#ccc' }}>Championship Game</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#555' }}>Marks this game as the annual Championship</div>
            </div>
          </label>
        </div>

        {/* Draw — the same shortcut a personal game offers */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPlan(drawPlan())} style={{
            minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
            background: '#151515', border: '1px solid #2a2a2a', color: '#fff',
            fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Draw for me</button>
          {plan.length > 0 && (
            <button type="button" onClick={() => setPlan([])} style={{
              minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
              background: 'none', border: '1px solid #2a2a2a', color: '#888',
              fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Clear</button>
          )}
        </div>

        <EventPlanPicker mode="official" plan={plan} onChange={setPlan} />

        {error && (
          <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '12px 16px', color: '#EA4742', fontSize: '14px', fontFamily: 'var(--font-body)', margin: '16px 0' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!allSelected || !gameReady || loading}
          style={{
            width: '100%', marginTop: '24px', padding: '18px', borderRadius: '10px', border: 'none',
            cursor: allSelected && gameReady && !loading ? 'pointer' : 'not-allowed',
            background: allSelected && gameReady ? 'linear-gradient(90deg, #2371BB, #EA4742)' : '#1a1a1a',
            color: allSelected && gameReady ? '#fff' : '#444',
            fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.1em',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Starting game...' : !gameReady ? 'Choose which game' : allSelected ? 'Start Game →' : `Select ${10 - events.length} more event${10 - events.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
