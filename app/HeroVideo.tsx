'use client'

import { useEffect, useRef } from 'react'

/**
 * The homepage hero's background: ten silent seconds of real games, cut from the
 * 2026 showcase film (footage only, no title cards), looping behind the headline.
 *
 * It does not carry `autoPlay`. The poster is the LCP image and paints straight
 * away; the clip (1.9 MB) is only fetched and started here, after hydration, and
 * never for a visitor who asked for reduced motion or less data. Those visitors
 * keep the still, which is a frame of the same footage.
 */
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    if (reduceMotion || saveData) return
    v.preload = 'auto'
    // A page opened in a background tab may have its first play() parked by the
    // browser; try again when it comes to the front.
    const start = () => { if (!document.hidden && v.paused) v.play().catch(() => { /* poster stays */ }) }
    start()
    document.addEventListener('visibilitychange', start)
    return () => document.removeEventListener('visibilitychange', start)
  }, [])

  return (
    <video
      ref={ref}
      className="lp-hero-video"
      src="/media/hero-loop.mp4"
      poster="/media/hero-poster.jpg"
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
    />
  )
}
