import type { Metadata } from 'next'
import { Bebas_Neue, Barlow, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

// Self-hosted, NOT loaded from Google.
//
// The fonts used to arrive via a <link> here and an @import at the top of
// globals.css, which meant every visitor's IP address and user-agent reached
// Google on page load — including people who never sign up, never log in and
// never consent to anything. That is a disclosure to an overseas third party
// for a decorative asset, and the privacy policy had to declare it.
//
// next/font/google downloads these at BUILD time and serves them from our own
// origin, so no request ever leaves the browser for Google. It also lets the
// CSP drop fonts.googleapis.com and fonts.gstatic.com entirely (see
// lib/securityHeaders.ts) and removes a render-blocking round trip.
//
// The weights below deliberately match what the old globals.css @import
// requested, so nothing changes visually. If you add a weight in CSS, add it
// here too — a weight that is not listed is synthesised by the browser and
// looks subtly wrong.
const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bebas-neue',
})

const barlow = Barlow({
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-barlow-sans',
})

const barlowCondensed = Barlow_Condensed({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-barlow-narrow',
})

export const metadata: Metadata = {
  title: 'AllSport — One Sport, Every Sport',
  description: 'One sport that makes you better at everything. AllSport tests strength, speed, flexibility, coordination and endurance — trained together, every session. Koha-based, Ōtautahi Aotearoa.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
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
      </body>
    </html>
  )
}
