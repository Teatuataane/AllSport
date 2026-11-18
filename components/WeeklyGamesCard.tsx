// ─── HOME: weekly games ──────────────────────────────────────────────────────
// A player registers once to a weekly game and hears about every date of it
// (Tāne, 18 Nov 2026). This card lists each site's weekly games with the next
// date, whether that date is on, cancelled or moved, the kaiwhakawā's notices,
// and Join / Leave / "Can't make it". Registering is never needed to play.
//
// Props only (no Supabase) so it is component-tested; the page does the writes.

import type { ReactNode } from 'react'
import type { PushState } from '@/lib/noticeDelivery'
import {
  dateLabel, dayStatus, nextGameDate, slotLabel, sortWeekly,
  type GameNotice, type Site, type WeeklyGame,
} from '@/lib/weeklyGames'

export type WeeklyGamesCardProps = {
  sites: Site[]
  games: WeeklyGame[]
  notices: GameNotice[]
  mine: Set<string>
  /** `${gameId}|${date}` the player will miss. */
  away: Set<string>
  now?: Date
  /** Whose registration this is when a parent is viewing a child. */
  who?: string | null
  /** The game id a write is in flight for; its buttons wait. */
  busy?: string | null
  error?: string
  onJoin: (gameId: string) => void
  onLeave: (gameId: string) => void
  onAway: (gameId: string, date: string, away: boolean) => void
  /** This phone's notices (v0.55.0.0). Absent = not offered (no VAPID key yet). */
  push?: {
    state: PushState
    busy: boolean
    error: string
    onTurnOn: () => void
    onTurnOff: () => void
  }
}

const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.12em', fontWeight: 600, fontSize: 12,
}

export default function WeeklyGamesCard({
  sites, games, notices, mine, away, now = new Date(), who, busy, error, onJoin, onLeave, onAway, push,
}: WeeklyGamesCardProps) {
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
          ? 'You hear here about every game you have joined: rain calls, a change of park, notes from the kaiwhakawā.'
          : 'Join the games you usually come to and you will hear here if one is cancelled or moved. Walk-ups are always welcome.'}
      </p>
      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0' }}>{error}</div>}
      {registered && push && <PushStrip {...push} />}

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
              joined={mine.has(g.id)} away={away} busy={busy === g.id}
              onJoin={onJoin} onLeave={onLeave} onAway={onAway}
            />
          ))}
        </div>
      ))}
    </section>
  )
}

function GameRow({ game, notices, now, joined, away, busy, onJoin, onLeave, onAway }: {
  game: WeeklyGame
  notices: GameNotice[]
  now: Date
  joined: boolean
  away: Set<string>
  busy: boolean
  onJoin: (gameId: string) => void
  onLeave: (gameId: string) => void
  onAway: (gameId: string, date: string, away: boolean) => void
}) {
  const date = nextGameDate(game, now)
  const day = dateLabel(date, now)
  // 'today', 'tomorrow' or 'Sat 21 Nov', for the middle of a sentence.
  const when = day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day
  const status = dayStatus(game.id, date, notices)
  const isAway = away.has(`${game.id}|${date}`)
  const news = status.cancelled || status.venue || status.notices.length > 0

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
            {joined && isAway && !status.cancelled && <Chip tone="grey">You are away</Chip>}
          </div>
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

      {joined && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {!status.cancelled && (
            <TextButton disabled={busy} onClick={() => onAway(game.id, date, !isAway)}>
              {isAway ? `I can come ${when} after all` : `Can't make it ${when}`}
            </TextButton>
          )}
          <TextButton disabled={busy} onClick={() => onLeave(game.id)} muted>Leave this weekly game</TextButton>
        </div>
      )}
    </div>
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

/**
 * How notices reach this phone. A player with no phone that takes push is
 * emailed instead (app/api/notices/send), so every state says what happens.
 */
export function PushStrip({ state, busy, error, onTurnOn, onTurnOff }: NonNullable<WeeklyGamesCardProps['push']>) {
  const text: Record<PushState, string> = {
    off: 'Get notices on this phone the moment the kaiwhakawā sends one. Until then they come by email.',
    on: 'Notices are on for this phone.',
    'ios-install': 'On iPhone, notices need AllSport on your Home Screen: tap Share, then Add to Home Screen, and open it from there. Until then they come by email.',
    denied: 'Notices are blocked for AllSport in this browser\'s settings, so they come by email.',
    unsupported: 'This browser cannot show notices, so they come by email.',
  }
  return (
    <div data-testid="push-strip" style={{
      marginTop: 10, padding: '10px 12px', borderRadius: 10,
      border: `1px solid ${state === 'on' ? 'var(--green)' : 'var(--border-strong)'}`,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, color: 'var(--grey-light)', lineHeight: 1.45, flex: '1 1 200px' }}>{text[state]}</span>
      {state === 'off' && (
        <button type="button" className="press" disabled={busy} onClick={onTurnOn} style={{
          ...label, fontSize: 13, color: '#0a0a0a', background: 'var(--blue)', border: 'none',
          borderRadius: 999, padding: '0 16px', minHeight: 40, cursor: 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          Turn on notices
        </button>
      )}
      {state === 'on' && <TextButton disabled={busy} onClick={onTurnOff} muted>Turn off</TextButton>}
      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, width: '100%' }}>{error}</div>}
    </div>
  )
}
