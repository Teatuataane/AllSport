// ─── HOME: weekly games ──────────────────────────────────────────────────────
// A player registers once to a weekly game and hears about every date of it
// (Tāne, 18 Nov 2026). This card lists each site's weekly games with the next
// date, whether that date is on, cancelled or moved, the kaiwhakawā's notices,
// and Join / Leave. Registering is never needed to play.
//
// Step 8 (bookings): under each joined game, "Coming tomorrow? Yes / Not this
// time" for the next date, for the player and, when a parent views their own
// HOME, each child registered to it, plus the counts ("6 coming · 3 not").
// It stands out from 4pm the day before, when the question is asked. Until
// the bookings migration is applied the old "Can't make it" stays.
//
// Props only (no Supabase) so it is component-tested; the page does the writes.

import type { ReactNode } from 'react'
import {
  dateLabel, dayStatus, nextGameDate, slotLabel, sortWeekly,
  type GameNotice, type Site, type WeeklyGame,
} from '@/lib/weeklyGames'
import {
  answerKey, askOpen, canAnswer, countsKey, countsLine, nextAnswer, questionLabel,
  type Answer, type BookingCounts,
} from '@/lib/bookings'

/** A child a parent may answer for, and the games the child is registered to. */
export type FamilyEntry = { id: string; name: string; games: Set<string> }

export type WeeklyGamesCardProps = {
  sites: Site[]
  games: WeeklyGame[]
  notices: GameNotice[]
  mine: Set<string>
  /** Whose card this is (the active player). */
  playerId: string
  /** Children the viewer answers for too (a parent on their own HOME). */
  family?: FamilyEntry[]
  /** By answerKey(game, date, player). */
  answers: Map<string, Answer>
  /** False before the bookings migration: only "Can't make it" works. */
  bookingsLive?: boolean
  /** By countsKey(game, date); null or missing: no counts shown. */
  counts?: Map<string, BookingCounts> | null
  now?: Date
  /** Whose registration this is when a parent is viewing a child. */
  who?: string | null
  /** The game id a write is in flight for; its buttons wait. */
  busy?: string | null
  error?: string
  onJoin: (gameId: string) => void
  onLeave: (gameId: string) => void
  onAnswer: (gameId: string, date: string, playerId: string, answer: Answer | null) => void
}

const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.12em', fontWeight: 600, fontSize: 12,
}

export default function WeeklyGamesCard({
  sites, games: allGames, notices, mine, playerId, family = [], answers, bookingsLive = true, counts, now = new Date(),
  who, busy, error, onJoin, onLeave, onAnswer,
}: WeeklyGamesCardProps) {
  // Weekly games only (a one-off is found on Find a game), and an unlisted one
  // (a school game) only for someone in the household registered to it.
  const games = allGames.filter(g => !g.one_off_date
    && (g.listed !== false || mine.has(g.id) || family.some(f => f.games.has(g.id))))
  if (games.length === 0) return null
  const bySite = [...sites].sort((a, b) => a.name.localeCompare(b.name))
    .map(site => ({ site, games: sortWeekly(games.filter(g => g.site_id === site.id)) }))
    .filter(s => s.games.length > 0)
  const registered = games.some(g => mine.has(g.id))

  return (
    <section aria-label="Weekly games" style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      padding: '16px 16px 6px', margin: '16px 0 18px',
    }}>
      <div style={{ ...label, color: 'var(--text-muted)' }}>
        {who ? `${who}'s weekly games` : 'Weekly games'}
      </div>
      <p style={{ fontSize: 13, color: 'var(--grey-light)', lineHeight: 1.5, margin: '6px 0 4px' }}>
        {registered
          ? 'You hear here about every game you have joined: rain calls, a change of park, notes from the Kaiārahi.'
          : 'Join the games you usually come to and you will hear here if one is cancelled or moved. Walk-ups are always welcome.'}
      </p>
      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0' }}>{error}</div>}

      {bySite.map(({ site, games: siteGames }) => (
        <div key={site.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.04em', color: 'var(--white)' }}>
              {site.name}
            </span>
            {site.address && (
              site.map_url
                ? <a href={site.map_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--blue-light)' }}>{site.address}</a>
                : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{site.address}</span>
            )}
          </div>
          {siteGames.map(g => (
            <GameRow
              key={g.id} game={g} notices={notices} now={now}
              joined={mine.has(g.id)} playerId={playerId} family={family} answers={answers}
              bookingsLive={bookingsLive} counts={counts ?? null} busy={busy === g.id}
              onJoin={onJoin} onLeave={onLeave} onAnswer={onAnswer}
            />
          ))}
        </div>
      ))}
    </section>
  )
}

function GameRow({
  game, notices, now, joined, playerId, family, answers, bookingsLive, counts, busy, onJoin, onLeave, onAnswer,
}: {
  game: WeeklyGame
  notices: GameNotice[]
  now: Date
  joined: boolean
  playerId: string
  family: FamilyEntry[]
  answers: Map<string, Answer>
  bookingsLive: boolean
  counts: Map<string, BookingCounts> | null
  busy: boolean
  onJoin: (gameId: string) => void
  onLeave: (gameId: string) => void
  onAnswer: (gameId: string, date: string, playerId: string, answer: Answer | null) => void
}) {
  const date = nextGameDate(game, now)
  const day = dateLabel(date, now)
  // 'today', 'tomorrow' or 'Sat 21 Nov', for the middle of a sentence.
  const when = day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day
  const status = dayStatus(game.id, date, notices)
  const myAnswer = answers.get(answerKey(game.id, date, playerId))
  const isAway = myAnswer === 'no'
  const news = status.cancelled || status.venue || status.notices.length > 0
  // Everyone in the household registered to this game answers for this date.
  const people = [
    ...(joined ? [{ id: playerId, name: 'You' }] : []),
    ...family.filter(f => f.games.has(game.id)).map(f => ({ id: f.id, name: f.name })),
  ]
  const answering = bookingsLive && !status.cancelled && people.length > 0 && canAnswer(game, date, now)
  const asking = answering && askOpen(game, date, now) && people.some(p => !answers.has(answerKey(game.id, date, p.id)))
  const tally = status.cancelled ? null : countsLine(counts?.get(countsKey(game.id, date)))

  return (
    <div data-testid={`weekly-game-${game.id}`} style={{
      padding: '12px 0', borderTop: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flexGrow: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>{slotLabel(game)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Next: {day}</span>
            {status.cancelled && <Chip tone="red">Cancelled</Chip>}
            {!status.cancelled && status.venue && <Chip tone="amber">Moved</Chip>}
            {joined && isAway && !status.cancelled && <Chip tone="grey">Not coming</Chip>}
          </div>
          {tally && <div style={{ fontSize: 12.5, color: 'var(--grey-light)', marginTop: 3 }}>{tally}</div>}
        </div>
        {joined ? (
          <span style={{
            ...label, color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 999,
            padding: '7px 12px', flexShrink: 0,
          }}>
            Joined
          </span>
        ) : (
          <button type="button" className="press" disabled={busy} onClick={() => onJoin(game.id)} style={{
            ...label, fontSize: 13, color: '#0a0a0a', background: 'var(--blue)', border: 'none',
            borderRadius: 999, padding: '0 18px', minHeight: 40, cursor: 'pointer', flexShrink: 0,
            opacity: busy ? 0.6 : 1,
          }}>
            Join
          </button>
        )}
      </div>

      {news && (
        <div style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10,
          background: status.cancelled ? 'var(--red-tint)' : 'var(--amber-tint)',
          border: `1px solid ${status.cancelled ? 'var(--red)' : 'var(--amber)'}`,
        }}>
          {status.cancelled && (
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)' }}>{day}&rsquo;s game is cancelled.</div>
          )}
          {status.venue && (
            <div style={{ fontSize: 14, color: 'var(--white)', marginTop: status.cancelled ? 4 : 0 }}>
              <b style={{ fontWeight: 600 }}>Where:</b> {status.venue}
            </div>
          )}
          {status.notices.filter(n => n.kind !== 'moved' && (n.message ?? '').trim()).map(n => (
            <div key={n.id} style={{ fontSize: 13.5, color: 'var(--grey-light)', marginTop: 4, lineHeight: 1.45 }}>
              {n.message}
            </div>
          ))}
        </div>
      )}

      {answering && (
        <div aria-label={questionLabel(date, now)} role="group" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10,
          border: `1px solid ${asking ? 'var(--blue)' : 'var(--border)'}`,
          background: asking ? 'var(--blue-tint)' : 'transparent',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)' }}>{questionLabel(date, now)}</div>
          {people.map(p => {
            const current = answers.get(answerKey(game.id, date, p.id))
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {people.length > 1 && (
                  <span style={{ fontSize: 13.5, color: 'var(--grey-light)', minWidth: 72, flexGrow: 1 }}>{p.name}</span>
                )}
                <AnswerButton label="Yes" chosen={current === 'yes'} disabled={busy}
                  name={people.length > 1 ? `${p.name}: Yes` : undefined}
                  onClick={() => onAnswer(game.id, date, p.id, nextAnswer(current, 'yes'))} />
                <AnswerButton label="Not this time" chosen={current === 'no'} disabled={busy}
                  name={people.length > 1 ? `${p.name}: Not this time` : undefined}
                  onClick={() => onAnswer(game.id, date, p.id, nextAnswer(current, 'no'))} />
              </div>
            )
          })}
        </div>
      )}

      {joined && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {!bookingsLive && !status.cancelled && (
            <TextButton disabled={busy} onClick={() => onAnswer(game.id, date, playerId, isAway ? null : 'no')}>
              {isAway ? `I can come ${when} after all` : `Can't make it ${when}`}
            </TextButton>
          )}
          <TextButton disabled={busy} onClick={() => onLeave(game.id)} muted>Leave this weekly game</TextButton>
        </div>
      )}
    </div>
  )
}

function AnswerButton({ label: text, chosen, disabled, name, onClick }: {
  label: string; chosen: boolean; disabled?: boolean; name?: string; onClick: () => void
}) {
  return (
    <button type="button" className="press" aria-pressed={chosen} aria-label={name} disabled={disabled} onClick={onClick} style={{
      ...label, fontSize: 13, minHeight: 40, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
      color: chosen ? '#0a0a0a' : 'var(--white)',
      background: chosen ? (text === 'Yes' ? 'var(--green)' : 'var(--grey-light)') : 'transparent',
      border: `1px solid ${chosen ? 'transparent' : 'var(--border)'}`,
      opacity: disabled ? 0.6 : 1,
    }}>
      {text}
    </button>
  )
}

function Chip({ tone, children }: { tone: 'red' | 'amber' | 'grey'; children: ReactNode }) {
  const color = tone === 'red' ? 'var(--red)' : tone === 'amber' ? 'var(--amber)' : 'var(--grey-light)'
  return (
    <span style={{ ...label, fontSize: 12, color, border: `1px solid ${color}`, borderRadius: 999, padding: '1px 8px' }}>
      {children}
    </span>
  )
}

function TextButton({ children, onClick, disabled, muted }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; muted?: boolean
}) {
  return (
    <button type="button" className="press" onClick={onClick} disabled={disabled} style={{
      background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
      fontSize: 13, color: muted ? 'var(--text-muted)' : 'var(--blue-light)',
      textDecoration: 'underline', textUnderlineOffset: 3, opacity: disabled ? 0.6 : 1,
    }}>
      {children}
    </button>
  )
}
