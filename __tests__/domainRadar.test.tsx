// @vitest-environment jsdom
//
// ── The colours radar ────────────────────────────────────────────────────────
// Since the home colours rework it draws the colour HELD in each domain, not
// Top %. HOME is behind a login, so this is what notices it drawing the wrong
// thing: a Mā domain must sit at the centre (a visible dent), not vanish.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import DomainRadar, { radiusFor } from '@/components/DomainRadar'

afterEach(cleanup)

describe('radiusFor', () => {
  it('puts Mā at the centre, Taniwha on the edge, and clamps', () => {
    expect(radiusFor(0)).toBe(0)
    expect(radiusFor(-3)).toBe(0)
    expect(radiusFor(12)).toBe(78)
    expect(radiusFor(40)).toBe(78)
    expect(radiusFor(6)).toBe(39)
  })
})

describe('DomainRadar', () => {
  it('names every domain\'s colour for a screen reader, Mā included', () => {
    const { container } = render(<DomainRadar held={new Map([[1, 12], [3, 11]])} />)
    const label = container.querySelector('svg')!.getAttribute('aria-label')!
    expect(label).toContain('strength Taniwha')
    expect(label).toContain('power Uenuku')
    expect(label).toContain('calis Mā')
  })

  it('draws a coloured spoke only for a domain holding a colour', () => {
    const { container } = render(<DomainRadar held={new Map([[2, 4], [5, 11]])} />)
    const spokes = [...container.querySelectorAll('line')].filter(l => l.getAttribute('stroke-width') === '3')
    expect(spokes).toHaveLength(2)
    // Uenuku draws with the rainbow gradient, not a flat hex.
    expect(spokes.map(s => s.getAttribute('stroke'))).toContain('url(#radar-rainbow)')
  })

  it('draws ten vertices even with nothing held', () => {
    const { container } = render(<DomainRadar held={new Map()} />)
    expect(container.querySelectorAll('circle')).toHaveLength(10)
  })
})
