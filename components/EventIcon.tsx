'use client'

import { useEffect, useState } from 'react'

// The palette moved to lib/domainColours.ts so server components can use it too.
// Re-exported here because the client call sites (dashboard, live session,
// DomainIcon) already import from this module.
import { domainColor } from '@/lib/domainColours'
export { DOMAIN_COLORS, domainColor } from '@/lib/domainColours'


// Module-level cache: probe each icon URL once per page load, not once per render.
// Absent = not yet probed, and an unprobed icon is ASSUMED PRESENT — see below.
const iconStatus: Record<string, boolean> = {}

/**
 * Event pictogram tile. Renders /event-icons/{slug}.png as a CSS mask filled
 * with the domain colour — so any solid silhouette on a transparent background
 * (e.g. a black Canva export) displays correctly on the dark theme and always
 * matches its domain. Falls back to the event's emoji until an icon is added.
 */
export default function EventIcon({
  slug,
  emoji,
  domainNumber,
  size = 46,
}: {
  slug: string
  emoji?: string
  domainNumber: number
  size?: number
}) {
  // OPTIMISTIC: `!== false` rather than `=== true`, so an icon that has not been
  // probed yet renders its mask immediately instead of waiting.
  //
  // This used to start false, which meant EVERY icon prerendered as its emoji
  // and swapped to the real pictogram only after hydration plus a network round
  // trip — a guaranteed flash on every page load, worst on /prs where dozens
  // swap at once. The fallback was designed for partial icon coverage; coverage
  // has been 120/120 since August 2026, so the pessimistic default now costs
  // every icon on every page to guard a case that no longer occurs.
  //
  // The probe stays, because "no longer occurs" is not "cannot occur" — a new
  // event ships before its PNG does. It just demotes to what it should always
  // have been: an error path, not a gate. Worst case for a genuinely missing
  // icon is an empty tile for one round trip before the emoji appears.
  //
  // Starting true also matches what the server prerenders, so there is no
  // hydration mismatch.
  const [hasIcon, setHasIcon] = useState<boolean>(iconStatus[slug] !== false)

  useEffect(() => {
    if (iconStatus[slug] !== undefined) { setHasIcon(iconStatus[slug]); return }
    const img = new Image()
    img.onload = () => { iconStatus[slug] = true; setHasIcon(true) }
    img.onerror = () => { iconStatus[slug] = false; setHasIcon(false) }
    img.src = `/event-icons/${slug}.png`
  }, [slug])

  const c = domainColor(domainNumber)
  const maskUrl = `url(/event-icons/${slug}.png)`

  return (
    <div style={{
      width: size, height: size, flexShrink: 0, borderRadius: Math.round(size * 0.26),
      background: c + '1e', border: `1px solid ${c}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {hasIcon ? (
        <div style={{
          width: '68%', height: '68%', background: c,
          WebkitMaskImage: maskUrl, maskImage: maskUrl,
          WebkitMaskSize: 'contain', maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center', maskPosition: 'center',
        }} />
      ) : (
        <span style={{ fontSize: size * 0.48, lineHeight: 1 }}>{emoji || '•'}</span>
      )}
    </div>
  )
}
