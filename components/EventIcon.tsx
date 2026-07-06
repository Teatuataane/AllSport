'use client'

import { useEffect, useState } from 'react'

// Domain accent colours, indexed by domainNumber - 1 (same palette as /scoring setup page)
export const DOMAIN_COLORS = [
  '#EA4742', '#F9B051', '#F397C0', '#B87DB5', '#2371BB',
  '#4DB26E', '#EA4742', '#F9B051', '#B87DB5', '#2371BB',
]

export function domainColor(domainNumber: number): string {
  return DOMAIN_COLORS[(domainNumber - 1 + 10) % 10] || '#888'
}

// Module-level cache: probe each icon URL once per page load, not once per render
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
  const [hasIcon, setHasIcon] = useState<boolean>(iconStatus[slug] === true)

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
