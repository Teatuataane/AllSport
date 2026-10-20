// Three public counts for the homepage's social proof strip: players, finished
// games and scores logged. Read with the anon key straight from PostgREST (a
// HEAD request with `Prefer: count=exact` returns only the Content-Range total),
// so the homepage needs no Supabase client and stays a cached server page:
// `revalidate` rebuilds the numbers at most once an hour.
//
// Every count is optional. A failed or refused read (RLS returns zero rows, not
// an error, so 0 is treated as "unknown" too) hides that number rather than
// printing a misleading one.

export type CommunityStats = {
  players: number | null
  games: number | null
  scores: number | null
}

async function count(path: string): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method: 'HEAD',
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' },
      next: { revalidate: 3600 },
      // A hung Supabase (21 Oct 2026, Disk IO throttling) must not hang the
      // homepage: the build gives a page 60 seconds and then fails the deploy.
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const total = Number(res.headers.get('content-range')?.split('/')[1])
    return Number.isFinite(total) && total > 0 ? total : null
  } catch {
    return null
  }
}

export async function loadCommunityStats(): Promise<CommunityStats> {
  const [players, games, scores] = await Promise.all([
    count('players_public?select=id'),
    // Finished, unvoided official games: the same games the season board counts.
    count('sessions?select=id&ended_at=not.is.null&voided_at=is.null'),
    count('results?select=id'),
  ])
  return { players, games, scores }
}
