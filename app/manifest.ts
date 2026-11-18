import type { MetadataRoute } from 'next'

// The web app manifest (v0.55.0.0). It exists for one reason: an iPhone only
// delivers web push to a site added to the Home Screen as an app, and Safari
// needs a manifest with display "standalone" to do that. Android and desktop
// use it for the install prompt. Served at /manifest.webmanifest and linked
// by Next automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AllSport',
    short_name: 'AllSport',
    description: '10 events, 100 minutes. A koha-based community sport from Ōtautahi.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
