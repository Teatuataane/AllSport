// ─── Sites: pins and "is it one of these?" ───────────────────────────────────
// Sites carry a map pin since 20261123035106 so Find a game can sort by
// nearest, and so a pop-up at a park that already has a site reuses it instead
// of adding "hagley park" next to "Hagley Park" (MULTI_LOCATION_PLAN.md §2).
//
// PURE: no Supabase, no React (__tests__/sites.test.ts).

export type Pin = { lat: number; lng: number }

/** Sites within this many metres are offered before a new one is added. */
export const NEARBY_METRES = 500

/** Great-circle distance in metres (haversine; plenty for a park). */
export function distanceMetres(a: Pin, b: Pin): number {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function pinOf(site: { lat?: number | null; lng?: number | null }): Pin | null {
  return typeof site.lat === 'number' && typeof site.lng === 'number' ? { lat: site.lat, lng: site.lng } : null
}

/** Pinned sites within `metres`, nearest first. */
export function nearbySites<T extends { lat?: number | null; lng?: number | null }>(
  sites: T[], at: Pin, metres: number = NEARBY_METRES,
): (T & { metres: number })[] {
  const out: (T & { metres: number })[] = []
  for (const s of sites) {
    const p = pinOf(s)
    if (!p) continue
    const m = distanceMetres(at, p)
    if (m <= metres) out.push({ ...s, metres: m })
  }
  return out.sort((a, b) => a.metres - b.metres)
}

/** Sites whose names match once case, spaces and punctuation are ignored. */
export function sameNameSites<T extends { name: string }>(sites: T[], name: string): T[] {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9ā-ū]+/g, '')
  const k = key(name)
  return k ? sites.filter(s => key(s.name) === k) : []
}

/**
 * A pin from a pasted map link: Google Maps '@-43.53,172.63,15z' or
 * 'q=-43.53,172.63' / 'query=…' / 'll=…'. Null when none is found or it is out
 * of range.
 */
export function pinFromMapUrl(url: string): Pin | null {
  const m = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    ?? url.match(/[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/** "120 m" or "1.4 km". */
export function formatMetres(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
}
