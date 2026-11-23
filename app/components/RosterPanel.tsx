'use client'

// ─── Kaiārahi panel: roster and cover ────────────────────────────────────────
// For every Kaiārahi:
//   - Covers needed: games someone asked cover for, that you may lead. The
//     first to claim takes it; the Kaiwhakawā does not approve.
//   - Your games: the dates you lead in the next four weeks, each with Need
//     cover (or Undo).
// For a Kaiwhakawā, also:
//   - Unfilled: covers nobody has claimed 48 hours out (a warning) and 4 hours
//     out (decide: roster someone, or cancel and players are told).
//
// Alerts live here and on HOME for now (Tāne, 24 Nov 2026); push and email
// will send the same ones once that branch lands. Hidden until
// 20261123202226 is live.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { loadWeeklyBoard, gamesV2Live, postNotice, type WeeklyBoard } from '@/lib/weeklyGamesData'
import { addDays, dateLabel, formatTime, nextGameDate, nzWallClock, sortWeekly, type WeeklyGame } from '@/lib/weeklyGames'
import { loadOwnKaiarahi } from '@/lib/kaiarahiData'
import {
  canLeadGame, leadFor, leadRow, openCovers, rosterWindow, unfilledAlerts, untilLabel, type Me, type RosterRow,
} from '@/lib/roster'
import {
  claimCover, loadDirectory, loadRoster, releaseCover, requestCover, rosterLead, type DirectoryRow,
} from '@/lib/rosterData'
import { LEVEL_NAME } from '@/lib/kaiarahi'

const supabase = createClient()

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, color: '#777',
  letterSpacing: '0.12em', textTransform: 'uppercase',
}
const inputStyle: CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8,
  padding: '10px 12px', color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)',
  boxSizing: 'border-box', minHeight: 44, colorScheme: 'dark',
}

type Loaded = { board: WeeklyBoard; roster: RosterRow[]; directory: DirectoryRow[]; me: Me }

/** The dates of this game in [from, to]: a one-off its date, a weekly game every week. */
function datesOf(game: WeeklyGame, from: string, to: string, now: Date): string[] {
  if (game.one_off_date) return game.one_off_date >= from && game.one_off_date <= to ? [game.one_off_date] : []
  const out: string[] = []
  for (let d = nextGameDate(game, now); d <= to; d = addDays(d, 7)) out.push(d)
  return out
}

export default function RosterPanel() {
  const [data, setData] = useState<Loaded | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState<{ gameId: string; date: string; note: string } | null>(null)

  const load = useCallback(async (): Promise<Loaded | null> => {
    const user = await getSessionUser()
    if (!user) return null
    const now = new Date()
    const { from, to } = rosterWindow(now)
    const roleRes = await supabase.from('players').select('role').eq('id', user.id).maybeSingle()
    const [board, roster, directory, own] = await Promise.all([
      loadWeeklyBoard(supabase, null),
      loadRoster(supabase, from, to),
      loadDirectory(supabase),
      loadOwnKaiarahi(supabase, user.id, (roleRes.data as { role?: string } | null)?.role, nzWallClock(now).date),
    ])
    if (!board || !gamesV2Live(board) || roster === null || directory === null || !own.level) return null
    return { board, roster, directory, me: { id: user.id, ...own } }
  }, [])

  useEffect(() => {
    let cancelled = false
    load().then(d => { if (!cancelled) setData(d) }).catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [load])

  if (!data) return null
  const { board, roster, directory, me } = data
  const now = new Date()
  const { from, to } = rosterWindow(now)
  const siteName = (g: WeeklyGame) => board.sites.find(s => s.id === g.site_id)?.name ?? ''
  const nameOf = (id: string | null) => directory.find(d => d.player_id === id)?.display_name ?? 'Nobody'
  const when = (g: WeeklyGame, date: string) => `${dateLabel(date, now)} ${formatTime(g.start_time)} · ${siteName(g)}`

  const act = async (key: string, run: () => Promise<string | null>) => {
    setBusy(key)
    setError('')
    const err = await run()
    if (err) { setError(err); setBusy(null); return }
    setData(await load())
    setBusy(null)
  }

  const covers = openCovers(board.games, roster, me, now)
  const alerts = me.level === 'head' ? unfilledAlerts(board.games, roster, now) : []

  // The dates I lead, or asked cover for, in the window.
  const mine: { game: WeeklyGame; date: string; row: RosterRow | null }[] = []
  for (const g of sortWeekly(board.games)) {
    for (const date of datesOf(g, from, to, now)) {
      const row = leadRow(roster, g.id, date)
      const leads = leadFor(g, date, roster) === me.id
      const asked = row?.status === 'cover_needed' && row.player_id === me.id
      if (leads || asked) mine.push({ game: g, date, row })
    }
  }
  mine.sort((a, b) => a.date.localeCompare(b.date) || a.game.start_time.localeCompare(b.game.start_time))

  return (
    <div id="covers" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', lineHeight: 1 }}>Roster</div>
      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}

      {alerts.length > 0 && (
        <Section title="Unfilled">
          {alerts.map(a => (
            <UnfilledRow
              key={a.row.id} alert={a} label={when(a.game, a.date)} busy={busy}
              directory={directory.filter(d => canLeadGame({ level: d.level, checksCurrent: d.funded_ok }, a.game))}
              onRoster={pid => act(`r-${a.row.id}`, () => rosterLead(supabase, a.game.id, a.date, pid))}
              onCancel={() => act(`c-${a.row.id}`, () =>
                postNotice(supabase, a.game.id, a.date, 'cancelled', 'No Kaiārahi could cover this game.', me.id, 'no_kaiarahi'))}
            />
          ))}
        </Section>
      )}

      <Section title="Covers needed">
        {covers.length === 0 && <Empty>No covers needed.</Empty>}
        {covers.map(c => (
          <Row key={c.row.id} main={when(c.game, c.date)}
            sub={`${nameOf(c.row.player_id)} asked · ${untilLabel(c.minutes)}${c.row.note ? ` · ${c.row.note}` : ''}`}>
            <SmallButton primary="green" disabled={!!busy} onClick={() => act(`claim-${c.row.id}`, () => claimCover(supabase, c.game.id, c.date))}>
              {busy === `claim-${c.row.id}` ? 'Claiming…' : 'Claim'}
            </SmallButton>
          </Row>
        ))}
      </Section>

      <Section title="Your games">
        {mine.length === 0 && <Empty>You are not rostered on any game in the next four weeks.</Empty>}
        {mine.map(({ game, date, row }) => {
          const key = `${game.id}|${date}`
          const asked = row?.status === 'cover_needed'
          const covering = row?.status === 'covered' && row.claimed_by === me.id
          return (
            <div key={key}>
              <Row main={when(game, date)}
                sub={asked ? 'Cover asked for: waiting for someone to claim it' : covering ? 'You are covering this one' : 'You lead this one'}>
                {asked || covering ? (
                  <SmallButton disabled={!!busy} onClick={() => act(key, () => releaseCover(supabase, game.id, date))}>
                    {asked ? 'I can do it after all' : 'Give it back'}
                  </SmallButton>
                ) : asking?.gameId === game.id && asking.date === date ? null : (
                  <SmallButton disabled={!!busy} onClick={() => setAsking({ gameId: game.id, date, note: '' })}>Need cover</SmallButton>
                )}
              </Row>
              {asking?.gameId === game.id && asking.date === date && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 0 10px' }}>
                  <input aria-label="Note for whoever covers (optional)" placeholder="Note for whoever covers (optional)"
                    value={asking.note} maxLength={280} style={inputStyle}
                    onChange={e => setAsking({ ...asking, note: e.target.value })} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SmallButton primary="blue" disabled={!!busy}
                      onClick={() => act(key, async () => {
                        const err = await requestCover(supabase, game.id, date, asking.note)
                        if (!err) setAsking(null)
                        return err
                      })}>Ask for cover</SmallButton>
                    <SmallButton onClick={() => setAsking(null)}>Back</SmallButton>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Section>
      <p style={{ fontSize: 13, color: '#777', margin: '14px 0 0', lineHeight: 1.5 }}>
        You are {me.level ? LEVEL_NAME[me.level] : 'a Kaiārahi'}. {me.level === 'community'
          ? 'You can cover community games.'
          : me.checksCurrent ? 'You can cover funded and community games.' : 'Funded games need current vetting and first aid; ask a Kaiwhakawā to record yours.'}
      </p>
    </div>
  )
}

function UnfilledRow({ alert, label, directory, busy, onRoster, onCancel }: {
  alert: ReturnType<typeof unfilledAlerts>[number]
  label: string
  directory: DirectoryRow[]
  busy: string | null
  onRoster: (playerId: string) => void
  onCancel: () => void
}) {
  const [pick, setPick] = useState('')
  const [armed, setArmed] = useState(false)
  const decide = alert.stage === 'decide'
  return (
    <div style={{ border: `1px solid ${decide ? 'var(--red)' : 'var(--amber)'}`, borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: decide ? 'var(--red)' : 'var(--amber)', marginTop: 2 }}>
        Nobody has claimed it · starts {untilLabel(alert.minutes)}{decide ? ' · roster someone or cancel' : ''}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <select aria-label="Who covers it" value={pick} onChange={e => setPick(e.target.value)} style={{ ...inputStyle, width: 'auto', flexGrow: 1 }}>
          <option value="">Choose who covers it</option>
          {directory.map(d => <option key={d.player_id} value={d.player_id}>{d.display_name} · {LEVEL_NAME[d.level]}</option>)}
        </select>
        <SmallButton primary="blue" disabled={!pick || !!busy} onClick={() => onRoster(pick)}>Roster</SmallButton>
        <SmallButton primary={armed ? 'red' : undefined} disabled={!!busy} onClick={() => {
          if (armed) { setArmed(false); onCancel() } else { setArmed(true); setTimeout(() => setArmed(false), 3000) }
        }}>{armed ? 'Tap again to cancel it' : 'Cancel game'}</SmallButton>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={labelStyle}>{title}</div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>{children}</div>
}

function Row({ main, sub, children }: { main: string; sub: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #1e1e1e', padding: '10px 0', marginTop: 6 }}>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{main}</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </div>
  )
}

function SmallButton({ children, onClick, disabled, primary }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; primary?: 'blue' | 'red' | 'green'
}) {
  const bg = primary === 'red' ? 'var(--red)' : primary === 'green' ? 'var(--green)' : primary === 'blue' ? 'var(--blue)' : 'transparent'
  return (
    <button type="button" className="press" onClick={onClick} disabled={disabled} style={{
      background: bg, color: primary ? '#0a0a0a' : '#ddd',
      border: primary ? 'none' : '1px solid #333', borderRadius: 999, padding: '0 14px', minHeight: 38,
      fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
      textTransform: 'uppercase', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, flexShrink: 0,
    }}>
      {children}
    </button>
  )
}
