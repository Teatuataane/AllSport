'use client'

// ─── Colours: catch-up and audit ─────────────────────────────────────────────
// Since auto-conferral (docs/designs/auto-conferral-spec.md) a colour confers
// itself when the player's own screen asks. This panel stopped being a to-do
// list and became three things:
//
//   1. CATCH-UP (decision 8). Opening it asks the server to recheck every
//      player with something due, through the same route their own screen
//      uses. That is what covers the players who have stopped opening the app.
//   2. AUDIT (decision 5). Each player expands into the colours they hold, who
//      or what conferred them, and the LOGGED scores behind them. Deleting a
//      score that did not happen re-judges that domain, and the colour it was
//      propping up is taken back and the player told.
//   3. EXEMPTIONS (decision 4), unchanged: events a player cannot do, which
//      leave both sides of the half-the-domain rule.
//
// The old "confirm" list survives as the FALLBACK. Until the server has its
// service key the route cannot write, and a kaiwhakawā pressing Confirm
// through confer_grade() is still the only way a colour lands.
//
// It computes with lib/loadGrades.ts, the same code the player's own view uses,
// so the colour offered here is exactly the colour the player sees as ready.
//
// Before the grading migration lands, confer_grade does not exist (PGRST202)
// and grade_exemptions is missing (PGRST205): the panel still shows what is
// ready, says grading is not live, and disables the buttons.
//
// It also lists DISPUTED games: both players recorded the game and their
// results contradict, so it counts for nothing until a kaiwhakawā marks one
// record as right through settle_dispute(). Settling changes ratings, and so
// colours, which is why it lives here and reloads the whole panel.

import { useEffect, useMemo, useState } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import { gradeForRung } from '@/lib/grading'
import { releasable, eventsBehind } from '@/lib/playerGrades'
import { loadGradeState, loadMatches, type GradeState } from '@/lib/loadGrades'
import { recheckGrades, withdrawColours } from '@/lib/recheckGrades'
import { reconcileGames, type Game, type MatchRow } from '@/lib/matches'
import { formatNZDate, toNZDateString } from '@/lib/dates'
import { GradeDot } from '@/components/GradesCard'

const supabase = createClient()
const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')

type Player = { id: string; display_name: string; division: string | null }

/** A logged best effort, as the audit lists it. Never a game-linked entry: those were scored in front of you. */
type EvidenceRow = {
  id: string
  event_slug: string
  score_label: string | null
  performed_on: string
  witnessed: boolean
}
type Row = { player: Player; state: GradeState }

/** Each player is six small queries, so they load a few at a time. */
async function inBatches<T, R>(items: readonly T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)))
  return out
}

// One colour per domain at a time, and only once standards, games and
// training all pass (lib/grading.ts colourGate).
const pending = (r: Row) => releasable(r.state.gates)

/** Names and dates for the disputed-games list. Each its own query. */
type DisputeContext = { names: Map<string, string>; dates: Map<string, string> }

/** What one record says happened, in words. `outcome` is relative to its side 'a'. */
function claim(m: MatchRow, name: (id: string) => string): string {
  const side = (s: 'a' | 'b') => m.players.filter(p => p.side === s).map(p => name(p.player_id)).join(' & ')
  return m.outcome === 'draw' ? 'a draw' : `${side(m.outcome)} won`
}

const label = {
  fontFamily: 'var(--font-label)', fontSize: '11px', color: '#555', letterSpacing: '0.08em',
}
const btn = (enabled: boolean) => ({
  padding: '7px 12px', borderRadius: '8px', border: 'none', flexShrink: 0,
  background: enabled ? '#2371BB' : '#1a1a1a', color: enabled ? '#fff' : '#555',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.05em',
})

export default function GradeReleasePanel() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [judgeId, setJudgeId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exemptSlug, setExemptSlug] = useState('')
  const [exemptReason, setExemptReason] = useState('')
  // Bumped by Refresh, which reloads everyone.
  const [reloadKey, setReloadKey] = useState(0)
  const [matches, setMatches] = useState<MatchRow[] | null>(null)
  const [disputeCtx, setDisputeCtx] = useState<DisputeContext | null>(null)
  // Null until the catch-up has asked. False when the server has no service
  // key, which is what brings the manual Confirm buttons back.
  const [writable, setWritable] = useState<boolean | null>(null)
  const [caught, setCaught] = useState<{ colours: number; players: number } | null>(null)
  // Its own state, not `error`: an action's error and the catch-up's outcome
  // must not overwrite each other, and Refresh must clear the latter.
  const [catchUpFailed, setCatchUpFailed] = useState(0)
  const [evidence, setEvidence] = useState<{ playerId: string; rows: EvidenceRow[] } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  // A re-judge that did not happen after its score was deleted. The score is
  // already gone and Refresh never withdraws, so without this the colour the
  // kaiwhakawā meant to take back would stay for good.
  const [pendingRejudge, setPendingRejudge] = useState<{ player: Player; domain: number; reason: string } | null>(null)

  // Disputed games still waiting, then settled ones, each newest first.
  const disputes = useMemo(() => {
    if (!matches) return { open: [] as Game[], settled: [] as Game[] }
    const byId = new Map(matches.map(m => [m.id, m]))
    const latest = (g: Game) => g.matchIds.map(id => byId.get(id)?.created_at ?? '').sort().at(-1) ?? ''
    const games = reconcileGames(matches).filter(g => g.matchIds.length === 2).sort((x, y) => latest(y).localeCompare(latest(x)))
    return { open: games.filter(g => g.status === 'disputed'), settled: games.filter(g => g.status === 'settled') }
  }, [matches])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const user = await getSessionUser()
      const { data, error: e } = await supabase
        .from('players_public').select('id, display_name, division, is_guest').eq('is_active', true)
      if (cancelled) return
      setJudgeId(user?.id ?? null)
      if (e) { setError(e.message); return }
      const players: Player[] = ((data ?? []) as (Player & { is_guest: boolean | null })[])
        .filter(p => !p.is_guest)
        .map(({ id, display_name, division }) => ({ id, display_name, division }))
      const matches = await loadMatches(supabase)
      if (cancelled) return
      setMatches(matches)

      // The disputed-games list needs names (players may be inactive, so not
      // from the list above) and session dates. Neither blocks the colours.
      const contested = reconcileGames(matches).filter(g => g.status === 'disputed' || g.status === 'settled')
      const ids = [...new Set(contested.flatMap(g => g.players))]
      const sessionIds = [...new Set(contested.map(g => g.session_id))]
      const [who, when] = await Promise.all([
        ids.length ? supabase.from('players_public').select('id, display_name').in('id', ids) : Promise.resolve({ data: [] }),
        sessionIds.length ? supabase.from('sessions').select('id, session_date').in('id', sessionIds) : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      setDisputeCtx({
        names: new Map(((who.data ?? []) as { id: string; display_name: string }[]).map(p => [p.id, p.display_name])),
        dates: new Map(((when.data ?? []) as { id: string; session_date: string }[]).map(s => [s.id, s.session_date])),
      })

      const loaded = await inBatches(players, 5, async (p): Promise<Row | null> => {
        const state = await loadGradeState(supabase, p.id, matches)
        return state ? { player: p, state } : null
      })
      if (cancelled) return
      const present = loaded.filter((r): r is Row => r != null)
      setRows(present
        .sort((a, b) => pending(b).length - pending(a).length || a.player.display_name.localeCompare(b.player.display_name)))

      // Catch-up. Only players with something due, and `force`, because the
      // engine here has already said there is work — the server's cheap probe
      // would only spend a round trip agreeing.
      const due = present.filter(r => pending(r).length > 0)
      if (due.length === 0) { setWritable(true); return }
      const results = await inBatches(due, 5, r => recheckGrades({ playerId: r.player.id, force: true }))
      if (cancelled) return
      setWritable(results.every(x => x.writable))
      // A failed recheck looks exactly like "nothing to confer" unless it is
      // said out loud, and this panel is where anyone would notice.
      setCatchUpFailed(results.filter(x => !x.ok).length)
      const landed = results.map((x, i) => ({ r: due[i], n: x.conferred.length })).filter(x => x.n > 0)
      if (landed.length > 0) {
        setCaught({ colours: landed.reduce((a, x) => a + x.n, 0), players: landed.length })
        const fresh = await inBatches(landed, 5, async ({ r }) => ({ r, s: await loadGradeState(supabase, r.player.id, matches) }))
        if (cancelled) return
        const byId = new Map(fresh.filter(f => f.s).map(f => [f.r.player.id, f.s!]))
        setRows(rs => rs?.map(x => {
          const s = byId.get(x.player.id)
          return s ? { player: x.player, state: s } : x
        }) ?? rs)
      }
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  const refresh = async (p: Player) => {
    const s = await loadGradeState(supabase, p.id)
    if (s) setRows(rs => rs?.map(x => (x.player.id === p.id ? { player: p, state: s } : x)) ?? rs)
  }

  const live = !!rows?.some(r => r.state.schemaReady)

  // The logged scores behind a player's colours, loaded when their row opens.
  // Its own query with ids, rather than widening loadGradeState: the grades
  // engine never needs an entry id, and this panel is the only thing that
  // deletes one.
  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    supabase.from('workout_entries')
      .select('id, event_slug, score_label, workouts!inner(player_id, performed_on, witnessed, session_id)')
      .eq('workouts.player_id', expanded)
      .not('raw_score', 'is', null)
      .not('event_slug', 'is', null)
      .then(({ data }) => {
        if (cancelled) return
        type Q = { id: string; event_slug: string; score_label: string | null
          workouts: { performed_on: string; witnessed: boolean; session_id?: string | null } }
        setEvidence({
          playerId: expanded,
          rows: ((data ?? []) as unknown as Q[])
            // A swap entered AT a game was scored in front of a kaiwhakawā.
            .filter(e => !e.workouts.session_id)
            .map(e => ({ id: e.id, event_slug: e.event_slug, score_label: e.score_label,
              performed_on: e.workouts.performed_on, witnessed: e.workouts.witnessed }))
            .sort((a, b) => b.performed_on.localeCompare(a.performed_on)),
        })
      })
    return () => { cancelled = true }
  }, [expanded, reloadKey])

  // An armed Delete disarms itself. Left armed, a kaiwhakawā who tapped once,
  // was called away and came back could delete with a single tap.
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(null), 4000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  /** Two taps: the first arms it, the second deletes. Deleting evidence can take a colour away. */
  const deleteEvidence = async (r: Row, e: EvidenceRow) => {
    if (confirmDelete !== e.id) { setConfirmDelete(e.id); return }
    setConfirmDelete(null)
    setBusy(`ev:${e.id}`)
    setError('')
    setNotice('')
    const domain = EVENTS.find(x => x.slug === e.event_slug)?.domainNumber
    const { error: delError } = await supabase.from('workout_entries').delete().eq('id', e.id)
    if (delError) { setBusy(null); setError(delError.message); return }
    setEvidence(ev => ev && { ...ev, rows: ev.rows.filter(x => x.id !== e.id) })

    if (domain) {
      const eventName = EVENTS.find(x => x.slug === e.event_slug)?.name ?? e.event_slug
      await rejudge(r.player, domain, `${eventName}: ${e.score_label ?? 'a logged score'} was removed.`)
    } else {
      await refresh(r.player)
    }
    setBusy(null)
  }

  /** Re-judge one domain after a deletion, and keep it pending if it did not happen. */
  const rejudge = async (player: Player, domain: number, reason: string) => {
    const out = await withdrawColours(player.id, domain, reason)
    const failed = !out.ok || !out.writable
    setPendingRejudge(failed ? { player, domain, reason } : null)
    setNotice(
      !out.ok ? `The score is deleted, but ${player.display_name}'s ${DOMAIN_NAMES[domain - 1]} colours could not be re-checked yet.`
      : !out.writable ? 'The score is deleted. Colours cannot be taken back until the server has its service key.'
      : out.withdrawn.length > 0 ? `Taken back from ${player.display_name}: ${out.withdrawn.map(w => `${w.name} in ${DOMAIN_NAMES[w.domainNumber - 1]}`).join(', ')}. ${
          out.logged ? 'They will be told.' : 'Their notice could not be recorded, so tell them yourself.'}`
      : `Deleted. ${player.display_name}'s colours still stand on their other scores.`)
    await refresh(player)
  }

  const confer = async (r: Row, domain: number, rung: number) => {
    setBusy(`${r.player.id}:${domain}`)
    setError('')
    // Shared with the auto-conferral route: both writers must record the same
    // evidence, or an award's events would disagree with the panel showing it.
    const events = eventsBehind(r.state.grades, domain, rung)
    const { error: e } = await supabase.rpc('confer_grade', {
      p_player_id: r.player.id, p_domain_number: domain, p_rung: rung, p_events: events,
    })
    if (e) setError(e.code === 'PGRST202' ? 'Grading is not live yet: the grading migration has not been applied.' : e.message)
    else await refresh(r.player)
    setBusy(null)
  }

  const addExemption = async (r: Row) => {
    if (!exemptSlug || !judgeId) return
    setError('')
    const { error: e } = await supabase.from('grade_exemptions').insert({
      player_id: r.player.id, event_slug: exemptSlug, reason: exemptReason.trim() || null, confirmed_by: judgeId,
    })
    if (e) { setError(e.code === 'PGRST205' ? 'Exemptions are not live yet: the grading migration has not been applied.' : e.message); return }
    setExemptSlug('')
    setExemptReason('')
    await refresh(r.player)
  }

  const removeExemption = async (r: Row, slug: string) => {
    setError('')
    const { error: e } = await supabase.from('grade_exemptions').delete().eq('player_id', r.player.id).eq('event_slug', slug)
    if (e) setError(e.message)
    else await refresh(r.player)
  }

  const reloadAll = () => { setRows(null); setMatches(null); setDisputeCtx(null); setCatchUpFailed(0); setCaught(null); setReloadKey(k => k + 1) }

  // p_true null reopens a settled game.
  const settle = async (g: Game, trueId: string | null) => {
    const key = `dispute:${g.matchIds.join(':')}`
    setBusy(key)
    setError('')
    const { error: e } = await supabase.rpc('settle_dispute', {
      p_match_a: g.matchIds[0], p_match_b: g.matchIds[1], p_true: trueId,
    })
    setBusy(null)
    if (e) { setError(e.code === 'PGRST202' ? 'Settling is not live yet: its migration has not been applied.' : e.message); return }
    // A settled game changes ratings, and so possibly colours: reload everyone.
    reloadAll()
  }

  const nameOf = (id: string) => disputeCtx?.names.get(id) ?? 'A player'
  const byId = new Map((matches ?? []).map(m => [m.id, m]))
  const heading = (g: Game) => {
    const d = disputeCtx?.dates.get(g.session_id)
    return `${g.event_name}${d ? ` · ${formatNZDate(d)}` : ''}`
  }

  const ready = (rows ?? []).filter(r => pending(r).length > 0)

  return (
    <div style={{ background: '#111', border: '1px solid #1e3a5f', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#4DB26E', letterSpacing: '0.05em', lineHeight: 1 }}>
            Colours
          </div>
          <div style={{ ...label, marginTop: '2px' }}>CONFERRED AUTOMATICALLY · YOU AUDIT THE EVIDENCE</div>
        </div>
        <button onClick={reloadAll} style={btn(true)}>Refresh</button>
      </div>

      {rows && !live && (
        <div style={{ fontSize: '13px', color: '#888', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: '12px' }}>
          Grading is not live yet: nothing can be confirmed until the grading migration is applied. The list below
          shows what the standards give today.
        </div>
      )}
      {error && (
        <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-body)', marginBottom: '12px' }}>{error}</div>
      )}
      {notice && (
        <div style={{ color: '#ccc', fontSize: '13px', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: '12px' }}>
          {notice}
          {pendingRejudge && (
            <button
              disabled={busy === 'rejudge'}
              onClick={async () => {
                setBusy('rejudge')
                await rejudge(pendingRejudge.player, pendingRejudge.domain, pendingRejudge.reason)
                setBusy(null)
              }}
              style={{ ...btn(busy !== 'rejudge'), marginLeft: '8px', minHeight: '44px' }}>
              {busy === 'rejudge' ? 'Re-checking…' : 'Re-check now'}
            </button>
          )}
        </div>
      )}
      {catchUpFailed > 0 && (
        <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-body)', marginBottom: '12px' }}>
          Could not check colours for {catchUpFailed} player{catchUpFailed === 1 ? '' : 's'}. Press Refresh to try again.
        </div>
      )}
      {caught && (
        <div style={{ color: '#4DB26E', fontSize: '13px', fontFamily: 'var(--font-body)', marginBottom: '12px' }}>
          Caught up: {caught.colours} colour{caught.colours === 1 ? '' : 's'} conferred for {caught.players} player{caught.players === 1 ? '' : 's'}.
        </div>
      )}
      {live && writable === false && (
        <div style={{ fontSize: '13px', color: '#F9B051', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: '12px' }}>
          Automatic conferral is not switched on yet: the server has no service key. Until it does, the colours
          below still need you to confirm them.
        </div>
      )}

      {(disputes.open.length > 0 || disputes.settled.length > 0) && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ ...label, margin: '0 0 8px' }}>DISPUTED GAMES · COUNT FOR NOTHING UNTIL YOU MARK THE RIGHT RECORD</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {disputes.open.map(g => {
              const key = `dispute:${g.matchIds.join(':')}`
              return (
                <div key={key} style={{ background: '#0a0a0a', border: '1px solid #3a2a12', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'var(--font-body)', marginBottom: '4px' }}>{heading(g)}</div>
                  {g.matchIds.map(id => {
                    const m = byId.get(id)
                    if (!m) return null
                    const recorder = m.players.filter(p => p.side === 'a').map(p => nameOf(p.player_id)).join(' & ')
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderTop: '1px solid #161616' }}>
                        <div style={{ flexGrow: 1, minWidth: 0, fontSize: '13px', color: '#aaa', fontFamily: 'var(--font-body)' }}>
                          {recorder} recorded: <span style={{ color: '#fff' }}>{claim(m, nameOf)}</span>
                        </div>
                        <button disabled={busy === key} onClick={() => settle(g, id)} style={btn(busy !== key)}>
                          {busy === key ? 'Saving…' : `${recorder} is right`}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {disputes.settled.map(g => {
              const key = `dispute:${g.matchIds.join(':')}`
              const truth = g.matchIds.map(id => byId.get(id)).find(m => m?.confirmed_at)
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '8px 12px' }}>
                  <div style={{ flexGrow: 1, minWidth: 0, fontSize: '13px', color: '#888', fontFamily: 'var(--font-body)' }}>
                    {heading(g)} · settled: <span style={{ color: '#ccc' }}>{truth ? claim(truth, nameOf) : ''}</span>
                  </div>
                  <button disabled={busy === key} onClick={() => settle(g, null)} style={btn(busy !== key)}>
                    {busy === key ? 'Saving…' : 'Reopen'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!rows ? (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'var(--font-body)', textAlign: 'center', padding: '20px 0' }}>
          Working out everyone&apos;s colours…
        </div>
      ) : ready.length === 0 ? (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'var(--font-body)', textAlign: 'center', padding: '12px 0 18px' }}>
          Nobody has a colour waiting. Every colour earned has been conferred.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
          {ready.map(r => (
            <div key={r.player.id} style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'var(--font-body)', marginBottom: '6px' }}>
                {r.player.display_name} <span style={{ color: '#555', fontSize: '12px' }}>{r.player.division}</span>
              </div>
              {pending(r).map(d => {
                const from = gradeForRung(d.held)
                const to = gradeForRung(d.releasable)
                const key = `${r.player.id}:${d.domainNumber}`
                // What stands behind it. Every source counts; the kaiwhakawā
                // moderates in person, so solo evidence is named, not hidden.
                const behind = EVENTS
                  .filter(e => e.domainNumber === d.domainNumber)
                  .map(e => r.state.grades.events.get(e.slug))
                  .filter(g => g && g.rung >= d.releasable)
                const solo = behind.filter(g => g!.source === 'solo').length
                const witnessed = behind.filter(g => g!.source === 'witnessed').length
                return (
                  <div key={d.domainNumber} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderTop: '1px solid #161616' }}>
                    <div style={{ flexGrow: 1, minWidth: 0, fontSize: '13px', color: '#ccc', fontFamily: 'var(--font-body)' }}>
                      {DOMAIN_NAMES[d.domainNumber - 1]}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '3px', fontSize: '12px', color: '#888' }}>
                        <GradeDot grade={from} size={9} /> {from.name} → <GradeDot grade={to} size={9} /> <span style={{ color: '#fff' }}>{to.name}</span>
                        <span style={{ color: '#555' }}>· {behind.length} events · {d.games} games · {Math.floor(d.units)} units</span>
                      </div>
                      {(solo > 0 || witnessed > 0) && (
                        <div style={{ fontSize: '11.5px', marginTop: '2px', color: solo ? '#F9B051' : '#888' }}>
                          {[solo && `${solo} solo`, witnessed && `${witnessed} witnessed`].filter(Boolean).join(' · ')} from logged workouts
                        </div>
                      )}
                    </div>
                    <button disabled={!live || busy === key} onClick={() => confer(r, d.domainNumber, d.releasable)} style={btn(live && busy !== key)}>
                      {busy === key ? 'Confirming…' : `Confirm ${to.name}`}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div style={{ ...label, margin: '4px 0 8px' }}>PLAYERS · COLOURS HELD, LOGGED EVIDENCE, EXEMPTIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rows.map(r => {
              const open = expanded === r.player.id
              const exempt = [...r.state.exemptions]
              return (
                <div key={r.player.id} style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    onClick={() => { setExpanded(open ? null : r.player.id); setExemptSlug(''); setExemptReason('') }}
                    style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#ccc', fontFamily: 'var(--font-body)', fontSize: '13px' }}
                  >
                    <span>{r.player.display_name}</span>
                    <span style={{ color: '#555' }}>
                      {r.state.held.size ? `${r.state.held.size} held` : ''}{r.state.held.size && exempt.length ? ' · ' : ''}{exempt.length ? `${exempt.length} exempt` : ''} {open ? '▴' : '▾'}
                    </span>
                  </button>
                  {open && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <HeldColours state={r.state} nameOf={id => rows.find(x => x.player.id === id)?.player.display_name ?? 'a kaiwhakawā'} />
                      <EvidenceList
                        rows={evidence?.playerId === r.player.id ? evidence.rows : null}
                        held={r.state.held}
                        busy={busy}
                        armed={confirmDelete}
                        onDelete={e => deleteEvidence(r, e)}
                      />
                      <div style={{ ...label, margin: '12px 0 4px' }}>EXEMPTIONS</div>
                      {exempt.map(slug => (
                        <div key={slug} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: '13px', color: '#aaa', fontFamily: 'var(--font-body)' }}>
                          {EVENTS.find(e => e.slug === slug)?.name ?? slug}
                          <button onClick={() => removeExemption(r, slug)} style={btn(live)} disabled={!live}>Remove</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        <select value={exemptSlug} onChange={e => setExemptSlug(e.target.value)} aria-label="Event to exempt"
                          style={{ background: '#111', color: '#fff', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
                          <option value="">Choose an event…</option>
                          {EVENTS.filter(e => !r.state.exemptions.has(e.slug)).map(e => (
                            <option key={e.slug} value={e.slug}>{DOMAIN_NAMES[e.domainNumber - 1]} · {e.name}</option>
                          ))}
                        </select>
                        <input value={exemptReason} onChange={e => setExemptReason(e.target.value)} placeholder="Reason (private: the player, their parent and kaiwhakawā only)"
                          style={{ background: '#111', color: '#fff', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px', fontFamily: 'var(--font-body)', fontSize: '13px' }} />
                        <button onClick={() => addExemption(r)} disabled={!live || !exemptSlug} style={btn(live && !!exemptSlug)}>Add exemption</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── The audit ───────────────────────────────────────────────────────────────

/** What a player holds in each domain, and whether a person or the server conferred it. */
function HeldColours({ state, nameOf }: { state: GradeState; nameOf: (id: string) => string }) {
  const latest = new Map<number, (typeof state.awards)[number]>()
  for (const a of state.awards) {
    const cur = latest.get(a.domain_number)
    if (!cur || a.rung > cur.rung) latest.set(a.domain_number, a)
  }
  if (latest.size === 0) {
    return <div style={{ fontSize: '13px', color: '#555', fontFamily: 'var(--font-body)', padding: '4px 0' }}>No colours held yet.</div>
  }
  return (
    <>
      <div style={{ ...label, margin: '4px 0 4px' }}>COLOURS HELD</div>
      {[...latest.values()].sort((a, b) => a.domain_number - b.domain_number).map(a => (
        <div key={a.domain_number} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '13px', color: '#ccc', fontFamily: 'var(--font-body)' }}>
          <GradeDot grade={gradeForRung(a.rung)} size={10} />
          <span style={{ flexGrow: 1 }}>{a.grade_name} <span style={{ color: '#666' }}>· {DOMAIN_NAMES[a.domain_number - 1]}</span></span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {a.conferred_by ? `by ${nameOf(a.conferred_by)}` : 'automatic'} · {formatNZDate(toNZDateString(new Date(a.conferred_at)))}
          </span>
        </div>
      ))}
    </>
  )
}

/**
 * Logged scores in the domains the player holds a colour in, newest first.
 * Solo ones are flagged in amber, because a solo score is the one nobody but
 * the player saw.
 */
function EvidenceList({ rows, held, busy, armed, onDelete }: {
  rows: EvidenceRow[] | null
  held: ReadonlyMap<number, number>
  busy: string | null
  armed: string | null
  onDelete: (e: EvidenceRow) => void
}) {
  if (rows === null) {
    return <div style={{ fontSize: '12px', color: '#555', fontFamily: 'var(--font-body)', padding: '8px 0 0' }}>Loading logged scores…</div>
  }
  const relevant = rows.filter(e => {
    const d = EVENTS.find(x => x.slug === e.event_slug)?.domainNumber
    return d != null && (held.get(d) ?? 0) > 0
  })
  return (
    <>
      <div style={{ ...label, margin: '12px 0 4px' }}>LOGGED SCORES BEHIND THEM</div>
      {relevant.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#555', fontFamily: 'var(--font-body)' }}>
          None. Every colour here rests on scores from official games.
        </div>
      ) : relevant.map(e => {
        const ev = EVENTS.find(x => x.slug === e.event_slug)
        const key = `ev:${e.id}`
        return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderTop: '1px solid #161616', fontSize: '13px', color: '#ccc', fontFamily: 'var(--font-body)' }}>
            <span style={{
              fontSize: '10px', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', borderRadius: '4px', padding: '1px 5px', flexShrink: 0,
              color: e.witnessed ? '#888' : '#F9B051', background: e.witnessed ? '#1a1a1a' : '#F9B05122',
            }}>
              {e.witnessed ? 'WITNESSED' : 'SOLO'}
            </span>
            <span style={{ flexGrow: 1, minWidth: 0 }}>
              {ev?.name ?? e.event_slug} <span style={{ color: '#888' }}>{e.score_label}</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: '#555' }}>{formatNZDate(e.performed_on)}</span>
            </span>
            <button onClick={() => onDelete(e)} disabled={busy === key} style={{
              ...btn(busy !== key),
              background: armed === e.id ? '#EA4742' : busy === key ? '#1a1a1a' : '#2a1414',
              color: armed === e.id ? '#fff' : busy === key ? '#555' : '#EA4742',
              minHeight: '44px',
            }}>
              {busy === key ? 'Deleting…' : armed === e.id ? 'Tap again to delete' : 'Delete'}
            </button>
          </div>
        )
      })}
    </>
  )
}
