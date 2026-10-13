import type { MetadataRoute } from 'next'
import { EVENTS } from '@/lib/eventData'

// Public pages only. Everything behind a login is left out here and disallowed
// in app/robots.ts. The event guide pages come from the static roster, so a
// new event appears in the sitemap with no extra step.
const SITE = 'https://allsport.nz'

const PUBLIC_PATHS = [
  '',
  '/how-to-play',
  '/events',
  '/schedule',
  '/grades',
  '/koha',
  '/supporters',
  '/privacy',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_PATHS.map(path => ({ url: `${SITE}${path}` })),
    ...EVENTS.map(e => ({ url: `${SITE}/events/${e.slug}` })),
  ]
}
