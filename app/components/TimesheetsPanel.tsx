'use client'

// ─── Kaiārahi panel: timesheets ──────────────────────────────────────────────
// Multi-location games step 12. Rules in lib/timesheets.ts, reads and writes in
// lib/timesheetsData.ts, database 20261124223426_timesheets.sql.
//
//   · A Kaimahi sees their own lines for the fortnight and can query one.
//   · A Kaiwhakawā sees everyone's, settles held lines (Pay or Don't pay, with
//     an answer and corrected minutes), adds a missing line, approves the
//     fortnight once it has ended, and downloads two CSVs.
//
// `TimesheetsView` takes props only (__tests__/timesheetsPanel.test.tsx).
// Hidden until the migration is live, and for a Kaiako (never paid).

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { nzWallClock, addDays, type WeeklyGame } from '@/lib/weeklyGames'
import { loadWeeklyBoard } from '@/lib/weeklyGamesData'
import { loadDirectory, type DirectoryRow } from '@/lib/rosterData'
import {
  byPerson, canQuery, csvByKaiarahi, csvByProgramme, defaultPeriod, formatMinutes, HELD_LABEL, lineStatus,
  PAY_ANCHOR, periodEnd, periodEnded, periodStart as periodStartOf, ROLE_LABEL, STATUS_LABEL, summarise, type Role, type TimesheetLine,
} from '@/lib/timesheets'
import { addLine, approvePeriod, loadPeriod, queryLine, settleLine } from '@/lib/timesheetsData'

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, color: '#777',
  letterSpacing: '0.12em', textTransform: 'uppercase',
}
const inputStyle: CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8,
  padding: '10px 12px', color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)',
  boxSizing: 'border-box', minHeight: 44, colorScheme: 'dark',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "8 Feb" from "2027-02-08". */
export function shortDate(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${day} ${MONTHS[m - 1]}`
}

const STATUS_COLOUR = { approved: 'var(--green)', ready: 'var(--blue)', held: 'var(--amber)', unpaid: '#888' } as const

export type AddInput = { playerId: string; gameId: string; date: string; role: Role; minutes: number | null; note: string }

export function TimesheetsView({
  start, today, lines, head, busy, error, people, games,
  onPeriod, onQuery, onSettle, onApprove, onDownload, onAdd,
}: {
  start: string
  today: string
  lines: TimesheetLine[]
  head: boolean
  busy: string | null
  error: string
  /** Kaimahi and Kaiwhakawā, for adding a line (head only). */
  people: DirectoryRow[]
  /** Funded games, for adding a line (head only). */
  games: { game: WeeklyGame; label: string }[]
  onPeriod: (start: string) => void
  onQuery: (lineId: string, note: string) => void
  onSettle: (lineId: string, pay: boolean, minutes: number | null, answer: string) => void
  onApprove: () => void
  onDownload: (kind: 'kaiarahi' | 'programme') => void
  onAdd: (a: AddInput) => void
}) {
  const s = summarise(lines)
  const ended = periodEnded(start, today)
  const groups = head ? byPerson(lines) : [{ key: 'me', label: '', lines }]

  return (
    <div id="timesheets" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', lineHeight: 1 }}>Timesheets</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <SmallButton disabled={start <= addDays(today, -366) || !!busy} onClick={() => onPeriod(addDays(start, -14))} label="Earlier fortnight">‹</SmallButton>
        <div style={{ flexGrow: 1, textAlign: 'center', fontSize: 15, fontWeight: 600 }}>
          {shortDate(start)} to {shortDate(periodEnd(start))}
        </div>
        <SmallButton disabled={addDays(start, 14) > today || !!busy} onClick={() => onPeriod(addDays(start, 14))} label="Later fortnight">›</SmallButton>
      </div>
      {start < PAY_ANCHOR && (
        <div style={{ fontSize: 13, color: '#777', marginTop: 6, textAlign: 'center' }}>Pay fortnights start on 8 Feb 2027.</div>
      )}

      <div style={{ fontSize: 13, color: '#aaa', marginTop: 12 }}>
        {lines.length === 0 ? 'No lines this fortnight.' : [
          s.ready && `${s.ready} ready`, s.held && `${s.held} held`, s.approved && `${s.approved} approved`,
          s.unpaid && `${s.unpaid} not paid`, formatMinutes(s.minutes),
        ].filter(Boolean).join(' · ')}
      </div>

      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}

      {head && lines.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <SmallButton primary="green" disabled={!ended || s.ready === 0 || !!busy} onClick={onApprove}>
            {busy === 'approve' ? 'Approving…' : `Approve ${s.ready || ''} ready`.trim()}
          </SmallButton>
          <SmallButton disabled={s.approved === 0} onClick={() => onDownload('kaiarahi')}>Per Kaiārahi CSV</SmallButton>
          <SmallButton disabled={s.approved === 0} onClick={() => onDownload('programme')}>Per programme CSV</SmallButton>
        </div>
      )}
      {head && lines.length > 0 && !ended && (
        <div style={{ fontSize: 13, color: '#777', marginTop: 8 }}>Approve once the fortnight has ended.</div>
      )}

      {groups.map(g => (
        <div key={g.key} style={{ marginTop: 16 }}>
          {head && <div style={labelStyle}>{g.label}</div>}
          {g.lines.map(l => (
            <LineRow key={l.id} line={l} head={head} busy={busy} onQuery={onQuery} onSettle={onSettle} />
          ))}
        </div>
      ))}

      {head && <AddLine people={people} games={games} today={today} busy={busy} onAdd={onAdd} />}

      <p style={{ fontSize: 13, color: '#777', margin: '14px 0 0', lineHeight: 1.5 }}>
        {head
          ? 'A funded game makes a line for its lead and second adult when it starts. Held lines wait for you: a query, or a game nobody scored in.'
          : 'A line is made when you start a funded game, or are its second adult. Query a line if something is wrong; it waits until the Kaiwhakawā answers.'}
      </p>
    </div>
  )
}

function LineRow({ line: l, head, busy, onQuery, onSettle }: {
  line: TimesheetLine
  head: boolean
  busy: string | null
  onQuery: (lineId: string, note: string) => void
  onSettle: (lineId: string, pay: boolean, minutes: number | null, answer: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [mins, setMins] = useState(String(l.minutes))
  const st = lineStatus(l)
  const settleable = head && !l.approved_at
  const why = l.held ? HELD_LABEL[l.held] : null
  const minutes = Number(mins)
  const minutesOk = Number.isInteger(minutes) && minutes >= 0 && minutes <= 600

  return (
    <div style={{ borderTop: '1px solid #1e1e1e', padding: '10px 0', marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {shortDate(l.game_date)} · {l.site_name ?? 'Game'} · {formatMinutes(l.minutes)}
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {ROLE_LABEL[l.role]}{l.programme_name ? ` · ${l.programme_name}` : ''}
            {l.source === 'manual' ? ' · added by hand' : ` · ${l.players} played`}
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: STATUS_COLOUR[st], whiteSpace: 'nowrap',
        }}>{why ?? STATUS_LABEL[st]}</span>
      </div>

      {l.query_note && <div style={{ fontSize: 13, color: 'var(--amber)', marginTop: 6 }}>Query: {l.query_note}</div>}
      {l.answer && <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Answer: {l.answer}</div>}

      {!open && (head ? settleable && (l.held || st === 'ready') : canQuery(l)) && (
        <div style={{ marginTop: 8 }}>
          <SmallButton disabled={!!busy} onClick={() => setOpen(true)}>{head ? (l.held ? 'Decide' : 'Change') : 'Query'}</SmallButton>
        </div>
      )}

      {open && !head && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <input aria-label="What is wrong with this line" placeholder="What is wrong? (wrong game, hours, not me…)"
            value={note} maxLength={280} style={inputStyle} onChange={e => setNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <SmallButton primary="blue" disabled={!note.trim() || !!busy} onClick={() => { onQuery(l.id, note); setOpen(false); setNote('') }}>Send query</SmallButton>
            <SmallButton onClick={() => setOpen(false)}>Back</SmallButton>
          </div>
        </div>
      )}

      {open && head && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: '#aaa', whiteSpace: 'nowrap' }} htmlFor={`mins-${l.id}`}>Minutes</label>
            <input id={`mins-${l.id}`} inputMode="numeric" value={mins} style={{ ...inputStyle, width: 100 }}
              onChange={e => setMins(e.target.value.replace(/\D/g, ''))} />
          </div>
          <input aria-label="Answer (optional)" placeholder="Answer (optional, the Kaimahi sees it)"
            value={note} maxLength={280} style={inputStyle} onChange={e => setNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <SmallButton primary="green" disabled={!minutesOk || !!busy}
              onClick={() => { onSettle(l.id, true, minutes === l.minutes ? null : minutes, note); setOpen(false) }}>Pay</SmallButton>
            <SmallButton primary="red" disabled={!!busy}
              onClick={() => { onSettle(l.id, false, null, note); setOpen(false) }}>Don&apos;t pay</SmallButton>
            <SmallButton onClick={() => setOpen(false)}>Back</SmallButton>
          </div>
        </div>
      )}
    </div>
  )
}

function AddLine({ people, games, today, busy, onAdd }: {
  people: DirectoryRow[]
  games: { game: WeeklyGame; label: string }[]
  today: string
  busy: string | null
  onAdd: (a: AddInput) => void
}) {
  const [open, setOpen] = useState(false)
  const [a, setA] = useState<AddInput>({ playerId: '', gameId: '', date: today, role: 'lead', minutes: null, note: '' })
  if (!open) {
    return (
      <div style={{ marginTop: 16 }}>
        <SmallButton disabled={!!busy || games.length === 0} onClick={() => setOpen(true)}>Add a missing line</SmallButton>
      </div>
    )
  }
  const ready = a.playerId && a.gameId && a.date && a.date <= today
  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={labelStyle}>Add a missing line</div>
      <select aria-label="Who" value={a.playerId} onChange={e => setA({ ...a, playerId: e.target.value })} style={inputStyle}>
        <option value="">Who</option>
        {people.map(p => <option key={p.player_id} value={p.player_id}>{p.display_name}</option>)}
      </select>
      <select aria-label="Game" value={a.gameId} onChange={e => setA({ ...a, gameId: e.target.value })} style={inputStyle}>
        <option value="">Which game</option>
        {games.map(g => <option key={g.game.id} value={g.game.id}>{g.label}</option>)}
      </select>
      <input aria-label="Date" type="date" value={a.date} max={today} style={inputStyle} onChange={e => setA({ ...a, date: e.target.value })} />
      <select aria-label="Role" value={a.role} onChange={e => setA({ ...a, role: e.target.value as Role })} style={inputStyle}>
        <option value="lead">Lead</option>
        <option value="second">Second adult</option>
      </select>
      <input aria-label="Minutes (blank: the game's block)" placeholder="Minutes (blank: the game's block)" inputMode="numeric"
        value={a.minutes ?? ''} style={inputStyle}
        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setA({ ...a, minutes: v ? Number(v) : null }) }} />
      <input aria-label="Note (optional)" placeholder="Note (optional)" value={a.note} maxLength={280} style={inputStyle}
        onChange={e => setA({ ...a, note: e.target.value })} />
      <div style={{ display: 'flex', gap: 8 }}>
        <SmallButton primary="blue" disabled={!ready || !!busy} onClick={() => { onAdd(a); setOpen(false) }}>Add line</SmallButton>
        <SmallButton onClick={() => setOpen(false)}>Back</SmallButton>
      </div>
    </div>
  )
}

function SmallButton({ children, onClick, disabled, primary, label }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; primary?: 'blue' | 'red' | 'green'; label?: string
}) {
  const bg = primary === 'red' ? 'var(--red)' : primary === 'green' ? 'var(--green)' : primary === 'blue' ? 'var(--blue)' : 'transparent'
  return (
    <button type="button" className="press" onClick={onClick} disabled={disabled} aria-label={label} style={{
      background: bg, color: primary ? '#0a0a0a' : '#ddd',
      border: primary ? 'none' : '1px solid #333', borderRadius: 999, padding: '0 14px', minHeight: 38,
      fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
      textTransform: 'uppercase', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, flexShrink: 0,
    }}>
      {children}
    </button>
  )
}

/** Hand the browser a CSV to save. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Extras = { people: DirectoryRow[]; games: { game: WeeklyGame; label: string }[] }

export default function TimesheetsPanel({ head }: { head: boolean }) {
  const [supabase] = useState(() => createClient())
  const [today] = useState(() => nzWallClock(new Date()).date)
  const [start, setStart] = useState(() => defaultPeriod(nzWallClock(new Date()).date))
  const [lines, setLines] = useState<TimesheetLine[] | null | undefined>(undefined)
  const [extras, setExtras] = useState<Extras>({ people: [], games: [] })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let gone = false
    loadPeriod(supabase, start).then(l => { if (!gone) setLines(l) })
    return () => { gone = true }
  }, [supabase, start])

  useEffect(() => {
    if (!head) return
    let gone = false
    Promise.all([loadDirectory(supabase), loadWeeklyBoard(supabase, null)]).then(([dir, board]) => {
      if (gone) return
      const site = (id: string) => board?.sites.find(s => s.id === id)?.name ?? ''
      setExtras({
        people: (dir ?? []).filter(d => d.level === 'head' || d.level === 'staff'),
        games: (board?.games ?? []).filter(g => g.kind === 'funded').map(g => ({ game: g, label: site(g.site_id) })),
      })
    })
    return () => { gone = true }
  }, [supabase, head])

  const act = useCallback(async (key: string, run: () => Promise<string | null>) => {
    setBusy(key); setError('')
    const err = await run()
    if (err) setError(err)
    setLines(await loadPeriod(supabase, start))
    setBusy(null)
  }, [supabase, start])

  // Not live yet, or a Kaiako with no lines and nothing to do here.
  if (lines === undefined || lines === null) return null

  return (
    <TimesheetsView
      start={start} today={today} lines={lines} head={head} busy={busy} error={error}
      people={extras.people} games={extras.games}
      onPeriod={s => { setError(''); setStart(s) }}
      onQuery={(id, note) => act(`q-${id}`, () => queryLine(supabase, id, note))}
      onSettle={(id, pay, mins, answer) => act(`s-${id}`, () => settleLine(supabase, id, pay, mins, answer))}
      onApprove={() => act('approve', async () => {
        const r = await approvePeriod(supabase, start)
        return 'error' in r ? r.error : null
      })}
      onDownload={kind => download(
        `allsport-hours-${kind === 'kaiarahi' ? 'per-kaiarahi' : 'per-programme'}-${start}.csv`,
        kind === 'kaiarahi' ? csvByKaiarahi(lines, start) : csvByProgramme(lines, start),
      )}
      onAdd={a => act('add', async () => {
        const err = await addLine(supabase, a)
        if (!err && periodStartOf(a.date) !== start) setStart(periodStartOf(a.date))
        return err
      })}
    />
  )
}
