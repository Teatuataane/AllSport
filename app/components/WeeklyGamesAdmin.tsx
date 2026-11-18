'use client'

// ─── Kaiwhakawā: weekly games ────────────────────────────────────────────────
// Who is registered to each weekly game, and the buttons that tell them about
// its next date: Cancel (rain), Change park, Message, and Back on. Each one
// writes a game_notices row; HOME shows it to every registered player (phase 1)
// and phase 2 will push and email the same row. Also adds sites and weekly
// games, so a second site is a form here, not a code change.
//
// Hidden until migration 20261118010039 is live.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  DAY_NAMES, dateLabel, dayStatus, nextGameDate, slotLabel, sortWeekly, type NoticeKind, type WeeklyGame,
} from '@/lib/weeklyGames'
import {
  loadWeeklyBoard, loadRosters, postNotice, deleteNotice, type RosterRow, type WeeklyBoard,
} from '@/lib/weeklyGamesData'

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

type Composer = { gameId: string; kind: Exclude<NoticeKind, 'on'>; text: string }

const PROMPTS: Record<Composer['kind'], { button: string; placeholder: string; start: string }> = {
  cancelled: { button: 'Cancel game', placeholder: 'Why (optional)', start: 'Cancelled because of rain.' },
  moved: { button: 'Send where', placeholder: 'e.g. Jellie Park, by the pavilion', start: '' },
  message: { button: 'Send message', placeholder: 'What players need to know', start: '' },
}

export default function WeeklyGamesAdmin({ judgeId }: { judgeId: string }) {
  const [board, setBoard] = useState<WeeklyBoard | null | undefined>(undefined)
  const [rosters, setRosters] = useState<Map<string, RosterRow[]>>(new Map())
  const [open, setOpen] = useState<string | null>(null)
  const [composer, setComposer] = useState<Composer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState<'site' | 'game' | null>(null)

  const reload = useCallback(async () => {
    const b = await loadWeeklyBoard(supabase, null)
    setBoard(b)
    if (b) setRosters(await loadRosters(supabase, b.games))
  }, [])

  useEffect(() => {
    let cancelled = false
    loadWeeklyBoard(supabase, null).then(async b => {
      if (cancelled) return
      setBoard(b)
      if (!b) return
      const r = await loadRosters(supabase, b.games)
      if (!cancelled) setRosters(r)
    }).catch(() => { if (!cancelled) setBoard(null) })
    return () => { cancelled = true }
  }, [])

  if (board === undefined || board === null) return null

  const send = async (gameId: string, date: string, kind: NoticeKind, text: string | null) => {
    setBusy(true)
    setError('')
    const err = await postNotice(supabase, gameId, date, kind, text, judgeId)
    setBusy(false)
    if (err) { setError(`Not sent: ${err}`); return }
    setComposer(null)
    await reload()
  }

  const remove = async (id: string) => {
    setBusy(true)
    const err = await deleteNotice(supabase, id)
    setBusy(false)
    if (err) { setError(`Not removed: ${err}`); return }
    await reload()
  }

  const sites = [...board.sites].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', lineHeight: 1 }}>
        Weekly games
      </div>
      <p style={{ fontSize: 13, color: '#888', lineHeight: 1.5, margin: '6px 0 0' }}>
        A notice goes to everyone registered to that weekly game, about its next date. They see it on HOME.
      </p>
      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}

      {sites.map(site => {
        const games = sortWeekly(board.games.filter(g => g.site_id === site.id))
        return (
          <div key={site.id} style={{ marginTop: 18 }}>
            <div style={labelStyle}>{site.name}{site.address ? ` · ${site.address}` : ''}</div>
            {games.length === 0 && <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>No weekly games yet.</div>}
            {games.map(g => (
              <GameAdminRow
                key={g.id} game={g} board={board} roster={rosters.get(g.id) ?? []}
                open={open === g.id} onToggle={() => setOpen(o => (o === g.id ? null : g.id))}
                composer={composer?.gameId === g.id ? composer : null}
                setComposer={setComposer} busy={busy} onSend={send} onRemove={remove}
                onRetire={async () => {
                  setBusy(true)
                  const { error: e } = await supabase.from('weekly_games').update({ is_active: false }).eq('id', g.id)
                  setBusy(false)
                  if (e) setError(`Not stopped: ${e.message}`)
                  else await reload()
                }}
              />
            ))}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <SmallButton onClick={() => setAdding(a => (a === 'game' ? null : 'game'))}>+ Weekly game</SmallButton>
        <SmallButton onClick={() => setAdding(a => (a === 'site' ? null : 'site'))}>+ Site</SmallButton>
      </div>
      {adding === 'site' && (
        <AddSite onDone={async msg => { if (msg) setError(msg); else { setAdding(null); await reload() } }} />
      )}
      {adding === 'game' && (
        <AddGame sites={sites} onDone={async msg => { if (msg) setError(msg); else { setAdding(null); await reload() } }} />
      )}
    </div>
  )
}

function GameAdminRow({
  game, board, roster, open, onToggle, composer, setComposer, busy, onSend, onRemove, onRetire,
}: {
  game: WeeklyGame
  board: WeeklyBoard
  roster: RosterRow[]
  open: boolean
  onToggle: () => void
  composer: Composer | null
  setComposer: (c: Composer | null) => void
  busy: boolean
  onSend: (gameId: string, date: string, kind: NoticeKind, text: string | null) => void
  onRemove: (id: string) => void
  onRetire: () => void
}) {
  const [retireArmed, setRetireArmed] = useState(false)
  const date = nextGameDate(game)
  const day = dateLabel(date)
  const status = dayStatus(game.id, date, board.notices)
  const awayCount = roster.filter(r => r.away).length
  const all = board.notices
    .filter(n => n.weekly_game_id === game.id && n.game_date === date)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return (
    <div style={{ borderTop: '1px solid #1e1e1e', padding: '12px 0', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{slotLabel(game)}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            Next: {day} · {roster.length} registered{awayCount ? ` (${awayCount} away)` : ''}
            {status.cancelled && <b style={{ color: 'var(--red)', fontWeight: 600 }}> · Cancelled</b>}
            {!status.cancelled && status.venue && <b style={{ color: 'var(--amber)', fontWeight: 600 }}> · Moved</b>}
          </div>
        </div>
        <SmallButton onClick={onToggle}>{open ? 'Hide' : 'Who'}</SmallButton>
      </div>

      {open && (
        <div style={{ fontSize: 13, color: '#bbb', marginTop: 8, lineHeight: 1.7 }}>
          {roster.length === 0 ? 'Nobody registered yet.' : roster.map(r => (
            <span key={r.player_id} style={{ display: 'inline-block', marginRight: 12, color: r.away ? '#666' : '#ddd' }}>
              {r.name}{r.away ? ' (away)' : ''}
            </span>
          ))}
        </div>
      )}

      {all.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {all.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, color: '#ccc', marginTop: 4 }}>
              <span style={{ ...labelStyle, fontSize: 12, color: n.kind === 'cancelled' ? 'var(--red)' : n.kind === 'on' ? 'var(--green)' : 'var(--amber)' }}>
                {n.kind === 'cancelled' ? 'Cancelled' : n.kind === 'on' ? 'Back on' : n.kind === 'moved' ? 'Where' : 'Note'}
              </span>
              <span style={{ flexGrow: 1 }}>{n.message}</span>
              <button type="button" disabled={busy} onClick={() => onRemove(n.id)} style={{
                background: 'none', border: 'none', color: '#777', cursor: 'pointer', fontSize: 12, textDecoration: 'underline',
              }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {composer ? (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            aria-label={PROMPTS[composer.kind].placeholder}
            value={composer.text} maxLength={280} autoFocus
            placeholder={PROMPTS[composer.kind].placeholder}
            onChange={e => setComposer({ ...composer, text: e.target.value })}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <SmallButton
              primary={composer.kind === 'cancelled' ? 'red' : 'blue'}
              disabled={busy || (composer.kind !== 'cancelled' && !composer.text.trim())}
              onClick={() => onSend(game.id, date, composer.kind, composer.text)}
            >
              {PROMPTS[composer.kind].button} ({day})
            </SmallButton>
            <SmallButton onClick={() => setComposer(null)}>Back</SmallButton>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {status.cancelled
            ? <SmallButton primary="green" disabled={busy} onClick={() => onSend(game.id, date, 'on', null)}>Back on</SmallButton>
            : <SmallButton onClick={() => setComposer({ gameId: game.id, kind: 'cancelled', text: PROMPTS.cancelled.start })}>Cancel (rain)</SmallButton>}
          <SmallButton onClick={() => setComposer({ gameId: game.id, kind: 'moved', text: '' })}>Change park</SmallButton>
          <SmallButton onClick={() => setComposer({ gameId: game.id, kind: 'message', text: '' })}>Message</SmallButton>
          <SmallButton disabled={busy} onClick={() => {
            if (retireArmed) { setRetireArmed(false); onRetire() } else {
              setRetireArmed(true)
              setTimeout(() => setRetireArmed(false), 3000)
            }
          }}>
            {retireArmed ? 'Tap again to stop it' : 'Stop weekly game'}
          </SmallButton>
        </div>
      )}
    </div>
  )
}

function AddSite({ onDone }: { onDone: (error: string | null) => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const mapOk = !mapUrl.trim() || mapUrl.trim().startsWith('https://')
  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('sites').insert({
      name: name.trim(), address: address.trim() || null, map_url: mapUrl.trim() || null,
    })
    setBusy(false)
    onDone(error ? `Site not added: ${error.message}` : null)
  }
  return (
    <FormBox>
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} maxLength={80} style={inputStyle} /></Field>
      <Field label="Address"><input value={address} onChange={e => setAddress(e.target.value)} maxLength={200} style={inputStyle} /></Field>
      <Field label="Map link (https, optional)"><input value={mapUrl} onChange={e => setMapUrl(e.target.value)} style={inputStyle} /></Field>
      <SmallButton primary="blue" disabled={busy || !name.trim() || !mapOk} onClick={save}>Add site</SmallButton>
    </FormBox>
  )
}

function AddGame({ sites, onDone }: { sites: WeeklyBoard['sites']; onDone: (error: string | null) => void }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [dow, setDow] = useState(6)
  const [time, setTime] = useState('09:00')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('weekly_games').insert({ site_id: siteId, dow, start_time: time })
    setBusy(false)
    onDone(error
      ? (error.code === '23505' ? 'That site already has a game at that day and time.' : `Not added: ${error.message}`)
      : null)
  }
  return (
    <FormBox>
      <Field label="Site">
        <select value={siteId} onChange={e => setSiteId(e.target.value)} style={inputStyle}>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        <Field label="Day">
          <select value={dow} onChange={e => setDow(Number(e.target.value))} style={inputStyle}>
            {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Start">
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <SmallButton primary="blue" disabled={busy || !siteId || !time} onClick={save}>Add weekly game</SmallButton>
    </FormBox>
  )
}

function FormBox({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 12, padding: 14, border: '1px solid #2a2a2a', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
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
      textTransform: 'uppercase', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  )
}
