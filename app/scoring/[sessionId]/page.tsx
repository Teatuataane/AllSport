'use client'
import { opponentPicks as pickOpponents } from '@/lib/matches'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { getEventByName, getEventBySlug, DOMAIN_ORDER, type EventData } from '@/lib/eventData'
import { parseLocalDate, toNZDateString } from '@/lib/dates'
import EventIcon, { domainColor } from '@/components/EventIcon'
import { type EntryVals, scoreColumns } from '@/lib/scoring'
import {
  buildJudgeRoster, resolveJudgeTarget, resultsForTarget, scoredEventIds,
  scoredEventIdsByTarget, NO_SCORES,
} from '@/lib/judgeRoster'
// The play screen's shared pieces. A personal game (app/workout/[id]) draws
// with exactly these, so scoring keeps ONE code path.
import QuickEntrySheet, { type SubmitOutcome } from '@/components/play/QuickEntrySheet'
import AddEventsSheet from '@/components/play/AddEventsSheet'
import GameEventList from '@/components/play/GameEventList'
import { playList, domainsCovered, type PlaySlot, type DomainGroup } from '@/lib/gameSwaps'
import { scoreRung, rungSegment } from '@/lib/scoreColour'
import { useGradeProfile } from '@/lib/useGradeProfile'
import { recheckGrades, type ConferredColour } from '@/lib/recheckGrades'
import { gradeForRung } from '@/lib/grading'
import { GradeDot } from '@/components/GradeDot'
import { useGameSwaps } from '@/lib/useGameSwaps'
import {
  formatPR, sportWDL, sectionLabel, ProgressSegments, INP, QES_LBL as SHEET_LBL,
} from '@/components/play/chrome'
import BodyweightField from '@/components/play/BodyweightField'
const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionEvent = {
  id: string
  domain_number: number
  domain_name: string
  event_name: string
  event_slug: string
  input_mode: string
  display_order: number
}

type Result = {
  id: string
  player_id: string | null
  player_name: string
  event_id: string
  raw_score: number
  score_label: string
  placement: number | null
  points_earned: number | null
  difficulty_tier: string | null
  result_type: string | null
  opponent_name: string | null
  match_score: string | null
  weight_kg: number | null
  reps: number | null
  time_seconds: number | null
  is_pr: boolean
}

// Age arrives pre-derived from the players_public view rather than as a raw
// date_of_birth: the live session only ever needs the Junior age chips and the
// age-group badges, and exact birthdays for 8 minors do not belong in a payload
// any logged-in player can fetch. The view supplies age_group ready-made, so
// there is no bracket helper here — see the note in the migration about why the
// view's column set is not something to change casually.
type PlayerInfo = { division: string; age_years?: number | null; age_group?: string | null; show_division?: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}


function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Builds the results payload and inserts (or updates) it, including the PR flag.
// Returns { error } on failure; on success error is null and isPR describes the
// submission so the caller can pick the right toast.
async function submitEntry(args: {
  sessionId: string
  eventId: string
  playerId: string | null
  playerName: string
  mode: string
  eventData: EventData | undefined
  v: EntryVals
  myResults: Result[]
  seasonPRNum: number | null
  editingResultId: string | null
  // Opponent player ids to record as a match, or null to leave matches alone.
  // Decided by the sheet, which knows whether an edit touched the opponent.
  matchOpponents: string[] | null
}): Promise<SubmitOutcome> {
  const { sessionId, eventId, playerId, playerName, mode, eventData, v, myResults, seasonPRNum, editingResultId, matchOpponents } = args
  // One encoder for a game score and a logged best effort (lib/scoring.ts).
  const scored = scoreColumns(mode, eventData, v)
  if (!scored) return { error: 'Enter a valid score first', isPR: false }
  try {
    const payload: Record<string, unknown> = {
      session_id: sessionId, event_id: eventId, player_id: playerId || null,
      player_name: playerName, ...scored,
    }

    // When editing, judge the PR against the OTHER rows — including the row
    // being edited would wipe its own PR flag.
    const priorResults = editingResultId ? myResults.filter(r => r.id !== editingResultId) : myResults
    const newIsPR = seasonPRNum !== null && scored.raw_score > seasonPRNum && !priorResults.some(r => r.is_pr)
    payload.is_pr = newIsPR
    // Effort tasks are retired, so effort_task_completions is no longer
    // written: a new row takes the column default (0), and an edit leaves a
    // row's earlier credit alone rather than wiping it mid-season.

    let resultId: string
    if (editingResultId) {
      const { data, error: dbErr } = await supabase.from('results').update(payload).eq('id', editingResultId).select('id')
      if (dbErr) throw dbErr
      if (!data || data.length === 0) throw new Error('This score was deleted by a kaiwhakawā — close and submit it as a new score')
      resultId = editingResultId
    } else {
      // The new row's id anchors its match, so ask for it back.
      const { data: inserted, error: dbErr } = await supabase.from('results').insert(payload).select('id').single()
      if (dbErr) throw dbErr
      if (!inserted) throw new Error('The score did not save — try again')
      resultId = inserted.id
    }
    // The score is the record; the match hangs off it. It is written only once
    // the score has saved, and a failure here must never turn a saved score into
    // an error toast. Guests have no stable identity, so they are never matched.
    if (playerId && matchOpponents !== null) await recordMatch(resultId, matchOpponents)
    // An edit replaces a completion, it does not add one.
    return { error: null, isPR: newIsPR }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Submission failed', isPR: false }
  }
}

// Records the head-to-head match behind one game result (migration
// 20260914020739). The server reads session, event, player and outcome off the
// result row itself, so all this sends is who the opponents were — the match
// cannot claim an outcome the score does not.
//
// Best-effort by design. PGRST202 means the function does not exist yet: the
// code shipped before the migration was applied, so recording simply has not
// started, and that is not an error worth showing a player mid-game.
async function recordMatch(resultId: string, opponentIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('record_match', { p_result_id: resultId, p_opponent_ids: opponentIds })
  if (error && error.code !== 'PGRST202') console.warn('record_match:', error.message)
}

// ─── Event list row (player redesign) ─────────────────────────────────────────

/** The best raw score in a set of rows, or null when there are none. */
function bestRaw(rows: readonly Result[]): number | null {
  return rows.length === 0 ? null : rows.reduce((b, r) => Math.max(b, r.raw_score), -Infinity)
}

/** Deleting a score is this page's job; the sheet only asks for it. */
async function deleteResult(id: string): Promise<string | null> {
  const { error } = await supabase.from('results').delete().eq('id', id)
  return error?.message ?? null
}

function eventDivisionRank(
  seId: string, allResults: Result[], playerInfoMap: Record<string, PlayerInfo>,
  playerDivision: string | null | undefined, myBestRaw: number | null
): { label: string; color: string } {
  if (!playerDivision || myBestRaw === null) return { label: '', color: '#555' }
  const divEventResults = allResults.filter(r =>
    r.event_id === seId && r.player_id && playerInfoMap[r.player_id]?.division === playerDivision
  )
  const bestPerDiv: Record<string, number> = {}
  divEventResults.forEach(r => {
    if (!r.player_id) return
    const ex = bestPerDiv[r.player_id]
    if (ex === undefined || r.raw_score > ex) bestPerDiv[r.player_id] = r.raw_score
  })
  const rank = 1 + Object.values(bestPerDiv).filter(b => b > myBestRaw).length
  const color = rank === 1 ? '#F9B051' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#888'
  return { label: `${ordinal(rank)} in event`, color }
}


// ─── Shared scoring-screen chrome ─────────────────────────────────────────────

// ─── Kaiwhakawā picker ────────────────────────────────────────────────────────

function JudgeChip({ label, active, tone = 'player', onClick }: {
  label: string
  active?: boolean
  tone?: 'player' | 'guest' | 'add'
  onClick: () => void
}) {
  const accent = tone === 'guest' ? '#F9B051' : '#EA4742'
  const idleColor = tone === 'guest' ? '#F9B051' : tone === 'add' ? '#888' : '#ccc'
  const idleBorder = tone === 'guest' ? '#F9B05144' : tone === 'add' ? '#2a2a2a' : '#333'
  return (
    <button onClick={onClick} style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em',
      fontSize: '13px', fontWeight: 600, flexShrink: 0, cursor: 'pointer',
      borderRadius: '999px', padding: '0 15px', minHeight: '44px',
      display: 'inline-flex', alignItems: 'center',
      background: active ? accent : '#161616',
      color: active ? (tone === 'guest' ? '#000' : '#fff') : idleColor,
      border: `1px ${tone === 'add' ? 'dashed' : 'solid'} ${active ? accent : idleBorder}`,
    }}>{label}</button>
  )
}

function JudgeRosterRow({ name, isGuest, scoredIds, events, onOpen }: {
  name: string
  isGuest: boolean
  scoredIds: ReadonlySet<string>
  events: SessionEvent[]
  onOpen: () => void
}) {
  const done = events.filter(ev => scoredIds.has(ev.id)).length
  const complete = events.length > 0 && done === events.length
  return (
    <button onClick={onOpen} style={{
      width: '100%', textAlign: 'left', display: 'block', padding: '12px 14px', marginBottom: '8px',
      borderRadius: '16px', cursor: 'pointer', background: '#111',
      border: `1px solid ${complete ? '#1e3a28' : '#1e1e1e'}`, color: '#fff', fontFamily: 'var(--font-body)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', letterSpacing: '0.03em', lineHeight: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
          {isGuest && <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#F9B051', marginLeft: '8px', letterSpacing: '0.1em' }}>GUEST</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0, color: complete ? '#4DB26E' : '#888' }}>
          {done}/{events.length} scored
        </div>
      </div>
      <ProgressSegments events={events} scoredIds={scoredIds} height={6} />
    </button>
  )
}

// ─── Division pool constants ──────────────────────────────────────────────────

const MENS_DIVS = ["Men's", 'Masters Men', 'Grandmaster Men']
const WOMENS_DIVS = ["Women's", 'Masters Women', 'Grandmaster Women']

function medalBg(rank: number): string {
  return rank === 1 ? '#F9B051' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#2a2a2a'
}
function medalColor(rank: number): string { return rank <= 3 ? '#000' : '#aaa' }

// ─── JudgeSummaryTab ──────────────────────────────────────────────────────────

function JudgeSummaryTab({
  events, results, playerInfoMap, onScoreChanged,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
  onScoreChanged: () => void
}) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  function getPoolResults(pool: 'mens' | 'womens' | 'juniors') {
    return results.filter(r => {
      if (!r.player_id) return false
      const info = playerInfoMap[r.player_id]
      if (!info) return false
      if (pool === 'mens') return MENS_DIVS.includes(info.division)
      if (pool === 'womens') return WOMENS_DIVS.includes(info.division)
      return info.division === 'Juniors' || info.division === 'Youth'
    })
  }

  function computeSummaryRows(pool: 'mens' | 'womens' | 'juniors') {
    const poolResults = getPoolResults(pool)
    const playerIds = [...new Set(poolResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (playerIds.length === 0) return []

    const rows = playerIds.map(pid => {
      let totalPlacement = 0
      const eventDetails = events.map(ev => {
        const evRes = poolResults.filter(r => r.event_id === ev.id)
        const best: Record<string, { rawScore: number; scoreLabel: string }> = {}
        evRes.forEach(r => {
          if (!r.player_id) return
          const ex = best[r.player_id]
          if (!ex || r.raw_score > ex.rawScore) best[r.player_id] = { rawScore: r.raw_score, scoreLabel: r.score_label }
        })
        const scorerCount = Object.keys(best).length
        const myBest = best[pid]
        const evData = getEventByName(ev.event_name)
        const isSport = evData?.inputMode === 'sport'
        if (!myBest) {
          totalPlacement += scorerCount + 1
          return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', displayLabel: null as string | null, placement: scorerCount + 1, hasScore: false }
        }
        const placement = 1 + Object.values(best).filter(b => b.rawScore > myBest.rawScore).length
        totalPlacement += placement
        const displayLabel = isSport
          ? sportWDL(poolResults.filter(r => r.player_id === pid && r.event_id === ev.id))
          : myBest.scoreLabel
        return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', displayLabel, placement, hasScore: true }
      })
      const sample = poolResults.find(r => r.player_id === pid)!
      const division = playerInfoMap[pid]?.division ?? ''
      return { playerId: pid, playerName: sample.player_name, totalPlacement, eventDetails, division }
    })
    rows.sort((a, b) => a.totalPlacement - b.totalPlacement)
    return rows.map((e, _, arr) => ({ ...e, rank: 1 + arr.filter(x => x.totalPlacement < e.totalPlacement).length }))
  }

  async function handleDelete(resultId: string) {
    await supabase.from('results').delete().eq('id', resultId)
    setEditingKey(null)
    onScoreChanged()
  }

  function renderSummarySection(pool: 'mens' | 'womens' | 'juniors', title: string) {
    const rows = computeSummaryRows(pool)
    const poolResults = getPoolResults(pool)
    return (
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', marginBottom: '10px', borderBottom: '1px solid #1e1e1e', paddingBottom: '8px' }}>
          {title}
        </div>
        {rows.length === 0 ? (
          <div style={{ color: '#555', fontSize: '13px', padding: '8px 0', fontFamily: 'var(--font-label)' }}>No scores submitted</div>
        ) : (
          rows.map(entry => {
            const isExpanded = expandedPlayerId === entry.playerId
            return (
              <div key={entry.playerId} style={{ marginBottom: '6px' }}>
                <button
                  onClick={() => setExpandedPlayerId(isExpanded ? null : entry.playerId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '10px 14px',
                    background: isExpanded ? '#0d1a2e' : '#111',
                    border: `1px solid ${isExpanded ? '#2371BB' : '#1e1e1e'}`,
                    borderRadius: isExpanded ? '10px 10px 0 0' : '10px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                    background: medalBg(entry.rank), color: medalColor(entry.rank),
                  }}>{entry.rank}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{entry.playerName}</div>
                    {['Masters Men', 'Masters Women', 'Grandmaster Men', 'Grandmaster Women'].includes(entry.division) && (
                      <div style={{ fontSize: '10px', color: '#B87DB5', fontFamily: 'var(--font-label)' }}>{entry.division}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#555', fontFamily: 'var(--font-label)', flexShrink: 0, marginRight: '4px' }}>
                    {entry.totalPlacement} total
                  </div>
                  <span style={{ color: isExpanded ? '#2371BB' : '#444', fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div style={{ background: '#0a0a0a', border: '1px solid #2371BB', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {entry.eventDetails.map((ed, i) => {
                      const editKey = `${entry.playerId}-${ed.eventId}`
                      const isEditingThis = editingKey === editKey
                      const eventResults = poolResults.filter(r => r.player_id === entry.playerId && r.event_id === ed.eventId)
                      return (
                        <div key={ed.eventId} style={{ borderBottom: i < entry.eventDetails.length - 1 ? '1px solid #111' : 'none' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px',
                            background: isEditingThis ? '#0d1a2e' : i % 2 === 0 ? '#0a0a0a' : '#0d0d0d',
                          }}>
                            <span style={{ fontSize: '14px', flexShrink: 0 }}>{ed.emoji}</span>
                            <div style={{ flex: 1, fontSize: '11px', color: '#666', fontFamily: 'var(--font-label)' }}>{ed.eventName}</div>
                            <div style={{ fontSize: '12px', color: ed.displayLabel ? '#ccc' : '#333', minWidth: '60px', textAlign: 'right' }}>
                              {ed.displayLabel ?? '—'}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, minWidth: '28px', textAlign: 'right', color: ed.hasScore ? '#F9B051' : '#333', fontFamily: 'var(--font-label)' }}>
                              {ordinal(ed.placement)}
                            </div>
                            <button
                              onClick={() => setEditingKey(isEditingThis ? null : editKey)}
                              style={{
                                background: 'none',
                                border: `1px solid ${isEditingThis ? '#EA474244' : '#2371BB33'}`,
                                borderRadius: '4px', color: isEditingThis ? '#EA4742' : '#2371BB',
                                cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                                fontFamily: 'var(--font-label)', fontWeight: 700, flexShrink: 0,
                              }}
                            >
                              {isEditingThis ? 'Close' : 'Edit'}
                            </button>
                          </div>
                          {isEditingThis && (
                            <div style={{ padding: '12px 14px', background: '#0d1020', borderTop: '1px solid #1e1e1e' }}>
                              {eventResults.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                  <div style={{ fontSize: '10px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', marginBottom: '4px' }}>SUBMITTED SCORES</div>
                                  {eventResults.map(r => (
                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', borderRadius: '8px', padding: '8px 12px' }}>
                                      <div style={{ flex: 1, fontSize: '14px', color: '#fff' }}>{r.score_label}</div>
                                      {r.difficulty_tier && (
                                        <div style={{ fontSize: '10px', color: '#B87DB5', fontFamily: 'var(--font-label)' }}>{r.difficulty_tier}</div>
                                      )}
                                      <button
                                        onClick={() => handleDelete(r.id)}
                                        style={{
                                          background: '#EA474222', border: '1px solid #EA474244',
                                          borderRadius: '4px', color: '#EA4742', cursor: 'pointer',
                                          fontSize: '11px', padding: '3px 10px',
                                          fontFamily: 'var(--font-label)', fontWeight: 700,
                                        }}
                                      >Delete</button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>No score submitted yet</div>
                              )}
                              <div style={{ fontSize: '11px', color: '#444', fontFamily: 'var(--font-label)' }}>
                                To add or update a score, use the Kaiwhakawā tab and select {entry.playerName}.
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: '11px', color: '#EA4742', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 700 }}>
        GAME SUMMARY — ALL PLAYERS
      </div>
      {renderSummarySection('mens', "Men's")}
      {renderSummarySection('womens', "Women's")}
      {renderSummarySection('juniors', 'Juniors')}
    </div>
  )
}

// ─── LeaderboardTab ───────────────────────────────────────────────────────────

function LeaderboardTab({
  events, results, playerInfoMap, currentPlayerId, currentPlayerDivision,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
  currentPlayerId: string | null
  currentPlayerDivision: string | null
}) {
  const [menFilter, setMenFilter] = useState<'Masters Men' | 'Grandmaster Men' | null>(null)
  const [womenFilter, setWomenFilter] = useState<'Masters Women' | 'Grandmaster Women' | null>(null)
  const [juniorAge, setJuniorAge] = useState<number | null>(null)
  const [eventFilterId, setEventFilterId] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [expandedPlayerKey, setExpandedPlayerKey] = useState<string | null>(null)

  const juniorAges = useMemo(() => {
    const ages = new Set<number>()
    results.forEach(r => {
      if (!r.player_id) return
      const info = playerInfoMap[r.player_id]
      if (!info || info.division !== 'Juniors') return
      if (info.age_years != null) ages.add(info.age_years)
    })
    return [...ages].sort((a, b) => a - b)
  }, [results, playerInfoMap])

  function getPoolResults(pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null) {
    return results.filter(r => {
      if (!r.player_id) return false
      const info = playerInfoMap[r.player_id]
      if (!info) return false
      if (pool === 'mens') return filter ? info.division === filter : MENS_DIVS.includes(info.division)
      if (pool === 'womens') return filter ? info.division === filter : WOMENS_DIVS.includes(info.division)
      if (pool === 'juniors') {
        if (info.division !== 'Juniors' && info.division !== 'Youth') return false
        if (ageFilter !== null) return info.age_years != null ? info.age_years === ageFilter : true
        return true
      }
      return false
    })
  }

  type EventDetail = {
    eventId: string; eventName: string; emoji: string
    scoreLabel: string | null; displayLabel: string | null; placement: number
  }
  type CompRow = {
    playerKey: string; playerName: string; playerId: string
    totalPlacement: number; rank: number
    subDivision?: string; subDivisionRank?: number
    eventDetails: EventDetail[]
  }

  function computeRows(pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null): CompRow[] {
    const poolResults = getPoolResults(pool, filter, ageFilter)
    const playerIds = [...new Set(poolResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (playerIds.length === 0) return []

    const rows = playerIds.map(pid => {
      let totalPlacement = 0
      const eventDetails: EventDetail[] = events.map(ev => {
        const evPoolRes = poolResults.filter(r => r.event_id === ev.id)
        const best: Record<string, { rawScore: number; scoreLabel: string }> = {}
        evPoolRes.forEach(r => {
          if (!r.player_id) return
          const ex = best[r.player_id]
          if (!ex || r.raw_score > ex.rawScore) best[r.player_id] = { rawScore: r.raw_score, scoreLabel: r.score_label }
        })
        const scorerCount = Object.keys(best).length
        const myBest = best[pid]
        const evData = getEventByName(ev.event_name)
        const isSport = evData?.inputMode === 'sport'
        if (!myBest) {
          totalPlacement += scorerCount + 1
          return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', scoreLabel: null, displayLabel: null, placement: scorerCount + 1 }
        }
        const placement = 1 + Object.values(best).filter(b => b.rawScore > myBest.rawScore).length
        totalPlacement += placement
        const displayLabel = isSport
          ? sportWDL(poolResults.filter(r => r.player_id === pid && r.event_id === ev.id))
          : myBest.scoreLabel
        return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', scoreLabel: myBest.scoreLabel, displayLabel, placement }
      })
      const sample = poolResults.find(r => r.player_id === pid)!
      return { playerKey: pid, playerName: sample.player_name, playerId: pid, totalPlacement, eventDetails }
    })

    rows.sort((a, b) => a.totalPlacement - b.totalPlacement)
    const ranked: CompRow[] = rows.map((e, _, arr) => ({
      ...e,
      rank: 1 + arr.filter(x => x.totalPlacement < e.totalPlacement).length,
    }))

    // Compute sub-division ranks when showing full unfiltered pool
    if (!filter && (pool === 'mens' || pool === 'womens')) {
      const subDivDefs = pool === 'mens'
        ? [{ key: 'Masters Men', label: 'Masters' }, { key: 'Grandmaster Men', label: '60+' }]
        : [{ key: 'Masters Women', label: 'Masters' }, { key: 'Grandmaster Women', label: '60+' }]
      for (const { key, label } of subDivDefs) {
        const subRows = ranked.filter(r => playerInfoMap[r.playerId]?.division === key)
        subRows.sort((a, b) => a.totalPlacement - b.totalPlacement)
        subRows.forEach((r, _, arr) => {
          // Ranking still happens for everyone — only the visible "1st Masters"
          // badge is withheld from players who turned show_division off. The
          // pool itself cannot be opted out of without breaking the standings.
          if (playerInfoMap[r.playerId]?.show_division === false) return
          r.subDivision = label
          r.subDivisionRank = 1 + arr.filter(x => x.totalPlacement < r.totalPlacement).length
        })
      }
    }
    if (!ageFilter && pool === 'juniors') {
      // age_group comes ready-made from the players_public view (U10 0-9,
      // U12 10-11, U14 12-13, U16 14-16). One behaviour change from the
      // pre-v0.5.6.0 code: the old local helper returned 'U16' for ANY age from
      // 14 up, so a player who turned 17 but is still flagged Juniors used to
      // get a U16 badge. The view returns NULL past 16, matching the documented
      // brackets, so they now get no badge, same as a null-DOB junior.
      for (const group of ['U10', 'U12', 'U14', 'U16']) {
        const groupRows = ranked.filter(r => (playerInfoMap[r.playerId]?.age_group ?? null) === group)
        groupRows.sort((a, b) => a.totalPlacement - b.totalPlacement)
        groupRows.forEach((r, _, arr) => {
          r.subDivision = group
          r.subDivisionRank = 1 + arr.filter(x => x.totalPlacement < r.totalPlacement).length
        })
      }
    }

    return ranked
  }

  type EventRow = { playerKey: string; playerName: string; playerId: string | null; rawScore: number; label: string; rank: number }

  function computeEventRows(eventId: string, pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null): EventRow[] {
    const poolResults = getPoolResults(pool, filter, ageFilter).filter(r => r.event_id === eventId)
    const best: Record<string, { name: string; rawScore: number; label: string; playerId: string | null }> = {}
    poolResults.forEach(r => {
      const key = String(r.player_id ?? r.player_name)
      const ex = best[key]
      if (!ex || r.raw_score > ex.rawScore) best[key] = { name: r.player_name, rawScore: r.raw_score, label: r.score_label, playerId: r.player_id }
    })
    const rows = Object.entries(best).map(([key, val]) => ({ playerKey: key, playerName: val.name, playerId: val.playerId, rawScore: val.rawScore, label: val.label }))
    rows.sort((a, b) => b.rawScore - a.rawScore)
    return rows.map((r, _, arr) => ({ ...r, rank: 1 + arr.filter(o => o.rawScore > r.rawScore).length }))
  }

  function chipStyle(active: boolean): React.CSSProperties {
    return {
      padding: '0 14px', minHeight: '44px', borderRadius: '999px', border: `1px solid ${active ? '#2371BB' : '#222'}`,
      display: 'inline-flex', alignItems: 'center',
      fontSize: '12px', fontWeight: active ? 700 : 400, cursor: 'pointer',
      background: active ? '#0d1a2e' : '#111', color: active ? '#7ab4ff' : '#555',
      fontFamily: 'var(--font-label)', flexShrink: 0,
    }
  }

  function renderCompRow(entry: CompRow, isMe: boolean) {
    const isEx = expandedPlayerKey === entry.playerKey && entry.rank <= 3
    const canExpand = entry.rank <= 3
    return (
      <div key={entry.playerKey} style={{
        background: isMe ? '#0d1020' : entry.rank === 1 ? '#0d1a0d' : '#111',
        borderRadius: '10px', overflow: 'hidden', marginBottom: '6px',
        border: `1px solid ${isEx ? '#2371BB' : isMe ? '#2371BB33' : entry.rank === 1 ? '#4DB26E33' : '#1e1e1e'}`,
      }}>
        <button
          disabled={!canExpand}
          onClick={() => canExpand && setExpandedPlayerKey(isEx ? null : entry.playerKey)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
            padding: '10px 14px', background: 'transparent', border: 'none',
            cursor: canExpand ? 'pointer' : 'default',
          }}
        >
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700,
            background: medalBg(entry.rank), color: medalColor(entry.rank),
          }}>{entry.rank}</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: entry.rank <= 3 ? 700 : 400, color: isMe ? '#7ab4ff' : entry.rank <= 3 ? '#fff' : '#aaa' }}>
              {entry.playerName}
              {isMe && <span style={{ fontSize: '10px', color: '#555', marginLeft: '6px', fontFamily: 'var(--font-label)' }}>YOU</span>}
            </div>
            {entry.subDivision && entry.subDivisionRank && (
              <div style={{ fontSize: '10px', color: '#B87DB5', fontFamily: 'var(--font-label)', marginTop: '1px' }}>
                {ordinal(entry.subDivisionRank)} {entry.subDivision}
              </div>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#555', fontFamily: 'var(--font-label)', flexShrink: 0, marginRight: canExpand ? '4px' : '0' }}>
            {entry.totalPlacement} total
          </div>
          {canExpand && <span style={{ color: isEx ? '#2371BB' : '#444', fontSize: '12px' }}>{isEx ? '▲' : '▼'}</span>}
        </button>

        {isEx && (
          <div style={{ borderTop: '1px solid #1e1e1e', padding: '4px 0' }}>
            {entry.eventDetails.map((ed, i) => (
              <div key={ed.eventId} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px',
                background: i % 2 === 0 ? '#0a0a0a' : 'transparent',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{ed.emoji}</span>
                <div style={{ flex: 1, fontSize: '11px', color: '#666' }}>{ed.eventName}</div>
                <div style={{ fontSize: '12px', color: ed.displayLabel ? '#ccc' : '#444' }}>
                  {ed.displayLabel ?? 'No score'}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, minWidth: '32px', textAlign: 'right', color: ed.scoreLabel ? '#F9B051' : '#444', fontFamily: 'var(--font-label)' }}>
                  {ordinal(ed.placement)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderSection(pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null, sectionId: string) {
    const isExpanded = expandedSections[sectionId] ?? false
    const isMyPool = pool === 'mens'
      ? MENS_DIVS.includes(currentPlayerDivision ?? '')
      : pool === 'womens'
        ? WOMENS_DIVS.includes(currentPlayerDivision ?? '')
        : currentPlayerDivision === 'Juniors'

    if (eventFilterId) {
      const evRows = computeEventRows(eventFilterId, pool, filter, ageFilter)
      if (evRows.length === 0) return null
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {evRows.map(entry => (
            <div key={entry.playerKey} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
              background: '#111', borderRadius: '10px', border: '1px solid #1e1e1e',
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, background: medalBg(entry.rank), color: medalColor(entry.rank),
              }}>{entry.rank}</div>
              <div style={{ flex: 1, fontSize: '14px', color: entry.playerId === currentPlayerId ? '#7ab4ff' : '#aaa' }}>
                {entry.playerName}
                {entry.playerId === currentPlayerId && <span style={{ fontSize: '10px', color: '#555', marginLeft: '6px', fontFamily: 'var(--font-label)' }}>YOU</span>}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#4DB26E', fontFamily: 'var(--font-display)' }}>
                {entry.label}
              </div>
            </div>
          ))}
        </div>
      )
    }

    const rows = computeRows(pool, filter, ageFilter)
    if (rows.length === 0) return null

    const top3 = rows.slice(0, 3)
    const rest = rows.slice(3)
    const myRow = isMyPool && currentPlayerId ? rows.find(r => r.playerId === currentPlayerId) : undefined
    const myRowIsBelow = myRow && myRow.rank > 3 && !isExpanded

    return (
      <div>
        {top3.map(e => renderCompRow(e, e.playerId === currentPlayerId))}
        {rest.length > 0 && (
          <button
            onClick={() => setExpandedSections(s => ({ ...s, [sectionId]: !s[sectionId] }))}
            style={{
              width: '100%', padding: '7px', background: 'none',
              border: '1px solid #1e1e1e', borderRadius: '8px', color: '#555',
              fontSize: '12px', cursor: 'pointer', marginBottom: '6px',
              fontFamily: 'var(--font-label)',
            }}
          >
            {isExpanded ? '▲ Show less' : `▼ Show all (${rest.length} more)`}
          </button>
        )}
        {isExpanded && rest.map(e => renderCompRow(e, e.playerId === currentPlayerId))}
        {myRowIsBelow && (
          <>
            <div style={{ textAlign: 'center', color: '#333', fontSize: '11px', margin: '4px 0', letterSpacing: '3px' }}>• • •</div>
            {renderCompRow(myRow, true)}
          </>
        )}
      </div>
    )
  }

  const selectedEvent = eventFilterId ? events.find(e => e.id === eventFilterId) : null

  return (
    <div style={{ padding: '12px 16px' }}>

      {/* Event filter */}
      <div style={{ marginBottom: '16px' }}>
        <select
          value={eventFilterId ?? ''}
          onChange={e => { setEventFilterId(e.target.value || null); setExpandedPlayerKey(null) }}
          style={{
            width: '100%', background: eventFilterId ? '#0d1a2e' : '#0d0d0d',
            border: `1px solid ${eventFilterId ? '#2371BB' : '#222'}`,
            borderRadius: '8px', padding: '10px 14px',
            color: eventFilterId ? '#7ab4ff' : '#666',
            fontSize: '14px', fontFamily: 'var(--font-body)',
          }}
        >
          <option value="">Overall ranking</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.event_name}</option>)}
        </select>
        {selectedEvent && (
          <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', fontFamily: 'var(--font-label)', letterSpacing: '0.06em' }}>
            SHOWING SCORES FOR: {selectedEvent.event_name.toUpperCase()}
          </div>
        )}
      </div>

      {/* Men's section — always shown */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
            {menFilter === 'Masters Men' ? 'Masters (Men)' : menFilter === 'Grandmaster Men' ? '60+ (Men)' : "Men's"}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => { setMenFilter(null); setExpandedPlayerKey(null) }} style={chipStyle(menFilter === null)}>All</button>
            <button onClick={() => { setMenFilter(menFilter === 'Masters Men' ? null : 'Masters Men'); setExpandedPlayerKey(null) }} style={chipStyle(menFilter === 'Masters Men')}>Masters</button>
            <button onClick={() => { setMenFilter(menFilter === 'Grandmaster Men' ? null : 'Grandmaster Men'); setExpandedPlayerKey(null) }} style={chipStyle(menFilter === 'Grandmaster Men')}>60+</button>
          </div>
        </div>
        {renderSection('mens', menFilter, null, 'mens') ?? (
          <div style={{ color: '#555', fontSize: '13px', padding: '12px 0', fontFamily: 'var(--font-label)' }}>No scores yet</div>
        )}
      </div>

      {/* Women's section — always shown */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
            {womenFilter === 'Masters Women' ? 'Masters (Women)' : womenFilter === 'Grandmaster Women' ? '60+ (Women)' : "Women's"}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => { setWomenFilter(null); setExpandedPlayerKey(null) }} style={chipStyle(womenFilter === null)}>All</button>
            <button onClick={() => { setWomenFilter(womenFilter === 'Masters Women' ? null : 'Masters Women'); setExpandedPlayerKey(null) }} style={chipStyle(womenFilter === 'Masters Women')}>Masters</button>
            <button onClick={() => { setWomenFilter(womenFilter === 'Grandmaster Women' ? null : 'Grandmaster Women'); setExpandedPlayerKey(null) }} style={chipStyle(womenFilter === 'Grandmaster Women')}>60+</button>
          </div>
        </div>
        {renderSection('womens', womenFilter, null, 'womens') ?? (
          <div style={{ color: '#555', fontSize: '13px', padding: '12px 0', fontFamily: 'var(--font-label)' }}>No scores yet</div>
        )}
      </div>

      {/* Juniors section — always shown */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', marginBottom: '8px' }}>
            {juniorAge !== null ? `Juniors — Age ${juniorAge}` : 'Juniors'}
          </div>
          {juniorAges.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => { setJuniorAge(null); setExpandedPlayerKey(null) }} style={chipStyle(juniorAge === null)}>All</button>
              {juniorAges.map(age => (
                <button key={age} onClick={() => { setJuniorAge(age === juniorAge ? null : age); setExpandedPlayerKey(null) }} style={chipStyle(juniorAge === age)}>
                  Age {age}
                </button>
              ))}
            </div>
          )}
        </div>
        {renderSection('juniors', null, juniorAge, 'juniors') ?? (
          <div style={{ color: '#555', fontSize: '13px', padding: '12px 0', fontFamily: 'var(--font-label)' }}>No scores yet</div>
        )}
      </div>
    </div>
  )
}

// ─── Session-end takeover (DR-1) + session milestones (DR-7) ──────────────────

const RAINBOW_G = 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)'

type EndSummary = { overall_placement: number }

function SessionEndTakeover({
  sessionId, playerId, events, myResults, divisionPlacement, onDismiss,
}: {
  sessionId: string
  playerId: string
  events: SessionEvent[]
  myResults: Result[]
  divisionPlacement: { rank: number; divisionName: string; playerCount: number } | null
  onDismiss: () => void
}) {
  const [summary, setSummary] = useState<EndSummary | null>(null)
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [newColours, setNewColours] = useState<ConferredColour[]>([])

  // Lock body scroll while the takeover is open (same pattern as the sheet)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    async function load() {
      const [sumRes, cntRes] = await Promise.all([
        supabase.from('session_player_summary')
          .select('overall_placement')
          .eq('session_id', sessionId).eq('player_id', playerId).maybeSingle(),
        supabase.from('session_player_summary')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', playerId),
      ])

      setSummary((sumRes.data as EndSummary | null) ?? null)
      setSessionCount(cntRes.count ?? 0)
      setLoaded(true)
    }
    load()
  }, [sessionId, playerId])

  // The colour lands HERE, while the player is still in the room — the moment
  // the whole grading system is built around (spec decision 7). `force`,
  // because the game closed seconds ago and the cheap watermark on the server
  // may not have caught up with it yet.
  //
  // Its own effect: a slow or failed recheck must not hold up the placement
  // and PRs above, which are what most players open this screen for.
  useEffect(() => {
    let cancelled = false
    void recheckGrades({ playerId, force: true })
      .then(r => { if (!cancelled) setNewColours(r.conferred) })
    return () => { cancelled = true }
  }, [playerId])

  // Points are retired. What a game gives a player now is its placement,
  // the events they played and the PRs they set.
  const rank = summary?.overall_placement ?? divisionPlacement?.rank ?? null
  const eventsPlayed = new Set(myResults.map(r => r.event_id)).size
  const prCount = new Set(myResults.filter(r => r.is_pr).map(r => r.event_id)).size

  // Session-count milestone — summary row present means the count includes this session
  const sessionNumber = sessionCount === null ? null : (summary ? sessionCount : sessionCount + 1)
  const milestone = sessionNumber !== null && [10, 25, 50].includes(sessionNumber) ? sessionNumber : null

  const prs = myResults.filter(r => r.is_pr)
  const eventNameFor = (eid: string) => events.find(e => e.id === eid)?.event_name ?? 'Event'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'absolute', inset: 0, margin: '0 auto', width: 'min(640px, 100vw)',
        display: 'flex', flexDirection: 'column', background: '#101010',
        borderLeft: '1px solid #1e1e1e', borderRight: '1px solid #1e1e1e',
        animation: 'takeoverUp 0.34s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ height: '4px', flexShrink: 0, background: RAINBOW_G }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 18px 8px', flexShrink: 0 }}>
          <div style={{ flex: 1, fontFamily: 'var(--font-label)', fontSize: '12px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            Session complete
          </div>
          <button onClick={onDismiss} style={{
            width: '38px', height: '38px', borderRadius: '10px', cursor: 'pointer', flexShrink: 0,
            background: '#181818', border: '1px solid #2a2a2a', color: '#999', fontSize: '15px',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '0 18px 24px', flex: 1 }}>

          {/* Final placement */}
          <div style={{ textAlign: 'center', padding: '18px 0 22px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '72px', lineHeight: 1, color: '#fff', letterSpacing: '0.02em' }}>
              {rank !== null ? ordinal(rank) : '—'}
            </div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: '6px' }}>
              {divisionPlacement ? divisionPlacement.divisionName : 'This session'}
            </div>
          </div>

          {/* What the game gave */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { label: 'Events played', value: `${eventsPlayed}/${events.length || 10}`, colour: '#4DB26E' },
              { label: 'PRs set', value: prCount, colour: '#F9B051' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: '#161616', border: '1px solid #1e1e1e', borderRadius: '14px', padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: s.colour, lineHeight: 1 }}>{loaded ? s.value : '…'}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '10.5px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {loaded && !summary && (
            <div style={{ fontSize: '11.5px', color: '#555', marginTop: '6px', textAlign: 'center' }}>
              Provisional placement — confirmed when the game is closed off
            </div>
          )}

          {/* PRs set today */}
          {prs.length > 0 && (
            <>
              <div style={{ ...SHEET_LBL, color: '#F9B051' }}>PRs set today</div>
              {prs.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#161616', border: '1px solid #F9B05133', borderRadius: '12px', padding: '10px 14px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#F9B051', background: '#F9B05122', borderRadius: '4px', padding: '2px 6px', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', flexShrink: 0 }}>PR</span>
                  <span style={{ flex: 1, fontSize: '14px', color: '#fff' }}>{eventNameFor(r.event_id)}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: '#F9B051' }}>{r.score_label}</span>
                </div>
              ))}
            </>
          )}

          {/* Colours earned today. Conferred by the server while this screen
              was opening, so it is a fact by the time it is announced, not a
              promise that a kaiwhakawā will get to it later. */}
          {newColours.length > 0 && (
            <>
              <div style={{ ...SHEET_LBL, color: '#4DB26E' }}>
                {newColours.length > 1 ? 'New colours' : 'New colour'}
              </div>
              {newColours.map(c => {
                const g = gradeForRung(c.rung)
                return (
                  <div key={`${c.domainNumber}:${c.rung}`} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', background: '#161616',
                    border: '1px solid #4DB26E33', borderRadius: '12px', padding: '10px 14px', marginBottom: '6px',
                  }}>
                    <GradeDot grade={g} size={14} />
                    <span style={{ flex: 1, fontSize: '14px', color: '#fff' }}>{c.name}</span>
                    <span style={{ fontSize: '13px', color: '#888' }}>
                      {DOMAIN_ORDER[c.domainNumber - 1]}
                    </span>
                  </div>
                )
              })}
            </>
          )}

          <a href="/dashboard" style={{
            display: 'block', marginTop: '18px', background: '#161616', border: '1px solid #1e1e1e',
            borderRadius: '14px', padding: '14px 16px', color: '#fff', textDecoration: 'none',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '0.04em' }}>Your colours</div>
            <div style={{ fontSize: '13px', color: '#888', marginTop: '3px', lineHeight: 1.5 }}>
              See what today&apos;s scores did for your colour in each domain →
            </div>
          </a>

          {/* Session-count milestone */}
          {milestone !== null && (
            <div style={{ marginTop: '14px', background: '#1f1608', border: '1px solid #F9B051', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#F9B051', letterSpacing: '0.04em' }}>
                Milestone — your {ordinal(milestone)} session
              </div>
              <div style={{ fontSize: '13px', color: '#ccc', marginTop: '4px', lineHeight: 1.5 }}>
                {milestone === 10
                  ? 'Ten AllSport sessions played. If a friend invited you, their referral just qualified — you count towards their koha tier now.'
                  : `${milestone} AllSport sessions played. Ka rawe — keep showing up.`}
              </div>
            </div>
          )}

          {/* Full report link */}
          <a href={`/games/${sessionId}`} style={{
            display: 'block', textAlign: 'center', marginTop: '18px', padding: '13px 0',
            borderRadius: '999px', border: '1px solid #2a2a2a', background: '#181818',
            color: '#fff', textDecoration: 'none', fontFamily: 'var(--font-label)',
            textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '14px',
          }}>Full game report →</a>

          <button onClick={onDismiss} style={{
            width: '100%', marginTop: '10px', height: '54px', border: 'none', borderRadius: '999px',
            cursor: 'pointer', background: RAINBOW_G, color: '#0a0a0a',
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            letterSpacing: '0.12em', fontSize: '16px', fontWeight: 600,
          }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// One stable empty map, so a not-yet-loaded PR set keeps the same identity across renders.
const NO_PRS: Record<string, number | string | null> = {}

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [player, setPlayer] = useState<Record<string, unknown> | null>(null)
  const [familyMembers, setFamilyMembers] = useState<Record<string, unknown>[]>([])
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
  // The signed-in account, which is who WRITES a swap workout (logged_by).
  // Distinct from activePlayerId, which is whose tab is open: a parent scoring
  // for their child writes the child's workout under their own id.
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  // Keyed by the player and events they were loaded for (see prsKey below), so a
  // family-tab switch never shows the previous player's PRs, without resetting
  // state inside the loading effect.
  const [seasonPRsLoaded, setSeasonPRsLoaded] = useState<{ key: string; prs: Record<string, number | string | null> } | null>(null)
  const [activeTab, setActiveTab] = useState<string>('leaderboard')
  const [sheetEventId, setSheetEventId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ eventName: string; label: string; isPR: boolean; isNewEvent: boolean; playerName?: string } | null>(null)
  // All-time played event names, for "new event unlocked". Keyed by player, so a
  // switch reads as "not loaded yet" (null) until that player's set arrives.
  const [playedLoaded, setPlayedLoaded] = useState<{ id: string; names: Set<string> } | null>(null)
  const [fullHousePulseId, setFullHousePulseId] = useState<string | null>(null)
  // The takeover key this page dismissed; localStorage covers earlier visits.
  const [takeoverDismissedKey, setTakeoverDismissedKey] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [preSessionSecsLeft, setPreSessionSecsLeft] = useState<number | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [playerInfoMap, setPlayerInfoMap] = useState<Record<string, PlayerInfo>>({})
  const [isJudge, setIsJudge] = useState(false)
  const [judgeTargetId, setJudgeTargetId] = useState<string>('')
  const [judgeGuestName, setJudgeGuestName] = useState('')
  const [judgeShowAll, setJudgeShowAll] = useState(false)   // full registered-player picker expanded
  const [judgeGuestDraft, setJudgeGuestDraft] = useState('') // "+ Guest" name field; '' = field hidden
  const [judgeGuestOpen, setJudgeGuestOpen] = useState(false)
  const [sessionPlayers, setSessionPlayers] = useState<{ id: string; name: string }[]>([])
  // Keyed like seasonPRsLoaded: switching target is one chip tap, so the previous
  // player's PRs must never linger as the new player's "Season PR".
  const [judgePRsLoaded, setJudgePRsLoaded] = useState<{ key: string; prs: Record<string, number | string | null> } | null>(null)

  const eventsKey = events.map(e => e.id).join(',')
  const seasonPRsKey = activePlayerId && events.length > 0 ? `${activePlayerId}|${eventsKey}` : null
  const seasonPRs = seasonPRsKey && seasonPRsLoaded?.key === seasonPRsKey ? seasonPRsLoaded.prs : NO_PRS
  const judgePRsKey = isJudge && judgeTargetId && events.length > 0 ? `${judgeTargetId}|${eventsKey}` : null
  const judgePRs = judgePRsKey && judgePRsLoaded?.key === judgePRsKey ? judgePRsLoaded.prs : NO_PRS
  const playedEventNames = activePlayerId && playedLoaded?.id === activePlayerId ? playedLoaded.names : null

  const allPlayers = player ? [player, ...familyMembers] : []
  const activePlayer = allPlayers.find(p => p.id === activePlayerId) ?? player
  const activePlayerDivision = activePlayer ? (activePlayer as Record<string, unknown>).division as string | null : null

  // ── Kaiwhakawā roster ──────────────────────────────────────────────────────
  const judgeRoster = useMemo(
    () => buildJudgeRoster(results, sessionPlayers),
    [results, sessionPlayers],
  )

  // Currently selected scoring target — a registered player, a guest, or nobody
  const judgeTarget = useMemo(
    () => resolveJudgeTarget(judgeTargetId, judgeGuestName, sessionPlayers, results),
    [judgeTargetId, judgeGuestName, sessionPlayers, results],
  )

  // Swapped and extra events for whoever's tab is open. ONE hook at page level
  // rather than one per tab: the player tabs are rendered inside a map, where a
  // hook cannot go. A guest has no id and so cannot swap — their scores are the
  // kaiwhakawā's record, and a workout needs an owner.
  const swapPlayerId = activeTab.startsWith('player-')
    ? activeTab.slice('player-'.length)
    : activeTab === 'judge' ? (judgeTarget?.id ?? null)
    : null
  const swaps = useGameSwaps({
    sessionId: sessionId as string,
    playerId: swapPlayerId,
    userId: authUserId,
    sessionOpen: !sessionEnded,
  })
  // The domain whose + was tapped: its sheet of events to add is open.
  const [addingDomain, setAddingDomain] = useState<DomainGroup | null>(null)

  // The NZ day this game belongs to, for resolving a bodyweight declaration.
  // sessions.session_date is trigger-derived from started_at at
  // Pacific/Auckland (20260902020602) and is the same day the grading engine
  // resolves against; deriving it here from the device clock instead would put
  // the two a day apart for anyone on a mis-set phone.
  const sessionDay = useMemo(() => {
    const d = session?.session_date
    return typeof d === 'string' && d ? d : toNZDateString(new Date())
  }, [session])

  // What colouring a score needs for whoever's tab is open: division, age and
  // the day's bodyweight. Same player as the swaps store, so a guest gets none.
  const gradeProfile = useGradeProfile(swapPlayerId, sessionDay)

  // Every roster row's scored-event set, computed once per results change
  const rosterScored = useMemo(
    () => scoredEventIdsByTarget(results, events.map(ev => ev.id)),
    [results, events],
  )

  function selectJudgeTarget(sel: { id?: string; guestName?: string } | null) {
    setJudgeTargetId(sel?.id ?? '')
    setJudgeGuestName(sel?.guestName ?? '')
    setSheetEventId(null)
    setJudgeShowAll(false)
    setJudgeGuestOpen(false)
    setJudgeGuestDraft('')
  }

  // ── Division placement for banner ──────────────────────────────────────────
  const myDivisionPlacement = useMemo(() => {
    if (!activePlayerId) return null
    const myInfo = playerInfoMap[activePlayerId]
    if (!myInfo) return null
    const myDivision = myInfo.division
    if (!myDivision) return null

    const myResults = results.filter(r => r.player_id === activePlayerId)
    if (myResults.length === 0) return null

    const divResults = results.filter(r => r.player_id && playerInfoMap[r.player_id]?.division === myDivision)
    const playerIds = [...new Set(divResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (!playerIds.includes(activePlayerId)) return null

    const placements = playerIds.map(pid => {
      let total = 0
      events.forEach(ev => {
        const evDivRes = divResults.filter(r => r.event_id === ev.id)
        const best: Record<string, number> = {}
        evDivRes.forEach(r => {
          if (!r.player_id) return
          const ex = best[r.player_id]
          if (ex === undefined || r.raw_score > ex) best[r.player_id] = r.raw_score
        })
        const scorerCount = Object.keys(best).length
        const myBest = best[pid]
        if (myBest === undefined) total += scorerCount + 1
        else total += 1 + Object.values(best).filter(b => b > myBest).length
      })
      return { pid, total }
    })
    placements.sort((a, b) => a.total - b.total)
    const myEntry = placements.find(p => p.pid === activePlayerId)
    if (!myEntry) return null
    const rank = 1 + placements.filter(p => p.total < myEntry.total).length
    return { rank, divisionName: myDivision, playerCount: playerIds.length }
  }, [activePlayerId, results, events, playerInfoMap])

  // ── DR-10: flash the banner ordinal when a new result improves division rank ─
  // No flash on first paint, on player switch, or on rank drops.
  // The previous rank is tracked in state and compared during render (React's
  // "storing information from previous renders" pattern), not in an effect.
  const currentRank = myDivisionPlacement?.rank ?? null
  const [rankSeen, setRankSeen] = useState<{ pid: string | null; rank: number | null }>({ pid: activePlayerId, rank: currentRank })
  const [rankFlash, setRankFlash] = useState<{ from: number; to: number } | null>(null)
  if (rankSeen.pid !== activePlayerId || rankSeen.rank !== currentRank) {
    setRankSeen({ pid: activePlayerId, rank: currentRank })
    const improved = rankSeen.pid === activePlayerId && rankSeen.rank !== null && currentRank !== null && currentRank < rankSeen.rank
    // A switch, a drop or a sideways change clears any flash still up.
    setRankFlash(improved ? { from: rankSeen.rank!, to: currentRank! } : null)
  }
  useEffect(() => {
    if (!rankFlash) return
    const t = setTimeout(() => setRankFlash(null), 2600)
    return () => clearTimeout(t)
  }, [rankFlash])

  // ── Load initial data ──────────────────────────────────────────────────────
  const loadResults = useCallback(async () => {
    const { data } = await supabase.from('results').select('*').eq('session_id', sessionId)
    if (data) setResults(data as Result[])
  }, [sessionId])

  useEffect(() => {
    const load = async () => {
      // Reads the locally stored session — no network round trip. See the note
      // on getSessionUser() in lib/supabase-browser.ts.
      const authUser = await getSessionUser()
      setAuthUserId(authUser?.id ?? null)

      // Every query below needs either sessionId (known before this effect ran)
      // or authUser.id (known now), and none of them needs another one's answer.
      // They used to run as five sequential awaits, so the screen a player opens
      // standing in the gym cost five serial round trips before it rendered
      // anything — ~250ms each warm, and PERF_AGGREGATION_PLAN.md measured
      // 1–2.8s each when the backend is cold or requests contend. One wave now.
      //
      // supabase-js resolves to { data, error } instead of rejecting, so one
      // failing query cannot reject the whole wave and lose the others.
      //
      // Landing them together also collapses what were five separate renders
      // into one, so the page no longer paints half-loaded intermediate states.
      const [playerRes, childrenRes, sessionRes, eventsRes] = await Promise.all([
        authUser
          ? supabase.from('players').select('*').eq('id', authUser.id).single()
          : Promise.resolve({ data: null }),
        authUser
          ? supabase.from('players').select('*').eq('parent_id', authUser.id).order('full_name')
          : Promise.resolve({ data: null }),
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('session_events').select('*').eq('session_id', sessionId).order('domain_number'),
        // Sets its own state; it is in the wave for the round trip, not a value.
        loadResults(),
      ])

      // `authUser &&` is redundant at runtime — playerRes.data is only non-null
      // when there was a user to query for — but it keeps `landOn` below free of
      // a non-null assertion, so the guard is visible rather than inferred.
      const p = playerRes.data
      if (authUser && p) {
        setPlayer(p as Record<string, unknown>)
        const children = childrenRes.data
        setFamilyMembers((children ?? []) as Record<string, unknown>[])

        // Land on the tab of whoever the rest of the app is currently showing.
        // A parent who switched to their child on the stats page and then taps
        // PLAY expects to arrive on that child, not to hunt for them again.
        //
        // Only honoured when the stored id is genuinely one of this account's
        // children — localStorage is user-editable, and the scoring screen is
        // the one place where landing on the wrong tab could mis-attribute a
        // score. Attribution itself is unchanged: a submission still belongs to
        // whichever tab you are on.
        let landOn = authUser.id
        try {
          const stored = window.localStorage.getItem('allsport_active_player_id')
          if (stored && (children ?? []).some(c => (c as { id: string }).id === stored)) {
            landOn = stored
          }
        } catch {
          // Blocked site data. Fall back to the account holder.
        }
        setActivePlayerId(landOn)
        setActiveTab(`player-${landOn}`) // leaderboard stays one tap away
        if ((p as Record<string, unknown>).role === 'judge') setIsJudge(true)
      }

      const s = sessionRes.data
      setSession(s as Record<string, unknown> | null)
      if (s && !(s as Record<string, unknown>).is_active) setSessionEnded(true)

      setEvents((eventsRes.data ?? []) as SessionEvent[])
    }
    load()
  }, [sessionId, loadResults])

  // ── Load player info for leaderboard ──────────────────────────────────────
  useEffect(() => {
    if (results.length === 0) return
    const ids = [...new Set(results.map(r => r.player_id).filter(Boolean))] as string[]
    if (ids.length === 0) return
    supabase.from('players_public').select('id, division, age_years, age_group, show_division').in('id', ids).then(({ data }) => {
      if (!data) return
      const map: Record<string, PlayerInfo> = {}
      data.forEach(p => {
        map[p.id] = {
          division: p.division ?? '',
          age_years: p.age_years ?? null,
          age_group: p.age_group ?? null,
          show_division: p.show_division !== false,
        }
      })
      setPlayerInfoMap(map)
    })
  }, [results])

  // ── Load ALL registered players for judge dropdown ─────────────────────────
  useEffect(() => {
    if (!isJudge) return
    supabase.from('players_public').select('id, display_name, username, full_name').order('display_name', { ascending: true }).then(({ data }) => {
      if (!data) return
      setSessionPlayers(data.map(p => ({
        id: p.id,
        // display_name is coalesced inside the view so it is never blank;
        // full_name is NULL unless that player opted into showing it.
        name: (p.display_name || p.username || p.full_name || 'Unknown') as string,
      })))
    })
  }, [isJudge])

  // ── When the game closes, refresh everyone's leaderboard numbers ───────────
  // Domain colours and season points are written by the recheck route, which otherwise
  // only runs when a player opens their own screens. A player who leaves
  // without looking would sit on the board with last week's numbers, so the
  // kaiwhakawā's screen asks for every registered player in the game. Once per
  // game per device; best-effort, like every recheck.
  const refreshedBoardFor = useRef<string | null>(null)
  useEffect(() => {
    if (!sessionEnded || !isJudge || refreshedBoardFor.current === sessionId) return
    const ids = [...new Set(results.map(r => r.player_id).filter((id): id is string => !!id))]
    if (ids.length === 0) return
    refreshedBoardFor.current = sessionId
    void (async () => {
      for (let i = 0; i < ids.length; i += 5) {
        await Promise.all(ids.slice(i, i + 5).map(id => recheckGrades({ playerId: id, force: true })))
      }
    })()
  }, [sessionEnded, isJudge, results, sessionId])

  // ── Load season PRs for active player ─────────────────────────────────────
  useEffect(() => {
    if (!activePlayerId || !seasonPRsKey) return
    const key = seasonPRsKey
    let cancelled = false // a fast A→B→A switch can resolve out of order
    const year = new Date().getFullYear()
    async function loadPRs() {
      const { data } = await supabase
        .from('results')
        .select('raw_score, session_events!inner(event_name, input_mode), sessions!inner(session_date)')
        .eq('player_id', activePlayerId)
        .not('raw_score', 'is', null)
      const byName: Record<string, number> = {}
      for (const r of (data ?? []) as any[]) {
        if (!r.sessions?.session_date || parseLocalDate(r.sessions.session_date).getFullYear() !== year) continue
        const evName = r.session_events?.event_name
        if (!evName || r.raw_score === null) continue
        // Higher raw_score is always better — time/sprint store negative seconds,
        // so max still picks the fastest (min would pick the SLOWEST as "PR")
        const existing = byName[evName]
        if (existing === undefined || r.raw_score > existing) byName[evName] = r.raw_score
      }
      const prs: Record<string, number | string | null> = {}
      events.forEach(ev => { prs[ev.id] = byName[ev.event_name] ?? null })
      if (!cancelled) setSeasonPRsLoaded({ key, prs })
    }
    loadPRs()
    return () => { cancelled = true }
    // seasonPRsKey already carries activePlayerId and the event ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonPRsKey])

  // ── Load PRs for judge's selected player ──────────────────────────────────
  useEffect(() => {
    // judgePRs is derived from judgePRsKey, so a switch already shows nothing
    // until this target's PRs arrive.
    if (!judgePRsKey) return
    const key = judgePRsKey
    let cancelled = false // a fast A→B→A switch can resolve out of order
    const year = new Date().getFullYear()
    async function loadJudgePRs() {
      const { data } = await supabase
        .from('results')
        .select('raw_score, session_events!inner(event_name, input_mode), sessions!inner(session_date)')
        .eq('player_id', judgeTargetId)
        .not('raw_score', 'is', null)
      const byName: Record<string, number> = {}
      for (const r of (data ?? []) as any[]) {
        if (!r.sessions?.session_date || parseLocalDate(r.sessions.session_date).getFullYear() !== year) continue
        const evName = r.session_events?.event_name
        if (!evName || r.raw_score === null) continue
        // Higher raw_score is always better (see player PR loader above)
        const existing = byName[evName]
        if (existing === undefined || r.raw_score > existing) byName[evName] = r.raw_score
      }
      const prs: Record<string, number | string | null> = {}
      events.forEach(ev => { prs[ev.id] = byName[ev.event_name] ?? null })
      if (!cancelled) setJudgePRsLoaded({ key, prs })
    }
    loadJudgePRs()
    return () => { cancelled = true }
    // judgePRsKey already carries isJudge, judgeTargetId and the event ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgePRsKey])

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`scoring-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` }, () => loadResults())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, p => {
        const updated = p.new as Record<string, unknown>
        if (updated.is_active === false) setSessionEnded(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId, loadResults])

  // Polling fallback — refreshes every 15s in case realtime drops
  useEffect(() => {
    const id = setInterval(loadResults, 15000)
    return () => clearInterval(id)
  }, [loadResults])

  // ── All-time played events for the active player (new-event-unlocked toast) ─
  // Loaded once per player; includes this session's earlier submissions, so only
  // a genuinely first-ever score for an event counts as "new".
  useEffect(() => {
    if (!activePlayerId) return
    const id = activePlayerId
    let cancelled = false
    supabase
      .from('results')
      .select('session_events!inner(event_name)')
      .eq('player_id', activePlayerId)
      .then(({ data }) => {
        const names = new Set<string>()
        for (const r of (data ?? []) as any[]) {
          const n = r.session_events?.event_name
          if (n) names.add(n)
        }
        if (!cancelled) setPlayedLoaded({ id, names })
      })
    return () => { cancelled = true }
  }, [activePlayerId])

  // ── Session-end takeover: dismissed per player per session via localStorage ─
  const takeoverKey = sessionEnded && activePlayerId ? `allsport_postgame_${sessionId}_${activePlayerId}` : null
  const endTakeoverDismissed = useMemo(() => {
    if (!takeoverKey) return true
    if (takeoverDismissedKey === takeoverKey) return true
    try { return !!localStorage.getItem(takeoverKey) } catch { return true }
  }, [takeoverKey, takeoverDismissedKey])

  // ── One-time celebration moment (all events scored) ────────────────────────
  // Each fires once per player per session, guarded via localStorage.
  useEffect(() => {
    if (!activePlayerId || events.length === 0 || sessionEnded) return
    const mine = results.filter(r => r.player_id === activePlayerId)
    if (mine.length === 0) return

    const allScored = events.every(ev => mine.some(r => r.event_id === ev.id))
    if (allScored) {
      const key = `allsport_fullhouse_${sessionId}_${activePlayerId}`
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1')
        // Shown from a timer rather than synchronously in the effect. The key is
        // already written, so neither timer is cancelled on a re-run: cancelling
        // would lose a moment that can never fire again.
        const pid = activePlayerId
        setTimeout(() => setFullHousePulseId(pid), 0)
        setTimeout(() => setFullHousePulseId(null), 3200)
      }
    }
  }, [results, events, activePlayerId, sessionId, sessionEnded])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = session as Record<string, unknown> | null
    if (!s?.started_at) return
    const startTs = new Date(s.started_at as string).getTime()
    const endTs = startTs + 100 * 60 * 1000
    let closedByTimer = false
    const tick = () => {
      const now = Date.now()
      if (now < startTs) {
        setPreSessionSecsLeft(Math.ceil((startTs - now) / 1000))
        setTimeLeft(null)
      } else {
        setPreSessionSecsLeft(null)
        const remaining = Math.max(0, Math.floor((endTs - now) / 1000))
        setTimeLeft(remaining)
        if (remaining === 0 && !closedByTimer && s.is_active) {
          closedByTimer = true
          setSessionEnded(true)
          // RPC, not a direct update. `sessions_update_judge` is the only UPDATE
          // policy on sessions, so the old `.update()` here silently affected
          // zero rows for every player — the session only ever closed if a
          // kaiwhakawā happened to have this screen open at the exact minute the
          // clock ran out, and otherwise stayed open forever awarding nobody
          // anything. close_expired_sessions() derives expiry from started_at
          // server-side, so it is safe for any viewer to call.
          supabase.rpc('close_expired_sessions').then(({ error }) => {
            if (error) console.error('close_expired_sessions failed', error)
          })
        }
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [session, sessionId])

  // ── Derived ────────────────────────────────────────────────────────────────
  const timerColour = preSessionSecsLeft !== null
    ? '#B87DB5'
    : timeLeft !== null
      ? timeLeft < 600 ? '#EA4742' : timeLeft < 1800 ? '#F9B051' : '#4DB26E'
      : '#4DB26E'

  const timerDisplay = sessionEnded
    ? 'ENDED'
    : preSessionSecsLeft !== null
      ? fmtCountdown(preSessionSecsLeft)
      : timeLeft !== null
        ? fmtCountdown(timeLeft)
        : '--:--'

  const bannerStatusLabel = sessionEnded
    ? 'SESSION ENDED'
    : preSessionSecsLeft !== null
      ? 'STARTING SOON'
      : activePlayerDivision
        ? activePlayerDivision.toUpperCase()
        : 'LIVE SESSION'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '640px', margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes toastPop { 0% { transform: translateX(-50%) scale(0.92); opacity: 0; } 60% { transform: translateX(-50%) scale(1.04); } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
        @keyframes barShimmer { from { left: -45%; } to { left: 105%; } }
        @keyframes takeoverUp { from { transform: translateY(6%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes rankImprove { 0% { transform: translateY(45%); opacity: 0; } 40% { transform: translateY(0); opacity: 1; } 55% { color: #F9E051; } 100% { color: #fff; } }
      `}</style>

      {/* Top banner — Placement + Timer */}
      <div style={{ background: '#2371BB', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', fontFamily: 'var(--font-label)' }}>
              {bannerStatusLabel}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.05em', lineHeight: 1 }}>
              {rankFlash ? (
                <span style={{ display: 'inline-block', animation: 'rankImprove 1.4s cubic-bezier(0.16,1,0.3,1)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '22px' }}>{ordinal(rankFlash.from)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '22px', margin: '0 6px' }}>→</span>
                  {ordinal(rankFlash.to)}
                </span>
              ) : (
                myDivisionPlacement ? ordinal(myDivisionPlacement.rank) : '—'
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', fontFamily: 'var(--font-label)' }}>
              Time Left
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: timerColour, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
              {timerDisplay}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: '3px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', overflowX: 'auto', background: '#0a0a0a', position: 'sticky', top: '60px', zIndex: 9 }}>
        {allPlayers.map(p => {
          const pid = p.id as string
          const label = (p.display_name || p.username || p.full_name) as string
          const tabId = `player-${pid}`
          const active = activeTab === tabId
          return (
            <button key={pid} onClick={() => { setActiveTab(tabId); setActivePlayerId(pid); setSheetEventId(null) }}
              style={{
                padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '13px', fontWeight: active ? 700 : 400, flexShrink: 0,
                background: active ? '#111' : 'transparent',
                color: active ? '#fff' : '#555',
                borderBottom: `2px solid ${active ? '#2371BB' : 'transparent'}`,
              }}>
              {label}
            </button>
          )
        })}
        <button onClick={() => { setActiveTab('leaderboard'); setSheetEventId(null) }}
          style={{
            padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: '13px', fontWeight: activeTab === 'leaderboard' ? 700 : 400, flexShrink: 0,
            background: activeTab === 'leaderboard' ? '#111' : 'transparent',
            color: activeTab === 'leaderboard' ? '#fff' : '#555',
            borderBottom: `2px solid ${activeTab === 'leaderboard' ? '#2371BB' : 'transparent'}`,
          }}>
          Leaderboard
        </button>
        {isJudge && (
          <button onClick={() => { setActiveTab('judge-mode'); setSheetEventId(null) }}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '13px', fontWeight: activeTab === 'judge-mode' ? 700 : 400, flexShrink: 0,
              background: activeTab === 'judge-mode' ? '#111' : 'transparent',
              color: activeTab === 'judge-mode' ? '#EA4742' : '#555',
              borderBottom: `2px solid ${activeTab === 'judge-mode' ? '#EA4742' : 'transparent'}`,
            }}>
            Kaiwhakawā
          </button>
        )}
        {isJudge && (
          <button onClick={() => setActiveTab('judge-summary')}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '13px', fontWeight: activeTab === 'judge-summary' ? 700 : 400, flexShrink: 0,
              background: activeTab === 'judge-summary' ? '#111' : 'transparent',
              color: activeTab === 'judge-summary' ? '#EA4742' : '#555',
              borderBottom: `2px solid ${activeTab === 'judge-summary' ? '#EA4742' : 'transparent'}`,
            }}>
            Summary
          </button>
        )}
      </div>

      {/* Player tabs */}
      {allPlayers.map(p => {
        const pid = p.id as string
        const tabId = `player-${pid}`
        if (activeTab !== tabId) return null
        const pName = (p.display_name || p.username || p.full_name) as string
        const pDivision = (p.division as string | null) ?? null
        const myResults = results.filter(r => r.player_id === pid)
        const scoredIds = new Set(events.filter(ev => myResults.some(r => r.event_id === ev.id)).map(ev => ev.id))
        const doneEvents = events.filter(ev => scoredIds.has(ev.id))
        // The ten, plus whatever this player swapped in or added on top.
        const slots: PlaySlot[] = playList(events, swaps.chosen)
        const slotRows = (slot: PlaySlot) => slot.kind === 'official'
          ? results.filter(r => r.event_id === slot.se.id && r.player_id === pid)
          : swaps.entriesFor(slot.se.id)
        // A swapped domain fills its segment: the bar is the player's own
        // progress. The placement banner is untouched, because a swapped event
        // is still ranked last.
        const covered = domainsCovered(events, scoredIds, swaps.scoredSlugs)
        const barScored = new Set(events.filter(ev => covered.has(ev.domain_number)).map(ev => ev.id))
        const sheetSlot = sheetEventId ? slots.find(sl => sl.se.id === sheetEventId) : undefined
        const sheetEvent = sheetSlot?.kind === 'official' ? events.find(e => e.id === sheetEventId) : undefined
        const eventDataFor = (slot: PlaySlot) => slot.kind === 'official' ? getEventByName(slot.se.event_name) : getEventBySlug(slot.se.event_slug)
        const rungFor = (slot: PlaySlot) => scoreRung(eventDataFor(slot), slotRows(slot), gradeProfile.player, gradeProfile.bodyweightKg)
        // A domain's segment takes the best colour reached anywhere in it.
        const domainFill = (ev: { domain_number: number }) =>
          rungSegment(Math.max(0, ...slots.filter(sl => sl.se.domain_number === ev.domain_number).map(rungFor))) ?? '#666'

        return (
          <div key={pid} style={{ padding: '16px' }}>
            {sessionEnded && (
              <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ color: '#EA4742', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '18px' }}>Session Ended</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Score submission is locked</div>
              </div>
            )}

            {/* Strength is a ratio of bodyweight, so it is asked at the top of
                the screen where the lifting happens, not on a profile page
                nobody returns to. Renders nothing unless one of today's events
                is a ratio standard, and nothing for a guest. Swapped-in events
                count: a swap can bring a lift into a day that had none. */}
            <BodyweightField
              playerId={pid}
              eventSlugs={[...events.map(e => e.event_slug), ...swaps.chosen]}
              day={sessionDay}
              locked={sessionEnded}
              onSaved={gradeProfile.setBodyweightKg}
            />

            {/* Session progress */}
            <div style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '11.5px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{doneEvents.length}</span> of {events.length} events scored
                  {doneEvents.length === events.length && events.length > 0 && (
                    <span style={{ color: '#4DB26E', fontWeight: 600 }}> — All {events.length} events played</span>
                  )}
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <ProgressSegments events={events} scoredIds={barScored} fillFor={domainFill} />
                {fullHousePulseId === pid && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '99px', overflow: 'hidden', pointerEvents: 'none' }}>
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, width: '40%', left: '-45%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
                      animation: 'barShimmer 1.5s ease-out 2',
                    }} />
                  </div>
                )}
              </div>
            </div>

            {/* Domain by domain, in an order that never changes. */}
            <GameEventList
              events={events}
              chosen={swaps.chosen}
              eventDataFor={eventDataFor}
              rowsFor={slotRows}
              noteFor={slot => eventDivisionRank(slot.se.id, results, playerInfoMap, pDivision,
                bestRaw(results.filter(r => r.event_id === slot.se.id && r.player_id === pid)))}
              rungFor={rungFor}
              canAdd={swaps.available}
              scoredSlugs={swaps.scoredSlugs}
              onOpen={setSheetEventId}
              onAdd={setAddingDomain}
              onRemove={slug => { void swaps.remove(slug) }}
            />

            {/* An added event: the same sheet, the other store. */}
            {sheetSlot && sheetSlot.kind !== 'official' && (
              <QuickEntrySheet
                key={`swap-${sheetSlot.se.id}`}
                se={sheetSlot.se}
                eventData={getEventBySlug(sheetSlot.se.event_slug)}
                myResults={swaps.entriesFor(sheetSlot.se.id)}
                opponents={pickOpponents(results, { id: pid, name: pName })}
                seasonPR={null}
                locked={sessionEnded}
                bestLabel="Best today"
                prLabel="Training"
                natural
                onClose={() => setSheetEventId(null)}
                onSubmit={(v, editingId, matchOpponents) => swaps.submit(sheetSlot.se.id, v, editingId, matchOpponents)}
                onDelete={swaps.deleteEntry}
                onSubmitted={(labelText) => {
                  setSheetEventId(null)
                  setToast({ eventName: sheetSlot.se.event_name, label: labelText, isPR: false, isNewEvent: false })
                  setTimeout(() => setToast(null), 3000)
                }}
                onDeleted={() => { /* the store reloaded itself */ }}
              />
            )}

            {/* The + on an official event: add more from its domain */}
            {addingDomain && (
              <AddEventsSheet
                domainName={addingDomain.domainName}
                domainNumber={addingDomain.domainNumber}
                exclude={[...events.map(e => e.event_slug), ...swaps.chosen]}
                onAdd={async slugs => { setAddingDomain(null); await swaps.add(slugs) }}
                onClose={() => setAddingDomain(null)}
              />
            )}

            {/* Quick-entry sheet */}
            {sheetEvent && (
              <QuickEntrySheet
                key={sheetEvent.id}
                se={sheetEvent}
                eventData={getEventByName(sheetEvent.event_name)}
                myResults={results.filter(r => r.event_id === sheetEvent.id && r.player_id === pid)}
                opponents={pickOpponents(results, { id: pid, name: pName })}
                seasonPR={seasonPRs[sheetEvent.id] ?? null}
                locked={sessionEnded}
                onSubmit={(v, editingId, matchOpponents) => submitEntry({
                  sessionId: sessionId as string, eventId: sheetEvent.id, playerId: pid, playerName: pName,
                  mode: getEventByName(sheetEvent.event_name)?.inputMode || sheetEvent.input_mode,
                  eventData: getEventByName(sheetEvent.event_name),
                  v, myResults: results.filter(r => r.event_id === sheetEvent.id && r.player_id === pid),
                  seasonPRNum: typeof seasonPRs[sheetEvent.id] === 'number' ? (seasonPRs[sheetEvent.id] as number) : null,
                  editingResultId: editingId, matchOpponents,
                })}
                onDelete={deleteResult}
                onClose={() => setSheetEventId(null)}
                onSubmitted={async (label, meta) => {
                  setSheetEventId(null)
                  const isNewEvent = playedEventNames !== null && !playedEventNames.has(sheetEvent.event_name)
                  if (isNewEvent) setPlayedLoaded(prev => prev && prev.id === pid
                    ? { id: prev.id, names: new Set(prev.names).add(sheetEvent.event_name) }
                    : prev)
                  setToast({ eventName: sheetEvent.event_name, label, isPR: meta.isPR, isNewEvent })
                  setTimeout(() => setToast(null), meta.isPR || isNewEvent ? 4000 : 3000)
                  await loadResults()
                }}
                onDeleted={async () => { await loadResults() }}
              />
            )}
          </div>
        )
      })}

      {/* Session-end takeover — shows once per player per session, only if they played */}
      {sessionEnded && !endTakeoverDismissed && activePlayerId &&
        results.some(r => r.player_id === activePlayerId) && (
        <SessionEndTakeover
          sessionId={sessionId as string}
          playerId={activePlayerId}
          events={events}
          myResults={results.filter(r => r.player_id === activePlayerId)}
          divisionPlacement={myDivisionPlacement}
          onDismiss={() => {
            localStorage.setItem(`allsport_postgame_${sessionId}_${activePlayerId}`, '1')
            setTakeoverDismissedKey(`allsport_postgame_${sessionId}_${activePlayerId}`)
          }}
        />
      )}

      {/* Score-submitted toast — PR (gold/rainbow pop) beats new-event-unlocked beats normal green */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          width: 'min(600px, calc(100vw - 32px))', zIndex: 200, overflow: 'hidden',
          background: '#161616',
          border: `1px solid ${toast.isPR ? '#F9B05155' : toast.isNewEvent ? '#2371BB55' : '#2a2a2a'}`,
          borderLeft: `4px solid ${toast.isPR ? '#F9B051' : toast.isNewEvent ? '#2371BB' : '#4DB26E'}`,
          borderRadius: '12px', padding: '13px 16px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          animation: toast.isPR || toast.isNewEvent ? 'toastPop 0.45s cubic-bezier(0.16,1,0.3,1)' : undefined,
        }}>
          {toast.isPR && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />
          )}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#fff' }}>
            {toast.playerName && <span style={{ color: '#EA4742' }}>{toast.playerName} — </span>}
            {toast.isPR
              ? <><span style={{ color: '#F9B051' }}>NEW PR</span> — {toast.eventName} — {toast.label}</>
              : toast.isNewEvent
                ? <><span style={{ color: '#7ab4ff' }}>New event unlocked</span> — {toast.eventName}! <span style={{ color: '#aaa' }}>{toast.label}</span></>
                : <>Score in — {toast.eventName} — {toast.label}</>}
          </div>
        </div>
      )}

      {/* Judge mode tab */}
      {activeTab === 'judge-mode' && isJudge && (() => {
        const target = judgeTarget
        const targetResults = target ? resultsForTarget(results, target) : []
        const targetDivision = target?.id ? (playerInfoMap[target.id]?.division ?? null) : null
        const scoredIds = scoredEventIds(targetResults, events.map(ev => ev.id))
        const doneEvents = events.filter(ev => scoredIds.has(ev.id))
        const judgeSlots: PlaySlot[] = playList(events, swaps.chosen)
        const judgeSlotRows = (slot: PlaySlot) => slot.kind === 'official'
          ? targetResults.filter(r => r.event_id === slot.se.id)
          : swaps.entriesFor(slot.se.id)
        const judgeSheetSlot = sheetEventId ? judgeSlots.find(sl => sl.se.id === sheetEventId) : undefined
        const sheetEvent = judgeSheetSlot?.kind === 'official' ? events.find(e => e.id === sheetEventId) : undefined
        const judgeCovered = domainsCovered(events, scoredIds, swaps.scoredSlugs)
        const judgeEventDataFor = (slot: PlaySlot) => slot.kind === 'official' ? getEventByName(slot.se.event_name) : getEventBySlug(slot.se.event_slug)
        // A guest is never graded: no player, so every rung is 0.
        const judgeRungFor = (slot: PlaySlot) => target?.isGuest ? 0
          : scoreRung(judgeEventDataFor(slot), judgeSlotRows(slot), gradeProfile.player, gradeProfile.bodyweightKg)
        const judgeDomainFill = (ev: { domain_number: number }) =>
          rungSegment(Math.max(0, ...judgeSlots.filter(sl => sl.se.domain_number === ev.domain_number).map(judgeRungFor))) ?? '#666'
        const unlistedPlayers = sessionPlayers.filter(sp => !judgeRoster.registeredIds.has(sp.id))
        const canPickMore = unlistedPlayers.length > 0
        const guestDraft = judgeGuestDraft.trim()
        const addGuest = () => { if (guestDraft) selectJudgeTarget({ guestName: guestDraft }) }

        return (
          <div style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#EA4742', letterSpacing: '0.05em', lineHeight: 1 }}>Kaiwhakawā</div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', marginBottom: '12px' }}>SCORE FOR ANY PLAYER</div>

            {sessionEnded && (
              <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px', textAlign: 'center' }}>
                <div style={{ color: '#EA4742', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '18px' }}>Session Ended</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Score submission is locked</div>
              </div>
            )}

            {/* Player chips */}
            <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', marginBottom: '12px' }}>
              {judgeRoster.registered.map(p => (
                <JudgeChip key={p.key} label={p.name} active={judgeTargetId === p.id}
                  onClick={() => selectJudgeTarget(judgeTargetId === p.id ? null : { id: p.id })} />
              ))}
              {judgeRoster.guests.map(g => (
                <JudgeChip key={g.key} label={g.name} tone="guest" active={judgeGuestName === g.name}
                  onClick={() => selectJudgeTarget(judgeGuestName === g.name ? null : { guestName: g.name })} />
              ))}
              {canPickMore && (
                <JudgeChip label={judgeShowAll ? '× Player' : '+ Player'} tone="add"
                  onClick={() => { setJudgeShowAll(!judgeShowAll); setJudgeGuestOpen(false) }} />
              )}
              <JudgeChip label={judgeGuestOpen ? '× Guest' : '+ Guest'} tone="add"
                onClick={() => { setJudgeGuestOpen(!judgeGuestOpen); setJudgeShowAll(false); setJudgeGuestDraft('') }} />
            </div>

            {/* Full registered-player picker */}
            {judgeShowAll && (
              <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '14px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '10px' }}>
                  All registered players
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {unlistedPlayers.map(sp => (
                    <JudgeChip key={sp.id} label={sp.name} active={judgeTargetId === sp.id}
                      onClick={() => selectJudgeTarget({ id: sp.id })} />
                  ))}
                </div>
              </div>
            )}

            {/* Guest name entry */}
            {judgeGuestOpen && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Guest player name..."
                  value={judgeGuestDraft}
                  autoFocus
                  onChange={e => setJudgeGuestDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addGuest() }}
                  style={{
                    flex: 1, minWidth: 0, background: '#0d0d0d', border: '1px solid #F9B05144',
                    borderRadius: '12px', padding: '12px 14px', color: '#fff',
                    fontSize: '15px', fontFamily: 'var(--font-body)', boxSizing: 'border-box',
                  }}
                />
                <button onClick={addGuest} disabled={!guestDraft} style={{
                  flexShrink: 0, borderRadius: '12px', padding: '0 18px', cursor: guestDraft ? 'pointer' : 'default',
                  background: guestDraft ? '#F9B051' : '#1a1a1a', color: guestDraft ? '#000' : '#555',
                  border: 'none', fontFamily: 'var(--font-label)', fontSize: '14px',
                  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>Score</button>
              </div>
            )}

            {/* No player selected — session roster */}
            {!target && (
              judgeRoster.registered.length + judgeRoster.guests.length === 0 ? (
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#fff', letterSpacing: '0.03em' }}>No scores yet</div>
                  <div style={{ fontSize: '13px', color: '#777', marginTop: '6px', lineHeight: 1.5 }}>
                    Tap {canPickMore && <><span style={{ color: '#aaa' }}>+ Player</span> to pick a registered player, or </>}
                    <span style={{ color: '#F9B051' }}>+ Guest</span> to score someone by name.
                  </div>
                </div>
              ) : (
                <>
                  {sectionLabel(`Session roster — ${judgeRoster.registered.length + judgeRoster.guests.length} player${judgeRoster.registered.length + judgeRoster.guests.length === 1 ? '' : 's'}`)}
                  {judgeRoster.registered.map(p => (
                    <JudgeRosterRow key={p.key} name={p.name} isGuest={false} events={events}
                      scoredIds={rosterScored.get(p.key) ?? NO_SCORES}
                      onOpen={() => selectJudgeTarget({ id: p.id })} />
                  ))}
                  {judgeRoster.guests.map(g => (
                    <JudgeRosterRow key={g.key} name={g.name} isGuest events={events}
                      scoredIds={rosterScored.get(g.key) ?? NO_SCORES}
                      onOpen={() => selectJudgeTarget({ guestName: g.name })} />
                  ))}
                </>
              )
            )}

            {/* Player selected — same layout as the player tab */}
            {target && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: '#fff', letterSpacing: '0.03em', lineHeight: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {target.name}
                    {target.isGuest && <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#F9B051', marginLeft: '10px', letterSpacing: '0.1em' }}>GUEST</span>}
                  </div>
                  <button onClick={() => selectJudgeTarget(null)} style={{
                    flexShrink: 0, background: 'none', border: '1px solid #333', borderRadius: '999px',
                    color: '#888', cursor: 'pointer', padding: '0 16px', minHeight: '44px',
                    fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>Roster</button>
                </div>

                {/* A kaiwhakawā can record the weigh-in for the player they
                    are scoring — record_bodyweight() takes the same authority
                    as writing their score. Guests have no player_id and are
                    never graded, so the field renders nothing for them. */}
                <BodyweightField
                  playerId={target.isGuest ? null : (target.id ?? null)}
                  eventSlugs={[...events.map(e => e.event_slug), ...swaps.chosen]}
                  day={sessionDay}
                  locked={sessionEnded}
                  forName={target.name}
                  onSaved={gradeProfile.setBodyweightKg}
                />

                {/* Session progress */}
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '11.5px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{doneEvents.length}</span> of {events.length} events scored
                      {doneEvents.length === events.length && events.length > 0 && (
                        <span style={{ color: '#4DB26E', fontWeight: 600 }}> — All {events.length} events played</span>
                      )}
                    </div>
                  </div>
                  <ProgressSegments events={events} scoredIds={new Set(events.filter(ev => judgeCovered.has(ev.domain_number)).map(ev => ev.id))} fillFor={judgeDomainFill} />
                </div>

                {/* The same list a player sees, including what they added. A
                    guest cannot add: a workout needs an owner. */}
                <GameEventList
                  events={events}
                  chosen={swaps.chosen}
                  eventDataFor={judgeEventDataFor}
                  rowsFor={judgeSlotRows}
                  noteFor={slot => eventDivisionRank(slot.se.id, results, playerInfoMap, targetDivision,
                    bestRaw(targetResults.filter(r => r.event_id === slot.se.id)))}
                  rungFor={judgeRungFor}
                  canAdd={swaps.available}
                  scoredSlugs={swaps.scoredSlugs}
                  onOpen={setSheetEventId}
                  onAdd={setAddingDomain}
                  onRemove={slug => { void swaps.remove(slug) }}
                />

                {/* An added event, scored by the kaiwhakawā. */}
                {judgeSheetSlot && judgeSheetSlot.kind !== 'official' && (
                  <QuickEntrySheet
                    key={`judge-swap-${target?.id ?? 'none'}-${judgeSheetSlot.se.id}`}
                    se={judgeSheetSlot.se}
                    eventData={getEventBySlug(judgeSheetSlot.se.event_slug)}
                    myResults={swaps.entriesFor(judgeSheetSlot.se.id)}
                    opponents={pickOpponents(results, { id: target?.id ?? null, name: target?.name ?? '' })}
                    seasonPR={null}
                    locked={sessionEnded}
                    bestLabel="Best today"
                    prLabel="Training"
                    natural
                    onClose={() => setSheetEventId(null)}
                    onSubmit={(v, editingId, matchOpponents) => swaps.submit(judgeSheetSlot.se.id, v, editingId, matchOpponents)}
                    onDelete={swaps.deleteEntry}
                    onSubmitted={(labelText) => {
                      setSheetEventId(null)
                      setToast({ eventName: judgeSheetSlot.se.event_name, label: labelText, isPR: false, isNewEvent: false, playerName: target?.name })
                      setTimeout(() => setToast(null), 3000)
                    }}
                    onDeleted={() => { /* the store reloaded itself */ }}
                  />
                )}

                {addingDomain && (
                  <AddEventsSheet
                    domainName={addingDomain.domainName}
                    domainNumber={addingDomain.domainNumber}
                    exclude={[...events.map(e => e.event_slug), ...swaps.chosen]}
                    onAdd={async slugs => { setAddingDomain(null); await swaps.add(slugs) }}
                    onClose={() => setAddingDomain(null)}
                  />
                )}

                {/* Quick-entry sheet */}
                {sheetEvent && (
                  <QuickEntrySheet
                    key={`judge-${target.id ?? target.name}-${sheetEvent.id}`}
                    se={sheetEvent}
                    eventData={getEventByName(sheetEvent.event_name)}
                    myResults={targetResults.filter(r => r.event_id === sheetEvent.id)}
                    opponents={pickOpponents(results, { id: target.id, name: target.name })}
                    seasonPR={target.id ? (judgePRs[sheetEvent.id] ?? null) : null}
                    locked={sessionEnded}
                    onSubmit={(v, editingId, matchOpponents) => submitEntry({
                      sessionId: sessionId as string, eventId: sheetEvent.id, playerId: target.id, playerName: target.name,
                      mode: getEventByName(sheetEvent.event_name)?.inputMode || sheetEvent.input_mode,
                      eventData: getEventByName(sheetEvent.event_name),
                      v, myResults: targetResults.filter(r => r.event_id === sheetEvent.id),
                      seasonPRNum: target.id && typeof judgePRs[sheetEvent.id] === 'number' ? (judgePRs[sheetEvent.id] as number) : null,
                      editingResultId: editingId, matchOpponents,
                    })}
                    onDelete={deleteResult}
                    onClose={() => setSheetEventId(null)}
                    onSubmitted={async (label, meta) => {
                      setSheetEventId(null)
                      setToast({ eventName: sheetEvent.event_name, label, isPR: meta.isPR, isNewEvent: false, playerName: target.name })
                      setTimeout(() => setToast(null), meta.isPR ? 4000 : 3000)
                      await loadResults()
                    }}
                    onDeleted={async () => { await loadResults() }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Leaderboard tab */}
      {activeTab === 'leaderboard' && (
        <LeaderboardTab
          events={events}
          results={results}
          playerInfoMap={playerInfoMap}
          currentPlayerId={activePlayerId}
          currentPlayerDivision={activePlayerDivision}
        />
      )}

      {/* Judge Summary tab */}
      {activeTab === 'judge-summary' && isJudge && (
        <JudgeSummaryTab
          events={events}
          results={results}
          playerInfoMap={playerInfoMap}
          onScoreChanged={loadResults}
        />
      )}

      {/* Not logged in */}
      {!player && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ color: '#555', marginBottom: '16px' }}>Log in to submit scores</div>
          <a href="/login" style={{ color: '#2371BB', fontWeight: 700, textDecoration: 'none' }}>Log in →</a>
        </div>
      )}
    </div>
  )
}
