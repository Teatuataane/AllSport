'use client'

import { useEffect, useState } from 'react'
import { domainColor } from './EventIcon'

// Domain name → icon slug. Keep in sync with DOMAIN_ORDER in lib/eventData.ts.
// Files live in public/domain-icons/{slug}.png (transparent silhouette, tinted here).
const DOMAIN_SLUGS: Record<string, string> = {
  'Maximal Strength': 'maximal-strength',
  'Calisthenics': 'calisthenics',
  'Power': 'power',
  'Speed': 'speed',
  'Anaerobic Endurance': 'anaerobic-endurance',
  'Aerobic Endurance': 'aerobic-endurance',
  'Flexibility': 'flexibility',
  'Body Awareness': 'body-awareness',
  'Coordination': 'coordination',
  'Aim & Precision': 'aim-and-precision',
}

export function domainSlug(domainName: string): string {
  return DOMAIN_SLUGS[domainName]
    || domainName.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Module-level cache: probe each icon URL once per page load, not once per render
const iconStatus: Record<string, boolean> = {}

/**
 * Domain pictogram tile — mirrors EventIcon. Renders
 * /domain-icons/{slug}.png as a CSS mask filled with the domain colour, so a
 * flat black Canva silhouette on a transparent background displays correctly on
 * the dark theme and always matches its domain. Falls back to the domain number
 * in the tinted tile until the PNG is present.
 */
export default function DomainIcon({
  domainName,
  domainNumber,
  size = 44,
}: {
  domainName: string
  domainNumber: number
  size?: number
}) {
  const slug = domainSlug(domainName)
  const [hasIcon, setHasIcon] = useState<boolean>(iconStatus[slug] === true)

  useEffect(() => {
    if (iconStatus[slug] !== undefined) { setHasIcon(iconStatus[slug]); return }
    const img = new Image()
    img.onload = () => { iconStatus[slug] = true; setHasIcon(true) }
    img.onerror = () => { iconStatus[slug] = false; setHasIcon(false) }
    img.src = `/domain-icons/${slug}.png`
  }, [slug])

  const c = domainColor(domainNumber)
  const maskUrl = `url(/domain-icons/${slug}.png)`

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
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: size * 0.42, lineHeight: 1, color: c,
        }}>{domainNumber}</span>
      )}
    </div>
  )
}
