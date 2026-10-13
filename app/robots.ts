import type { MetadataRoute } from 'next'

// Player and kaiwhakawā pages are private. /leaderboard is public in the app
// but lists players by name (juniors included), so it is kept out of search
// results too.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/', '/auth/', '/dashboard', '/judge', '/scoring', '/profile',
        '/prs', '/history', '/my-koha', '/games/', '/workout/', '/vote/',
        '/log', '/play', '/leaderboard',
      ],
    },
    sitemap: 'https://allsport.nz/sitemap.xml',
  }
}
