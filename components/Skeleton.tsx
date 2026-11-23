// ─── Page outlines ───────────────────────────────────────────────────────────
// Grey shapes where a page's parts will land, shown while it loads instead of
// a line of "Loading…" on a black page. The layout appears at once and fills
// in, which reads as fast even when the database is slow, and nothing jumps
// when the real parts arrive because the shapes are the same size.
//
// Props only and no hooks, so it renders on the server too (app/loading.tsx).
// The sweep is the `.skeleton` class in app/globals.css.

import type { CSSProperties } from 'react'

export function SkeletonBlock({ height, width = '100%', radius, style }: {
  height: number
  width?: number | string
  radius?: number
  style?: CSSProperties
}) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} />
}

/** HOME: avatar and name, the weekly games line, the colours card, the links. */
export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <SkeletonBlock height={64} width={64} radius={32} style={{ flexShrink: 0 }} />
        <div style={{ flexGrow: 1 }}>
          <SkeletonBlock height={28} width="60%" radius={6} />
          <SkeletonBlock height={12} width="30%" radius={4} style={{ marginTop: 8 }} />
          <SkeletonBlock height={12} width="80%" radius={4} style={{ marginTop: 8 }} />
        </div>
      </div>
      <SkeletonBlock height={56} radius={14} style={{ margin: '18px 0 16px' }} />
      <GradesSkeleton />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {[0, 1, 2].map(i => <SkeletonBlock key={i} height={44} radius={10} />)}
      </div>
    </div>
  )
}

/** The YOUR COLOURS card while it loads: the same height as the old placeholder. */
export function GradesSkeleton() {
  return <SkeletonBlock height={220} radius={16} style={{ marginBottom: 16 }} />
}

/** A list page (My Events, history): a title, then rows. */
export function ListSkeleton({ rows = 6, maxWidth = 720 }: { rows?: number; maxWidth?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ maxWidth, margin: '0 auto', padding: '20px 16px 40px' }}>
      <SkeletonBlock height={34} width="45%" radius={6} style={{ marginBottom: 18 }} />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} height={58} radius={12} style={{ marginBottom: 10, opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  )
}
