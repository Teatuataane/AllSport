'use client'

// ─── Kaiārahi panel: games ───────────────────────────────────────────────────
// Who is registered to each game, and the buttons that tell them about its next
// date: Cancel (rain), Change park, Message, and Back on. Each one writes a
// game_notices row; HOME shows it to every registered player. Also adds sites
// and games, so a new site is a form here, not a code change.
//
// By level (20261123035106, MULTI_LOCATION_PLAN.md §2): a Kaiwhakawā (head)
// sees every game, manages programmes and makes funded games; any other
// Kaiārahi sees and manages only the community games they made
// (public.manages_game). The database refuses anything else; this only hides it.
//
// Hidden until migration 20261118010039 is live.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  DAY_NAMES, dateLabel, dayStatus, nextGameDate, slotLabel, sortWeekly, type NoticeKind, type WeeklyGame,
} from '@/lib/weeklyGames'
import {
  loadWeeklyBoard, loadRosters, postNotice, deleteNotice, gamesV2Live, loadProgrammes, createProgramme,
  createGame, createSite, type Programme, type RosterRow, type WeeklyBoard,
} from '@/lib/weeklyGamesData'
import { gameKind, nzWallClock, isOneOff } from '@/lib/weeklyGames'
import { pinFromMapUrl } from '@/lib/sites'
import { NOTICE_REASONS, REASON_LABEL, canLeadGame, reasonReady, type NoticeReason } from '@/lib/roster'
import { loadDirectory, setRegular, type DirectoryRow } from '@/lib/rosterData'
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

// A cancel or a move needs a reason since 20261123202226 (MULTI_LOCATION_PLAN.md
// "Cancelling and moving"); Other needs a note.
type Composer = { gameId: string; kind: Exclude<NoticeKind, 'on'>; text: string; reason: NoticeReason | null }

const PROMPTS: Record<Composer['kind'], { button: string; placeholder: string; start: string }> = {
  cancelled: { button: 'Cancel game', placeholder: 'Note for players (needed for Other)', start: '' },
  moved: { button: 'Send where', placeholder: 'e.g. Jellie Park, by the pavilion', start: '' },
  message: { button: 'Send message', placeholder: 'What players need to know', start: '' },
}

export default function WeeklyGamesAdmin({ judgeId, isHead }: { judgeId: string; isHead: boolean }) {
  const [board, setBoard] = useState<WeeklyBoard | null | undefined>(undefined)
  const [rosters, setRosters] = useState<Map<string, RosterRow[]>>(new Map())
  const [open, setOpen] = useState<string | null>(null)
  const [composer, setComposer] = useState<Composer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState<'site' | 'game' | 'programme' | null>(null)
  const [programmes, setProgrammes] = useState<Programme[] | null>(null)
  // Kaiārahi names for the regular picker; null until 20261123202226 is live.
  const [directory, setDirectory] = useState<DirectoryRow[] | null>(null)

  // A Kaiārahi who is not a head manages the community games they made and
  // the games they are the regular of (public.manages_game).
  const mineOnly = useCallback((b: WeeklyBoard): WeeklyBoard => isHead ? b : {
    ...b, games: b.games.filter(g => (gameKind(g) === 'community' && g.created_by === judgeId) || g.regular_kaiarahi_id === judgeId),
  }, [isHead, judgeId])

  const reload = useCallback(async () => {
    const b = await loadWeeklyBoard(supabase, null)
    const shown = b ? mineOnly(b) : b
    setBoard(shown)
    if (shown) setRosters(await loadRosters(supabase, shown.games))
    if (isHead) setProgrammes(await loadProgrammes(supabase))
    setDirectory(await loadDirectory(supabase))
  }, [mineOnly, isHead])

  useEffect(() => {
    let cancelled = false
    loadWeeklyBoard(supabase, null).then(async b => {
      if (cancelled) return
      const shown = b ? mineOnly(b) : b
      setBoard(shown)
      if (!shown) return
      const [r, p, d] = await Promise.all([
        loadRosters(supabase, shown.games),
        isHead ? loadProgrammes(supabase) : Promise.resolve(null),
        loadDirectory(supabase),
      ])
      if (cancelled) return
      setRosters(r)
      setProgrammes(p)
      setDirectory(d)
    }).catch(() => { if (!cancelled) setBoard(null) })
    return () => { cancelled = true }
  }, [mineOnly, isHead])

  if (board === undefined || board === null) return null
  const v2 = gamesV2Live(board)
  // Before 20261123035106 only a head may add anything.
  if (!isHead && !v2) return null

  const send = async (gameId: string, date: string, kind: NoticeKind, text: string | null, reason: NoticeReason | null = null) => {
    setBusy(true)
    setError('')
    const err = await postNotice(supabase, gameId, date, kind, text, judgeId, reason)
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

  const allSites = [...board.sites].sort((a, b) => a.name.localeCompare(b.name))
  // A head sees every site; anyone else the sites of their games and the ones they added.
  const sites = isHead ? allSites
    : allSites.filter(s => s.created_by === judgeId || board.games.some(g => g.site_id === s.id))

  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', lineHeight: 1 }}>
        {isHead ? 'Games' : 'Your games'}
      </div>
      <p style={{ fontSize: 13, color: '#888', lineHeight: 1.5, margin: '6px 0 0' }}>
        A notice goes to everyone registered to that game, about its next date. They see it on HOME.
      </p>
      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}

      {sites.map(site => {
        const games = sortWeekly(board.games.filter(g => g.site_id === site.id))
        return (
          <div key={site.id} style={{ marginTop: 18 }}>
            <div style={labelStyle}>{site.name}{site.address ? ` · ${site.address}` : ''}</div>
            {games.length === 0 && <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>No games yet.</div>}
            {games.map(g => (
              <GameAdminRow
                key={g.id} game={g} board={board} roster={rosters.get(g.id) ?? []}
                open={open === g.id} onToggle={() => setOpen(o => (o === g.id ? null : g.id))}
                composer={composer?.gameId === g.id ? composer : null}
                setComposer={setComposer} busy={busy} onSend={send} onRemove={remove}
                directory={directory}
                canHandOn={isHead || (gameKind(g) === 'community' && (g.created_by === judgeId || g.regular_kaiarahi_id === judgeId))}
                onSetRegular={async pid => {
                  setBusy(true)
                  setError('')
                  const e = await setRegular(supabase, g.id, pid)
                  setBusy(false)
                  if (e) setError(`Not changed: ${e}`)
                  else await reload()
                }}
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

      {isHead && programmes && (
        <div style={{ marginTop: 22 }}>
          <div style={labelStyle}>Programmes</div>
          {programmes.length === 0 && <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>No programmes yet. A funded game belongs to one.</div>}
          {programmes.map(p => (
            <div key={p.id} style={{ fontSize: 14, marginTop: 8 }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: '#888' }}> · {p.funder} · {p.starts_on} to {p.ends_on}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <SmallButton onClick={() => setAdding(a => (a === 'game' ? null : 'game'))}>+ Game</SmallButton>
        <SmallButton onClick={() => setAdding(a => (a === 'site' ? null : 'site'))}>+ Site</SmallButton>
        {isHead && programmes && <SmallButton onClick={() => setAdding(a => (a === 'programme' ? null : 'programme'))}>+ Programme</SmallButton>}
      </div>
      {adding === 'site' && (
        <AddSite v2={v2} onDone={async msg => { if (msg) setError(msg); else { setAdding(null); await reload() } }} />
      )}
      {adding === 'game' && (
        <AddGame sites={isHead ? allSites : sites} v2={v2} isHead={isHead} programmes={programmes ?? []}
          onDone={async msg => { if (msg) setError(msg); else { setAdding(null); await reload() } }} />
      )}
      {adding === 'programme' && (
        <AddProgramme onDone={async msg => { if (msg) setError(msg); else { setAdding(null); await reload() } }} />
      )}
    </div>
  )
}

function GameAdminRow({
  game, board, roster, open, onToggle, composer, setComposer, busy, onSend, onRemove, onRetire,
  directory, canHandOn, onSetRegular,
}: {
  game: WeeklyGame
  board: WeeklyBoard
  roster: RosterRow[]
  open: boolean
  onToggle: () => void
  composer: Composer | null
  setComposer: (c: Composer | null) => void
  busy: boolean
  onSend: (gameId: string, date: string, kind: NoticeKind, text: string | null, reason?: NoticeReason | null) => void
  onRemove: (id: string) => void
  onRetire: () => void
  /** Null before 20261123202226: no regular to show. */
  directory: DirectoryRow[] | null
  canHandOn: boolean
  onSetRegular: (playerId: string | null) => void
}) {
  const [retireArmed, setRetireArmed] = useState(false)
  const [picking, setPicking] = useState(false)
  const regular = directory?.find(d => d.player_id === game.regular_kaiarahi_id) ?? null
  // Who may be the regular: anyone for a community game, a Kaimahi with
  // current checks for a funded one (public.can_lead_game).
  const eligible = (directory ?? []).filter(d => canLeadGame({ level: d.level, checksCurrent: d.funded_ok }, game))
  const needsReason = composer?.kind === 'cancelled' || composer?.kind === 'moved'
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {slotLabel(game)}
            {(game.kind || isOneOff(game) || game.listed === false) && (
              <span style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                {' '}· {gameKind(game) === 'funded' ? 'Funded' : 'Community'}{isOneOff(game) ? ' · one-off' : ''}{game.listed === false ? ' · unlisted' : ''}{game.two_adults ? ' · two adults' : ''}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            Next: {day} · {roster.length} registered{awayCount ? ` (${awayCount} away)` : ''}
            {status.cancelled && <b style={{ color: 'var(--red)', fontWeight: 600 }}> · Cancelled</b>}
            {!status.cancelled && status.venue && <b style={{ color: 'var(--amber)', fontWeight: 600 }}> · Moved</b>}
          </div>
        </div>
        <SmallButton onClick={onToggle}>{open ? 'Hide' : 'Who'}</SmallButton>
      </div>

      {directory && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 13, color: '#aaa' }}>
          <span>
            Regular: {regular ? `${regular.display_name} · ${LEVEL_NAME[regular.level]}`
              : gameKind(game) === 'community' ? 'whoever made it' : <b style={{ color: 'var(--amber)', fontWeight: 600 }}>nobody yet</b>}
          </span>
          {canHandOn && !picking && (
            <button type="button" onClick={() => setPicking(true)} style={{
              background: 'none', border: 'none', color: '#9ab', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', padding: 0,
            }}>{gameKind(game) === 'community' ? 'Hand on' : 'Change'}</button>
          )}
          {picking && (
            <select aria-label="Regular Kaiārahi" autoFocus defaultValue={game.regular_kaiarahi_id ?? ''} disabled={busy}
              onChange={e => { setPicking(false); onSetRegular(e.target.value || null) }}
              onBlur={() => setPicking(false)}
              style={{ ...inputStyle, width: 'auto', minHeight: 38, padding: '6px 10px', fontSize: 14 }}>
              <option value="">{gameKind(game) === 'community' ? 'Whoever made it' : 'Nobody'}</option>
              {eligible.map(d => <option key={d.player_id} value={d.player_id}>{d.display_name} · {LEVEL_NAME[d.level]}</option>)}
            </select>
          )}
        </div>
      )}

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
          {needsReason && (
            <select aria-label="Reason" value={composer.reason ?? ''} style={inputStyle}
              onChange={e => setComposer({ ...composer, reason: (e.target.value || null) as NoticeReason | null })}>
              <option value="">Reason</option>
              {NOTICE_REASONS.map(r => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
            </select>
          )}
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
              disabled={busy
                || (composer.kind !== 'cancelled' && !composer.text.trim())
                || (needsReason && !reasonReady(composer.reason, composer.text))}
              onClick={() => onSend(game.id, date, composer.kind, composer.text, needsReason ? composer.reason : null)}
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
            : <SmallButton onClick={() => setComposer({ gameId: game.id, kind: 'cancelled', text: PROMPTS.cancelled.start, reason: null })}>Cancel</SmallButton>}
          <SmallButton onClick={() => setComposer({ gameId: game.id, kind: 'moved', text: '', reason: null })}>Change park</SmallButton>
          <SmallButton onClick={() => setComposer({ gameId: game.id, kind: 'message', text: '', reason: null })}>Message</SmallButton>
          <SmallButton disabled={busy} onClick={() => {
            if (retireArmed) { setRetireArmed(false); onRetire() } else {
              setRetireArmed(true)
              setTimeout(() => setRetireArmed(false), 3000)
            }
          }}>
            {retireArmed ? 'Tap again to stop it' : 'Stop game'}
          </SmallButton>
        </div>
      )}
    </div>
  )
}

function AddSite({ v2, onDone }: { v2: boolean; onDone: (error: string | null) => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const mapOk = !mapUrl.trim() || mapUrl.trim().startsWith('https://')
  // A Google Maps link carries the pin, so Find a game can put the site on a map.
  const pin = pinFromMapUrl(mapUrl)
  const save = async () => {
    setBusy(true)
    const made = await createSite(supabase, {
      name, address, map_url: mapUrl, ...(v2 && pin ? { lat: pin.lat, lng: pin.lng } : {}),
    })
    setBusy(false)
    onDone('error' in made ? `Site not added: ${made.error}` : null)
  }
  return (
    <FormBox>
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} maxLength={80} style={inputStyle} /></Field>
      <Field label="Address"><input value={address} onChange={e => setAddress(e.target.value)} maxLength={200} style={inputStyle} /></Field>
      <Field label="Map link (https, optional)"><input value={mapUrl} onChange={e => setMapUrl(e.target.value)} style={inputStyle} /></Field>
      {v2 && mapUrl.trim() && (
        <div style={{ fontSize: 13, color: pin ? '#8c8' : 'var(--amber)' }}>
          {pin ? 'Pinned from the link.' : 'No pin in that link. Open the place in Google Maps and copy the link from the address bar.'}
        </div>
      )}
      <SmallButton primary="blue" disabled={busy || !name.trim() || !mapOk} onClick={save}>Add site</SmallButton>
    </FormBox>
  )
}

function AddGame({ sites, v2, isHead, programmes, onDone }: {
  sites: WeeklyBoard['sites']; v2: boolean; isHead: boolean; programmes: Programme[]
  onDone: (error: string | null) => void
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [dow, setDow] = useState(6)
  const [time, setTime] = useState('09:00')
  const [oneOff, setOneOff] = useState('')
  const [funded, setFunded] = useState(false)
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? '')
  const [paidBlock, setPaidBlock] = useState('150')
  const [twoAdults, setTwoAdults] = useState(false)
  const [listed, setListed] = useState(true)
  const [busy, setBusy] = useState(false)
  const today = nzWallClock(new Date()).date
  // A one-off's weekday is its date's (weekly_games_one_off_weekday).
  const oneOffDow = oneOff ? new Date(`${oneOff}T12:00:00Z`).getUTCDay() : null
  const save = async () => {
    setBusy(true)
    if (!v2) {
      const { error } = await supabase.from('weekly_games').insert({ site_id: siteId, dow, start_time: time })
      setBusy(false)
      onDone(error
        ? (error.code === '23505' ? 'That site already has a game at that day and time.' : `Not added: ${error.message}`)
        : null)
      return
    }
    const made = await createGame(supabase, {
      site_id: siteId, dow: oneOffDow ?? dow, start_time: time, one_off_date: oneOff || null,
      kind: funded ? 'funded' : 'community', programme_id: funded ? programmeId : null,
      paid_block_minutes: funded ? Number(paidBlock) || null : null, two_adults: twoAdults, listed,
    })
    setBusy(false)
    onDone('error' in made ? `Not added: ${made.error}` : null)
  }
  const fundedNotReady = funded && (!programmeId || !(Number(paidBlock) >= 30 && Number(paidBlock) <= 600))
  return (
    <FormBox>
      <Field label="Site">
        <select value={siteId} onChange={e => setSiteId(e.target.value)} style={inputStyle}>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      {v2 && (
        <Field label="One-off date (leave empty for every week)">
          <input type="date" value={oneOff} min={today} onChange={e => setOneOff(e.target.value)} style={inputStyle} />
        </Field>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        {!oneOff ? (
          <Field label="Day">
            <select value={dow} onChange={e => setDow(Number(e.target.value))} style={inputStyle}>
              {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Field>
        ) : <div style={{ alignSelf: 'end', fontSize: 14, color: '#888', paddingBottom: 12 }}>{DAY_NAMES[oneOffDow ?? 0]}</div>}
        <Field label="Start">
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      {v2 && isHead && (
        <Check checked={funded} onChange={setFunded}>Funded (paid Kaiārahi, part of a programme)</Check>
      )}
      {v2 && funded && (
        <>
          <Field label="Programme">
            <select value={programmeId} onChange={e => setProgrammeId(e.target.value)} style={inputStyle}>
              {programmes.length === 0 && <option value="">Add a programme first</option>}
              {programmes.map(p => <option key={p.id} value={p.id}>{p.name} · {p.funder}</option>)}
            </select>
          </Field>
          <Field label="Paid block (minutes)">
            <input type="number" inputMode="numeric" min={30} max={600} value={paidBlock} onChange={e => setPaidBlock(e.target.value)} style={inputStyle} />
          </Field>
        </>
      )}
      {v2 && <Check checked={twoAdults} onChange={setTwoAdults}>Needs two adults (a school game)</Check>}
      {v2 && <Check checked={listed} onChange={setListed}>Show it on Find a game</Check>}
      <SmallButton primary="blue" disabled={busy || !siteId || !time || fundedNotReady} onClick={save}>Add game</SmallButton>
    </FormBox>
  )
}

function AddProgramme({ onDone }: { onDone: (error: string | null) => void }) {
  const [name, setName] = useState('')
  const [funder, setFunder] = useState('')
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = name.trim() && funder.trim() && starts && ends && ends >= starts
  const save = async () => {
    setBusy(true)
    const err = await createProgramme(supabase, { name, funder, starts_on: starts, ends_on: ends, notes })
    setBusy(false)
    onDone(err ? `Programme not added: ${err}` : null)
  }
  return (
    <FormBox>
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. Burnside Term 1 2027" style={inputStyle} /></Field>
      <Field label="Funder"><input value={funder} onChange={e => setFunder(e.target.value)} maxLength={120} style={inputStyle} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Starts"><input type="date" value={starts} onChange={e => setStarts(e.target.value)} style={inputStyle} /></Field>
        <Field label="Ends"><input type="date" value={ends} min={starts || undefined} onChange={e => setEnds(e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="Notes (optional)"><input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} style={inputStyle} /></Field>
      <SmallButton primary="blue" disabled={busy || !ok} onClick={save}>Add programme</SmallButton>
    </FormBox>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
      <span>{children}</span>
    </label>
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
