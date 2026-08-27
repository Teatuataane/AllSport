// @vitest-environment jsdom
//
// ── The icon tiles paint their pictogram on FIRST render ─────────────────────
// EventIcon and DomainIcon draw a PNG silhouette as a CSS mask, with an emoji
// (or domain number) fallback for an icon that does not exist yet.
//
// The fallback used to be the DEFAULT: `hasIcon` started false and only flipped
// true once an in-effect `new Image()` probe resolved. That meant every tile
// rendered its fallback first and swapped to the real pictogram after hydration
// plus a network round trip — a guaranteed flash on every page load, worst on
// /prs where dozens swap at once. Icon coverage has been 120/120 since August
// 2026, so the pessimistic default was paying that cost on every icon to guard
// a case that no longer happens.
//
// These tests pin the inversion: assume present, and let the probe DEMOTE to the
// fallback only on a real load error. If someone restores `=== true`, the flash
// comes back silently — nothing else in the suite would notice.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import EventIcon from '@/components/EventIcon'
import DomainIcon from '@/components/DomainIcon'

afterEach(cleanup)

/** The masked <div>, identified by the mask the component sets on it. */
function maskLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[style*="mask-image"]')
}

describe('EventIcon', () => {
  it('renders the mask on first paint, not the emoji fallback', () => {
    const { container } = render(
      <EventIcon slug="deadlift" emoji="🏋️" domainNumber={1} />
    )
    const layer = maskLayer(container)
    expect(layer).not.toBeNull()
    expect(layer!.style.maskImage).toContain('/event-icons/deadlift.png')
    // The emoji must NOT be what a first-time visitor sees.
    expect(container.textContent).not.toContain('🏋️')
  })

  it('points the mask at the slug it was given', () => {
    const { container } = render(
      <EventIcon slug="arm-wrestling" emoji="💪" domainNumber={3} />
    )
    expect(maskLayer(container)!.style.maskImage).toContain('/event-icons/arm-wrestling.png')
  })

  it('still reserves its box, so a swap cannot shift layout', () => {
    const { container } = render(
      <EventIcon slug="deadlift" emoji="🏋️" domainNumber={1} size={46} />
    )
    const tile = container.firstElementChild as HTMLElement
    expect(tile.style.width).toBe('46px')
    expect(tile.style.height).toBe('46px')
  })
})

describe('DomainIcon', () => {
  it('renders the mask on first paint, not the domain-number fallback', () => {
    const { container } = render(
      <DomainIcon domainName="Maximal Strength" domainNumber={1} />
    )
    const layer = maskLayer(container)
    expect(layer).not.toBeNull()
    expect(layer!.style.maskImage).toContain('/domain-icons/maximal-strength.png')
    expect(container.textContent).not.toContain('1')
  })

  it('derives a slug for a domain missing from the lookup table', () => {
    const { container } = render(
      <DomainIcon domainName="Aim & Precision" domainNumber={10} />
    )
    expect(maskLayer(container)!.style.maskImage).toContain('/domain-icons/aim-and-precision.png')
  })
})

// ── The probe's remaining job: demote to the fallback on a real load error ───
// Inverting the default made the mask optimistic, which is the point — but the
// fallback still has to work, or a slug with no PNG renders an empty tile
// forever. That is the ONLY case the probe still exists for, so it is the case
// most worth pinning.
//
// `new Image()` does not fetch in jsdom, so the probe is driven directly. Each
// test uses a slug of its own: iconStatus is a MODULE-level cache, so a shared
// slug would leak a resolved result into the next test and pass for the wrong
// reason.

type FakeImg = { onload?: () => void; onerror?: () => void; src: string }

function stubImage(outcome: 'load' | 'error') {
  const created: FakeImg[] = []
  class Stub {
    onload?: () => void
    onerror?: () => void
    #src = ''
    set src(v: string) {
      this.#src = v
      queueMicrotask(() => {
        if (outcome === 'error') this.onerror?.()
        else this.onload?.()
      })
    }
    get src() { return this.#src }
  }
  vi.stubGlobal('Image', Stub as unknown as typeof Image)
  return created
}

afterEach(() => { vi.unstubAllGlobals() })

describe('icon probe error path', () => {
  it('EventIcon falls back to the emoji when the PNG fails to load', async () => {
    stubImage('error')
    const { container } = render(
      <EventIcon slug="no-such-event-icon-a" emoji="🛼" domainNumber={8} />
    )
    // Optimistic first, as designed...
    expect(maskLayer(container)).not.toBeNull()
    // ...then demoted once the probe reports the miss.
    await waitFor(() => expect(container.textContent).toContain('🛼'))
    expect(maskLayer(container)).toBeNull()
  })

  it('EventIcon keeps the mask when the PNG loads', async () => {
    stubImage('load')
    const { container } = render(
      <EventIcon slug="no-such-event-icon-b" emoji="🛼" domainNumber={8} />
    )
    await waitFor(() => expect(maskLayer(container)).not.toBeNull())
    expect(container.textContent).not.toContain('🛼')
  })

  it('DomainIcon falls back to the domain number when the PNG fails', async () => {
    stubImage('error')
    const { container } = render(
      <DomainIcon domainName="Not A Real Domain X" domainNumber={7} />
    )
    expect(maskLayer(container)).not.toBeNull()
    await waitFor(() => expect(container.textContent).toContain('7'))
    expect(maskLayer(container)).toBeNull()
  })
})
