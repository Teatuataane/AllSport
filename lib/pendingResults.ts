// ─── Scores on screen before the server answers ──────────────────────────────
// The live game draws a score the moment Submit is tapped (v0.48.0.0). Until
// then a save waited for the insert, sometimes a second round trip for the
// match, then a re-read of the whole game, before the row stopped saying "Tap
// to score": a second or more on a gym's mobile signal.
//
// The screen now holds two lists: the rows the server has CONFIRMED (the last
// read, plus every row its own writes returned), and the writes still in
// flight. It draws the two together with `applyPending`. A poll or a broadcast
// re-read replaces the confirmed rows only, so a read that lands mid-write can
// never drop the score the player just entered. Writing the optimistic row
// into the confirmed list instead would let exactly that happen.
//
// Pure: no Supabase, no React. The hook that writes is lib/useSessionResults.ts.

/** The fields this file needs. A `results` row has these and more. */
export type LiveRow = {
  id: string
  event_id: string
  player_id: string | null
  player_name: string
  score_label: string
}

export type PendingOp<R extends LiveRow> =
  /** A new score. `id` on the row is a temporary id; `seenIds` is every
      confirmed id when the save began, so the server's copy can be told apart
      from rows that were already there. */
  | { kind: 'insert'; opId: string; row: R; seenIds: readonly string[] }
  /** An edit of a confirmed row, drawn with its new values. */
  | { kind: 'update'; opId: string; row: R }
  /** A delete, hidden until the server agrees or refuses. */
  | { kind: 'delete'; opId: string; id: string }

export type Drawn<R> = R & { pending?: boolean }

const sameOwner = (a: LiveRow, b: LiveRow) =>
  a.player_id ? a.player_id === b.player_id : !b.player_id && a.player_name === b.player_name

/**
 * The rows to draw: the confirmed rows with every op in flight applied on top.
 * A row the screen has not had confirmed yet carries `pending: true`, so the
 * sheet can hold back Edit and delete on it (it has no real id to send).
 *
 * The one subtle case: a re-read can land after the server has stored a new
 * score but before this screen has heard back. That read already holds the
 * server's copy, under its real id, while the op still holds the temporary
 * one. Drawing both would show the score twice. So an insert whose echo is in
 * the confirmed rows (a row that was not there when the save began, by the same
 * player, on the same event, with the same label) is not drawn again. Echoes
 * are matched one to one, so two equal scores in flight stay two.
 */
export function applyPending<R extends LiveRow>(confirmed: readonly R[], ops: readonly PendingOp<R>[]): Drawn<R>[] {
  if (ops.length === 0) return confirmed as Drawn<R>[]
  const deleted = new Set<string>()
  const updated = new Map<string, R>()
  for (const op of ops) {
    if (op.kind === 'delete') deleted.add(op.id)
    else if (op.kind === 'update') updated.set(op.row.id, op.row)
  }
  const out: Drawn<R>[] = []
  for (const r of confirmed) {
    if (deleted.has(r.id)) continue
    const edit = updated.get(r.id)
    out.push(edit ? { ...edit, pending: true } : r)
  }
  const usedEchoes = new Set<string>()
  for (const op of ops) {
    if (op.kind !== 'insert') continue
    const seen = new Set(op.seenIds)
    const echo = confirmed.find(r => !seen.has(r.id) && !usedEchoes.has(r.id)
      && r.event_id === op.row.event_id && sameOwner(r, op.row) && r.score_label === op.row.score_label)
    if (echo) { usedEchoes.add(echo.id); continue }
    out.push({ ...op.row, pending: true })
  }
  return out
}

/** `rows` with `row` in place of the row sharing its id, or added. */
export function upsertRow<R extends { id: string }>(rows: readonly R[], row: R): R[] {
  const i = rows.findIndex(r => r.id === row.id)
  if (i < 0) return [...rows, row]
  const next = rows.slice()
  next[i] = row
  return next
}

/**
 * A cheap fingerprint of a read, so a poll that brings back the same rows does
 * not hand the screen a new array (which redraws it and re-runs every effect
 * that depends on the results). Order-independent.
 */
export function rowsSignature(rows: readonly { id: string }[]): string {
  return rows.map(r => JSON.stringify(r)).sort().join('\n')
}

/**
 * What to tell a player whose score did not save. The two codes the database
 * actually refuses a game score with get plain words (the same words the store
 * for added events uses); anything else keeps the server's message.
 */
export function saveErrorMessage(err: unknown): string {
  const e = (err ?? {}) as { code?: string; message?: string }
  if (e.code === '42501') return 'That game has finished, so it can no longer be scored.'
  if (e.code === '23514') return 'One of the numbers is out of range. Check the weight, time and distance.'
  return e.message || 'The score did not save.'
}
