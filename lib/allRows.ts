// Every row a query returns, a page at a time. PostgREST stops at 1000 rows a
// request whatever `.range()` asks for, so a read that has to be complete (a
// player's whole history, a funder report) must page. Give the query a stable
// order (end on `.order('id')`), or pages can overlap and skip rows. A failed
// page returns the rows so far WITH its error, so the caller decides whether a
// partial read is usable. Pure: no Supabase import, so it is unit-testable.

/** PostgREST returns at most this many rows per request. */
export const PAGE = 1000

export type RowsError = { code?: string; message: string }

export async function allRows<T>(
  q: (from: number, to: number) => PromiseLike<{ data: unknown; error: RowsError | null }>,
): Promise<{ rows: T[]; error: RowsError | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await q(from, from + PAGE - 1)
    if (error) return { rows, error }
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE) return { rows, error: null }
  }
}
