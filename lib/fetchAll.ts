// Supabase caps selects at 1000 rows — page through for full-history queries.
// `query` must apply .range(from, to) to a stable, deterministic ordering.
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data } = await query(from, from + page - 1)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < page) break
  }
  return out
}
