// ─── Quick-entry sheet ───────────────────────────────────────────────────────
// The one place a score is entered, at an official game and in a personal
// game. It knows an event, the submissions made on it and how to draw the
// fields; it does NOT know which table they are stored in. The screen passes
// `onSubmit` / `onDelete`, so `results` and `workout_entries` share this.
//
// Extracted from app/scoring/[sessionId]/page.tsx (September 2026).

'use client'

import { useEffect, useRef, useState } from 'react'
import EventIcon from '@/components/EventIcon'
import { domainColor } from '@/components/EventIcon'
import { isGameEntry } from '@/lib/matches'
import { isTimedEffort, type EventData } from '@/lib/eventData'
import { unitsIn, unitRule, fmtUnitsLabel, RULE_WORDS } from '@/lib/units'
import { computeScoreVals, valsFromResult, valsFromRaw, EMPTY_VALS, type EntryVals } from '@/lib/scoring'
import {
  takesSets, takesDistance, estimateFromSets, estimateFromDistance, paceLabel, MAX_ESTIMATED_REPS,
} from '@/lib/naturalFormats'
import {
  formatPR, sportWDL, StepBtn, INP, QES_LBL, QES_CHIP, QES_INP,
  type PlayEvent, type EntryRow,
} from './chrome'

/** What one submission did, so the screen can pick the right toast. */
export type SubmitOutcome = { error: string | null; isPR: boolean; units: number }

/** An opponent the sheet can offer. A guest has no id and is never matched. */
export type OpponentPick = { id: string | null; name: string }

type QuickEntrySheetProps = {
  se: PlayEvent
  eventData: EventData | undefined
  /** This player's submissions on this event, in this game or workout. */
  myResults: EntryRow[]
  /** Who can be picked as an opponent. Empty in a personal game. */
  opponents: OpponentPick[]
  seasonPR: number | string | null
  /** Scoring is closed: the game ended, or the workout is finished. */
  locked: boolean
  /** Wording for the two hint tiles, which differ between a game and a workout. */
  bestLabel?: string
  prLabel?: string
  /**
   * Log it the way people train: sets of weight × reps on a lift, a distance
   * and a time on a run or a ride. ON A SWAPPED, EXTRA OR PERSONAL EVENT ONLY —
   * an official event keeps the official format, so a prediction can never beat
   * a measured result in a game.
   */
  natural?: boolean
  /**
   * Whether a Game rung records a win, draw or loss. False in a personal game:
   * the database refuses a logged Game-rung result, so playing is recorded as
   * training and the drill fields stay.
   */
  allowGames?: boolean
  onClose: () => void
  onSubmit: (v: EntryVals, editingId: string | null, matchOpponents: string[] | null) => Promise<SubmitOutcome>
  onDelete: (id: string) => Promise<string | null>
  onSubmitted: (label: string, meta: { isPR: boolean; units: number }) => void
  onDeleted: () => void
}

export default function QuickEntrySheet({
  se, eventData, myResults, opponents, seasonPR, locked,
  bestLabel = "Today's best", prLabel = 'Season PR', allowGames = true, natural = false,
  onClose, onSubmit, onDelete, onSubmitted, onDeleted,
}: QuickEntrySheetProps) {
  // A stored opponent NAME resolves to an id only when exactly one pick carries
  // it: two players sharing a display name stay two people, and an unresolvable
  // name leaves its match alone (see keepExistingMatch below).
  const opponentIdFor = (name: string | null | undefined): string | null => {
    const n = (name ?? '').trim().toLowerCase()
    if (!n) return null
    const hits = opponents.filter(o => o.id && o.name.trim().toLowerCase() === n)
    return hits.length === 1 ? hits[0].id : null
  }
  const mode = (eventData?.inputMode || se.input_mode || 'strength') as string
  const isDislocate = eventData?.slug === 'shoulder-dislocate'
  const seasonPRNum = typeof seasonPR === 'number' ? seasonPR : null
  const myBestResult = myResults.length > 0
    ? myResults.reduce((best, r) => r.raw_score > best.raw_score ? r : best, myResults[0])
    : undefined
  const unitsHere = unitsIn(eventData, myResults)
  const unitWords = eventData ? RULE_WORDS[unitRule(eventData).rule] : RULE_WORDS.set

  const [v, setV] = useState<EntryVals>(() => {
    let init: EntryVals = { ...EMPTY_VALS }
    if (myBestResult) init = { ...init, ...valsFromResult(mode, myBestResult) }
    else if (seasonPRNum !== null) init = { ...init, ...valsFromRaw(mode, eventData, seasonPRNum) }
    if (mode === 'sport') init = { ...init, sportResult: '', opponentName: '', sportScore: '' }
    // A Game rung pre-fills the last opponent's NAME from the best result. Resolve
    // the id too, so what the sheet shows as picked is what gets recorded.
    init = { ...init, opponentId: opponentIdFor(init.opponentName) ?? '' }
    // A lift opens with one set, pre-filled from the last one done, so the
    // common case (another set of the same) is two taps.
    if (natural && eventData && takesSets(eventData)) {
      init = { ...init, setRows: [{ weightKg: init.weightKg || '', reps: init.repCount || '' }] }
    }
    return init
  })
  const [showHow, setShowHow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingResult, setEditingResult] = useState<EntryRow | null>(null)
  const inFlight = useRef(false)
  // True while editing a result whose stored opponent name could not be
  // resolved to exactly one player. Until the opponent is changed on purpose,
  // its match is left alone — sending "no opponent" would silently delete a
  // match the player never meant to touch.
  const keepExistingMatch = useRef(false)

  const set = (patch: Partial<EntryVals>) => setV(prev => ({ ...prev, ...patch }))

  // Lock body scroll while the sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function bumpNum(field: 'weightKg' | 'repCount' | 'distanceVal' | 'scoreInput', delta: number, min = 0) {
    const cur = parseFloat(v[field]) || 0
    const next = Math.max(min, Math.round((cur + delta) * 100) / 100)
    set({ [field]: String(next) } as Partial<EntryVals>)
  }
  function bumpTime(delta: number) {
    const t = Math.max(0, (parseFloat(v.timeMins) || 0) * 60 + (parseFloat(v.timeSecs) || 0) + delta)
    set({ timeMins: String(Math.floor(t / 60)), timeSecs: String(Math.round(t % 60)) })
  }

  const setMode = natural && !!eventData && takesSets(eventData)
  const distanceMode = natural && !!eventData && takesDistance(eventData)
  const sets = (v.setRows ?? []).map(r => ({ weightKg: parseFloat(r.weightKg) || 0, reps: parseInt(r.reps) || 0 }))
    .filter(r => r.weightKg > 0 && r.reps > 0)
  const naturalMetres = Math.round((parseFloat(v.distanceKm ?? '') || 0) * 1000)
  const naturalSecs = (parseFloat(v.timeMins) || 0) * 60 + (parseFloat(v.timeSecs) || 0)
  const estimate = setMode ? estimateFromSets(sets)
    : distanceMode && eventData ? estimateFromDistance(eventData, naturalMetres, naturalSecs)
    : null

  const scored = setMode || distanceMode ? estimate : computeScoreVals(mode, eventData, v)
  const canSubmit = scored !== null && !submitting && !locked

  const setRows = v.setRows ?? []
  const setSet = (i: number, patch: Partial<{ weightKg: string; reps: string }>) =>
    set({ setRows: setRows.map((r, j) => (i === j ? { ...r, ...patch } : r)) })
  // "+ Set" copies the last row, the pattern every gym app uses: a 5×5 is one
  // row filled in and four taps.
  const addSet = () => set({
    setRows: [...setRows, setRows.length > 0 ? { ...setRows[setRows.length - 1] } : { weightKg: v.weightKg, reps: v.repCount }],
  })

  async function handleSheetSubmit() {
    if (!canSubmit || !scored) return
    if (inFlight.current) return // ref guard — React state alone lets a double-tap insert twice
    inFlight.current = true
    setSubmitting(true); setError('')
    // What to record as a match. null leaves matches untouched.
    //   · Not a game (a drill rung, a measured event): on an edit, clear any match
    //     this row carried — it may have been a Game result before the edit.
    //   · A game with a picked player: record it.
    //   · An edit whose unresolvable opponent was never touched: leave it be.
    //   · Otherwise there is no registered opponent: clear on edit, skip on new.
    const isGame = allowGames && isGameEntry(mode, eventData, v.difficultyTier)
    const matchOpponents: string[] | null =
      !isGame ? (editingResult ? [] : null)
      : v.opponentId ? [v.opponentId]
      : editingResult && keepExistingMatch.current ? null
      : editingResult ? [] : null
    const outcome = await onSubmit(v, editingResult?.id ?? null, matchOpponents)
    inFlight.current = false
    setSubmitting(false)
    if (outcome.error) { setError(outcome.error); return }
    setEditingResult(null)
    onSubmitted(scored.score_label, { isPR: outcome.isPR, units: outcome.units })
  }

  async function handleSheetDelete(resultId: string) {
    if (editingResult?.id === resultId) setEditingResult(null)
    const delErr = await onDelete(resultId)
    if (delErr) { setError(delErr); return }
    onDeleted()
  }

  // Quick-pick chips: pre-fill from last submission / season PR
  const quickPicks: { label: string; patch: Partial<EntryVals> }[] = []
  if (mode !== 'sport' && !setMode && !distanceMode) {
    if (myBestResult) quickPicks.push({ label: `Today · ${myBestResult.score_label}`, patch: valsFromResult(mode, myBestResult) })
    if (seasonPRNum !== null) {
      quickPicks.push({ label: `PR · ${formatPR(seasonPRNum, mode, eventData?.slug, eventData)}`, patch: valsFromRaw(mode, eventData, seasonPRNum) })
      if (mode === 'strength' && !isDislocate) {
        quickPicks.push({ label: `PR +2.5kg`, patch: { weightKg: String(seasonPRNum + 2.5) } })
      }
    }
  }

  // Opponent quick picks for sport mode: everyone else with a result this session
  const tiers = eventData?.difficultyTiers ?? []
  // How the SELECTED rung is scored. A `Game` rung tops a drill ladder with the
  // real contest, so it swaps the reps/time input for win/draw/loss; a `weight`
  // rung swaps reps for load. Both are read off the tier, never matched by name.
  const rung = tiers.find(t => t.name === v.difficultyTier)
  const gameRung = allowGames && rung?.scoring === 'sport'
  const weightRung = rung?.scoring === 'weight'

  const showSport = allowGames && (mode === 'sport' || gameRung)
  // Keyed by player id, so two players sharing a display name stay two people
  // and a picked chip records a real match. Guests keep a name-only chip.
  const opponentPicks = showSport ? opponents : []
  const opponentPickActive = (p: { id: string | null; name: string }) =>
    p.id ? v.opponentId === p.id : !v.opponentId && v.opponentName === p.name

  const showTierChips = tiers.length > 0 && (
    mode === 'difficulty+time' || mode === 'difficulty+reps' ||
    mode === 'difficulty+distance' || mode === 'hold')
  const showWeight = mode === 'strength' || mode === 'weight+time' || weightRung
  // A weight rung records reps as well as load — the load ranks, the reps are
  // the record of what was actually done.
  // `records` is load-bearing, not decoration: a weight rung shows the rep field
  // only because it declares `records: 'reps'`.
  const showReps = mode === 'strength' || mode === 'reps' ||
    (mode === 'difficulty+reps' && !gameRung && (!weightRung || rung?.records === 'reps'))
  const showTime = mode === 'time' || mode === 'hold' || mode === 'weight+time' ||
    (mode === 'difficulty+time' && !gameRung)
  const showDistance = mode === 'distance' || (mode === 'difficulty+distance' && !gameRung)
  // Golf and Disc Golf keep their stroke count on the Game rung.
  const showStrokes = mode === 'score' || (gameRung && rung?.records === 'strokes')
  const domainC = domainColor(se.domain_number)
  const contentMissing = !eventData || eventData.howToPerform === 'Content coming soon.'
  const myResultsSorted = [...myResults].sort((a, b) => b.raw_score - a.raw_score)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <style>{`@keyframes qesUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(640px, 100vw)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column',
        background: '#141414', border: '1px solid #2a2a2a', borderBottom: 'none',
        borderRadius: '24px 24px 0 0', overflow: 'hidden', animation: 'qesUp 0.28s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ height: '4px', flexShrink: 0, background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px 10px', flexShrink: 0 }}>
          <EventIcon slug={se.event_slug || eventData?.slug || ''} emoji={eventData?.emoji} domainNumber={se.domain_number} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', lineHeight: 1, color: '#fff', letterSpacing: '0.03em' }}>{se.event_name}</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '3px' }}>
              {se.domain_name}{unitsHere > 0 ? ` · ${fmtUnitsLabel(unitsHere)}` : ''}
            </div>
          </div>
          <button onClick={() => setShowHow(h => !h)} style={{
            height: '38px', padding: '0 12px', borderRadius: '10px', cursor: 'pointer',
            background: showHow ? '#2371BB26' : '#181818', border: `1px solid ${showHow ? '#2371BB' : '#2a2a2a'}`,
            color: showHow ? '#fff' : '#999', fontFamily: 'var(--font-label)',
            fontSize: '13px', letterSpacing: '0.1em', fontWeight: 600,
          }}>HOW TO</button>
          <button onClick={onClose} style={{
            width: '38px', height: '38px', borderRadius: '10px', cursor: 'pointer', flexShrink: 0,
            background: '#181818', border: '1px solid #2a2a2a', color: '#999', fontSize: '15px',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '0 16px 20px' }}>
          {showHow ? (
            <div>
              <div style={{ ...QES_LBL, color: '#F9B051' }}>How to perform</div>
              <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: '#ccc', fontWeight: 300, margin: 0 }}>
                {contentMissing ? 'Content coming soon — ask your kaiwhakawā for a demo.' : eventData!.howToPerform}
              </p>
              <div style={{ ...QES_LBL, color: '#F9B051' }}>Rules & standards</div>
              <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: '#ccc', fontWeight: 300, margin: 0 }}>
                {contentMissing || eventData!.rules === 'Content coming soon.' ? 'Content coming soon.' : eventData!.rules}
              </p>
              {tiers.length > 0 && (
                <>
                  <div style={{ ...QES_LBL, color: '#F9B051' }}>Difficulty tiers</div>
                  {tiers.map(t => (
                    <div key={t.level} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #1e1e1e', fontSize: '13.5px' }}>
                      <span style={{ fontFamily: 'var(--font-label)', color: '#4DB26E', width: '30px', flexShrink: 0, fontWeight: 600 }}>D{t.level}</span>
                      <span style={{ color: '#ccc', fontWeight: 300 }}>
                        {t.name}
                        {t.detail && <span style={{ display: 'block', color: '#777', fontSize: '12.5px' }}>{t.detail}</span>}
                      </span>
                    </div>
                  ))}
                </>
              )}
              <button onClick={() => setShowHow(false)} style={{
                width: '100%', marginTop: '18px', height: '50px', borderRadius: '999px',
                border: '1px solid #2a2a2a', background: '#181818', color: '#fff', cursor: 'pointer',
                fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '14px',
              }}>Back to scoring</button>
            </div>
          ) : (
            <div>
              {/* Session best + PR hints */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <div style={{ flex: 1, background: '#101010', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '9px 12px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '10.5px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{bestLabel}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', color: myBestResult ? '#4DB26E' : '#444', marginTop: '2px' }}>
                    {myBestResult ? (mode === 'sport' ? sportWDL(myResults) : myBestResult.score_label) : '—'}
                  </div>
                </div>
                <div style={{ flex: 1, background: '#101010', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '9px 12px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '10.5px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{prLabel}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', color: seasonPRNum !== null ? '#F9B051' : '#444', marginTop: '2px' }}>
                    {seasonPRNum !== null ? formatPR(seasonPRNum, mode, eventData?.slug, eventData) : '—'}
                  </div>
                </div>
              </div>

              {locked ? (
                <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '10px', padding: '12px 14px', marginTop: '14px', color: '#EA4742', fontSize: '13px' }}>
                  Scoring is closed
                </div>
              ) : (
                <>
                  {editingResult && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d1a2d', border: '1px solid #2371BB55', borderRadius: '10px', padding: '8px 12px', marginTop: '14px' }}>
                      <span style={{ fontSize: '12.5px', color: '#2371BB', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Editing: {editingResult.score_label}</span>
                      <button onClick={() => { keepExistingMatch.current = false; setEditingResult(null); setV({ ...EMPTY_VALS }) }} style={{ fontSize: '12px', color: '#888', background: 'none', border: '1px solid #333', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  )}

                  {/* Variation selector (rare) */}
                  {eventData?.variations && (
                    <>
                      <div style={QES_LBL}>Variation</div>
                      <select value={v.exerciseVariation} onChange={e => set({ exerciseVariation: e.target.value })} style={{ ...INP, fontSize: '15px' }}>
                        <option value="">Select variation...</option>
                        {eventData.variations.map((va, i) => (
                          <option key={va} value={va}>D{i + 1} — {va}{eventData.weightVariations?.includes(va) ? ' (weight + reps)' : ''}</option>
                        ))}
                      </select>
                    </>
                  )}

                  {/* Difficulty tier chips — the ladder is derived in a natural entry */}
                  {showTierChips && !distanceMode && (
                    <>
                      <div style={QES_LBL}>Difficulty tier — tap How To for descriptions</div>
                      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {tiers.map(t => {
                          const sel = v.difficultyTier === t.name
                          return (
                            <button key={t.level} onClick={() => set({ difficultyTier: t.name })} style={{
                              flexShrink: 0, minWidth: '64px', padding: '8px 11px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                              background: sel ? '#4DB26E1f' : '#161616', border: `1px solid ${sel ? '#4DB26E' : '#2a2a2a'}`,
                            }}>
                              <div style={{ fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 600, color: sel ? '#4DB26E' : '#fff' }}>D{t.level}</div>
                              <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: sel ? '#4DB26E' : '#888', textTransform: 'uppercase', letterSpacing: '0.04em', maxWidth: '110px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Sets — a lift, logged the way it is trained */}
                  {setMode && (
                    <>
                      <div style={QES_LBL}>Sets</div>
                      {setRows.length === 0 && (
                        <div style={{ fontSize: 13, color: '#777', marginBottom: 8 }}>
                          Add the sets you did. The best one counts toward your colours.
                        </div>
                      )}
                      {setRows.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ width: 22, color: '#555', fontFamily: 'var(--font-label)', fontSize: 13 }}>{i + 1}</span>
                          <input type="number" inputMode="decimal" value={r.weightKg} aria-label={`Set ${i + 1} weight`}
                            onChange={e => setSet(i, { weightKg: e.target.value })} placeholder="kg"
                            style={{ ...QES_INP, fontSize: 22 }} />
                          <span style={{ color: '#555' }}>×</span>
                          <input type="number" inputMode="numeric" value={r.reps} aria-label={`Set ${i + 1} reps`}
                            onChange={e => setSet(i, { reps: e.target.value })} placeholder="reps"
                            style={{ ...QES_INP, fontSize: 22 }} />
                          <button onClick={() => set({ setRows: setRows.filter((_, j) => j !== i) })}
                            aria-label={`Remove set ${i + 1}`}
                            style={{ minWidth: 44, minHeight: 44, borderRadius: 12, background: '#181818', border: '1px solid #2a2a2a', color: '#777', cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={addSet} style={{
                        width: '100%', minHeight: 48, borderRadius: 999, cursor: 'pointer', marginBottom: 6,
                        background: 'none', border: '1px dashed #2a2a2a', color: '#999',
                        fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>+ Set</button>
                      <div style={{ fontSize: 12.5, color: '#777', lineHeight: 1.5 }}>
                        {estimate
                          ? `Best set — ${estimate.score_label}`
                          : sets.length > 0
                            ? `Over ${MAX_ESTIMATED_REPS} reps a one-rep max cannot be estimated, so these count as training only.`
                            : 'Each set is one unit of training.'}
                      </div>
                    </>
                  )}

                  {/* Distance and time — a run or a ride as it was actually done */}
                  {distanceMode && (
                    <>
                      <div style={QES_LBL}>Distance and time</div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="number" inputMode="decimal" value={v.distanceKm ?? ''} aria-label="Distance in kilometres"
                          onChange={e => set({ distanceKm: e.target.value })} placeholder="km" style={QES_INP} />
                        <input type="number" inputMode="numeric" value={v.timeMins} aria-label="Minutes"
                          onChange={e => set({ timeMins: e.target.value })} placeholder="min" style={QES_INP} />
                        <span style={{ color: '#555', fontSize: 26, fontFamily: 'var(--font-display)' }}>:</span>
                        <input type="number" inputMode="numeric" value={v.timeSecs} aria-label="Seconds"
                          onChange={e => set({ timeSecs: e.target.value })} placeholder="sec" style={QES_INP} />
                      </div>
                      <div style={{ fontSize: 12.5, color: '#777', marginTop: 8, lineHeight: 1.5 }}>
                        {naturalMetres > 0 && naturalSecs > 0
                          ? `${paceLabel(naturalMetres, naturalSecs)}${estimate ? ` · ${estimate.score_label}` : ' · too short to compare to a rung, so it counts as training only'}`
                          : 'Everything you cover counts as training.'}
                      </div>
                    </>
                  )}

                  {/* Weight stepper */}
                  {showWeight && !setMode && (
                    <>
                      <div style={QES_LBL}>{isDislocate ? 'Grip width (cm)' : 'Weight (kg)'}</div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <StepBtn onClick={() => bumpNum('weightKg', isDislocate ? -1 : -2.5)}>−</StepBtn>
                        <input type="number" inputMode="decimal" value={v.weightKg} onChange={e => set({ weightKg: e.target.value })} placeholder="0" style={QES_INP} />
                        <StepBtn onClick={() => bumpNum('weightKg', isDislocate ? 1 : 2.5)}>+</StepBtn>
                      </div>
                    </>
                  )}

                  {/* Reps stepper */}
                  {showReps && !setMode && (
                    <>
                      <div style={QES_LBL}>Reps</div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <StepBtn onClick={() => bumpNum('repCount', -1, 0)}>−</StepBtn>
                        <input type="number" inputMode="numeric" value={v.repCount} onChange={e => set({ repCount: e.target.value })} placeholder="0" style={QES_INP} />
                        <StepBtn onClick={() => bumpNum('repCount', 1)}>+</StepBtn>
                      </div>
                    </>
                  )}

                  {/* Time stepper (min:sec, ±5s) */}
                  {showTime && !distanceMode && (
                    <>
                      <div style={QES_LBL}>{mode === 'time' || isTimedEffort(eventData?.slug) ? 'Time' : 'Hold time'}</div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <StepBtn onClick={() => bumpTime(-5)}>−</StepBtn>
                        <input type="number" inputMode="numeric" value={v.timeMins} onChange={e => set({ timeMins: e.target.value })} placeholder="min" style={QES_INP} />
                        <span style={{ color: '#555', fontSize: '26px', fontFamily: 'var(--font-display)' }}>:</span>
                        <input type="number" inputMode="numeric" value={v.timeSecs} onChange={e => set({ timeSecs: e.target.value })} placeholder="sec" style={QES_INP} />
                        <StepBtn onClick={() => bumpTime(5)}>+</StepBtn>
                      </div>
                    </>
                  )}

                  {/* Sprint (sec.cs) */}
                  {mode === 'sprint' && (
                    <>
                      <div style={QES_LBL}>Time (seconds . centiseconds)</div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="number" inputMode="numeric" value={v.timeSecs} onChange={e => set({ timeSecs: e.target.value })} placeholder="sec" style={QES_INP} />
                        <span style={{ color: '#555', fontSize: '26px', fontFamily: 'var(--font-display)' }}>.</span>
                        <input type="number" inputMode="numeric" value={v.sprintCs} onChange={e => set({ sprintCs: e.target.value })} placeholder="cs" min={0} max={99} style={QES_INP} />
                      </div>
                    </>
                  )}

                  {/* Distance */}
                  {showDistance && (
                    <>
                      <div style={QES_LBL}>Distance</div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="number" inputMode="decimal" value={v.distanceVal} onChange={e => set({ distanceVal: e.target.value })} placeholder="0" style={QES_INP} />
                        <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }} hidden={mode !== 'distance'}>
                          {(['m', 'cm'] as const).map(u => (
                            <button key={u} onClick={() => set({ distanceUnit: u })} style={{
                              padding: '14px 18px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px',
                              background: v.distanceUnit === u ? '#2371BB' : '#1a1a1a',
                              color: v.distanceUnit === u ? '#fff' : '#666',
                            }}>{u}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Sport, and the `Game` rung that tops a drill ladder */}
                  {showSport && (
                    <>
                      <div style={QES_LBL}>Result</div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {(['win', 'draw', 'loss'] as const).map(r => {
                          const colors = { win: '#4DB26E', draw: '#F9B051', loss: '#EA4742' }
                          const active = v.sportResult === r
                          return (
                            <button key={r} onClick={() => set({ sportResult: r })} style={{
                              flex: 1, padding: '18px 0', border: `2px solid ${active ? colors[r] : '#222'}`,
                              borderRadius: '14px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '20px',
                              letterSpacing: '0.05em', background: active ? colors[r] + '22' : '#111',
                              color: active ? colors[r] : '#555',
                            }}>{r.toUpperCase()}</button>
                          )
                        })}
                      </div>
                      <div style={QES_LBL}>Opponent</div>
                      {opponentPicks.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {opponentPicks.map(p => (
                            <button key={p.id ?? `guest:${p.name}`} onClick={() => { keepExistingMatch.current = false; set({ opponentName: p.name, opponentId: p.id ?? '' }) }} style={{
                              ...QES_CHIP,
                              borderColor: opponentPickActive(p) ? '#2371BB' : '#2a2a2a',
                              background: opponentPickActive(p) ? '#2371BB' : '#161616',
                            }}>{p.name}</button>
                          ))}
                        </div>
                      )}
                      <input value={v.opponentName} onChange={e => { keepExistingMatch.current = false; set({ opponentName: e.target.value, opponentId: '' }) }} placeholder="Opponent name (optional)" style={{ ...INP, fontSize: '15px' }} />
                      {/* A typed name cannot be rated — only a picked player records the match. */}
                      {v.opponentName.trim() && !v.opponentId && opponentPicks.some(p => p.id) &&
                        !opponentPicks.some(p => p.id === null && p.name === v.opponentName.trim()) && (
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '6px', lineHeight: 1.4 }}>
                          Typed names aren&apos;t recorded as a match. Pick your opponent above so this game counts.
                        </div>
                      )}
                      <input value={v.sportScore} onChange={e => set({ sportScore: e.target.value })} placeholder="Score e.g. 21–18 (optional)" style={{ ...INP, fontSize: '15px', marginTop: '8px' }} />
                    </>
                  )}

                  {/* Golf/Disc Golf strokes */}
                  {showStrokes && (
                    <>
                      <div style={QES_LBL}>Stroke count (4 holes)</div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <StepBtn onClick={() => bumpNum('scoreInput', -1, 1)}>−</StepBtn>
                        <input type="number" inputMode="numeric" value={v.scoreInput} onChange={e => set({ scoreInput: e.target.value })} placeholder="e.g. 18" style={QES_INP} />
                        <StepBtn onClick={() => bumpNum('scoreInput', 1)}>+</StepBtn>
                      </div>
                    </>
                  )}

                  {/* Quick picks */}
                  {quickPicks.length > 0 && (
                    <>
                      <div style={QES_LBL}>Quick pick</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {quickPicks.map(qp => (
                          <button key={qp.label} onClick={() => set(qp.patch)} style={{ ...QES_CHIP, borderColor: '#F9B05155', color: '#F9B051' }}>{qp.label}</button>
                        ))}
                      </div>
                    </>
                  )}

                  {error && <div style={{ color: '#EA4742', fontSize: '13px', marginTop: '12px' }}>{error}</div>}

                  <button onClick={handleSheetSubmit} disabled={!canSubmit} style={{
                    width: '100%', marginTop: '18px', height: '58px', border: 'none', borderRadius: '999px',
                    cursor: canSubmit ? 'pointer' : 'default',
                    background: canSubmit ? 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' : '#1a1a1a',
                    color: canSubmit ? '#0a0a0a' : '#555',
                    fontFamily: 'var(--font-label)', textTransform: 'uppercase',
                    letterSpacing: '0.12em', fontSize: '16px', fontWeight: 600,
                  }}>
                    {submitting ? 'Saving...' : scored ? `${editingResult ? 'Save' : 'Submit'} — ${scored.score_label}` : 'Enter your score'}
                  </button>
                </>
              )}

              {/* Today's submissions */}
              {myResults.length > 0 && (
                <>
                  <div style={{ ...QES_LBL, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{bestLabel === "Today's best" ? "Today's scores" : 'Scores so far'}</span>
                    {mode === 'sport' && <span style={{ color: '#4DB26E' }}>{sportWDL(myResults)}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {myResultsSorted.map(r => (
                      <div key={r.id} style={{
                        background: editingResult?.id === r.id ? '#0d1a2d' : '#101010',
                        border: `1px solid ${editingResult?.id === r.id ? '#2371BB55' : '#1e1e1e'}`,
                        borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                      }}>
                        <div style={{ fontSize: '15px', color: '#fff', flex: 1 }}>{r.score_label}</div>
                        {r.is_pr && (
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#F9B051', background: '#F9B05122', borderRadius: '4px', padding: '2px 6px', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>PR</div>
                        )}
                        {!locked && (
                          <>
                            <button onClick={() => {
                              const opp = opponentIdFor(r.opponent_name)
                              keepExistingMatch.current = !!r.opponent_name && !opp
                              setEditingResult(r)
                              setV({ ...EMPTY_VALS, ...valsFromResult(mode, r), opponentId: opp ?? '' })
                            }}
                              style={{ background: 'none', border: '1px solid #2371BB44', borderRadius: '4px', color: '#2371BB', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', flexShrink: 0, fontFamily: 'var(--font-label)', fontWeight: 700 }}>Edit</button>
                            <button onClick={() => handleSheetDelete(r.id)}
                              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', flexShrink: 0 }}>✕</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Training units — what replaced effort tasks */}
              <div style={{ ...QES_LBL, display: 'flex', justifyContent: 'space-between' }}>
                <span>Training units</span>
                <span style={{ color: '#B87DB5' }}>{fmtUnitsLabel(unitsHere)} this game</span>
              </div>
              <div style={{ fontSize: '13px', color: '#777', lineHeight: 1.5 }}>
                Every {unitWords.one} counts toward your next colour in {se.domain_name}, at any effort. Submit each one.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
