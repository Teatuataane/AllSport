import { describe, it, expect } from 'vitest'
import { applyPending, rowsSignature, saveErrorMessage, upsertRow, type LiveRow, type PendingOp } from '@/lib/pendingResults'
import { hasGameRow, seasonGameBest, type PRRow } from '@/lib/prBoard'

type Row = LiveRow & { raw_score: number }
const row = (id: string, label: string, extra: Partial<Row> = {}): Row => ({
  id, event_id: 'ev1', player_id: 'p1', player_name: 'Aroha', score_label: label, raw_score: 0, ...extra,
})

describe('applyPending', () => {
  const a = row('a', '100kg')
  const b = row('b', '110kg')

  it('draws the confirmed rows untouched when nothing is in flight', () => {
    const confirmed = [a, b]
    expect(applyPending(confirmed, [])).toBe(confirmed)
  })

  it('draws a new score at once, marked pending', () => {
    const ops: PendingOp<Row>[] = [{ kind: 'insert', opId: 'tmp1', row: row('tmp1', '120kg'), seenIds: ['a', 'b'] }]
    const drawn = applyPending([a, b], ops)
    expect(drawn.map(r => r.id)).toEqual(['a', 'b', 'tmp1'])
    expect(drawn[2].pending).toBe(true)
    expect(drawn[0].pending).toBeUndefined()
  })

  it('keeps the new score when a re-read lands before the server has it', () => {
    const ops: PendingOp<Row>[] = [{ kind: 'insert', opId: 'tmp1', row: row('tmp1', '120kg'), seenIds: ['a'] }]
    // The poll came back with the same rows it had: the score must not vanish.
    expect(applyPending([a], ops).map(r => r.id)).toEqual(['a', 'tmp1'])
  })

  it('does not double a score when a re-read already holds the server copy', () => {
    const ops: PendingOp<Row>[] = [{ kind: 'insert', opId: 'tmp1', row: row('tmp1', '120kg'), seenIds: ['a'] }]
    const echoed = [a, row('real1', '120kg')]
    expect(applyPending(echoed, ops).map(r => r.id)).toEqual(['a', 'real1'])
  })

  it('matches echoes one to one, so two equal scores in flight stay two', () => {
    const ops: PendingOp<Row>[] = [
      { kind: 'insert', opId: 'tmp1', row: row('tmp1', '120kg'), seenIds: ['a'] },
      { kind: 'insert', opId: 'tmp2', row: row('tmp2', '120kg'), seenIds: ['a'] },
    ]
    expect(applyPending([a, row('real1', '120kg')], ops).map(r => r.id)).toEqual(['a', 'real1', 'tmp2'])
  })

  it('never takes another player\'s row, or a row already there, as the echo', () => {
    const ops: PendingOp<Row>[] = [{ kind: 'insert', opId: 'tmp1', row: row('tmp1', '100kg'), seenIds: ['a', 'x'] }]
    const other = row('x2', '100kg', { player_id: 'p2' })
    // `a` has the same label but was there before the save began.
    expect(applyPending([a, other], ops).map(r => r.id)).toEqual(['a', 'x2', 'tmp1'])
  })

  it('tells guests apart by name', () => {
    const guest = (id: string, name: string) => row(id, '10 reps', { player_id: null, player_name: name })
    const ops: PendingOp<Row>[] = [{ kind: 'insert', opId: 'tmp1', row: guest('tmp1', 'Mere'), seenIds: [] }]
    expect(applyPending([guest('g1', 'Hemi')], ops).map(r => r.id)).toEqual(['g1', 'tmp1'])
    expect(applyPending([guest('g2', 'Mere')], ops).map(r => r.id)).toEqual(['g2'])
  })

  it('draws an edit in place, and hides a delete', () => {
    const ops: PendingOp<Row>[] = [
      { kind: 'update', opId: 'u1', row: { ...a, score_label: '105kg' } },
      { kind: 'delete', opId: 'd1', id: 'b' },
    ]
    const drawn = applyPending([a, b], ops)
    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toMatchObject({ id: 'a', score_label: '105kg', pending: true })
  })

  it('drops an edit of a row someone else deleted', () => {
    const ops: PendingOp<Row>[] = [{ kind: 'update', opId: 'u1', row: { ...b, score_label: '115kg' } }]
    expect(applyPending([a], ops).map(r => r.id)).toEqual(['a'])
  })
})

describe('upsertRow', () => {
  it('replaces by id, or adds', () => {
    const rows = [row('a', '1'), row('b', '2')]
    expect(upsertRow(rows, row('b', '3')).map(r => r.score_label)).toEqual(['1', '3'])
    expect(upsertRow(rows, row('c', '4')).map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(rows[1].score_label).toBe('2')
  })
})

describe('rowsSignature', () => {
  it('is the same for the same rows in any order, and differs on any change', () => {
    const x = [row('a', '1'), row('b', '2')]
    expect(rowsSignature(x)).toBe(rowsSignature([x[1], x[0]]))
    expect(rowsSignature(x)).not.toBe(rowsSignature([x[0], row('b', '3')]))
  })
})

describe('saveErrorMessage', () => {
  it('words the two refusals a game score gets', () => {
    expect(saveErrorMessage({ code: '42501', message: 'new row violates row-level security' }))
      .toBe('That game has finished, so it can no longer be scored.')
    expect(saveErrorMessage({ code: '23514', message: 'check constraint' }))
      .toBe('One of the numbers is out of range. Check the weight, time and distance.')
  })
  it('keeps any other message, and has a fallback', () => {
    expect(saveErrorMessage(new Error('Failed to fetch'))).toBe('Failed to fetch')
    expect(saveErrorMessage(null)).toBe('The score did not save.')
  })
})

describe('season best and first game score, from the records rows', () => {
  let n = 0
  const pr = (raw: number | null, date: string, source: PRRow['source'] = 'game'): PRRow => ({
    id: `r${++n}`, raw_score: raw, score_label: String(raw), difficulty_tier: null, date, source,
  })

  it('takes the best game score of that year only', () => {
    const rows = [pr(100, '2026-03-01'), pr(140, '2025-12-31'), pr(120, '2026-11-01'), pr(200, '2026-05-01', 'logged')]
    expect(seasonGameBest(rows, 2026)).toBe(120)
    expect(seasonGameBest(rows, 2025)).toBe(140)
    expect(seasonGameBest(rows, 2024)).toBeNull()
  })

  it('ignores a training effort with no score', () => {
    expect(seasonGameBest([pr(null, '2026-03-01')], 2026)).toBeNull()
  })

  it('counts only game rows as having played the event', () => {
    expect(hasGameRow([pr(5, '2026-01-01', 'logged'), pr(6, '2026-01-02', 'witnessed')])).toBe(false)
    expect(hasGameRow([pr(5, '2026-01-01', 'logged'), pr(6, '2026-01-02')])).toBe(true)
    expect(hasGameRow([])).toBe(false)
  })
})
