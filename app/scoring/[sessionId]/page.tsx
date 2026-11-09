'use client'
import { opponentPicks as pickOpponents } from '@/lib/matches'
import { useEffect, useState, useMemo, useRef } from 'react'
import type React from 'react'
import { useParams } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { getEventByName, getEventBySlug, type EventData } from '@/lib/eventData'
import { toNZDateString } from '@/lib/dates'
import { nzYear } from '@/lib/seasonYear'
import EventIcon, { domainColor } from '@/components/EventIcon'
import { type EntryVals, scoreColumns } from '@/lib/scoring'
import {
  buildJudgeRoster, resolveJudgeTarget, resultsForTarget, scoredEventIds,
  scoredEventIdsByTarget, NO_SCORES,
} from '@/lib/judgeRoster'
// The play screen's shared pieces. A personal game (app/workout/[id]) draws
// with exactly these, so scoring keeps ONE code path.
import QuickEntrySheet from '@/components/play/QuickEntrySheet'
import AddEventsSheet from '@/components/play/AddEventsSheet'
import GameEventList from '@/components/play/GameEventList'
import { playList, domainsCovered, type PlaySlot, type DomainGroup } from '@/lib/gameSwaps'
import { liveEventRung, rungSegment, liveGameColourRung } from '@/lib/scoreColour'
import { gameTotalOf } from '@/lib/leaderboardScores'
import { boardOrder, type BoardPlace } from '@/lib/gameReport'
import { GradeDot } from '@/components/GradeDot'
import { gradeForRung } from '@/lib/grading'
import { useGradeProfile } from '@/lib/useGradeProfile'
import { useSportRatings } from '@/lib/useSportRatings'
import { gameEventLine, gameEventLineText } from '@/lib/gameEventLine'
import { recheckGrades, type ConferredColour } from '@/lib/recheckGrades'
import { usePlayerGames } from '@/lib/usePlayerGames'
import { usePRRows } from '@/lib/usePRRows'
import { hasGameRow, isNewPR, mergeRows, seasonGameBest, type PRRow } from '@/lib/prBoard'
import { useSessionResults, type SaveJob, type SessionResult } from '@/lib/useSessionResults'
import { nextUnscored } from '@/lib/nextEvent'
import GameBanner from '@/components/play/GameBanner'
import Toast, { ToastButton, ToastText } from '@/components/play/Toast'
import { averageBefore, awardsForGame, nextStep } from '@/lib/gameReport'
import { ColourScore, EarnedColours, NextTime, PlacementHeader } from '@/components/GameReportParts'
import { prMoments, prsAtGame } from '@/lib/prCounts'
import { isSwissContest, suggestNext, unbeaten } from '@/lib/swiss'
import { useContest } from '@/lib/useContest'
import { ContestCard, ContestJudgeCard, type ContestName } from '@/components/play/ContestCard'
import { loadGameBoard, loadGamePlace } from '@/lib/loadGamePlace'
import { GameBoardList } from '@/components/GameBoardList'
import type { GamePlace } from '@/lib/gameReport'
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

type Result = SessionResult

// Age arrives pre-derived from the players_public view rather than as a raw
// date_of_birth: the live session only ever needs the Junior age chips and the
// age-group badges, and exact birthdays for 8 minors do not belong in a payload
// any logged-in player can fetch. The view supplies age_group ready-made, so
// there is no bracket helper here — see the note in the migration about why the
// view's column set is not something to change casually.
type PlayerInfo = { division: string; age_years?: number | null; age_group?: string | null; show_division?: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** The profile the rest of the app is showing, or null (blocked site data included). */
function storedActivePlayerId(): string | null {
  try {
    return window.localStorage.getItem('allsport_active_player_id')
  } catch {
    return null
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** This game's own scores on one event as records rows, for the PR rule and the
    records list. The loaded rows are as of page load, so these are merged in
    (lib/prBoard.ts `mergeRows`): today's score shows without a re-read. */
function liveRows(myResults: readonly Result[]): PRRow[] {
  const today = toNZDateString(new Date())
  return myResults.map(r => ({
    id: r.id, raw_score: r.raw_score, score_label: r.score_label,
    difficulty_tier: r.difficulty_tier, date: today, source: 'game',
    distance_m: r.distance_m ?? null, time_seconds: r.time_seconds, weight_kg: r.weight_kg,
  }))
}

const BLANK_RESULT: Omit<Result, 'id' | 'player_id' | 'player_name' | 'event_id' | 'raw_score' | 'score_label' | 'is_pr'> = {
  placement: null, points_earned: null, difficulty_tier: null, result_type: null, opponent_name: null,
  match_score: null, weight_kg: null, reps: null, time_seconds: null, distance_m: null,
}

// Works out everything a save writes, including the PR flag, BEFORE any
// request, so the screen can draw the score at once (v0.48.0.0). Nothing here
// waits: an invalid score comes back as an error for the sheet, a valid one as
// the job lib/useSessionResults.ts writes behind the screen.
function prepareEntry(args: {
  sessionId: string
  eventId: string
  eventName: string
  playerId: string | null
  playerName: string
  mode: string
  eventData: EventData | undefined
  v: EntryVals
  myResults: Result[]
  /** This player's lifetime scores on the event (lib/usePRRows), for the PR rule. */
  prRows: readonly PRRow[]
  editingResultId: string | null
  // Opponent player ids to record as a match, or null to leave matches alone.
  // Decided by the sheet, which knows whether an edit touched the opponent.
  matchOpponents: string[] | null
}): { error: string; isPR: false } | { error: null; isPR: boolean; job: SaveJob } {
  const { sessionId, eventId, eventName, playerId, playerName, mode, eventData, v, myResults, prRows, editingResultId, matchOpponents } = args
  // One encoder for a game score and a logged best effort (lib/scoring.ts).
  const scored = scoreColumns(mode, eventData, v)
  if (!scored) return { error: 'Enter a valid score first', isPR: false }
  // A PR is a new best at this level (or a new number one on an event with no
  // levels): lib/prBoard.ts owns the rule. This game's own scores are merged
  // in, and the row being edited is left out of its own comparison. A distance
  // event keeps a record per distance, read off what was done.
  const isPR = playerId !== null && isNewPR(eventData, mergeRows(prRows, liveRows(myResults)), {
    raw_score: scored.raw_score, difficulty_tier: scored.difficulty_tier ?? null,
    distance_m: scored.distance_m ?? null, time_seconds: scored.time_seconds ?? null, weight_kg: scored.weight_kg ?? null,
  }, editingResultId)
  // Effort tasks are retired, so effort_task_completions is no longer
  // written: a new row takes the column default (0), and an edit leaves a
  // row's earlier credit alone rather than wiping it mid-season.
  const payload: Record<string, unknown> = {
    session_id: sessionId, event_id: eventId, player_id: playerId || null,
    player_name: playerName, ...scored, is_pr: isPR,
  }
  // An edit writes only these columns, so the row it draws is the old row
  // with them laid over. The score is the record and the match hangs off it,
  // written once the score has saved; guests are never matched.
  const base = editingResultId ? myResults.find(r => r.id === editingResultId) : undefined
  const row = { ...BLANK_RESULT, ...base, ...payload, id: editingResultId ?? '' } as Result
  return {
    error: null, isPR,
    job: {
      payload, row, editingId: editingResultId,
      matchOpponents: playerId ? matchOpponents : null,
      what: `${eventName} ${scored.score_label}`,
    },
  }
}

// ─── Event list row (player redesign) ─────────────────────────────────────────

/** The best raw score in a set of rows, or null when there are none. */
function bestRaw(rows: readonly Result[]): number | null {
  return rows.length === 0 ? null : rows.reduce((b, r) => Math.max(b, r.raw_score), -Infinity)
}

function eventDivisionRank(
  seId: string, allResults: Result[], playerInfoMap: Record<string, PlayerInfo>,
  playerDivision: string | null | undefined, myBestRaw: number | null
): { label: string; color: string } {
  if (!playerDivision || myBestRaw === null) return { label: '', color: 'var(--grey)' }
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
  const color = rank === 1 ? 'var(--amber)' : rank === 2 ? 'var(--medal-silver)' : rank === 3 ? 'var(--medal-bronze)' : 'var(--grey)'
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
  const accent = tone === 'guest' ? 'var(--amber)' : 'var(--red)'
  const idleColor = tone === 'guest' ? 'var(--amber)' : tone === 'add' ? 'var(--grey)' : 'var(--grey-light)'
  const idleBorder = tone === 'guest' ? 'color-mix(in srgb, var(--amber) 27%, transparent)' : tone === 'add' ? 'var(--border-strong)' : 'var(--border-strong)'
  return (
    <button className="press" onClick={onClick} style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em',
      fontSize: '13px', fontWeight: 600, flexShrink: 0, cursor: 'pointer',
      borderRadius: 'var(--radius-pill)', padding: '0 15px', minHeight: '44px',
      display: 'inline-flex', alignItems: 'center',
      background: active ? accent : 'var(--surface-2)',
      color: active ? (tone === 'guest' ? 'var(--black)' : 'var(--white)') : idleColor,
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
    <button className="press" onClick={onOpen} style={{
      width: '100%', textAlign: 'left', display: 'block', padding: '12px 14px', marginBottom: '8px',
      borderRadius: 'var(--radius-lg)', cursor: 'pointer', background: 'var(--surface)',
      border: `1px solid ${complete ? 'var(--green-tint)' : 'var(--border)'}`, color: 'var(--white)', fontFamily: 'var(--font-body)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', letterSpacing: '0.03em', lineHeight: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
          {isGuest && <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--amber)', marginLeft: '8px', letterSpacing: '0.1em' }}>GUEST</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0, color: complete ? 'var(--green)' : 'var(--grey)' }}>
          {done}/{events.length} scored
        </div>
      </div>
      <ProgressSegments events={events} scoredIds={scoredIds} height={6} />
    </button>
  )
}

// ─── Division pool constants ──────────────────────────────────────────────────

// Adults of every age are one field (Tāne, 20 Oct 2026): the colour standards
// carry the age allowance, so there are no Masters or Grandmaster divisions.
const MENS_DIVS = ["Men's"]
const WOMENS_DIVS = ["Women's"]

function medalBg(rank: number): string {
  return rank === 1 ? 'var(--amber)' : rank === 2 ? 'var(--medal-silver)' : rank === 3 ? 'var(--medal-bronze)' : 'var(--border-strong)'
}
function medalColor(rank: number): string { return rank <= 3 ? 'var(--black)' : 'var(--grey-light)' }

// ─── JudgeSummaryTab ──────────────────────────────────────────────────────────

// A drawn chevron for an open or closed row; the ▲ ▼ characters it replaces
// render at a different size and weight on every phone font (v0.50.0.0).
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{
      flexShrink: 0, color: open ? 'var(--blue)' : 'var(--grey)',
      transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur) var(--ease)',
    }}>
      <path d="M3 5.5 7 9.5 11 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function JudgeSummaryTab({
  events, results, playerInfoMap, onDelete,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
  /** The page's one delete path: hides the row now, restores it with an error if it fails. */
  onDelete: (id: string, what: string) => void
}) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  // The score whose Delete was tapped once: it asks before it goes.
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const smallBtn: React.CSSProperties = {
    minHeight: '44px', minWidth: '64px', padding: '0 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', flexShrink: 0,
    fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
  }

  function getPoolResults(pool: 'mens' | 'womens' | 'juniors') {
    return results.filter(r => {
      if (!r.player_id) return false
      const info = playerInfoMap[r.player_id]
      if (!info) return false
      if (pool === 'mens') return MENS_DIVS.includes(info.division)
      if (pool === 'womens') return WOMENS_DIVS.includes(info.division)
      return info.division === 'Juniors'
    })
  }

  function computeSummaryRows(pool: 'mens' | 'womens' | 'juniors') {
    const poolResults = getPoolResults(pool)
    const playerIds = [...new Set(poolResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (playerIds.length === 0) return []

    // By name: this tab is for checking and correcting scores. Places come from
    // colour scores, on the Leaderboard tab, once the game closes.
    const rows = playerIds.map(pid => {
      const eventDetails = events.map(ev => {
        const mine = poolResults.filter(r => r.event_id === ev.id && r.player_id === pid)
        const evData = getEventByName(ev.event_name)
        if (mine.length === 0) return { eventId: ev.id, eventName: ev.event_name, slug: ev.event_slug, domain: ev.domain_number, displayLabel: null as string | null }
        const myBest = mine.reduce((b, r) => (r.raw_score > b.raw_score ? r : b))
        const displayLabel = evData?.inputMode === 'sport' ? sportWDL(mine) : myBest.score_label
        return { eventId: ev.id, eventName: ev.event_name, slug: ev.event_slug, domain: ev.domain_number, displayLabel }
      })
      const sample = poolResults.find(r => r.player_id === pid)!
      return { playerId: pid, playerName: sample.player_name, eventDetails }
    })
    return rows.sort((a, b) => a.playerName.localeCompare(b.playerName))
  }

  function handleDelete(r: Result, eventName: string) {
    onDelete(r.id, `${eventName} ${r.score_label}`)
    setEditingKey(null)
  }

  function renderSummarySection(pool: 'mens' | 'womens' | 'juniors', title: string) {
    const rows = computeSummaryRows(pool)
    const poolResults = getPoolResults(pool)
    return (
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          {title}
        </div>
        {rows.length === 0 ? (
          <div style={{ color: 'var(--grey)', fontSize: '13px', padding: '8px 0', fontFamily: 'var(--font-label)' }}>No scores submitted</div>
        ) : (
          rows.map(entry => {
            const isExpanded = expandedPlayerId === entry.playerId
            return (
              <div key={entry.playerId} style={{ marginBottom: '6px' }}>
                <button className="press"
                  onClick={() => setExpandedPlayerId(isExpanded ? null : entry.playerId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '10px 14px',
                    background: isExpanded ? 'var(--blue-tint)' : 'var(--surface)',
                    border: `1px solid ${isExpanded ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: isExpanded ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--white)' }}>{entry.playerName}</div>
                  </div>
                  <Chevron open={isExpanded} />
                </button>

                {isExpanded && (
                  <div style={{ background: 'var(--dark)', border: '1px solid var(--blue)', borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)', overflow: 'hidden' }}>
                    {entry.eventDetails.map((ed, i) => {
                      const editKey = `${entry.playerId}-${ed.eventId}`
                      const isEditingThis = editingKey === editKey
                      const eventResults = poolResults.filter(r => r.player_id === entry.playerId && r.event_id === ed.eventId)
                      return (
                        <div key={ed.eventId} style={{ borderBottom: i < entry.eventDetails.length - 1 ? '1px solid var(--surface)' : 'none' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px',
                            background: isEditingThis ? 'var(--blue-tint)' : i % 2 === 0 ? 'var(--dark)' : 'var(--surface)',
                          }}>
                            <EventIcon slug={ed.slug} domainNumber={ed.domain} size={22} />
                            <div style={{ flex: 1, fontSize: '12px', color: 'var(--grey)', fontFamily: 'var(--font-label)' }}>{ed.eventName}</div>
                            <div style={{ fontSize: '12px', color: ed.displayLabel ? 'var(--grey-light)' : 'var(--grey)', minWidth: '60px', textAlign: 'right' }}>
                              {ed.displayLabel ?? '—'}
                            </div>
                            <button className="press"
                              onClick={() => setEditingKey(isEditingThis ? null : editKey)}
                              style={{
                                background: 'none',
                                border: `1px solid ${isEditingThis ? 'color-mix(in srgb, var(--red) 27%, transparent)' : 'color-mix(in srgb, var(--blue) 20%, transparent)'}`,
                                borderRadius: 'var(--radius-sm)', color: isEditingThis ? 'var(--red)' : 'var(--blue)',
                                cursor: 'pointer', fontSize: '12px', padding: '2px 8px',
                                fontFamily: 'var(--font-label)', fontWeight: 700, flexShrink: 0,
                              }}
                            >
                              {isEditingThis ? 'Close' : 'Edit'}
                            </button>
                          </div>
                          {isEditingThis && (
                            <div style={{ padding: '12px 14px', background: 'var(--blue-tint)', borderTop: '1px solid var(--border)' }}>
                              {eventResults.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                  <div style={{ fontSize: '12px', color: 'var(--grey)', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', marginBottom: '4px' }}>SUBMITTED SCORES</div>
                                  {eventResults.map(r => (
                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                                      <div style={{ flex: 1, fontSize: '14px', color: 'var(--white)' }}>{r.score_label}</div>
                                      {r.difficulty_tier && (
                                        <div style={{ fontSize: '12px', color: 'var(--purple)', fontFamily: 'var(--font-label)' }}>{r.difficulty_tier}</div>
                                      )}
                                      {!r.pending && (confirmId === r.id ? (
                                        <>
                                          <span style={{ fontFamily: 'var(--font-label)', fontSize: '13px', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delete?</span>
                                          <button className="press" onClick={() => { setConfirmId(null); handleDelete(r, ed.eventName) }}
                                            style={{ ...smallBtn, background: 'var(--red)', border: '1px solid var(--red)', color: 'var(--white)' }}>Delete</button>
                                          <button className="press" onClick={() => setConfirmId(null)}
                                            style={{ ...smallBtn, background: 'none', border: '1px solid var(--border-strong)', color: 'var(--grey-light)' }}>Keep</button>
                                        </>
                                      ) : (
                                        <button className="press" onClick={() => setConfirmId(r.id)} aria-label={`Delete ${r.score_label}`}
                                          style={{ ...smallBtn, background: 'none', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', color: 'var(--red)' }}>Delete</button>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '13px', color: 'var(--grey)', marginBottom: '10px' }}>No score submitted yet</div>
                              )}
                              <div style={{ fontSize: '12px', color: 'var(--grey)', fontFamily: 'var(--font-label)' }}>
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
      <div style={{ fontSize: '12px', color: 'var(--red)', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 700 }}>
        GAME SUMMARY — ALL PLAYERS
      </div>
      {renderSummarySection('mens', "Men's")}
      {renderSummarySection('womens', "Women's")}
      {renderSummarySection('juniors', 'Juniors')}
    </div>
  )
}

// ─── LeaderboardTab ───────────────────────────────────────────────────────────
// The whole game is one list on colour score, from the totals published when it
// closes (Tāne, 3 Nov 2026). There is no overall place during a game: a colour
// score needs the player's bodyweight, which is private, so only the server can
// work out anyone else's. Pick an event to see its scores, best first; that list
// is what was done, by division, not a place in the game.

function LeaderboardTab({
  sessionId, closed, events, results, playerInfoMap, currentPlayerId,
}: {
  sessionId: string
  closed: boolean
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
  currentPlayerId: string | null
}) {
  const [juniorAge, setJuniorAge] = useState<number | null>(null)
  const [eventFilterId, setEventFilterId] = useState<string | null>(null)
  const [board, setBoard] = useState<BoardPlace[] | null>(null)

  useEffect(() => {
    if (!closed) return
    let cancelled = false
    loadGameBoard(supabase, sessionId).then(rows => { if (!cancelled) setBoard(rows) })
    return () => { cancelled = true }
  }, [sessionId, closed])

  const everyone = useMemo(() => {
    const names = new Map<string, string>()
    for (const r of results) if (r.player_id) names.set(r.player_id, r.player_name)
    return boardOrder([...names].map(([key, name]) => ({ key, name })), closed ? board : null)
  }, [results, board, closed])

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

  function getPoolResults(pool: 'mens' | 'womens' | 'juniors', ageFilter: number | null) {
    return results.filter(r => {
      if (!r.player_id) return false
      const info = playerInfoMap[r.player_id]
      if (!info) return false
      if (pool === 'mens') return MENS_DIVS.includes(info.division)
      if (pool === 'womens') return WOMENS_DIVS.includes(info.division)
      if (info.division !== 'Juniors') return false
      if (ageFilter !== null) return info.age_years != null ? info.age_years === ageFilter : true
      return true
    })
  }

  function computeEventRows(eventId: string, pool: 'mens' | 'womens' | 'juniors', ageFilter: number | null) {
    const poolResults = getPoolResults(pool, ageFilter).filter(r => r.event_id === eventId)
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
      padding: '0 14px', minHeight: '44px', borderRadius: 'var(--radius-pill)', border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
      display: 'inline-flex', alignItems: 'center',
      fontSize: '12px', fontWeight: active ? 700 : 400, cursor: 'pointer',
      background: active ? 'var(--blue-tint)' : 'var(--surface)', color: active ? 'var(--blue-light)' : 'var(--grey)',
      fontFamily: 'var(--font-label)', flexShrink: 0,
    }
  }

  function renderEventSection(eventId: string, pool: 'mens' | 'womens' | 'juniors', ageFilter: number | null) {
    const evRows = computeEventRows(eventId, pool, ageFilter)
    if (evRows.length === 0) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {evRows.map(entry => (
          <div key={entry.playerKey} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
            background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, background: medalBg(entry.rank), color: medalColor(entry.rank),
            }}>{entry.rank}</div>
            <div style={{ flex: 1, fontSize: '14px', color: entry.playerId === currentPlayerId ? 'var(--blue-light)' : 'var(--grey-light)' }}>
              {entry.playerName}
              {entry.playerId === currentPlayerId && <span style={{ fontSize: '12px', color: 'var(--grey)', marginLeft: '6px', fontFamily: 'var(--font-label)' }}>YOU</span>}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
              {entry.label}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const selectedEvent = eventFilterId ? events.find(e => e.id === eventFilterId) : null
  const titleStyle: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', marginBottom: '10px' }
  const noScores = <div style={{ color: 'var(--grey)', fontSize: '13px', padding: '12px 0', fontFamily: 'var(--font-label)' }}>No scores yet</div>

  return (
    <div style={{ padding: '12px 16px' }}>

      {/* Event filter */}
      <div style={{ marginBottom: '16px' }}>
        <select
          value={eventFilterId ?? ''}
          onChange={e => setEventFilterId(e.target.value || null)}
          style={{
            width: '100%', background: eventFilterId ? 'var(--blue-tint)' : 'var(--surface)',
            border: `1px solid ${eventFilterId ? 'var(--blue)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            color: eventFilterId ? 'var(--blue-light)' : 'var(--grey)',
            fontSize: '14px', fontFamily: 'var(--font-body)',
          }}
        >
          <option value="">Whole game</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.event_name}</option>)}
        </select>
        {selectedEvent && (
          <div style={{ fontSize: '12px', color: 'var(--grey)', marginTop: '6px', fontFamily: 'var(--font-label)', letterSpacing: '0.06em' }}>
            SCORES FOR: {selectedEvent.event_name.toUpperCase()}, NOT A PLACE IN THE GAME
          </div>
        )}
      </div>

      {!eventFilterId && (
        <>
          <div style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.5, marginBottom: '14px' }}>
            {closed
              ? 'One list for the whole game, ranked on colour score, which is scaled for age and sex.'
              : 'Places come from colour scores when the game closes. Pick an event above to see its scores.'}
          </div>
          {everyone.length === 0 ? noScores : closed && (
            <GameBoardList entries={everyone.map(p => ({ key: p.key, name: p.name, place: p.place, isMe: p.key === currentPlayerId }))} />
          )}
        </>
      )}

      {eventFilterId && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <div style={titleStyle}>Men&apos;s</div>
            {renderEventSection(eventFilterId, 'mens', null) ?? noScores}
          </div>
          <div style={{ marginBottom: '24px' }}>
            <div style={titleStyle}>Women&apos;s</div>
            {renderEventSection(eventFilterId, 'womens', null) ?? noScores}
          </div>
          <div style={{ marginBottom: '24px' }}>
            <div style={titleStyle}>{juniorAge !== null ? `Juniors, age ${juniorAge}` : 'Juniors'}</div>
            {juniorAges.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button className="press" onClick={() => setJuniorAge(null)} style={chipStyle(juniorAge === null)}>All</button>
                {juniorAges.map(age => (
                  <button className="press" key={age} onClick={() => setJuniorAge(age === juniorAge ? null : age)} style={chipStyle(juniorAge === age)}>
                    Age {age}
                  </button>
                ))}
              </div>
            )}
            {renderEventSection(eventFilterId, 'juniors', juniorAge) ?? noScores}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Session-end takeover (DR-1) + session milestones (DR-7) ──────────────────

const RAINBOW_G = 'linear-gradient(90deg, var(--red), var(--amber), var(--pink), var(--purple), var(--blue), var(--green))'

type EndSummary = { session_id: string }

function SessionEndTakeover({
  sessionId, playerId, events, myResults, registeredPlayers, onDismiss,
}: {
  sessionId: string
  playerId: string
  events: SessionEvent[]
  myResults: Result[]
  /** Registered players with a result in this game, to tell a complete field from a partial one. */
  registeredPlayers: number
  onDismiss: () => void
}) {
  const [summary, setSummary] = useState<EndSummary | null>(null)
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [newColours, setNewColours] = useState<ConferredColour[]>([])
  // Bumped once the recheck answers, so the colours it conferred are in the
  // awards the game's colour section reads.
  const [rechecked, setRechecked] = useState(0)
  const games = usePlayerGames(supabase, playerId, rechecked)
  // Place among everyone in the game. The recheck publishes this player's
  // total, so it is read after it answers; shown only once every registered
  // player has a total, since a partial field reads too high.
  const [gamePlace, setGamePlace] = useState<GamePlace | null>(null)
  useEffect(() => {
    if (rechecked === 0) return
    let cancelled = false
    loadGamePlace(supabase, sessionId, playerId).then(p => { if (!cancelled) setGamePlace(p) })
    return () => { cancelled = true }
  }, [sessionId, playerId, rechecked])
  const wholeGame = gamePlace && gamePlace.of >= registeredPlayers ? gamePlace : null

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
          .select('session_id')
          .eq('session_id', sessionId).eq('player_id', playerId).maybeSingle(),
        supabase.from('session_player_summary')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', playerId),
      ])

      setSummary((sumRes.data as EndSummary | null) ?? null)
      setSessionCount(cntRes.count ?? 0)
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
      .then(r => { if (!cancelled) { setNewColours(r.conferred); setRechecked(n => n + 1) } })
    return () => { cancelled = true }
  }, [playerId])

  // What a game gives a player: its placement, its colour score, the PRs set
  // and any colour it earned (Tāne, 2026-09-28).
  const score = games?.scores.get(sessionId) ?? null
  const average = games ? averageBefore(games.scores, sessionId) : null
  const next = games
    ? nextStep(events.map(e => e.event_name), games.state.grades, games.player, games.inputs.bodyweights ?? [], toNZDateString(new Date()))
    : null
  // The recheck here, plus anything the kaiwhakawā's screen conferred when the
  // game ended a moment earlier. One row per domain colour.
  const earned = new Map<string, { domainNumber: number; rung: number }>()
  for (const c of newColours) earned.set(`${c.domainNumber}:${c.rung}`, c)
  if (games) {
    for (const a of awardsForGame(games.state.allAwards, games.scores, sessionId)) {
      earned.set(`${a.domain_number}:${a.rung}`, { domainNumber: a.domain_number, rung: a.rung })
    }
  }
  const colours = [...earned.values()].sort((a, b) => a.domainNumber - b.domainNumber)

  // Session-count milestone — summary row present means the count includes this session
  const sessionNumber = sessionCount === null ? null : (summary ? sessionCount : sessionCount + 1)
  const milestone = sessionNumber !== null && [10, 25, 50].includes(sessionNumber) ? sessionNumber : null

  const prs = myResults.filter(r => r.is_pr)
  // How many events were PR'd, worked out from the scores (lib/prCounts.ts)
  // once the player's history is loaded; until then, from the flags above.
  const prCount = games
    ? prsAtGame(prMoments(games.inputs), sessionId).size
    : new Set(prs.map(r => r.event_id)).size
  const eventNameFor = (eid: string) => events.find(e => e.id === eid)?.event_name ?? 'Event'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'absolute', inset: 0, margin: '0 auto', width: 'min(640px, 100vw)',
        display: 'flex', flexDirection: 'column', background: 'var(--surface)',
        borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
        animation: 'takeoverUp 0.34s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ height: '4px', flexShrink: 0, background: RAINBOW_G }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 18px 8px', flexShrink: 0 }}>
          <div style={{ flex: 1, fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            Session complete
          </div>
          <button className="press" onClick={onDismiss} style={{
            width: '38px', height: '38px', borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--grey)', fontSize: '15px',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '0 18px 24px', flex: 1 }}>

          {/* The place in the whole game, on colour score */}
          <PlacementHeader game={wholeGame} />

          {/* The game's colour score */}
          {score ? <ColourScore points={score.points} average={average} prs={prCount} /> : (
            <div style={{ height: '76px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }} />
          )}
          {next && <NextTime step={next} />}
          {rechecked > 0 && !wholeGame && (
            <div style={{ fontSize: '12px', color: 'var(--grey)', marginTop: '6px', textAlign: 'center' }}>
              Your place shows once everyone&apos;s colour score is in
            </div>
          )}

          {/* PRs set today */}
          {prs.length > 0 && (
            <>
              <div style={{ ...SHEET_LBL, color: 'var(--amber)' }}>PRs set today</div>
              {prs.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface-2)', border: '1px solid color-mix(in srgb, var(--amber) 20%, transparent)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 13%, transparent)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', flexShrink: 0 }}>PR</span>
                  <span style={{ flex: 1, fontSize: '14px', color: 'var(--white)' }}>{eventNameFor(r.event_id)}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: 'var(--amber)' }}>{r.score_label}</span>
                </div>
              ))}
            </>
          )}

          {/* Colours earned today. Conferred by the server while this screen
              was opening, so it is a fact by the time it is announced. */}
          <EarnedColours colours={colours} />

          <a href="/dashboard" style={{
            display: 'block', marginTop: '18px', background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '14px 16px', color: 'var(--white)', textDecoration: 'none',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '0.04em' }}>Your colours</div>
            <div style={{ fontSize: '13px', color: 'var(--grey)', marginTop: '3px', lineHeight: 1.5 }}>
              See what today&apos;s scores did for your colour in each domain →
            </div>
          </a>

          {/* Session-count milestone */}
          {milestone !== null && (
            <div style={{ marginTop: '14px', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--amber)', letterSpacing: '0.04em' }}>
                Milestone — your {ordinal(milestone)} session
              </div>
              <div style={{ fontSize: '13px', color: 'var(--grey-light)', marginTop: '4px', lineHeight: 1.5 }}>
                {milestone === 10
                  ? 'Ten AllSport sessions played. If a friend invited you, their referral just qualified — you count towards their koha tier now.'
                  : `${milestone} AllSport sessions played. Ka rawe — keep showing up.`}
              </div>
            </div>
          )}

          {/* Full report link */}
          <a href={`/games/${sessionId}`} style={{
            display: 'block', textAlign: 'center', marginTop: '18px', padding: '13px 0',
            borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
            color: 'var(--white)', textDecoration: 'none', fontFamily: 'var(--font-label)',
            textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '14px',
          }}>Full game report →</a>

          <button className="press" onClick={onDismiss} style={{
            width: '100%', marginTop: '10px', height: '54px', border: 'none', borderRadius: 'var(--radius-pill)',
            cursor: 'pointer', background: RAINBOW_G, color: 'var(--dark)',
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

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [events, setEvents] = useState<SessionEvent[]>([])
  // Every score in the game. `results` is what the screen draws, including a
  // score still on its way to the server; `confirmedResults` is only what the
  // server has confirmed (lib/useSessionResults.ts).
  const live = useSessionResults(sessionId as string)
  const results = live.results
  const confirmedResults = live.confirmed
  const [player, setPlayer] = useState<Record<string, unknown> | null>(null)
  const [familyMembers, setFamilyMembers] = useState<Record<string, unknown>[]>([])
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
  // The signed-in account, which is who WRITES a swap workout (logged_by).
  // Distinct from activePlayerId, which is whose tab is open: a parent scoring
  // for their child writes the child's workout under their own id.
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('leaderboard')
  const [sheetEventId, setSheetEventId] = useState<string | null>(null)
  type Toast = {
    eventName: string; label: string; isPR: boolean; isNewEvent: boolean; playerName?: string
    /** The next official event still to score, offered as a button. */
    next?: { id: string; name: string } | null
  }
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null)
  const toastSeq = useRef(0)
  // Each toast clears only itself, so an earlier one's timer never cuts a
  // later one short. One with a Next button stays long enough to tap it.
  const showToast = (t: Toast) => {
    const id = ++toastSeq.current
    setToast({ ...t, id })
    const ms = t.next ? 6000 : t.isPR || t.isNewEvent ? 4000 : 3000
    setTimeout(() => setToast(cur => (cur?.id === id ? null : cur)), ms)
  }
  /** The next official event `rows` has not scored, after `justId`, wrapping round. */
  const nextFor = (rows: readonly Result[], justId: string) => {
    const scored = new Set(rows.map(r => r.event_id))
    const id = nextUnscored(events.map(e => e.id), scored, justId)
    const ev = id ? events.find(e => e.id === id) : undefined
    return ev ? { id: ev.id, name: ev.event_name } : null
  }
  const [fullHousePulseId, setFullHousePulseId] = useState<string | null>(null)
  // The takeover key this page dismissed; localStorage covers earlier visits.
  const [takeoverDismissedKey, setTakeoverDismissedKey] = useState<string | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  // The database has CONFIRMED the game is closed. sessionEnded flips the
  // moment the clock runs out, before close_expired_sessions() has run, and a
  // recheck made then skips the still-open game entirely.
  const [serverClosed, setServerClosed] = useState(false)
  const [playerInfoMap, setPlayerInfoMap] = useState<Record<string, PlayerInfo>>({})
  const [isJudge, setIsJudge] = useState(false)
  const [judgeTargetId, setJudgeTargetId] = useState<string>('')
  const [judgeGuestName, setJudgeGuestName] = useState('')
  const [judgeShowAll, setJudgeShowAll] = useState(false)   // full registered-player picker expanded
  const [judgeGuestDraft, setJudgeGuestDraft] = useState('') // "+ Guest" name field; '' = field hidden
  const [judgeGuestOpen, setJudgeGuestOpen] = useState(false)
  const [sessionPlayers, setSessionPlayers] = useState<{ id: string; name: string }[]>([])

  const allPlayers = player ? [player, ...familyMembers] : []
  const activePlayer = allPlayers.find(p => p.id === activePlayerId) ?? player

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
  // Scoring v2 step 5: the Swiss contest behind the open sheet, if it is one,
  // for the player being scored (the viewed player, or the kaiwhakawā's
  // target). At page level for the same reason as the swaps. It re-reads
  // whenever the game's results change, since a match is recorded with them.
  const contestSe = events.find(e => e.id === sheetEventId && isSwissContest(e.event_slug)) ?? null
  // Keyed on confirmed rows: a score still on its way has no match yet.
  const contest = useContest(contestSe && !sessionEnded ? sessionId as string : null, contestSe?.event_name ?? null,
    swapPlayerId, `${confirmedResults.length}|${confirmedResults.reduce((m, r) => (r.id > m ? r.id : m), '')}`)
  const contestNames = (ids: readonly string[]): ContestName[] => ids.flatMap(id => {
    const record = contest.table.get(id)
    const name = results.find(r => r.player_id === id)?.player_name
    return record && name ? [{ id, name, record }] : []
  })
  const contestBlocked = contest.safety ? (id: string) => !contest.safety!.safe.has(id) : undefined
  const contestCard = (playerId: string | null) => {
    if (!contest.live || !contest.safety || !playerId) return undefined
    const me = contest.table.get(playerId) ?? null
    const next = contestNames(suggestNext(playerId, contest.table, contest.safety.safe).map(r => r.playerId))
    const top = contestNames(unbeaten(contest.table).map(r => r.playerId))
    const card = ({ pick, pickedId }: { pick: (id: string, name: string) => void; pickedId: string | null }) => (
      <ContestCard me={me} suggestions={next} unbeaten={top} needsBodyweight={contest.safety!.needsBodyweight}
        pickedId={pickedId} locked={sessionEnded} onPick={pick} />
    )
    return card
  }
  // Lifetime scores on the events in this game, for the records list and the PR
  // rule: the viewed player's, and (on the kaiwhakawā tab) the scored player's.
  const prSlugs = [...events.map(e => e.event_slug), ...swaps.chosen]
  // One read each, and everything else about a player's history on today's
  // events is derived from it: the records list, the PR rule, the Season PR
  // tile and "new event unlocked" (v0.48.0.0; three more loaders used to read
  // the same results again). Not re-read after a save: today's scores are
  // merged in from `results` (`prRowsFor` below).
  const { rows: playerPRRows, loaded: playerPRsLoaded } = usePRRows(activePlayerId, prSlugs)
  const { rows: targetPRRows } = usePRRows(isJudge ? (judgeTarget?.id ?? null) : null, prSlugs)
  const thisYear = nzYear()
  /** A player's records on an event with this game's scores merged in. */
  const prRowsFor = (rowsBySlug: Record<string, PRRow[]>, slug: string, today: readonly Result[]) =>
    mergeRows((rowsBySlug[slug] ?? []).filter(r => !live.removedIds.has(r.id)), liveRows(today))
  /** The Season PR tile: their best game score on the event this NZ year. */
  const seasonPRFor = (rowsBySlug: Record<string, PRRow[]>, slug: string) => seasonGameBest(rowsBySlug[slug] ?? [], thisYear)
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
  // The rating in each sport, for the win/draw/loss buttons. Null until loaded or if the read fails.
  const sportRatings = useSportRatings(swapPlayerId)
  const gameLineOf = (ev: ReturnType<typeof getEventBySlug>) => {
    const line = gameEventLine(ev, sportRatings.ratings)
    return line ? gameEventLineText(line) : undefined
  }

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

  // ── This player's colour score for the banner ───────────────────────────
  // Their own only: anyone else's needs a bodyweight this screen cannot read. A
  // contest game-day score is added when the game closes, so this can rise then.
  const myColourScore = useMemo(() => {
    if (!activePlayerId || swapPlayerId !== activePlayerId || !gradeProfile.player) return null
    const mine = results.filter(r => r.player_id === activePlayerId)
    if (mine.length === 0) return null
    return gameTotalOf(events.reduce((t, ev) => t + liveEventRung(
      getEventByName(ev.event_name), mine.filter(r => r.event_id === ev.id), gradeProfile.player, gradeProfile.bodyweightKg,
    ), 0))
  }, [activePlayerId, swapPlayerId, gradeProfile.player, gradeProfile.bodyweightKg, results, events])

  // ── DR-10: flash the banner number when a new result lifts the colour score ─
  // No flash on first paint, on player switch, or on a drop.
  // The previous score is tracked in state and compared during render (React's
  // "storing information from previous renders" pattern), not in an effect.
  const [scoreSeen, setScoreSeen] = useState<{ pid: string | null; score: number | null }>({ pid: activePlayerId, score: myColourScore })
  const [rankFlash, setRankFlash] = useState<{ from: number; to: number } | null>(null)
  if (scoreSeen.pid !== activePlayerId || scoreSeen.score !== myColourScore) {
    setScoreSeen({ pid: activePlayerId, score: myColourScore })
    const improved = scoreSeen.pid === activePlayerId && scoreSeen.score !== null && myColourScore !== null && myColourScore > scoreSeen.score
    // A switch, a drop or a sideways change clears any flash still up.
    setRankFlash(improved ? { from: scoreSeen.score!, to: myColourScore! } : null)
  }
  useEffect(() => {
    if (!rankFlash) return
    const t = setTimeout(() => setRankFlash(null), 2600)
    return () => clearTimeout(t)
  }, [rankFlash])

  // ── Load initial data ──────────────────────────────────────────────────────
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
        // The game's results load in the same wave, from lib/useSessionResults.ts.
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
        const stored = storedActivePlayerId()
        const landOn = stored && (children ?? []).some(c => (c as { id: string }).id === stored) ? stored : authUser.id
        setActivePlayerId(landOn)
        setActiveTab(`player-${landOn}`) // leaderboard stays one tap away
        if ((p as Record<string, unknown>).role === 'judge') setIsJudge(true)
      }

      const s = sessionRes.data
      setSession(s as Record<string, unknown> | null)
      if (s && !(s as Record<string, unknown>).is_active) { setSessionEnded(true); setServerClosed(true) }

      setEvents((eventsRes.data ?? []) as SessionEvent[])
    }
    load()
  }, [sessionId])

  // ── Load player info for leaderboard ──────────────────────────────────────
  // Keyed on WHO is in the game, not on the results themselves: it used to
  // re-read on every save and every 15 second poll on every phone. Now it
  // reads again only when a new player appears.
  const playerIdsKey = [...new Set(confirmedResults.map(r => r.player_id).filter((id): id is string => !!id))].sort().join(',')
  useEffect(() => {
    if (!playerIdsKey) return
    const ids = playerIdsKey.split(',')
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
  }, [playerIdsKey])

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
  // Domain colours and each player's colour total per game (which the
  // season_points view ranks) are written by the recheck route, which otherwise
  // only runs when a player opens their own screens. A missing total leaves a
  // player out of the game's ranking and lifts everyone below them, so the
  // kaiwhakawā's screen asks for every registered player in the game. Once per
  // game per device; best-effort, like every recheck. Waits for serverClosed,
  // not sessionEnded: a recheck of a game still open scores nothing for it.
  // The timer fires up to a second BEFORE the server's expiry, and sessions is
  // not in the realtime publication, so nothing else would tell this screen
  // the game closed. Ask until the row says so: every 5s for up to 5 minutes.
  useEffect(() => {
    if (!sessionEnded || serverClosed || !isJudge) return
    let cancelled = false
    let tries = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      await supabase.rpc('close_expired_sessions')
      const { data } = await supabase.from('sessions').select('is_active').eq('id', sessionId).maybeSingle()
      if (cancelled) return
      if (data && data.is_active === false) { setServerClosed(true); return }
      tries = tries + 1
      if (tries < 60) timer = setTimeout(check, 5000)
    }
    void check()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [sessionEnded, serverClosed, isJudge, sessionId])

  const refreshedBoardFor = useRef<string | null>(null)
  useEffect(() => {
    if (!serverClosed || !isJudge || refreshedBoardFor.current === sessionId) return
    const ids = [...new Set(confirmedResults.map(r => r.player_id).filter((id): id is string => !!id))]
    if (ids.length === 0) return
    refreshedBoardFor.current = sessionId
    void (async () => {
      for (let i = 0; i < ids.length; i += 5) {
        await Promise.all(ids.slice(i, i + 5).map(id => recheckGrades({ playerId: id, force: true })))
      }
    })()
  }, [serverClosed, isJudge, confirmedResults, sessionId])

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
    // Confirmed rows only: this fires once ever, and a score still on its way
    // could yet fail.
    const mine = confirmedResults.filter(r => r.player_id === activePlayerId)
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
  }, [confirmedResults, events, activePlayerId, sessionId, sessionEnded])

  // ── Saving a score on an official event ────────────────────────────────────
  // The sheet hears back at once: the score is drawn now and written behind
  // (lib/useSessionResults.ts). A failure shows the error toast below, with
  // Try again. One path for the player tab and the kaiwhakawā tab.
  const submitOfficial = (args: Parameters<typeof prepareEntry>[0]) => {
    const prep = prepareEntry(args)
    if (prep.error !== null) return Promise.resolve({ error: prep.error, isPR: false })
    // The rating reads the match, so it is re-read only after one is
    // recorded, which is only ever for a game (or an edit that clears one).
    live.save({ ...prep.job, onMatched: sportRatings.reload })
    return Promise.resolve({ error: null, isPR: prep.isPR })
  }
  const deleteOfficial = (id: string) => {
    const r = results.find(x => x.id === id)
    const ev = r ? events.find(e => e.id === r.event_id) : undefined
    live.remove(id, [ev?.event_name, r?.score_label].filter(Boolean).join(' '))
    return Promise.resolve(null)
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  // The clock ticks inside GameBanner, so this page no longer redraws every
  // second. It hears once, when the clock reaches zero on an open game.
  const onClockExpired = () => {
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--white)', maxWidth: '640px', margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes barShimmer { from { left: -45%; } to { left: 105%; } }
        @keyframes takeoverUp { from { transform: translateY(6%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes rankImprove { 0% { transform: translateY(45%); opacity: 0; } 40% { transform: translateY(0); opacity: 1; } 55% { color: var(--grade-kowhai); } 100% { color: var(--white); } }
      `}</style>

      {/* Top banner — Colour score + Timer */}
      <GameBanner
        startedAt={(session?.started_at as string | undefined) ?? null}
        isActive={!!session?.is_active}
        ended={sessionEnded}
        colourScore={myColourScore}
        flash={rankFlash}
        onExpired={onClockExpired}
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', background: 'var(--dark)', position: 'sticky', top: 'calc(var(--site-bar-h, 0px) + var(--game-banner-h, 76px))', zIndex: 9 }}>
        {allPlayers.map(p => {
          const pid = p.id as string
          const label = (p.display_name || p.username || p.full_name) as string
          const tabId = `player-${pid}`
          const active = activeTab === tabId
          return (
            <button className="press" key={pid} onClick={() => { setActiveTab(tabId); setActivePlayerId(pid); setSheetEventId(null) }}
              style={{
                padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '13px', fontWeight: active ? 700 : 400, flexShrink: 0,
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--white)' : 'var(--grey)',
                borderBottom: `2px solid ${active ? 'var(--blue)' : 'transparent'}`,
              }}>
              {label}
            </button>
          )
        })}
        <button className="press" onClick={() => { setActiveTab('leaderboard'); setSheetEventId(null) }}
          style={{
            padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: '13px', fontWeight: activeTab === 'leaderboard' ? 700 : 400, flexShrink: 0,
            background: activeTab === 'leaderboard' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'leaderboard' ? 'var(--white)' : 'var(--grey)',
            borderBottom: `2px solid ${activeTab === 'leaderboard' ? 'var(--blue)' : 'transparent'}`,
          }}>
          Leaderboard
        </button>
        {isJudge && (
          <button className="press" onClick={() => { setActiveTab('judge-mode'); setSheetEventId(null) }}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '13px', fontWeight: activeTab === 'judge-mode' ? 700 : 400, flexShrink: 0,
              background: activeTab === 'judge-mode' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'judge-mode' ? 'var(--red)' : 'var(--grey)',
              borderBottom: `2px solid ${activeTab === 'judge-mode' ? 'var(--red)' : 'transparent'}`,
            }}>
            Kaiwhakawā
          </button>
        )}
        {isJudge && (
          <button className="press" onClick={() => setActiveTab('judge-summary')}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '13px', fontWeight: activeTab === 'judge-summary' ? 700 : 400, flexShrink: 0,
              background: activeTab === 'judge-summary' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'judge-summary' ? 'var(--red)' : 'var(--grey)',
              borderBottom: `2px solid ${activeTab === 'judge-summary' ? 'var(--red)' : 'transparent'}`,
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
        // still scores nothing.
        const covered = domainsCovered(events, scoredIds, swaps.scoredSlugs)
        const barScored = new Set(events.filter(ev => covered.has(ev.domain_number)).map(ev => ev.id))
        const sheetSlot = sheetEventId ? slots.find(sl => sl.se.id === sheetEventId) : undefined
        const sheetEvent = sheetSlot?.kind === 'official' ? events.find(e => e.id === sheetEventId) : undefined
        const eventDataFor = (slot: PlaySlot) => slot.kind === 'official' ? getEventByName(slot.se.event_name) : getEventBySlug(slot.se.event_slug)
        const rungFor = (slot: PlaySlot) => liveEventRung(eventDataFor(slot), slotRows(slot), gradeProfile.player, gradeProfile.bodyweightKg,
          sportRatings.ratings?.get(eventDataFor(slot)?.name ?? ''))
        // A domain's segment takes the best colour reached anywhere in it.
        const domainFill = (ev: { domain_number: number }) =>
          rungSegment(Math.max(0, ...slots.filter(sl => sl.se.domain_number === ev.domain_number).map(rungFor))) ?? 'var(--grey)'
        // This game's colour so far: the official events' rungs summed and
        // divided by ten, exactly as the game report and /history count it.
        // Swapped and added events never count, as on the Season board.
        // Hidden until something is scored: "This game · Mā" beside
        // "0 of 10 events scored" reads as a verdict, not an empty state.
        const gameColour = gradeProfile.player && doneEvents.length > 0
          ? gradeForRung(liveGameColourRung(
              slots.map(sl => ({ official: sl.kind === 'official', ev: eventDataFor(sl), rows: slotRows(sl) })),
              gradeProfile.player, gradeProfile.bodyweightKg))
          : null

        return (
          <div key={pid} style={{ padding: '16px' }}>
            {sessionEnded && (
              <div style={{ background: 'var(--red-tint)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--red)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '18px' }}>Session Ended</div>
                <div style={{ color: 'var(--grey)', fontSize: '13px', marginTop: '4px' }}>Score submission is locked</div>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 12px', marginBottom: '6px' }}>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  <span style={{ color: 'var(--white)', fontWeight: 600 }}>{doneEvents.length}</span> of {events.length} events scored
                  {doneEvents.length === events.length && events.length > 0 && (
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}> — All {events.length} events played</span>
                  )}
                </div>
                {gameColour && (
                  <div data-testid="game-colour" title="This game's colour so far" style={{
                    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.12em',
                  }}>
                    This game
                    <GradeDot grade={gameColour} size={10} />
                    <span style={{ color: 'var(--white)', fontWeight: 600 }}>{gameColour.name}</span>
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <ProgressSegments events={events} scoredIds={barScored} fillFor={domainFill} />
                {fullHousePulseId === pid && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-pill)', overflow: 'hidden', pointerEvents: 'none' }}>
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
              gameLineFor={slot => gameLineOf(eventDataFor(slot))}
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
                prRows={playerPRRows[sheetSlot.se.event_slug] ?? []}
                locked={sessionEnded}
                standards={{
                  player: gradeProfile.player, bodyweightKg: gradeProfile.bodyweightKg, reached: rungFor(sheetSlot),
                  bodyweightPrompt: <BodyweightField playerId={pid} eventSlugs={[sheetSlot.se.event_slug]} day={sessionDay}
                    locked={sessionEnded} onSaved={gradeProfile.setBodyweightKg} />,
                }}
                bestLabel="Best today"
                prLabel="Training"
                natural
                onClose={() => setSheetEventId(null)}
                onSubmit={(v, editingId, matchOpponents) => swaps.submit(sheetSlot.se.id, v, editingId, matchOpponents)}
                onDelete={swaps.deleteEntry}
                onSubmitted={(labelText) => {
                  setSheetEventId(null)
                  showToast({ eventName: sheetSlot.se.event_name, label: labelText, isPR: false, isNewEvent: false })
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
                seasonPR={seasonPRFor(playerPRRows, sheetEvent.event_slug)}
                prRows={prRowsFor(playerPRRows, sheetEvent.event_slug, results.filter(r => r.event_id === sheetEvent.id && r.player_id === pid))}
                locked={sessionEnded}
                standards={{
                  player: gradeProfile.player, bodyweightKg: gradeProfile.bodyweightKg, reached: rungFor(sheetSlot!),
                  bodyweightPrompt: <BodyweightField playerId={pid} eventSlugs={[sheetEvent.event_slug]} day={sessionDay}
                    locked={sessionEnded} onSaved={kg => { gradeProfile.setBodyweightKg(kg); contest.refresh() }} />,
                }}
                contest={contestSe?.id === sheetEvent.id ? contestCard(pid) : undefined}
                opponentBlocked={contestSe?.id === sheetEvent.id ? contestBlocked : undefined}
                onSubmit={(v, editingId, matchOpponents) => submitOfficial({
                  sessionId: sessionId as string, eventId: sheetEvent.id, eventName: sheetEvent.event_name, playerId: pid, playerName: pName,
                  mode: getEventByName(sheetEvent.event_name)?.inputMode || sheetEvent.input_mode,
                  eventData: getEventByName(sheetEvent.event_name),
                  v, myResults: results.filter(r => r.event_id === sheetEvent.id && r.player_id === pid),
                  prRows: prRowsFor(playerPRRows, sheetEvent.event_slug, []),
                  editingResultId: editingId, matchOpponents,
                })}
                onDelete={deleteOfficial}
                onClose={() => setSheetEventId(null)}
                onSubmitted={(label, meta) => {
                  setSheetEventId(null)
                  // A first-ever game score on this event. Not until the
                  // records have loaded, or every first score of the day would
                  // announce one; and not a second score today.
                  const isNewEvent = playerPRsLoaded && !hasGameRow(playerPRRows[sheetEvent.event_slug] ?? [])
                    && !results.some(r => r.event_id === sheetEvent.id && r.player_id === pid)
                  showToast({ eventName: sheetEvent.event_name, label, isPR: meta.isPR, isNewEvent, next: nextFor(myResults, sheetEvent.id) })
                }}
                onDeleted={() => { /* drawn at once by lib/useSessionResults.ts */ }}
              />
            )}
          </div>
        )
      })}

      {/* Session-end takeover — shows once per player per session, only if they played */}
      {sessionEnded && !endTakeoverDismissed && activePlayerId &&
        confirmedResults.some(r => r.player_id === activePlayerId) && (
        <SessionEndTakeover
          sessionId={sessionId as string}
          playerId={activePlayerId}
          events={events}
          myResults={confirmedResults.filter(r => r.player_id === activePlayerId)}
          registeredPlayers={new Set(confirmedResults.map(r => r.player_id).filter(Boolean)).size}
          onDismiss={() => {
            localStorage.setItem(`allsport_postgame_${sessionId}_${activePlayerId}`, '1')
            setTakeoverDismissedKey(`allsport_postgame_${sessionId}_${activePlayerId}`)
          }}
        />
      )}

      {/* Score-submitted toast — PR (gold/rainbow pop) beats new-event-unlocked beats normal green.
          A save that failed after it was shown replaces it with the error. */}
      {toast && !live.failure && (
        <Toast tone={toast.isPR ? 'pr' : toast.isNewEvent ? 'new' : 'done'}
          actions={toast.next && (() => {
            const next = toast.next
            return <ToastButton onClick={() => { setSheetEventId(next.id); setToast(null) }}>Next: {next.name}</ToastButton>
          })()}>
          <ToastText>
            {toast.playerName && <span style={{ color: 'var(--red)' }}>{toast.playerName} — </span>}
            {toast.isPR
              ? <><span style={{ color: 'var(--amber)' }}>NEW PR</span> — {toast.eventName} — {toast.label}</>
              : toast.isNewEvent
                ? <><span style={{ color: 'var(--blue-light)' }}>New event unlocked</span> — {toast.eventName}! <span style={{ color: 'var(--grey-light)' }}>{toast.label}</span></>
                : <>Score in — {toast.eventName} — {toast.label}</>}
          </ToastText>
        </Toast>
      )}

      {/* A score that did not save. It stays until dismissed: the row was
          drawn and then taken away, and the player must not miss why. */}
      {live.failure && (
        <Toast tone="error" actions={<>
          <ToastButton tone="retry" onClick={live.failure.retry}>Try again</ToastButton>
          <button className="press" onClick={live.dismissFailure} aria-label="Dismiss" style={{
            flexShrink: 0, width: '44px', height: '44px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            background: 'none', border: '1px solid var(--border-strong)', color: 'var(--grey-light)', fontSize: '14px',
          }}>✕</button>
        </>}>
          <ToastText>Not saved: {live.failure.what}</ToastText>
          <div style={{ fontSize: '13px', color: 'var(--grey-light)', marginTop: '2px', lineHeight: 1.4 }}>{live.failure.message}</div>
        </Toast>
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
          : liveEventRung(judgeEventDataFor(slot), judgeSlotRows(slot), gradeProfile.player, gradeProfile.bodyweightKg,
            sportRatings.ratings?.get(judgeEventDataFor(slot)?.name ?? ''))
        const judgeDomainFill = (ev: { domain_number: number }) =>
          rungSegment(Math.max(0, ...judgeSlots.filter(sl => sl.se.domain_number === ev.domain_number).map(judgeRungFor))) ?? 'var(--grey)'
        const unlistedPlayers = sessionPlayers.filter(sp => !judgeRoster.registeredIds.has(sp.id))
        const canPickMore = unlistedPlayers.length > 0
        const guestDraft = judgeGuestDraft.trim()
        const addGuest = () => { if (guestDraft) selectJudgeTarget({ guestName: guestDraft }) }

        return (
          <div style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--red)', letterSpacing: '0.05em', lineHeight: 1 }}>Kaiwhakawā</div>
            <div style={{ fontSize: '12px', color: 'var(--grey)', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', marginBottom: '12px' }}>SCORE FOR ANY PLAYER</div>

            {sessionEnded && (
              <div style={{ background: 'var(--red-tint)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '14px', textAlign: 'center' }}>
                <div style={{ color: 'var(--red)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '18px' }}>Session Ended</div>
                <div style={{ color: 'var(--grey)', fontSize: '13px', marginTop: '4px' }}>Score submission is locked</div>
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
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '10px' }}>
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
                    flex: 1, minWidth: 0, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--amber) 27%, transparent)',
                    borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--white)',
                    fontSize: '15px', fontFamily: 'var(--font-body)', boxSizing: 'border-box',
                  }}
                />
                <button className="press" onClick={addGuest} disabled={!guestDraft} style={{
                  flexShrink: 0, borderRadius: 'var(--radius-md)', padding: '0 18px', cursor: guestDraft ? 'pointer' : 'default',
                  background: guestDraft ? 'var(--amber)' : 'var(--surface-2)', color: guestDraft ? 'var(--black)' : 'var(--grey)',
                  border: 'none', fontFamily: 'var(--font-label)', fontSize: '14px',
                  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>Score</button>
              </div>
            )}

            {/* No player selected — session roster */}
            {!target && (
              judgeRoster.registered.length + judgeRoster.guests.length === 0 ? (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--white)', letterSpacing: '0.03em' }}>No scores yet</div>
                  <div style={{ fontSize: '13px', color: 'var(--grey)', marginTop: '6px', lineHeight: 1.5 }}>
                    Tap {canPickMore && <><span style={{ color: 'var(--grey-light)' }}>+ Player</span> to pick a registered player, or </>}
                    <span style={{ color: 'var(--amber)' }}>+ Guest</span> to score someone by name.
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
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--white)', letterSpacing: '0.03em', lineHeight: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {target.name}
                    {target.isGuest && <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--amber)', marginLeft: '10px', letterSpacing: '0.1em' }}>GUEST</span>}
                  </div>
                  <button className="press" onClick={() => selectJudgeTarget(null)} style={{
                    flexShrink: 0, background: 'none', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)',
                    color: 'var(--grey)', cursor: 'pointer', padding: '0 16px', minHeight: '44px',
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
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      <span style={{ color: 'var(--white)', fontWeight: 600 }}>{doneEvents.length}</span> of {events.length} events scored
                      {doneEvents.length === events.length && events.length > 0 && (
                        <span style={{ color: 'var(--green)', fontWeight: 600 }}> — All {events.length} events played</span>
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
                  gameLineFor={slot => target?.isGuest ? undefined : gameLineOf(judgeEventDataFor(slot))}
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
                    prRows={target.id ? (targetPRRows[judgeSheetSlot.se.event_slug] ?? []) : []}
                    locked={sessionEnded}
                    standards={{
                      player: gradeProfile.player, bodyweightKg: gradeProfile.bodyweightKg, reached: judgeRungFor(judgeSheetSlot),
                      bodyweightPrompt: <BodyweightField playerId={target.isGuest ? null : (target.id ?? null)} eventSlugs={[judgeSheetSlot.se.event_slug]} day={sessionDay}
                        locked={sessionEnded} onSaved={kg => { gradeProfile.setBodyweightKg(kg); contest.refresh() }} />,
                    }}
                    bestLabel="Best today"
                    prLabel="Training"
                    natural
                    onClose={() => setSheetEventId(null)}
                    onSubmit={(v, editingId, matchOpponents) => swaps.submit(judgeSheetSlot.se.id, v, editingId, matchOpponents)}
                    onDelete={swaps.deleteEntry}
                    onSubmitted={(labelText) => {
                      setSheetEventId(null)
                      showToast({ eventName: judgeSheetSlot.se.event_name, label: labelText, isPR: false, isNewEvent: false, playerName: target?.name })
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
                    contest={contestSe?.id === sheetEvent.id && contest.live && contest.safety ? api => (
                      <>
                        <ContestJudgeCard
                          table={contestNames([...contest.table.values()]
                            .sort((x, y) => y.points - x.points || x.losses - y.losses).map(r => r.playerId))}
                          unbeaten={contestNames(unbeaten(contest.table).map(r => r.playerId))}
                          contact={contest.safety!.level === 'contact'} mixed={contest.safety!.mixed}
                          error={contest.error} onMixed={m => { void contest.setMixed(m) }} />
                        {contestCard(target.id ?? null)?.(api)}
                      </>
                    ) : undefined}
                    opponentBlocked={contestSe?.id === sheetEvent.id ? contestBlocked : undefined}
                    eventData={getEventByName(sheetEvent.event_name)}
                    myResults={targetResults.filter(r => r.event_id === sheetEvent.id)}
                    opponents={pickOpponents(results, { id: target.id, name: target.name })}
                    seasonPR={target.id ? seasonPRFor(targetPRRows, sheetEvent.event_slug) : null}
                    prRows={target.id ? prRowsFor(targetPRRows, sheetEvent.event_slug, targetResults.filter(r => r.event_id === sheetEvent.id)) : []}
                    locked={sessionEnded}
                    standards={{
                      player: gradeProfile.player, bodyweightKg: gradeProfile.bodyweightKg, reached: judgeRungFor(judgeSheetSlot!),
                      bodyweightPrompt: <BodyweightField playerId={target.isGuest ? null : (target.id ?? null)} eventSlugs={[sheetEvent.event_slug]} day={sessionDay}
                        locked={sessionEnded} onSaved={kg => { gradeProfile.setBodyweightKg(kg); contest.refresh() }} />,
                    }}
                    onSubmit={(v, editingId, matchOpponents) => submitOfficial({
                      sessionId: sessionId as string, eventId: sheetEvent.id, eventName: sheetEvent.event_name, playerId: target.id, playerName: target.name,
                      mode: getEventByName(sheetEvent.event_name)?.inputMode || sheetEvent.input_mode,
                      eventData: getEventByName(sheetEvent.event_name),
                      v, myResults: targetResults.filter(r => r.event_id === sheetEvent.id),
                      prRows: target.id ? prRowsFor(targetPRRows, sheetEvent.event_slug, []) : [],
                      editingResultId: editingId, matchOpponents,
                    })}
                    onDelete={deleteOfficial}
                    onClose={() => setSheetEventId(null)}
                    onSubmitted={(label, meta) => {
                      setSheetEventId(null)
                      showToast({ eventName: sheetEvent.event_name, label, isPR: meta.isPR, isNewEvent: false, playerName: target.name, next: nextFor(targetResults, sheetEvent.id) })
                    }}
                    onDeleted={() => { /* drawn at once by lib/useSessionResults.ts */ }}
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
          sessionId={sessionId as string}
          closed={sessionEnded}
          events={events}
          results={results}
          playerInfoMap={playerInfoMap}
          currentPlayerId={activePlayerId}
        />
      )}

      {/* Judge Summary tab */}
      {activeTab === 'judge-summary' && isJudge && (
        <JudgeSummaryTab
          events={events}
          results={results}
          playerInfoMap={playerInfoMap}
          onDelete={live.remove}
        />
      )}

      {/* Not logged in */}
      {!player && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--grey)', marginBottom: '16px' }}>Log in to submit scores</div>
          <a href="/login" style={{ color: 'var(--blue)', fontWeight: 700, textDecoration: 'none' }}>Log in →</a>
        </div>
      )}
    </div>
  )
}
