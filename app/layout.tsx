import type { Metadata } from 'next'
import { Bebas_Neue, Barlow, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

// Self-hosted via next/font. The brand fonts were previously fetched from Google
// TWICE — a <link> here AND an @import on line 1 of globals.css — and the
// @import was the worse of the two, because a CSS @import is only discovered
// after the stylesheet has downloaded and parsed, serialising
// HTML → CSS → font CSS → font files before any text could paint in brand type.
// next/font ships the woff2 from our own origin, so both third-party origins
// (fonts.googleapis.com and fonts.gstatic.com) and their DNS+TLS drop off the
// critical path, and the render-blocking external stylesheet goes with them.
//
// Weights mirror what the old @import requested (the superset of the two
// declarations), so nothing that renders today loses a face.
//
// `preload` is set per family ON PURPOSE. next/font preloads every declared face
// by default, which measured at 196 KB of woff2 fetched eagerly on first paint
// across 13 faces — including italic weights nothing on the page renders. That
// would have traded a latency problem for a bandwidth one. With preload off, the
// faces stay declared (so nothing loses its typeface) but the browser fetches
// only the ones text actually matches, which is how the Google-hosted version
// behaved too. Bebas keeps its preload: it is one small file and it draws every
// heading, including the hero headline above the fold.
const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-bebas-neue',
})

const barlow = Barlow({
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'], // italic 400 is used for caption/aside copy
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-barlow-sans',
})

const barlowCondensed = Barlow_Condensed({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-barlow-cond',
})

export const metadata: Metadata = {
  title: 'AllSport — One Sport, Every Sport',
  description: 'One sport that makes you better at everything. AllSport tests strength, speed, flexibility, coordination and endurance — trained together, every session. Koha-based, Ōtautahi Aotearoa.',
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${barlow.variable} ${barlowCondensed.variable}`}
    >
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
        {/* Renders nothing when logged out, and is hidden by CSS above 768px. */}
        <BottomNav />
      </body>
    </html>
  )
}
