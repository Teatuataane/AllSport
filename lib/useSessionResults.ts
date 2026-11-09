'use client'

// ─── The live game's scores, and saving one without waiting ──────────────────
// Every result in one game, kept fresh by the Broadcast ping and a 15 second
// poll, and the one place the live game writes `results` (v0.48.0.0).
//
// A save no longer waits: the row is drawn the moment Submit is tapped and the
// write runs behind it. The pure half (what to draw while writes are in flight)
// is lib/pendingResults.ts; read its header for why there are two lists.
//
// What a save costs now: ONE request (the insert, which returns the stored
// row), plus `record_match` for a game against a registered player. It used to
// re-read the whole game after every save. The database may rewrite raw_score
// on the way in (`enforce_lift_estimate`), so the row it returns is what lands
// in the confirmed list, never the row the screen guessed.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { announceResultsChanged, onResultsChanged } from '@/lib/liveSession'
import { applyPending, rowsSignature, saveErrorMessage, upsertRow, type Drawn, type PendingOp } from '@/lib/pendingResults'

const supabase = createClient()

export type SessionResult = {
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
  distance_m?: number | null
  is_pr: boolean
  /** Drawn, not yet confirmed by the server: no real id, so no edit or delete. */
  pending?: boolean
}

export type SaveJob = {
  /** The columns to write. */
  payload: Record<string, unknown>
  /** The row as it will look, drawn until the server answers. */
  row: SessionResult
  editingId: string | null
  /** Opponents to record as a match; null leaves matches alone. */
  matchOpponents: string[] | null
  /** "Deadlift 100kg", for the error toast. */
  what: string
  /** Called once a match has been recorded, so a rating can be re-read. */
  onMatched?: () => void
}

export type SaveFailure = { what: string; message: string; retry: () => void }

/** What failed, kept as data so Try again can re-send it. */
type Failed = { what: string; message: string } & ({ kind: 'save'; job: SaveJob } | { kind: 'delete'; id: string })

// Records the head-to-head match behind one game result (migration
// 20260914020739). The server reads session, event, player and outcome off the
// result row itself, so all this sends is who the opponents were: the match
// cannot claim an outcome the score does not.
//
// Best-effort by design. A failure here must never turn a saved score into an
// error. PGRST202 means the function does not exist yet, which is not worth
// showing a player mid-game.
async function recordMatch(resultId: string, opponentIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('record_match', { p_result_id: resultId, p_opponent_ids: opponentIds })
  if (error && error.code !== 'PGRST202') console.warn('record_match:', error.message)
}

/** The write itself, outside the hook (the React Compiler cannot yet compile a
    throw inside try/catch in a hook). Never throws. */
async function writeResult(job: SaveJob): Promise<{ row: SessionResult } | { error: string }> {
  try {
    const { data, error } = job.editingId
      ? await supabase.from('results').update(job.payload).eq('id', job.editingId).select('*')
      : await supabase.from('results').insert(job.payload).select('*')
    if (error) return { error: saveErrorMessage(error) }
    const row = (data as SessionResult[] | null)?.[0]
    if (row) return { row }
    return {
      error: job.editingId
        ? 'This score was deleted by a kaiwhakawā — close and submit it as a new score'
        : 'The score did not save. Try again.',
    }
  } catch (e) {
    // A dropped connection rejects rather than returning an error.
    return { error: saveErrorMessage(e) }
  }
}

export function useSessionResults(sessionId: string) {
  const [confirmed, setConfirmed] = useState<SessionResult[]>([])
  const [ops, setOps] = useState<PendingOp<SessionResult>[]>([])
  const [failed, setFailed] = useState<Failed | null>(null)
  // The last read's fingerprint: a poll that brings back the same rows changes
  // nothing, so the screen does not redraw and its effects do not re-run.
  const lastRead = useRef('')
  // Bumped whenever one of this screen's own writes lands. A read that started
  // before that may predate the write, so it is thrown away; the next one is
  // never more than 15 seconds off.
  const writes = useRef(0)
  const nextOp = useRef(0)

  const reload = useCallback(async () => {
    const asked = writes.current
    const { data } = await supabase.from('results').select('*').eq('session_id', sessionId)
    if (!data || writes.current !== asked) return
    const sig = rowsSignature(data as SessionResult[])
    if (sig === lastRead.current) return
    lastRead.current = sig
    setConfirmed(data as SessionResult[])
  }, [sessionId])

  useEffect(() => { void reload() }, [reload])

  // Broadcast, not postgres_changes: see lib/liveSession.ts (Disk IO, Oct 2026).
  useEffect(() => onResultsChanged(supabase, sessionId, () => { void reload() }), [sessionId, reload])

  // The fallback poll, in case a ping is missed. It stops while the page is
  // hidden (a phone in a pocket costs the database nothing) and reads once the
  // moment the page is shown again, so the screen is fresh when it is looked at.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => { if (!timer) timer = setInterval(() => { void reload() }, 15000) }
    const stop = () => { if (timer) { clearInterval(timer); timer = undefined } }
    const onVisible = () => {
      if (document.hidden) { stop(); return }
      void reload()
      start()
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisible)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisible) }
  }, [reload])

  // A player who closes the tab while a score is still on its way is warned.
  const busy = ops.length > 0
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const results = useMemo(() => applyPending(confirmed, ops), [confirmed, ops])
  // Every score this screen has deleted or is deleting. A player's records were
  // read once, when the page opened, and are not re-read after a save, so they
  // still hold a score deleted since: the screen leaves these out of them.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set())
  const removedIds = useMemo(() => {
    const out = new Set(deletedIds)
    for (const op of ops) if (op.kind === 'delete') out.add(op.id)
    return out as ReadonlySet<string>
  }, [deletedIds, ops])

  const dropOp = (opId: string) => setOps(p => p.filter(o => o.opId !== opId))

  async function write(job: SaveJob, opId: string) {
    const out = await writeResult(job)
    if ('error' in out) {
      dropOp(opId)
      setFailed({ kind: 'save', job, what: job.what, message: out.error })
      return
    }
    const saved = out.row
    writes.current++
    // One update: the stored row in, the guess out, in the same render.
    setConfirmed(c => upsertRow(c, saved))
    dropOp(opId)
    announceResultsChanged(supabase, sessionId)
    if (job.matchOpponents !== null && saved.player_id) {
      await recordMatch(saved.id, job.matchOpponents)
      job.onMatched?.()
    }
  }

  /** Draws the score now and writes it behind. Returns at once. */
  function save(job: SaveJob) {
    const opId = `pending-${++nextOp.current}`
    const op: PendingOp<SessionResult> = job.editingId
      ? { kind: 'update', opId, row: { ...job.row, id: job.editingId } }
      : { kind: 'insert', opId, row: { ...job.row, id: opId }, seenIds: confirmed.map(r => r.id) }
    setFailed(null)
    setOps(p => [...p, op])
    void write(job, opId)
  }

  /** Hides the score now and deletes it behind; it comes back if the delete fails. */
  function remove(id: string, what: string) {
    const opId = `pending-${++nextOp.current}`
    setFailed(null)
    setOps(p => [...p, { kind: 'delete', opId, id }])
    void (async () => {
      const { error } = await supabase.from('results').delete().eq('id', id)
      if (error) {
        dropOp(opId)
        setFailed({ kind: 'delete', id, what, message: saveErrorMessage(error) })
        return
      }
      writes.current++
      setConfirmed(c => c.filter(r => r.id !== id))
      setDeletedIds(d => new Set(d).add(id))
      dropOp(opId)
      announceResultsChanged(supabase, sessionId)
    })()
  }

  const failure: SaveFailure | null = failed && {
    what: failed.what,
    message: failed.message,
    retry: () => { if (failed.kind === 'save') save(failed.job); else remove(failed.id, failed.what) },
  }

  return {
    /** What the screen draws: confirmed rows with writes in flight applied. */
    results: results as Drawn<SessionResult>[],
    /** Server-confirmed rows only, for one-time moments and end-of-game work. */
    confirmed,
    /** Ids this screen deleted, to leave out of records read before. */
    removedIds,
    failure,
    dismissFailure: () => setFailed(null),
    save,
    remove,
    reload,
  }
}
