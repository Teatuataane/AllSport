'use client'
// ─── Find a game: the list ───────────────────────────────────────────────────
// On /schedule. Rules in lib/findGame.ts, reads in lib/findGameData.ts.
// `FindAGameView` takes props only (__tests__/findAGame.test.tsx); the default
// export loads the board once and handles Join, Coming and Near me.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { findCards, mapLink, statusLabel, type FindCard } from '@/lib/findGame'
import { loadFindBoard, type FindBoard, type Lead } from '@/lib/findGameData'
import { joinWeeklyGame } from '@/lib/weeklyGamesData'
import { setBooking } from '@/lib/bookingsData'
import { answerKey, countsKey, countsLine, type BookingCounts } from '@/lib/bookings'
import { dateLabel, formatTime, DAY_NAMES } from '@/lib/weeklyGames'
import { formatMetres, type Pin } from '@/lib/sites'

type Near = 'off' | 'asking' | 'on' | 'refused'

export function FindAGameView({
  cards, signedIn, mine, coming, counts, leads, near, busy, error, onNear, onJoin, onComing, now,
}: {
  cards: FindCard[]
  signedIn: boolean
  /** Weekly games the player is registered to. */
  mine: ReadonlySet<string>
  /** One-off games the player said Yes to, by game id. */
  coming: ReadonlySet<string>
  counts: Map<string, BookingCounts> | null
  leads: Map<string, Lead>
  near: Near
  busy: string | null
  error: string
  onNear: () => void
  onJoin: (gameId: string) => void
  onComing: (gameId: string, date: string, yes: boolean) => void
  now: Date
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button type="button" className="press" onClick={onNear} disabled={near === 'asking'} aria-pressed={near === 'on'} style={{
          background: near === 'on' ? 'var(--blue)' : 'var(--surface)', color: 'var(--white)',
          border: `1px solid ${near === 'on' ? 'var(--blue)' : 'var(--border-strong)'}`, borderRadius: '999px',
          padding: '10px 18px', minHeight: '44px', cursor: 'pointer',
          fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.06em',
        }}>
          {near === 'asking' ? 'Finding you…' : near === 'on' ? 'Nearest first' : 'Near me'}
        </button>
        <span style={{ fontSize: '13px', color: 'var(--grey)' }}>
          {near === 'refused' ? 'Location is off, so soonest first.'
            : near === 'on' ? 'Your location stays on this device.' : 'Soonest first.'}
        </span>
      </div>

      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: '14px', marginBottom: '12px' }}>{error}</div>}

      {cards.length === 0 ? (
        <div style={{ color: 'var(--grey-light)', fontSize: '16px' }}>No games listed right now. Check back soon.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {cards.map(c => {
            const key = countsKey(c.game.id, c.date)
            const lead = leads.get(key)
            const line = signedIn ? countsLine(counts?.get(key)) : null
            const map = mapLink(c.site)
            const oneOff = !!c.game.one_off_date
            const status = statusLabel(c.status)
            const statusColour = c.status.cancelled ? 'var(--red)' : c.status.venue ? 'var(--amber)' : 'var(--green)'
            return (
              <li key={c.game.id} aria-label={`${c.site.name}, ${dateLabel(c.date, now)} ${formatTime(c.game.start_time)}`} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', lineHeight: 1, color: 'var(--white)' }}>{c.site.name}</div>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: statusColour, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {c.status.venue && !c.status.cancelled ? 'Moved' : status}
                  </span>
                </div>
                <div style={{ fontSize: '16px', color: 'var(--white)' }}>
                  {dateLabel(c.date, now)} {formatTime(c.game.start_time)}
                  <span style={{ color: 'var(--grey)' }}>{oneOff ? ' · one game only' : ` · every ${DAY_NAMES[c.game.dow]}`}</span>
                </div>
                {c.status.venue && !c.status.cancelled && (
                  <div style={{ fontSize: '14px', color: 'var(--amber)' }}>{c.status.venue}</div>
                )}
                {c.site.address && <div style={{ fontSize: '14px', color: 'var(--grey-light)' }}>{c.site.address}</div>}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '14px', color: 'var(--grey)' }}>
                  {map && <a href={map} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>Map</a>}
                  {c.metres != null && <span>{formatMetres(c.metres)} away</span>}
                </div>
                {signedIn && (lead || line) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '14px', color: 'var(--grey-light)' }}>
                    {lead && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span aria-hidden style={{
                          width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-label)', fontWeight: 700, color: 'var(--white)',
                        }}>{lead.name.charAt(0).toUpperCase()}</span>
                        Kaiārahi: {lead.name}
                      </span>
                    )}
                    {line && <span>{line}</span>}
                  </div>
                )}
                <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                  {!signedIn ? (
                    <Link href="/register" className="btn btn-primary" style={{ width: '100%', display: 'flex', fontSize: '15px' }}>
                      Register to play
                    </Link>
                  ) : c.status.cancelled ? null : oneOff ? (
                    <button type="button" className="press" disabled={busy === c.game.id}
                      onClick={() => onComing(c.game.id, c.date, !coming.has(c.game.id))}
                      aria-pressed={coming.has(c.game.id)} style={actionStyle(coming.has(c.game.id))}>
                      {coming.has(c.game.id) ? 'Coming' : 'I\'m coming'}
                    </button>
                  ) : mine.has(c.game.id) ? (
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '14px', color: 'var(--green)', fontWeight: 700, letterSpacing: '0.06em' }}>
                      REGISTERED
                    </div>
                  ) : (
                    <button type="button" className="press" disabled={busy === c.game.id}
                      onClick={() => onJoin(c.game.id)} style={actionStyle(false)}>
                      Join this game
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function actionStyle(on: boolean): React.CSSProperties {
  return {
    width: '100%', minHeight: '44px', borderRadius: '999px', cursor: 'pointer',
    background: on ? 'var(--green)' : 'var(--blue)', color: 'var(--white)', border: 'none',
    fontFamily: 'var(--font-label)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.06em',
  }
}

export default function FindAGame() {
  const { loading, userId } = useActivePlayer()
  // Made here, not at module level, so the props-only view can be tested
  // without a Supabase project.
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<FindBoard | null | 'none'>(null)
  const [here, setHere] = useState<Pin | null>(null)
  const [near, setNear] = useState<Near>('off')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [now] = useState(() => new Date())

  useEffect(() => {
    if (loading) return
    let gone = false
    loadFindBoard(supabase, userId, now).then(b => { if (!gone) setData(b ?? 'none') })
    return () => { gone = true }
  }, [loading, userId, now, supabase])

  if (data === null) return <div style={{ color: 'var(--grey)', fontSize: '15px' }}>Loading games…</div>
  if (data === 'none') return <div style={{ color: 'var(--grey-light)', fontSize: '16px' }}>Games could not be loaded. Try again soon.</div>

  const { board, leads } = data
  const cards = findCards({ games: board.games, sites: board.sites, notices: board.notices, now, here })
  const coming = new Set(cards.filter(c => userId && board.answers.get(answerKey(c.game.id, c.date, userId)) === 'yes').map(c => c.game.id))

  const onNear = () => {
    if (near === 'on') { setNear('off'); setHere(null); return }
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setNear('refused'); return }
    setNear('asking')
    navigator.geolocation.getCurrentPosition(
      pos => { setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNear('on') },
      () => setNear('refused'),
      { maximumAge: 600_000, timeout: 10_000 },
    )
  }

  const onJoin = async (gameId: string) => {
    if (!userId) return
    setBusy(gameId); setError('')
    const err = await joinWeeklyGame(supabase, gameId, userId, 'home')
    setBusy(null)
    if (err) { setError('Could not join. Try again.'); return }
    setData({ ...data, board: { ...board, mine: new Set([...board.mine, gameId]) } })
  }

  const onComing = async (gameId: string, date: string, yes: boolean) => {
    if (!userId) return
    setBusy(gameId); setError('')
    const err = await setBooking(supabase, gameId, date, userId, yes ? 'yes' : null)
    setBusy(null)
    if (err) { setError(err); return }
    const answers = new Map(board.answers)
    if (yes) answers.set(answerKey(gameId, date, userId), 'yes')
    else answers.delete(answerKey(gameId, date, userId))
    setData({ ...data, board: { ...board, answers } })
  }

  return (
    <FindAGameView
      cards={cards} signedIn={!!userId} mine={board.mine} coming={coming} counts={board.counts} leads={leads}
      near={near} busy={busy} error={error} onNear={onNear} onJoin={onJoin} onComing={onComing} now={now}
    />
  )
}
