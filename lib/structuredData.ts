// Structured data (schema.org JSON-LD) for the home page, so Google can show
// AllSport's address and game times in search and Maps results. Pure: no
// React, so the escaping below is unit-tested.
//
// The game times come from lib/schedule.ts, the same slots the "next game"
// countdown uses, so the two cannot drift apart.
import { SLOTS } from '@/lib/schedule'

const SITE = 'https://allsport.nz'
const GAME_MINUTES = 100
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const hhmm = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

export const ORGANISATION = {
  '@context': 'https://schema.org',
  '@type': 'SportsActivityLocation',
  name: 'AllSport',
  alternateName: 'Te Kura ō ngā Koha / Allsport Aotearoa',
  url: SITE,
  logo: `${SITE}/icon-192.png`,
  image: `${SITE}/og-image.png`,
  description:
    'A decathlon-style community sport: 10 events from 10 domains in a 100-minute game. Koha-based, Ōtautahi Aotearoa.',
  priceRange: 'Koha',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '26 Carbine Place',
    addressLocality: 'Sockburn',
    addressRegion: 'Christchurch',
    addressCountry: 'NZ',
  },
  openingHoursSpecification: SLOTS.map(s => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: `https://schema.org/${DAYS[s.dow]}`,
    opens: hhmm(s.mins),
    closes: hhmm(s.mins + GAME_MINUTES),
  })),
}

/**
 * The JSON for a <script type="application/ld+json"> tag. `<` is escaped so no
 * value can close the script element early; the data is a static constant, so
 * this is the only inline HTML the site writes (see lib/securityHeaders.ts).
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
